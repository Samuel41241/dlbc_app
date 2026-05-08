// src/lib/messaging/messaging.service.ts
import { db } from '@/lib/db';
import { buildFullHierarchyRLSFilter, type RLSContext } from '@/lib/db-rls';
import { WalletService, InsufficientFundsError } from '@/lib/wallet'; // ✅ FIX 2: Import the class directly
import { MockMessagingProvider, type MessagingProvider } from './providers';

const provider: MessagingProvider = new MockMessagingProvider();
const COST_PER_SMS_IN_KOBO = 200;

export class MessagingService {
  static async dispatch({
    ctx,
    messageType,
    messageText,
    selectedDate,
    selectedService,
    selectedCustomIds,
  }: {
    ctx: RLSContext;
    messageType: string;
    messageText: string;
    selectedDate?: string;
    selectedService?: string;
    selectedCustomIds?: string[];
  }) {
    const rlsFilter = buildFullHierarchyRLSFilter(ctx);
    let recipientPhones: string[] = [];

    if (messageType === 'custom') {
      const members = await db.member.findMany({
        where: { ...rlsFilter, id: { in: selectedCustomIds } },
        select: { phone: true },
      });
      recipientPhones = members.map(m => m.phone).filter(Boolean) as string[];
    } 
    
    else if (messageType === 'broadcast') {
      const members = await db.member.findMany({
        where: rlsFilter,
        select: { phone: true },
      });
      recipientPhones = members.map(m => m.phone).filter(Boolean) as string[];
    } 

    else if (messageType === 'absent') {
      const absentMembers = await db.member.findMany({
        where: {
          ...rlsFilter,
          NOT: {
            attendances: {
              some: {
                attendance: {
                  serviceDate: new Date(selectedDate!),
                  serviceTypeId: selectedService, // Assuming this is the ID based on your schema
                  // ✅ FIX 5: Removed stateId/regionId from here. The rlsFilter handles hierarchy via Location!
                }
              }
            }
          }
        },
        select: { phone: true },
      });
      recipientPhones = absentMembers.map(m => m.phone).filter(Boolean) as string[];
    }

    if (recipientPhones.length === 0) {
      throw new Error('No valid recipients found with phone numbers in your scope.');
    }

    const totalCostKobo = recipientPhones.length * COST_PER_SMS_IN_KOBO;
    const profileId = ctx.userId; 

    // ✅ FIX 3: Deterministic Reference for Idempotency
    // If the exact same user sends the exact same message type to the exact same 
    // date/service/customIDs, it generates the SAME reference. 
    // This prevents double-charging if the network drops and the frontend retries.
    const customIdString = (selectedCustomIds || []).sort().join('_');
    const reference = `${messageType}_${profileId}_${selectedDate || 'NA'}_${selectedService || 'NA'}_${customIdString}`.substring(0, 100);

    let transactionRecord;
    try {
      transactionRecord = await WalletService.debit({
        profileId,
        amountInKobo: totalCostKobo,
        reference, // ✅ FIX 1: Added the required reference
        description: `SMS dispatch to ${recipientPhones.length} contacts`,
        metadata: { messageType, recipientCount: recipientPhones.length },
      });
    } catch (error: any) {
      // ✅ FIX 2: Corrected the instanceof check
      if (error instanceof InsufficientFundsError) {
        throw new Error('Insufficient wallet balance to send this message.');
      }
      throw error;
    }

    const smsPayloads = recipientPhones.map(phone => ({ phone, message: messageText }));
    
    try {
      await provider.sendSms(smsPayloads);
      return {
        success: true,
        recipients: recipientPhones.length,
        cost: totalCostKobo / 100,
        newBalance: transactionRecord.newBalance / 100,
      };
    } catch (smsError) {
      // ✅ FIX 4: Compensating Transaction Protection
      try {
        await WalletService.refund({
          profileId,
          amountInKobo: totalCostKobo,
          description: 'Auto-refund: SMS provider failed',
          reference: transactionRecord.transaction.reference,
        });
        throw new Error('Message dispatch failed. Your wallet has been automatically refunded.');
      } catch (refundError) {
        // 🚨 CRITICAL: Debit succeeded, SMS failed, REFUND FAILED.
        console.error('CRITICAL ALERT: Wallet debited, SMS failed, but REFUND ALSO FAILED!', refundError);
        // We DO NOT tell the user it was refunded. We tell them to contact support.
        throw new Error('A critical system error occurred during dispatch. Please contact support immediately. Ref: ' + reference);
      }
    }
  }
}
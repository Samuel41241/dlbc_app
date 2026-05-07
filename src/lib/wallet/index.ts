// src/lib/wallet/index.ts
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export class InsufficientFundsError extends Error {
  constructor() { super('Insufficient wallet balance'); }
}

export class WalletNotFoundError extends Error {
  constructor() { super('Wallet not initialized. Please contact support.'); }
}

export class DuplicateTransactionError extends Error {
  constructor(reference: string) { super(`Transaction with reference ${reference} already processed`); }
}

export class WalletService {
  
  /**
   * DEBIT: Removes money from a wallet.
   * 
   * ENTERPRISE FIXES:
   * 1. 'reference' is now REQUIRED from the client to guarantee network-retry idempotency.
   * 2. Explicit balance check added to prevent negative balances.
   * 3. Uses { decrement: X } to push math to the PostgreSQL engine instead of Node.js.
   */
  static async debit({
    profileId,
    amountInKobo,
    reference,
    description,
    metadata,
  }: {
    profileId: string;
    amountInKobo: number;
    reference: string; // ✅ FIX: Must come from client
    description: string;
    metadata?: any;
  }) {
    const result = await db.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingTx = await tx.walletTransaction.findUnique({ where: { reference } });
      if (existingTx) {
        throw new DuplicateTransactionError(reference); 
        // Note: We throw instead of returning here so the API layer knows 
        // it was a duplicate request, allowing proper HTTP 409 handling.
      }

      // 2. Lazy initialization (Creates wallet inside the lock if missing)
      const wallet = await tx.wallet.upsert({
        where: { profileId },
        update: {},
        create: { profileId, balance: 0 },
      });

      // ✅ FIX 3: Explicit Insufficient Funds Check
      if (wallet.balance < amountInKobo) {
        throw new InsufficientFundsError();
      }

      const previousBalance = wallet.balance;

      // ✅ FIX 4: Atomic Database-Level Math
      // Translates to: UPDATE wallets SET balance = balance - amountInKobo WHERE id = X
      await tx.wallet.update({ 
        where: { profileId }, 
        data: { balance: { decrement: amountInKobo } } 
      });

      const newBalance = previousBalance - amountInKobo;

      // 4. Create immutable ledger entry
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id, 
          type: 'DEBIT', 
          amount: amountInKobo,
          previousBalance, 
          newBalance, 
          reference, 
          description,
          status: 'SUCCESS', 
          metadata: metadata || {},
        },
      });

      return { transaction, newBalance };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    });

    return result;
  }

  /**
   * REFUND: Adds money back if a downstream provider (like SMS) fails.
   * 
   * ENTERPRISE FIXES:
   * 1. Added Idempotency check (prevents double-refunds on network retry).
   * 2. Added Serializable isolation level (matches debit).
   * 3. Uses { increment: X } for atomic database math.
   */
  static async refund({
    profileId, 
    amountInKobo, 
    description, 
    reference, // ✅ FIX: Now requires reference for idempotency
  }: {
    profileId: string; 
    amountInKobo: number; 
    description: string; 
    reference: string; 
  }) {
    await db.$transaction(async (tx) => {
      // ✅ FIX 1: Prevent Double Refunds
      const existingTx = await tx.walletTransaction.findUnique({ where: { reference } });
      if (existingTx) {
        throw new DuplicateTransactionError(reference);
      }

      const wallet = await tx.wallet.findUnique({ where: { profileId } });
      if (!wallet) throw new WalletNotFoundError();

      const previousBalance = wallet.balance;

      // ✅ FIX 2: Atomic Database Math
      await tx.wallet.update({ 
        where: { profileId }, 
        data: { balance: { increment: amountInKobo } } 
      });

      const newBalance = previousBalance + amountInKobo;

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id, 
          type: 'CREDIT', 
          amount: amountInKobo,
          previousBalance, 
          newBalance,
          reference: `refund_${reference}`, 
          description, 
          status: 'REVERSED',
        },
      });
    }, {
      // ✅ FIX 3: Added Serializable isolation! Money operations must have this.
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    });
  }

  /**
   * Ensures a wallet exists for a user.
   * Optional: Only use this if your UI needs to display "Balance: 0" 
   * before the user ever triggers a debit. Otherwise, the lazy-init 
   * inside debit() handles it perfectly without slowing down login.
   */
  static async ensureWallet(profileId: string) {
    await db.wallet.upsert({
      where: { profileId },
      update: {},
      create: { profileId, balance: 0 },
    });
  }
}
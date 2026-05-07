// src/lib/messaging/providers.ts

// ==========================================
// THE INTERFACE (The Contract)
// ==========================================
export interface SmsPayload {
  phone: string;
  message: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export interface MessagingProvider {
  sendSms(payload: SmsPayload[]): Promise<{ success: boolean; cost: number }>;
  sendEmail(payload: EmailPayload): Promise<boolean>;
}

// ==========================================
// MOCK IMPLEMENTATION (Use this until you buy API keys)
// ==========================================
export class MockMessagingProvider implements MessagingProvider {
  async sendSms(payloads: SmsPayload[]): Promise<{ success: boolean; cost: number }> {
    const costPerSms = 2.0;
    const totalCost = payloads.length * costPerSms;
    
    console.log('--- MOCK SMS DISPATCH ---');
    payloads.forEach(p => console.log(`To: ${p.phone} | Msg: ${p.message.substring(0, 30)}...`));
    console.log(`Total Recipients: ${payloads.length} | Mock Cost: ₦${totalCost}`);
    console.log('-------------------------');

    return { success: true, cost: totalCost };
  }

  async sendEmail(payload: EmailPayload): Promise<boolean> {
    console.log('--- MOCK EMAIL DISPATCH ---');
    console.log(`To: ${payload.to} | Subject: ${payload.subject}`);
    console.log('--------------------------');
    return true;
  }
}

// ==========================================
// FUTURE IMPLEMENTATION (Uncomment when ready)
// ==========================================
/*
import Termii from 'termii';
import { Resend } from 'resend';

export class ProductionMessagingProvider implements MessagingProvider {
  private smsClient = new Termii(process.env.TERMII_API_KEY!);
  private emailClient = new Resend(process.env.RESEND_API_KEY!);

  async sendSms(payloads: SmsPayload[]): Promise<{ success: boolean; cost: number }> {
    // Real Termii/Twilio logic here
    return { success: true, cost: 0 };
  }

  async sendEmail(payload: EmailPayload): Promise<boolean> {
    await this.emailClient.emails.send(payload);
    return true;
  }
}
*/
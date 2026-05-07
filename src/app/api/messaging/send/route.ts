import { NextRequest, NextResponse } from 'next/server';
import { getRLSContext } from '@/lib/db-rls';
import { MessagingService } from '@/lib/messaging/messaging.service';
import { canPerform } from '@/lib/rbac';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate & Extract RLS Context from JWT
    const ctx = getRLSContext(request);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Enterprise RBAC Check
    if (!canPerform(ctx.role, 'send_message')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Messaging permission required' }, { status: 403 });
    }

    // 3. Validate Request Body
    const body = await request.json();
    const { messageType, messageText, selectedDate, selectedService, selectedCustomIds } = body;

    if (!messageText || messageText.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Message text cannot be empty' }, { status: 400 });
    }

    if ((messageType === 'absent' || messageType === 'present') && (!selectedDate || !selectedService)) {
      return NextResponse.json({ success: false, error: 'Date and service are required for attendance-based messaging' }, { status: 400 });
    }

    // 4. Execute the secure enterprise pipeline (Wallet lock -> RLS query -> Send)
    const result = await MessagingService.dispatch({
      ctx,
      messageType,
      messageText: messageText.trim(),
      selectedDate,
      selectedService,
      selectedCustomIds,
    });

    return NextResponse.json({ success: true, data: result });

  } catch (error: any) {
    console.error('Messaging Error:', error);
    // Return 402 Payment Required if wallet is empty, else 500 Server Error
    const status = error.message.includes('Insufficient') ? 402 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}


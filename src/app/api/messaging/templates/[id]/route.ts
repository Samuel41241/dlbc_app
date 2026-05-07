import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRLSContext, buildFullHierarchyRLSFilter } from '@/lib/db-rls';
import { canPerform } from '@/lib/rbac';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = getRLSContext(request);
  if (!ctx || !canPerform(ctx.role, 'send_message')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { title, content } = await request.json();
  
  // Ensure they own the template within their RLS scope before updating
  await db.messageTemplate.updateMany({
    where: { id: params.id, ...buildFullHierarchyRLSFilter(ctx) },
    data: { title, content, updatedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = getRLSContext(request);
  if (!ctx || !canPerform(ctx.role, 'send_message')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete only if it belongs to their jurisdiction
  await db.messageTemplate.deleteMany({
    where: { id: params.id, ...buildFullHierarchyRLSFilter(ctx) },
  });

  return NextResponse.json({ success: true });
}
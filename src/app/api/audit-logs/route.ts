import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildAuditLogRLSFilter, mergeWithRLS, getRLSContext } from '@/lib/db-rls';
import { canPerform } from '@/lib/rbac';

// ========================================
// GET /api/audit-logs
// ========================================
export async function GET(request: NextRequest) {
  try {
    // ✅ PRODUCTION FIX: Single source of truth for auth & context
    const ctx = getRLSContext(request);

    if (!ctx) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!canPerform(ctx.role, 'view_audit_logs')) {
      return NextResponse.json(
        { success: false, error: 'Access denied: view_audit_logs permission required' },
        { status: 403 }
      );
    }

    // ✅ PRODUCTION FIX: Filters logs by traversing the `actor` relation to match the user's hierarchy
    const rlsFilter = buildAuditLogRLSFilter(ctx);
    const { searchParams } = new URL(request.url);

    const userFilter: Record<string, unknown> = {};
    const actionType = searchParams.get('actionType');

    if (actionType) userFilter.actionType = actionType;

    const where = mergeWithRLS(rlsFilter, userFilter);

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const total = await db.auditLog.count({ where });

    return NextResponse.json({ success: true, data: logs, total });
  } catch (error) {
    console.error('Audit Logs GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

// ========================================
// POST /api/audit-logs
// ========================================
export async function POST(request: NextRequest) {
  try {
    // ✅ PRODUCTION FIX: Single source of truth for auth & context
    const ctx = getRLSContext(request);

    if (!ctx) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ✅ PRODUCTION SECURITY: Prevent lower-level admins/pastors from spoofing logs via HTTP
    const allowedRolesToWriteLogs = ['super_admin', 'state_admin', 'region_admin', 'group_admin'];
    if (!allowedRolesToWriteLogs.includes(ctx.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient privileges to write audit logs' },
        { status: 403 }
      );
    }

    const body = await request.json() as { 
      actionType: string; 
      target?: string; 
      targetId?: string; 
      description?: string 
    };
    
    const { actionType, target, targetId, description } = body;

    if (!actionType) {
      return NextResponse.json(
        { success: false, error: 'Action type is required' },
        { status: 400 }
      );
    }

    // ✅ PRODUCTION SECURITY: Force the actor to be the logged-in user directly from context.
    // Ignore any 'actorId' passed in the body to prevent impersonation.
    const log = await db.auditLog.create({
      data: {
        actionType,
        actorId: ctx.userId, 
        target: target || null,
        targetId: targetId || null,
        description: description || null,
      },
    });

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error('Audit Logs POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create audit log' },
      { status: 500 }
    );
  }
}
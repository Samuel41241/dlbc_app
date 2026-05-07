import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildProfileRLSFilter, mergeWithRLS, validateCreationScope, getRLSContext } from '@/lib/db-rls';
import { canPerform, canCreateRole, ALL_ROLES, ROLE_LABELS, HIERARCHY_LEVELS } from '@/lib/rbac';
import type { SystemRole } from '@/lib/rbac';
import bcrypt from 'bcrypt';

// ========================================
// HELPERS
// ========================================

async function logAudit(data: {
  actionType: string;
  actorId?: string | null;
  target?: string | null;
  targetId?: string | null;
  description?: string | null;
}) {
  await db.auditLog.create({ data });
}

/**
 * Validate that actor has higher hierarchy level than target user.
 * Prevents a lower-level admin from unlocking/modifying a higher-level user.
 */
function canManageTarget(
  actorRole: SystemRole,
  targetRole: SystemRole,
  actorCtx: { userId: string }
): { allowed: boolean; reason: string } {
  const actorLevel = HIERARCHY_LEVELS[actorRole] ?? 99;
  const targetLevel = HIERARCHY_LEVELS[targetRole] ?? 99;

  // Super Admin can manage anyone
  if (actorRole === 'super_admin') return { allowed: true, reason: '' };

  // Cannot manage super admin
  if (targetRole === 'super_admin') return { allowed: false, reason: 'Cannot manage Super Admin accounts' };

  // Same-level pastors cannot manage each other (unless they're admins)
  const actorCat = actorRole.endsWith('_pastor') ? 'pastor' : 'admin';
  const targetCat = targetRole.endsWith('_pastor') ? 'pastor' : 'admin';

  // Pastors can only manage users at their same level (already enforced by canCreateRole)
  if (actorCat === 'pastor' && actorLevel === targetLevel) {
    return { allowed: false, reason: 'Pastors cannot manage users at their same level' };
  }

  // Admin must have strictly higher level (lower number) to manage target
  if (actorLevel >= targetLevel) {
    return {
      allowed: false,
      reason: `${ROLE_LABELS[actorRole]} cannot manage ${ROLE_LABELS[targetRole]}`,
    };
  }

  return { allowed: true, reason: '' };
}

// ========================================
// GET /api/users — List profiles (RLS-filtered)
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

    if (!canPerform(ctx.role, 'manage_users')) {
      return NextResponse.json({ success: false, error: 'Access denied: manage_users permission required' }, { status: 403 });
    }

    const rlsFilter = buildProfileRLSFilter(ctx);
    const { searchParams } = new URL(request.url);

    const userFilter: Record<string, unknown> = {};
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    if (role) userFilter.role = role;
    if (status) userFilter.status = status;

    if (search) {
      userFilter.OR = [
        { email: { contains: search } },
        { fullName: { contains: search } },
      ];
    }

    const where = mergeWithRLS(rlsFilter, userFilter);

    const profiles = await db.profile.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        stateId: true,
        regionId: true,
        groupId: true,
        districtId: true,
        locationId: true,
        status: true,
        isActive: true,
        failedLoginAttempts: true,
        lockedAt: true,
        createdAt: true,
        state: { select: { name: true } },
        region: { select: { name: true } },
        group: { select: { name: true } },
        district: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = await db.profile.count({ where });

    return NextResponse.json({ success: true, data: profiles, total });
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}

// ========================================
// POST /api/users — Create profile
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

    if (!canPerform(ctx.role, 'create_user')) {
      return NextResponse.json({ success: false, error: 'Access denied: create_user permission required' }, { status: 403 });
    }

    const body = await request.json();
    const { email, fullName, role: targetRole, password, stateId, regionId, groupId, districtId, locationId } = body;

    if (!email || !fullName || !targetRole) {
      return NextResponse.json({ success: false, error: 'Email, full name, and role are required' }, { status: 400 });
    }

    // Validate role
    if (!ALL_ROLES.includes(targetRole)) {
      return NextResponse.json({ success: false, error: `Invalid role: ${targetRole}` }, { status: 400 });
    }

    // Check if creator can create this role
    if (!canCreateRole(ctx.role, targetRole)) {
      return NextResponse.json({
        success: false,
        error: `You (${ROLE_LABELS[ctx.role]}) cannot create a user with role: ${ROLE_LABELS[targetRole as SystemRole]}`,
      }, { status: 403 });
    }

    // Validate password
    if (!password) {
      return NextResponse.json({ success: false, error: 'Password is required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Validate hierarchy requirements per role
    const level = HIERARCHY_LEVELS[targetRole as keyof typeof HIERARCHY_LEVELS];
    if (level === undefined) {
      return NextResponse.json({ success: false, error: `Invalid role: ${targetRole}` }, { status: 400 });
    }

    // AUTO-INHERIT RULE: hierarchy defaults to creator's scope
    const effectiveStateId = stateId || ctx.scope.stateId || null;
    const effectiveRegionId = regionId || ctx.scope.regionId || null;
    const effectiveGroupId = groupId || ctx.scope.groupId || null;
    const effectiveDistrictId = districtId || ctx.scope.districtId || null;
    const effectiveLocationId = locationId || ctx.scope.locationId || null;

    if (level >= 1 && !effectiveStateId) {
      return NextResponse.json({ success: false, error: `${ROLE_LABELS[targetRole as SystemRole]} requires a state assignment` }, { status: 400 });
    }
    if (level >= 2 && !effectiveRegionId) {
      return NextResponse.json({ success: false, error: `${ROLE_LABELS[targetRole as SystemRole]} requires a region assignment` }, { status: 400 });
    }
    if (level >= 3 && !effectiveGroupId) {
      return NextResponse.json({ success: false, error: `${ROLE_LABELS[targetRole as SystemRole]} requires a group assignment` }, { status: 400 });
    }
    if (level >= 4 && !effectiveDistrictId) {
      return NextResponse.json({ success: false, error: `${ROLE_LABELS[targetRole as SystemRole]} requires a district assignment` }, { status: 400 });
    }
    if (level >= 5 && !effectiveLocationId) {
      return NextResponse.json({ success: false, error: `${ROLE_LABELS[targetRole as SystemRole]} requires a location assignment` }, { status: 400 });
    }

    // Validate hierarchy scope for creation (RLS check)
    if (effectiveStateId) {
      const scopeError = validateCreationScope(ctx, {
        stateId: effectiveStateId,
        regionId: effectiveRegionId,
        groupId: effectiveGroupId,
        districtId: effectiveDistrictId,
        locationId: effectiveLocationId,
      });
      if (scopeError) {
        return NextResponse.json({ success: false, error: scopeError }, { status: 403 });
      }
    }

    // Check for duplicate email
    const existing = await db.profile.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ success: false, error: 'A user with this email already exists' }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    const profile = await db.profile.create({
      data: {
        email: email.toLowerCase(),
        fullName,
        role: targetRole,
        passwordHash,
        stateId: effectiveStateId,
        regionId: effectiveRegionId,
        groupId: effectiveGroupId,
        districtId: effectiveDistrictId,
        locationId: effectiveLocationId,
        status: 'active',
        isActive: true,
      },
    });

    // ✅ PRODUCTION FIX: Use ctx.userId securely from master context
    await logAudit({
      actionType: 'CREATE_USER',
      actorId: ctx.userId,
      target: profile.email,
      targetId: profile.id,
      description: `Created user "${profile.fullName}" (${profile.email}) as ${ROLE_LABELS[targetRole as SystemRole]}`,
    });
    
    return NextResponse.json({ success: true, data: profile }, { status: 201 });
  } catch (error) {
    console.error('Users POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 });
  }
}

// ========================================
// PATCH /api/users — Update profile (status, role, scope, password)
// ========================================

export async function PATCH(request: NextRequest) {
  try {
    // ✅ PRODUCTION FIX: Single source of truth for auth & context
    const ctx = getRLSContext(request);
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!canPerform(ctx.role, 'manage_users')) {
      return NextResponse.json({ success: false, error: 'Access denied: manage_users permission required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      fullName,
      role: targetRole,
      stateId, regionId, groupId, districtId, locationId,
      status,
      isActive,
      unlock,
      password,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    // ✅ PRODUCTION FIX: Prevent self-modification using ctx.userId
    if (id === ctx.userId) {
      return NextResponse.json({ success: false, error: 'Cannot modify your own account through this endpoint' }, { status: 400 });
    }

    // Verify target profile is within scope
    const rlsFilter = buildProfileRLSFilter(ctx);
    const targetProfile = await db.profile.findFirst({
      where: { ...rlsFilter, id },
      select: {
        id: true, email: true, fullName: true, role: true,
        status: true, isActive: true, failedLoginAttempts: true, lockedAt: true,
        stateId: true, regionId: true, groupId: true, districtId: true, locationId: true,
      },
    });

    if (!targetProfile) {
      return NextResponse.json({ success: false, error: 'User not found or access denied' }, { status: 404 });
    }

    // Hierarchy level check: actor must be higher level than target
    const manageCheck = canManageTarget(ctx.role, targetProfile.role as SystemRole, ctx);
    if (!manageCheck.allowed) {
      return NextResponse.json({ success: false, error: manageCheck.reason }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    let auditActionType = 'USER_UPDATED';
    let auditDescription = '';

    // ---- UNLOCK ACCOUNT ----
    if (unlock) {
      if (targetProfile.status !== 'locked') {
        return NextResponse.json({ success: false, error: 'Account is not locked' }, { status: 400 });
      }
      updateData.status = 'active';
      updateData.isActive = true;
      updateData.failedLoginAttempts = 0;
      updateData.lockedAt = null;
      auditActionType = 'ACCOUNT_UNLOCKED';
      auditDescription = `Unlocked account for "${targetProfile.fullName}" (${targetProfile.email})`;
    }

    // ---- STATUS CHANGE ----
    else if (status !== undefined && status !== targetProfile.status) {
      const validStatuses = ['active', 'locked', 'deactivated'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ success: false, error: `Invalid status: ${status}` }, { status: 400 });
      }

      // Only admins can change status
      if (ctx.role.endsWith('_pastor')) {
        return NextResponse.json({ success: false, error: 'Pastors cannot change account status' }, { status: 403 });
      }

      if (status === 'active') {
        updateData.status = 'active';
        updateData.isActive = true;
        updateData.failedLoginAttempts = 0;
        updateData.lockedAt = null;
        auditActionType = 'ACCOUNT_ACTIVATED';
        auditDescription = `Activated account for "${targetProfile.fullName}" (${targetProfile.email})`;
      } else if (status === 'deactivated') {
        updateData.status = 'deactivated';
        updateData.isActive = false;
        auditActionType = 'ACCOUNT_DEACTIVATED';
        auditDescription = `Deactivated account for "${targetProfile.fullName}" (${targetProfile.email})`;
      } else if (status === 'locked') {
        updateData.status = 'locked';
        updateData.isActive = false;
        updateData.lockedAt = new Date();
        auditActionType = 'ACCOUNT_LOCKED_MANUAL';
        auditDescription = `Manually locked account for "${targetProfile.fullName}" (${targetProfile.email})`;
      }
    }

    // ---- PASSWORD RESET ----
    if (password) {
      if (password.length < 8) {
        return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
      }
      updateData.passwordHash = await bcrypt.hash(password, 12);
      auditActionType = auditDescription ? 'USER_UPDATED_PASSWORD_RESET' : 'PASSWORD_RESET';
      auditDescription = (auditDescription ? auditDescription + '; ' : '') + `Reset password for "${targetProfile.fullName}" (${targetProfile.email})`;
    }

    // ---- ROLE CHANGE ----
    if (targetRole && targetRole !== targetProfile.role) {
      if (!ALL_ROLES.includes(targetRole)) {
        return NextResponse.json({ success: false, error: `Invalid role: ${targetRole}` }, { status: 400 });
      }
      if (!canCreateRole(ctx.role, targetRole)) {
        return NextResponse.json({ success: false, error: `Cannot assign role: ${ROLE_LABELS[targetRole as SystemRole]}` }, { status: 403 });
      }
      updateData.role = targetRole;
      if (!auditDescription) {
        auditActionType = 'ROLE_UPDATED';
        auditDescription = `Changed role for "${targetProfile.fullName}" from ${ROLE_LABELS[targetProfile.role as SystemRole]} to ${ROLE_LABELS[targetRole as SystemRole]}`;
      } else {
        auditDescription += `; Role changed from ${ROLE_LABELS[targetProfile.role as SystemRole]} to ${ROLE_LABELS[targetRole as SystemRole]}`;
      }
    }

    // ---- NAME UPDATE ----
    if (fullName !== undefined && fullName !== targetProfile.fullName) {
      updateData.fullName = fullName;
      if (!auditDescription) {
        auditActionType = 'USER_UPDATED';
        auditDescription = `Updated name for "${targetProfile.email}" to "${fullName}"`;
      }
    }

    // ---- SCOPE CHANGE ----
    if (stateId !== undefined || regionId !== undefined || groupId !== undefined || districtId !== undefined || locationId !== undefined) {
      const newScope = {
        stateId: stateId ?? targetProfile.stateId,
        regionId: regionId ?? targetProfile.regionId,
        groupId: groupId ?? targetProfile.groupId,
        districtId: districtId ?? targetProfile.districtId,
        locationId: locationId ?? targetProfile.locationId,
      };

      // Validate hierarchy requirements for the target role
      const effectiveRole = (targetRole || targetProfile.role) as SystemRole;
      const level = HIERARCHY_LEVELS[effectiveRole as keyof typeof HIERARCHY_LEVELS];
      if (level >= 1 && !newScope.stateId) {
        return NextResponse.json({ success: false, error: `${ROLE_LABELS[effectiveRole]} requires a state assignment` }, { status: 400 });
      }
      if (level >= 2 && !newScope.regionId) {
        return NextResponse.json({ success: false, error: `${ROLE_LABELS[effectiveRole]} requires a region assignment` }, { status: 400 });
      }
      if (level >= 3 && !newScope.groupId) {
        return NextResponse.json({ success: false, error: `${ROLE_LABELS[effectiveRole]} requires a group assignment` }, { status: 400 });
      }
      if (level >= 4 && !newScope.districtId) {
        return NextResponse.json({ success: false, error: `${ROLE_LABELS[effectiveRole]} requires a district assignment` }, { status: 400 });
      }
      if (level >= 5 && !newScope.locationId) {
        return NextResponse.json({ success: false, error: `${ROLE_LABELS[effectiveRole]} requires a location assignment` }, { status: 400 });
      }

      // Validate creation scope (RLS check)
      if (newScope.stateId) {
        const scopeError = validateCreationScope(ctx, newScope);
        if (scopeError) {
          return NextResponse.json({ success: false, error: scopeError }, { status: 403 });
        }
      }

      updateData.stateId = stateId !== undefined ? stateId : undefined;
      updateData.regionId = regionId !== undefined ? regionId : undefined;
      updateData.groupId = groupId !== undefined ? groupId : undefined;
      updateData.districtId = districtId !== undefined ? districtId : undefined;
      updateData.locationId = locationId !== undefined ? locationId : undefined;

      if (!auditDescription) {
        auditActionType = 'USER_UPDATED';
        auditDescription = `Updated scope for "${targetProfile.fullName}" (${targetProfile.email})`;
      }
    }

    // ---- LEGACY isActive (for backward compat) ----
    if (isActive !== undefined && status === undefined && !unlock) {
      updateData.isActive = isActive;
      if (isActive) {
        updateData.status = 'active';
        updateData.failedLoginAttempts = 0;
        updateData.lockedAt = null;
        auditActionType = 'ACCOUNT_ACTIVATED';
        auditDescription = `Activated account for "${targetProfile.fullName}" (${targetProfile.email})`;
      } else {
        updateData.status = 'deactivated';
        auditActionType = 'ACCOUNT_DEACTIVATED';
        auditDescription = `Deactivated account for "${targetProfile.fullName}" (${targetProfile.email})`;
      }
    }

    // Nothing to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No changes specified' }, { status: 400 });
    }

    const updated = await db.profile.update({
      where: { id },
      data: updateData,
    });

    // ✅ PRODUCTION FIX: Use ctx.userId securely from master context
    await logAudit({
      actionType: auditActionType,
      actorId: ctx.userId,
      target: targetProfile.email,
      targetId: targetProfile.id,
      description: auditDescription || `Updated user ${targetProfile.email}`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Users PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

// ========================================
// DELETE /api/users — Deactivate profile (soft delete)
// ========================================

export async function DELETE(request: NextRequest) {
  try {
    // ✅ PRODUCTION FIX: Single source of truth for auth & context
    const ctx = getRLSContext(request);
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!canPerform(ctx.role, 'manage_users')) {
      return NextResponse.json({ success: false, error: 'Access denied: manage_users permission required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    // ✅ PRODUCTION FIX: Prevent self-deactivation using ctx.userId
    if (id === ctx.userId) {
      return NextResponse.json({ success: false, error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    const rlsFilter = buildProfileRLSFilter(ctx);
    const targetProfile = await db.profile.findFirst({ where: { ...rlsFilter, id } });

    if (!targetProfile) {
      return NextResponse.json({ success: false, error: 'User not found or access denied' }, { status: 404 });
    }

    // Hierarchy level check
    const manageCheck = canManageTarget(ctx.role, targetProfile.role as SystemRole, ctx);
    if (!manageCheck.allowed) {
      return NextResponse.json({ success: false, error: manageCheck.reason }, { status: 403 });
    }

    // Soft delete (deactivate)
    await db.profile.update({
      where: { id },
      data: { isActive: false, status: 'deactivated' },
    });

    // ✅ PRODUCTION FIX: Use ctx.userId securely from master context
    await logAudit({
      actionType: 'ACCOUNT_DEACTIVATED',
      actorId: ctx.userId,
      target: targetProfile.email,
      targetId: targetProfile.id,
      description: `Deactivated account for "${targetProfile.fullName}" (${targetProfile.email})`,
    });

    return NextResponse.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    console.error('Users DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to deactivate user' }, { status: 500 });
  }
}
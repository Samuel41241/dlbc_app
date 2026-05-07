import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { SystemRole, UserScope,  AuthenticatedUserScope  } from '@/lib/rbac';
import { ROLE_LABELS, getRoleCategory, ROLE_TO_SCOPE_LEVEL } from '@/lib/rbac';
import { createRLSContextFromProfile } from '@/lib/db-rls';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'; 
import { WalletService } from '@/lib/wallet'; // Put at top of file


const MAX_FAILED_ATTEMPTS = 5;

// POST /api/auth — Authenticate user via Profile model (bcrypt password verification)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      
      return NextResponse.json({ success: false, error: 'Email and password required' }, { status: 400 });
    }

    const profile = await db.profile.findUnique({
      where: { email: email.toLowerCase() },
      include: { state: true, region: true, group: true, district: true, location: true },
    });

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    // Check account status first
    if (profile.status === 'deactivated') {
      return NextResponse.json({ success: false, error: 'Account is deactivated. Contact your administrator.', status: 'deactivated' }, { status: 403 });
    }

    if (profile.status === 'locked') {
      return NextResponse.json({ success: false, error: 'Account is locked due to too many failed login attempts. Contact your administrator to unlock.', status: 'locked' }, { status: 423 });
    }

    if (!profile.isActive) {
      return NextResponse.json({ success: false, error: 'Account is not active. Contact your administrator.', status: 'inactive' }, { status: 403 });
    }

    if (!profile.passwordHash) {
      return NextResponse.json({ success: false, error: 'Account not configured. Contact administrator.' }, { status: 403 });
    }

    // Verify password with bcrypt
    const validPassword = await bcrypt.compare(password, profile.passwordHash);
    if (!validPassword) {
      const newAttemptCount = profile.failedLoginAttempts + 1;
      const willLock = newAttemptCount >= MAX_FAILED_ATTEMPTS;

      // Update failed login attempts and potentially lock the account
      await db.profile.update({
        where: { id: profile.id },
        data: {
          failedLoginAttempts: newAttemptCount,
          ...(willLock ? {
            status: 'locked',
            isActive: false,
            lockedAt: new Date(),
          } : {}),
        },
      });

      // Log the failed attempt (and lock event if applicable)
        await db.auditLog.create({
        data: {
          actionType: willLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
          actorId: profile.id, // ✅ FIXED: Only save the ID
          target: profile.email,
          targetId: profile.id,
          description: willLock
            ? `Account locked after ${newAttemptCount} failed login attempts`
            : `Failed login attempt ${newAttemptCount} of ${MAX_FAILED_ATTEMPTS}`,
          // ✅ FIXED: Removed actor, actorRole, and all hierarchy IDs
        },
      });

      if (willLock) {
        return NextResponse.json({
          success: false,
          error: `Account locked after ${MAX_FAILED_ATTEMPTS} failed login attempts. Contact your administrator.`,
          status: 'locked',
        }, { status: 423 });
      }

      return NextResponse.json({
        success: false,
        error: `Invalid email or password. ${MAX_FAILED_ATTEMPTS - newAttemptCount} attempt(s) remaining.`,
      }, { status: 401 });
    }

    // Reset failed login attempts on successful login
    if (profile.failedLoginAttempts > 0) {
      await db.profile.update({
        where: { id: profile.id },
        data: { failedLoginAttempts: 0 },
      });
    }

    // Log successful login
        // Log successful login
    await db.auditLog.create({
      data: {
        actionType: 'LOGIN_SUCCESS',
        actorId: profile.id, // ✅ FIXED: Only save the ID
        target: profile.email,
        targetId: profile.id,
        description: `User logged in successfully as ${ROLE_LABELS[profile.role as SystemRole] || profile.role}`,
        // ✅ FIXED: Removed actor, actorRole, and all hierarchy IDs
      },
    });

    const role = profile.role as SystemRole;
    const roleCategory = getRoleCategory(role);

   const scope: AuthenticatedUserScope = {
      level: ROLE_TO_SCOPE_LEVEL[role], // Safe injection
      stateId: profile.stateId,
      regionId: profile.regionId,
      groupId: profile.groupId,
      districtId: profile.districtId,
      locationId: profile.locationId,
    };

    const rlsContext = createRLSContextFromProfile(profile);
    

    const authUser = {
      id: profile.id,
      email: profile.email,
      name: profile.fullName || profile.email,
      role,
      roleCategory,
      roleLabel: ROLE_LABELS[role],
      scope,
      status: profile.status,
      isActive: profile.isActive,
      stateName: profile.state?.name || null,
      regionName: profile.region?.name || null,
      groupName: profile.group?.name || null,
      districtName: profile.district?.name || null,
      locationName: profile.location?.name || null,
      
    };

    
await WalletService.ensureWallet(profile.id);
    const token = jwt.sign(
  {
    userId: profile.id,
    role: profile.role,
    email: profile.email,
    stateId: profile.stateId,
    regionId: profile.regionId,
    groupId: profile.groupId,
    districtId: profile.districtId,
    locationId: profile.locationId,
  },
  process.env.INTERNAL_SECRET!,
  { expiresIn: '1d' }
);

// To this:
return NextResponse.json({
  success: true,
  data: {
    token,
    user: authUser,
  },
});

  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 500 });
  }
}

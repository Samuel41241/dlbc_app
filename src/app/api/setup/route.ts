import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcrypt';


// GET /api/setup — Check if system is initialized
export async function GET() {
  try {
    const profileCount = await db.profile.count();
    const stateCount = await db.state.count();
    const locationCount = await db.location.count();
    const memberCount = await db.member.count();

    return NextResponse.json({
      initialized: profileCount > 0,
      profileCount,
      hierarchy: { states: stateCount, locations: locationCount },
      data: { members: memberCount },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Setup check failed' }, { status: 500 });
  }
}

// POST /api/setup — Create first Super Admin (only when no profiles exist)
export async function POST(request: NextRequest) {

  
  try {
    // Reject if system already has users
    const existingCount = await db.profile.count();
    if (existingCount > 0) {
      return NextResponse.json(
        { success: false, error: 'System already initialized. Use User Management to create additional users.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, fullName, password } = body;

    if (!email || !fullName || !password) {
      return NextResponse.json({ success: false, error: 'Email, full name, and password are required' }, { status: 400 });
    }

    // Validate password strength (min 8 chars)
    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const emailLower = email.toLowerCase();

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 12);

    // Create Super Admin profile
    const profile = await db.profile.create({
      data: {
        email: emailLower,
        fullName,
        passwordHash,
        role: 'super_admin',
        stateId: null,
        regionId: null,
        groupId: null,
        districtId: null,
        locationId: null,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Super Admin created successfully. You can now sign in.',
      data: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ success: false, error: 'A profile with this email already exists' }, { status: 409 });
    }
    console.error('Setup error:', error);
    return NextResponse.json({ success: false, error: 'Setup failed' }, { status: 500 });
  }
}

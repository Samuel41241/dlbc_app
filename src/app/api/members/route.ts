import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildRLSFilter, mergeWithRLS, validateCreationScope, validateMemberHierarchyPath, getRLSContext } from '@/lib/db-rls';
import { canPerform, getRoleCategory } from '@/lib/rbac';

// Helper: Generate DLBC card number with uniqueness check
async function generateCardNumber(locationName: string): Promise<string> {
  const locPrefix = locationName.substring(0, 3).toUpperCase();
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  const basePrefix = `${locPrefix}-${yearSuffix}-`;

  const lastMember = await db.member.findFirst({
    where: { cardNumber: { startsWith: basePrefix } },
    orderBy: { cardNumber: 'desc' },
    select: { cardNumber: true }
  });

  let nextSerial = 1;
  if (lastMember) {
    const parts = lastMember.cardNumber.split('-');
    nextSerial = parseInt(parts[2], 10) + 1;
  }

  const serialStr = nextSerial.toString().padStart(4, '0');
  return `${basePrefix}${serialStr}`;
}

// Helper: Audit log helper
async function logAudit(
  actionType: string,
  actorId: string | null,
  targetName: string,
  targetId: string | null,
  description: string,
) {
  try {
    await db.auditLog.create({
      data: { actionType, actorId, target: targetName, targetId, description },
    });
  } catch (e) { console.error('Audit log write failed:', e); }
}

// GET /api/members — List members (RLS-filtered)
export async function GET(request: NextRequest) {
  try {
    // ✅ PRODUCTION FIX: Single source of truth for auth & context
    const ctx = getRLSContext(request);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!canPerform(ctx.role, 'view_member')) {
      return NextResponse.json({ success: false, error: 'Access denied: view_member permission required' }, { status: 403 });
    }
    
    // ✅ SHEPHERD LOCK: Only users assigned to a location can view member lists
    if (!ctx.scope.locationId) {
      return NextResponse.json(
        { success: true, data: { members: [] } }, 
        { status: 200 }
      );
    }

    const rlsFilter = buildRLSFilter(ctx);
    const { searchParams } = new URL(request.url);

    const userFilter: Record<string, unknown> = {};
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const locationId = searchParams.get('locationId');
    const search = searchParams.get('search');

    if (category) userFilter.category = category;
    if (status === 'Active') userFilter.isActive = true;
    else if (status === 'Inactive') userFilter.isActive = false;
    if (locationId) userFilter.locationId = locationId;
    if (search) {
      userFilter.OR = [
        { fullName: { contains: search } },
        { phone: { contains: search } },
        { cardNumber: { contains: search } },
      ];
    }

    const where = mergeWithRLS(rlsFilter, userFilter);

    const members = await db.member.findMany({
      where,
      include: { location: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const data = members.map((m) => ({
      id: m.id,
      cardNumber: m.cardNumber,
      fullName: m.fullName,
      category: m.category,
      phone: m.phone,
      gender: m.gender,
      address: m.address,
      status: m.isActive ? 'Active' : 'Inactive',
      dateJoined: m.dateJoined.toISOString(),
      locationId: m.locationId,
      isActive: m.isActive,
      createdAt: m.createdAt.toISOString(),
      location: m.location ? { name: m.location.name } : undefined,
    }));

    const total = await db.member.count({ where });

    return NextResponse.json({
      success: true,
      data: { members },
      total,
    });
  } catch (error) {
    console.error('Members GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch members' }, { status: 500 });
  }
}

// POST /api/members — Create member
export async function POST(request: NextRequest) {
  try {
    // ✅ PRODUCTION FIX: Single source of truth for auth & context
    const ctx = getRLSContext(request);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!canPerform(ctx.role, 'register_member')) {
      return NextResponse.json({ success: false, error: 'Access denied: register_member permission required' }, { status: 403 });
    }

    if (!ctx.scope.locationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied: Only assigned Location shepherds can register members.' }, 
        { status: 403 }
      );
    }

    const body = await request.json();
    const { fullName, category, gender, phone, address, dateJoined } = body;

    if (!fullName?.trim()) {
      return NextResponse.json({ success: false, error: 'Full name is required' }, { status: 400 });
    }

    const validCategories = ['Adult', 'Youth', 'Children'];
    if (!category || !validCategories.includes(category)) {
      return NextResponse.json({ success: false, error: `Category is required. Must be one of: ${validCategories.join(', ')}` }, { status: 400 });
    }

    if (category === 'Adult') {
      if (gender !== 'Male' && gender !== 'Female') {
        return NextResponse.json({ success: false, error: 'Gender is required for Adults. Select Male or Female.' }, { status: 400 });
      }
    } else {
      if (gender !== 'Boys' && gender !== 'Girls') {
        return NextResponse.json({ success: false, error: `Gender is required for ${category}. Select Boys or Girls.` }, { status: 400 });
      }
    }

    const location = await db.location.findUnique({
      where: { id: ctx.scope.locationId },
      include: {
        district: { include: { group: { include: { region: { include: { state: true } } } } } },
      },
    });

    if (!location) {
      return NextResponse.json({ success: false, error: 'Location not found' }, { status: 404 });
    }

    const hierarchyIds = {
      stateId: location.district.group.region.state.id,
      regionId: location.district.group.region.id,
      groupId: location.district.group.id,
      districtId: location.district.id,
      locationId: location.id,
    };

    const pathError = validateMemberHierarchyPath(hierarchyIds);
    if (pathError) {
      return NextResponse.json({ success: false, error: pathError }, { status: 400 });
    }

    const scopeError = validateCreationScope(ctx, hierarchyIds);
    if (scopeError) {
      return NextResponse.json({ success: false, error: scopeError }, { status: 403 });
    }

    const cardNumber = await generateCardNumber(location.name);

    const member = await db.member.create({
      data: {
        cardNumber,
        fullName: fullName.trim(),
        category,
        gender: gender || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        dateJoined: dateJoined ? new Date(dateJoined) : new Date(),
        locationId: location.id,
      },
    });

    // ✅ PRODUCTION FIX: Use ctx.userId directly
    await logAudit(
      'MEMBER_CREATED',
      ctx.userId,
      member.fullName,
      member.id,
      `Registered new member: ${member.fullName} (${cardNumber}) [${category}/${gender}]`,
    );

    return NextResponse.json({ success: true, data: member }, { status: 201 });
  } catch (error) {
    console.error('Members POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create member' }, { status: 500 });
  }
}

// PATCH /api/members — Update member
export async function PATCH(request: NextRequest) {
  try {
    // ✅ PRODUCTION FIX: Single source of truth for auth & context
    const ctx = getRLSContext(request);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!canPerform(ctx.role, 'register_member')) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { id, fullName, phone, gender, category, address, isActive, dateJoined } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Member ID is required' }, { status: 400 });
    }

    if (category) {
      const validCategories = ['Adult', 'Youth', 'Children'];
      if (!validCategories.includes(category)) {
        return NextResponse.json({ success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` }, { status: 400 });
      }
    }

    if (isActive !== undefined) {
      const roleCat = getRoleCategory(ctx.role);
      if (roleCat !== 'admin') {
        return NextResponse.json({ success: false, error: 'Only admin roles can change member status' }, { status: 403 });
      }
    }

    const rlsFilter = buildRLSFilter(ctx);
    const member = await db.member.findFirst({ where: { ...rlsFilter, id } });

    if (!member) {
      return NextResponse.json({ success: false, error: 'Member not found or access denied' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (fullName !== undefined) updateData.fullName = fullName.trim();
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (gender !== undefined) updateData.gender = gender || null;
    if (category !== undefined) updateData.category = category;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (dateJoined !== undefined) updateData.dateJoined = dateJoined ? new Date(dateJoined) : undefined;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await db.member.update({
      where: { id },
      data: updateData,
    });

    if (isActive !== undefined) {
      const actionType = isActive ? 'MEMBER_REACTIVATED' : 'MEMBER_DEACTIVATED';
      const actionLabel = isActive ? 'Reactivated' : 'Deactivated';
      // ✅ PRODUCTION FIX: Use ctx.userId directly
      await logAudit(
        actionType,
        ctx.userId,
        updated.fullName,
        updated.id,
        `${actionLabel} member: ${updated.fullName} (${updated.cardNumber})`,
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Members PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update member' }, { status: 500 });
  }
}

// DELETE /api/members
export async function DELETE(request: NextRequest) {
  try {
    // ✅ PRODUCTION FIX: Single source of truth for auth & context
    const ctx = getRLSContext(request);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!canPerform(ctx.role, 'delete_member')) {
      return NextResponse.json({ success: false, error: 'Access denied: delete_member permission required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Member ID required' }, { status: 400 });
    }

    const rlsFilter = buildRLSFilter(ctx);
    const member = await db.member.findFirst({ where: { ...rlsFilter, id } });

    if (!member) {
      return NextResponse.json({ success: false, error: 'Member not found or access denied' }, { status: 404 });
    }

    await db.member.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Member deleted' });
  } catch (error) {
    console.error('Members DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete member' }, { status: 500 });
  }
}
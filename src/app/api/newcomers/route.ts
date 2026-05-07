import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildRLSFilter, mergeWithRLS, validateCreationScope, validateMemberHierarchyPath, getRLSContext } from '@/lib/db-rls';
import { canPerform } from '@/lib/rbac';

// GET /api/newcomers — List newcomers (RLS-filtered)
export async function GET(request: NextRequest) {
  try {
    // ✅ PRODUCTION FIX: Single source of truth for auth & context (removes duplicate verifyToken)
    const ctx = getRLSContext(request);
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ✅ PRODUCTION FIX: buildRLSFilter now safely traverses Location -> District -> Group -> Region -> State
    const rlsFilter = buildRLSFilter(ctx);
    const { searchParams } = new URL(request.url);

    const userFilter: Record<string, unknown> = {};
    const locationId = searchParams.get('locationId');
    const category = searchParams.get('category');

    if (locationId) userFilter.locationId = locationId;
    if (category) userFilter.category = category;

    const where = mergeWithRLS(rlsFilter, userFilter);

    const records = await db.newcomer.findMany({
      where,
      include: { location: { select: { name: true } } },
      orderBy: { dateRecorded: 'desc' },
      take: 100,
    });

    const total = await db.newcomer.count({ where });

    return NextResponse.json({
      success: true,
      data: {
        newcomers: records,
      },
    });
  } catch (error) {
    console.error('Newcomers GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch newcomers' }, { status: 500 });
  }
}

// POST /api/newcomers — Create newcomer record (full hierarchy required)
// POST /api/newcomers — Create newcomer record (full hierarchy required)
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

    if (!canPerform(ctx.role, 'manage_newcomers')) {
      return NextResponse.json({ success: false, error: 'Access denied: manage_newcomers permission required' }, { status: 403 });
    }

    const body = await request.json();
    const { fullName, phoneNumber, email, address, category, gender, serviceTypeId, locationId } = body;

    if (!fullName || !locationId || !serviceTypeId) {
      return NextResponse.json({ success: false, error: 'Full name, location, and service type are required' }, { status: 400 });
    }

    // Validate category
    const validCategories = ['Adult', 'Youth', 'Children'];
    const newcomerCategory = category || 'Adult';
    if (!validCategories.includes(newcomerCategory)) {
      return NextResponse.json({ success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` }, { status: 400 });
    }

    // Resolve hierarchy from location temporarily for RLS validation
    const location = await db.location.findUnique({
      where: { id: locationId },
      include: { district: { include: { group: { include: { region: { include: { state: true } } } } } } },
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

    // Validate full hierarchy path
    const pathError = validateMemberHierarchyPath(hierarchyIds);
    if (pathError) {
      return NextResponse.json({ success: false, error: pathError }, { status: 400 });
    }

    // ✅ PRODUCTION FIX: Validate user has rights to create in this location's hierarchy
    const scopeError = validateCreationScope(ctx, hierarchyIds);
    if (scopeError) {
      return NextResponse.json({ success: false, error: scopeError }, { status: 403 });
    }

    // ✅ ENTERPRISE FIX: Pure findUnique. No ternary `? ... : null` needed.
    const serviceTypeRecord = await db.serviceType.findUnique({ where: { id: serviceTypeId } });
    
    // ✅ ENTERPRISE FIX: If a fake ID is sent, block it. 
    // This 404 check tells TypeScript: "If we get past this line, serviceTypeRecord is 100% guaranteed to exist."
    if (!serviceTypeRecord) {
      return NextResponse.json({ success: false, error: 'Service Type not found' }, { status: 404 });
    }

    const record = await db.newcomer.create({
      data: {
        fullName,
        phoneNumber: phoneNumber || null,
        email: email || null,
        address: address || null,
        category: newcomerCategory,
        gender: gender || null,
        serviceTypeId: serviceTypeId,               
        serviceName: serviceTypeRecord.name, // ✅ TypeScript is happy. It knows this is a pure string.
        dateRecorded: new Date(),
        locationId: location.id,                  
      },
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    console.error('Newcomers POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create newcomer record' }, { status: 500 });
  }
}

// DELETE /api/newcomers — Delete newcomer (RLS-protected)
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

    if (!canPerform(ctx.role, 'manage_newcomers')) {
      return NextResponse.json({ success: false, error: 'Access denied: manage_newcomers permission required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Newcomer ID required' }, { status: 400 });
    }

    // ✅ PRODUCTION FIX: buildRLSFilter correctly traverses the 3NF Location tree
    const rlsFilter = buildRLSFilter(ctx);
    const record = await db.newcomer.findFirst({ where: { ...rlsFilter, id } });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Record not found or access denied' }, { status: 404 });
    }

    await db.newcomer.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Newcomer record deleted' });
  } catch (error) {
    console.error('Newcomers DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete newcomer' }, { status: 500 });
  }
}
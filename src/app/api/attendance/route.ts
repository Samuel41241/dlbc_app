import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildRLSFilter, mergeWithRLS, validateCreationScope, getRLSContext } from '@/lib/db-rls';
import { canPerform } from '@/lib/rbac';

// GET /api/attendance — List attendance (RLS-filtered)
export async function GET(request: NextRequest) {
  try {
    // ✅ PRODUCTION FIX: getRLSContext handles JWT verification automatically. 
    // No need for manual verifyToken checks anymore.
    const ctx = getRLSContext(request);
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!canPerform(ctx.role, 'view_member')) {
      return NextResponse.json({ success: false, error: 'Access denied: view_member permission required' }, { status: 403 });
    }

    // ✅ PRODUCTION FIX: buildRLSFilter now correctly traverses Location -> District -> Group -> Region -> State
    const rlsFilter = buildRLSFilter(ctx);
    const { searchParams } = new URL(request.url);

    const userFilter: Record<string, unknown> = {};
    const locationId = searchParams.get('locationId');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    if (locationId) userFilter.locationId = locationId;
    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {};
      if (fromDate) dateFilter.gte = new Date(fromDate);
      if (toDate) dateFilter.lte = new Date(toDate);
      userFilter.serviceDate = dateFilter;
    }

    const where = mergeWithRLS(rlsFilter, userFilter);

    const records = await db.attendance.findMany({
      where,
      include: { location: { select: { name: true } } },
      orderBy: { serviceDate: 'desc' },
      take: 100,
    });

    const total = await db.attendance.count({ where });

    // Aggregate stats
    const agg = await db.attendance.aggregate({
      where,
      _sum: { present: true, total: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        records: records,           
        total: total,               
        stats: {                    
          totalPresent: agg._sum.present || 0,
          totalCapacity: agg._sum.total || 0,
          serviceCount: agg._count,
        },
      },
    });
  } catch (error) {
    console.error('Attendance GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch attendance' }, { status: 500 });
  }
}

// POST /api/attendance — Create attendance record
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

    if (!canPerform(ctx.role, 'mark_attendance')) {
      return NextResponse.json({ success: false, error: 'Access denied: mark_attendance permission required' }, { status: 403 });
    }

    const body = await request.json();
    const { serviceTypeId, serviceDate, locationId, presentMemberIds } = body;

    if (!serviceTypeId || !serviceDate || !locationId) {
      return NextResponse.json({ success: false, error: 'Service Type ID, date, and location are required' }, { status: 400 });
    }

    // Resolve hierarchy from location 
    // NOTE: We only do this to validate RLS permissions. We DO NOT save these IDs to the database row.
    const location = await db.location.findUnique({ 
      where: { id: locationId }, 
      include: { district: { include: { group: { include: { region: { include: { state: true } } } } } } } 
    });
    
    if (!location) return NextResponse.json({ success: false, error: 'Location not found' }, { status: 404 });

    const hierarchyIds = {
      stateId: location.district.group.region.state.id,
      regionId: location.district.group.region.id,
      groupId: location.district.group.id,
      districtId: location.district.id,
      locationId: location.id,
    };

    // ✅ PRODUCTION FIX: Validate user has rights to create in this location's hierarchy
    const scopeError = validateCreationScope(ctx, hierarchyIds);
    if (scopeError) {
      return NextResponse.json({ success: false, error: scopeError }, { status: 403 });
    }

    // ✅ PRODUCTION FIX: Look up Service Type to get the Snapshot Name (prevents data drift)
    const serviceTypeRecord = await db.serviceType.findUnique({ where: { id: serviceTypeId } });
    if (!serviceTypeRecord) return NextResponse.json({ success: false, error: 'Service Type not found' }, { status: 404 });

    // Check for duplicate
    const existing = await db.attendance.findFirst({
      where: { serviceTypeId, serviceDate: new Date(serviceDate), locationId },
    });
    if (existing) return NextResponse.json({ success: false, error: 'Record already exists' }, { status: 409 });

    // 1. Get ALL members belonging to this location
    const allLocationMembers = await db.member.findMany({
      where: { locationId: location.id },
      select: { id: true }
    });

    const presentSet = new Set(presentMemberIds || []);

    // 2. Create the Attendance Header Record
    const record = await db.attendance.create({
      data: {
        serviceTypeId,                              // FK to ServiceType
        serviceName: serviceTypeRecord.name,         // Snapshot name
        serviceDate: new Date(serviceDate),
        present: presentSet.size,
        total: allLocationMembers.length,
        locationId: location.id,                    // ✅ 3NF: ONLY locationId saved to DB
        // 3. Create the AttendanceMember junction records
        members: {
          create: allLocationMembers.map(member => ({
            memberId: member.id,
            status: presentSet.has(member.id) ? 'present' : 'absent'
          }))
        }
      },
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    console.error('Attendance POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create attendance record' }, { status: 500 });
  }
}

// DELETE /api/attendance — Delete attendance record (RLS-protected)
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

    if (!canPerform(ctx.role, 'mark_attendance')) {
      return NextResponse.json({ success: false, error: 'Access denied: mark_attendance permission required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Attendance record ID required' }, { status: 400 });
    }

    // ✅ PRODUCTION FIX: buildRLSFilter correctly traverses the 3NF Location tree
    const rlsFilter = buildRLSFilter(ctx);
    const record = await db.attendance.findFirst({ where: { ...rlsFilter, id } });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Record not found or access denied' }, { status: 404 });
    }

    await db.attendance.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Attendance record deleted' });
  } catch (error) {
    console.error('Attendance DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete attendance record' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getHierarchyFilter } from '@/lib/db-rls';
import type { RLSContext } from '@/lib/db-rls';
import { canPerform } from '@/lib/rbac';
import { verifyToken } from '@/lib/auth';
import { getUserFromRequest } from '@/lib/auth';

function getRLSContext(request: NextRequest): RLSContext | null {
  const user = getUserFromRequest(request);
  if (!user) return null;

  return {
     userId: user.userId,
    role: user.role,
    scope: {
      stateId: user.stateId || null,
      regionId: user.regionId || null,
      groupId: user.groupId || null,
      districtId: user.districtId || null,
      locationId: user.locationId || null,
    },
  };
}

// GET /api/hierarchy — Get hierarchy tree (scoped to user via getHierarchyFilter)
// GET /api/hierarchy — Get hierarchy tree (scoped to user via getHierarchyFilter)
export async function GET(request: NextRequest) {
  try {
    
    const token = request.headers
      .get('authorization')
      ?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);

    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // ✅ PRODUCTION FIX: Build RLS Context directly from YOUR custom verified token.
    // We bypass getUserFromRequest entirely to ensure we never accidentally touch Supabase sessions.
    const ctx: RLSContext = {
       userId: user.userId,
      role: user.role,
      scope: {
        stateId: user.stateId || null,
        regionId: user.regionId || null,
        groupId: user.groupId || null,
        districtId: user.districtId || null,
        locationId: user.locationId || null,
      },
    };

    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') as 'state' | 'region' | 'group' | 'district' | 'location' | null;
    const parentId = searchParams.get('parentId');

    // ✅ PRODUCTION FIX: Hardcoded "super_admin only" block removed.
    // ALL authenticated users need to READ the hierarchy for their UI dropdowns.
    // Security is enforced by the RLS filters below.

    // Fetch all hierarchy levels using getHierarchyFilter for RLS
    const stateFilter = getHierarchyFilter(ctx, 'state');
    const regionFilter = getHierarchyFilter(ctx, 'region');
    const groupFilter = getHierarchyFilter(ctx, 'group');
    const districtFilter = getHierarchyFilter(ctx, 'district');
    const locationFilter = getHierarchyFilter(ctx, 'location');

    let finalRegionFilter = regionFilter;
    let finalGroupFilter = groupFilter;
    let finalDistrictFilter = districtFilter;
    let finalLocationFilter = locationFilter;

    // Support optional parentId filtering for ALL roles safely
    if (parentId && level === 'region') finalRegionFilter = { ...regionFilter, stateId: parentId };
    if (parentId && level === 'group') finalGroupFilter = { ...groupFilter, regionId: parentId };
    if (parentId && level === 'district') finalDistrictFilter = { ...districtFilter, groupId: parentId };
    if (parentId && level === 'location') finalLocationFilter = { ...locationFilter, districtId: parentId };

    // Fetch all levels in parallel
    const [states, regions, groups, districts, locations] = await Promise.all([
      db.state.findMany({
        where: stateFilter,
        orderBy: { name: 'asc' },
      }),
      db.region.findMany({
        where: finalRegionFilter,
        orderBy: { name: 'asc' },
      }),
      db.churchGroup.findMany({
        where: finalGroupFilter,
        orderBy: { name: 'asc' },
      }),
      db.district.findMany({
        where: finalDistrictFilter,
        orderBy: { name: 'asc' },
      }),
      db.location.findMany({
        where: finalLocationFilter,
        orderBy: { name: 'asc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { states, regions, groups, districts, locations },
    });
  } catch (error) {
    // ✅ If verifyToken fails, or Prisma fails, it is caught HERE.
    // The server worker stays alive. Favicon and Login keep working.
    console.error('Hierarchy GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch hierarchy' }, { status: 500 });
  }
}

// POST /api/hierarchy — Create a new hierarchy node (Parent creates child)
// POST /api/hierarchy — Cascading Creation
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { level, name, parentId } = body;

    if (!level || !name) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    let newNode;

    switch (user.role) {
      case 'super_admin':
        // ✅ SUPER ADMIN: Can create ANY level (State, Region, Group, etc.)
        if (level !== 'state' && !parentId) {
          return NextResponse.json({ success: false, error: 'Parent ID required for this level' }, { status: 400 });
        }
        switch (level) {
          case 'state': newNode = await db.state.create({ data: { name } }); break;
          case 'region': newNode = await db.region.create({ data: { name, stateId: parentId } }); break;
          case 'group': newNode = await db.churchGroup.create({ data: { name, regionId: parentId } }); break;
          case 'district': newNode = await db.district.create({ data: { name, groupId: parentId } }); break;
          case 'location': newNode = await db.location.create({ data: { name, districtId: parentId } }); break;
          default: return NextResponse.json({ success: false, error: 'Invalid level' }, { status: 400 });
        }
        break;

      case 'state_admin':
        // ✅ STATE ADMIN: Can ONLY create Regions under THEIR State
        if (level !== 'region') return NextResponse.json({ success: false, error: 'Forbidden: You can only create Regions' }, { status: 403 });
        if (parentId !== user.stateId) return NextResponse.json({ success: false, error: 'Security violation' }, { status: 403 });
        newNode = await db.region.create({ data: { name, stateId: parentId } });
        break;

      case 'region_admin':
        // ✅ REGION ADMIN: Can ONLY create Groups under THEIR Region
        if (level !== 'group') return NextResponse.json({ success: false, error: 'Forbidden: You can only create Groups' }, { status: 403 });
        if (parentId !== user.regionId) return NextResponse.json({ success: false, error: 'Security violation' }, { status: 403 });
        newNode = await db.churchGroup.create({ data: { name, regionId: parentId } });
        break;

      case 'group_admin':
        // ✅ GROUP ADMIN: Can ONLY create Districts under THEIR Group
        if (level !== 'district') return NextResponse.json({ success: false, error: 'Forbidden: You can only create Districts' }, { status: 403 });
        if (parentId !== user.groupId) return NextResponse.json({ success: false, error: 'Security violation' }, { status: 403 });
        newNode = await db.district.create({ data: { name, groupId: parentId } });
        break;

      case 'district_admin':
        // ✅ DISTRICT ADMIN: Can ONLY create Locations under THEIR District
        if (level !== 'location') return NextResponse.json({ success: false, error: 'Forbidden: You can only create Locations' }, { status: 403 });
        if (parentId !== user.districtId) return NextResponse.json({ success: false, error: 'Security violation' }, { status: 403 });
        newNode = await db.location.create({ data: { name, districtId: parentId } });
        break;

      default:
        // Pastors are blocked
        return NextResponse.json({ success: false, error: 'Forbidden: Pastors cannot create structure' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: newNode });
  } catch (error: any) {
    if (error.code === 'P2025') return NextResponse.json({ success: false, error: 'Parent not found' }, { status: 404 });
    return NextResponse.json({ success: false, error: 'Failed to create' }, { status: 500 });
  }
}

// PUT /api/hierarchy — Edit a hierarchy node name
export async function PUT(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!canPerform(user.role, 'manage_hierarchy')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id, level, name } = await request.json();
    if (!id || !level || !name) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    let updatedNode;
    switch (level) {
      case 'state': updatedNode = await db.state.update({ where: { id }, data: { name } }); break;
      case 'region': updatedNode = await db.region.update({ where: { id }, data: { name } }); break;
      case 'group': updatedNode = await db.churchGroup.update({ where: { id }, data: { name } }); break;
      case 'district': updatedNode = await db.district.update({ where: { id }, data: { name } }); break;
      case 'location': updatedNode = await db.location.update({ where: { id }, data: { name } }); break;
      default: return NextResponse.json({ success: false, error: 'Invalid level' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: updatedNode });
  } catch (error: any) {
    if (error.code === 'P2025') return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE /api/hierarchy — Delete a hierarchy node (CASCADING)
export async function DELETE(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!canPerform(user.role, 'manage_hierarchy')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id, level } = await request.json();
    if (!id || !level) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    switch (level) {
      case 'state': await db.state.delete({ where: { id } }); break;
      case 'region': await db.region.delete({ where: { id } }); break;
      case 'group': await db.churchGroup.delete({ where: { id } }); break;
      case 'district': await db.district.delete({ where: { id } }); break;
      case 'location': await db.location.delete({ where: { id } }); break;
      default: return NextResponse.json({ success: false, error: 'Invalid level' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    // P2003 means it's referenced by something that isn't set to cascade (shouldn't happen based on your schema, but good to catch)
    if (error.code === 'P2003') return NextResponse.json({ success: false, error: 'Cannot delete: Item is referenced by other records' }, { status: 400 });
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}
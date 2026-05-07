import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRLSContext, buildFullHierarchyRLSFilter } from '@/lib/db-rls';
import { canPerform } from '@/lib/rbac';



// GET: Fetch templates for the dropdown
export async function GET(request: NextRequest) {
  const ctx = getRLSContext(request);
  if (!ctx || !canPerform(ctx.role, 'send_message')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Fetch templates within their jurisdiction
  const templates = await db.messageTemplate.findMany({
    where: buildFullHierarchyRLSFilter(ctx),
    orderBy: { updatedAt: 'desc' },
  });

  // Also fetch distinct service types ACTUALLY used in their attendance history
    const serviceData = await db.attendance.findMany({
    where: buildFullHierarchyRLSFilter(ctx),
    select: { serviceTypeId: true }, // Only ask for the ID
  });
  
    const serviceTypes = [
  ...new Set(
    serviceData
      .map(s => s.serviceTypeId)
      .filter(Boolean)
  ),
];

  return NextResponse.json({ success: true, data: { templates, serviceTypes } });
}

// POST: Save a new template
export async function POST(request: NextRequest) {
  const ctx = getRLSContext(request);
  if (!ctx || !canPerform(ctx.role, 'send_message')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { title, content } = await request.json();
  if (!title || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  await db.messageTemplate.create({
    data: {
      title,
      content,
      profileId: ctx.userId, // Track who created it
      stateId: ctx.scope.stateId,
      regionId: ctx.scope.regionId,
      groupId: ctx.scope.groupId,
      districtId: ctx.scope.districtId,
      locationId: ctx.scope.locationId,
    },
  });

  return NextResponse.json({ success: true });
}
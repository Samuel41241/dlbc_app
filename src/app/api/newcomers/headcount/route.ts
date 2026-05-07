import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { serviceTypeId, adultMale, adultFemale, youthBoys, youthGirls, childrenBoys, childrenGirls } = body;

    if (!serviceTypeId) return NextResponse.json({ success: false, error: 'Service Type ID is required' }, { status: 400 });

    // ✅ ENTERPRISE FIX: Look up Service Type to get the Snapshot Name
    const serviceTypeRecord = await db.serviceType.findUnique({ where: { id: serviceTypeId } });
    if (!serviceTypeRecord) return NextResponse.json({ success: false, error: 'Service Type not found' }, { status: 404 });

    await db.newcomerHeadcount.create({
      data: {
        serviceTypeId,                         // ✅ FIX: FK to ServiceType
        serviceName: serviceTypeRecord.name,    // ✅ FIX: Snapshot name
        adultMale: parseInt(adultMale) || 0,
        adultFemale: parseInt(adultFemale) || 0,
        youthBoys: parseInt(youthBoys) || 0,
        youthGirls: parseInt(youthGirls) || 0,
        childrenBoys: parseInt(childrenBoys) || 0,
        childrenGirls: parseInt(childrenGirls) || 0,
        
        // ✅ ENTERPRISE FIX: ONLY locationId is saved now (flat state/region/group removed)
        locationId: user.locationId || '',
      }
    });

    return NextResponse.json({ success: true, message: 'Headcount saved' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to save' }, { status: 500 });
  }
}
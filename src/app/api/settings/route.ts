import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { ServiceType, SystemSetting } from '@prisma/client'; // ✅ Explicit type imports

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ✅ Strict Read-Access Control
  const allowedReadRoles = ['super_admin', 'district_admin', 
    'location_admin', 'district_pastor','location_pastor'];
  
  if (!allowedReadRoles.includes(user.role)) {
    return NextResponse.json({ error: 'Access Denied' }, { status: 403 });
  }

  try {
    // ✅ Explicitly typed array
    const serviceTypes: ServiceType[] = await db.serviceType.findMany({
      where: { isActive: true },
      orderBy: { dayOfWeek: 'asc' }
    });

    // ✅ Explicitly typed array fixes the implicit 'any' on 's'
    const settings: SystemSetting[] = await db.systemSetting.findMany();
    const settingsMap: Record<string, string> = {};
    settings.forEach((s: SystemSetting) => { 
      settingsMap[s.key] = s.value; 
    });

    return NextResponse.json({ success: true, data: { serviceTypes, settings: settingsMap } });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ✅ PRODUCTION RULE: ONLY SUPER ADMIN CAN WRITE SETTINGS
  if (user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: Only Super Admin can modify settings' }, { status: 403 });
  }

  try {
    const body = await request.json() as { 
      action: 'CREATE_SERVICE' | 'UPDATE_SETTING';
      payload: { name?: string; dayOfWeek?: number; key?: string; value?: string };
    };

    if (body.action === 'CREATE_SERVICE') {
      const { name, dayOfWeek } = body.payload;
      if (!name || dayOfWeek === undefined) {
        return NextResponse.json({ error: 'Name and day are required' }, { status: 400 });
      }

      const service = await db.serviceType.create({
        data: { name, dayOfWeek }
      });

      return NextResponse.json({ success: true, data: service });
    }

    if (body.action === 'UPDATE_SETTING') {
      const { key, value } = body.payload;
      if (!key || value === undefined) {
         return NextResponse.json({ error: 'Key and value are required' }, { status: 400 });
      }

      await db.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Service type already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

// ========================================
// PATCH /api/settings — Update Service Type
// ========================================
export async function PATCH(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json() as { id: string; name?: string; dayOfWeek?: number };
    const { id, name, dayOfWeek } = body;

    if (!id) return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });

    const existing = await db.serviceType.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    // ✅ PROTECTION: Cannot edit the constant Sunday service
    if (existing.name === 'Sunday Worship Service') {
      return NextResponse.json({ error: 'Cannot modify the default Sunday Worship Service' }, { status: 403 });
    }

    const updated = await db.serviceType.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(dayOfWeek !== undefined && { dayOfWeek })
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A service with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 });
  }
}

// ========================================
// DELETE /api/settings — Delete Service Type
// ========================================
export async function DELETE(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });

    const existing = await db.serviceType.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    // ✅ PROTECTION: Cannot delete the constant Sunday service
    if (existing.name === 'Sunday Worship Service') {
      return NextResponse.json({ error: 'Cannot delete the default Sunday Worship Service' }, { status: 403 });
    }

    await db.serviceType.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 });
  }
}
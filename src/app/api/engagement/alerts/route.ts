import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { getRoleCategory } from '@/lib/rbac';
import { AttendanceMember, EngagementAction } from '@prisma/client'; // ✅ Explicit Prisma type imports

interface AbsenteeMember {
  id: string;
  fullName: string;
  phone?: string | null;
  missedSundays: number; 
  lastSeenDate: string;
  latestAbsenceAttendanceId: string;
}

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (user === null) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const roleCategory = getRoleCategory(user.role);
    const isManager = roleCategory === 'admin';
    
    if (isManager || !user.locationId) {
      return NextResponse.json({ absentees: [] });
    }

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 35); 

    // ✅ Explicitly type the Prisma response array
    const absences: (AttendanceMember & { member: { fullName: string; phone: string | null; isActive: boolean }; attendance: { id: string; serviceDate: Date } })[] = 
      await db.attendanceMember.findMany({
      where: {
        status: 'absent',
        attendance: {
          locationId: user.locationId,
          serviceType: 'Sunday Worship Service',
          serviceDate: { gte: pastDate }
        },
        member: { isActive: true }
      },
      include: {
        member: { select: { fullName: true, phone: true, isActive: true } },
        attendance: { select: { id: true, serviceDate: true } }
      },
      orderBy: { attendance: { serviceDate: 'desc' } }
    });

    if (absences.length === 0) return NextResponse.json({ absentees: [] });

    const absenceIds = absences.map(a => a.attendanceId);
    
    // ✅ Explicitly type the actions array
    const actions: EngagementAction[] = await db.engagementAction.findMany({
      where: {
        memberId: { in: absences.map(a => a.memberId) },
        attendanceId: { in: absenceIds }
      }
    });

    const actionMap = new Map<string, string>();
    // ✅ 'a' is no longer implicitly 'any' because actions is typed
    actions.forEach(a => actionMap.set(`${a.memberId}-${a.attendanceId}`, a.actionType));

    const memberAbsenceMap = new Map<string, typeof absences>();
    absences.forEach(a => {
      if (!memberAbsenceMap.has(a.memberId)) memberAbsenceMap.set(a.memberId, []);
      memberAbsenceMap.get(a.memberId)!.push(a);
    });

    const alertList: AbsenteeMember[] = [];

    for (const [memberId, memberAbsences] of memberAbsenceMap.entries()) {
      memberAbsences.sort((a, b) => b.attendance.serviceDate.getTime() - a.attendance.serviceDate.getTime());
      
      let consecutiveMissed = 0;
      let latestAbsenceId = memberAbsences[0].attendance.id;
      let lastSeenDateStr = new Date().toISOString().split('T')[0];

      for (const absence of memberAbsences) {
        const actionKey = `${memberId}-${absence.attendanceId}`;
        const existingAction = actionMap.get(actionKey);

        if (existingAction === 'ADMIN_DISMISSED') break;
        if (existingAction === 'PASTOR_FOLLOWUP') {
          lastSeenDateStr = absence.attendance.serviceDate.toISOString().split('T')[0];
          continue; 
        }

        consecutiveMissed++;
        
        if (consecutiveMissed === 1) {
           const absenceDate = new Date(absence.attendance.serviceDate);
           absenceDate.setDate(absenceDate.getDate() - 7);
           lastSeenDateStr = absenceDate.toISOString().split('T')[0];
        }
      }

      if (consecutiveMissed > 0) {
        const memberData = memberAbsences[0].member;
        
        alertList.push({
          id: memberId,
          fullName: memberData.fullName,
          phone: memberData.phone,
          missedSundays: consecutiveMissed,
          lastSeenDate: lastSeenDateStr,
          latestAbsenceAttendanceId: latestAbsenceId
        });
      }
    }

    let finalList = alertList;
    
    if (roleCategory === 'pastor') {
      finalList = alertList.filter(item => {
        const actionKey = `${item.id}-${item.latestAbsenceAttendanceId}`;
        return actionMap.get(actionKey) !== 'PASTOR_FOLLOWUP';
      });
    } else if (roleCategory === 'admin') {
      finalList = alertList.filter(item => {
        const actionKey = `${item.id}-${item.latestAbsenceAttendanceId}`;
        return actionMap.get(actionKey) !== 'ADMIN_DISMISSED';
      });
    }

    return NextResponse.json({ absentees: finalList });

  } catch (error) {
    console.error('Engagement Alert Error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

// ==========================================
// HANDLE ACTION (Attended To / Dismissed)
// ==========================================
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (user === null) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json() as { 
      memberId: string; 
      attendanceId: string; 
      actionType: 'PASTOR_FOLLOWUP' | 'ADMIN_DISMISSED' 
    };
    
    const { memberId, attendanceId, actionType } = body;

    if (!memberId || !attendanceId || !actionType) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const roleCategory = getRoleCategory(user.role);
    if (actionType === 'PASTOR_FOLLOWUP' && roleCategory !== 'pastor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (actionType === 'ADMIN_DISMISSED' && roleCategory !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.engagementAction.upsert({
      where: {
        memberId_attendanceId: { memberId, attendanceId }
      },
      update: { actionType, actorId: user.userId },
      create: { memberId, attendanceId, actionType, actorId: user.userId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildRLSFilter, getHierarchyFilter, getRLSContext } from '@/lib/db-rls';
// ✅ Removed getUserFromRequest. We strictly use the unified getRLSContext from db-rls.ts now.

function getMonthBoundaries(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    // ✅ 10/10 FIX: Unified context extraction (includes userId for future wallet links if needed)
    const ctx = getRLSContext(request);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rlsFilter = buildRLSFilter(ctx);
    const now = new Date();
    const currentMonth = getMonthBoundaries(now);
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = getMonthBoundaries(prevMonthDate);

    const [
      totalMembersByCategory,
      locationCount,
      currentMonthPeaks, // ✅ RENAMED: This is now the grouped data from Postgres, not raw rows
      previousMonthAttendanceAgg,
      currentMonthHeadcounts,
      currentMonthAttendanceAgg,
    ] = await Promise.all([

      // 1. TOTAL MEMBERS BY CATEGORY
      db.member.groupBy({
        by: ['category'],
        where: rlsFilter,
        _count: { category: true },
      }),

      // 2. LOCATIONS IN SCOPE
      db.location.count({ where: getHierarchyFilter(ctx, 'location') }),

      // 3. ✅ 10/10 FIX: Postgres calculates the peak per location. 0MB RAM used.
      db.attendance.groupBy({
        by: ['locationId'],
        where: {
          ...rlsFilter,
          serviceDate: { gte: currentMonth.start, lte: currentMonth.end },
        },
        _max: { present: true },
        having: {
          present: { _max: { gt: 0 } } // Ignore locations with 0 attendance
        }
      }),

      // 4. PREVIOUS MONTH AGGREGATE (For Trend)
      db.attendance.aggregate({
        where: {
          ...rlsFilter,
          serviceDate: { gte: previousMonth.start, lte: previousMonth.end },
        },
        _sum: { present: true, total: true },
      }),

      // 5. NEWCOMERS LOGIC: Sum of headcounts
      db.newcomerHeadcount.findMany({
        where: {
          ...rlsFilter,
          serviceDate: { gte: currentMonth.start, lte: currentMonth.end },
        },
        select: {
          adultMale: true, adultFemale: true, youthBoys: true, youthGirls: true, childrenBoys: true, childrenGirls: true,
        },
      }),

      // 6. CURRENT MONTH AGGREGATE (For Rate Bar)
      db.attendance.aggregate({
        where: {
          ...rlsFilter,
          serviceDate: { gte: currentMonth.start, lte: currentMonth.end },
        },
        _sum: { present: true, total: true },
      }),
    ]);

    // --- PROCESSING LOGIC ---

    // 1. Process Total By Category
    const totalByCategory = { Adult: 0, Youth: 0, Children: 0 };
    totalMembersByCategory.forEach((c) => {
      if (c.category === 'Adult') totalByCategory.Adult = c._count.category;
      if (c.category === 'Youth') totalByCategory.Youth = c._count.category;
      if (c.category === 'Children') totalByCategory.Children = c._count.category;
    });
    const totalMembers = totalByCategory.Adult + totalByCategory.Youth + totalByCategory.Children;

    // 2. ✅ 10/10 FIX: Process Active Members purely from the grouped DB payload
    let activeMembers = 0;
    const peakLocationConditions: any[] = [];

    currentMonthPeaks.forEach((loc) => {
      if (loc.locationId && loc._max.present) {
        activeMembers += loc._max.present;
        
        // Build an OR condition to find the exact attendance records that hit this peak
        peakLocationConditions.push({
          locationId: loc.locationId,
          present: loc._max.present,
          serviceDate: { gte: currentMonth.start, lte: currentMonth.end }
        });
      }
    });

    // 3. Process ACTIVE MEMBERS BY CATEGORY (Zero RAM exhaustion)
    let activeByCategory = { Adult: 0, Youth: 0, Children: 0 };
    
    if (peakLocationConditions.length > 0) {
      // Only fetch the exact attendance records that matched the peak numbers
      const peakAttendanceRecords = await db.attendance.findMany({
        where: {
          ...rlsFilter,
          OR: peakLocationConditions
        },
        select: { id: true },
      });

      const peakIds = peakAttendanceRecords.map(r => r.id);

      if (peakIds.length > 0) {
        // Only fetch the specific humans who attended those peak services
        const peakAttendees = await db.attendanceMember.findMany({
          where: { attendanceId: { in: peakIds } },
          select: { member: { select: { category: true } } }
        });

        peakAttendees.forEach((a) => {
          const cat = a.member?.category;
          if (cat === 'Adult') activeByCategory.Adult++;
          else if (cat === 'Youth') activeByCategory.Youth++;
          else if (cat === 'Children') activeByCategory.Children++;
        });
      }
    }

    // 4. Process Attendance Rate
    const curPresent = currentMonthAttendanceAgg._sum.present || 0;
    const curTotal = currentMonthAttendanceAgg._sum.total || 0;
    const currentRate = curTotal > 0 ? (curPresent / curTotal) * 100 : 0;

    const prevPresent = previousMonthAttendanceAgg._sum.present || 0;
    const prevTotal = previousMonthAttendanceAgg._sum.total || 0;
    const previousRate = prevTotal > 0 ? (prevPresent / prevTotal) * 100 : 0;
    const trendDelta = parseFloat((currentRate - previousRate).toFixed(1));

    // 5. Process Newcomers
    const totalNewcomers = currentMonthHeadcounts.reduce((sum, h) => {
      return sum + (h.adultMale + h.adultFemale + h.youthBoys + h.youthGirls + h.childrenBoys + h.childrenGirls);
    }, 0);

    return NextResponse.json({
      success: true,
      data: {
        members: {
          total: totalMembers,
          active: activeMembers,
          totalByCategory,
          activeByCategory,
        },
        newcomers: { thisMonth: totalNewcomers },
        attendance: {
          currentMonthRate: parseFloat(currentRate.toFixed(1)),
          trendVsLastMonth: trendDelta,
        },
        locations: locationCount,
      },
    });
  } catch (error) {
    console.error('Stats GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
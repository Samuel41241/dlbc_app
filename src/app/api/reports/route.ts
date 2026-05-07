import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildRLSFilter, getRLSContext } from '@/lib/db-rls'; 

// Helper to get ISO week number
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

interface ReportPayload {
  start: string;
  end: string;
}

export async function POST(request: NextRequest) {
  // ✅ PRODUCTION FIX: Single source of truth for auth & context.
  // Safely extracts your custom JWT payload and builds the context (including userId).
  const ctx = getRLSContext(request);
  
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as ReportPayload;
    const { start, end } = body;
    
    if (!start || !end) {
      return NextResponse.json({ success: false, error: 'Missing start or end dates' }, { status: 400 });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999); 

    // ✅ PRODUCTION FIX: RLS safely traverses Location -> District -> Group -> Region -> State
    const rlsFilter = buildRLSFilter(ctx);

    const whereClause = {
      serviceDate: { gte: startDate, lte: endDate },
      ...rlsFilter 
    };

    // ==========================================
    // 1. FETCH ATTENDANCE & FIND "HIGHEST DAY"
    // ==========================================
    const attendanceRecords = await db.attendance.findMany({
      where: whereClause, 
      include: {
        members: {
          include: {
            member: true 
          }
        }
      },
      orderBy: { serviceDate: 'asc' }
    });

    const serviceGroups: Record<string, typeof attendanceRecords> = {};
    
    attendanceRecords.forEach(record => {
      // ✅ FIX: Use snapshot name instead of deleted flat string column
      const svc = record.serviceName; 
      if (!serviceGroups[svc]) serviceGroups[svc] = [];
      serviceGroups[svc].push(record);
    });

    const attendanceSummary: {
      service: string;
      adultMale: number; adultFemale: number;
      youthBoys: number; youthGirls: number;
      childrenBoys: number; childrenGirls: number;
      peakDate: string; peakTotal: number;
    }[] = [];

    for (const [serviceType, records] of Object.entries(serviceGroups)) {
      let peakDate: string | null = null;
      let peakCount = -1;
      const dateCounts: Record<string, number> = {};

      records.forEach(record => {
        const dateKey = record.serviceDate.toISOString().split('T')[0];
        if (!dateCounts[dateKey]) dateCounts[dateKey] = 0;
        
        record.members.forEach(am => {
          if (am.status === 'present') {
            dateCounts[dateKey]++;
          }
        });
      });

      for (const [date, count] of Object.entries(dateCounts)) {
        if (count > peakCount) {
          peakCount = count;
          peakDate = date;
        }
      }

      if (!peakDate) continue;

      const splits: Record<string, number> = {
        'Adult Male': 0, 'Adult Female': 0,
        'Youth Boys': 0, 'Youth Girls': 0,
        'Children Boys': 0, 'Children Girls': 0,
      };

      records.forEach(record => {
        if (record.serviceDate.toISOString().split('T')[0] === peakDate) {
          record.members.forEach(am => {
            const member = am.member; 
            if (am.status === 'present' && member) {
              const demoKey = `${member.category} ${member.gender}`;
              if (splits[demoKey] !== undefined) {
                splits[demoKey]++;
              }
            }
          });
        }
      });

      attendanceSummary.push({
        service: serviceType,
        adultMale: splits['Adult Male'], adultFemale: splits['Adult Female'],
        youthBoys: splits['Youth Boys'], youthGirls: splits['Youth Girls'],
        childrenBoys: splits['Children Boys'], childrenGirls: splits['Children Girls'],
        peakDate: peakDate, peakTotal: peakCount
      });
    }

    // ==========================================
    // 2. FETCH NEWCOMER HEADCOUNTS (SUM RANGE)
    // ==========================================
    const newcomerRecords = await db.newcomerHeadcount.findMany({
      where: whereClause, 
    });

    const newcomerGroups: Record<string, typeof newcomerRecords> = {};
    newcomerRecords.forEach(n => {
      // ✅ FIX: Use snapshot name instead of deleted flat string column
      const svcName = n.serviceName;
      if (!newcomerGroups[svcName]) newcomerGroups[svcName] = [];
      newcomerGroups[svcName].push(n);
    });

    const newcomerSummary: {
      service: string;
      adultMale: number; adultFemale: number;
      youthBoys: number; youthGirls: number;
      childrenBoys: number; childrenGirls: number;
    }[] = [];

    for (const [serviceType, records] of Object.entries(newcomerGroups)) {
      const sums = records.reduce((acc, curr) => {
        acc.adultMale += curr.adultMale;
        acc.adultFemale += curr.adultFemale;
        acc.youthBoys += curr.youthBoys;
        acc.youthGirls += curr.youthGirls;
        acc.childrenBoys += curr.childrenBoys;
        acc.childrenGirls += curr.childrenGirls;
        return acc;
      }, { adultMale: 0, adultFemale: 0, youthBoys: 0, youthGirls: 0, childrenBoys: 0, childrenGirls: 0 });

      const total = Object.values(sums).reduce((a, b) => a + b, 0);
      if (total > 0) {
        newcomerSummary.push({ service: serviceType, ...sums });
      }
    }

    // ==========================================
    // 3. CALCULATE CONTINUOUS TREND DATA (Adults Only)
    // ==========================================
    const trendDataRaw: { weekLabel: string; serviceType: string; count: number }[] = [];

    attendanceRecords.forEach(record => {
      const date = new Date(record.serviceDate);
      const weekNum = getISOWeek(date);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      const weekLabel = `W${weekNum}, ${monthName}`;

      let adultPresentCount = 0;
      record.members.forEach(am => {
        const member = am.member;
        if (am.status === 'present' && member && member.category === 'Adult') {
          adultPresentCount++;
        }
      });

      if (adultPresentCount > 0) {
        // ✅ FIX: Use snapshot name for trend data
        trendDataRaw.push({ weekLabel, serviceType: record.serviceName, count: adultPresentCount });
      }
    });

    const trendDataProcessed: Record<string, Record<string, number>> = {};
    trendDataRaw.forEach(item => {
      if (!trendDataProcessed[item.weekLabel]) trendDataProcessed[item.weekLabel] = {};
      if (!trendDataProcessed[item.weekLabel][item.serviceType]) trendDataProcessed[item.weekLabel][item.serviceType] = 0;
      trendDataProcessed[item.weekLabel][item.serviceType] += item.count;
    });

    const trendData = Object.entries(trendDataProcessed).map(([week, services]) => {
      return { week, ...services };
    }).sort((a, b) => a.week.localeCompare(b.week));

    return NextResponse.json({
      success: true,
      data: {
        attendance: attendanceSummary,
        newcomers: newcomerSummary,
        trendData 
      }
    });

  } catch (error) {
    console.error('Reports generation error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
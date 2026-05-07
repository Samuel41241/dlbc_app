'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { canPerform } from '@/lib/rbac';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiFetch } from '@/lib/api';
import {
  Users, UserCheck, UserPlus, BarChart3, Clock, MapPin,
  Database, AlertTriangle, Inbox, UserRoundPlus, CalendarCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CHURCH_HERO_URL = 'https://dailypost.ng/wp-content/uploads/2025/07/Deeper-life-1200x703.jpeg';

interface CategoryBreakdown {
  Adult: number;
  Youth: number;
  Children: number;
}

interface DashboardStats {
  members: {
    total: number;
    active: number;
    totalByCategory: CategoryBreakdown;
    activeByCategory: CategoryBreakdown;
  };
  newcomers: { thisMonth: number };
  attendance: { currentMonthRate: number; trendVsLastMonth: number };
  locations: number;
}

const DEFAULT_STATS: DashboardStats = {
  members: { total: 0, active: 0, totalByCategory: { Adult: 0, Youth: 0, Children: 0 }, activeByCategory: { Adult: 0, Youth: 0, Children: 0 } },
  newcomers: { thisMonth: 0 },
  attendance: { currentMonthRate: 0, trendVsLastMonth: 0 },
  locations: 0,
};

// Helper to format category breakdowns into compact strings
const formatCategories = (cats: CategoryBreakdown) => {
  const parts = [];
  if (cats.Adult > 0) parts.push(`${cats.Adult}A`);
  if (cats.Youth > 0) parts.push(`${cats.Youth}Y`);
  if (cats.Children > 0) parts.push(`${cats.Children}C`);
  return parts.join(' · ') || 'No data';
};

export default function AdminDashboard() {
  const user = useAppStore((s) => s.user);
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManageHierarchy = user ? canPerform(user.role, 'manage_hierarchy') : false;

  useEffect(() => {
    if (!user) return;
       apiFetch<DashboardStats>('/api/stats')
      .then((data) => {
        setStats(data);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const attendanceRate = stats.attendance.currentMonthRate;
  const trend = stats.attendance.trendVsLastMonth;

  const summaryCards = [
    {
      title: 'Total Members',
      value: stats.members.total.toLocaleString(),
      change: `${stats.locations} location${stats.locations !== 1 ? 's' : ''}`,
      subtext: formatCategories(stats.members.totalByCategory), // ✅ Demographics
      icon: Users, color: 'text-church-green', bg: 'bg-church-green/10',
    },
    {
      title: 'Active Members',
      value: stats.members.active.toLocaleString(),
      change: 'Peak this month',
      subtext: formatCategories(stats.members.activeByCategory), // ✅ Demographics
      icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-100',
    },
    {
      title: 'Newcomers',
      value: stats.newcomers.thisMonth.toString(),
      change: 'This month',
      subtext: 'Headcount total',
      icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-100',
    },
    {
      title: 'Attendance Rate',
      value: `${attendanceRate}%`,
      change: trend === 0 ? 'No prior data' : `${trend > 0 ? '+' : ''}${trend}% vs last month`,
      subtext: `Based on ${stats.locations} locations`,
      icon: BarChart3, color: 'text-church-gold-dark', bg: 'bg-amber-100',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-church-green/20 border-t-church-green rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <AlertTriangle className="w-10 h-10 text-red-500" />
        <p className="text-sm font-medium text-foreground">Unable to load monitoring data</p>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  const isEmpty = stats.members.total === 0;

  const getScopeGreeting = () => {
    if (!user) return 'National Headquarters';
    const lvl = user.scope.level;
    const names = user.scopeNames;
    switch (lvl) {
      case 'global': return 'National Headquarters';
      case 'state': return names.stateName || 'Your State';
      case 'region': return names.regionName || 'Your Region';
      case 'group': return names.groupName || 'Your Group';
      case 'district': return names.districtName || 'Your District';
      case 'location': return names.locationName || 'Your Location';
      default: return 'Your Scope';
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-16">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl h-36 md:h-44">
        <img src={CHURCH_HERO_URL} alt="Deeper Life Bible Church" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-church-green/90 via-church-green/70 to-church-green/30" />
        <div className="relative z-10 flex flex-col justify-end h-full p-4 md:p-6">
          <p className="text-church-gold text-xs font-bold uppercase tracking-wider">{user?.roleLabel || 'Dashboard'}</p>
          <h2 className="text-white text-xl md:text-2xl font-bold">Welcome back, {getScopeGreeting()}</h2>
          <p className="text-green-100 text-xs mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3.5">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-2', card.bg)}>
                  <Icon className={cn('w-4.5 h-4.5', card.color)} />
                </div>
                <p className="text-xl font-bold text-foreground">{card.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{card.title}</p>
                <p className="text-[10px] text-church-green font-medium mt-1">{card.change}</p>
                {/* ✅ Subtle Demographics Sub-text */}
                {card.subtext && (
                  <p className="text-[9px] text-muted-foreground/70 mt-1 font-mono tracking-wide">{card.subtext}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Attendance Progress Bar (Strictly uses total rate, no demographics) */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Attendance Rate</CardTitle>
            <Badge variant="secondary" className="bg-church-green/10 text-church-green text-xs font-bold">
              {attendanceRate}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Progress value={attendanceRate} className="h-3 bg-church-green/10 [&>div]:bg-church-green rounded-full" />
          <div className="flex justify-between mt-2">
            <span className="text-xs text-muted-foreground">Current Month Average</span>
            <span className="text-xs text-muted-foreground">
              {trend === 0 ? 'Baseline' : `${trend > 0 ? '↑' : '↓'} ${Math.abs(trend)}%`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {isEmpty && (
        <>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-church-green/10 flex items-center justify-center">
                <Database className="w-8 h-8 text-church-green/50" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">No Data Yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  {canManageHierarchy ? "Start by adding church hierarchy, members, and marking attendance." : "Data will appear here once members are registered and attendance is marked."}
                </p>
              </div>
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {canManageHierarchy ? 'Create locations in Church Hierarchy' : 'View locations in Church Hierarchy'}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <UserRoundPlus className="w-3.5 h-3.5" /> Register members
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CalendarCheck className="w-3.5 h-3.5" /> Mark attendance via Scanner
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Inbox className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No engagement alerts</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
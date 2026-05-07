'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useSystemData } from '@/hooks/useSystemData'; 
import { type AttendanceRecord, fetchAttendance } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CalendarDays,
  MapPin,
  Search,
  Filter,
  TrendingUp,
  BarChart3,
  Users,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ========================================
// HELPERS
// ========================================

function getAttendanceRate(present: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
}

function getRateColor(rate: number): { bar: string; badge: string; bg: string } {
  if (rate >= 85) return { bar: '[&>div]:bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', bg: 'bg-emerald-500' };
  if (rate >= 65) return { bar: '[&>div]:bg-amber-500', badge: 'bg-amber-100 text-amber-700', bg: 'bg-amber-500' };
  return { bar: '[&>div]:bg-red-500', badge: 'bg-red-100 text-red-700', bg: 'bg-red-500' };
}

// ========================================
// COMPONENT
// ========================================

export default function AttendanceHistoryPage() {
  const user = useAppStore((s) => s.user);
  const isSuperAdmin = user?.role === 'super_admin';
  
  const { services } = useSystemData();

  // Filter state
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendanceStats, setAttendanceStats] = useState({ totalPresent: 0, totalCapacity: 0, serviceCount: 0 });

  // Fetch attendance data
    useEffect(() => {
    if (!user) return;
   
    fetchAttendance()
      .then((data) => {
        if (data && Array.isArray(data.records)) {
          setRecords(data.records);
          setAttendanceStats(data.stats || { totalPresent: 0, totalCapacity: 0, serviceCount: 0 });
        }
      })
      .catch((error) => {
        console.error("Failed to fetch attendance:", error);
      })
      .finally(() => setLoading(false));
  }, [user]);

  // Further filtered by UI controls
  const filteredAttendance = useMemo(() => {
    return records.filter((entry) => {
      // ✅ PRODUCTION FIX: Use serviceName instead of deleted serviceType
      const matchesService = serviceFilter === 'all' || entry.serviceName === serviceFilter;
      const locationName = entry.location?.name || '';
      const matchesSearch =
        searchQuery === '' ||
        locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) || // ✅ FIX
        entry.serviceDate.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesService && matchesSearch;
    });
  }, [records, serviceFilter, searchQuery]);

  // Summary stats
  const totalRecords = records.length;
  const highestRate = useMemo(() => {
    if (records.length === 0) return 0;
    return Math.max(...records.map((a) => getAttendanceRate(a.present, a.total)));
  }, [records]);
  const averageRate = useMemo(() => {
    if (records.length === 0) return 0;
    const sum = records.reduce((acc, a) => acc + getAttendanceRate(a.present, a.total), 0);
    return Math.round(sum / records.length);
  }, [records]);
  const mostRecentDate = records.length > 0
    ? new Date(records.sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())[0].serviceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'N/A';

  if (loading) {
    return (
      <div className="flex flex-col gap-5 pb-24 md:pb-16">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-foreground">Attendance History</h2>
          <p className="text-sm text-muted-foreground">View attendance records across services</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-church-green animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-foreground">Attendance History</h2>
        <p className="text-sm text-muted-foreground">
          View attendance records across services
        </p>
      </div>

      {/* Scope Notice Card */}
      {!isSuperAdmin && (
        <Card className="border-church-green/20 bg-church-green/5">
          <CardContent className="p-3 flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-church-green flex-shrink-0" />
            <p className="text-xs text-foreground/80">
              <span className="font-semibold">Scoped View</span> — Showing attendance records within your hierarchy only
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-church-green/10 flex items-center justify-center mx-auto mb-1.5">
              <BarChart3 className="w-4 h-4 text-church-green" />
            </div>
            <p className="text-lg font-bold text-foreground">{totalRecords}</p>
            <p className="text-[10px] text-muted-foreground">Records in Scope</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mx-auto mb-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-foreground">{highestRate}%</p>
            <p className="text-[10px] text-muted-foreground">Highest Rate</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-1.5">
              <Users className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-lg font-bold text-foreground">{averageRate}%</p>
            <p className="text-[10px] text-muted-foreground">Average Rate</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-sm font-bold text-foreground leading-tight mt-0.5">{mostRecentDate}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Most Recent</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by location name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-9 pr-3 rounded-lg bg-secondary/50 border-0 text-sm focus-visible:ring-2 focus-visible:ring-church-green/30"
              />
            </div>
            
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="h-11 w-full sm:w-[180px] rounded-lg bg-secondary/50 border-0 text-sm focus:ring-2 focus:ring-church-green/30">
                <Filter className="w-4 h-4 text-muted-foreground mr-1.5" />
                <SelectValue placeholder="Service Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {services.map((svc) => (
                  <SelectItem key={svc.id} value={svc.name}>
                    {svc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <p className="text-xs text-muted-foreground px-1">
        Showing {filteredAttendance.length} of {records.length} records
      </p>

      {/* Attendance Records List */}
      <div className="flex flex-col gap-2.5">
        {filteredAttendance.map((entry, index) => {
          const rate = getAttendanceRate(entry.present, entry.total);
          const colors = getRateColor(rate);
          const locationName = entry.location?.name || 'Unknown';

          return (
            <Card key={`${entry.serviceDate}-${entry.serviceName}-${index}`} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-church-green/10 flex items-center justify-center flex-shrink-0">
                      <CalendarDays className="w-4 h-4 text-church-green" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{new Date(entry.serviceDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      {/* ✅ PRODUCTION FIX: Display serviceName */}
                      <p className="text-xs text-muted-foreground truncate">{entry.serviceName}</p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn('text-xs font-bold px-2 py-0.5 border-0 flex-shrink-0', colors.badge)}
                  >
                    {rate}%
                  </Badge>
                </div>

                {/* Progress bar */}
                <Progress
                  value={rate}
                  className={cn('h-2.5 bg-secondary [&>div]:rounded-full', colors.bar)}
                />

                {/* Attendance fraction */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground font-medium">
                    {entry.present} / {entry.total} present
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[60%]">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {locationName}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredAttendance.length === 0 && !loading && (
        <div className="text-center py-10">
          <FileSpreadsheet className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {records.length === 0
              ? 'No attendance records available yet.'
              : 'No records match your current filters.'}
          </p>
          {(serviceFilter !== 'all' || searchQuery !== '') && (
            <button
              className="mt-3 text-church-green text-xs hover:bg-church-green/5 px-4 py-2 rounded-lg transition-colors"
              onClick={() => { setServiceFilter('all'); setSearchQuery(''); }}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
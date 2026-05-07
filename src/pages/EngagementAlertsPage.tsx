'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Phone,
  UserCheck,
  UserX,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getRoleCategory } from '@/lib/rbac';

interface AbsenteeMember {
  id: string;
  fullName: string;
  phone?: string | null;
  missedSundays: number; 
  lastSeenDate: string;
  // ✅ PRODUCTION FIX: Corrected typo from 'senceAttendanceId'
  latestAbsenceAttendanceId: string; 
}

export default function EngagementAlertsPage() {
  const user = useAppStore((s) => s.user);
  const isManager = user ? getRoleCategory(user.role) === 'admin' : false;
  const isShepherd = !isManager && !!user?.scope?.locationId;

  const [absentees, setAbsentees] = useState<AbsenteeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'follow-up' | 'pastoral'>('all');

  useEffect(() => {
    if (!user) return;
    
    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ absentees: AbsenteeMember[] }>('/api/engagement/alerts');
        setAbsentees(res.absentees);
      } catch (error) {
        toast.error('Failed to load engagement alerts');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [user]);

  const filteredData = useMemo(() => {
    if (activeFilter === 'follow-up') return absentees.filter(m => m.missedSundays === 1);
    if (activeFilter === 'pastoral') return absentees.filter(m => m.missedSundays >= 2);
    return absentees;
  }, [absentees, activeFilter]);

  const handleMarkAttended = async (memberId: string, attendanceId: string) => {
    try {
      await apiFetch('/api/engagement/alerts', {
        method: 'POST',
        body: JSON.stringify({ memberId, attendanceId, actionType: 'PASTOR_FOLLOWUP' })
      });
      toast.success('Marked as attended to. Removed from your list.');
      setAbsentees(prev => prev.filter(m => m.id !== memberId));
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleFlagAdmin = async (memberId: string, attendanceId: string) => {
    try {
      await apiFetch('/api/engagement/alerts', {
        method: 'POST',
        body: JSON.stringify({ memberId, attendanceId, actionType: 'ADMIN_DISMISSED' })
      });
      toast.success('Alert dismissed completely from system.');
      setAbsentees(prev => prev.filter(m => m.id !== memberId));
    } catch (error) {
      toast.error('Failed to dismiss alert');
    }
  };

  // --- MANAGER VIEW (Summary Only) ---
    // --- MANAGER VIEW (Strict RBAC Boundary) ---
  if (isManager) {
    return (
      <div className="flex flex-col gap-5 pb-24 md:pb-16">
        <div>
          <h2 className="text-xl font-bold text-foreground">Engagement Alerts</h2>
          <p className="text-sm text-muted-foreground">Member follow-up monitoring.</p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
            <ShieldAlert className="w-12 h-12 text-muted-foreground/30" />
            <div>
              <h3 className="text-sm font-bold text-foreground">Manager Access Only</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Engagement alerts are restricted to District and Location Pastors only. 
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- SHEPHERD VIEW (Actionable List) ---
  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-16">
      <div>
        <h2 className="text-xl font-bold text-foreground">Engagement Alerts</h2>
        <p className="text-sm text-muted-foreground">Follow up with members who missed Sunday services.</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-secondary/50 rounded-xl p-1 gap-1">
        <button 
          onClick={() => setActiveFilter('all')} 
          className={cn("flex-1 py-2 text-xs font-medium rounded-lg transition-colors", activeFilter === 'all' ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
        >
          All Absent
        </button>
        <button 
          onClick={() => setActiveFilter('follow-up')} 
          className={cn("flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1", activeFilter === 'follow-up' ? "bg-yellow-100 text-yellow-700 shadow-sm" : "text-muted-foreground")}
        >
          <UserX className="w-3 h-3" /> Missed 1 Sunday
        </button>
        <button 
          onClick={() => setActiveFilter('pastoral')} 
          className={cn("flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1", activeFilter === 'pastoral' ? "bg-red-100 text-red-700 shadow-sm" : "text-muted-foreground")}
        >
          <AlertTriangle className="w-3 h-3" /> Missed 2+ Sundays
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-church-green" /></div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No engagement alerts! Everyone is attending.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredData.map((member) => (
            <Card key={member.id} className="border-0 shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold truncate">{member.fullName}</h3>
                      <Badge className={cn(
                        "text-[10px] font-bold px-1.5 py-0 border-0",
                        member.missedSundays === 1 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                      )}>
                        {member.missedSundays === 1 ? 'Follow-Up' : 'Pastoral Care'}
                      </Badge>
                    </div>
                    
                    {member.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Phone className="w-3 h-3" />
                        <span>{member.phone}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Last seen: {new Date(member.lastSeenDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <Button 
                    // ✅ PRODUCTION FIX: Passing the correct attendance ID to the handler
                    onClick={() => handleMarkAttended(member.id, member.latestAbsenceAttendanceId)}
                    className="flex-1 h-9 rounded-lg bg-church-green hover:bg-church-green-light text-white text-xs gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Attended To
                  </Button>
                  <Button 
                    // ✅ PRODUCTION FIX: Passing the correct attendance ID to the handler
                    onClick={() => handleFlagAdmin(member.id, member.latestAbsenceAttendanceId)}
                    variant="outline"
                    className="flex-1 h-9 rounded-lg border-orange-200 text-orange-600 hover:bg-orange-50 text-xs gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Flag for Admin
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
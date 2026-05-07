'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  CalendarDays,
  UserCheck,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSystemData } from '@/hooks/useSystemData';

interface Member {
  id: string;
  fullName: string;
  cardNumber: string;
  category: string;
}

export default function AttendanceScannerPage() {
  const user = useAppStore((s) => s.user);
  const { services } = useSystemData();
  
  // ✅ ENTERPRISE FIX: Store the Service Type ID, not the string name
  const selectedLocation = user?.scope?.locationId || '';
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [isSetupReady, setIsSetupReady] = useState(false);

  // Attendance State
  const [allLocationMembers, setAllLocationMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Form only unlocks if they have a building AND pick a service
    setIsSetupReady(!!selectedServiceId && !!selectedLocation);
  }, [selectedServiceId, selectedLocation]);

  useEffect(() => {
    if (!selectedLocation || !selectedServiceId) return;

    const fetchMembers = async () => {
      try {
        const data = await apiFetch<{ members: Member[] }>(`/api/members?locationId=${selectedLocation}`);
        setAllLocationMembers(data.members || []);
      } catch (error) {
        toast.error('Failed to load members for this location');
      }
    };
    fetchMembers();
  }, [selectedLocation, selectedServiceId]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return allLocationMembers.filter(
      (m) =>
        m.fullName.toLowerCase().includes(query) ||
        m.cardNumber.toLowerCase().includes(query)
    );
  }, [searchQuery, allLocationMembers]);

  const markPresent = (member: Member) => {
    setPresentIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(member.id)) return prev; 
      newSet.add(member.id);
      toast.success(`${member.fullName} marked present`, { duration: 1500 });
      return newSet;
    });
    setSearchQuery(''); 
  };

  const undoPresent = (memberId: string) => {
    setPresentIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(memberId);
      return newSet;
    });
  };

  const submitAttendance = async () => {
    if (presentIds.size === 0) {
      toast.error('No members marked present');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch('/api/attendance', {
        method: 'POST',
        body: JSON.stringify({
          // ✅ ENTERPRISE FIX: Send ONLY what the 3NF backend requires
          serviceTypeId: selectedServiceId, // FK ID, not string name
          serviceDate: new Date().toISOString(),
          locationId: selectedLocation,     // ONLY locationId (no flat state/region/group)
          presentMemberIds: Array.from(presentIds),
          // ❌ REMOVED: serviceType, ...getHierarchyPayload(), present, total
          // (The backend calculates 'present' and 'total' securely on the server side now)
        }),
      });

      setShowSuccess(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCameraScan = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        toast.info('Image captured. Real-time QR processing requires @yudiel/react-qr-scanner.');
      }
    };
    input.click();
  };

  // ✅ ENTERPRISE FIX: Look up the service name dynamically for UI display
  const selectedServiceName = services.find((s) => s.id === selectedServiceId)?.name || 'Service';

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="w-20 h-20 rounded-full bg-church-green/10 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-church-green" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Attendance Submitted!</h2>
        <p className="text-muted-foreground max-w-sm">
          {presentIds.size} out of {allLocationMembers.length} members marked present for {selectedServiceName}.
        </p>
        <Button 
          onClick={() => { setShowSuccess(false); setPresentIds(new Set()); }} 
          className="mt-4 bg-church-green hover:bg-church-green-light"
        >
          Take Another Attendance
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-16">
      <div>
        <h2 className="text-xl font-bold text-foreground">Mark Attendance</h2>
        <p className="text-sm text-muted-foreground">Search by name or card number to mark members present.</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Service Type Dropdown */}
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Service Type</label>
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-0">
                  <SelectValue placeholder="Select Service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((svc) => {
                    const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][svc.dayOfWeek];
                    return (
                      // ✅ ENTERPRISE FIX: Value is now the Database ID
                      <SelectItem key={svc.id} value={svc.id}>
                        {svc.name} ({dayLabel})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Locked Location Display */}
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">My Location</label>
              <div className="h-11 px-3 flex items-center rounded-xl bg-church-green/5 border border-church-green/20 text-sm font-medium text-foreground">
                <MapPin className="w-4 h-4 text-church-green mr-2" />
                {user?.scopeNames?.locationName || 'Assigned Location'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form unlocks only when setup is ready */}
      {isSetupReady && (
        <>
          <div className="flex items-center justify-between bg-church-green/5 border border-church-green/20 rounded-xl p-3 px-4">
            <div className="flex items-center gap-2 text-sm">
              <UserCheck className="w-4 h-4 text-church-green" />
              <span className="font-bold text-church-green">{presentIds.size}</span>
              <span className="text-muted-foreground">Present</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Out of {allLocationMembers.length} total members
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Type name or card number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-14 pl-11 pr-4 rounded-xl bg-white border-2 border-gray-200 text-base focus-visible:ring-0 focus-visible:border-church-green shadow-sm"
                autoFocus
              />
            </div>
            <Button 
              onClick={handleCameraScan}
              variant="outline"
              className="h-14 w-14 rounded-xl flex items-center justify-center border-2 border-gray-200 hover:border-church-green hover:text-church-green"
            >
              <Camera className="w-6 h-6" />
            </Button>
          </div>

          {searchQuery.trim() && (
            <Card className="border-0 shadow-lg max-h-60 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="p-4 text-sm text-center text-muted-foreground">No members found</p>
              ) : (
                searchResults.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => markPresent(member)}
                    className="w-full flex items-center justify-between p-3 hover:bg-secondary/50 transition-colors text-left border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{member.fullName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{member.cardNumber}</p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-church-green" />
                  </button>
                ))
              )}
            </Card>
          )}

          {presentIds.size > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground px-1">Marked Present ({presentIds.size})</h3>
              <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                {Array.from(presentIds).map((id) => {
                  const member = allLocationMembers.find((m) => m.id === id);
                  if (!member) return null;
                  return (
                    <div key={id} className="flex items-center justify-between bg-church-green/5 border border-church-green/20 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-church-green flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{member.fullName}</span>
                      </div>
                      <button onClick={() => undoPresent(id)} className="text-red-400 hover:text-red-600 flex-shrink-0 p-1">
                        <Undo2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button
            onClick={submitAttendance}
            disabled={isSubmitting || presentIds.size === 0}
            className="h-14 rounded-xl bg-church-green hover:bg-church-green-light text-white font-bold text-base shadow-lg w-full gap-2"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarDays className="w-5 h-5" />}
            {isSubmitting ? 'Submitting...' : 'Finalize & Submit Attendance'}
          </Button>
        </>
      )}
    </div>
  );
}
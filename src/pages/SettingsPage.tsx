'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Settings,
  Plus,
  Church,
  ShieldAlert,
  Lock,
  Loader2,
  Eye,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ========================================
// Strict TypeScript Interfaces
// ========================================
interface ServiceType {
  id: string;
  name: string;
  dayOfWeek: number;
  isActive: boolean;
}

interface SettingsApiResponse {
  success: boolean;
  data: {
    serviceTypes: ServiceType[];
    settings: Record<string, string>;
  };
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function SettingsPage() {
  const user = useAppStore((s) => s.user);
  const userRole = user?.role || '';

  const isSuperAdmin = userRole === 'super_admin';
  const isReadOnly = userRole === 'district_admin' || userRole === 'location_admin';
  const hasAccess = isSuperAdmin || isReadOnly;

  // State
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dropdown State
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');

  // Edit State
  const [editName, setEditName] = useState('');
  const [editDay, setEditDay] = useState<string>('');

  // New Service State
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDay, setNewServiceDay] = useState<string>('');

  // Delete Dialog State
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Thresholds State
  const [followUpThreshold, setFollowUpThreshold] = useState('1');
  const [pastoralThreshold, setPastoralThreshold] = useState('2');

  // Derived States
  const selectedService = serviceTypes.find((s) => s.id === selectedServiceId);
  const isProtectedService = selectedService?.name === 'Sunday Worship Service';

  // ========================================
  // Data Fetching
  // ========================================
  const fetchSettings = async () => {
    try {
      const res = await apiFetch<SettingsApiResponse>('/api/settings');
      if (res.success && res.data) {
        setServiceTypes(res.data.serviceTypes);
        setSettings(res.data.settings);
        setFollowUpThreshold(res.data.settings.ENGAGEMENT_FOLLOW_UP_THRESHOLD || '1');
        setPastoralThreshold(res.data.settings.ENGAGEMENT_PASTORAL_THRESHOLD || '2');
      }
    } catch (error) {
      toast.error('Failed to load system settings');
    }
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchSettings().finally(() => setLoading(false));
  }, [user]);

  // ========================================
  // Handlers
  // ========================================
  const handleSelectService = (id: string) => {
    setSelectedServiceId(id);
    const found = serviceTypes.find((s) => s.id === id);
    if (found) {
      setEditName(found.name);
      setEditDay(String(found.dayOfWeek));
    }
  };

  const handleAddService = async () => {
    if (!newServiceName.trim() || newServiceDay === '') return;
    setSaving(true);
    try {
      const res = await apiFetch<{ success: boolean; error?: string }>('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ action: 'CREATE_SERVICE', payload: { name: newServiceName.trim(), dayOfWeek: parseInt(newServiceDay) } }),
      });
      if (res.success) {
        toast.success(`"${newServiceName}" added successfully`);
        setNewServiceName(''); setNewServiceDay('');
        await fetchSettings();
      } else {
        toast.error(res.error || 'Failed to add service');
      }
    } catch { toast.error('Connection error'); }
    setSaving(false);
  };

  const handleUpdateService = async () => {
    if (!selectedServiceId || !editName || !editDay) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ success: boolean; error?: string }>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({ id: selectedServiceId, name: editName, dayOfWeek: parseInt(editDay) }),
      });
      if (res.success) {
        toast.success('Service updated successfully');
        await fetchSettings();
      } else {
        toast.error(res.error || 'Failed to update');
      }
    } catch { toast.error('Connection error'); }
    setSaving(false);
  };

  const handleDeleteService = async () => {
    if (!selectedServiceId) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ success: boolean; error?: string }>(`/api/settings?id=${selectedServiceId}`, { method: 'DELETE' });
      if (res.success) {
        toast.success('Service deleted permanently');
        setSelectedServiceId('');
        setEditName(''); setEditDay('');
        await fetchSettings();
      } else {
        toast.error(res.error || 'Failed to delete');
      }
    } catch { toast.error('Connection error'); }
    setSaving(false);
    setShowDeleteDialog(false);
  };

  const handleSaveThresholds = async () => {
    if (parseInt(followUpThreshold) < 1 || parseInt(pastoralThreshold) < 1) {
      toast.error('Thresholds must be at least 1'); return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/settings', { method: 'POST', body: JSON.stringify({ action: 'UPDATE_SETTING', payload: { key: 'ENGAGEMENT_FOLLOW_UP_THRESHOLD', value: followUpThreshold } }) });
      await apiFetch('/api/settings', { method: 'POST', body: JSON.stringify({ action: 'UPDATE_SETTING', payload: { key: 'ENGAGEMENT_PASTORAL_THRESHOLD', value: pastoralThreshold } }) });
      toast.success('Engagement thresholds updated');
      setSettings(prev => ({ ...prev, ENGAGEMENT_FOLLOW_UP_THRESHOLD: followUpThreshold, ENGAGEMENT_PASTORAL_THRESHOLD: pastoralThreshold }));
    } catch { toast.error('Failed to save thresholds'); }
    setSaving(false);
  };

  // ========================================
  // UI Guards
  // ========================================
  if (!hasAccess) {
    return (
      <div className="flex flex-col gap-5 pb-24 md:pb-16">
        <div className="flex flex-col gap-1"><h2 className="text-xl font-bold text-foreground">Settings</h2><p className="text-sm text-muted-foreground">System configuration</p></div>
        <Card className="border-0 shadow-sm p-8 text-center"><Lock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm font-semibold text-foreground">Restricted Access</p></Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5 pb-24 md:pb-16">
        <div className="flex flex-col gap-1"><h2 className="text-xl font-bold text-foreground">Settings</h2><p className="text-sm text-muted-foreground">System configuration</p></div>
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-church-green animate-spin" /></div>
      </div>
    );
  }

  // ========================================
  // Render
  // ========================================
  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-16">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-foreground">System Settings</h2>
        <p className="text-sm text-muted-foreground">Manage global church service configurations</p>
      </div>

      {/* Access Banner */}
      <Card className={cn("border-0 shadow-sm", isSuperAdmin ? "bg-church-green/5 border-l-4 border-l-church-green" : "bg-blue-50 border-l-4 border-l-blue-500")}>
        <CardContent className="p-3 flex items-center gap-3">
          {isSuperAdmin ? <Pencil className="w-4 h-4 text-church-green flex-shrink-0" /> : <Eye className="w-4 h-4 text-blue-600 flex-shrink-0" />}
          <p className="text-xs text-foreground/80">
            {isSuperAdmin ? <span className="font-semibold">Full Control</span> : <span className="font-semibold">Read-Only View</span>} — 
            {isSuperAdmin ? "Changes here affect all users globally." : "Settings are managed by the Super Admin."}
          </p>
        </CardContent>
      </Card>

      {/* SECTION 1: CHURCH SERVICES */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-secondary/30 px-4 py-3 border-b flex items-center gap-2">
          <Church className="w-4 h-4 text-church-green" />
          <h3 className="text-sm font-bold text-foreground">Church Services</h3>
        </div>
        
        <CardContent className="p-4 space-y-5">
          {/* Dropdown List */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Service to View/Edit</Label>
            <Select value={selectedServiceId} onValueChange={handleSelectService}>
              <SelectTrigger className="h-12 rounded-xl bg-white border-border/50 text-sm">
                <SelectValue placeholder="Choose a service..." />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map((svc) => {
                  const dayLabel = DAYS_OF_WEEK.find(d => d.value === svc.dayOfWeek)?.label || 'Unknown';
                  return (
                    <SelectItem key={svc.id} value={svc.id} disabled={!isSuperAdmin && svc.name !== 'Sunday Worship Service'}>
                      <span className="flex items-center gap-2">
                        <Church className="w-3.5 h-3.5 text-muted-foreground" />
                        {svc.name} 
                        <span className="text-[10px] text-muted-foreground">({dayLabel})</span>
                        {svc.name === 'Sunday Worship Service' && <Lock className="w-3 h-3 text-yellow-500" />}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Detail / Edit Panel */}
          {selectedService && (
            <div className="border-t pt-4 mt-2 space-y-4 p-4 rounded-xl bg-secondary/30">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground">Service Details</h4>
                {isProtectedService && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border-0 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Protected
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Service Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={!isSuperAdmin || isProtectedService}
                    className="h-11 rounded-xl bg-white border-border/50 text-sm disabled:opacity-70"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Day of Week</Label>
                  <Select value={editDay} onValueChange={setEditDay} disabled={!isSuperAdmin || isProtectedService}>
                    <SelectTrigger className="h-11 rounded-xl bg-white border-border/50 text-sm disabled:opacity-70">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (<SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Action Buttons for Non-Protected Services */}
              {isSuperAdmin && !isProtectedService && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button onClick={handleUpdateService} disabled={saving} className="flex-1 h-10 rounded-xl bg-church-green hover:bg-church-green-light text-white text-xs gap-1.5">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
                    Save Changes
                  </Button>
                  <Button onClick={() => setShowDeleteDialog(true)} disabled={saving} variant="outline" className="flex-1 h-10 rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-xs gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Service
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Add New Service Form */}
          {isSuperAdmin && (
            <div className="border-t pt-4 mt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Add New Service Type</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input placeholder="e.g., Wednesday Midweek Service" value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} className="h-11 rounded-xl bg-white border border-border/50 text-sm" />
                </div>
                <Select value={newServiceDay} onValueChange={setNewServiceDay}>
                  <SelectTrigger className="h-11 w-full sm:w-[160px] rounded-xl bg-white border border-border/50 text-sm"><SelectValue placeholder="Select Day" /></SelectTrigger>
                  <SelectContent>{DAYS_OF_WEEK.map((day) => (<SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>))}</SelectContent>
                </Select>
                <Button onClick={handleAddService} disabled={saving || !newServiceName || !newServiceDay} className="h-11 rounded-xl bg-church-green hover:bg-church-green-light text-white text-sm gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Service
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: ENGAGEMENT THRESHOLDS */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-secondary/30 px-4 py-3 border-b flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-bold text-foreground">Engagement Thresholds</h3>
        </div>
        <CardContent className="p-4 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">Define how many consecutive Sundays a member must miss before triggering an alert.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-100">
              <Label className="text-xs font-semibold text-yellow-800 block mb-2">Trigger Follow-Up Call</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-yellow-700">After missing</span>
                <Input type="number" min={1} value={followUpThreshold} onChange={(e) => setFollowUpThreshold(e.target.value)} disabled={isReadOnly} className="h-10 w-20 rounded-lg bg-white border-yellow-200 text-center text-sm font-bold text-yellow-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                <span className="text-sm text-yellow-700">Sunday(s)</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-red-50 border border-red-100">
              <Label className="text-xs font-semibold text-red-800 block mb-2">Trigger Pastoral Care</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-700">After missing</span>
                <Input type="number" min={1} value={pastoralThreshold} onChange={(e) => setPastoralThreshold(e.target.value)} disabled={isReadOnly} className="h-10 w-20 rounded-lg bg-white border-red-200 text-center text-sm font-bold text-red-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                <span className="text-sm text-red-700">Sunday(s)</span>
              </div>
            </div>
          </div>
          {isSuperAdmin && (
            <Button onClick={handleSaveThresholds} disabled={saving} className="w-full h-11 rounded-xl bg-church-green hover:bg-church-green-light text-white font-semibold text-sm gap-2 mt-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />} Save Thresholds
            </Button>
          )}
        </CardContent>
      </Card>

      {/* DELETE CONFIRMATION DIALOG */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Delete Service Permanently
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedService?.name}</strong>? 
              <br /><br />
              <span className="text-red-600 font-medium">Warning:</span> Existing attendance records linked to this service name will remain in the database, but this service will no longer appear in dropdown menus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteService} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Yes, Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="text-center text-[10px] text-muted-foreground pt-2">Powered by: Xuzentra Technologies Limited</p>
    </div>
  );
}
'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { type MemberRecord, apiFetch, updateMemberStatus } from '@/lib/api';
import { usePermissions } from '@/hooks/use-permissions';
import { PermissionGate } from '@/components/PermissionGate';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Search,
  Users,
  UserX,
  Phone,
  MapPin,
  ShieldAlert,
  Eye,
  UserPlus,
  Calendar,
  Download,
  Copy,
  QrCode,
  Ban,
  CheckCircle2,
  Loader2,
  UserCircle,
  Tag,
  Home,
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { getRoleCategory } from '@/lib/rbac';

// ---- Status badge styling ----
const statusStyles: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-red-100 text-red-700',
};

// ---- Category badge styling ----
const categoryStyles: Record<string, string> = {
  Adult: 'bg-blue-50 text-blue-700',
  Youth: 'bg-violet-50 text-violet-700',
  Children: 'bg-amber-50 text-amber-700',
};

// ---- Get initials from name ----
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ---- Format date ----
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MembersPage() {
  const user = useAppStore((s) => s.user);
  const setPage = useAppStore((s) => s.setPage);
  const { can } = usePermissions();
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user ? getRoleCategory(user.role) === 'admin' : false;

  // ---- State ----
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Status change confirmation
  const [confirmAction, setConfirmAction] = useState<{
    memberId: string;
    memberName: string;
    action: 'deactivate' | 'reactivate';
  } | null>(null);

  // Fetch members
   // ✅ PRODUCTION GRADE: Strict typing, no guessing
  const fetchMembersList = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const queryString = params.toString();
      const url = `/api/members${queryString ? `?${queryString}` : ''}`;
      
      // Strictly typed to match the backend contract
      const data = await apiFetch<{ members: MemberRecord[] }>(url);
      setMembers(data.members);
    } catch (err) {
      // Handled silently or show toast
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    fetchMembersList();
  }, [fetchMembersList]);

  // ---- Stats ----
  const activeCount = members.filter((m) => m.status === 'Active').length;
  const inactiveCount = members.filter((m) => m.status === 'Inactive').length;
  const adultCount = members.filter((m) => m.category === 'Adult').length;
  const youthCount = members.filter((m) => m.category === 'Youth').length;
  const childrenCount = members.filter((m) => m.category === 'Children').length;

  // Handle status change
  const handleStatusChange = async (memberId: string, isActive: boolean) => {
    if (!user) return;
    setActionLoading(memberId);
    try {
      
      try {
  await updateMemberStatus({
  id: memberId,
  isActive,
});

  toast.success(isActive ? 'Member reactivated' : 'Member deactivated');

  setConfirmAction(null);
  fetchMembersList();

  if (selectedMember?.id === memberId) {
    setSelectedMember({
      ...selectedMember,
      isActive,
      status: isActive ? 'Active' : 'Inactive',
    });
  }

} catch (err: any) {
  toast.error(err.message || 'Failed to update member status');
}
    } catch (err) {
      toast.error('Failed to update member status');
    } finally {
      setActionLoading(null);
    }
  };

  // Download QR for selected member
  const downloadMemberQR = (member: MemberRecord) => {
    const svgEl = document.getElementById(`member-profile-qr-${member.id}`);
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 440;
      if (!ctx) return;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20, 360, 360);

      ctx.fillStyle = '#000';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(member.cardNumber, canvas.width / 2, 400);
      ctx.font = '12px sans-serif';
      ctx.fillText(member.fullName, canvas.width / 2, 425);

      const link = document.createElement('a');
      link.download = `QR-${member.cardNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Copy card number
  const copyCardNumber = (cardNumber: string) => {
    navigator.clipboard.writeText(cardNumber);
    toast.success('Card number copied');
  };

  if (loading && members.length === 0) {
    return (
      <div className="flex flex-col gap-5 pb-24 md:pb-16">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-foreground">Members</h2>
          <p className="text-sm text-muted-foreground">Manage your congregation members</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-church-green/30 border-t-church-green rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-16">
      {/* ===== 1. PAGE HEADER ===== */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-foreground">Members</h2>
        <p className="text-sm text-muted-foreground">
          Manage your congregation members
        </p>
      </div>

      {/* ===== 2. SCOPE NOTICE ===== */}
      {!isSuperAdmin && (
        <Card className="border-church-green/20 bg-church-green/5">
          <CardContent className="p-3 flex items-center gap-3">
            <ShieldAlert className="w-4 h-4 text-church-green flex-shrink-0" />
            <p className="text-xs text-foreground/80">
              <span className="font-semibold">Scoped View</span> — Showing members within your hierarchy only
            </p>
          </CardContent>
        </Card>
      )}

      {/* ===== 3. SUMMARY STATS ===== */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
            <div className="w-9 h-9 rounded-xl bg-church-green/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-church-green" />
            </div>
            <p className="text-lg font-bold text-foreground leading-none">{activeCount}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Active</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
            <div className="w-9 h-9 rounded-xl bg-church-gold/10 flex items-center justify-center">
              <Tag className="w-4 h-4 text-church-gold" />
            </div>
            <p className="text-lg font-bold text-foreground leading-none">
              {adultCount}
              <span className="text-xs font-normal text-muted-foreground">/</span>
              {youthCount}
              <span className="text-xs font-normal text-muted-foreground">/</span>
              {childrenCount}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">A / Y / C</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
              <UserX className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-lg font-bold text-foreground leading-none">{inactiveCount}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Inactive</p>
          </CardContent>
        </Card>
      </div>

      {/* ===== 4. SEARCH + FILTER BAR ===== */}
      <div className="flex flex-col gap-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or card number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 pl-9 pr-3 rounded-xl bg-secondary/50 border-0 text-sm focus-visible:ring-2 focus-visible:ring-church-green/30"
          />
        </div>

        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 rounded-xl bg-secondary/50 border-0 text-xs flex-1">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 rounded-xl bg-secondary/50 border-0 text-xs flex-1">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Adult">Adult</SelectItem>
              <SelectItem value="Youth">Youth</SelectItem>
              <SelectItem value="Children">Children</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ===== 5. REGISTER MEMBER BUTTON ===== */}
      <PermissionGate action="register_member">
        <Button
          onClick={() => setPage('register-member')}
          className="h-11 rounded-xl bg-church-green hover:bg-church-green-light text-white font-semibold text-sm shadow-lg shadow-church-green/20 transition-all active:scale-[0.98] w-full gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Register Member
        </Button>
      </PermissionGate>

      {/* ===== 6. RESULTS COUNT ===== */}
      <p className="text-xs text-muted-foreground px-1">
        Showing <span className="font-semibold text-foreground">{members.length}</span> members
      </p>

      {/* ===== 7. MEMBERS LIST ===== */}
      <div className="flex flex-col gap-2.5">
        {members.map((member) => (
          <Card key={member.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-church-green/10 text-church-green flex items-center justify-center flex-shrink-0 text-sm font-bold">
                  {getInitials(member.fullName)}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  {/* Name + Card Number */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-bold text-foreground truncate">{member.fullName}</h3>
                    <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 text-muted-foreground flex-shrink-0">
                      {member.cardNumber}
                    </Badge>
                  </div>

                  {/* Category + Gender + Status badges */}
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className={cn('text-[10px] font-medium px-1.5 py-0 border-0', categoryStyles[member.category] || 'bg-muted')}
                    >
                      {member.category}
                    </Badge>
                    {member.gender && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-medium px-1.5 py-0 border-0 bg-slate-100 text-slate-600"
                      >
                        {member.gender}
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className={cn('text-[10px] font-medium px-1.5 py-0 border-0', statusStyles[member.status] || 'bg-muted')}
                    >
                      {member.status}
                    </Badge>
                  </div>

                  {/* Location */}
                  {member.location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{member.location.name}</span>
                    </div>
                  )}

                  {/* Phone */}
                  {member.phone && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span className="truncate">{member.phone}</span>
                    </div>
                  )}
                </div>

                {/* View button */}
                <button
                  onClick={() => setSelectedMember(member)}
                  className="w-9 h-9 rounded-lg bg-church-green/10 flex items-center justify-center text-church-green hover:bg-church-green/20 transition-colors flex-shrink-0"
                  aria-label="View member details"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {members.length === 0 && !loading && (
        <div className="text-center py-10">
          <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'No members match your search or filter criteria.'
              : 'No members registered yet.'}
          </p>
          {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setCategoryFilter('all');
              }}
              className="mt-3 text-church-green text-xs"
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* ===== 8. MEMBER PROFILE DIALOG ===== */}
      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          {selectedMember && (
            <>
              {/* Green gradient header */}
              <div className="bg-gradient-to-br from-church-green to-church-green-light p-5 text-center sticky top-0 z-10">
                <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-3 text-church-gold text-lg font-bold">
                  {getInitials(selectedMember.fullName)}
                </div>
                <h3 className="text-white text-lg font-bold">{selectedMember.fullName}</h3>
                <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                  <Badge className="bg-white/20 text-white text-xs border-0 font-mono">
                    {selectedMember.cardNumber}
                  </Badge>
                  <Badge className={cn('text-xs border-0', statusStyles[selectedMember.status] || 'bg-muted')}>
                    {selectedMember.status}
                  </Badge>
                  <Badge className="bg-white/20 text-white text-xs border-0">
                    {selectedMember.category}
                  </Badge>
                </div>
              </div>

              {/* QR Code */}
              <div className="px-5 pt-5 flex flex-col items-center">
                <div className="p-3 bg-white rounded-2xl shadow-sm border">
                  <div id={`member-profile-qr-${selectedMember.id}`}>
                    <QRCodeSVG
                      value={selectedMember.cardNumber}
                      size={160}
                      level="H"
                      includeMargin={false}
                      fgColor="#000000"
                      bgColor="#ffffff"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-muted-foreground font-mono">{selectedMember.cardNumber}</span>
                  <button
                    onClick={() => copyCardNumber(selectedMember.cardNumber)}
                    className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary transition-colors"
                  >
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadMemberQR(selectedMember)}
                  className="mt-2 rounded-lg text-xs gap-1.5 h-8"
                >
                  <Download className="w-3 h-3" />
                  Download QR
                </Button>
              </div>

              {/* Detail body */}
              <div className="p-5 flex flex-col gap-3">
                {/* Category & Gender */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <UserCircle className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Category / Gender
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-medium">{selectedMember.category}</span>
                      {selectedMember.gender && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-sm text-muted-foreground">{selectedMember.gender}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Phone */}
                {selectedMember.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                        Phone
                      </p>
                      <p className="text-sm font-medium">{selectedMember.phone}</p>
                    </div>
                  </div>
                )}

                {/* Address */}
                {selectedMember.address && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <Home className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                        Address
                      </p>
                      <p className="text-sm font-medium">{selectedMember.address}</p>
                    </div>
                  </div>
                )}

                {/* Location */}
                {selectedMember.location && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                        Location
                      </p>
                      <p className="text-sm font-medium">{selectedMember.location.name}</p>
                    </div>
                  </div>
                )}

                {/* Date Joined */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Date Joined
                    </p>
                    <p className="text-sm font-medium">{formatDate(selectedMember.dateJoined)}</p>
                  </div>
                </div>

                {/* Card Number */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <QrCode className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Card Number
                    </p>
                    <p className="text-sm font-mono font-bold">{selectedMember.cardNumber}</p>
                  </div>
                </div>

                {/* Admin-only: Status controls */}
                {isAdmin && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
                      Admin Actions
                    </p>
                    {selectedMember.isActive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmAction({
                          memberId: selectedMember.id,
                          memberName: selectedMember.fullName,
                          action: 'deactivate',
                        })}
                        disabled={actionLoading === selectedMember.id}
                        className="w-full h-10 rounded-xl text-xs font-medium gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        {actionLoading === selectedMember.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Ban className="w-3.5 h-3.5" />
                        )}
                        Deactivate Member
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setConfirmAction({
                          memberId: selectedMember.id,
                          memberName: selectedMember.fullName,
                          action: 'reactivate',
                        })}
                        disabled={actionLoading === selectedMember.id}
                        className="w-full h-10 rounded-xl text-xs font-medium gap-2 bg-church-green hover:bg-church-green-light text-white"
                      >
                        {actionLoading === selectedMember.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Reactivate Member
                      </Button>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                      {selectedMember.isActive
                        ? 'Deactivating will hide this member from active lists'
                        : 'Reactivating will restore this member to active status'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== 9. CONFIRM STATUS CHANGE DIALOG ===== */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === 'deactivate' ? 'Deactivate Member' : 'Reactivate Member'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === 'deactivate'
                ? `Are you sure you want to deactivate ${confirmAction?.memberName}? They will be marked as inactive and hidden from active member lists.`
                : `Are you sure you want to reactivate ${confirmAction?.memberName}? They will be restored to active status.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="h-10 rounded-xl text-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) {
                  handleStatusChange(
                    confirmAction.memberId,
                    confirmAction.action === 'reactivate'
                  );
                }
              }}
              className={cn(
                'h-10 rounded-xl text-sm font-medium',
                confirmAction?.action === 'deactivate'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-church-green hover:bg-church-green-light text-white'
              )}
            >
              {confirmAction?.action === 'deactivate' ? 'Yes, Deactivate' : 'Yes, Reactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

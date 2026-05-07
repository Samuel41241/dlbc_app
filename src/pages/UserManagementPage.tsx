'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { usePermissions } from '@/hooks/use-permissions';
import { PermissionGate } from '@/components/PermissionGate';
import { apiFetch } from '@/lib/api';
import {
  canPerform,
  canCreateRole,
  getCreationPermissions,
  ROLE_LABELS,
  ALL_ROLES,
  getRoleCategory,
  HIERARCHY_LEVELS,
  getScopeDescription,
  PERMISSION_MATRIX,
  ALL_PERMISSIONS,
  type SystemRole,
} from '@/lib/rbac';
import {
  
  fetchUsers,
  updateUser,
  unlockAccount,
  resetUserPassword,
  activateUser,
  deactivateUser,
  fetchHierarchy,
  type UserRecord,
  type HierarchyData,
} from '@/lib/api';
import type { HierarchyNode } from '@/lib/hierarchy';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  ShieldAlert,
  Shield,
  Users,
  Lock,
  Eye,
  EyeOff,
  Mail,
  UserCircle,
  MapPin,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Loader2,
  Unlock,
  Power,
  PowerOff,
  KeyRound,
  MoreVertical,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}

// ========================================
// Types
// ========================================

type AccountStatus = 'active' | 'locked' | 'deactivated';

interface ActionTarget {
  user: UserRecord;
  action: 'activate' | 'deactivate' | 'unlock' | 'reset-password';
}

// ========================================
// Role badge styling
// ========================================

function getRoleBadgeStyle(role: string): string {
  const cat = getRoleCategory(role as SystemRole);
  if (cat === 'admin') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
}

function getRoleIcon(role: string) {
  const cat = getRoleCategory(role as SystemRole);
  if (cat === 'admin') return Shield;
  return UserCircle;
}

// ========================================
// Status badge
// ========================================

function StatusBadge({ status, failedAttempts }: { status: string; failedAttempts: number }) {
  const config = {
    active: { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', dot: 'bg-green-500' },
    locked: { label: 'Locked', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', dot: 'bg-red-500' },
    deactivated: { label: 'Deactivated', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400', dot: 'bg-gray-400' },
  }[status] || { label: status, className: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', config.dot)} />
      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', config.className)}>
        {config.label}
      </span>
      {status === 'locked' && failedAttempts > 0 && (
        <span className="text-[9px] text-red-500">({failedAttempts} fails)</span>
      )}
    </div>
  );
}

// ========================================
// Main Component
// ========================================

export default function UserManagementPage() {
  const user = useAppStore((s) => s.user);
  const userRole: SystemRole = user?.role || 'location_pastor';
  const userScope = user?.scope || {
    stateId: null, regionId: null, groupId: null, districtId: null, locationId: null,
  };

  const { can } = usePermissions();
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = !userRole.endsWith('_pastor');
    const userHierarchyLevel = HIERARCHY_LEVELS[userRole] ?? 99;

  // Creation permissions for current user
  const creationPerms = useMemo(() => getCreationPermissions(userRole), [userRole]);
  const userPermissions = PERMISSION_MATRIX[userRole];

  const creatableRoles = useMemo(() => {
    const roles: SystemRole[] = [
      ...creationPerms.canCreateAdminRoles,
      ...creationPerms.canCreatePastorRoles,
    ];
    return roles;
  }, [creationPerms]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Data
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [hierarchyData, setHierarchyData] = useState<HierarchyData | null>(null);
  const [loading, setLoading] = useState(true);

  // Create user sheet
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  // Create user form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formShowPassword, setFormShowPassword] = useState(false);
  const [formRole, setFormRole] = useState<string>('');
  const [formStateId, setFormStateId] = useState<string>(userScope.stateId || '');
  const [formRegionId, setFormRegionId] = useState<string>(userScope.regionId || '');
  const [formGroupId, setFormGroupId] = useState<string>(userScope.groupId || '');
  const [formDistrictId, setFormDistrictId] = useState<string>(userScope.districtId || '');
  const [formLocationId, setFormLocationId] = useState<string>(userScope.locationId || '');
  const [submitting, setSubmitting] = useState(false);

  // Action confirmation dialog
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);

  // Password reset dialog
  const [passwordResetTarget, setPasswordResetTarget] = useState<UserRecord | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  // ========================================
  // Helpers
  // ========================================

  

  const refreshUsers = useCallback(() => {
    if (!user) return;
    fetchUsers().then((usersArray) => {
     
      if (Array.isArray(usersArray)) {
        setUsers(usersArray);
      }
    }).catch((error) => {
     
      console.error("Refresh users failed:", error.message);
    });
  }, [user]);

  // ========================================
  // Fetch data
  // ========================================

 useEffect(() => {
    if (!user) return;
    setLoading(true);

    Promise.all([
      fetchUsers(),
      fetchHierarchy(),
    ])
      .then(([usersArray, hierObj]) => {
        // ✅ PRODUCTION: Strict type safety. We know exactly what these objects are.
        
        // 1. usersArray is UserRecord[]
        if (Array.isArray(usersArray)) {
          setUsers(usersArray);
        }

        // 2. hierObj is HierarchyData
        if (hierObj && hierObj.states) {
          setHierarchyData(hierObj);
        }
      })
      .catch((error) => {
       
        toast.error(error.message || "Failed to load management data");
      })
      .finally(() => setLoading(false));
  }, [user]);
  // ========================================
  // Hierarchy nodes
  // ========================================

  const allNodes: HierarchyNode[] = useMemo(() => {
    if (!hierarchyData) return [];
    const nodes: HierarchyNode[] = [];
    for (const s of hierarchyData.states) {
      nodes.push({ id: s.id, name: s.name, type: 'state', parentId: null, scope: userScope });
    }
    for (const r of hierarchyData.regions) {
      nodes.push({ id: r.id, name: r.name, type: 'region', parentId: r.stateId, scope: userScope });
    }
    for (const g of hierarchyData.groups) {
      nodes.push({ id: g.id, name: g.name, type: 'group', parentId: g.regionId, scope: userScope });
    }
    for (const d of hierarchyData.districts) {
      nodes.push({ id: d.id, name: d.name, type: 'district', parentId: d.groupId, scope: userScope });
    }
    for (const l of hierarchyData.locations) {
      nodes.push({ id: l.id, name: l.name, type: 'location', parentId: l.districtId, scope: userScope });
    }
    return nodes;
  }, [hierarchyData, userScope]);

  // ========================================
  // Filtered users
  // ========================================

  const filteredUsers = useMemo(() => {
    let result = users;

    if (statusFilter !== 'all') {
      result = result.filter((u) => u.status === statusFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          (u.fullName || '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          ROLE_LABELS[u.role as SystemRole]?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [users, searchQuery, statusFilter]);

  // ========================================
  // Cascading hierarchy for form
  // ========================================

  const stateNodes = allNodes.filter((n) => n.type === 'state');
  const regionNodes = allNodes.filter((n) => n.type === 'region');
  const groupNodes = allNodes.filter((n) => n.type === 'group');
  const districtNodes = allNodes.filter((n) => n.type === 'district');
  const locationNodes = allNodes.filter((n) => n.type === 'location');

  const availableStates = useMemo(() => {
    if (isSuperAdmin) return stateNodes;
    if (userScope.stateId) return stateNodes.filter((s) => s.id === userScope.stateId);
    return stateNodes;
  }, [stateNodes, userScope.stateId, isSuperAdmin]);

  const availableRegions = useMemo(() => {
    if (!formStateId && !userScope.stateId) return [];
    const parentId = formStateId || userScope.stateId || null;
    return regionNodes.filter((r) => r.parentId === parentId);
  }, [formStateId, userScope.stateId, regionNodes]);

  const availableGroups = useMemo(() => {
    if (!formRegionId && !userScope.regionId) return [];
    const parentId = formRegionId || userScope.regionId || null;
    return groupNodes.filter((g) => g.parentId === parentId);
  }, [formRegionId, userScope.regionId, groupNodes]);

  const availableDistricts = useMemo(() => {
    if (!formGroupId && !userScope.groupId) return [];
    const parentId = formGroupId || userScope.groupId || null;
    return districtNodes.filter((d) => d.parentId === parentId);
  }, [formGroupId, userScope.groupId, districtNodes]);

  const availableLocations = useMemo(() => {
    if (!formDistrictId && !userScope.districtId) return [];
    const parentId = formDistrictId || userScope.districtId || null;
    return locationNodes.filter((l) => l.parentId === parentId);
  }, [formDistrictId, userScope.districtId, locationNodes]);

  // ========================================
  // Hierarchy path builder
  // ========================================

  function getHierarchyPath(u: UserRecord): string {
    const parts: string[] = [];
    if (u.state?.name) parts.push(u.state.name);
    if (u.region?.name) parts.push(u.region.name);
    if (u.group?.name) parts.push(u.group.name);
    if (u.district?.name) parts.push(u.district.name);
    if (u.location?.name) parts.push(u.location.name);
    return parts.length > 0 ? parts.join(' → ') : 'No hierarchy assigned';
  }

  // ========================================
  // Can manage user?
  // ========================================

  function canManageUser(target: UserRecord): boolean {
    if (!user) return false;
    if (target.id === user.id) return false;
    if (userRole === 'super_admin') return true;
    if (target.role === 'super_admin') return false;

    const actorLevel = HIERARCHY_LEVELS[userRole] ?? 99;
    const targetLevel = HIERARCHY_LEVELS[target.role as SystemRole] ?? 99;

    if (actorLevel >= targetLevel) return false;
    if (userRole.endsWith('_pastor') && actorLevel === targetLevel) return false;
    return true;
  }

  // ========================================
  // Form handlers
  // ========================================

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormShowPassword(false);
    setFormRole('');
    setFormStateId(userScope.stateId || '');
    setFormRegionId(userScope.regionId || '');
    setFormGroupId(userScope.groupId || '');
    setFormDistrictId(userScope.districtId || '');
    setFormLocationId(userScope.locationId || '');
  };

    const handleCreateUser = async () => {
    if (!user || !formName || !formEmail || !formPassword || !formRole) return;
    if (!canCreateRole(userRole, formRole as SystemRole)) return;

    setSubmitting(true);
    try {
    
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: formEmail,
          fullName: formName,
          role: formRole,
          password: formPassword,
          stateId: formStateId || undefined,
          regionId: formRegionId || undefined,
          groupId: formGroupId || undefined,
          districtId: formDistrictId || undefined,
          locationId: formLocationId || undefined,
        }),
      });

      toast.success(`User "${formName}" created successfully as ${ROLE_LABELS[formRole as SystemRole]}`);
      resetForm();
      setShowCreateSheet(false);
      refreshUsers(); 
    } catch (error: any) {
      // ✅ PRODUCTION: The apiFetch bouncer ensures only true backend errors land here.
      toast.error(error.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  // Check form validity
  const isFormValid = useMemo(() => {
    if (!formName || !formEmail || !formPassword || !formRole) return false;
    if (!canCreateRole(userRole, formRole as SystemRole)) return false;
    if (formPassword.length < 8) return false;

    const targetLevel = HIERARCHY_LEVELS[formRole as SystemRole];
    if (targetLevel >= 1 && !formStateId) return false;
    if (targetLevel >= 2 && !formRegionId) return false;
    if (targetLevel >= 3 && !formGroupId) return false;
    if (targetLevel >= 4 && !formDistrictId) return false;
    if (targetLevel >= 5 && !formLocationId) return false;

    return true;
  }, [formName, formEmail, formPassword, formRole, formStateId, formRegionId, formGroupId, formDistrictId, formLocationId, userRole]);

  const requiredHierarchyDepth = useMemo(() => {
    if (!formRole) return 0;
    return HIERARCHY_LEVELS[formRole as SystemRole];
  }, [formRole]);

  // ========================================
  // Action handlers
  // ========================================

  // ========================================
// REPLACE handleConfirmAction
// ========================================
const handleConfirmAction = async () => {
  if (!actionTarget || !user) return;
  const { user: target, action } = actionTarget;

  try {
    let res: ApiResponse;

    switch (action) {
      case 'activate':
        res = await apiFetch<ApiResponse>(`/api/users?id=${target.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) });
        break;
      case 'deactivate':
        res = await apiFetch<ApiResponse>(`/api/users?id=${target.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'deactivated' }) });
        break;
      case 'unlock':
        res = await apiFetch<ApiResponse>(`/api/users?id=${target.id}`, { method: 'PATCH', body: JSON.stringify({ unlock: true }) });
        break;
      default:
        return;
    }

    if (res.success) {
      const messages = {
        activate: `Account for "${target.fullName || target.email}" has been activated`,
        deactivate: `Account for "${target.fullName || target.email}" has been deactivated`,
        unlock: `Account for "${target.fullName || target.email}" has been unlocked`,
      };
      toast.success(messages[action]);
      refreshUsers();
    } else {
      toast.error(res.error || `Failed to ${action} account`);
    }
  } catch {
    toast.error('Connection error');
  }

  setActionTarget(null);
};

  // Password reset
  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const handleOpenPasswordReset = (target: UserRecord) => {
    setPasswordResetTarget(target);
    const temp = generateTempPassword();
    setGeneratedPassword(temp);
    setNewPassword(temp);
    setShowNewPassword(false);
  };

  const handleResetPassword = async () => {
  if (!passwordResetTarget || !newPassword || !user) return;
  if (newPassword.length < 8) {
    toast.error('Password must be at least 8 characters');
    return;
  }

  setResettingPassword(true);
  try {
    const res = await apiFetch<ApiResponse>(`/api/users?id=${passwordResetTarget.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ password: newPassword })
    });

    if (res.success) {
      toast.success(`Password reset for "${passwordResetTarget.fullName || passwordResetTarget.email}"`);
      setPasswordResetTarget(null);
      setNewPassword('');
      setGeneratedPassword('');
      refreshUsers();
    } else {
      toast.error(res.error || 'Failed to reset password');
    }
  } catch {
    toast.error('Connection error');
  }
  setResettingPassword(false);
};

  // ========================================
  // Stats
  // ========================================

  const userStats = useMemo(() => {
    const active = users.filter((u) => u.status === 'active').length;
    const locked = users.filter((u) => u.status === 'locked').length;
    const deactivated = users.filter((u) => u.status === 'deactivated').length;
    return { total: users.length, active, locked, deactivated };
  }, [users]);

  // ========================================
  // Loading state
  // ========================================

  if (loading) {
    return (
      <div className="flex flex-col gap-5 pb-24 md:pb-16">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">Manage system users and access controls</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-church-green animate-spin" />
        </div>
      </div>
    );
  }

  // ========================================
  // Render
  // ========================================

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-16 relative">
      {/* ===== PAGE HEADER ===== */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-foreground">User Management</h2>
        <p className="text-sm text-muted-foreground">
          Manage system users, roles, and account security
        </p>
      </div>

      {/* ===== STATS CARDS ===== */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total', value: userStats.total, className: 'bg-secondary/50' },
          { label: 'Active', value: userStats.active, className: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Locked', value: userStats.locked, className: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'Inactive', value: userStats.deactivated, className: 'bg-gray-50 dark:bg-gray-800/30' },
        ].map((stat) => (
          <Card key={stat.label} className={cn('border-0 shadow-sm', stat.className)}>
            <CardContent className="p-3 flex flex-col items-center gap-0.5">
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ===== SCOPE NOTICE ===== */}
      {!isSuperAdmin && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 border-0 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="text-xs text-foreground/80">
              <span className="font-semibold">Scoped View</span> — You can only manage users within your hierarchy. Higher-level admins cannot be modified.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ===== SEARCH + FILTER + CREATE ===== */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 pl-9 pr-3 rounded-xl bg-secondary/50 border-0 text-sm focus-visible:ring-2 focus-visible:ring-church-green/30"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 w-full sm:w-40 rounded-xl bg-secondary/50 border-0 text-sm">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
          </SelectContent>
        </Select>

        <PermissionGate action="create_user" fallback={null}>
          {creatableRoles.length > 0 && (
            <Button
              onClick={() => { resetForm(); setShowCreateSheet(true); }}
              className="h-11 rounded-xl bg-church-green hover:bg-church-green-light text-white font-semibold text-sm shadow-lg shadow-church-green/20 transition-all active:scale-[0.98] gap-2 px-5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Create User
            </Button>
          )}
        </PermissionGate>
      </div>

      {/* ===== PERMISSION SUMMARY ===== */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-church-green" />
              <h3 className="text-sm font-bold text-foreground">Your Permissions</h3>
            </div>
            <Badge className="text-[10px] font-bold px-2 py-0.5 border-0 bg-church-green/10 text-church-green">
              {userPermissions.length} of {ALL_PERMISSIONS.length}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Your Role</p>
              <Badge className={cn('text-[10px] font-bold px-2 py-0.5 border-0 w-fit', getRoleBadgeStyle(userRole))}>
                {ROLE_LABELS[userRole]}
              </Badge>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Creatable Roles</p>
              {creatableRoles.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {creatableRoles.map((role) => (
                    <Badge key={role} className={cn('text-[9px] font-semibold px-1.5 py-0 border-0', getRoleBadgeStyle(role))}>
                      {ROLE_LABELS[role]}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">None at this level</p>
              )}
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground">
            <MapPin className="w-3 h-3 inline mr-1" />
            {getScopeDescription(userRole, userScope)}
          </div>
        </CardContent>
      </Card>

      {/* ===== USERS COUNT ===== */}
      <p className="text-xs text-muted-foreground px-1">
        Showing {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
      </p>

      {/* ===== USERS LIST ===== */}
      <PermissionGate
        action="manage_users"
        invert
        fallback={
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 text-center">
              <Lock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">Restricted Access</p>
              <p className="text-xs text-muted-foreground mt-1">You do not have permission to view user management.</p>
            </CardContent>
          </Card>
        }
      >
        <div className="flex flex-col gap-2.5">
          {filteredUsers.map((u) => {
            const RoleIcon = getRoleIcon(u.role);
            const roleCat = getRoleCategory(u.role as SystemRole);
            const manageable = canManageUser(u);
            const isSelf = user?.id === u.id;

            return (
              <Card key={u.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  {/* Row 1: Avatar + Name + Status */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                        roleCat === 'admin' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                      )}>
                        <RoleIcon className={cn(
                          'w-5 h-5',
                          roleCat === 'admin' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <h3 className="text-sm font-bold text-foreground truncate">{u.fullName || u.email}</h3>
                          {isSelf && (
                            <Badge className="text-[9px] font-semibold px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">
                              You
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{u.email}</span>
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={u.status} failedAttempts={u.failedLoginAttempts} />
                  </div>

                  {/* Row 2: Role + Hierarchy */}
                  <div className="flex flex-col gap-1.5 ml-[52px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn('text-[10px] font-bold px-1.5 py-0 border-0', getRoleBadgeStyle(u.role))}>
                        {ROLE_LABELS[u.role as SystemRole]}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {getHierarchyPath(u)}
                      </span>
                    </div>

                    {/* Row 3: Action Buttons */}
                    {manageable && (
                      <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-border/40">
                        {u.status === 'locked' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActionTarget({ user: u, action: 'unlock' })}
                            className="h-7 px-2 text-xs gap-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                          >
                            <Unlock className="w-3 h-3" />
                            Unlock
                          </Button>
                        )}

                        {u.status === 'deactivated' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActionTarget({ user: u, action: 'activate' })}
                            className="h-7 px-2 text-xs gap-1 text-green-700 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                          >
                            <Power className="w-3 h-3" />
                            Activate
                          </Button>
                        )}

                        {u.status === 'active' && isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActionTarget({ user: u, action: 'deactivate' })}
                            className="h-7 px-2 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            <PowerOff className="w-3 h-3" />
                            Deactivate
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenPasswordReset(u)}
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-secondary"
                        >
                          <KeyRound className="w-3 h-3" />
                          Reset Password
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-10">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {users.length === 0 ? 'No users found.' : 'No users match your search or filter.'}
            </p>
            {users.length === 0 && creatableRoles.length > 0 && (
              <Button
                onClick={() => { resetForm(); setShowCreateSheet(true); }}
                className="mt-3 bg-church-green hover:bg-church-green-light text-white font-semibold text-sm gap-2"
                size="sm"
              >
                <UserPlus className="w-4 h-4" />
                Create First User
              </Button>
            )}
          </div>
        )}
      </PermissionGate>

      {/* ===== CREATE USER SHEET ===== */}
      <Sheet open={showCreateSheet} 
        onOpenChange={(open) => { 
          setShowCreateSheet(open); 
          if (!open) {
            resetForm();
          } else {
          
            fetchHierarchy().then((hierObj) => {
              if (hierObj && hierObj.states) setHierarchyData(hierObj);
            }).catch(() => {});
          }
        }}
      >
        <SheetContent side="bottom" className="h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-2xl sm:rounded-t-none px-4 pt-6 pb-8">
          <SheetHeader className="mb-5">
            <SheetTitle className="text-lg font-bold">Create New User</SheetTitle>
            <SheetDescription>
              One role per user. 
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 overflow-y-auto max-h-[calc(90vh-120px)] sm:max-h-[calc(85vh-120px)] pb-4">
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cu-name" className="text-sm font-medium">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cu-name"
                placeholder="Enter full name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-12 rounded-xl bg-secondary/50 border-0 text-sm"
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cu-email" className="text-sm font-medium">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cu-email"
                type="email"
                placeholder="user@deeperlife.org"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value.toLowerCase())}
                className="h-12 rounded-xl bg-secondary/50 border-0 text-sm"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cu-password" className="text-sm font-medium">
                Password <span className="text-red-500">*</span>
                <span className="text-muted-foreground font-normal ml-1">(min 8 chars)</span>
              </Label>
              <div className="relative">
                <Input
                  id="cu-password"
                  type={formShowPassword ? 'text' : 'password'}
                  placeholder="Create a secure password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/50 border-0 text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setFormShowPassword(!formShowPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {formShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Role Dropdown (SINGLE SELECT) */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">
                Role <span className="text-red-500">*</span>
                <span className="text-muted-foreground font-normal ml-1">(one per user)</span>
              </Label>
              <Select value={formRole} onValueChange={(v) => {
                setFormRole(v);
                // Auto-set hierarchy based on selected role's requirements
                // The cascade will reset properly below
              }}>
                <SelectTrigger className="h-12 rounded-xl bg-secondary/50 border-0 text-sm">
                  <SelectValue placeholder="Select a role to assign" />
                </SelectTrigger>
                <SelectContent>
                  {creatableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      <span className="flex items-center gap-2">
                        {ROLE_LABELS[role]}
                        <span className={cn(
                          'text-[9px] font-semibold px-1 py-0 rounded',
                          getRoleBadgeStyle(role)
                        )}>
                          {getRoleCategory(role) === 'admin' ? 'Admin' : 'Pastor'}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

                        {/* ===== HIERARCHY (DYNAMIC AUTO-INHERIT) ===== */}
            <div className="border-t border-border pt-4 mt-1">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  Hierarchy Assignment
                </p>
                {!isSuperAdmin && (
                  <Badge className="text-[9px] px-1.5 py-0 bg-church-green/10 text-church-green border-0">
                    Auto-inherited
                  </Badge>
                )}
              </div>

              {/* State */}
              {availableStates.length > 0 && requiredHierarchyDepth >= 1 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  <Label className="text-xs font-medium">
                    State <span className="text-red-500">*</span>
                  </Label>
                  {!isSuperAdmin && 1 <= userHierarchyLevel ? (
                    <p className="text-xs text-muted-foreground px-3 py-2.5 rounded-xl bg-secondary/30">
                      {availableStates[0]?.name}
                    </p>
                  ) : (
                    <Select
                      value={formStateId}
                      onValueChange={(v) => {
                        setFormStateId(v);
                        setFormRegionId('');
                        setFormGroupId('');
                        setFormDistrictId('');
                        setFormLocationId('');
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-0 text-sm">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStates.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Region */}
              {availableRegions.length > 0 && requiredHierarchyDepth >= 2 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  <Label className="text-xs font-medium">
                    Region <span className="text-red-500">*</span>
                  </Label>
                  {!isSuperAdmin && 2 <= userHierarchyLevel ? (
                    <p className="text-xs text-muted-foreground px-3 py-2.5 rounded-xl bg-secondary/30">
                      {availableRegions[0]?.name}
                    </p>
                  ) : (
                    <Select
                      value={formRegionId}
                      onValueChange={(v) => {
                        setFormRegionId(v);
                        setFormGroupId('');
                        setFormDistrictId('');
                        setFormLocationId('');
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-0 text-sm">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRegions.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* ✅ PRODUCTION FIX: Warning if no regions exist yet */}
              {requiredHierarchyDepth >= 2 && availableRegions.length === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    No regions found under this State. Please create a Region in the Hierarchy module first.
                  </p>
                </div>
              )}

              {/* Group */}
              {availableGroups.length > 0 && requiredHierarchyDepth >= 3 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  <Label className="text-xs font-medium">
                    Group <span className="text-red-500">*</span>
                  </Label>
                  {!isSuperAdmin && 3 <= userHierarchyLevel ? (
                    <p className="text-xs text-muted-foreground px-3 py-2.5 rounded-xl bg-secondary/30">
                      {availableGroups[0]?.name}
                    </p>
                  ) : (
                    <Select
                      value={formGroupId}
                      onValueChange={(v) => {
                        setFormGroupId(v);
                        setFormDistrictId('');
                        setFormLocationId('');
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-0 text-sm">
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* District */}
              {availableDistricts.length > 0 && requiredHierarchyDepth >= 4 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  <Label className="text-xs font-medium">
                    District <span className="text-red-500">*</span>
                  </Label>
                  {!isSuperAdmin && 4 <= userHierarchyLevel ? (
                    <p className="text-xs text-muted-foreground px-3 py-2.5 rounded-xl bg-secondary/30">
                      {availableDistricts[0]?.name}
                    </p>
                  ) : (
                    <Select
                      value={formDistrictId}
                      onValueChange={(v) => {
                        setFormDistrictId(v);
                        setFormLocationId('');
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-0 text-sm">
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDistricts.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Location */}
              {availableLocations.length > 0 && requiredHierarchyDepth >= 5 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  <Label className="text-xs font-medium">
                    Location <span className="text-red-500">*</span>
                  </Label>
                  {!isSuperAdmin && 5 <= userHierarchyLevel ? (
                    <p className="text-xs text-muted-foreground px-3 py-2.5 rounded-xl bg-secondary/30">
                      {availableLocations[0]?.name}
                    </p>
                  ) : (
                    <Select value={formLocationId} onValueChange={setFormLocationId}>
                      <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-0 text-sm">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLocations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            {/* RBAC Info */}
            <Card className="bg-muted/50 border-0">
              <CardContent className="p-3 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-church-green flex-shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-foreground/80 font-medium">RBAC Enforcement</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    One role per user. You can only assign roles within your permission level.
                    Hierarchy is auto-inherited from your scope. All actions are audit-logged.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <Button
              onClick={handleCreateUser}
              disabled={!isFormValid || submitting}
              className="h-12 rounded-xl bg-church-green hover:bg-church-green-light text-white font-semibold text-sm shadow-lg shadow-church-green/20 transition-all active:scale-[0.98] mt-2 w-full"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Create User
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ===== CONFIRM ACTION DIALOG ===== */}
      <AlertDialog open={!!actionTarget} onOpenChange={() => setActionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionTarget?.action === 'unlock' && 'Unlock Account'}
              {actionTarget?.action === 'activate' && 'Activate Account'}
              {actionTarget?.action === 'deactivate' && 'Deactivate Account'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionTarget?.action === 'unlock' && (
                <>Unlock <strong>{actionTarget?.user.fullName || actionTarget?.user.email}</strong>? They will be able to log in again with their existing password. Failed login attempts will be reset.</>
              )}
              {actionTarget?.action === 'activate' && (
                <>Activate <strong>{actionTarget?.user.fullName || actionTarget?.user.email}</strong>? They will be able to log in with their existing credentials.</>
              )}
              {actionTarget?.action === 'deactivate' && (
                <>Deactivate <strong>{actionTarget?.user.fullName || actionTarget?.user.email}</strong>? They will <strong>not</strong> be able to log in until reactivated. This action is audit-logged.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={cn(
                actionTarget?.action === 'deactivate'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-church-green hover:bg-church-green-light text-white'
              )}
            >
              {actionTarget?.action === 'unlock' && 'Unlock Account'}
              {actionTarget?.action === 'activate' && 'Activate'}
              {actionTarget?.action === 'deactivate' && 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== PASSWORD RESET DIALOG ===== */}
      <Dialog open={!!passwordResetTarget} onOpenChange={() => { setPasswordResetTarget(null); setNewPassword(''); setGeneratedPassword(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{passwordResetTarget?.fullName || passwordResetTarget?.email}</strong>.
              {passwordResetTarget?.status === 'locked' && (
                <span className="block mt-1 text-amber-600">Note: This account is locked. Unlock it separately.</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Generated password */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">
                New Password <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="h-11 rounded-xl bg-secondary/50 border-0 text-sm font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const temp = generateTempPassword();
                    setGeneratedPassword(temp);
                    setNewPassword(temp);
                  }}
                  className="h-11 px-3 rounded-xl text-xs whitespace-nowrap"
                >
                  Generate
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Minimum 8 characters. Communicate the new password securely to the user.</p>
            </div>

            <Card className="bg-amber-50 dark:bg-amber-900/20 border-0">
              <CardContent className="p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-foreground/80 leading-relaxed">
                  This will immediately update the user&apos;s password. The old password will no longer work. This action is audit-logged.
                </p>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setPasswordResetTarget(null); setNewPassword(''); }}>
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={!newPassword || newPassword.length < 8 || resettingPassword}
              className="bg-church-green hover:bg-church-green-light text-white"
            >
              {resettingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <KeyRound className="w-4 h-4 mr-2" />
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

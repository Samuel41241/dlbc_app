// ========================================
// RBAC SYSTEM — Deeper Life Bible Church
// Role-Based Access Control + Hierarchical Scoping
// ========================================
//
// This module provides:
// 1. Role definitions (11 roles: 6 Admin + 5 Pastor)
// 2. Action-level permission engine
// 3. Hierarchy-based scope enforcement
// 4. Creation permission rules
// 5. Route and menu visibility control
// 6. Data ownership filtering (RLS-ready)
//

// ---- ADMIN ROLES ----
export type AdminRole =
  | 'super_admin'
  | 'state_admin'
  | 'region_admin'
  | 'group_admin'
  | 'district_admin'
  | 'location_admin';

// ---- PASTOR ROLES ----
export type PastorRole =
  | 'state_pastor'
  | 'region_pastor'
  | 'group_pastor'
  | 'district_pastor'
  | 'location_pastor';

// ---- COMBINED ROLE ----
export type SystemRole = AdminRole | PastorRole;

// ---- ROLE CATEGORY ----
export type RoleCategory = 'admin' | 'pastor';

// ---- HIERARCHY LEVELS ----
// Higher number = more granular (deeper in hierarchy)
export const HIERARCHY_LEVELS = {
  super_admin: 0,
  state_admin: 1,
  state_pastor: 1,
  region_admin: 2,
  region_pastor: 2,
  group_admin: 3,
  group_pastor: 3,
  district_admin: 4,
  district_pastor: 4,
  location_admin: 5,
  location_pastor: 5,
} as const;

export type HierarchyLevel = (typeof HIERARCHY_LEVELS)[SystemRole];

// ---- ROLE DISPLAY ----
export const ROLE_LABELS: Record<SystemRole, string> = {
  super_admin: 'Super Admin',
  state_admin: 'State Admin',
  region_admin: 'Region Admin',
  group_admin: 'Group Admin',
  district_admin: 'District Admin',
  location_admin: 'Location Admin',
  state_pastor: 'State Pastor',
  region_pastor: 'Region Pastor',
  group_pastor: 'Group Pastor',
  district_pastor: 'District Pastor',
  location_pastor: 'Location Pastor',
};

// ---- ROLE CATEGORY MAPPING ----
export function getRoleCategory(role: SystemRole): RoleCategory {
  return role.endsWith('_pastor') ? 'pastor' : 'admin';
}

// ---- ALL ROLES LIST ----
export const ALL_ADMIN_ROLES: AdminRole[] = [
  'super_admin',
  'state_admin',
  'region_admin',
  'group_admin',
  'district_admin',
  'location_admin',
];

export const ALL_PASTOR_ROLES: PastorRole[] = [
  'state_pastor',
  'region_pastor',
  'group_pastor',
  'district_pastor',
  'location_pastor',
];

export const ALL_ROLES: SystemRole[] = [...ALL_ADMIN_ROLES, ...ALL_PASTOR_ROLES];

// ========================================
// ACTION-LEVEL PERMISSION ENGINE
// ========================================

export type PermissionAction =
  | 'create_user'
  | 'register_member'
  | 'view_member'
  | 'mark_attendance'
  | 'send_message'
  | 'manage_hierarchy'
  | 'view_audit_logs'
  | 'manage_settings'
  | 'delete_member'
  | 'export_data'
  | 'manage_qr'
  | 'scan_attendance'
  | 'manage_newcomers'
  | 'view_reports'
  | 'manage_users';

// Permission matrix: defines what each role can do.
// Admin = full permissions within their scope.
// Pastor = restricted subset.
export const PERMISSION_MATRIX: Record<SystemRole, PermissionAction[]> = {
  super_admin: [
    'create_user', 'register_member', 'view_member', 'mark_attendance',
    'send_message', 'manage_hierarchy', 'view_audit_logs', 'manage_settings',
    'delete_member', 'export_data', 'manage_qr', 'scan_attendance',
    'manage_newcomers', 'view_reports', 'manage_users',
  ],
  state_admin: [
    'create_user', 'register_member', 'view_member', 'mark_attendance',
    'send_message', 'manage_hierarchy', 'view_audit_logs',
    'delete_member', 'export_data', 'manage_qr', 'scan_attendance',
    'manage_newcomers', 'view_reports', 'manage_users',
  ],
  region_admin: [
    'create_user', 'register_member', 'view_member', 'mark_attendance',
    'send_message', 'manage_hierarchy', 'view_audit_logs',
    'delete_member', 'export_data', 'manage_qr', 'scan_attendance',
    'manage_newcomers', 'view_reports', 'manage_users',
  ],
  group_admin: [
    'create_user', 'register_member', 'view_member', 'mark_attendance',
    'send_message', 'manage_hierarchy', 'view_audit_logs',
    'delete_member', 'export_data', 'manage_qr', 'scan_attendance',
    'manage_newcomers', 'view_reports', 'manage_users',
  ],
    district_admin: [
    'create_user', 'register_member', 'view_member', 'mark_attendance',
    'send_message', 'manage_hierarchy', 'view_audit_logs', // ✅ ADDED 'send_message'
    'delete_member', 'export_data', 'manage_qr', 'scan_attendance',
    'manage_newcomers', 'view_reports', 'manage_users',
  ],
  location_admin: [
    'create_user', 'register_member', 'view_member', 'mark_attendance',
    'send_message', 'manage_hierarchy', 'view_audit_logs', // ✅ ADDED 'send_message'
    'delete_member', 'export_data', 'manage_qr', 'scan_attendance',
    'manage_newcomers', 'view_reports', 'manage_users',
  
  ],
  // ---- PASTOR PERMISSIONS (restricted) ----
  state_pastor: [
    'create_user', 'register_member', 'view_member', 'mark_attendance',
    'send_message', 'manage_newcomers', 'view_reports',
  ],
  region_pastor: [
    'create_user', 'register_member', 'view_member', 'mark_attendance',
    'send_message', 'manage_newcomers', 'view_reports',
  ],
  group_pastor: [
    'create_user', 'register_member', 'view_member', 'mark_attendance',
    'send_message', 'manage_newcomers', 'view_reports',
  ],
  district_pastor: [
    'create_user', 'register_member', 'view_member', 'mark_attendance',
    'send_message', 'manage_newcomers', 'view_reports',
  ],
  location_pastor: [
    'create_user', 'register_member', 'view_member', 'mark_attendance',
    'send_message', 'manage_newcomers', 'view_reports',
  ],
};

/**
 * Check if a role can perform a specific action.
 */
export function canPerform(role: SystemRole, action: PermissionAction): boolean {
  return PERMISSION_MATRIX[role]?.includes(action) ?? false;
}

/**
 * Check if a role CANNOT perform a specific action.
 */
export function cannotPerform(role: SystemRole, action: PermissionAction): boolean {
  return !canPerform(role, action);
}

/**
 * Get all permissions for a role.
 */
export function getPermissions(role: SystemRole): PermissionAction[] {
  return PERMISSION_MATRIX[role] || [];
}

/**
 * Check if user can create a specific role (both permission + hierarchy level check).
 */
export function canCreateRole(creatorRole: SystemRole, targetRole: SystemRole): boolean {
  const creatorPerms = getCreationPermissions(creatorRole);
  const creatorCat = getRoleCategory(creatorRole);
  const targetCat = getRoleCategory(targetRole);

  if (targetCat === 'admin') {
    return creatorPerms.canCreateAdminRoles.includes(targetRole as AdminRole);
  }
  if (targetCat === 'pastor') {
    return creatorPerms.canCreatePastorRoles.includes(targetRole as PastorRole);
  }
  return false;
}

/**
 * Check if a hierarchy node can be created within the user's scope.
 * E.g., a Region can only be created under a State the user has access to.
 */
export function canCreateInScope(
  userRole: SystemRole,
  userScope: UserScope,
  nodeType: 'region' | 'group' | 'district' | 'location',
  parentId: string
): boolean {
  // Only admins can manage hierarchy
  if (cannotPerform(userRole, 'manage_hierarchy')) return false;

  // Super Admin bypasses scope checks
  if (userRole === 'super_admin') return true;

  switch (nodeType) {
    case 'region':
      return userScope.stateId === parentId;
    case 'group':
      return userScope.regionId === parentId;
    case 'district':
      return userScope.groupId === parentId;
    case 'location':
      return userScope.districtId === parentId;
    default:
      return false;
  }
}

/**
 * Get the minimum hierarchy level at which a user can assign scope to a created user.
 * This prevents users from assigning scopes outside their own.
 */
export function getMaxScopeLevel(role: SystemRole): number {
  if (role === 'super_admin') return 0;
  return HIERARCHY_LEVELS[role];
}

// ========================================
// USER SCOPE STRUCTURE
// ========================================

export interface UserScope {
  stateId: string | null;
  regionId: string | null;
  groupId: string | null;
  districtId: string | null;
  locationId: string | null;
}

// ✅ NEW: Strict type ONLY for the authenticated user session.
// Extends UserScope so it still works perfectly with isWithinScope() and getRLSFilter()
export interface AuthenticatedUserScope extends UserScope {
  level: 'global' | 'state' | 'region' | 'group' | 'district' | 'location';
}

// Add this mapping right above or below it
export const ROLE_TO_SCOPE_LEVEL: Record<string, AuthenticatedUserScope['level']> = {
  super_admin: 'global',
  state_admin: 'state',
  state_pastor: 'state',
  region_admin: 'region',
  region_pastor: 'region',
  group_admin: 'group',
  group_pastor: 'group',
  district_admin: 'district',
  district_pastor: 'district',
  location_admin: 'location',
  location_pastor: 'location',
};

// ========================================
// ROUTE ACCESS RULES
// ========================================

export type AppRoute =
  | 'dashboard'
  | 'members'
  | 'hierarchy'
  | 'register-member'
  | 'qr-management'
  | 'scanner'
  | 'newcomer-entry'
  | 'newcomer-records'
  | 'attendance-history'
  | 'reports'
  | 'engagement-alerts'
  | 'messaging'
  | 'audit-logs'
  | 'user-management'
  | 'settings'
  | 'more';

// Admin-only routes (pastors cannot access)
const ADMIN_ONLY_ROUTES: AppRoute[] = ['audit-logs'];

// Super Admin-only routes
const SUPER_ADMIN_ONLY_ROUTES: AppRoute[] = ['settings'];

// Routes accessible by all roles
const ALL_ACCESS_ROUTES: AppRoute[] = [
  'dashboard',
  'members', 'hierarchy', 'register-member',
  'qr-management', 'scanner', 'newcomer-entry', 'newcomer-records',
  'attendance-history',
  'reports', 'engagement-alerts',
  'messaging',
  'user-management',
  'more',
];

export function canAccessRoute(role: SystemRole, route: AppRoute): boolean {
  const category = getRoleCategory(role);

  // Super Admin has access to everything
  if (role === 'super_admin') return true;

  // Super Admin only routes
  if (SUPER_ADMIN_ONLY_ROUTES.includes(route)) return false;

  // Admin-only routes (pastors cannot access)
  if (ADMIN_ONLY_ROUTES.includes(route) && category === 'pastor') return false;

  // Dashboard routing
if (route === 'dashboard') return true;

  // All-access routes
  if (ALL_ACCESS_ROUTES.includes(route)) return true;

  return true;
}

// ========================================
// CREATION PERMISSIONS
// ========================================

export interface CreationPermission {
  canCreateAdminRoles: AdminRole[];
  canCreatePastorRoles: PastorRole[];
}

/**
 * Defines what roles a user can create.
 * Rules:
 * - Super Admin → can create anything
 * - State Admin → can create Region Admin / Region Pastor under their State
 * - Region Admin → can create Group Admin / Group Pastor under their Region
 * - Group Admin → can create District Admin / District Pastor under their Group
 * - District Admin → can create Location Admin / Location Pastor under their District
 * - Location Admin → cannot create higher hierarchy
 * - Pastors → can create ONLY within their level (no escalation)
 */
export function getCreationPermissions(role: SystemRole): CreationPermission {
  const category = getRoleCategory(role);

  if (role === 'super_admin') {
    return {
      canCreateAdminRoles: ALL_ADMIN_ROLES,
      canCreatePastorRoles: ALL_PASTOR_ROLES,
    };
  }

  if (category === 'pastor') {
    // Pastors can only create within their own level
    const level = HIERARCHY_LEVELS[role];
    return {
      canCreateAdminRoles: [],
      canCreatePastorRoles: ALL_PASTOR_ROLES.filter(
        (r) => HIERARCHY_LEVELS[r] === level
      ),
    };
  }

  // Admin creation rules
  switch (role) {
    case 'state_admin':
      return {
        canCreateAdminRoles: ['region_admin'],
        canCreatePastorRoles: ['region_pastor'],
      };
    case 'region_admin':
      return {
        canCreateAdminRoles: ['group_admin'],
        canCreatePastorRoles: ['group_pastor'],
      };
    case 'group_admin':
      return {
        canCreateAdminRoles: ['district_admin'],
        canCreatePastorRoles: ['district_pastor'],
      };
    case 'district_admin':
      return {
        canCreateAdminRoles: ['location_admin'],
        canCreatePastorRoles: ['location_pastor'],
      };
    case 'location_admin':
    default:
      return {
        canCreateAdminRoles: [],
        canCreatePastorRoles: [],
      };
  }
}

// ========================================
// VISIBILITY / FILTERING RULES
// ========================================

/**
 * Check if a hierarchy item is visible to a user based on their scope.
 * Super Admin sees everything.
 * Others only see data within their hierarchy scope.
 */
export function isWithinScope(
  userRole: SystemRole,
  userScope: UserScope,
  itemScope: UserScope
): boolean {
  // Super Admin sees everything
  if (userRole === 'super_admin') return true;

  const userLevel = HIERARCHY_LEVELS[userRole];

  // State-level user: check if item is in their state
  if (userLevel === 1) {
    return itemScope.stateId === userScope.stateId;
  }

  // Region-level user: check state + region
  if (userLevel === 2) {
    return (
      itemScope.stateId === userScope.stateId &&
      itemScope.regionId === userScope.regionId
    );
  }

  // Group-level user: check state + region + group
  if (userLevel === 3) {
    return (
      itemScope.stateId === userScope.stateId &&
      itemScope.regionId === userScope.regionId &&
      itemScope.groupId === userScope.groupId
    );
  }

  // District-level user: check state + region + group + district
  if (userLevel === 4) {
    return (
      itemScope.stateId === userScope.stateId &&
      itemScope.regionId === userScope.regionId &&
      itemScope.groupId === userScope.groupId &&
      itemScope.districtId === userScope.districtId
    );
  }

  // Location-level user: exact match
  if (userLevel === 5) {
    return (
      itemScope.stateId === userScope.stateId &&
      itemScope.regionId === userScope.regionId &&
      itemScope.groupId === userScope.groupId &&
      itemScope.districtId === userScope.districtId &&
      itemScope.locationId === userScope.locationId
    );
  }

  return false;
}

/**
 * Filter an array of scoped items based on user's role and scope.
 */
export function filterByScope<T extends { scope: UserScope }>(
  userRole: SystemRole,
  userScope: UserScope,
  items: T[]
): T[] {
  return items.filter((item) => isWithinScope(userRole, userScope, item.scope));
}

// ========================================
// MENU VISIBILITY RULES
// ========================================

export interface MenuItemAccess {
  page: AppRoute;
  label: string;
  section: string;
  adminOnly: boolean;
  superAdminOnly: boolean;
  pastorVisible: boolean;
  adminMinLevel?: number; // minimum hierarchy level for admin access (0 = all admins)
}

export const MENU_ACCESS: MenuItemAccess[] = [
  // Overview
  { page: 'dashboard', label: 'Dashboard', section: 'Overview', adminOnly: false, superAdminOnly: false, pastorVisible: false },

  // Organization (visible to all)
  { page: 'hierarchy', label: 'Church Hierarchy', section: 'Organization', adminOnly: false, superAdminOnly: false, pastorVisible: false },
  { page: 'members', label: 'Members', section: 'Organization', adminOnly: false, superAdminOnly: false, pastorVisible: false },
  { page: 'register-member', label: 'Register Member', section: 'Organization', adminOnly: false, superAdminOnly: false, pastorVisible: false },

  // Attendance (visible to all)
  { page: 'qr-management', label: 'QR Card Management', section: 'Attendance', adminOnly: false, superAdminOnly: false, pastorVisible: false },
  { page: 'scanner', label: 'Attendance Scanner', section: 'Attendance', adminOnly: false, superAdminOnly: false, pastorVisible: false },
  { page: 'newcomer-entry', label: 'Newcomer Entry', section: 'Attendance', adminOnly: false, superAdminOnly: false, pastorVisible: false },
  { page: 'newcomer-records', label: 'Newcomer Records', section: 'Attendance', adminOnly: false, superAdminOnly: false, pastorVisible: false },
  { page: 'attendance-history', label: 'Attendance History', section: 'Attendance', adminOnly: false, superAdminOnly: false, pastorVisible: false },

  // Insights (visible to all)
  { page: 'reports', label: 'Reports', section: 'Insights', adminOnly: false, superAdminOnly: false, pastorVisible: false },
  { page: 'engagement-alerts', label: 'Engagement & Alerts', section: 'Insights', adminOnly: false, superAdminOnly: false, pastorVisible: false },

  // Communication (visible to all)
  { page: 'messaging', label: 'Messaging', section: 'Communication', adminOnly: false, superAdminOnly: false, pastorVisible: false },

  // System
  { page: 'user-management', label: 'User Management', section: 'System', adminOnly: false, superAdminOnly: false, pastorVisible: false },
  { page: 'audit-logs', label: 'Audit Logs', section: 'System', adminOnly: true, superAdminOnly: true, pastorVisible: false },
  { page: 'settings', label: 'Settings', section: 'System', adminOnly: false, superAdminOnly: true, pastorVisible: false },
];

export function getVisibleMenuItems(role: SystemRole): MenuItemAccess[] {
  const category = getRoleCategory(role);

  return MENU_ACCESS.filter((item) => {
    // Super Admin only routes
    if (item.superAdminOnly && role !== 'super_admin') return false;

    // Admin only routes
    if (item.adminOnly && category === 'pastor') return false;

    // Pastor specific items
    if (item.pastorVisible && category === 'admin') return false;

    return true;
  });
}

// ========================================
// SIDEBAR SECTION STRUCTURE
// ========================================

export interface SidebarSectionDef {
  title: string;
  items: { page: AppRoute; label: string }[];
}

export function getSidebarSections(role: SystemRole): SidebarSectionDef[] {
  const visibleItems = getVisibleMenuItems(role);
  const sections: SidebarSectionDef[] = [];

  for (const item of visibleItems) {
    const existingSection = sections.find((s) => s.title === item.section);
    if (existingSection) {
      existingSection.items.push({ page: item.page, label: item.label });
    } else {
      sections.push({
        title: item.section,
        items: [{ page: item.page, label: item.label }],
      });
    }
  }

  return sections;
}

// ========================================
// PERMISSION LABELS (for UI display)
// ========================================

export const PERMISSION_LABELS: Record<PermissionAction, string> = {
  create_user: 'Create Users',
  register_member: 'Register Members',
  view_member: 'View Members',
  mark_attendance: 'Mark Attendance',
  send_message: 'Send Messages',
  manage_hierarchy: 'Manage Hierarchy',
  view_audit_logs: 'View Audit Logs',
  manage_settings: 'Manage Settings',
  delete_member: 'Delete Members',
  export_data: 'Export Data',
  manage_qr: 'Manage QR Cards',
  scan_attendance: 'Scan Attendance',
  manage_newcomers: 'Manage Newcomers',
  view_reports: 'View Reports',
  manage_users: 'Manage Users',
};

export const ALL_PERMISSIONS: PermissionAction[] = [
  'create_user', 'register_member', 'view_member', 'mark_attendance',
  'send_message', 'manage_hierarchy', 'view_audit_logs', 'manage_settings',
  'delete_member', 'export_data', 'manage_qr', 'scan_attendance',
  'manage_newcomers', 'view_reports', 'manage_users',
];

// ========================================
// RLS-READY SCOPE HELPERS
// ========================================

/**
 * Generate a RLS-style filter object for database queries.
 * This produces the WHERE clause conditions for Supabase RLS.
 */
export function getRLSFilter(userRole: SystemRole, userScope: UserScope): Record<string, string | null> {
  if (userRole === 'super_admin') return {};

  const filter: Record<string, string | null> = {};
  const level = HIERARCHY_LEVELS[userRole];

  if (level >= 1) filter.state_id = userScope.stateId;
  if (level >= 2) filter.region_id = userScope.regionId;
  if (level >= 3) filter.group_id = userScope.groupId;
  if (level >= 4) filter.district_id = userScope.districtId;
  if (level >= 5) filter.location_id = userScope.locationId;

  return filter;
}

/**
 * Get scope description for display.
 */
export function getScopeDescription(role: SystemRole, scope: UserScope): string {
  if (role === 'super_admin') return 'Full system access — all states, regions, and locations';
  const loc = scope.locationId;
  if (loc) return 'Single location';
  if (scope.districtId) return 'District-level — all locations in district';
  if (scope.groupId) return 'Group-level — all districts and locations';
  if (scope.regionId) return 'Region-level — all groups, districts, and locations';
  if (scope.stateId) return 'State-level — all regions, groups, districts, and locations';
  return 'No scope assigned';
}

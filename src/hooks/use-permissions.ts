'use client';

import { useAppStore } from '@/lib/store';
import {
  canPerform,
  canCreateRole,
  canAccessRoute,
  isWithinScope,
  getCreationPermissions,
  getPermissions,
  getMaxScopeLevel,
  type PermissionAction,
  type SystemRole,
  type AppRoute,
  type UserScope,
} from '@/lib/rbac';

/**
 * Hook for checking RBAC permissions in components.
 * Reads the current user's role and scope from the Zustand store.
 */
export function usePermissions() {
  const user = useAppStore((s) => s.user);
  const role: SystemRole = user?.role || 'super_admin';
  const scope: UserScope = user?.scope || {
    stateId: null,
    regionId: null,
    groupId: null,
    districtId: null,
    locationId: null,
  };

  return {
    role,
    scope,
    isAdmin: role.endsWith('_admin'),
    isPastor: role.endsWith('_pastor'),
    isSuperAdmin: role === 'super_admin',

    // Action-level checks
    can: (action: PermissionAction) => canPerform(role, action),
    cannot: (action: PermissionAction) => !canPerform(role, action),
    canCreate: (targetRole: SystemRole) => canCreateRole(role, targetRole),
    canAccess: (route: AppRoute) => canAccessRoute(role, route),

    // Scope checks
    isWithinScope: (itemScope: UserScope) => isWithinScope(role, scope, itemScope),

    // Info getters
    getPermissions: () => getPermissions(role),
    getCreationPermissions: () => getCreationPermissions(role),
    getMaxScopeLevel: () => getMaxScopeLevel(role),
  };
}

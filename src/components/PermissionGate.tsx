'use client';

import { usePermissions } from '@/hooks/use-permissions';
import type { PermissionAction } from '@/lib/rbac';

interface PermissionGateProps {
  /** The permission action to check */
  action: PermissionAction;
  /** Whether to invert the check (show when user CANNOT perform) */
  invert?: boolean;
  /** Fallback content when permission is denied */
  fallback?: React.ReactNode;
  /** Children to render when permission is granted */
  children: React.ReactNode;
}

/**
 * Declarative permission gate component.
 * Renders children only if the current user has the required permission.
 *
 * Usage:
 *   <PermissionGate action="view_audit_logs">
 *     <AuditLogsButton />
 *   </PermissionGate>
 *
 *   <PermissionGate action="manage_settings" fallback={null}>
 *     <SettingsButton />
 *   </PermissionGate>
 */
export function PermissionGate({ action, invert = false, fallback = null, children }: PermissionGateProps) {
  const { can } = usePermissions();
  const hasPermission = can(action);
  const shouldShow = invert ? !hasPermission : hasPermission;

  return <>{shouldShow ? children : fallback}</>;
}

/**
 * Role gate — renders children only if user has one of the specified roles.
 */
interface RoleGateProps {
  /** Roles that can see the children */
  roles: string[];
  /** Whether to show for ALL roles or ANY role (default: any) */
  mode?: 'any' | 'all';
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGate({ roles, mode = 'any', fallback = null, children }: RoleGateProps) {
  const { role } = usePermissions();
  const passes = mode === 'all' ? roles.every((r) => r === role) : roles.includes(role);

  return <>{passes ? children : fallback}</>;
}

/**
 * Scope gate — renders children only when user has a scope assignment
 * (i.e., is not Super Admin with full access).
 */
interface ScopeGateProps {
  /** Whether to show for Super Admin (full access) too */
  includeSuperAdmin?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ScopeGate({ includeSuperAdmin = false, fallback = null, children }: ScopeGateProps) {
  const { role, scope } = usePermissions();
  const hasScope = includeSuperAdmin
    ? true
    : role !== 'super_admin' && (scope.stateId !== null || scope.locationId !== null);

  return <>{hasScope ? children : fallback}</>;
}

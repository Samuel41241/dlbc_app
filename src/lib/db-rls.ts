// ========================================
// RLS (Row-Level Security) — STRICT Production Engine
// Deeper Life Bible Church — Attendance Intelligence System
// ========================================
//
// ENTERPRISE 3NF UPDATE:
// Because Member, Attendance, Newcomers, and NewcomerHeadcount now ONLY have `locationId`,
// the RLS engine traverses the relational tree: Location -> District -> Group -> Region -> State.
//
// Profile still has flat hierarchy columns, so it uses a flat filter.
// Audit Logs have NO hierarchy columns, so they filter through the `actor` Profile relation.
//

import type { SystemRole, UserScope } from './rbac';
import { NextRequest } from 'next/server'; 
import jwt from 'jsonwebtoken'; 

// ---- RLS CONTEXT ----

export interface RLSContext {
  userId: string; // Links RLS to the Wallet & Audit Logs securely
  role: SystemRole;
  scope: UserScope;
}

// ========================================
// CORE RLS POLICY FUNCTION (Used for manual checks)
// ========================================

export function checkHierarchyScope(
  userScope: UserScope,
  record: {
    stateId: string | null;
    regionId: string | null;
    groupId: string | null;
    districtId: string | null;
    locationId: string | null;
  }
): boolean {
  if (!userScope.stateId || record.stateId !== userScope.stateId) return false;
  if (userScope.regionId !== null && record.regionId !== userScope.regionId) return false;
  if (userScope.groupId !== null && record.groupId !== userScope.groupId) return false;
  if (userScope.districtId !== null && record.districtId !== userScope.districtId) return false;
  if (userScope.locationId !== null && record.locationId !== userScope.locationId) return false;
  return true;
}

// ========================================
// PRISMA FILTER BUILDERS
// ========================================

/**
 * ✅ ENTERPRISE 3NF FIX:
 * Build the core RLS WHERE filter for tables that ONLY have `locationId` 
 * (Member, Attendance, Newcomer, NewcomerHeadcount).
 * 
 * Traverses the relation: Location -> District -> Group -> Region -> State.
 */
export function buildRLSFilter(context: RLSContext): Record<string, unknown> {
  if (context.role === 'super_admin') return {};

  const { scope } = context;

  if (!scope.stateId) {
    return { id: '__rls_no_access__' };
  }

  const locationFilter: Record<string, unknown> = {};

  if (scope.locationId) {
    locationFilter.locationId = scope.locationId;
  } else if (scope.districtId) {
    locationFilter.location = { districtId: scope.districtId };
  } else if (scope.groupId) {
    locationFilter.location = { district: { groupId: scope.groupId } };
  } else if (scope.regionId) {
    locationFilter.location = { district: { group: { regionId: scope.regionId } } };
  } else {
    // State Admin: traverse all the way up the chain
    locationFilter.location = { district: { group: { region: { stateId: scope.stateId } } } };
  }

  return locationFilter;
}

/**
 * Build RLS filter for Profile table.
 * Profiles STILL HAVE flat hierarchy columns (stateId, regionId, etc.),
 * so we use the traditional flat AND filter here.
 */
export function buildProfileRLSFilter(context: RLSContext): Record<string, unknown> {
  if (context.role === 'super_admin') return {};

  const { scope } = context;
  if (!scope.stateId) {
    return { id: '__rls_no_access__' };
  }

  const conditions: Record<string, unknown>[] = [];
  conditions.push({ stateId: scope.stateId });

  if (scope.regionId !== null) conditions.push({ regionId: scope.regionId });
  if (scope.groupId !== null) conditions.push({ groupId: scope.groupId });
  if (scope.districtId !== null) conditions.push({ districtId: scope.districtId });
  if (scope.locationId !== null) conditions.push({ locationId: scope.locationId });

  return { AND: conditions };
}

/**
 * ✅ ENTERPRISE 3NF FIX:
 * Build RLS filter for Audit Logs.
 * Audit logs no longer have hierarchy columns. They only have `actorId`.
 * We filter by traversing the `actor` relation to the Profile table.
 */
export function buildAuditLogRLSFilter(context: RLSContext): Record<string, unknown> {
  if (context.role === 'super_admin') return {};

  const { scope } = context;
  if (!scope.stateId) {
    return { id: '__rls_no_access__' };
  }

  // Use the Profile filter (which has flat columns) and nest it under `actor`
  const profileFilter = buildProfileRLSFilter(context);
  return { actor: profileFilter };
}

/**
 * Alias used by Messaging Service for Member RLS filtering.
 */
export function buildFullHierarchyRLSFilter(context: RLSContext): Record<string, unknown> {
  return buildRLSFilter(context);
}

// ========================================
// CREATION VALIDATION (Unchanged - pure logic)
// ========================================

export function validateCreationScope(
  context: RLSContext,
  data: {
    stateId?: string | null;
    regionId?: string | null;
    groupId?: string | null;
    districtId?: string | null;
    locationId?: string | null;
  }
): string | null {
  if (context.role === 'super_admin') return null;

  const { scope } = context;

  if (data.stateId && data.stateId !== scope.stateId) {
    return 'Cannot create records outside your assigned state';
  }
  if (scope.regionId !== null && data.regionId && data.regionId !== scope.regionId) {
    return 'Cannot create records outside your assigned region';
  }
  if (scope.groupId !== null && data.groupId && data.groupId !== scope.groupId) {
    return 'Cannot create records outside your assigned group';
  }
  if (scope.districtId !== null && data.districtId && data.districtId !== scope.districtId) {
    return 'Cannot create records outside your assigned district';
  }
  if (scope.locationId !== null && data.locationId && data.locationId !== scope.locationId) {
    return 'Cannot create records outside your assigned location';
  }

  return null;
}

export function validateMemberHierarchyPath(data: {
  stateId?: string | null;
  regionId?: string | null;
  groupId?: string | null;
  districtId?: string | null;
  locationId?: string | null;
}): string | null {
  if (!data.stateId) return 'Member must have a state assigned';
  if (!data.regionId) return 'Member must have a region assigned';
  if (!data.groupId) return 'Member must have a group assigned';
  if (!data.districtId) return 'Member must have a district assigned';
  if (!data.locationId) return 'Member must have a location assigned';
  return null;
}

// ========================================
// HIERARCHY CASCADE FILTERS (Unchanged - for hierarchy dropdowns)
// ========================================

export function getHierarchyFilter(
  context: RLSContext,
  level: 'state' | 'region' | 'group' | 'district' | 'location'
): Record<string, unknown> {
  if (context.role === 'super_admin') return {};

  const { scope } = context;

  switch (level) {
    case 'state':
      return scope.stateId ? { id: scope.stateId } : {};

    case 'region':
      if (!scope.stateId) return {};
      const regionFilter: Record<string, unknown> = { stateId: scope.stateId };
      if (scope.regionId) regionFilter.id = scope.regionId;
      return regionFilter;

    case 'group':
      if (!scope.stateId) return {};
      const groupFilter: Record<string, unknown> = {};
      if (scope.regionId) {
        groupFilter.regionId = scope.regionId;
      } else {
        groupFilter.region = { stateId: scope.stateId };
      }
      if (scope.groupId) groupFilter.id = scope.groupId;
      return groupFilter;

    case 'district':
      if (!scope.stateId) return {};
      const districtFilter: Record<string, unknown> = {};
      if (scope.groupId) {
        districtFilter.groupId = scope.groupId;
      } else if (scope.regionId) {
        districtFilter.group = { regionId: scope.regionId };
      } else {
        districtFilter.group = { region: { stateId: scope.stateId } };
      }
      if (scope.districtId) districtFilter.id = scope.districtId;
      return districtFilter;

    case 'location':
      if (!scope.stateId) return {};
      const locationFilter: Record<string, unknown> = {};
      if (scope.districtId) {
        locationFilter.districtId = scope.districtId;
      } else if (scope.groupId) {
        locationFilter.district = { groupId: scope.groupId };
      } else if (scope.regionId) {
        locationFilter.district = { group: { regionId: scope.regionId } };
      } else {
        locationFilter.district = { group: { region: { stateId: scope.stateId } } };
      }
      if (scope.locationId) locationFilter.id = scope.locationId;
      return locationFilter;

    default:
      return {};
  }
}

// ========================================
// MERGE HELPER (Unchanged)
// ========================================

export function mergeWithRLS(
  rlsFilter: Record<string, unknown>,
  userFilter: Record<string, unknown>
): Record<string, unknown> {
  if (Object.keys(rlsFilter).length === 0) return userFilter;

  const existingAnd = userFilter.AND as Record<string, unknown>[] | undefined;
  if (existingAnd) {
    return { ...userFilter, AND: [...existingAnd, rlsFilter] };
  }

  return { AND: [userFilter, rlsFilter] };
}

// ========================================
// CONTEXT BUILDERS (Unchanged)
// ========================================

export function createRLSContextFromProfile(profile: {
   id: string; 
  role: string;
  stateId: string | null;
  regionId: string | null;
  groupId: string | null;
  districtId: string | null;
  locationId: string | null;
}): RLSContext {
  return {
     userId: profile.id,
    role: profile.role as SystemRole,
    scope: {
      stateId: profile.stateId,
      regionId: profile.regionId,
      groupId: profile.groupId,
      districtId: profile.districtId,
      locationId: profile.locationId,
    },
  };
}

export function getRLSContext(request: NextRequest): RLSContext | null {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.INTERNAL_SECRET!) as any;

    if (!payload || !payload.userId) return null;

    return {
      userId: payload.userId, 
      role: payload.role as SystemRole,
      scope: {
        stateId: payload.stateId || null,
        regionId: payload.regionId || null,
        groupId: payload.groupId || null,
        districtId: payload.districtId || null,
        locationId: payload.locationId || null,
      },
    };
  } catch (error) {
    return null; 
  }
}
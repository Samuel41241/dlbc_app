// ========================================
// HIERARCHY DATA MODEL & UTILITIES
// State → Region → Group → District → Location
// ========================================
//
// PRODUCTION NOTE: No static/mock data.
// All hierarchy data is fetched from the API (/api/hierarchy).
// Utility functions accept data arrays as parameters.
//

import type { UserScope } from './rbac';

// ---- HIERARCHY NODE TYPES ----
export type HierarchyNodeType = 'state' | 'region' | 'group' | 'district' | 'location';

export interface HierarchyNode {
  id: string;
  name: string;
  type: HierarchyNodeType;
  parentId: string | null;
  scope: UserScope;
  children?: HierarchyNode[];
}

// ========================================
// CASCADING FILTER UTILITIES
// ========================================

/**
 * Get child nodes of a specific parent.
 */
export function getChildrenOf(parentId: string, nodes: HierarchyNode[]): HierarchyNode[] {
  return nodes.filter((n) => n.parentId === parentId);
}

/**
 * Get all nodes within a scope (cascading).
 */
export function getNodesInScope(scope: UserScope, allNodes: HierarchyNode[]): HierarchyNode[] {
  const result: HierarchyNode[] = [];

  if (scope.locationId) {
    const loc = allNodes.find((l) => l.id === scope.locationId && l.type === 'location');
    if (loc) result.push(loc);
  } else if (scope.districtId) {
    const dist = allNodes.find((d) => d.id === scope.districtId && d.type === 'district');
    if (dist) result.push(dist);
    result.push(...allNodes.filter((l) => l.parentId === scope.districtId && l.type === 'location'));
  } else if (scope.groupId) {
    const group = allNodes.find((g) => g.id === scope.groupId && g.type === 'group');
    if (group) result.push(group);
    const dists = allNodes.filter((d) => d.parentId === scope.groupId && d.type === 'district');
    result.push(...dists);
    for (const d of dists) {
      result.push(...allNodes.filter((l) => l.parentId === d.id && l.type === 'location'));
    }
  } else if (scope.regionId) {
    const region = allNodes.find((r) => r.id === scope.regionId && r.type === 'region');
    if (region) result.push(region);
    const groups = allNodes.filter((g) => g.parentId === scope.regionId && g.type === 'group');
    result.push(...groups);
    for (const g of groups) {
      const dists = allNodes.filter((d) => d.parentId === g.id && d.type === 'district');
      result.push(...dists);
      for (const d of dists) {
        result.push(...allNodes.filter((l) => l.parentId === d.id && l.type === 'location'));
      }
    }
  } else if (scope.stateId) {
    const state = allNodes.find((s) => s.id === scope.stateId && s.type === 'state');
    if (state) result.push(state);
    const regions = allNodes.filter((r) => r.parentId === scope.stateId && r.type === 'region');
    result.push(...regions);
    for (const r of regions) {
      const groups = allNodes.filter((g) => g.parentId === r.id && g.type === 'group');
      result.push(...groups);
      for (const g of groups) {
        const dists = allNodes.filter((d) => d.parentId === g.id && d.type === 'district');
        result.push(...dists);
        for (const d of dists) {
          result.push(...allNodes.filter((l) => l.parentId === d.id && l.type === 'location'));
        }
      }
    }
  }

  return result;
}

/**
 * Get regions available for a given state (or all if no state filter).
 */
export function getAvailableRegions(stateId: string | null, regions: HierarchyNode[]): HierarchyNode[] {
  if (!stateId) return regions;
  return regions.filter((r) => r.parentId === stateId);
}

/**
 * Get groups available for a given region (or all if no region filter).
 */
export function getAvailableGroups(regionId: string | null, groups: HierarchyNode[]): HierarchyNode[] {
  if (!regionId) return groups;
  return groups.filter((g) => g.parentId === regionId);
}

/**
 * Get districts available for a given group (or all if no group filter).
 */
export function getAvailableDistricts(groupId: string | null, districts: HierarchyNode[]): HierarchyNode[] {
  if (!groupId) return districts;
  return districts.filter((d) => d.parentId === groupId);
}

/**
 * Get locations available for a given district (or all if no district filter).
 */
export function getAvailableLocations(districtId: string | null, locations: HierarchyNode[]): HierarchyNode[] {
  if (!districtId) return locations;
  return locations.filter((l) => l.parentId === districtId);
}

/**
 * Get the full path string for a location (e.g., "Lagos State > Lagos Central > Ikeja District > Ikeja Worship Centre").
 */
export function getLocationPath(locationId: string, nodes: HierarchyNode[]): string {
  const location = nodes.find((l) => l.id === locationId && l.type === 'location');
  if (!location) return '';

  const parts: string[] = [location.name];
  let current = location;
  while (current.parentId) {
    const parent = nodes.find((n) => n.id === current.parentId);
    if (parent) {
      parts.unshift(parent.name);
      current = parent;
    } else {
      break;
    }
  }

  return parts.join(' > ');
}

/**
 * Get scope label for display (e.g., "Ikeja Worship Centre" for a location pastor).
 */
export function getScopeLabel(scope: UserScope, nodes: HierarchyNode[]): string {
  if (scope.locationId) {
    const loc = nodes.find((n) => n.id === scope.locationId);
    return loc ? loc.name : scope.locationId;
  }
  if (scope.districtId) {
    const dist = nodes.find((n) => n.id === scope.districtId);
    return dist ? dist.name : scope.districtId;
  }
  if (scope.groupId) {
    const group = nodes.find((n) => n.id === scope.groupId);
    return group ? group.name : scope.groupId;
  }
  if (scope.regionId) {
    const region = nodes.find((n) => n.id === scope.regionId);
    return region ? region.name : scope.regionId;
  }
  if (scope.stateId) {
    const state = nodes.find((n) => n.id === scope.stateId);
    return state ? state.name : scope.stateId;
  }
  return 'All (Full Access)';
}

// ========================================
// API SERVICE — Client-side RLS-aware API calls
// Deeper Life Bible Church — Attendance Intelligence System
// ========================================

import type { SystemRole, UserScope } from './rbac';

// ---- GENERIC FETCH WRAPPER ----

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});

  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('token')
      : null;

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json();

  // 🔥 Normalize backend response
  if (!res.ok || data.success === false) {
    throw new ApiError(
      data.error || "Request failed",
      res.status
    );
  }
  
  if (data.total !== undefined && Array.isArray(data.data)) {
    return { data: data.data, total: data.total } as unknown as T;
  }

  // ✅ Return ONLY actual data
  return data.data as T;
}

// ✅ OUTSIDE the function
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ---- AUTH ----

export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: SystemRole;
    roleCategory: string;
    roleLabel: string;
    scope: UserScope;
    status: string;
    isActive: boolean;
    stateName: string | null;
    regionName: string | null;
    groupName: string | null;
    districtName: string | null;
    locationName: string | null;
  };
  error?: string;
  status?: string;
}

export async function authenticateUser(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// ---- MEMBERS ----

export interface MemberRecord {
  id: string;
  cardNumber: string;
  fullName: string;
  category: string;
  phone: string | null;
  gender: string | null;
  address: string | null;
  status: string;
  dateJoined: string;
  // ✅ ENTERPRISE FIX: Removed stateId, regionId, groupId, districtId (No longer sent by 3NF backend)
  locationId: string;
  isActive: boolean;
  createdAt: string;
  location?: { name: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export async function fetchMembers(
  params?: { status?: string; category?: string; locationId?: string; search?: string }
): Promise<PaginatedResponse<MemberRecord>> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.category) query.set('category', params.category);
  if (params?.locationId) query.set('locationId', params.locationId);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return apiFetch<PaginatedResponse<MemberRecord>>(`/api/members${qs ? `?${qs}` : ''}`);
}

export async function createMember(
  data: {
    fullName: string;
    category: string;
    gender?: string;
    phone?: string;
    address?: string;
    dateJoined?: string;
    locationId?: string;
  }
) {
  return apiFetch<{ 
    success: boolean; 
    data: MemberRecord;
    error?: string;  
  }>('/api/members', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteMember(id: string) {
  return apiFetch(`/api/members?id=${id}`, {
    method: 'DELETE',
  });
}

export async function updateMemberStatus(
  data: { id: string; isActive: boolean }
) {
  return apiFetch<{ success: boolean; data: MemberRecord }>('/api/members', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ---- ATTENDANCE ----

export interface AttendanceRecord {
  id: string;
  // ✅ ENTERPRISE FIX: Changed from serviceType to serviceName (Matches new snapshot backend column)
  serviceName: string;
  serviceDate: string;
  present: number;
  total: number;
  locationId: string;
  location?: { name: string };
}

export interface AttendanceStatsResponse {
  records: AttendanceRecord[];
  total: number;
  stats: {
    totalPresent: number;
    totalCapacity: number;
    serviceCount: number;
  };
}

export async function fetchAttendance(
  params?: { locationId?: string; from?: string; to?: string }
): Promise<AttendanceStatsResponse> {
  const query = new URLSearchParams();
  if (params?.locationId) query.set('locationId', params.locationId);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const qs = query.toString();
  return apiFetch<AttendanceStatsResponse>(`/api/attendance${qs ? `?${qs}` : ''}`);
}

// ---- NEWCOMERS ----

export interface NewcomerRecord {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  email: string | null;
  address: string | null;
  category: string;
  gender: string;
  // ✅ ENTERPRISE FIX: Changed from serviceType to serviceName (Matches new snapshot backend column)
  serviceName: string | null;
  locationId: string;
  dateRecorded: string;
  location?: { name: string };
}

export async function fetchNewcomers(
  params?: { locationId?: string; category?: string }
): Promise<PaginatedResponse<NewcomerRecord>> {
  const query = new URLSearchParams();
  if (params?.locationId) query.set('locationId', params.locationId);
  if (params?.category) query.set('category', params.category);
  const qs = query.toString();
  return apiFetch<PaginatedResponse<NewcomerRecord>>(`/api/newcomers${qs ? `?${qs}` : ''}`);
}

export async function createNewcomer(
  data: {
    fullName: string;
    phoneNumber?: string;
    email?: string;
    address?: string;
    category?: string;
    gender?: string;
    // ✅ ENTERPRISE FIX: Frontend forms should now send serviceTypeId instead of string
    serviceTypeId?: string;
    locationId: string;
  }
) {
  return apiFetch('/api/newcomers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ---- AUDIT LOGS ----

export interface AuditLogRecord {
  id: string;
  actionType: string;
  actor: string | null;
  actorId: string | null;
  actorRole: string | null;
  target: string | null;
  targetId: string | null;
  description: string | null;
  createdAt: string;
}

export async function fetchAuditLogs(
  params?: { actionType?: string },
  options?: RequestInit 
): Promise<PaginatedResponse<AuditLogRecord>> {
  const query = new URLSearchParams();
  if (params?.actionType) query.set('actionType', params.actionType);
  const qs = query.toString();
  return apiFetch<PaginatedResponse<AuditLogRecord>>(`/api/audit-logs${qs ? `?${qs}` : ''}`, options);
}

// ---- USERS ----

export interface UserRecord {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  stateId: string | null; // Note: Profiles still have flat IDs, so this is correct here
  regionId: string | null;
  groupId: string | null;
  districtId: string | null;
  locationId: string | null;
  status: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedAt: string | null;
  createdAt: string;
  state?: { name: string } | null;
  region?: { name: string } | null;
  group?: { name: string } | null;
  district?: { name: string } | null;
  location?: { name: string } | null;
}

export async function fetchUsers(
  params?: { role?: string; status?: string; search?: string }
): Promise<UserRecord[]> { 
  const query = new URLSearchParams();
  if (params?.role) query.set('role', params.role);
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return apiFetch<UserRecord[]>(`/api/users${qs ? `?${qs}` : ''}`);
}

export async function createUser(
  data: {
    email: string;
    fullName: string;
    role: string;
    password: string;
    stateId?: string;
    regionId?: string;
    groupId?: string;
    districtId?: string;
    locationId?: string;
  }
) {
  return apiFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUser(
  data: {
    id: string;
    fullName?: string;
    role?: string;
    stateId?: string;
    regionId?: string;
    groupId?: string;
    districtId?: string;
    locationId?: string;
    status?: string;
    isActive?: boolean;
    unlock?: boolean;
    password?: string;
  }
) {
  return apiFetch('/api/users', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function unlockAccount(userId: string) {
  return updateUser({ id: userId, unlock: true });
}

export async function resetUserPassword(userId: string, newPassword: string) {
  return updateUser({ id: userId, password: newPassword });
}

export async function activateUser(userId: string) {
  return updateUser({ id: userId, status: 'active' });
}

export async function deactivateUser(userId: string) {
  return updateUser({ id: userId, status: 'deactivated' });
}

// ---- STATS ----

export interface DashboardStats {
  members: { total: number; active: number; inactive: number };
  newcomers: { thisWeek: number };
  attendance: { totalServices: number; totalPresent: number; totalCapacity: number; averageRate: number };
  locations: number;
  recentAttendance: (AttendanceRecord & { location?: { name: string } })[];
}

export interface StatsResponse {
  success: boolean;
  data: DashboardStats;
}

export async function fetchStats(): Promise<StatsResponse> {
  return apiFetch<StatsResponse>('/api/stats');
}

// ---- HIERARCHY ----

export interface HierarchyData {
  states: { id: string; name: string; code: string }[];
  regions: { id: string; name: string; stateId: string }[];
  groups: { id: string; name: string; regionId: string }[];
  districts: { id: string; name: string; groupId: string }[];
  locations: { id: string; name: string; districtId: string }[];
}

export async function fetchHierarchy(
  params?: { level?: string; parentId?: string }
): Promise<HierarchyData> { 
  const query = new URLSearchParams();
  if (params?.level) query.set('level', params.level);
  if (params?.parentId) query.set('parentId', params.parentId);
  const qs = query.toString();
  return apiFetch<HierarchyData>(`/api/hierarchy${qs ? `?${qs}` : ''}`);
}

// ---- SETUP ----

export interface SetupCheckResponse {
  initialized: boolean;
  profileCount: number;
}

export interface SetupResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: SystemRole;
  };
}

export async function checkSystemSetup(): Promise<SetupCheckResponse> {
  return apiFetch<SetupCheckResponse>('/api/setup');
}

export async function createSuperAdmin(data: { email: string; fullName: string; password: string }): Promise<SetupResponse> {
  return apiFetch<SetupResponse>('/api/setup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
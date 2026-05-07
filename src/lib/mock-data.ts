// ========================================
// PRODUCTION DATA STUBS
// ========================================
// All data is fetched from API endpoints.
// This module exports types and empty stubs.

// ========================================
// TYPE DEFINITIONS
// ========================================

export type AuditActionType =
  | 'CREATE_USER'
  | 'DELETE_USER'
  | 'LOGIN_FAILED'
  | 'ROLE_UPDATED'
  | 'MEMBER_DELETED'
  | 'REGION_CREATED'
  | 'LOGIN_SUCCESS'
  | 'PASSWORD_RESET'
  | 'HIERARCHY_CHANGE'
  | 'NEWCOMER_DELETED';

export interface AuditLogEntry {
  id: string;
  actionType: AuditActionType;
  actor: string;
  actorRole: string | null;
  target: string | null;
  description: string | null;
  createdAt: string;
}

export type NewcomerCategory = 'Adult' | 'Youth' | 'Children';
export type NewcomerGender = 'Male' | 'Female' | 'Boys' | 'Girls';

export type MemberStatus = 'Active' | 'Inactive' | 'Newcomer' | 'Transferred';

export interface AttendanceEntry {
  date: string;
  service: string;
  present: number;
  total: number;
}

// ========================================
// EMPTY STUBS — Dashboards fetch from API
// ========================================

export const engagementAlertCategories = { admin: [], pastoral: [] };

export const topMembers: {
  name: string;
  role: string;
  attendance: string;
  trend: 'up' | 'down' | 'stable';
}[] = [];

export const recentAttendance: AttendanceEntry[] = [];
export const auditLogs: AuditLogEntry[] = [];
export const newcomerRecords: unknown[] = [];
export const memberRecords: unknown[] = [];

export const serviceOptions = [
  '1st Service',
  '2nd Service',
  'Wednesday Bible Study',
  'Youth Service',
  'Prayer Meeting',
];

// Stats stub — returns zeros; dashboards fetch from /api/stats
export function getStatsForRole(_role: string) {
  return {
    totalMembers: 0,
    membersPresent: 0,
    newcomersToday: 0,
    totalAttendance: 0,
  };
}

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/lib/store';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { fetchAuditLogs } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Filter,
  UserPlus,
  Trash2,
  ShieldAlert,
  KeyRound,
  GitBranch,
  FileX,
  Building2,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditLogRecord {
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

const actionTypeLabels: Record<string, string> = {
  CREATE_USER: 'Create User',
  DELETE_USER: 'Delete User',
  LOGIN_FAILED: 'Login Failed',
  ROLE_UPDATED: 'Role Updated',
  MEMBER_DELETED: 'Member Deleted',
  REGION_CREATED: 'Region Created',
  LOGIN_SUCCESS: 'Login Success',
  PASSWORD_RESET: 'Password Reset',
  HIERARCHY_CHANGE: 'Hierarchy Change',
  NEWCOMER_DELETED: 'Newcomer Deleted',
};

const actionTypeStyles: Record<string, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  CREATE_USER: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-l-emerald-500', icon: UserPlus },
  DELETE_USER: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-l-red-500', icon: Trash2 },
  MEMBER_DELETED: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-l-red-500', icon: Trash2 },
  NEWCOMER_DELETED: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-l-red-500', icon: FileX },
  LOGIN_FAILED: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-l-amber-500', icon: ShieldAlert },
  ROLE_UPDATED: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-l-blue-500', icon: ShieldAlert },
  REGION_CREATED: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-l-emerald-500', icon: Building2 },
  LOGIN_SUCCESS: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-l-emerald-500', icon: CheckCircle2 },
  PASSWORD_RESET: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-l-blue-500', icon: KeyRound },
  HIERARCHY_CHANGE: { color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-l-purple-500', icon: GitBranch },
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return `Today, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays === 1) return `Yesterday, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditLogsPage() {
  const user = useAppStore((s) => s.user);

  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ✅ ENTERPRISE FIX: Explicit error state to surface silent failures
  const [error, setError] = useState<string | null>(null);

     useEffect(() => {
    if (!user) return;
    
    // ✅ ENTERPRISE FIX: AbortController prevents flashing errors on rapid navigation
    const controller = new AbortController();
   
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        // Pass the signal to fetchAuditLogs
        const res = await fetchAuditLogs(undefined, { signal: controller.signal });
        
        setLogs(res.data || []);
      } catch (err: unknown) {
        // ✅ If the request was aborted due to navigation, DO NOT show an error.
        if (err instanceof DOMException && err.name === 'AbortError') {
          return; 
        }
        
        const errorObj = err as { error?: string; message?: string };
        setError(errorObj?.error || errorObj?.message || 'An unexpected network error occurred.');
      } finally {
        // Only stop the loading spinner if the request wasn't cancelled
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchLogs();

    // ✅ Cleanup: If the component unmounts, abort the API call
    return () => controller.abort();
  }, [user]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesAction = actionFilter === 'all' || log.actionType === actionFilter;
      const matchesSearch =
        searchQuery === '' ||
        (log.actor || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.target || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesAction && matchesSearch;
    });
  }, [logs, actionFilter, searchQuery]);

  const createActionCount = logs.filter((l) => l.actionType === 'CREATE_USER' || l.actionType === 'REGION_CREATED').length;
  const deleteActionCount = logs.filter((l) => l.actionType === 'DELETE_USER' || l.actionType === 'MEMBER_DELETED' || l.actionType === 'NEWCOMER_DELETED').length;
  const warningActionCount = logs.filter((l) => l.actionType === 'LOGIN_FAILED').length;

  if (loading) {
    return (
      <div className="flex flex-col gap-5 pb-24 md:pb-16">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-foreground">Audit Logs</h2>
          <p className="text-sm text-muted-foreground">Track all system activities</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-church-green animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-foreground">Audit Logs</h2>
        <p className="text-sm text-muted-foreground">
          Track all system activities within your assigned scope
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mx-auto mb-1.5">
              <UserPlus className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-foreground">{createActionCount}</p>
            <p className="text-[10px] text-muted-foreground">Created</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center mx-auto mb-1.5">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-lg font-bold text-foreground">{deleteActionCount}</p>
            <p className="text-[10px] text-muted-foreground">Deleted</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-lg font-bold text-foreground">{warningActionCount}</p>
            <p className="text-[10px] text-muted-foreground">Warnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, email, or action..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-9 pr-3 rounded-lg bg-secondary/50 border-0 text-sm focus-visible:ring-2 focus-visible:ring-church-green/30"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-11 w-full sm:w-[180px] rounded-lg bg-secondary/50 border-0 text-sm focus:ring-2 focus:ring-church-green/30">
                <Filter className="w-4 h-4 text-muted-foreground mr-1.5" />
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.entries(actionTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ✅ ENTERPRISE FIX: Visible Diagnostic Error Block */}
      {error && (
        <Card className="border-l-4 border-l-red-500 shadow-sm bg-red-50">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">System Sync Error</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Count */}
      {!error && (
        <p className="text-xs text-muted-foreground px-1">
          Showing {filteredLogs.length} of {logs.length} log entries
        </p>
      )}

      {/* Log Entries */}
      <div className="flex flex-col gap-2.5">
        {filteredLogs.map((log) => {
          const style = actionTypeStyles[log.actionType] || actionTypeStyles.LOGIN_SUCCESS;
          const Icon = style.icon;

          return (
            <Card
              key={log.id}
              className={cn('border-l-4 shadow-sm', style.border, 'overflow-hidden')}
            >
              <CardContent className={cn('p-3.5', style.bg)}>
                <div className="flex items-start gap-3">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', style.bg.replace('/50', '/100'))}>
                    <Icon className={cn('w-4 h-4', style.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className={cn('text-[10px] font-bold px-1.5 py-0 border-0', style.color, style.bg)}
                        >
                          {actionTypeLabels[log.actionType] || log.actionType}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {formatTimestamp(log.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-snug">{log.description}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                      <span className="text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground/70">Actor:</span> {log.actor}
                      </span>
                      {log.actorRole && (
                        <span className="text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground/70">Role:</span> {log.actorRole}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredLogs.length === 0 && !loading && !error && (
        <div className="text-center py-10">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {logs.length === 0
              ? 'No audit logs recorded yet.'
              : 'No log entries match your filters.'}
          </p>
        </div>
      )}
    </div>
  );
}
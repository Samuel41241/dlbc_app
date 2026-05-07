'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Search,
  Eye,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronUp,
  UserRoundPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NewcomerRecord {
  id: string;
  fullName: string;
  category: string;
  gender?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  serviceName: string;
  dateRecorded: string;
  location?: { name: string } | null;
}

const categoryStyles: Record<string, string> = {
  Adult: 'bg-church-green/10 text-church-green',
  Youth: 'bg-blue-100 text-blue-700',
  Children: 'bg-purple-100 text-purple-700',
};

function formatDateString(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function NewcomerRecordsPage() {
  const [records, setRecords] = useState<NewcomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingRecord, setViewingRecord] = useState<NewcomerRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Fetch records entered by ushers
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<{ newcomers: NewcomerRecord[] }>('/api/newcomers');
      setRecords(data.newcomers || []);
    } catch (error) {
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Search functionality
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.phoneNumber || '').includes(q) ||
        (r.category || '').toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  // ✅ Group by Date & Service (Crucial for Reports Module)
  const groupedRecords = useMemo(() => {
    const groups: Record<string, NewcomerRecord[]> = {};
    filteredRecords.forEach((r) => {
            const key = `${r.dateRecorded.split('T')[0]}_${r.serviceName}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredRecords]);

  // ✅ Auto-calculate Demographics (Prevents manual entry errors)
  const getGroupSummary = (groupRecords: NewcomerRecord[]) => {
    const adults = groupRecords.filter((r) => r.category === 'Adult').length;
    const youth = groupRecords.filter((r) => r.category === 'Youth').length;
    const children = groupRecords.filter((r) => r.category === 'Children').length;
    return { adults, youth, children, total: groupRecords.length };
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/newcomers?id=${id}`, { method: 'DELETE' });
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setDeletingId(null);
      toast.success('Record deleted permanently');
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-church-green animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-16">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-foreground">Newcomer Records</h2>
        <p className="text-sm text-muted-foreground">View follow-up info and manage records entered by ushers.</p>
      </div>

      {/* Search Only - NO ADD BUTTON */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-11 pl-9 pr-3 rounded-xl bg-secondary/50 border-0 text-sm focus-visible:ring-2 focus-visible:ring-church-green/30"
        />
      </div>

      <p className="text-xs text-muted-foreground px-1">{filteredRecords.length} total records</p>

      {/* Grouped List View */}
      {groupedRecords.length === 0 ? (
        <div className="text-center py-10">
          <UserRoundPlus className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {records.length === 0 ? 'No newcomer records yet. Ushers must add them via Newcomer Entry.' : 'No records match your search.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groupedRecords.map(([groupKey, groupRecords]) => {
            const [dateStr, serviceType] = groupKey.split('_');
            const summary = getGroupSummary(groupRecords);
            const isExpanded = expandedGroup === groupKey;

            return (
              <Card key={groupKey} className="border-0 shadow-sm overflow-hidden">
                {/* Clickable Header with Auto-Calculated Demographics */}
                <button
                  onClick={() => setExpandedGroup(isExpanded ? null : groupKey)}
                  className="w-full text-left p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-church-green" />
                      <span className="text-sm font-bold text-foreground">
                        {formatDateString(new Date(dateStr).toISOString())}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-church-green/10 text-church-green border-0 text-xs font-bold px-2 py-0.5">
                        {serviceType}
                      </Badge>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                  
                  {/* Demographics Row (Report-Ready Data) */}
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs"><span className="font-semibold text-foreground">{summary.total}</span> <span className="text-muted-foreground">Total</span></span>
                    <span className="text-muted-foreground">|</span>
                    <span className={cn("text-xs font-medium", categoryStyles.Adult)}>Adult: {summary.adults}</span>
                    <span className={cn("text-xs font-medium", categoryStyles.Youth)}>Youth: {summary.youth}</span>
                    <span className={cn("text-xs font-medium", categoryStyles.Children)}>Children: {summary.children}</span>
                  </div>
                </button>

                {/* Expandable Individual Names */}
                {isExpanded && (
                  <div className="border-t divide-y">
                    {groupRecords.map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-3 px-4 hover:bg-secondary/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium truncate">{record.fullName}</p>
                            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 border-0", categoryStyles[record.category])}>
                              {record.category}
                            </Badge>
                          </div>
                          {record.phoneNumber && (
                            <p className="text-xs text-muted-foreground truncate">{record.phoneNumber}</p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          {/* View Details (For Follow-up/Visitation) */}
                          <button 
                            onClick={() => setViewingRecord(record)} 
                            className="w-8 h-8 rounded-lg bg-church-green/10 flex items-center justify-center text-church-green hover:bg-church-green/20"
                            aria-label="View details for follow-up"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          
                          {/* Delete Record */}
                          <button 
                            onClick={() => setDeletingId(record.id)} 
                            className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100"
                            aria-label="Delete record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ===== VIEW FOLLOW-UP DETAILS DIALOG ===== */}
      <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
             <DialogTitle className="sr-only">Newcomer Follow-up Details</DialogTitle>
          {viewingRecord && (
            <>
              <div className="bg-gradient-to-br from-church-green to-church-green-light p-5 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
                  <UserRoundPlus className="w-7 h-7 text-church-gold" />
                </div>
                <h3 className="text-white text-lg font-bold">{viewingRecord.fullName}</h3>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Badge className="bg-white/20 text-white text-xs border-0">{viewingRecord.category}</Badge>
                  {viewingRecord.gender && <Badge className="bg-white/20 text-white text-xs border-0">{viewingRecord.gender}</Badge>}
                </div>
              </div>
              
              {/* Follow-up Information */}
              <div className="p-5 flex flex-col gap-3">
                {viewingRecord.phoneNumber && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"><Phone className="w-4 h-4 text-muted-foreground" /></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Phone (For Contact)</p><p className="text-sm font-medium">{viewingRecord.phoneNumber}</p></div>
                  </div>
                )}
                {viewingRecord.address && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"><MapPin className="w-4 h-4 text-muted-foreground" /></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Address (For Visitation)</p><p className="text-sm font-medium">{viewingRecord.address}</p></div>
                  </div>
                )}
                {viewingRecord.email && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"><Mail className="w-4 h-4 text-muted-foreground" /></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Email</p><p className="text-sm font-medium">{viewingRecord.email}</p></div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"><Calendar className="w-4 h-4 text-muted-foreground" /></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Service & Date</p><p className="text-sm font-medium">{viewingRecord.serviceName} · {formatDateString(viewingRecord.dateRecorded)}</p></div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== DELETE CONFIRMATION DIALOG ===== */}
      <Dialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Delete Newcomer Record</DialogTitle>
            <DialogDescription className="text-sm">Are you sure you want to delete this record? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <DialogClose asChild><Button variant="outline" className="h-11 rounded-xl flex-1 sm:flex-none">Cancel</Button></DialogClose>
            <Button onClick={() => deletingId && handleDelete(deletingId)} className="h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white flex-1 sm:flex-none">
              <Trash2 className="w-4 h-4 mr-1.5" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
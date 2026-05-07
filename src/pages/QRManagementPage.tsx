'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle, // ✅ ADD THIS
} from '@/components/ui/dialog';
import {
  Search,
  QrCode,
  Download,
  Copy,
  Loader2,
  User,
  Phone,
  MapPin,
  Tag,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  fullName: string;
  cardNumber: string;
  category: string;
  gender?: string | null;
  phone?: string | null;
  isActive: boolean;
  location?: { name: string } | null;
  // We will manage card status locally in the UI for now, 
  // but map it logically to the backend boolean.
  _localStatus?: 'Active' | 'Lost' | 'Deactivated'; 
}

export default function QRManagementPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Fetch all scoped members on mount
      // ✅ PRODUCTION GRADE: Strict typing, no guessing
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setIsLoading(true);
        // We strictly tell TypeScript it expects an object with a 'members' array
        const data = await apiFetch<{ members: Member[] }>('/api/members');
                const initialized = data.members.map(m => ({
          ...m, 
          _localStatus: (m.isActive ? 'Active' : 'Deactivated') as 'Active' | 'Lost' | 'Deactivated'
        }));
        setMembers(initialized);
      } catch (error) {
        toast.error('Failed to load members');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMembers();
  }, []);

  // ✅ SMART SEARCH
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase().trim();
    return members.filter((m) => 
      m.fullName.toLowerCase().includes(query) ||
      m.cardNumber.toLowerCase().includes(query) ||
      (m.phone && m.phone.includes(query))
    );
  }, [members, searchQuery]);

  // Handle Status Change
  const handleStatusChange = (memberId: string, newStatus: string) => {
    setMembers(prev => prev.map(m => 
      m.id === memberId ? { ...m, _localStatus: newStatus as Member['_localStatus'] } : m
    ));
    if (selectedMember?.id === memberId) {
      setSelectedMember(prev => prev ? { ...prev, _localStatus: newStatus as Member['_localStatus'] } : null);
    }
    // TODO: Later we will wire this to a PUT /api/members/:id to update DB
    toast.success(`Status updated to ${newStatus}`);
  };

  // Handle Delete
  const handleDelete = (memberId: string) => {
    if (!confirm('Are you sure you want to delete this member record? This cannot be undone.')) return;
    setMembers(prev => prev.filter(m => m.id !== memberId));
    setSelectedMember(null);
    // TODO: Later we will wire this to a DELETE /api/members/:id
    toast.success('Member deleted (UI only for now)');
  };

  // ✅ ROBUST DOWNLOAD FIX
  const downloadQR = (member: Member) => {
    const svgElement = document.getElementById(`qr-modal-${member.id}`);
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 600;
      canvas.height = 750;
      if (!ctx) return;
      
      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Border
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

      // QR Code
      const qrSize = 350;
      const qrX = (canvas.width - qrSize) / 2;
      ctx.drawImage(img, qrX, 50, qrSize, qrSize);
      
      // Text
      ctx.fillStyle = '#111827';
      ctx.textAlign = 'center';
      
      ctx.font = 'bold 28px Inter, sans-serif';
      ctx.fillText(member.fullName, canvas.width / 2, 440);
      
      ctx.font = '24px monospace';
      ctx.fillStyle = '#059669'; // Church Green
      ctx.fillText(member.cardNumber, canvas.width / 2, 480);

      if (member.location?.name) {
        ctx.font = '18px Inter, sans-serif';
        ctx.fillStyle = '#6b7280';
        ctx.fillText(member.location.name, canvas.width / 2, 520);
      }

      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText('DLBC Attendance System', canvas.width / 2, 700);

      const link = document.createElement('a');
      link.download = `CARD-${member.cardNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.onerror = () => toast.error('Failed to render image');
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const copyCardNumber = (cardNumber: string) => {
    navigator.clipboard.writeText(cardNumber);
    toast.success('Card number copied');
  };

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">QR Card Management</h2>
          <p className="text-sm text-muted-foreground">Manage member cards and statuses.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, or card..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-10 rounded-lg bg-secondary/50 border-0 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-2xl">
          <QrCode className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No members found.</p>
        </div>
      ) : (
        /* ✅ LIST TABLE VIEW */
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Member Name</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Card Number</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Category</th>
                  <th className="px-4 py-3 font-medium">Card Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-church-green/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-church-green" />
                        </div>
                        <div>
                          <p className="truncate max-w-[150px] sm:max-w-none">{member.fullName}</p>
                          <p className="text-xs text-muted-foreground md:hidden font-mono">{member.cardNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">{member.cardNumber}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground">
                        {member.category} {member.gender ? `/ ${member.gender}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Select 
                        value={member._localStatus} 
                        onValueChange={(val) => handleStatusChange(member.id, val)}
                      >
                        <SelectTrigger className={cn(
                          "w-[130px] h-8 text-xs rounded-md border-0",
                          member._localStatus === 'Active' && "bg-green-50 text-green-700",
                          member._localStatus === 'Lost' && "bg-yellow-50 text-yellow-700",
                          member._localStatus === 'Deactivated' && "bg-red-50 text-red-700"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Lost">Lost</SelectItem>
                          <SelectItem value="Deactivated">Deactivated</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-church-green hover:text-church-green-light hover:bg-church-green/10" onClick={() => setSelectedMember(member)}>
                          <QrCode className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(member.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t text-xs text-muted-foreground bg-secondary/10">
            Showing {filteredMembers.length} of {members.length} members
          </div>
        </div>
      )}

      {/* ===== DETAIL & DOWNLOAD MODAL ===== */}
      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
             <DialogTitle className="sr-only">Member Card Details</DialogTitle>
            
          {selectedMember && (
            <>
              <div className={cn(
                "p-6 text-center text-white",
                selectedMember._localStatus === 'Active' ? "bg-gradient-to-br from-church-green to-church-green-light" :
                selectedMember._localStatus === 'Lost' ? "bg-gradient-to-br from-yellow-500 to-yellow-600" :
                "bg-gradient-to-br from-gray-500 to-gray-600"
              )}>
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
                  <QrCode className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold truncate px-4">{selectedMember.fullName}</h3>
                <p className="text-sm opacity-90 mt-1">Status: {selectedMember._localStatus}</p>
              </div>

              <div className="p-6 flex flex-col items-center gap-5">
                <div className="p-4 bg-white rounded-2xl shadow-sm border">
                  <div id={`qr-modal-${selectedMember.id}`}>
                    <QRCodeSVG
                      value={selectedMember.cardNumber}
                      size={220}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                </div>

                <div className="w-full bg-secondary/50 rounded-xl p-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{selectedMember.fullName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Card No.</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-church-green">{selectedMember.cardNumber}</span>
                      <button onClick={() => copyCardNumber(selectedMember.cardNumber)} className="text-muted-foreground hover:text-foreground">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium">{selectedMember.location?.name || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex gap-2 w-full">
                  <Button onClick={() => downloadQR(selectedMember)} variant="outline" className="flex-1 h-11 rounded-xl text-sm font-medium gap-2">
                    <Download className="w-4 h-4" /> Download Card
                  </Button>
                  <Button onClick={() => setSelectedMember(null)} className="flex-1 h-11 rounded-xl bg-church-green hover:bg-church-green-light text-white font-medium text-sm">
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
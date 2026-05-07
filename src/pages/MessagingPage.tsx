'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { canPerform } from '@/lib/rbac';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Assuming you have this, otherwise use a normal textarea
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Send, Wallet, Users, UserCheck, UserX, UserRoundPlus, CalendarDays, Hash, Loader2, CheckCircle2, AlertTriangle, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';


type MessageType = 'absent' | 'custom' | 'broadcast';

interface Member { id: string; fullName: string; phone?: string | null; }
interface Template { id: string; title: string; content: string; }

const MOCK_WALLET_BALANCE = 5000;
const MOCK_SMS_COST = 2.0;

export default function MessagingPage() {
  const user = useAppStore((s) => s.user);
  const canSendMessage = user ? canPerform(user.role, 'send_message') : false;

  const [messageType, setMessageType] = useState<MessageType>('absent');
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomIds, setSelectedCustomIds] = useState<Set<string>>(new Set());
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom');
  const [messageText, setMessageText] = useState('');
  
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Fetch dynamic data on load
  useEffect(() => {
    if (!canSendMessage) return;
    const fetchData = async () => {
      try {
        const data = await apiFetch<{ templates: Template[], serviceTypes: string[] }>('/api/messaging/templates');
        setTemplates(data.templates || []);
        setServiceTypes(data.serviceTypes || []);
        if (data.serviceTypes?.length > 0) setSelectedService(data.serviceTypes[0]); // Auto-select first real service
      } catch (error) {
        toast.error('Failed to load messaging data');
      }
    };
    fetchData();
  }, [canSendMessage]);

  // Fetch members for custom list
  useEffect(() => {
    if (!canSendMessage || messageType !== 'custom') return;
    const fetchMembers = async () => {
      try {
        const response = await apiFetch<{ data: Member[]; total: number }>('/api/members');
        setAllMembers(response.data || []);
      } catch (error) { toast.error('Failed to load contacts'); }
    };
    fetchMembers();
  }, [canSendMessage, messageType]);

  // Sync template text when changed
  useEffect(() => {
    if (selectedTemplateId === 'custom') {
      setMessageText('');
    } else {
      const found = templates.find(t => t.id === selectedTemplateId);
      setMessageText(found?.content || '');
    }
  }, [selectedTemplateId, templates]);

  const filteredCustomMembers = useMemo(() => {
    if (!searchQuery.trim()) return allMembers;
    const q = searchQuery.toLowerCase();
    return allMembers.filter(m => m.fullName.toLowerCase().includes(q) || (m.phone || '').includes(q));
  }, [allMembers, searchQuery]);

  const recipientCount = useMemo(() => {
    if (messageType === 'custom') return selectedCustomIds.size;
    if (messageType === 'broadcast') return allMembers.length;
    if (messageType === 'absent') return Math.ceil(allMembers.length * 0.2); // Mock until backend runs
    return 0;
  }, [messageType, allMembers, selectedCustomIds]);

  const totalCost = recipientCount * MOCK_SMS_COST;

  const handleSaveTemplate = async () => {
    if (!templateTitle.trim() || !templateContent.trim()) return toast.error('Fill all template fields');
    setIsSavingTemplate(true);
    try {
      await apiFetch('/api/messaging/templates', { method: 'POST', body: JSON.stringify({ title: templateTitle, content: templateContent }) });
      toast.success('Template saved!');
      setIsTemplateModalOpen(false);
      setTemplateTitle(''); setTemplateContent('');
      // Refresh templates list
      const data = await apiFetch<{ templates: Template[] }>('/api/messaging/templates');
      setTemplates(data.templates || []);
    } catch { toast.error('Failed to save template'); }
    finally { setIsSavingTemplate(false); }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await apiFetch(`/api/messaging/templates/${id}`, { method: 'DELETE' });
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (selectedTemplateId === id) setSelectedTemplateId('custom');
      toast.success('Template deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const handleSend = async () => {
    if (!messageText.trim()) return toast.error('Please enter or select a message');
    if (recipientCount === 0) return toast.error('No recipients selected');
    if (recipientCount * MOCK_SMS_COST > MOCK_WALLET_BALANCE) return toast.error('Insufficient wallet balance');

    setIsSending(true);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Mock API call
    
    setSendSuccess(true);
    setIsSending(false);
    toast.success(`Message sent to ${recipientCount} contacts! (Mock)`);
  };

  if (!canSendMessage) {
    return (
      <div className="flex flex-col gap-5 pb-24 md:pb-16">
        <h2 className="text-xl font-bold text-foreground">Messaging & Wallet</h2>
        <Card className="border-0 shadow-sm p-8 text-center text-muted-foreground">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-orange-500" />
          <p className="text-sm font-medium">Access Restricted</p>
          <p className="text-xs mt-1 max-w-sm mx-auto">Your role ({user?.roleLabel || 'Unknown'}) does not have permission to send SMS messages.</p>
        </Card>
      </div>
    );
  }

  if (sendSuccess) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="w-20 h-20 rounded-full bg-church-green/10 flex items-center justify-center"><CheckCircle2 className="w-10 h-10 text-church-green" /></div>
      <h2 className="text-2xl font-bold text-foreground">Message Dispatched!</h2>
      <p className="text-muted-foreground max-w-sm">SMS successfully sent to <span className="font-bold text-foreground">{recipientCount}</span> contacts.<br />Cost: <span className="font-bold text-foreground">₦{totalCost.toFixed(2)}</span></p>
      <Button onClick={() => { setSendSuccess(false); setMessageText(''); }} className="mt-4 bg-church-green hover:bg-church-green-light">Send Another Message</Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-16">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-foreground">Messaging & Wallet</h2>
        <p className="text-sm text-muted-foreground">Send SMS to your congregation.</p>
      </div>

      {/* Wallet Card */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-church-green to-emerald-600 text-white">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Wallet className="w-5 h-5" /></div>
            <div><p className="text-xs text-green-100">Wallet Balance (Mock)</p><p className="text-xl font-bold">₦{MOCK_WALLET_BALANCE.toLocaleString()}</p></div>
          </div>
          <div className="text-right text-xs"><p className="text-green-100">Cost per SMS</p><p className="font-bold">₦{MOCK_SMS_COST.toFixed(2)}</p></div>
        </CardContent>
      </Card>

      {/* Templates Management */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Message Templates</Label>
            <Button variant="outline" size="sm" onClick={() => setIsTemplateModalOpen(true)} className="gap-1 border-church-green text-church-green hover:bg-church-green/10">
              <Plus className="w-4 h-4" /> New
            </Button>
          </div>
          
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger className="w-full h-11 rounded-xl bg-secondary/50 border-0">
              <SelectValue placeholder="Select a template or write custom..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">✏️ Write Custom Message</SelectItem>
              {templates.map(t => (
                <SelectItem key={t.id} value={t.id} className="flex items-center justify-between w-full">
                  <span>{t.title}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Simple list to delete templates */}
          {templates.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t pt-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-1 bg-secondary/50 rounded-lg px-2 py-1 text-xs">
                  <span>{t.title}</span>
                  <button onClick={() => handleDeleteTemplate(t.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Type Selector */}
      <div className="grid grid-cols-2 gap-2">
        {([
          { key: 'absent' as MessageType, label: 'Absent Members', icon: UserX, desc: 'Missed selected service' },
          { key: 'custom' as MessageType, label: 'Custom List', icon: UserRoundPlus, desc: 'Select manually' },
          { key: 'broadcast' as MessageType, label: 'Broadcast', icon: MessageSquare, desc: 'All members' },
        ]).map((type) => (
          <button key={type.key} onClick={() => { setMessageType(type.key); setSearchQuery(''); setSelectedCustomIds(new Set()); }} className={cn("flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left", messageType === type.key ? "border-church-green bg-church-green/5" : "border-transparent bg-secondary/30 hover:bg-secondary/50")}>
            <type.icon className={cn("w-5 h-5", messageType === type.key ? "text-church-green" : "text-muted-foreground")} />
            <div><p className="text-sm font-semibold">{type.label}</p><p className="text-[10px] text-muted-foreground">{type.desc}</p></div>
          </button>
        ))}
      </div>

      {/* Dynamic Filters (Absent) */}
      {(messageType === 'absent') && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs font-medium text-muted-foreground mb-1 block">Target Date</Label>
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-11 rounded-xl bg-secondary/50 border-0" />
            </div>
            <div className="flex-1">
              <Label className="text-xs font-medium text-muted-foreground mb-1 block">Target Service (From DB)</Label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-0"><SelectValue placeholder="Loading services..." /></SelectTrigger>
                <SelectContent>
                  {serviceTypes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom Picker */}
      {messageType === 'custom' && (
        <Card className="border-0 shadow-sm"><CardContent className="p-4 space-y-3">
          <div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search by name or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-11 pl-9 rounded-xl bg-secondary/50 border-0" /></div>
          <div className="max-h-40 overflow-y-auto flex flex-col gap-1 bg-secondary/30 rounded-lg p-2">
            {filteredCustomMembers.slice(0, 10).map(m => (
              <button key={m.id} onClick={() => setSelectedCustomIds(prev => { const n = new Set(prev); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })} className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/50 transition text-left">
                <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center", selectedCustomIds.has(m.id) ? "bg-church-green border-church-green" : "border-gray-300")}>{selectedCustomIds.has(m.id) && <CheckCircle2 className="w-3 h-3 text-white" />}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{m.fullName}</p>{m.phone && <p className="text-[10px] text-muted-foreground truncate">{m.phone}</p>}</div>
              </button>
            ))}
          </div>
        </CardContent></Card>
      )}

      {/* Composer Section */}
      <Card className="border-0 shadow-sm"><CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between bg-secondary/30 rounded-xl p-3 px-4">
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-church-green" /><span className="text-sm font-medium text-foreground">{recipientCount} Recipients</span></div>
          <span className="text-sm font-bold text-church-green">Cost: ₦{totalCost.toFixed(2)}</span>
        </div>
        <textarea placeholder={selectedTemplateId === 'custom' ? "Type your custom message here..." : "Editing template..."} rows={4} value={messageText} onChange={(e) => setMessageText(e.target.value)} className="w-full min-h-[100px] p-3 rounded-xl bg-secondary/50 border-0 text-sm resize-none focus-visible:ring-2 focus-visible:ring-church-green/30 outline-none" disabled={selectedTemplateId !== 'custom' && !messageText} />
        <Button onClick={handleSend} disabled={isSending || recipientCount === 0 || !messageText.trim()} className="w-full h-12 rounded-xl bg-church-green hover:bg-church-green-light text-white font-semibold text-sm shadow-lg gap-2 transition-all active:scale-[0.98]">
          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send SMS
        </Button>
      </CardContent></Card>

      {/* Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsTemplateModalOpen(false)}>
          <div className="bg-background rounded-xl p-6 w-full max-w-md shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg">Save Template</h3>
            <Input placeholder="Template Title (e.g., Absentee Follow-up)" value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} />
            <Textarea placeholder="Write the message body here. Use [Name] as a placeholder if supported by your SMS provider later." rows={5} value={templateContent} onChange={(e) => setTemplateContent(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsTemplateModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveTemplate} disabled={isSavingTemplate} className="bg-church-green hover:bg-church-green-light">{isSavingTemplate ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save Template</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
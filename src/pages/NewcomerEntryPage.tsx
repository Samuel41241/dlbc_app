'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UserPlus,
  MapPin,
  Phone,
  User,
  Hash,
  Users,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSystemData } from '@/hooks/useSystemData';

const GENDER_OPTIONS: Record<string, { value: string; label: string }[]> = {
  Adult: [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
  ],
  Youth: [
    { value: 'Boys', label: 'Boys' },
    { value: 'Girls', label: 'Girls' },
  ],
  Children: [
    { value: 'Boys', label: 'Boys' },
    { value: 'Girls', label: 'Girls' },
  ],
};

export default function NewcomerEntryPage() {
  const user = useAppStore((s) => s.user);
  const isShepherd = !!user?.scope?.locationId;

  const { services } = useSystemData();

  // ✅ ENTERPRISE FIX: Store the Service Type ID, not the string name
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const selectedLocation = user?.scope?.locationId || '';
  const [isSetupReady, setIsSetupReady] = useState(false);

  const [adultMale, setAdultMale] = useState('');
  const [adultFemale, setAdultFemale] = useState('');
  const [youthBoys, setYouthBoys] = useState('');
  const [youthGirls, setYouthGirls] = useState('');
  const [childrenBoys, setChildrenBoys] = useState('');
  const [childrenGirls, setChildrenGirls] = useState('');

  const [fullName, setFullName] = useState('');
  const [category, setCategory] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsSetupReady(!!selectedServiceId && !!selectedLocation);
  }, [selectedServiceId, selectedLocation]);

  const genderOptions = category ? (GENDER_OPTIONS[category] || []) : [];

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setGender('');
  };

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !category || !gender) {
      toast.error('Name, Category, and Gender are required');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch('/api/newcomers', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          category,
          gender,
          phoneNumber: phone.trim() || null,
          address: address.trim() || null,
          email: email.trim() || null,
          // ✅ ENTERPRISE FIX: Send ONLY what the 3NF backend requires
          serviceTypeId: selectedServiceId, // FK ID, not string name
          locationId: selectedLocation,     // ONLY locationId
          // ❌ REMOVED: serviceType, ...getHierarchyPayload()
        }),
      });

      toast.success(`${fullName.split(' ')[0]} recorded successfully!`);
      setFullName(''); setCategory(''); setGender(''); setPhone(''); setAddress(''); setEmail('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save newcomer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCounts = async () => {
    const total = (parseInt(adultMale)||0) + (parseInt(adultFemale)||0) + (parseInt(youthBoys)||0) + (parseInt(youthGirls)||0) + (parseInt(childrenBoys)||0) + (parseInt(childrenGirls)||0);
    if (total === 0) return toast.error('Please enter at least one headcount');
    
    try {
      await apiFetch('/api/newcomers/headcount', {
        method: 'POST',
        body: JSON.stringify({
          // ✅ ENTERPRISE FIX: Send ONLY what the 3NF backend requires
          serviceTypeId: selectedServiceId, // FK ID, not string name
          locationId: selectedLocation,     // ONLY locationId
          adultMale, 
          adultFemale, 
          youthBoys, 
          youthGirls, 
          childrenBoys, 
          childrenGirls
          // ❌ REMOVED: serviceType, ...getHierarchyPayload()
        }),
      });

      // ✅ ENTERPRISE FIX: Look up service name dynamically for toast message
      const serviceName = services.find((s) => s.id === selectedServiceId)?.name || 'Service';
      toast.success(`Quick count saved: ${total} total newcomers for ${serviceName}`);
      
      setAdultMale(''); setAdultFemale(''); setYouthBoys(''); setYouthGirls(''); setChildrenBoys(''); setChildrenGirls('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save headcount');
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-16">
      <div>
        <h2 className="text-xl font-bold text-foreground">Newcomer Entry</h2>
        <p className="text-sm text-muted-foreground">Record headcounts and follow-up information for new visitors.</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Service Type Dropdown */}
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Service Type</label>
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-0">
                  <SelectValue placeholder="Select Service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((svc) => {
                    const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][svc.dayOfWeek];
                    return (
                      // ✅ ENTERPRISE FIX: Value is now the Database ID
                      <SelectItem key={svc.id} value={svc.id}>
                        {svc.name} ({dayLabel})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
              <div className="h-11 px-3 flex items-center rounded-xl bg-church-green/5 border border-church-green/20 text-sm font-medium text-foreground">
                <MapPin className="w-4 h-4 text-church-green mr-2" />
                {user?.scopeNames?.locationName || 'Assigned Location'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isSetupReady && (
        <>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-church-gold" />
                  <h3 className="text-sm font-bold text-foreground">Quick Headcount</h3>
                </div>
                <Button variant="outline" size="sm" onClick={handleSaveCounts} className="h-8 text-xs">
                  Save Count
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">Adult Male</Label><Input type="number" placeholder="0" value={adultMale} onChange={(e) => setAdultMale(e.target.value)} className="h-10 mt-1" /></div>
                <div><Label className="text-xs text-muted-foreground">Adult Female</Label><Input type="number" placeholder="0" value={adultFemale} onChange={(e) => setAdultFemale(e.target.value)} className="h-10 mt-1" /></div>
                <div><Label className="text-xs text-muted-foreground">Youth Boys</Label><Input type="number" placeholder="0" value={youthBoys} onChange={(e) => setYouthBoys(e.target.value)} className="h-10 mt-1" /></div>
                <div><Label className="text-xs text-muted-foreground">Youth Girls</Label><Input type="number" placeholder="0" value={youthGirls} onChange={(e) => setYouthGirls(e.target.value)} className="h-10 mt-1" /></div>
                <div><Label className="text-xs text-muted-foreground">Children Boys</Label><Input type="number" placeholder="0" value={childrenBoys} onChange={(e) => setChildrenBoys(e.target.value)} className="h-10 mt-1" /></div>
                <div><Label className="text-xs text-muted-foreground">Children Girls</Label><Input type="number" placeholder="0" value={childrenGirls} onChange={(e) => setChildrenGirls(e.target.value)} className="h-10 mt-1" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-5">
                <Users className="w-4 h-4 text-church-green" />
                <h3 className="text-sm font-bold text-foreground">Newcomer Follow-Up Information</h3>
              </div>

              <form onSubmit={handleSubmitDetails} className="flex flex-col gap-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input required placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 pl-9 rounded-xl bg-secondary/50 border-0 text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Select value={category} onValueChange={handleCategoryChange} required>
                    <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-0 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Adult">Adult</SelectItem>
                      <SelectItem value="Youth">Youth</SelectItem>
                      <SelectItem value="Children">Children</SelectItem>
                    </SelectContent>
                  </Select>

                  {category && (
                    <Select value={gender} onValueChange={setGender} required>
                      <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-0 text-sm"><SelectValue placeholder="Gender" /></SelectTrigger>
                      <SelectContent>
                        {genderOptions.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="tel" placeholder="Phone Number (Important for follow-up)" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 pl-9 rounded-xl bg-secondary/50 border-0 text-sm" />
                </div>

                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <textarea placeholder="Residential Address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full h-20 pl-9 pr-3 py-2.5 rounded-xl bg-secondary/50 border-0 text-sm resize-none outline-none" />
                </div>

                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="email" placeholder="Email Address (Optional)" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 pl-9 rounded-xl bg-secondary/50 border-0 text-sm" />
                </div>

                <Button type="submit" disabled={isSubmitting} className="h-12 rounded-xl bg-church-green hover:bg-church-green-light text-white font-semibold text-sm shadow-lg w-full gap-2 mt-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Save Newcomer Details
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
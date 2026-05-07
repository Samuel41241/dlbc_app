'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { createMember, apiFetch } from '@/lib/api';
import { usePermissions } from '@/hooks/use-permissions';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  UserPlus,
  CheckCircle2,
  Download,
  Copy,
  Loader2,
  Calendar,
  MapPin,
  Phone,
  User,
  Tag,
  Building2,
  Network,
  MapPinned,
  Layers,
  GitBranch,
   LayoutDashboard,
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';

// ---- Category → Gender options ----
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

interface HierarchyItem {
  id: string;
  name: string;
  stateId?: string;
  regionId?: string;
  groupId?: string;
  districtId?: string;
}

interface HierarchyData {
  states: HierarchyItem[];
  regions: HierarchyItem[];
  groups: HierarchyItem[];
  districts: HierarchyItem[];
  locations: HierarchyItem[];
}

interface CreatedMember {
  id: string;
  cardNumber: string;
  fullName: string;
  category: string;
  gender: string;
}

export default function RegisterMemberPage() {
  const user = useAppStore((s) => s.user);
  const setPage = useAppStore((s) => s.setPage);
  const { can } = usePermissions();

  // Form state
  const [fullName, setFullName] = useState('');
  const [category, setCategory] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [dateJoined] = useState(new Date().toISOString().split('T')[0]);

  // Hierarchy state
  const [hierarchyData, setHierarchyData] = useState<HierarchyData | null>(null);
  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState(true);
  const [selectedState, setSelectedState] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [createdMember, setCreatedMember] = useState<CreatedMember | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const scope = user?.scope;

  // Fetch Hierarchy on mount
  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        setIsLoadingHierarchy(true);
        const data = await apiFetch<HierarchyData>('/api/hierarchy');
        setHierarchyData(data);
      } catch (err) {
        toast.error('Failed to load hierarchy data');
      } finally {
        setIsLoadingHierarchy(false);
      }
    };
    fetchHierarchy();
  }, []);

  // Auto-lock and populate dropdowns based on user scope
  useEffect(() => {
    if (scope?.stateId) setSelectedState(scope.stateId);
    if (scope?.regionId) setSelectedRegion(scope.regionId);
    if (scope?.groupId) setSelectedGroup(scope.groupId);
    if (scope?.districtId) setSelectedDistrict(scope.districtId);
    if (scope?.locationId) setSelectedLocation(scope.locationId);
  }, [scope]);

  // Computed: Does the user have a fixed location? (Location Pastor)
  const hasFixedLocation = !!scope?.locationId;

  // Gender options based on category
  const genderOptions = useMemo(() => {
    if (!category) return [];
    return GENDER_OPTIONS[category] || [];
  }, [category]);

  // Filtered hierarchy options
  const filteredRegions = useMemo(() => 
    hierarchyData?.regions.filter(r => r.stateId === selectedState) || [], 
  [hierarchyData, selectedState]);

  const filteredGroups = useMemo(() => 
    hierarchyData?.groups.filter(g => g.regionId === selectedRegion) || [], 
  [hierarchyData, selectedRegion]);

  const filteredDistricts = useMemo(() => 
    hierarchyData?.districts.filter(d => d.groupId === selectedGroup) || [], 
  [hierarchyData, selectedGroup]);

  const filteredLocations = useMemo(() => 
    hierarchyData?.locations.filter(l => l.districtId === selectedDistrict) || [], 
  [hierarchyData, selectedDistrict]);

  // Reset children when parent changes
  const handleStateChange = (val: string) => { setSelectedState(val); setSelectedRegion(''); setSelectedGroup(''); setSelectedDistrict(''); setSelectedLocation(''); };
  const handleRegionChange = (val: string) => { setSelectedRegion(val); setSelectedGroup(''); setSelectedDistrict(''); setSelectedLocation(''); };
  const handleGroupChange = (val: string) => { setSelectedGroup(val); setSelectedDistrict(''); setSelectedLocation(''); };
  const handleDistrictChange = (val: string) => { setSelectedDistrict(val); setSelectedLocation(''); };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setGender('');
    setErrors((prev) => ({ ...prev, gender: '', category: '' }));
  };

  // Validate form
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required';
    if (!category) errs.category = 'Please select a category';
    if (!gender) errs.gender = 'Please select a gender option';
    
    // If user doesn't have a fixed location, require them to select one
    if (!hasFixedLocation && !selectedLocation) {
      errs.location = 'Please select a location';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validate()) return;

    setSubmitting(true);
    try {
      const res = await createMember({
        fullName: fullName.trim(),
        category,
        gender,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        dateJoined,
        // If they have a fixed location, backend uses ctx.scope.locationId. 
        // Otherwise, we send the selected one from the dropdown!
        locationId: hasFixedLocation ? undefined : selectedLocation,
      });

      if (res.success && res.data) {
        setCreatedMember({
          id: res.data.id,
          cardNumber: res.data.cardNumber,
          fullName: res.data.fullName,
          category: res.data.category,
          gender: res.data.gender || '',
        });
        toast.success('Member registered successfully!');
        // Reset form (but keep hierarchy selection for faster bulk entry)
        setFullName('');
        setCategory('');
        setGender('');
        setPhone('');
        setAddress('');
        setErrors({});
      } else {
        toast.error(res.error || 'Failed to register member');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Download QR as PNG
  const downloadQR = () => {
    if (!createdMember) return;
    const svg = document.getElementById('member-qr-code');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 400; canvas.height = 400; if (!ctx) return;
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20, 360, 360);
      ctx.fillStyle = 'black'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
      ctx.fillText(createdMember.cardNumber, canvas.width / 2, canvas.height - 10);
      const link = document.createElement('a'); link.download = `QR-${createdMember.cardNumber}.png`; link.href = canvas.toDataURL('image/png'); link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const copyCardNumber = () => {
    if (!createdMember) return;
    navigator.clipboard.writeText(createdMember.cardNumber);
    toast.success('Card number copied to clipboard');
  };

  // Helper to render a Select dropdown
    // Helper to render a Select dropdown
  const renderHierarchySelect = (
    id: string,
    label: string,
    value: string,
    onChange: (val: string) => void,
    options: HierarchyItem[],
    placeholder: string,
    isLocked: boolean,
    lockedName?: string | null,
    Icon: React.ElementType = LayoutDashboard // ✅ PRODUCTION FIX: Default assignment resolves TS1016
  ) => {
    // Don't render if locked but we don't have a name to show
    if (isLocked && !lockedName) return null;

    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
          {/* ✅ Capital 'I' resolves TS2339 (Intrinsic Elements error) */}
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          {label}
        </Label>
        <Select value={value} onValueChange={onChange} disabled={isLocked || isLoadingHierarchy}>
          <SelectTrigger className={cn(
            'h-11 rounded-xl bg-secondary/50 border-0 text-sm',
            isLocked && 'opacity-70 cursor-not-allowed',
            errors.location && !isLocked && 'ring-2 ring-red-300'
          )}>
            <SelectValue placeholder={isLocked ? lockedName : placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-16">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-foreground">Register Member</h2>
        <p className="text-sm text-muted-foreground">Add a new member to the congregation</p>
      </div>

      {/* ===== AUTO-ASSIGNED INFO (ONLY FOR LOCATION PASTORS) ===== */}
      {hasFixedLocation && user.scopeNames?.locationName && (
        <Card className="border-church-green/20 bg-church-green/5">
          <CardContent className="p-3 flex items-center gap-3">
            <MapPin className="w-4 h-4 text-church-green flex-shrink-0" />
            <p className="text-xs text-foreground/80">
              <span className="font-semibold">Auto-assigned to:</span>{' '}
              {user.scopeNames.locationName}
              {user.scopeNames.districtName && ` — ${user.scopeNames.districtName}`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ===== HIERARCHY SCOPING DROPDOWNS ===== */}
      {!hasFixedLocation && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-church-green" />
              <h3 className="text-sm font-bold text-foreground">Assign to Hierarchy</h3>
            </div>
            
            {isLoadingHierarchy ? (
              <div className="text-sm text-muted-foreground animate-pulse">Loading structure...</div>
            ) : (
              <>
                                {/* STATE DROPDOWN */}
                {renderHierarchySelect(
                  'state', 'State', selectedState, handleStateChange,
                  hierarchyData?.states || [], 'Select State',
                  !!scope?.stateId, user.scopeNames?.stateName, Building2
                )}

                {/* REGION DROPDOWN (Show if State is selected/locked) */}
                {selectedState && renderHierarchySelect(
                  'region', 'Region', selectedRegion, handleRegionChange,
                  filteredRegions, 'Select Region',
                  !!scope?.regionId, user.scopeNames?.regionName, Network
                )}

                {/* GROUP DROPDOWN (Show if Region is selected/locked) */}
                {selectedRegion && renderHierarchySelect(
                  'group', 'Group', selectedGroup, handleGroupChange,
                  filteredGroups, 'Select Group',
                  !!scope?.groupId, user.scopeNames?.groupName, Layers
                )}

                {/* DISTRICT DROPDOWN (Show if Group is selected/locked) */}
                {selectedGroup && renderHierarchySelect(
                  'district', 'District', selectedDistrict, handleDistrictChange,
                  filteredDistricts, 'Select District',
                  !!scope?.districtId, user.scopeNames?.districtName, GitBranch
                )}

                {/* LOCATION DROPDOWN (Show if District is selected/locked) */}
                {selectedDistrict && renderHierarchySelect(
                  'location', 'Location *', selectedLocation, setSelectedLocation,
                  filteredLocations, 'Select Location',
                  false, null, MapPinned // Location is never locked unless it's hasFixedLocation
                )}

                {errors.location && (
                  <p className="text-xs text-red-500">{errors.location}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== REGISTRATION FORM ===== */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 md:p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName" className="text-sm font-medium text-foreground">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  placeholder="Enter member's full name"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setErrors((prev) => ({ ...prev, fullName: '' })); }}
                  className={cn('h-11 pl-9 pr-3 rounded-xl bg-secondary/50 border-0 text-sm focus-visible:ring-2 focus-visible:ring-church-green/30', errors.fullName && 'ring-2 ring-red-300')}
                />
              </div>
              {errors.fullName && <p className="text-xs text-red-500 mt-0.5">{errors.fullName}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground">Category <span className="text-red-500">*</span></Label>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger className={cn('h-11 rounded-xl bg-secondary/50 border-0 text-sm', errors.category && 'ring-2 ring-red-300')}>
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Select category" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Adult">Adult</SelectItem>
                  <SelectItem value="Youth">Youth</SelectItem>
                  <SelectItem value="Children">Children</SelectItem>
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-red-500 mt-0.5">{errors.category}</p>}
            </div>

            {category && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-foreground">
                  Gender <span className="text-red-500">*</span>
                  <span className="text-muted-foreground font-normal ml-2">({category === 'Adult' ? 'Male / Female' : 'Boys / Girls'})</span>
                </Label>
                <Select value={gender} onValueChange={(v) => { setGender(v); setErrors((prev) => ({ ...prev, gender: '' })); }}>
                  <SelectTrigger className={cn('h-11 rounded-xl bg-secondary/50 border-0 text-sm', errors.gender && 'ring-2 ring-red-300')}>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <SelectValue placeholder={`Select ${category === 'Adult' ? 'gender' : 'gender'}`} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {genderOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.gender && <p className="text-xs text-red-500 mt-0.5">{errors.gender}</p>}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone" className="text-sm font-medium text-foreground">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="phone" type="tel" placeholder="e.g. 08012345678" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 pl-9 pr-3 rounded-xl bg-secondary/50 border-0 text-sm focus-visible:ring-2 focus-visible:ring-church-green/30" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address" className="text-sm font-medium text-foreground">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <textarea id="address" placeholder="Enter residential address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full h-20 pl-9 pr-3 py-2.5 rounded-xl bg-secondary/50 border-0 text-sm focus-visible:ring-2 focus-visible:ring-church-green/30 resize-none outline-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateJoined" className="text-sm font-medium text-foreground">Date Joined</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="dateJoined" type="date" value={dateJoined} disabled className="h-11 pl-9 pr-3 rounded-xl bg-secondary/50 border-0 text-sm" />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting || (!hasFixedLocation && !selectedLocation)}
              className="h-12 rounded-xl bg-church-green hover:bg-church-green-light text-white font-semibold text-sm shadow-lg shadow-church-green/20 transition-all active:scale-[0.98] w-full gap-2 mt-2"
            >
              {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Registering...</>) : (<><UserPlus className="w-4 h-4" /> Register Member</>)}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ===== SUCCESS DIALOG WITH QR CODE ===== */}
      {/* (Left exactly as you had it, no changes needed here) */}
      <Dialog open={!!createdMember} onOpenChange={(open) => !open && setCreatedMember(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          {createdMember && (
            <>
              <div className="bg-gradient-to-br from-church-green to-church-green-light p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-white text-lg font-bold">Member Registered!</h3>
                <p className="text-green-100 text-sm mt-1">{createdMember.fullName}</p>
              </div>
              <div className="p-6 flex flex-col items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Card Number</p>
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-lg font-bold font-mono text-foreground">{createdMember.cardNumber}</p>
                    <button onClick={copyCardNumber} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors" aria-label="Copy card number">
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm border">
                  <div id="member-qr-code">
                    <QRCodeSVG value={createdMember.cardNumber} size={200} level="H" includeMargin={false} fgColor="#000000" bgColor="#ffffff" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-church-green/10 text-church-green">{createdMember.category}</span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-church-gold/10 text-church-gold">{createdMember.gender}</span>
                </div>
                <div className="flex gap-2 w-full mt-2">
                  <Button onClick={downloadQR} variant="outline" className="flex-1 h-11 rounded-xl text-sm font-medium gap-2"><Download className="w-4 h-4" /> Download QR</Button>
                  <Button onClick={() => setCreatedMember(null)} className="flex-1 h-11 rounded-xl bg-church-green hover:bg-church-green-light text-white font-medium text-sm">Register Another</Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-1">QR code contains the member&apos;s card number for attendance scanning</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';

export interface ServiceOption {
  id: string;
  name: string;
  dayOfWeek: number;
}

export interface HierarchyPayload {
  stateId?: string;      // Added '?'
  regionId?: string;     // Added '?'
  groupId?: string;      // Added '?'
  districtId?: string;   // Added '?'
  locationId?: string;   // Added '?'
}

export function useSystemData() {
  const user = useAppStore((s) => s.user);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

        const fetchData = async () => { 
      try {
      
        const res = await apiFetch<{ serviceTypes: ServiceOption[] }>('/api/settings');
        
        if (res && res.serviceTypes) {
          setServices(res.serviceTypes);
        }
      } catch (error) {
        console.error("Failed to fetch system settings");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // ✅ CRITICAL FIX: Ensures Prisma never receives empty strings for hierarchy
      const getHierarchyPayload = (): HierarchyPayload => {
    return {
      stateId: user?.scope?.stateId || undefined,    // Changed '' to undefined
      regionId: user?.scope?.regionId || undefined,  // Changed '' to undefined
      groupId: user?.scope?.groupId || undefined,    // Changed '' to undefined
      districtId: user?.scope?.districtId || undefined, 
      locationId: user?.scope?.locationId || undefined, 
    };
  };
  return { services, loading, getHierarchyPayload };
}
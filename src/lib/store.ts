import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SystemRole, AuthenticatedUserScope, AppRoute } from './rbac';
import { ROLE_LABELS, getRoleCategory, canAccessRoute } from './rbac';
import { apiFetch } from '@/lib/api';



export type AppPage =
  | 'landing'
  | 'login'
  | 'dashboard'
  | 'members'
  | 'hierarchy'
  | 'register-member'
  | 'qr-management'
  | 'scanner'
  | 'newcomer-entry'
  | 'newcomer-records'
  | 'attendance-history'
  | 'reports'
  | 'engagement-alerts'
  | 'messaging'
  | 'audit-logs'
  | 'user-management'
  | 'settings'
  | 'more';

export type MobileTab = 'dashboard' | 'members' | 'attendance' | 'reports' | 'more';

interface ScopeNames {
  stateName: string | null;
  regionName: string | null;
  groupName: string | null;
  districtName: string | null;
  locationName: string | null;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
  roleCategory: 'admin' | 'pastor';
  roleLabel: string;
  scope: AuthenticatedUserScope; // ✅ Changed from UserScope
  scopeNames: ScopeNames;
  status: string;
  avatar?: string;
}

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  currentPage: AppPage;
  activeMobileTab: MobileTab;
  sidebarOpen: boolean;

  login: (email: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => void;
  setPage: (page: AppPage) => void;
  setMobileTab: (tab: MobileTab) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  hasRouteAccess: (route: AppRoute) => boolean;
}

function getDashboardPage(role: SystemRole): AppPage {
  return 'dashboard';
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      currentPage: 'landing',
      activeMobileTab: 'dashboard',
      sidebarOpen: true,
      login: async (email: string, password: string) => {
        if (!email || !password) {
          return { success: false, error: 'Please enter email and password' };
        }

        try {
          // Call login API
          const data: any = await apiFetch('/api/auth', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          });

          // If no data returned, it failed
          if (!data || !data.token || !data.user) {
            return { success: false, error: 'Invalid email or password' };
          }

          // Save token to localStorage
          localStorage.setItem('token', data.token);

          const authUser = data.user;
          const role = authUser.role as SystemRole;
          
          const user: User = {
            id: authUser.id,
            email: authUser.email,
            name: authUser.name,
            role,
            roleCategory: getRoleCategory(role),
            roleLabel: ROLE_LABELS[role],
            scope: authUser.scope,
            scopeNames: {
              stateName: authUser.stateName || null,
              regionName: authUser.regionName || null,
              groupName: authUser.groupName || null,
              districtName: authUser.districtName || null,
              locationName: authUser.locationName || null,
            },
            status: authUser.status || 'active',
          };

          const currentPage = getDashboardPage(role);

          set({
            user,
            isAuthenticated: true,
            currentPage,
            activeMobileTab: 'dashboard',
            sidebarOpen: true,
          });

          return { success: true, user };
        } catch (error: any) {
          // Catch errors thrown by apiFetch (like 401s)
          const msg = error?.message || 'Connection error. Please try again.';
          return { success: false, error: msg };
        }
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          currentPage: 'landing',
          activeMobileTab: 'dashboard',
          sidebarOpen: false,
        });
      },

      setPage: (page: AppPage) => {
        set({ currentPage: page });

        // Sync mobile tab
        const tabMap: Record<string, MobileTab> = {
          'dashboard': 'dashboard',
          members: 'members',
          hierarchy: 'members',
          'register-member': 'members',
          'qr-management': 'attendance',
          scanner: 'attendance',
          'newcomer-entry': 'attendance',
          'attendance-history': 'attendance',
          'newcomer-records': 'attendance',
          reports: 'reports',
          'engagement-alerts': 'reports',
          messaging: 'more',
          'audit-logs': 'more',
          'user-management': 'more',
          settings: 'more',
          more: 'more',
        };
        const mapped = tabMap[page];
        if (mapped) {
          set({ activeMobileTab: mapped });
        }
      },

      setMobileTab: (tab: MobileTab) => {
        const state = get();
        if (state.user) {
          const role = state.user.role;
                   let page: AppPage = 'dashboard';

          if (tab === 'dashboard') {
            page = getDashboardPage(role);
          } else if (tab === 'members') {
            page = 'members';
          } else if (tab === 'attendance') {
            page = 'attendance-history';
          } else if (tab === 'reports') {
            page = 'reports';
          } else if (tab === 'more') {
            page = 'more';
          }

          set({ activeMobileTab: tab, currentPage: page });
        }
      },

      setSidebarOpen: (open: boolean) => {
        set({ sidebarOpen: open });
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      hasRouteAccess: (route: AppRoute) => {
        const state = get();
        if (!state.user) return false;
        return canAccessRoute(state.user.role, route);
      },
    }),
    {
      name: 'dlbc-app-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

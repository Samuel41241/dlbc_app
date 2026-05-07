'use client';

import { useAppStore, type AppPage } from '@/lib/store';
import { getSidebarSections, type SystemRole, ROLE_LABELS, getRoleCategory } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  BarChart3,
  Settings,
  Bell,
  MessageSquare,
  Building2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Church,
  LogOut,
  QrCode,
  ScanLine,
  UserPlus,
  History,
  UserCog,
  AlertTriangle,
  Network,
  UserPlusIcon,
  ScrollText,
  UserRoundPlus,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

// Map page keys to icons
const pageIconMap: Record<string, React.ElementType> = {
  'admin-dashboard': LayoutDashboard,
  'pastoral-dashboard': LayoutDashboard,
  hierarchy: Network,
  members: Users,
  'register-member': UserPlusIcon,
  'qr-management': QrCode,
  scanner: ScanLine,
  'newcomer-entry': UserPlus,
  'newcomer-records': UserRoundPlus,
  'attendance-history': History,
  reports: BarChart3,
  'engagement-alerts': AlertTriangle,
  messaging: MessageSquare,
  'user-management': UserCog,
  'audit-logs': ScrollText,
  settings: Settings,
};

// Map pages to badges (production — no static counts)
// Badges are populated from API data when available
const pageBadgeMap: Record<string, string> = {
  // Badges removed for production — fetch from API if needed
};

interface SidebarItem {
  page: AppPage;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}
function buildSections(role: SystemRole): SidebarSection[] {
  const rbacSections = getSidebarSections(role);

  // Define roles that DO NOT have a physical church building (Managers)
  const managerRoles = [
    'super_admin', 
    'state_admin', 'state_pastor', 
    'region_admin', 'region_pastor', 
    'group_admin', 'group_pastor'
  ];
  
  const isManager = managerRoles.includes(role);

  return rbacSections.map((section) => ({
    title: section.title,
    items: section.items
      .filter((item) => {
        // 1. Hierarchy: Super Admin only
        const structureCreatorRoles = ['super_admin', 'state_admin', 'region_admin', 'group_admin', 'district_admin'];
        if (item.page === 'hierarchy' && !structureCreatorRoles.includes(role)) return false;

        // 2. Congregation Modules: Hidden from Managers (State, Region, Group)
        const congregationPages = [
          'members', 
          'register-member', 
          'qr-management', 
          'scanner',
          'newcomer-entry',
          'newcomer-records',
          'attendance-history'
        ];
        if (isManager && congregationPages.includes(item.page)) return false;

        return true;
      })
      .map((item) => ({
        page: item.page,
        label: item.label,
        icon: pageIconMap[item.page] || LayoutDashboard,
        badge: pageBadgeMap[item.page],
      })),
  })).filter(section => section.items.length > 0);
}

export function SidebarContent({ onSelect }: { onSelect?: () => void }) {
  const { user, currentPage, setPage, logout } = useAppStore();
  const role = user?.role || ('super_admin' as SystemRole);
  const sections = buildSections(role);
  const roleCategory = getRoleCategory(role);
  const scopeLabel = user?.scopeNames?.locationName
    || user?.scopeNames?.districtName
    || user?.scopeNames?.groupName
    || user?.scopeNames?.regionName
    || user?.scopeNames?.stateName
    || '';

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-sidebar-accent flex items-center justify-center flex-shrink-0">
          <Church className="w-5 h-5 text-church-gold" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-sidebar-foreground truncate">DLBC Attendance</h2>
          <Badge
            variant="secondary"
            className="text-[9px] bg-church-gold/20 text-church-gold border-0 mt-0.5"
          >
            {roleCategory === 'admin' ? (
              <span className="flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" />
                {ROLE_LABELS[role]}
              </span>
            ) : (
              ROLE_LABELS[role]
            )}
          </Badge>
          {scopeLabel && (
            <p className="text-[9px] text-sidebar-foreground/50 truncate mt-0.5">{scopeLabel}</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <div className="px-3 flex flex-col gap-5">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50">
                {section.title}
              </h3>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const isActive = currentPage === item.page;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.page}
                      onClick={() => {
                        setPage(item.page);
                        onSelect?.();
                      }}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full text-left',
                        'hover:bg-sidebar-accent',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm'
                          : 'text-sidebar-foreground/70'
                      )}
                    >
                      <Icon
                        className={cn(
                          'w-4.5 h-4.5 flex-shrink-0',
                          isActive ? 'text-church-gold' : ''
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                            isActive
                              ? 'bg-church-gold/20 text-church-gold'
                              : 'bg-sidebar-foreground/10 text-sidebar-foreground/50'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col fixed left-0 top-14 bottom-0 z-30 bg-sidebar text-sidebar-foreground transition-all duration-300 border-r border-sidebar-border',
        sidebarOpen ? 'w-64' : 'w-[68px]'
      )}
    >
      <SidebarContent />
      {/* Toggle button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute -right-3 top-6 w-6 h-6 bg-sidebar border border-sidebar-border rounded-full flex items-center justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground shadow-sm"
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>
    </aside>
  );
}

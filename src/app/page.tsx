'use client';

import { useSyncExternalStore } from 'react';
import { useAppStore } from '@/lib/store';
import { canAccessRoute } from '@/lib/rbac';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import Dashboard from '@/pages/Dashboard'; // ✅ FIXED: Single clean import
import PlaceholderPage from '@/pages/PlaceholderPage';
import AuditLogsPage from '@/pages/AuditLogsPage';
import NewcomerRecordsPage from '@/pages/NewcomerRecordsPage';
import UserManagementPage from '@/pages/UserManagementPage';
import MembersPage from '@/pages/MembersPage';
import RegisterMemberPage from '@/pages/RegisterMemberPage';
import AttendanceHistoryPage from '@/pages/AttendanceHistoryPage';
import ChurchHierarchyPage from '@/pages/ChurchHierarchyPage';
import QRManagementPage from '@/pages/QRManagementPage';
import AttendanceScannerPage from '@/pages/AttendanceScannerPage';
import NewcomerEntryPage from '@/pages/NewcomerEntryPage';
import EngagementAlertsPage from '@/pages/EngagementAlertsPage';
import ReportsPage from '@/pages/ReportsPage';
import MessagingPage from '@/pages/MessagingPage';
import SettingsPage from '@/pages/SettingsPage';

import { AppHeader, MobileSidebar } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { DesktopSidebar } from '@/components/layout/SidebarContent';
import { AppFooter } from '@/components/layout/Footer';
import { cn } from '@/lib/utils';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const currentPage = useAppStore((s) => s.currentPage);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const user = useAppStore((s) => s.user);
  const setPage = useAppStore((s) => s.setPage);
  const hasRouteAccess = useAppStore((s) => s.hasRouteAccess);

  // Handle hydration for Zustand persist
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-church-green/20 border-t-church-green rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Landing page — public, no auth needed
  if (currentPage === 'landing') {
    return <LandingPage />;
  }

  // Login page — public, no auth needed
  if (currentPage === 'login') {
    return <LoginPage />;
  }

  // Protected pages — must be authenticated
  if (!isAuthenticated || !user) {
    return <LandingPage />;
  }

  // ---- RBAC ROUTE PROTECTION ----
  if (!hasRouteAccess(currentPage as Parameters<typeof canAccessRoute>[1])) {
    // ✅ FIXED: Unified dashboard redirect
    const dashboardPage = 'dashboard';

    return (
      <div className="min-h-screen flex flex-col bg-background">
        <AppHeader />
        <MobileSidebar />
        <DesktopSidebar />
        <main className={cn('flex-1 flex flex-col transition-all duration-300', 'md:ml-[68px]', sidebarOpen && 'md:ml-64')}>
          <div className="p-4 md:p-6 max-w-4xl mx-auto w-full flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                You do not have permission to access this page. Your role ({user.roleLabel}) does not have access to this section.
              </p>
              <Button
                onClick={() => setPage(dashboardPage)}
                className="bg-church-green hover:bg-church-green-light text-white font-semibold"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
          <AppFooter />
        </main>
        <BottomNav />
      </div>
    );
  }

  // Render current page content
  const renderPage = () => {
    switch (currentPage) {
      // ✅ FIXED: Unified dashboard case
      case 'dashboard':
        return <Dashboard />;
        
      case 'messaging':
        return <MessagingPage />;
        
      case 'reports':
        return <ReportsPage />;
        
      case 'engagement-alerts':
        return <EngagementAlertsPage />;
        
      case 'newcomer-entry':
        return <NewcomerEntryPage />;
        
      case 'scanner':
        return <AttendanceScannerPage />;
        
      case 'qr-management':
        return <QRManagementPage />;
        
      case 'audit-logs':
        return <AuditLogsPage />;
        
      case 'newcomer-records':
        return <NewcomerRecordsPage />;
        
      case 'user-management':
        return <UserManagementPage />;
        
      case 'members':
        return <MembersPage />;
        
      case 'register-member':
        return <RegisterMemberPage />;
        
      case 'attendance-history':
        return <AttendanceHistoryPage />;

      case 'hierarchy':
        return <ChurchHierarchyPage />;

      case 'settings':
        return <SettingsPage />;

      // All other pages use the placeholder with their page key
      default:
        return <PlaceholderPage page={currentPage} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <AppHeader />

      {/* Mobile Sidebar (Sheet) */}
      <MobileSidebar />

      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 flex flex-col transition-all duration-300',
          'md:ml-[68px]',
          sidebarOpen && 'md:ml-64'
        )}
      >
        <div className="p-4 md:p-6 max-w-4xl mx-auto w-full flex-1">
          {renderPage()}
        </div>

        {/* Footer */}
        <AppFooter />
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
}
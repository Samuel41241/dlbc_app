'use client';

import { useAppStore, type AppPage, type MobileTab } from '@/lib/store';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  BarChart3,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems: { tab: MobileTab; label: string; icon: React.ElementType }[] = [
  { tab: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { tab: 'members', label: 'Members', icon: Users },
  { tab: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { tab: 'reports', label: 'Reports', icon: BarChart3 },
  { tab: 'more', label: 'More', icon: MoreHorizontal },
];

export function BottomNav() {
  const activeMobileTab = useAppStore((s) => s.activeMobileTab);
  const setMobileTab = useAppStore((s) => s.setMobileTab);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)] safe-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive = activeMobileTab === item.tab;
          const Icon = item.icon;

          return (
            <button
              key={item.tab}
              onClick={() => setMobileTab(item.tab)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-h-[44px] transition-all duration-200 relative',
                isActive ? 'text-church-green' : 'text-muted-foreground'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-church-green rounded-full" />
              )}
              <div
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200',
                  isActive && 'bg-church-green/10'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive && 'text-church-green')} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium leading-tight',
                  isActive ? 'text-church-green' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

'use client';

import { useAppStore } from '@/lib/store';
import { ROLE_LABELS, getRoleCategory } from '@/lib/rbac';
import { Menu, LogOut, Shield, ChevronDown, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import { SidebarContent } from './SidebarContent';
import { cn } from '@/lib/utils';


const CHURCH_LOGO_URL =
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgxQP5QFGDt71jtRoYFCnj5rmTELYafcAieMQC4lCW4f61iVMZLk7r8HBBoRWWsBnzr57_Jlw8XBQRUQjWhMqT9LXRk4jPFQePuD78hzSptly72_Y1AqJ929EcLYp-3Ao2M8UQXNocsDJU/w1200-h630-p-k-no-nu/kisspng-deeper-life-bible-church-jacksonville-florida-de-prevailing-power-through-the-ministry-of-the-word-5babe32c1e8418.357141171537991468125.jpg';

export function AppHeader() {
  const { user, logout, toggleSidebar } = useAppStore();

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
    : 'U';

  const roleLabel = user ? ROLE_LABELS[user.role] : '';
  const isAdmin = user ? getRoleCategory(user.role) === 'admin' : false;
  const scopeLabel = user?.scopeNames?.locationName
    || user?.scopeNames?.districtName
    || user?.scopeNames?.groupName
    || user?.scopeNames?.regionName
    || user?.scopeNames?.stateName
    || (user?.scope?.stateId || user?.scope?.locationId ? 'Assigned Scope' : '');

  return (
    <header className="sticky top-0 z-40 bg-church-green text-white shadow-md safe-top">
      <div className="flex items-center justify-between h-14 px-3 md:px-5">
        {/* Left: Logo + Church Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile menu button */}
          <button
            onClick={toggleSidebar}
            className="md:hidden flex items-center justify-center w-10 h-10 -ml-1 rounded-lg hover:bg-white/10 transition-colors active:scale-95"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <img
            src={CHURCH_LOGO_URL}
            alt="DLBC Logo"
            className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border-2 border-church-gold/50"
          />

          <div className="min-w-0 hidden sm:block">
            <h1 className="text-sm font-bold leading-tight truncate">Deeper Life Bible Church</h1>
            <p className="text-[10px] text-green-200 leading-tight truncate">Attendance Intelligence</p>
          </div>
          <div className="min-w-0 sm:hidden">
            <h1 className="text-sm font-bold leading-tight truncate">DLBC</h1>
          </div>
        </div>

        {/* Right: User Info + Actions */}
        <div className="flex items-center gap-2">
          {/* User info - visible on tablet and up */}
          <div className="hidden md:flex items-center gap-2">
            {scopeLabel && scopeLabel !== 'All (Full Access)' && (
              <Badge
                variant="secondary"
                className="bg-white/10 text-green-100 text-[10px] font-medium px-2 py-0.5 border-0 hidden lg:flex items-center gap-1"
              >
                <MapPin className="w-2.5 h-2.5" />
                <span className="max-w-[120px] truncate">{scopeLabel}</span>
              </Badge>
            )}
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px] font-bold px-2 py-0.5 hover:opacity-90 border-0',
                isAdmin
                  ? 'bg-church-gold text-church-green'
                  : 'bg-white/20 text-white'
              )}
            >
              {isAdmin && <Shield className="w-3 h-3 mr-0.5" />}
              {roleLabel}
            </Badge>
            <span className="text-xs text-green-200 truncate max-w-[180px]">{user?.email}</span>
          </div>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-white/10 transition-colors">
                <Avatar className="w-8 h-8 border-2 border-church-gold/50">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="w-3.5 h-3.5 text-green-200 hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] font-bold px-1.5 py-0 border-0',
                        isAdmin
                          ? 'bg-church-green/10 text-church-green'
                          : 'bg-amber-100 text-amber-700'
                      )}
                    >
                      {isAdmin && <Shield className="w-2.5 h-2.5 mr-0.5" />}
                      {roleLabel}
                    </Badge>
                    {scopeLabel && scopeLabel !== 'All (Full Access)' && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        <span className="max-w-[160px] truncate">{scopeLabel}</span>
                      </span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function MobileSidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetTrigger asChild>
        <div className="sr-only" />
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SidebarContent onSelect={() => setSidebarOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}



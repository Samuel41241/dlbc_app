'use client';

import { useAppStore, type AppPage } from '@/lib/store';
import {
  Users,
  ClipboardCheck,
  BarChart3,
  MoreHorizontal,
  Construction,
  Network,
  UserPlusIcon,
  QrCode,
  ScanLine,
  UserPlus,
  History,
  MessageSquare,
  UserCog,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PageInfo {
  title: string;
  description: string;
  icon: React.ElementType;
  features: string[];
}

const pageConfig: Record<string, PageInfo> = {
  members: {
    title: 'Members',
    description: 'View and manage church members, their profiles, and membership status.',
    icon: Users,
    features: ['Member directory with search & filters', 'Profile details and history', 'Membership categories', 'Contact information'],
  },
  hierarchy: {
    title: 'Church Hierarchy',
    description: 'View and manage the organizational structure of the church.',
    icon: Network,
    features: ['Zonal and district structure', 'Leadership hierarchy', 'Unit and department organization', 'Role-based access levels'],
  },
  'register-member': {
    title: 'Register Member',
    description: 'Add new members to the church database with their details.',
    icon: UserPlusIcon,
    features: ['New member registration form', 'Auto-generate member ID', 'Assign to zone/district/unit', 'QR card generation'],
  },
  'qr-management': {
    title: 'QR Card Management',
    description: 'Generate and manage QR attendance cards for all members.',
    icon: QrCode,
    features: ['Bulk QR card generation', 'Print-ready card layouts', 'Replace lost/damaged cards', 'Card status tracking'],
  },
  scanner: {
    title: 'Attendance Scanner',
    description: 'Scan QR codes to mark member attendance in real time.',
    icon: ScanLine,
    features: ['Camera-based QR scanning', 'Manual search fallback', 'Service type selection', 'Instant attendance confirmation'],
  },
  'newcomer-entry': {
    title: 'Newcomer Entry',
    description: 'Register first-time visitors and newcomers to the church.',
    icon: UserPlus,
    features: ['Quick newcomer registration', 'Capture visit details', 'Auto-assign follow-up', 'Newcomer welcome workflow'],
  },
  'attendance-history': {
    title: 'Attendance History',
    description: 'View historical attendance records across all services and events.',
    icon: History,
    features: ['Date-range attendance search', 'Service-wise breakdown', 'Individual member history', 'Export to CSV/PDF'],
  },
  reports: {
    title: 'Reports',
    description: 'Generate and view detailed reports on church activities and attendance.',
    icon: BarChart3,
    features: ['Weekly/monthly attendance reports', 'Growth analytics', 'Newcomer tracking', 'Service comparison charts'],
  },
  'engagement-alerts': {
    title: 'Engagement & Alerts',
    description: 'Monitor member engagement and manage alert categories.',
    icon: AlertTriangle,
    features: ['Needs attention — absent 3+ weeks', 'Follow-up required — uncontacted newcomers', 'Pastoral attention — care flags', 'Custom alert configuration'],
  },
  messaging: {
    title: 'Messaging',
    description: 'Send messages and communications to members and groups.',
    icon: MessageSquare,
    features: ['Bulk SMS and notifications', 'Group-based messaging', 'Message templates', 'Delivery tracking'],
  },
  'user-management': {
    title: 'User Management',
    description: 'Manage system users, roles, and access permissions.',
    icon: UserCog,
    features: ['Create and manage user accounts', 'Role assignment (Admin, Pastor)', 'Permission controls', 'Activity audit logs'],
  },
  settings: {
    title: 'Settings',
    description: 'Configure system settings, preferences, and integrations.',
    icon: Settings,
    features: ['Church profile configuration', 'Service types and schedules', 'Notification preferences', 'System integration settings'],
  },
  more: {
    title: 'More',
    description: 'Access additional features and system settings.',
    icon: MoreHorizontal,
    features: ['Notifications center', 'Quick links', 'Help & support', 'About the system'],
  },
};

export default function PlaceholderPage({ page }: { page: string }) {
  const pageInfo = pageConfig[page] || pageConfig.more;
  const Icon = pageInfo.icon;

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-foreground">{pageInfo.title}</h2>
        <p className="text-sm text-muted-foreground">{pageInfo.description}</p>
      </div>

      {/* Coming Soon Card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-church-green to-church-green-light p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
              <Construction className="w-8 h-8 text-church-gold" />
            </div>
            <h3 className="text-white text-lg font-bold">Coming Soon</h3>
            <p className="text-green-100 text-sm mt-2 max-w-xs">
              This section is under active development. Check back soon for updates.
            </p>
          </div>
          <div className="p-5">
            <h4 className="text-sm font-semibold text-foreground mb-3">Planned Features</h4>
            <div className="flex flex-col gap-2.5">
              {pageInfo.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-church-green flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

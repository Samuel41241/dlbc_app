'use client';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Church,
  ScanLine,
  UserSearch,
  TrendingUp,
  BarChart3,
  Eye,
  MapPin,
  ArrowRight,
  Shield,
  Users,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

const CHURCH_HERO_URL = 'https://dailypost.ng/wp-content/uploads/2025/07/Deeper-life-1200x703.jpeg';
const CHURCH_LOGO_URL =
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgxQP5QFGDt71jtRoYFCnj5rmTELYafcAieMQC4lCW4f61iVMZLk7r8HBBoRWWsBnzr57_Jlw8XBQRUQjWhMqT9LXRk4jPFQePuD78hzSptly72_Y1AqJ929EcLYp-3Ao2M8UQXNocsDJU/w1200-h630-p-k-no-nu/kisspng-deeper-life-bible-church-jacksonville-florida-de-prevailing-power-through-the-ministry-of-the-word-5babe32c1e8418.357141171537991468125.jpg';

const features = [
  {
    icon: ScanLine,
    title: 'Smart Attendance Capture',
    description: 'QR-based scanning for instant, accurate attendance tracking across all services.',
  },
  {
    icon: UserSearch,
    title: 'Absentee Tracking',
    description: 'Automatically identify and follow up with members who have been absent.',
  },
  {
    icon: TrendingUp,
    title: 'Growth Monitoring',
    description: 'Track membership growth trends, newcomer retention, and congregation health.',
  },
  {
    icon: BarChart3,
    title: 'Leadership Analytics',
    description: 'Equip pastors with data-driven insights for informed ministry decisions.',
  },
  {
    icon: Eye,
    title: 'Engagement Visibility',
    description: 'Monitor member engagement levels, service patterns, and participation rates.',
  },
  {
    icon: MapPin,
    title: 'Multi-Location Support',
    description: 'Manage attendance across multiple church locations from a single platform.',
  },
];

export default function LandingPage() {
  const setPage = useAppStore((s) => s.setPage);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ========== HERO SECTION ========== */}
      <section className="relative overflow-hidden min-h-[520px] md:min-h-[600px] flex items-center safe-top">
        <img
          src={CHURCH_HERO_URL}
          alt="Deeper Life Bible Church"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-church-green via-church-green/95 to-church-green/80" />

        {/* Decorative elements */}
        <div className="absolute top-20 right-10 w-64 h-64 bg-church-gold/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-48 h-48 bg-church-gold/5 rounded-full blur-2xl" />

        <div className="relative z-10 w-full max-w-4xl mx-auto px-5 py-16 md:py-20 flex flex-col items-center text-center">
          <img
            src={CHURCH_LOGO_URL}
            alt="DLBC Logo"
            className="w-20 h-20 rounded-2xl object-cover border-3 border-church-gold/40 shadow-2xl mb-6"
          />
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-5">
            <Church className="w-3.5 h-3.5 text-church-gold" />
            <span className="text-xs text-green-100 font-medium">Deeper Life Bible Church</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4 tracking-tight">
            Church Attendance
            <br />
            <span className="text-church-gold">Intelligence System</span>
          </h1>
          <p className="text-base md:text-lg text-green-100/90 max-w-xl leading-relaxed mb-8">
            More than attendance. A complete platform for engagement, tracking, and church growth intelligence.
          </p>
          <Button
            onClick={() => setPage('login')}
            className="h-12 px-8 bg-church-gold hover:bg-church-gold-dark text-church-green font-bold text-sm rounded-xl shadow-lg shadow-church-gold/25 transition-all active:scale-[0.98] gap-2"
          >
            <Shield className="w-4.5 h-4.5" />
            Access Admin Portal
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* ========== ABOUT SECTION ========== */}
      <section className="py-12 md:py-16 px-5">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-church-green/5 rounded-full px-4 py-1.5 mb-5">
            <CheckCircle2 className="w-3.5 h-3.5 text-church-green" />
            <span className="text-xs text-church-green font-semibold uppercase tracking-wider">
              About the Platform
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-church-green mb-4">
            Built for Church Growth
          </h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            The DLBC Attendance Intelligence System empowers church leadership with real-time data
            to track attendance, monitor member engagement, identify absentees, and make
            data-informed pastoral decisions. Designed for multi-location churches with a focus
            on simplicity and actionable insights.
          </p>
        </div>
      </section>

      {/* ========== FEATURES SECTION ========== */}
      <section className="py-10 md:py-14 px-5 bg-gradient-to-b from-church-green-50/50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Platform Features</h2>
            <p className="text-sm text-muted-foreground">
              Everything your church needs for intelligent attendance management.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className="border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                >
                  <CardContent className="p-5">
                    <div className="w-11 h-11 rounded-xl bg-church-green/10 flex items-center justify-center mb-3.5">
                      <Icon className="w-5 h-5 text-church-green" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-1.5">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========== CTA SECTION ========== */}
      <section className="py-12 md:py-16 px-5">
        <div className="max-w-2xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-church-green to-church-green-light p-8 md:p-10 text-center">
            <div className="absolute top-0 right-0 w-40 h-40 bg-church-gold/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-church-gold/20 flex items-center justify-center mx-auto mb-5">
                <Church className="w-7 h-7 text-church-gold" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-3">
                Ready to Transform Church Engagement?
              </h2>
              <p className="text-sm text-green-100/90 mb-6 max-w-md mx-auto">
                Get started with the DLBC Attendance Intelligence System and unlock the power of data-driven ministry.
              </p>
              <Button
                onClick={() => setPage('login')}
                className="h-12 px-8 bg-church-gold hover:bg-church-gold-dark text-church-green font-bold text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] gap-2"
              >
                Go to Login
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="mt-auto border-t border-border bg-white">
        <div className="flex items-center justify-center h-12 px-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Deeper Life Bible Church. &nbsp;
            Powered by: <span className="text-church-green font-semibold">Xuzentra Technologies Limited</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

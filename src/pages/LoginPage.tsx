'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import {
  ArrowLeft,
  Church,
  Eye,
  EyeOff,
  LogIn,
  Shield,
  UserPlus,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Setup mode state
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupSuccess, setSetupSuccess] = useState(false);

  const login = useAppStore((s) => s.login);
  const setPage = useAppStore((s) => s.setPage);

  // Check if system is initialized
  useEffect(() => {
    apiFetch('/api/setup')
      .then((r: any) => r)
      .then((data) => {
        setIsInitialized(data.initialized !== false);
        if (data.initialized === false) {
          setSetupMode(true);
        }
      })
      .catch(() => {
        setIsInitialized(true); // Assume initialized on error
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    setIsLoading(true);
    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
    setIsLoading(false);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');

    if (!setupName || !setupEmail || !setupPassword) {
      setSetupError('All fields are required');
      return;
    }
    if (setupPassword.length < 8) {
      setSetupError('Password must be at least 8 characters');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setSetupError('Passwords do not match');
      return;
    }

    setSetupLoading(true);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        
        body: JSON.stringify({
          email: setupEmail,
          fullName: setupName,
          password: setupPassword,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setSetupSuccess(true);
        // Auto-login after setup
        setTimeout(async () => {
          const result = await login(setupEmail, setupPassword);
          if (!result.success) {
            setSetupMode(false);
          }
        }, 1500);
      } else {
        setSetupError(data.error || 'Setup failed');
      }
    } catch {
      setSetupError('Connection error. Please try again.');
    }
    setSetupLoading(false);
  };

  // Loading state while checking initialization
  if (isInitialized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-church-green animate-spin" />
      </div>
    );
  }

  // Setup success animation
  if (setupSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-church-green-50 to-background safe-top safe-bottom">
        <div className="w-20 h-20 rounded-full bg-church-green/10 flex items-center justify-center mb-6 animate-in fade-in duration-500">
          <CheckCircle2 className="w-10 h-10 text-church-green" />
        </div>
        <h2 className="text-xl font-bold text-church-green mb-2">System Initialized</h2>
        <p className="text-sm text-muted-foreground text-center">
          Super Admin account created. Signing you in...
        </p>
      </div>
    );
  }

  // Setup mode — create first Super Admin
  if (setupMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-church-green-50 to-background safe-top safe-bottom">
        <button
          onClick={() => setPage('landing')}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-secondary/50"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="w-full max-w-sm flex flex-col items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-2xl bg-church-green flex items-center justify-center shadow-lg">
            <Church className="w-10 h-10 text-church-gold" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold text-church-green leading-tight">
              Deeper Life Bible Church
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-medium tracking-wide uppercase">
              Attendance Intelligence System
            </p>
          </div>
        </div>

        <Card className="w-full max-w-sm border-0 shadow-xl shadow-church-green/10">
          <CardHeader className="pb-4 pt-6 px-6">
            <CardTitle className="text-xl font-semibold text-center flex items-center justify-center gap-2">
              <Shield className="w-5 h-5 text-church-gold" />
              System Setup
            </CardTitle>
            <CardDescription className="text-center text-sm">
              Create the first Super Admin account
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSetup} className="flex flex-col gap-4">
              {setupError && (
                <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl font-medium">
                  {setupError}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setup-name" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="setup-name"
                  type="text"
                  placeholder="Pastor John Doe"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/50 border-0 focus-visible:ring-2 focus-visible:ring-church-green/30 text-sm"
                  autoComplete="name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setup-email" className="text-sm font-medium">Email Address</Label>
                <Input
                  id="setup-email"
                  type="email"
                  placeholder="admin@deeperlife.org"
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/50 border-0 focus-visible:ring-2 focus-visible:ring-church-green/30 text-sm"
                  autoComplete="email"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setup-password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="setup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    className="h-12 rounded-xl bg-secondary/50 border-0 focus-visible:ring-2 focus-visible:ring-church-green/30 pr-12 text-sm"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setup-confirm" className="text-sm font-medium">Confirm Password</Label>
                <Input
                  id="setup-confirm"
                  type="password"
                  placeholder="Re-enter password"
                  value={setupConfirm}
                  onChange={(e) => setSetupConfirm(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/50 border-0 focus-visible:ring-2 focus-visible:ring-church-green/30 text-sm"
                  autoComplete="new-password"
                />
              </div>

              <Button
                type="submit"
                disabled={setupLoading}
                className="h-12 rounded-xl bg-church-green hover:bg-church-green-light text-white font-semibold text-base shadow-lg shadow-church-green/25 transition-all active:scale-[0.98] mt-1"
              >
                {setupLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Account...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Create Super Admin
                  </div>
                )}
              </Button>
            </form>

            <p className="text-[10px] text-muted-foreground text-center mt-4">
              This account will have full system access. You can create additional users later.
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Powered by: Xuzentra Technologies Limited
        </p>
      </div>
    );
  }

  // Normal login
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-church-green-50 to-background safe-top safe-bottom">
      {/* Back to landing */}
      <button
        onClick={() => setPage('landing')}
        className="absolute top-4 left-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-secondary/50"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Back</span>
      </button>

      {/* Logo Section */}
      <div className="w-full max-w-sm flex flex-col items-center gap-4 mb-6">
        <div className="w-20 h-20 rounded-2xl bg-church-green flex items-center justify-center shadow-lg">
          <Church className="w-10 h-10 text-church-gold" />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-bold text-church-green leading-tight">
            Deeper Life Bible Church
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-medium tracking-wide uppercase">
            Attendance Intelligence System
          </p>
        </div>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-sm border-0 shadow-xl shadow-church-green/10">
        <CardHeader className="pb-4 pt-6 px-6">
          <CardTitle className="text-xl font-semibold text-center">Welcome Back</CardTitle>
          <CardDescription className="text-center text-sm">
            Sign in to access your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl font-medium">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@deeperlife.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl bg-secondary/50 border-0 focus-visible:ring-2 focus-visible:ring-church-green/30 text-sm"
                autoComplete="email"
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/50 border-0 focus-visible:ring-2 focus-visible:ring-church-green/30 pr-12 text-sm"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 rounded-xl bg-church-green hover:bg-church-green-light text-white font-semibold text-base shadow-lg shadow-church-green/25 transition-all active:scale-[0.98] mt-1"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className="w-5 h-5" />
                  Sign In
                </div>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="mt-6 text-xs text-muted-foreground text-center">
        Powered by: Xuzentra Technologies Limited
      </p>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Building2,
  Settings,
  LogOut,
  PhoneCall,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import LiveIndicator from '@/components/LiveIndicator';
import { LiveEventSubscriber } from '@/lib/sse';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [isLive, setIsLive] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    // Check if auth token exists; if not, redirect to /dashboard/login (unless already there)
    const token = localStorage.getItem('swasthya_token');
    if (!token && pathname !== '/dashboard/login') {
      router.push('/dashboard/login');
    } else {
      setAuthToken(token);
    }
  }, [pathname, router]);

  // Connect to live SSE stream for dashboard status
  useEffect(() => {
    if (pathname === '/dashboard/login') return;

    const subscriber = new LiveEventSubscriber((connected) => {
      setIsLive(connected);
    });

    subscriber.connect();

    return () => {
      subscriber.disconnect();
    };
  }, [pathname]);

  if (pathname === '/dashboard/login') {
    return <>{children}</>;
  }

  const menuItems = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/appointments', label: 'Appointments', icon: Calendar },
    { href: '/dashboard/doctors', label: 'Doctors & Schedules', icon: Users },
    { href: '/dashboard/clinics', label: 'Clinics', icon: Building2 },
    { href: '/dashboard/settings', label: 'Settings & IVR', icon: Settings },
  ];

  const handleLogout = () => {
    localStorage.removeItem('swasthya_token');
    localStorage.removeItem('swasthya_user');
    router.push('/dashboard/login');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col justify-between p-4 flex-shrink-0 border-r border-slate-800">
        <div className="space-y-6">
          {/* Logo & Title */}
          <div className="px-2 pt-2">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center text-white font-bold">
                <PhoneCall className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold text-white text-base tracking-tight">SwasthyaCall</span>
                <span className="block text-[10px] uppercase font-bold tracking-wider text-teal-400">
                  Staff Command Center
                </span>
              </div>
            </Link>
          </div>

          {/* Connection status pill */}
          <div className="px-2">
            <LiveIndicator isLive={isLive} />
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & logout */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="px-3 py-2 rounded-xl bg-slate-800/60 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-white block">Dr. R. Sharma</span>
              <span className="text-[10px] text-teal-400 uppercase font-semibold">Lead Admin</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

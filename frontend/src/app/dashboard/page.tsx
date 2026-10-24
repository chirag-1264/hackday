'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Phone,
  Globe,
  TrendingUp,
  Activity,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { fetchDashboardMetrics } from '@/lib/api';
import { DashboardMetrics } from '@/lib/types';
import { AppointmentStatusBadge, BookingSourceBadge } from '@/components/StatusBadge';
import { LiveEventSubscriber } from '@/lib/sse';

export default function DashboardOverviewPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [livePulse, setLivePulse] = useState(false);

  const loadData = async () => {
    const token = localStorage.getItem('swasthya_token');
    if (!token) return;

    try {
      const data = await fetchDashboardMetrics(token);
      setMetrics(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to live SSE events!
    const subscriber = new LiveEventSubscriber();
    const unsubscribe = subscriber.subscribe((event) => {
      // On new appointment created or updated, immediately refresh dashboard metrics!
      setLivePulse(true);
      setTimeout(() => setLivePulse(false), 1200);
      loadData();
    });

    subscriber.connect(() => loadData());

    return () => {
      unsubscribe();
      subscriber.disconnect();
    };
  }, []);

  if (loading && !metrics) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200"></div>
          ))}
        </div>
        <div className="h-72 bg-white rounded-2xl border border-slate-200"></div>
      </div>
    );
  }

  const kpis = metrics?.kpis || {
    total_today: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    upcoming: 0,
    completed: 0,
  };

  const sources = metrics?.sources || { ivr: 0, website: 0 };
  const totalSourceCount = sources.ivr + sources.website || 1;
  const ivrPercent = Math.round((sources.ivr / totalSourceCount) * 100);
  const webPercent = Math.round((sources.website / totalSourceCount) * 100);

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Clinic Activity & Queue Overview</span>
            {livePulse && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 animate-bounce">
                New Event Received!
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time synchronization across Phone IVR and Web Booking channels.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Last updated: {lastRefreshed || 'Just now'}</span>
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Today&apos;s Total</span>
          <div className="text-2xl font-extrabold text-slate-900">{kpis.total_today}</div>
          <span className="text-[10px] text-teal-600 font-medium">Scheduled for today</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Confirmed</span>
          <div className="text-2xl font-extrabold text-emerald-600">{kpis.confirmed}</div>
          <span className="text-[10px] text-emerald-700 font-medium">Active ready slots</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Pending</span>
          <div className="text-2xl font-extrabold text-amber-500">{kpis.pending}</div>
          <span className="text-[10px] text-amber-700 font-medium">Awaiting staff action</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Cancelled</span>
          <div className="text-2xl font-extrabold text-rose-500">{kpis.cancelled}</div>
          <span className="text-[10px] text-rose-700 font-medium">Released slots</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Upcoming</span>
          <div className="text-2xl font-extrabold text-blue-600">{kpis.upcoming}</div>
          <span className="text-[10px] text-blue-700 font-medium">Future scheduled</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Completed</span>
          <div className="text-2xl font-extrabold text-slate-700">{kpis.completed}</div>
          <span className="text-[10px] text-slate-500 font-medium">Consulted patients</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trend Area Chart */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">7-Day Appointment Trends</h3>
              <p className="text-xs text-slate-500">Booking volume categorized by acquisition channel</p>
            </div>
            <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100">
              Live Database Aggregate
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics?.trends || []}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorIvr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#0d9488"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                  name="Total Bookings"
                />
                <Area
                  type="monotone"
                  dataKey="ivr"
                  stroke="#9333ea"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorIvr)"
                  name="IVR Spoken Calls"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Source Distribution Card */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-sm">Channel Distribution</h3>
            <p className="text-xs text-slate-500">Phone IVR vs Website scheduling ratio</p>
          </div>

          <div className="space-y-4">
            {/* IVR Phone bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-purple-700">
                  <Phone className="w-3.5 h-3.5" />
                  <span>AI Phone IVR (Gemma 4)</span>
                </span>
                <span className="text-slate-800 font-mono">{sources.ivr} ({ivrPercent}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-purple-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${ivrPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Website bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-sky-700">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Patient Website</span>
                </span>
                <span className="text-slate-800 font-mono">{sources.website} ({webPercent}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${webPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 text-purple-900 text-[11px] leading-relaxed">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 inline mr-1" />
            <strong>Accessibility Insight:</strong> Voice IVR enables users without smartphones to book slots in conversational Hindi or English.
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Recent Booking Activity</h3>
            <p className="text-xs text-slate-500">Live stream of incoming reservations</p>
          </div>
          <Link
            href="/dashboard/appointments"
            className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
          >
            <span>View All Appointments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Clinic & Specialty</th>
                <th className="px-5 py-3">Appointment Date</th>
                <th className="px-5 py-3">Channel</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics?.recent_activity.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No recent booking records found.
                  </td>
                </tr>
              ) : (
                metrics?.recent_activity.map((appt) => (
                  <tr key={appt._id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      {appt.reference}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-800 block">{appt.patient_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{appt.patient_phone}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-slate-700 block font-medium">{appt.clinic_name || 'Community Clinic'}</span>
                      <span className="text-[10px] text-teal-700 capitalize font-medium">{appt.specialty.replace('_', ' ')}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-slate-800 block">{appt.appointment_date}</span>
                      <span className="text-[10px] text-slate-400">{appt.start_time} - {appt.end_time}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <BookingSourceBadge source={appt.booking_source} />
                    </td>
                    <td className="px-5 py-3.5">
                      <AppointmentStatusBadge status={appt.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  CheckCheck,
  AlertCircle,
  RotateCcw,
  RefreshCw,
  Phone,
  Globe,
  MoreVertical,
  ChevronDown,
  Eye,
} from 'lucide-react';
import { fetchAdminAppointments, updateAppointmentStatus } from '@/lib/api';
import { Appointment } from '@/lib/types';
import { AppointmentStatusBadge, BookingSourceBadge } from '@/components/StatusBadge';
import { LiveEventSubscriber } from '@/lib/sse';

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected appointment modal
  const [activeModalAppt, setActiveModalAppt] = useState<Appointment | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const loadAppointments = async () => {
    const token = localStorage.getItem('swasthya_token');
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetchAdminAppointments(token, {
        status: statusFilter,
        source: sourceFilter,
        date: dateFilter,
        search: searchQuery,
      });
      setAppointments(res.items || []);
      setTotalCount(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [statusFilter, sourceFilter, dateFilter, searchQuery]);

  // Live SSE listener
  useEffect(() => {
    const subscriber = new LiveEventSubscriber();
    const unsub = subscriber.subscribe((event) => {
      // If new appointment created or updated, automatically refresh list!
      loadAppointments();
    });
    subscriber.connect(() => loadAppointments());
    return () => {
      unsub();
      subscriber.disconnect();
    };
  }, []);

  const handleUpdateStatus = async (appointmentId: string, newStatus: string) => {
    const token = localStorage.getItem('swasthya_token');
    if (!token) return;

    try {
      setActionLoading(true);
      setActionFeedback(null);
      const res = await updateAppointmentStatus(token, appointmentId, newStatus);
      
      // Update local state immediately
      setAppointments((prev) =>
        prev.map((a) => (a._id === appointmentId ? res.appointment : a))
      );
      if (activeModalAppt && activeModalAppt._id === appointmentId) {
        setActiveModalAppt(res.appointment);
      }
      setActionFeedback(`Status updated to ${newStatus} successfully.`);
    } catch (err: any) {
      alert(err.message || 'Failed to update appointment');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Appointment Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time queue of patient consultations across all channels ({totalCount} total)
          </p>
        </div>
        <button
          onClick={loadAppointments}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
        {/* Search */}
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search patient, reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
          />
        </div>

        {/* Status filter */}
        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="rescheduled">Rescheduled</option>
          </select>
        </div>

        {/* Source filter */}
        <div className="md:col-span-3">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="all">All Channels (IVR & Web)</option>
            <option value="ivr">AI Phone IVR</option>
            <option value="website">Website</option>
          </select>
        </div>

        {/* Date filter */}
        <div className="md:col-span-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Reference</th>
                <th className="px-5 py-3.5">Patient Details</th>
                <th className="px-5 py-3.5">Clinic & Specialty</th>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-5 py-3.5">Channel</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    Loading appointments...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    No appointments match the selected filters.
                  </td>
                </tr>
              ) : (
                appointments.map((appt) => (
                  <tr key={appt._id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      {appt.reference}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-800 block">{appt.patient_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{appt.patient_phone}</span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="text-slate-700 block font-medium">{appt.clinic_name || 'Community Clinic'}</span>
                      <span className="text-[10px] text-teal-700 capitalize font-medium">{appt.specialty?.replace('_', ' ')}</span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-800 block">{appt.appointment_date}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{appt.start_time} - {appt.end_time}</span>
                    </td>

                    <td className="px-5 py-3.5">
                      <BookingSourceBadge source={appt.booking_source} />
                    </td>

                    <td className="px-5 py-3.5">
                      <AppointmentStatusBadge status={appt.status} />
                    </td>

                    <td className="px-5 py-3.5 text-right space-x-1">
                      <button
                        onClick={() => {
                          setActiveModalAppt(appt);
                          setActionFeedback(null);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Appointment Detail & Status Action Modal */}
      {activeModalAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Manage Reservation</span>
                <h3 className="text-lg font-bold text-slate-900 font-mono">{activeModalAppt.reference}</h3>
              </div>
              <button
                onClick={() => setActiveModalAppt(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {actionFeedback && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{actionFeedback}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Patient:</span>
                <strong className="text-slate-800">{activeModalAppt.patient_name}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Phone:</span>
                <strong className="text-slate-800 font-mono">{activeModalAppt.patient_phone}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Clinic:</span>
                <strong className="text-slate-800">{activeModalAppt.clinic_name}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Schedule:</span>
                <strong className="text-slate-800">{activeModalAppt.appointment_date} at {activeModalAppt.start_time}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Source:</span>
                <BookingSourceBadge source={activeModalAppt.booking_source} />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Current Status:</span>
                <AppointmentStatusBadge status={activeModalAppt.status} />
              </div>
            </div>

            {activeModalAppt.notes && (
              <div className="text-xs text-slate-600 p-3 bg-slate-50 rounded-lg">
                <strong className="text-slate-700 block mb-0.5">Notes:</strong>
                <span>{activeModalAppt.notes}</span>
              </div>
            )}

            {/* Quick action buttons for clinic staff */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-slate-700 block">Change Status:</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  disabled={actionLoading || activeModalAppt.status === 'confirmed'}
                  onClick={() => handleUpdateStatus(activeModalAppt._id, 'confirmed')}
                  className="py-2 px-3 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-40 transition"
                >
                  Confirm
                </button>

                <button
                  disabled={actionLoading || activeModalAppt.status === 'completed'}
                  onClick={() => handleUpdateStatus(activeModalAppt._id, 'completed')}
                  className="py-2 px-3 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300 disabled:opacity-40 transition"
                >
                  Complete
                </button>

                <button
                  disabled={actionLoading || activeModalAppt.status === 'cancelled'}
                  onClick={() => handleUpdateStatus(activeModalAppt._id, 'cancelled')}
                  className="py-2 px-3 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 disabled:opacity-40 transition"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveModalAppt(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

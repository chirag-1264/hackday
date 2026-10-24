'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  XCircle,
  RotateCcw,
  ShieldCheck,
  Building2,
  Stethoscope,
  Phone,
} from 'lucide-react';
import { lookupAppointment, cancelAppointment, rescheduleAppointment, fetchAvailability } from '@/lib/api';
import { Appointment, Slot } from '@/lib/types';
import { AppointmentStatusBadge, BookingSourceBadge } from '@/components/StatusBadge';

function AppointmentLookupContent() {
  const searchParams = useSearchParams();

  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Reschedule state
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [reschedulingLoading, setReschedulingLoading] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    const ph = searchParams.get('phone');
    if (ref && ph) {
      setReference(ref);
      setPhone(ph);
      performLookup(ref, ph);
    }
  }, [searchParams]);

  const performLookup = async (refCode: string, phNumber: string) => {
    try {
      setLoading(true);
      setError(null);
      setActionSuccess(null);
      const data = await lookupAppointment(refCode.trim(), phNumber.trim());
      setAppointment(data);
    } catch (err: any) {
      setError(err.message || 'Appointment not found or phone number verification failed.');
      setAppointment(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference || !phone) {
      setError('Please enter both your appointment reference and registered phone number.');
      return;
    }
    performLookup(reference, phone);
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this appointment? This action is irreversible.')) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await cancelAppointment(reference, phone);
      setAppointment(res.appointment);
      setActionSuccess('Your appointment has been cancelled successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to cancel appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleStartReschedule = async () => {
    setIsRescheduling(true);
    // Default to tomorrow
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrowStr = d.toISOString().split('T')[0];
    setRescheduleDate(tomorrowStr);
    loadRescheduleSlots(tomorrowStr);
  };

  const loadRescheduleSlots = async (targetDate: string) => {
    if (!appointment) return;
    try {
      setLoadingSlots(true);
      const res = await fetchAvailability(
        appointment.clinic_id,
        targetDate,
        appointment.specialty,
        appointment.doctor_id
      );
      setAvailableSlots(res.slots || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!selectedSlot || !appointment) return;
    try {
      setReschedulingLoading(true);
      setError(null);
      const res = await rescheduleAppointment(
        appointment.reference,
        phone,
        selectedSlot.appointment_date,
        selectedSlot.start_time,
        selectedSlot.doctor_id
      );
      setAppointment(res.appointment);
      setIsRescheduling(false);
      setActionSuccess(`Appointment successfully rescheduled to ${selectedSlot.appointment_date} at ${selectedSlot.start_time}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to reschedule slot');
    } finally {
      setReschedulingLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Appointment Lookup</h1>
        <p className="text-slate-600 text-sm max-w-lg mx-auto">
          Enter your reference number and registered phone number to verify identity and manage your booking.
        </p>
      </div>

      {/* Lookup Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reference Code *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. SC-2026-DEMO1"
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 uppercase"
            />
          </div>

          <div className="sm:col-span-6">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Registered Phone / Last 4 Digits *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 9811001122 or 1122"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
          </div>

          <div className="sm:col-span-12 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md transition disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              <span>{loading ? 'Verifying Identity...' : 'Find Appointment'}</span>
            </button>
          </div>
        </form>

        <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Patient data privacy is protected. Two-factor matching is enforced on all record requests.</span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Lookup Notice:</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Update Confirmed:</span>
            <span>{actionSuccess}</span>
          </div>
        </div>
      )}

      {/* Appointment Result Card */}
      {appointment && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
          {/* Card Header */}
          <div className="bg-slate-50/80 p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase font-bold text-slate-500">Appointment Record</span>
                <AppointmentStatusBadge status={appointment.status} />
                <BookingSourceBadge source={appointment.booking_source} />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 font-mono">{appointment.reference}</h2>
            </div>
            <div className="text-xs text-slate-500 text-left sm:text-right">
              <span>Booked on: {new Date(appointment.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Details body */}
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Patient Name</span>
                <p className="font-bold text-slate-800">{appointment.patient_name}</p>
                <p className="text-xs text-slate-500 font-mono">{appointment.patient_phone}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Health Facility</span>
                <p className="font-bold text-slate-800">{appointment.clinic_name || 'Community Health Clinic'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Date & Time</span>
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  <span>{appointment.appointment_date}</span>
                  <Clock className="w-4 h-4 text-teal-600 ml-2" />
                  <span>{appointment.start_time} - {appointment.end_time}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Specialist / Doctor</span>
                <p className="font-bold text-slate-800 capitalize">
                  {appointment.doctor_name || appointment.specialty.replace('_', ' ')}
                </p>
                <span className="text-xs text-teal-700 capitalize font-medium">
                  Specialty: {appointment.specialty.replace('_', ' ')}
                </span>
              </div>
            </div>

            {appointment.notes && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
                <span className="font-semibold block mb-0.5">Patient Notes:</span>
                <p>{appointment.notes}</p>
              </div>
            )}

            {/* Actions: Cancel & Reschedule */}
            {appointment.status !== 'cancelled' && appointment.status !== 'completed' && !isRescheduling && (
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleStartReschedule}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reschedule to New Slot</span>
                </button>

                <button
                  onClick={handleCancel}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Cancel Appointment</span>
                </button>
              </div>
            )}

            {/* In-Line Rescheduling Panel */}
            {isRescheduling && (
              <div className="p-5 rounded-xl bg-teal-50/50 border border-teal-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-teal-600" />
                    <span>Choose New Date and Time Slot</span>
                  </h3>
                  <button
                    onClick={() => setIsRescheduling(false)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Cancel Rescheduling
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select New Date
                  </label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => {
                      setRescheduleDate(e.target.value);
                      loadRescheduleSlots(e.target.value);
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-2">Available Slots:</span>
                  {loadingSlots ? (
                    <p className="text-xs text-slate-500">Checking live doctor availability...</p>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                      No slots available on this date. Please pick another date.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {availableSlots.map((s, idx) => (
                        <button
                          key={idx}
                          disabled={!s.available}
                          onClick={() => setSelectedSlot(s)}
                          className={`p-2 rounded-lg border text-xs text-center transition ${
                            !s.available
                              ? 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-60'
                              : selectedSlot?.start_time === s.start_time
                              ? 'bg-teal-600 text-white border-teal-600 font-bold shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {s.start_time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setIsRescheduling(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600"
                  >
                    Dismiss
                  </button>
                  <button
                    disabled={!selectedSlot || reschedulingLoading}
                    onClick={handleConfirmReschedule}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
                  >
                    {reschedulingLoading ? 'Updating Database...' : 'Confirm Rescheduled Slot'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppointmentLookupPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto p-12 text-center text-xs text-slate-500">Loading appointment lookup...</div>}>
      <AppointmentLookupContent />
    </Suspense>
  );
}

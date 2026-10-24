import React from 'react';
import { AppointmentStatus, BookingSource } from '@/lib/types';
import { Phone, Globe, CheckCircle2, Clock, AlertCircle, CheckCheck, XCircle } from 'lucide-react';

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus | string }) {
  switch (status.toLowerCase()) {
    case 'confirmed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Confirmed
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          Pending
        </span>
      );
    case 'rescheduled':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <AlertCircle className="w-3 h-3 text-blue-600" />
          Rescheduled
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
          <CheckCheck className="w-3 h-3 text-slate-600" />
          Completed
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <XCircle className="w-3 h-3 text-rose-600" />
          Cancelled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
          {status}
        </span>
      );
  }
}

export function BookingSourceBadge({ source }: { source: BookingSource | string }) {
  if (source.toLowerCase() === 'ivr') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
        <Phone className="w-3 h-3 text-purple-600" />
        AI Phone IVR
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 border border-sky-200">
      <Globe className="w-3 h-3 text-sky-600" />
      Website
    </span>
  );
}

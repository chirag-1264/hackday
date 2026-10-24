import React from 'react';
import { AlertTriangle, PhoneCall } from 'lucide-react';

export default function EmergencyBanner() {
  return (
    <aside aria-label="Medical Emergency Notice" className="bg-amber-500/10 border-b border-amber-300 text-amber-950 px-4 py-2.5 text-xs sm:text-sm font-medium">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>
            <strong>Medical Notice:</strong> SwasthyaCall provides appointment booking and health information navigation. It does not replace a medical doctor or diagnose conditions.
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-200/80 px-2.5 py-1 rounded-full text-xs font-semibold text-amber-900 shadow-sm flex-shrink-0">
          <PhoneCall className="w-3.5 h-3.5 text-amber-800" />
          <span>Life-Threatening Emergency? Dial <strong>112</strong></span>
        </div>
      </div>
    </aside>
  );
}

import React from 'react';
import Link from 'next/link';
import { PhoneCall, Heart, ShieldCheck, AlertCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand info */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center text-white">
                <PhoneCall className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Swasthya<span className="text-teal-400">Call</span>
              </span>
            </div>
            <p className="text-slate-400 max-w-md leading-relaxed text-xs sm:text-sm">
              Empowering every citizen with voice-first and digital appointment scheduling.
              Bridging the digital literacy divide through Gemma 4 Natural Language Understanding and bilingual Hindi-English telephone IVR.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
              <ShieldCheck className="w-4 h-4 text-teal-400 flex-shrink-0" />
              <span>
                Demonstration platform. Synthetic clinics and patient data for hackathon demonstration.
              </span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Patient Portals</h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link href="/clinics" className="hover:text-teal-400 transition">
                  Clinic Directory
                </Link>
              </li>
              <li>
                <Link href="/book" className="hover:text-teal-400 transition">
                  Book an Appointment
                </Link>
              </li>
              <li>
                <Link href="/appointments/lookup" className="hover:text-teal-400 transition">
                  Lookup & Reschedule
                </Link>
              </li>
              <li>
                <Link href="/ivr-simulator" className="hover:text-teal-400 transition">
                  Bilingual Voice IVR Simulator
                </Link>
              </li>
            </ul>
          </div>

          {/* Clinic & Admin */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Clinic Administration</h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link href="/dashboard" className="hover:text-teal-400 transition">
                  Staff Live Dashboard
                </Link>
              </li>
              <li>
                <Link href="/dashboard/appointments" className="hover:text-teal-400 transition">
                  Manage Appointments
                </Link>
              </li>
              <li>
                <Link href="/dashboard/doctors" className="hover:text-teal-400 transition">
                  Doctors & Schedules
                </Link>
              </li>
              <li>
                <Link href="/dashboard/settings" className="hover:text-teal-400 transition">
                  IVR & Gemma 4 Config
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom medical disclaimer bar */}
        <div className="mt-8 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p className="text-center sm:text-left">
            &copy; 2026 SwasthyaCall. Built for healthcare accessibility. Emergency Helpline: <strong className="text-rose-400">112</strong>
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              Made with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for equitable care
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

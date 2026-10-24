import React from 'react';
import Link from 'next/link';
import {
  PhoneCall,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Globe2,
  Clock,
  ArrowRight,
  Headphones,
  LayoutDashboard,
  HeartPulse,
  Users,
  Building2,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/70 via-white to-slate-50 pt-12 pb-20 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>Powered by Gemma 4 Multilingual NLU</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                Healthcare appointments made simple by <span className="text-teal-600">ordinary phone call</span> or web.
              </h1>

              <p className="text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed">
                SwasthyaCall breaks down digital barriers. Patients can speak naturally in <strong>Hindi</strong> or <strong>English</strong> over a standard telephone call to check real clinic doctor availability and book appointments instantly.
              </p>

              {/* Primary Call-To-Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <Link
                  href="/book"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Calendar className="w-5 h-5" />
                  <span>Book an Appointment</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>

                <Link
                  href="/ivr-simulator"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 shadow-sm transition-all hover:border-slate-400"
                >
                  <PhoneCall className="w-5 h-5 text-teal-600" />
                  <span>Try AI Phone Simulator</span>
                </Link>

                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-all"
                >
                  <LayoutDashboard className="w-4 h-4 text-teal-600" />
                  <span>Clinic Dashboard</span>
                </Link>
              </div>

              {/* Highlights Pill Row */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>No Smartphone Required</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Hindi & English Spoken</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Live Sync to Staff Dashboard</span>
                </div>
              </div>
            </div>

            {/* Right Interactive Preview Card */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 p-6 space-y-5 relative">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">
                      <Headphones className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">AI Health IVR Inbound Call</h3>
                      <p className="text-[11px] text-slate-500">Live Telephony & Gemma 4 NLU</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                    Active Demo
                  </span>
                </div>

                {/* Simulated Conversation Snippet */}
                <div className="space-y-3 text-xs">
                  {/* Bot message */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="font-semibold text-teal-700 block mb-1">SwasthyaCall Assistant:</span>
                    <p className="text-slate-700">
                      &quot;Namaste! SwasthyaCall mein aapka swagat hai. Aap kis takleef ke liye appointment chahte hain?&quot;
                    </p>
                  </div>

                  {/* Caller message */}
                  <div className="bg-teal-50/70 p-3 rounded-xl border border-teal-100 ml-4">
                    <span className="font-semibold text-slate-700 block mb-1">Caller (Spoken Hindi):</span>
                    <p className="text-slate-800 font-medium">
                      &quot;Mujhe kal subah fever ke liye doctor ko dikhana hai.&quot;
                    </p>
                  </div>

                  {/* Gemma 4 NLU Extraction Box */}
                  <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-purple-900 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-600" />
                        Gemma 4 Structured NLU
                      </span>
                      <span className="text-[10px] text-purple-700 font-mono">0.96 conf</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 font-mono">
                      <div>Intent: <strong>book_appointment</strong></div>
                      <div>Specialty: <strong>general_medicine</strong></div>
                      <div>Date: <strong>Tomorrow</strong></div>
                      <div>Action: <strong>query_availability</strong></div>
                    </div>
                  </div>

                  {/* Confirmed result */}
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-emerald-900 block text-[11px]">Database Write Confirmed</span>
                      <span className="font-mono text-xs font-bold text-emerald-700">Ref: SC-2026-DEMO1</span>
                    </div>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded text-emerald-800 border border-emerald-200 font-medium">
                      Synced to Clinic
                    </span>
                  </div>
                </div>

                <Link
                  href="/ivr-simulator"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition"
                >
                  <span>Launch Full Interactive Simulator</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">How SwasthyaCall Works</h2>
            <p className="text-slate-600 mt-2 text-sm sm:text-base">
              Dual-channel scheduling designed for maximum accessibility across communities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-lg">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900">Phone Call or Web Click</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Dial the toll-free clinic telephone number or visit the web portal. No apps, logins, or high-speed data required for callers.
              </p>
            </div>

            <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900">Gemma 4 Bilingual NLU</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                The caller speaks freely in Hindi, Hinglish, or English. Gemma 4 understands medical symptoms, extracts target specialty, date, and preferred time.
              </p>
            </div>

            <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900">Real-Time Clinic Sync</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Available slots are verified atomically against MongoDB. Once confirmed, appointments stream live into the clinic dashboard without page refreshes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-16 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                <Globe2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-base">Bilingual Accessibility</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Fully fluent in everyday Hindi and English phrasing, enabling elderly and rural citizens to access care with dignity.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                <HeartPulse className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-base">Emergency Triage</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Instantly detects red-flag symptoms such as severe chest pain or breathing distress, escalating directly to 112 emergency services.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-base">Atomic Double-Booking Guard</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Database-level unique constraint prevents concurrent booking collisions between web users and telephone callers.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-base">Live Staff Dashboard</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Server-Sent Events push new bookings from both channels instantaneously, with status management and source attribution.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Safety & Demonstration Banner */}
      <section className="py-12 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>Health Information & Safety Notice</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">Patient Safety at the Core</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            SwasthyaCall is an appointment scheduling platform and healthcare navigation system. It does not provide medical diagnoses, prescribe treatments, or replace qualified medical professionals. In case of emergency in India, dial <strong>112</strong> immediately.
          </p>
        </div>
      </section>
    </div>
  );
}

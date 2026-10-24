'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  Building2,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  FileText,
  Copy,
} from 'lucide-react';
import { fetchClinics, fetchDoctors, fetchAvailability, bookAppointment } from '@/lib/api';
import { Clinic, Doctor, Slot, Appointment } from '@/lib/types';

function BookAppointmentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Wizard state: 1: Clinic -> 2: Specialty/Doctor -> 3: Date -> 4: Slot -> 5: Patient Details -> 6: Confirmation
  const [currentStep, setCurrentStep] = useState(1);

  // Data collections
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);

  // Selection form
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Patient inputs
  const [patientName, setPatientName] = useState<string>('');
  const [patientPhone, setPatientPhone] = useState<string>('');
  const [patientNotes, setPatientNotes] = useState<string>('');

  // Status flags
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Initialize clinics
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const data = await fetchClinics();
        setClinics(data);
        const initialClinic = searchParams.get('clinicId');
        if (initialClinic && data.some((c: Clinic) => c._id === initialClinic)) {
          setSelectedClinicId(initialClinic);
          setCurrentStep(2);
        }
      } catch (err) {
        console.error('Failed to load clinics', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [searchParams]);

  // When clinic changes, load doctors
  useEffect(() => {
    if (selectedClinicId) {
      fetchDoctors(selectedClinicId).then(setDoctors).catch(console.error);
    }
  }, [selectedClinicId]);

  // When date or specialty changes, load real available slots
  useEffect(() => {
    if (selectedClinicId && selectedDate && (selectedSpecialty || selectedDoctorId)) {
      loadSlots();
    }
  }, [selectedClinicId, selectedDate, selectedSpecialty, selectedDoctorId]);

  const loadSlots = async () => {
    try {
      setLoadingSlots(true);
      setErrorMessage(null);
      const res = await fetchAvailability(
        selectedClinicId,
        selectedDate,
        selectedSpecialty || undefined,
        selectedDoctorId || undefined
      );
      setAvailableSlots(res.slots || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load available slots from backend');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !patientName || !patientPhone) {
      setErrorMessage('Please provide your name, phone number, and choose a valid time slot.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload = {
        patient_name: patientName.trim(),
        patient_phone: patientPhone.trim(),
        clinic_id: selectedClinicId,
        doctor_id: selectedSlot.doctor_id,
        specialty: selectedSlot.specialty || selectedSpecialty,
        appointment_date: selectedSlot.appointment_date,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        booking_source: 'website',
        notes: patientNotes.trim() || undefined,
      };

      const res = await bookAppointment(payload);
      setConfirmedAppointment(res.appointment);
      setCurrentStep(6);
    } catch (err: any) {
      setErrorMessage(err.message || 'Slot conflict or booking error. Please select another slot.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedClinic = clinics.find((c) => c._id === selectedClinicId);

  // Generate tomorrow and next 5 days for date picker
  const getUpcomingDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      dates.push({ dateStr, label: `${dayName}, ${monthName} ${dd}` });
    }
    return dates;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Wizard Step Indicator */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Book a Healthcare Appointment
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-1">
          Follow the steps below to reserve an authenticated slot directly at your clinic.
        </p>

        {/* Progress pills */}
        <div className="flex items-center justify-between gap-1 mt-6 text-xs font-semibold overflow-x-auto pb-2">
          {['1. Clinic', '2. Specialty', '3. Date', '4. Slot', '5. Details', '6. Done'].map(
            (label, idx) => {
              const stepNumber = idx + 1;
              const isActive = currentStep === stepNumber;
              const isPast = currentStep > stepNumber;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0 transition ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-sm'
                      : isPast
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{stepNumber}</span>}
                  <span>{label.split('. ')[1]}</span>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Booking Notification:</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* STEP 1: Select Clinic */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-600" />
            <span>Step 1: Choose Your Health Centre</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clinics.map((clinic) => (
              <button
                key={clinic._id}
                onClick={() => {
                  setSelectedClinicId(clinic._id);
                  setCurrentStep(2);
                }}
                className={`p-5 rounded-xl border text-left transition-all ${
                  selectedClinicId === clinic._id
                    ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-600/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-slate-900 text-base">{clinic.name}</h3>
                  <span className="text-[11px] font-semibold text-teal-700 bg-teal-100 px-2 py-0.5 rounded">
                    {clinic.city}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2">{clinic.address}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{clinic.operating_hours.open_time} - {clinic.operating_hours.close_time}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Select Specialty / Doctor */}
      {currentStep === 2 && selectedClinic && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-teal-600" />
              <span>Step 2: Select Specialty or Doctor at {selectedClinic.name}</span>
            </h2>
            <button
              onClick={() => setCurrentStep(1)}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Change Clinic
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
              Medical Specialty
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {selectedClinic.specialties.map((spec) => (
                <button
                  key={spec}
                  onClick={() => setSelectedSpecialty(spec)}
                  className={`p-3.5 rounded-xl border text-xs font-bold capitalize transition ${
                    selectedSpecialty === spec
                      ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {spec.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {doctors.length > 0 && (
            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                Or Select a Doctor Directly (Optional)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {doctors.map((doc) => (
                  <button
                    key={doc._id}
                    onClick={() => {
                      setSelectedDoctorId(doc._id);
                      setSelectedSpecialty(doc.specialty);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      selectedDoctorId === doc._id
                        ? 'bg-teal-50 border-teal-600 ring-2 ring-teal-600/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-slate-900 text-sm block">{doc.name}</span>
                    <span className="text-xs text-slate-500 capitalize">{doc.specialty.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Back
            </button>
            <button
              disabled={!selectedSpecialty}
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <span>Continue to Date</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Choose Date */}
      {currentStep === 3 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-teal-600" />
              <span>Step 3: Choose Appointment Date</span>
            </h2>
            <button
              onClick={() => setCurrentStep(2)}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {getUpcomingDates().map((item) => (
              <button
                key={item.dateStr}
                onClick={() => {
                  setSelectedDate(item.dateStr);
                  setCurrentStep(4);
                }}
                className={`p-4 rounded-xl border text-center transition ${
                  selectedDate === item.dateStr
                    ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="block text-xs font-semibold uppercase opacity-80">
                  {item.label.split(',')[0]}
                </span>
                <span className="text-base font-bold block mt-1">{item.label.split(',')[1]}</span>
                <span className="text-[10px] opacity-75 font-mono">{item.dateStr}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 4: Choose Real Slot from Backend */}
      {currentStep === 4 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-600" />
                <span>Step 4: Select Available Appointment Slot</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time slots verified against MongoDB database for {selectedDate}.
              </p>
            </div>
            <button
              onClick={() => setCurrentStep(3)}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Change Date
            </button>
          </div>

          {loadingSlots ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 space-y-2">
              <Clock className="w-6 h-6 text-teal-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-600 font-medium">Checking live schedule with clinic database...</p>
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">No available slots for this date</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All doctors in this specialty may be off or fully booked on {selectedDate}. Please select another date.
              </p>
              <button
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 text-xs font-bold text-teal-700 bg-teal-50 rounded-lg border border-teal-200 hover:bg-teal-100"
              >
                Choose Another Date
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {availableSlots.map((slot, idx) => (
                <button
                  key={`${slot.start_time}-${idx}`}
                  disabled={!slot.available}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                    !slot.available
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through opacity-60'
                      : selectedSlot?.start_time === slot.start_time
                      ? 'bg-teal-600 text-white border-teal-600 shadow-md ring-2 ring-teal-500/20'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-teal-500 hover:bg-teal-50/40'
                  }`}
                >
                  <span className="text-sm font-bold">{slot.start_time}</span>
                  <span className="text-[10px] font-medium opacity-80">
                    {slot.available ? 'Available' : 'Booked'}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Back
            </button>
            <button
              disabled={!selectedSlot}
              onClick={() => setCurrentStep(5)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <span>Continue to Patient Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Patient Details and Confirmation */}
      {currentStep === 5 && selectedSlot && selectedClinic && (
        <form onSubmit={handleConfirmBooking} className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-teal-600" />
              <span>Step 5: Patient Information</span>
            </h2>
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          </div>

          {/* Booking summary box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="font-bold text-slate-800 text-sm">Booking Summary:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
              <div>Clinic: <strong>{selectedClinic.name}</strong></div>
              <div>Specialty: <strong className="capitalize">{selectedSlot.specialty?.replace('_', ' ')}</strong></div>
              <div>Doctor: <strong>{selectedSlot.doctor_name || 'Assigned Specialist'}</strong></div>
              <div>Time: <strong>{selectedSlot.appointment_date} at {selectedSlot.start_time} - {selectedSlot.end_time}</strong></div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kumar"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Phone Number * (Used for appointment lookup & SMS update)
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. +91 9876543210"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Visit / Symptoms (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Routine consultation, mild fever for 2 days"
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              />
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <span>
              By confirming, this slot will be committed to the database and locked against other callers.
            </span>
          </div>

          <div className="pt-2 flex justify-between items-center">
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting || !patientName || !patientPhone}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md transition disabled:opacity-50"
            >
              {submitting ? 'Confirming with Database...' : 'Confirm & Reserve Slot'}
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 6: Booking Confirmed Success Card */}
      {currentStep === 6 && confirmedAppointment && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-8 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Appointment Confirmed
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 pt-2">
              Slot Reserved Successfully!
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Your appointment is saved in the clinic database and dispatched to the staff dashboard.
            </p>
          </div>

          {/* Reference Pill */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-w-sm mx-auto flex items-center justify-between">
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Appointment Reference</span>
              <span className="text-xl font-extrabold text-slate-900 font-mono tracking-wider">
                {confirmedAppointment.reference}
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(confirmedAppointment.reference);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
              title="Copy Reference"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          {copied && <p className="text-xs text-emerald-600 font-semibold">Reference code copied to clipboard!</p>}

          {/* Details table */}
          <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200 max-w-md mx-auto text-left text-xs space-y-2">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Patient:</span>
              <span className="font-semibold text-slate-800">{confirmedAppointment.patient_name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Clinic:</span>
              <span className="font-semibold text-slate-800">{confirmedAppointment.clinic_name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Date:</span>
              <span className="font-semibold text-slate-800">{confirmedAppointment.appointment_date}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Time:</span>
              <span className="font-semibold text-slate-800">{confirmedAppointment.start_time} - {confirmedAppointment.end_time}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Channel:</span>
              <span className="font-semibold text-teal-700 uppercase">{confirmedAppointment.booking_source}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href={`/appointments/lookup?ref=${confirmedAppointment.reference}&phone=${confirmedAppointment.patient_phone}`}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition"
            >
              Manage / Reschedule Appointment
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition"
            >
              View in Clinic Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookAppointmentPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto p-12 text-center text-xs text-slate-500">Loading booking wizard...</div>}>
      <BookAppointmentContent />
    </Suspense>
  );
}

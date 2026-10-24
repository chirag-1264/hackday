'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, CheckCircle2, Clock, MapPin, Stethoscope, Power, Search } from 'lucide-react';
import { fetchClinics, API_BASE } from '@/lib/api';
import { Clinic, Doctor } from '@/lib/types';

export default function DoctorsManagementPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New doctor form
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('general_medicine');
  const [clinicId, setClinicId] = useState('');
  const [duration, setDuration] = useState(30);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const cData = await fetchClinics();
      setClinics(cData);
      if (cData.length > 0) {
        setClinicId(cData[0]._id);
      }

      // Fetch doctors from backend for each clinic
      const allDocs: Doctor[] = [];
      for (const c of cData) {
        const res = await fetch(`${API_BASE}/api/clinics/${c._id}/doctors`);
        if (res.ok) {
          const docs = await res.json();
          allDocs.push(...docs);
        }
      }
      setDoctors(allDocs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (doctor: Doctor) => {
    const token = localStorage.getItem('swasthya_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/doctors/${doctor._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: !doctor.active }),
      });
      if (res.ok) {
        setDoctors((prev) =>
          prev.map((d) => (d._id === doctor._id ? { ...d, active: !d.active } : d))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('swasthya_token');
    if (!token) return;

    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        specialty,
        clinic_id: clinicId,
        working_hours: {
          start_time: startTime,
          end_time: endTime,
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
        appointment_duration_minutes: duration,
        active: true,
      };

      const res = await fetch(`${API_BASE}/api/admin/doctors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created = await res.json();
        setDoctors((prev) => [...prev, created]);
        setShowAddModal(false);
        setName('');
      } else {
        alert('Failed to add doctor');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Doctors & Scheduling
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure physician working hours, specialties, and real-time appointment availability.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Doctor</span>
        </button>
      </div>

      {/* Doctors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {doctors.map((doc) => {
          const clinic = clinics.find((c) => c._id === doc.clinic_id);
          return (
            <div
              key={doc._id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{doc.name}</h3>
                    <span className="text-xs font-semibold text-teal-700 capitalize">
                      {doc.specialty.replace('_', ' ')}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      doc.active
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {doc.active ? 'Accepting Slots' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{clinic?.name || 'Clinic Facility'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {doc.working_hours.start_time} - {doc.working_hours.end_time} ({doc.appointment_duration_minutes}m slots)
                    </span>
                  </div>
                </div>
              </div>

              {/* Toggle Availability Action */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">Availability Toggle:</span>
                <button
                  onClick={() => handleToggleActive(doc)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    doc.active
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-rose-50 hover:text-rose-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  <Power className="w-3 h-3" />
                  <span>{doc.active ? 'Active' : 'Enable'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Doctor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add New Doctor to Clinic</h3>

            <form onSubmit={handleCreateDoctor} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Doctor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Kavita Deshmukh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Specialty *</label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="general_medicine">General Medicine</option>
                  <option value="cardiology">Cardiology</option>
                  <option value="pediatrics">Pediatrics</option>
                  <option value="dermatology">Dermatology</option>
                  <option value="orthopedics">Orthopedics</option>
                  <option value="ent">ENT</option>
                  <option value="gynecology">Gynecology</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Clinic Association *</label>
                <select
                  value={clinicId}
                  onChange={(e) => setClinicId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  {clinics.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.city})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Slot Duration (Minutes)
                </label>
                <input
                  type="number"
                  min="15"
                  max="60"
                  step="5"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-lg text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name}
                  className="px-4 py-2 rounded-xl text-white font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

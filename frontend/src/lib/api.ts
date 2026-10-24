export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

export async function fetchClinics(search?: string, city?: string, specialty?: string) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (city) params.append('city', city);
  if (specialty) params.append('specialty', specialty);

  const res = await fetch(`${API_BASE}/api/clinics?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch clinics');
  return res.json();
}

export async function fetchClinic(clinicId: string) {
  const res = await fetch(`${API_BASE}/api/clinics/${clinicId}`);
  if (!res.ok) throw new Error('Failed to fetch clinic details');
  return res.json();
}

export async function fetchDoctors(clinicId: string, specialty?: string) {
  const params = new URLSearchParams();
  if (specialty) params.append('specialty', specialty);
  const res = await fetch(`${API_BASE}/api/clinics/${clinicId}/doctors?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch doctors');
  return res.json();
}

export async function fetchAvailability(clinicId: string, date: string, specialty?: string, doctorId?: string) {
  const params = new URLSearchParams({
    clinic_id: clinicId,
    date,
  });
  if (specialty) params.append('specialty', specialty);
  if (doctorId) params.append('doctor_id', doctorId);

  const res = await fetch(`${API_BASE}/api/availability?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch available slots');
  return res.json();
}

export async function bookAppointment(payload: any) {
  const res = await fetch(`${API_BASE}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to book appointment');
  }
  return data;
}

export async function lookupAppointment(reference: string, phone: string) {
  const res = await fetch(`${API_BASE}/api/appointments/lookup/${encodeURIComponent(reference)}?phone=${encodeURIComponent(phone)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Appointment lookup failed');
  }
  return data;
}

export async function cancelAppointment(reference: string, phone: string) {
  const res = await fetch(`${API_BASE}/api/appointments/${encodeURIComponent(reference)}/cancel?phone=${encodeURIComponent(phone)}`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to cancel appointment');
  }
  return data;
}

export async function rescheduleAppointment(reference: string, phone: string, newDate: string, newStartTime: string, doctorId?: string) {
  const res = await fetch(`${API_BASE}/api/appointments/${encodeURIComponent(reference)}/reschedule?phone=${encodeURIComponent(phone)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      new_date: newDate,
      new_start_time: newStartTime,
      doctor_id: doctorId,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to reschedule appointment');
  }
  return data;
}

// Admin APIs
export async function loginAdmin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Login failed');
  return data;
}

export async function fetchDashboardMetrics(token: string) {
  const res = await fetch(`${API_BASE}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load dashboard metrics');
  return res.json();
}

export async function fetchAdminAppointments(
  token: string,
  filters: { status?: string; source?: string; date?: string; search?: string }
) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.append('status', filters.status);
  if (filters.source && filters.source !== 'all') params.append('booking_source', filters.source);
  if (filters.date) params.append('date', filters.date);
  if (filters.search) params.append('search', filters.search);

  const res = await fetch(`${API_BASE}/api/admin/appointments?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load appointments');
  return res.json();
}

export async function updateAppointmentStatus(token: string, appointmentId: string, status: string, notes?: string) {
  const res = await fetch(`${API_BASE}/api/admin/appointments/${appointmentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status, notes }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function simulateIVRTurn(payload: {
  session_id: string;
  user_input: string;
  language?: string;
  caller_phone?: string;
}) {
  const res = await fetch(`${API_BASE}/api/ivr/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'IVR simulation turn failed');
  return data;
}

export async function fetchAIStatus() {
  const res = await fetch(`${API_BASE}/api/ai/status`);
  if (!res.ok) throw new Error('Failed to fetch AI status');
  return res.json();
}

export async function testAIConnection(payload: {
  api_base: string;
  model_name: string;
  api_key?: string;
}) {
  const res = await fetch(`${API_BASE}/api/ai/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function configureAI(payload: {
  api_base: string;
  model_name: string;
  api_key?: string;
  mode?: string;
  provider?: string;
}) {
  const res = await fetch(`${API_BASE}/api/ai/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to configure AI');
  return data;
}

export async function initiateOutboundCall(to_phone: string, clinic_id?: string) {
  const res = await fetch(`${API_BASE}/api/ivr/outbound-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to_phone, clinic_id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to initiate outbound call');
  return data;
}

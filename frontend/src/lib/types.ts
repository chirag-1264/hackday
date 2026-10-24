export interface Clinic {
  _id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  specialties: string[];
  operating_hours: {
    open_time: string;
    close_time: string;
    days: string[];
  };
  active: boolean;
  is_demo?: boolean;
}

export interface Doctor {
  _id: string;
  name: string;
  specialty: string;
  clinic_id: string;
  working_hours: {
    start_time: string;
    end_time: string;
    days: string[];
  };
  appointment_duration_minutes: number;
  active: boolean;
  languages?: string[];
}

export interface Slot {
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  clinic_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  available: boolean;
}

export type AppointmentStatus = 'confirmed' | 'pending' | 'rescheduled' | 'cancelled' | 'completed';
export type BookingSource = 'website' | 'ivr';

export interface Appointment {
  _id: string;
  reference: string;
  patient_name: string;
  patient_phone: string;
  clinic_id: string;
  clinic_name?: string;
  doctor_id?: string;
  doctor_name?: string;
  specialty: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  booking_source: BookingSource;
  notes?: string;
  notification_status?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  kpis: {
    total_today: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    completed: number;
    upcoming: number;
  };
  sources: {
    ivr: number;
    website: number;
  };
  trends: Array<{
    date: string;
    total: number;
    ivr: number;
    website: number;
  }>;
  recent_activity: Appointment[];
}

export interface User {
  email: string;
  full_name: string;
  role: string;
  clinic_id?: string;
  is_active: boolean;
}

export interface IVRSimulateResponse {
  session_id: string;
  step: string;
  bot_response: string;
  audio_hint?: string;
  detected_intent?: string;
  extracted_entities: {
    clinic?: string;
    specialty?: string;
    preferred_date?: string;
    preferred_time?: string;
  };
  options: string[];
  appointment_created?: Appointment;
  is_emergency: boolean;
  twiml_preview?: string;
  active_model?: string;
  provider?: string;
  model_version?: string;
  error?: string;
}

export interface AIStatus {
  provider: string;
  model_name: string;
  api_base: string;
  mode: string;
  is_online: boolean;
  has_api_key: boolean;
  updated_at?: string;
}

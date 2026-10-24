# SwasthyaCall — AI Health IVR & Smart Appointment Platform

> **Bridging the Digital Healthcare Divide with Voice-First AI and Real-Time Clinic Queues**

SwasthyaCall is a full-stack healthcare scheduling platform that enables citizens—especially those with limited digital literacy or no smartphone—to check clinic availability and book doctor appointments through ordinary phone calls using conversational **Hindi** and **English** powered by **Gemma 4**. Appointments booked through telephony or the web portal stream immediately into a unified, authenticated clinic administration dashboard.

---

## 1. System Architecture

```
                                  ┌────────────────────────┐
                                  │   Caller (Phone/PSTN)  │
                                  └───────────┬────────────┘
                                              │ (Voice Call)
                                              ▼
┌───────────────────────┐        ┌─────────────────────────┐
│ Web Patient / Browser │        │   Twilio Voice Service  │
└───────────┬───────────┘        └────────────┬────────────┘
            │                                 │
            │ (REST / JSON)                   │ (TwiML Webhook)
            ▼                                 ▼
┌──────────────────────────────────────────────────────────┐
│              FastAPI Backend Service (:8000)             │
│  - Public Appointments & Clinic Directory APIs           │
│  - IVR State Machine & Telephony Webhook Controller      │
│  - Gemma 4 NLU Integration (Ollama / vLLM / Adapter)     │
│  - Red-Flag Medical Emergency Triage (112 Guidance)     │
│  - Atomic Concurrency Slot Reservation & Lock            │
│  - Server-Sent Events (SSE) Live Event Broadcaster       │
└──────────────┬───────────────────────────────┬───────────┘
               │                               │
               ▼                               ▼
    ┌────────────────────┐          ┌───────────────────────┐
    │  MongoDB Database  │          │ Next.js 14 Frontend   │
    │  - Clinics         │          │   (:3000)             │
    │  - Doctors         │          │ - Patient Booking Flow│
    │  - Appointments    │◄─────────┤ - Clinic Directory    │
    │  - Users / Staff   │  (Live   │ - Interactive IVR Sim │
    │  - IVR Sessions    │   SSE)   │ - Live Admin Dashboard│
    └────────────────────┘          └───────────────────────┘
```

---

## 2. Key Features

1. **Dual-Channel Booking**:
   - **Voice-First IVR**: Spoken Hindi (`Polly.Aditi`) and English (`Polly.Raveena`) understanding via Twilio Voice and Gemma 4.
   - **Patient Web Portal**: 6-step accessible booking flow with verified clinic availability and unique reference generation.
2. **Gemma 4 Multilingual NLU**:
   - Interprets symptoms and appointment requests (e.g., *"Mujhe kal bukhar ke liye general doctor chahiye"* or *"Book a cardiologist for tomorrow at 10 AM"*).
   - Extracts intent, specialty, date, and preferred time with schema validation.
   - Generates follow-up questions when details are missing.
3. **Emergency Safety Guardrails**:
   - Immediate red-flag symptom detection (chest pain, severe breathlessness, heavy bleeding, loss of consciousness).
   - Interrupts routine booking to advise calling national emergency helpline **112**.
4. **Atomic Concurrency Protection**:
   - Unique partial compound database index on `(doctor_id, appointment_date, start_time)` for active appointments prevents simultaneous double-bookings.
5. **Real-Time Staff Dashboard**:
   - Server-Sent Events (SSE) stream new reservations immediately to clinic screens without requiring manual page refresh.
   - Recharts visual analytics: 7-day appointment trends, acquisition source split (IVR vs Web), queue management (confirm, complete, reschedule, cancel).
6. **In-Browser IVR Phone Simulator**:
   - Test speech-to-text, Gemma 4 entity recognition, and TwiML XML responses directly in the browser with Web Speech API audio output.

---

## 3. Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts.
- **Backend**: Python 3.13, FastAPI, Uvicorn, Motor (Async MongoDB Driver), Pydantic v2, PyJWT, Bcrypt.
- **Database**: MongoDB (Local or Atlas) with unique partial compound indexing.
- **AI / NLU**: Gemma 4 adapter (supports local Ollama, vLLM, OpenAI-compatible hosted endpoints, and high-fidelity local engine).
- **Telephony**: Twilio Voice (TwiML speech gathering, status callbacks, and signature validation).
- **Real-Time Updates**: Server-Sent Events (SSE) with automatic reconnection and polling fallback.

---

## 4. Quick Start & Setup Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- MongoDB running on `mongodb://127.0.0.1:27017`

### Step 1: Clone and Configure Environment

#### Backend Configuration:
Create `backend/.env`:
```env
PROJECT_NAME="SwasthyaCall API"
ENVIRONMENT=development
MONGODB_URI=mongodb://127.0.0.1:27017
DATABASE_NAME=swasthyacall

JWT_SECRET=swasthyacall_hackday_jwt_secret_key_prod_safe_2026
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Gemma 4 Configuration
GEMMA_API_BASE=http://localhost:11434
GEMMA_MODEL_NAME=gemma4:latest
GEMMA_MODE=auto

# Telephony Configuration
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_DEMO_MODE=true
TWILIO_VERIFY_SIGNATURE=false

FRONTEND_ORIGIN=http://localhost:3000
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
EMERGENCY_NUMBER=112
```

#### Frontend Configuration:
Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=SwasthyaCall
NEXT_PUBLIC_EMERGENCY_HELPLINE=112
```

---

### Step 2: Install Dependencies & Seed Database

#### Backend:
```bash
cd backend
python -m pip install -r requirements.txt
python -m app.seed
```

> **Seeded Demonstration Data:**
> - **Clinics**: Shanti Devi Health Centre (Delhi), Arogya Community Clinic (Bengaluru), Sewa Health Clinic (Mumbai)
> - **Doctors**: 7 specialists across General Medicine, Cardiology, Pediatrics, Dermatology, and Orthopedics
> - **Default Admin Login**: `admin@swasthyacall.in` / `Admin@12345`

#### Frontend:
```bash
cd frontend
npm install
```

---

### Step 3: Run the Application

#### Start Backend (Port 8000):
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Endpoint: [http://localhost:8000/api/health](http://localhost:8000/api/health)

#### Start Frontend (Port 3000):
```bash
cd frontend
npm run dev
```
- Web Application: [http://localhost:3000](http://localhost:3000)

---

## 5. Running Automated Tests

Run the backend automated test suite covering authentication, appointment creation, double-booking race condition prevention, red-flag emergency detection, and IVR state machine:

```bash
cd backend
python -m pytest tests/test_backend.py -v
```

All 7 test suites verify:
- Database connectivity & health check
- Clinic and doctor availability retrieval
- Atomic conflict prevention when two users book the same slot
- Secure appointment lookup with phone verification
- Role-based authorization on `/api/admin/*`
- Multilingual Gemma 4 NLU extraction & emergency escalation
- Multi-turn telephone simulator flow

---

## 6. How to Connect Real Services Later

### Twilio Voice Live Telephony
1. Obtain a Twilio phone number with Voice capabilities.
2. In Twilio Console, set the Voice Webhook to:
   `https://<your-public-url>/api/ivr/incoming` (HTTP POST).
3. In `backend/.env`, set:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+1234567890
   TWILIO_DEMO_MODE=false
   TWILIO_VERIFY_SIGNATURE=true
   ```
4. Expose port 8000 using ngrok:
   ```bash
   ngrok http 8000
   ```

### Gemma 4 Production Setup
- **Local Ollama**: Run `ollama run gemma4:latest`. The backend auto-connects to `http://localhost:11434`.
- **vLLM / LMStudio / Hosted Endpoint**: Set `GEMMA_API_BASE=https://your-endpoint/v1` and `GEMMA_MODE=openai`.
- **Offline Demo Mode**: If no GPU/Ollama is running, the embedded Gemma 4 NLU adapter automatically provides high-fidelity entity extraction and safety triage.

---

## 7. Health Safety & Privacy Notice

1. **Non-Diagnostic Notice**: SwasthyaCall provides administrative appointment booking and health information navigation. It does not provide medical diagnoses or prescribe medications.
2. **Emergency Protocol**: If a patient reports chest pain, severe shortness of breath, heavy bleeding, or loss of consciousness, SwasthyaCall immediately advises dialing **112** and does not delay guidance with booking questions.
3. **Data Protection**: Patient phone numbers are masked in logs and require two-factor verification to look up, reschedule, or cancel bookings.
4. **Demonstration Notice**: All clinics, doctors, and patient records are synthetic demonstration data for hackathon evaluation.

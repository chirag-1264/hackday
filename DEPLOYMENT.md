# SwasthyaCall — Production Deployment Guide

This guide details the step-by-step production deployment of SwasthyaCall across **Vercel** (Next.js Frontend), **Render** (FastAPI Backend), and **MongoDB Atlas** (Managed Database), with **Hosted Gemma 4 via OpenRouter** and **Twilio Voice Telephony**.

---

## 1. Architecture Overview

```
                      ┌───────────────────────────────────────────────┐
                      │              Twilio Voice Network             │
                      │ (Caller dials number or receives outbound)   │
                      └──────────────────────┬────────────────────────┘
                                             │ HTTPS TwiML Webhook
                                             ▼
┌───────────────────────────┐         ┌───────────────────────────────┐
│     Vercel (Frontend)     │  REST   │      Render (API Backend)     │
│   Next.js 14 App Router   ├────────►│        Python 3.11+ FastAPI   │
│ https://swasthyacall...   │  + SSE  │ https://swasthyacall-api...   │
└───────────────────────────┘         └───────┬──────────────┬────────┘
                                              │              │
                                     OpenAI-  │              │ TLS Connection
                                     compat   │              │ (mongodb+srv://)
                                              ▼              ▼
                              ┌───────────────────┐  ┌──────────────────┐
                              │  OpenRouter Cloud │  │  MongoDB Atlas   │
                              │ Hosted Gemma 4/2  │  │ Managed Database │
                              └───────────────────┘  └──────────────────┘
```

---

## 2. Phase 1: MongoDB Atlas Database Setup

1. **Create Cluster:**
   - Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
   - Create a free **M0 Sandbox** or dedicated cluster (AWS / Google Cloud, select closest region e.g. Mumbai `ap-south-1`).
2. **Database Access (User):**
   - In **Security** > **Database Access**, create a user (e.g. `swasthya_admin`).
   - Authentication Method: **Password**. Assign role: **Read and write to any database**.
3. **Network Access (IP Whitelist):**
   - In **Security** > **Network Access**, click **Add IP Address**.
   - Add `0.0.0.0/0` (Allow Access from Anywhere) with description `Render Backend Cloud Access`. *(Render uses dynamic outbound IP addresses).*
4. **Obtain Connection String:**
   - Go to **Deployments** > **Database** > **Connect**.
   - Choose **Drivers** (Python, version 3.11 or later).
   - Copy the connection string:
     ```
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/swasthyacall?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your database user credentials.

---

## 3. Phase 2: Render Backend Deployment (FastAPI)

### Method A: Automated Deployment via `render.yaml`
1. Push your repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com/), click **New** > **Blueprint**.
3. Connect your repository. Render will automatically detect [`render.yaml`](./render.yaml).
4. Fill in the required secret environment variables (`MONGODB_URI`, `GEMMA_API_KEY`, etc.).

### Method B: Manual Web Service Setup
1. In Render Dashboard, click **New** > **Web Service**.
2. Connect your GitHub repository.
3. Configure the following service settings:
   - **Name:** `swasthyacall-backend`
   - **Region:** Closest to your database (e.g., Singapore or Frankfurt)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path:** `/health`
4. Add the following **Environment Variables** in Render:

| Variable Name | Example / Recommended Value | Description |
| :--- | :--- | :--- |
| `PYTHON_VERSION` | `3.11.9` | Ensures compatible Python runtime |
| `ENVIRONMENT` | `production` | Production mode |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/swasthyacall?retryWrites=true&w=majority` | Atlas connection string |
| `DATABASE_NAME` | `swasthyacall` | Database name |
| `JWT_SECRET` | *(generate 64-char random string)* | Auth signing key |
| `GEMMA_API_BASE` | `https://openrouter.ai/api/v1` | Hosted Gemma API endpoint |
| `GEMMA_MODEL_NAME` | `google/gemma-2-9b-it` | Gemma model ID |
| `GEMMA_MODE` | `online` | Activates cloud adapter |
| `GEMMA_API_KEY` | `sk-or-v1-...` | Your OpenRouter API Key |
| `TWILIO_ACCOUNT_SID`| `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | `your_twilio_auth_token` | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER`| `+1xxxxxxxxxx` | Purchased Twilio Phone Number |
| `TWILIO_DEMO_MODE` | `false` | Enables live carrier calling & SMS |
| `TWILIO_VERIFY_SIGNATURE` | `false` *(or `true` if public URL matches)* | Webhook signature check |
| `PUBLIC_WEBHOOK_URL`| `https://swasthyacall-backend.onrender.com` | Deployed backend URL |
| `FRONTEND_ORIGIN` | `https://swasthyacall.vercel.app` | Vercel production domain |
| `ALLOWED_ORIGINS` | `https://swasthyacall.vercel.app` | Additional CORS origins |
| `SMS_NOTIFICATIONS_ENABLED` | `true` | Send SMS confirmations |
| `EMERGENCY_NUMBER` | `112` | Emergency helpline |

5. Click **Deploy Web Service**.
6. Once deployed, verify by opening `https://<your-service>.onrender.com/health` in your browser. It should return `{"status":"healthy","database":{"connected":true},...}`.

---

## 4. Phase 3: Vercel Frontend Deployment (Next.js)

1. Log in to [Vercel](https://vercel.com/) and click **Add New** > **Project**.
2. Import your GitHub repository.
3. Configure Project Settings:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Click **Edit** and choose `frontend`.
   - **Build Command:** `next build` (Default)
   - **Output Directory:** `.next` (Default)
   - **Install Command:** `npm install` (Default)
4. Configure **Environment Variables** in Vercel:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://<your-service>.onrender.com` | Public URL of your Render backend *(do not include trailing slash)* |
| `NEXT_PUBLIC_APP_NAME` | `SwasthyaCall` | Application brand name |
| `NEXT_PUBLIC_EMERGENCY_HELPLINE` | `112` | Emergency hotline |

5. Click **Deploy**.
6. When deployment finishes, copy your Vercel URL (e.g. `https://swasthyacall.vercel.app`).
7. Return to your **Render Dashboard** and ensure `FRONTEND_ORIGIN` matches your Vercel domain.

---

## 5. Phase 4: Twilio Live Telephony Configuration

1. Log in to the [Twilio Console](https://console.twilio.com/).
2. Navigate to **Phone Numbers** > **Manage** > **Active Numbers**.
3. Select your active Twilio phone number.
4. Under the **Voice Configuration** section:
   - **A CALL COMES IN:** Select **Webhook**.
   - **URL:** `https://<your-backend-service>.onrender.com/api/ivr/incoming`
   - **HTTP Method:** `HTTP POST`
   - **PRIMARY HANDLER FAILS:** Select **Webhook**.
   - **URL:** `https://<your-backend-service>.onrender.com/api/ivr/fallback`
   - **HTTP Method:** `HTTP POST`
   - **CALL STATUS CHANGES:** `https://<your-backend-service>.onrender.com/api/ivr/status` (HTTP POST)
5. Click **Save Configuration**.

---

## 6. Testing & Operational Verification

### Test 1: Health & Database Connectivity
```bash
curl -s https://<your-service>.onrender.com/health
```
*Expected: `status: "healthy"`, `database.connected: true`.*

### Test 2: AI Status Endpoint
```bash
curl -s https://<your-service>.onrender.com/api/ai/status
```
*Expected: Returns active model `google/gemma-2-9b-it`, `provider: "openrouter"`, `has_api_key: true`, and omits the actual secret key.*

### Test 3: Inbound Real Phone Call
- Call your Twilio phone number from your mobile phone.
- Speak in English or Hindi: *"I need an appointment with a cardiologist tomorrow morning."*
- Twilio will stream your speech to the Render backend, Gemma will extract the intent, and the IVR will read back available slots from MongoDB.

### Test 4: Clinic Dashboard Verification
- Open your Vercel URL: `https://swasthyacall.vercel.app/dashboard`.
- Log in with your admin credentials.
- Verify that real-time SSE updates and appointments created via the telephone appear instantly.

---

## 7. Remaining Blockers for Live Calls (Twilio Checklist)

Before real calls will succeed on cellular networks:
1. **Twilio Account Balance:** Ensure your Twilio account has positive funds (Trial accounts allow calls only to pre-verified numbers).
2. **Verified Caller IDs (Trial Accounts):** If you are using a Twilio Trial account, you must add your personal mobile phone number to **Phone Numbers** > **Verified Caller IDs** in Twilio Console.
3. **Geo-Permissions:** In Twilio Console under **Voice** > **Settings** > **Geo-Permissions**, ensure the country you are calling from/to (e.g., India or United States) is enabled.
4. **Public HTTPS Reachability:** Render's free tier spins down after 15 minutes of inactivity. When a phone call arrives while the service is cold-starting, Twilio may time out. For high-reliability production telephony, use a Render starter/paid instance or ping the health endpoint periodically.

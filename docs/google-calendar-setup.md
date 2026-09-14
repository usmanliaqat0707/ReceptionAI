# Google Calendar Integration Setup Guide

## 1. Google Cloud Console Configuration

To connect ReceptionAI to Google Calendar, you must create OAuth 2.0 Client credentials in Google Cloud Platform (GCP).

### Step 1: Create or Select GCP Project
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `ReceptionAI-Calendar` (or select your existing project).

### Step 2: Enable Google Calendar API
1. In the sidebar, go to **APIs & Services > Library**.
2. Search for **Google Calendar API** and click **Enable**.

### Step 3: Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. User Type: Select **External** (or **Internal** if using Google Workspace exclusively).
3. Fill in App Name (e.g. `ReceptionAI`), User support email, and Developer contact information.
4. Add Scopes:
   * `https://www.googleapis.com/auth/calendar.events` (View and edit events)
   * `https://www.googleapis.com/auth/calendar.readonly` (View free/busy schedule)
5. Save and continue.

### Step 4: Create OAuth Client Credentials
1. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
2. Application type: **Web application**.
3. Name: `ReceptionAI Web Backend`.
4. Authorized Redirect URIs:
   * Local development: `http://localhost:3001/api/v1/workspaces/google-oauth/callback`
   * Production: `https://api.yourdomain.com/api/v1/workspaces/google-oauth/callback`
5. Click **Create**. Copy the **Client ID** and **Client Secret**.

---

## 2. Environment Variables Configuration

Add the credentials to your `.env` or deployment secret manager:

```env
# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3001/api/v1/workspaces/google-oauth/callback"

# AES-256 Secret for Refresh Token Encryption
ENCRYPTION_SECRET="32-byte-base64-or-hex-secret-key"
```

---

## 3. Connecting in ReceptionAI Dashboard

1. Navigate to **Integrations** (`/integrations`).
2. Click **Connect Google Calendar**.
3. Authenticate with your Google account and grant calendar permissions.
4. Upon return, select your primary calendar from the dropdown.
5. Your AI receptionist will now automatically synchronize availability and write bookings directly to your Google Calendar!

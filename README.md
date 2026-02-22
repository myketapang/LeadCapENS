# 📅 Lead Capture & Booking System
### 100% Free · Self-Hosted · Google Calendar Sync · No Third-Party Services

A complete booking system using React (Netlify) + Google Apps Script (backend) + Google Calendar (real-time availability) + GitHub Actions (daily reminders). No Calendly, Make.com, or Google Forms.

---

## 🏗️ Architecture

```
User fills form → React App (Netlify)
                      │
          ┌───────────┼───────────────┐
          │           │               │
  GET ?action=getSlots │     POST submitLead
  (load availability)  │     (on confirm)
          │           │               │
          └───────────▼───────────────┘
              Google Apps Script (Web App)
                 │           │         │
         ┌───────┘    ┌──────┘   ┌─────┘
         ▼            ▼          ▼
   Google Calendar  Gmail     Google Sheets
   (read busy slots) (confirm  (CRM log +
   (create event)    emails)    WA links)
         ▲
   GitHub Actions
   (daily reminders @ 9am)
```

---

## ✅ What's Wired Up

| Feature | How |
|---|---|
| Real-time slot availability | Reads your actual Google Calendar events |
| Blocks booked slots | Creates a Google Calendar event on booking |
| All-day events block the whole day | OOO, holidays auto-detected |
| Guest calendar invite | Sent automatically to the lead's email |
| Confirmation email to lead | Via Gmail |
| Owner alert + WhatsApp quick-link | Via Gmail |
| CRM record | Google Sheets |
| 24h reminder emails | GitHub Actions cron → GAS → Gmail |

---

## 🚀 Setup Guide

### Step 1: Google Apps Script

1. Go to [Google Sheets](https://sheets.google.com) → Create a new blank spreadsheet
2. Click **Extensions → Apps Script**
3. Delete all default code, paste the full contents of `gas/Code.gs`
4. Edit the `CONFIG` block at the top:

```javascript
OWNER_EMAIL: "you@gmail.com",     // ← your Gmail (same account running the script)
BUSINESS_NAME: "Your Business",
MEETING_DURATION: 30,
WHATSAPP_NUMBER: "12345678900",   // country code + number, digits only
CALENDAR_ID: "primary",           // "primary" = your main Google Calendar
TIMEZONE: "America/New_York",     // ← your timezone (see link in the file)
REMINDER_SECRET: "mySecret123",   // any string — used to secure the GitHub cron call
```

5. **Test your calendar connection first:**
   - Click **Run → testCalendarConnection** in the Apps Script editor
   - Check the Logs (View → Logs) — should say ✅ Connected

6. To find a specific Calendar ID (if not using primary):
   - Run **listMyCalendars** — all calendar IDs will appear in the logs

7. Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Copy the **Web App URL**

> ⚠️ Every time you edit Code.gs you must **create a new deployment** (Deploy → Manage Deployments → New Version) for changes to take effect.

---

### Step 2: Configure the React App

Open `src/App.jsx` and update the config constants at the top:

```javascript
const GAS_ENDPOINT      = "https://script.google.com/macros/s/YOUR_ID/exec"; // ← paste here
const BUSINESS_NAME     = "Your Business";
const BUSINESS_WHATSAPP = "12345678900";

// Keep these in sync with getAllTimeSlots() in Code.gs!
const TIME_SLOTS = ["09:00","09:30","10:00","10:30","11:00","11:30",
                    "14:00","14:30","15:00","15:30","16:00","16:30"];
```

> **Important:** `TIME_SLOTS` in App.jsx and `getAllTimeSlots()` in Code.gs **must be identical**. The GAS backend uses the same list to check for calendar conflicts.

---

### Step 3: Deploy to Netlify

**Option A — Drag & Drop (easiest):**
1. Run `npm run build` locally
2. Drag the `dist/` folder to [netlify.com/drop](https://app.netlify.com/drop)

**Option B — Auto-deploy via GitHub Actions (recommended):**
1. Push this repo to GitHub
2. Go to Netlify → **Add new site → Import from GitHub**
3. Build settings (auto-detected from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Go to Netlify → **User Settings → Applications → Personal Access Tokens** → create one
5. Get your **Site ID** from Site Settings → General
6. Add both as GitHub secrets (see Step 4)

Every push to `main` will auto-deploy.

---

### Step 4: GitHub Secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value | Used by |
|---|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify Personal Access Token | `deploy.yml` |
| `NETLIFY_SITE_ID` | Netlify Site ID | `deploy.yml` |
| `GAS_DEPLOYMENT_ID` | The ID from your GAS Web App URL (between `/s/` and `/exec`) | `reminders.yml` |
| `GAS_SECRET_KEY` | Same value as `REMINDER_SECRET` in Code.gs | `reminders.yml` |

---

## 📊 On Each Booking — Step by Step

1. User fills the form on your React app
2. React fetches booked slots from GAS → GAS reads **Google Calendar** → returns occupied slots
3. User picks an available date + time
4. User clicks Confirm → React POSTs to GAS
5. GAS creates a **Google Calendar event** (blocks the slot + sends guest invite to lead)
6. GAS saves the lead to **Google Sheets** (with WA quick-link)
7. GAS sends **confirmation email** to lead (with Meet link if on Workspace)
8. GAS sends **owner alert email** with a one-click WhatsApp link
9. Next day: **GitHub Actions** fires at 9am → calls GAS → reminder emails sent

---

## 📱 WhatsApp

**Semi-auto (free, recommended):** Owner alert email contains a `wa.me/...` link with the message pre-filled. One click → WhatsApp opens with message ready to send.

**Full-auto (optional):** Sign up for [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp). First 1,000 conversations/month are free. Add the API call inside `sendOwnerAlert()` in Code.gs.

---

## 🛠️ Customization

**Change time slots:** Edit `TIME_SLOTS` in `App.jsx` AND `getAllTimeSlots()` in `Code.gs` — keep them identical.

**Change meeting duration:** Edit `MEETING_DURATION` in both `App.jsx` and `Code.gs` CONFIG.

**Change timezone:** Edit `TIMEZONE` in Code.gs CONFIG. Use IANA format e.g. `"Europe/London"`, `"Asia/Singapore"`.

**Change reminder timing:** Edit the cron in `.github/workflows/reminders.yml`
- `"0 9 * * *"` = daily 9am UTC. Use [crontab.guru](https://crontab.guru) to convert to your timezone.

**Use a specific calendar (not primary):** Run `listMyCalendars()` in the Apps Script editor to get the ID, then set `CALENDAR_ID` in CONFIG.

---

## 💰 Cost

| Service | Cost | Free Limit |
|---|---|---|
| Netlify | Free | 100GB bandwidth/mo, 300 build min/mo |
| GitHub Actions | Free | 2,000 min/mo |
| Google Apps Script | Free | 100 emails/day, 6min execution |
| Google Calendar | Free | Included with Google account |
| Google Sheets | Free | 10GB |
| Gmail | Free | 500 emails/day |
| **Total** | **$0** | ✅ |

---

## 🐛 Troubleshooting

**Slots not showing as booked:** Run `testCalendarConnection()` in the Apps Script editor and check the logs. The most common issue is a wrong `CALENDAR_ID` or `TIMEZONE`.

**"Couldn't load availability" warning in the app:** Your GAS URL is wrong or the Web App isn't deployed with "Anyone" access. Re-deploy and copy the fresh URL.

**Calendar event created but no Meet link:** Google Meet links in calendar events are only auto-generated for Google Workspace (paid) accounts. Personal Gmail accounts won't get them. The lead still gets a calendar invite — they can add their own video link.

**GitHub Actions reminders not firing:** Check the Actions tab on your repo for errors. Ensure `GAS_DEPLOYMENT_ID` and `GAS_SECRET_KEY` secrets match exactly what's in Code.gs.

**Emails not sending:** You may have hit Gmail's 100/day limit. Check Apps Script → Executions for errors.

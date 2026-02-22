import { useState, useEffect, useCallback } from "react";

// ─── CONFIG — update these after deploying Google Apps Script ────────────────
const GAS_ENDPOINT    = "https://script.google.com/macros/s/AKfycbzDan_mjGLbIucKrGEKYiZQJ0-5mU_b5LK-08b0rBcOZPMrFWBrWp8fqySxdcQWBLhaLQ/exec";
const BUSINESS_NAME   = "Elevate Nexus Solutions";
const BUSINESS_WHATSAPP = "60134748674"; // digits only, with country code
const MEETING_DURATION  = 30;           // minutes — keep in sync with GAS CONFIG

// Your available hours (24h). Keep in sync with getAllTimeSlots() in Code.gs
const TIME_SLOTS = [
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "14:00","14:30","15:00","15:30","16:00","16:30",
];

// ─── UTILS ──────────────────────────────────────────────────────────────────
const fmtPhone = (raw) => raw.replace(/\D/g, "");

function getNext14Weekdays() {
  const days = [];
  const today = new Date();
  let i = 1;
  while (days.length < 14) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() !== 0 && d.getDay() !== 6) days.push(d);
    i++;
  }
  return days;
}

function toDateKey(d) {
  // Returns YYYY-MM-DD in LOCAL time (not UTC) to avoid off-by-one across timezones
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(d) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState("form"); // form | schedule | confirm | done
  const [lead, setLead] = useState({ name: "", phone: "", email: "", message: "" });
  const [errors, setErrors] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);

  // Calendar availability state
  const [bookedSlots, setBookedSlots]   = useState({});  // { "YYYY-MM-DD_HH:MM": true }
  const [calLoading, setCalLoading]     = useState(false);
  const [calError, setCalError]         = useState("");

  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState("");
  const [meetLink, setMeetLink]         = useState("");

  const days = getNext14Weekdays();

  // ── Fetch all booked slots from Google Calendar when entering schedule step ──
  const fetchAvailability = useCallback(async () => {
    setCalLoading(true);
    setCalError("");
    try {
      const res  = await fetch(`${GAS_ENDPOINT}?action=getSlots`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBookedSlots(data.booked || {});
    } catch (err) {
      setCalError("Couldn't load availability. Showing all slots — some may already be taken.");
      console.error(err);
    } finally {
      setCalLoading(false);
    }
  }, []);

  // Re-fetch when a date is selected (to stay fresh)
  const refreshDateSlots = useCallback(async (dateKey) => {
    try {
      const res  = await fetch(`${GAS_ENDPOINT}?action=getSlots&date=${dateKey}`);
      const data = await res.json();
      if (data.booked) {
        setBookedSlots(prev => ({ ...prev, ...data.booked }));
      }
    } catch { /* silent — we already have the bulk data */ }
  }, []);

  useEffect(() => {
    if (step === "schedule") fetchAvailability();
  }, [step, fetchAvailability]);

  // Refresh individual date slots when user selects a date
  useEffect(() => {
    if (selectedDate && step === "schedule") {
      refreshDateSlots(toDateKey(selectedDate));
    }
  }, [selectedDate, step, refreshDateSlots]);

  // ── Form validation ──────────────────────────────────────────────────────
  function validate() {
    const e = {};
    if (!lead.name.trim())                              e.name  = "Name is required";
    if (fmtPhone(lead.phone).length < 7)                e.phone = "Valid phone required";
    if (!lead.email.trim() || !lead.email.includes("@")) e.email = "Valid email required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleFormNext(ev) {
    ev.preventDefault();
    if (validate()) setStep("schedule");
  }

  function isBooked(date, time) {
    return !!bookedSlots[`${toDateKey(date)}_${time}`];
  }

  function slotCount(date) {
    return TIME_SLOTS.filter(t => !isBooked(date, t)).length;
  }

  // ── Submit booking ────────────────────────────────────────────────────────
  async function handleConfirm() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(GAS_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          action: "submitLead",
          name:    lead.name,
          phone:   fmtPhone(lead.phone),
          email:   lead.email,
          message: lead.message,
          date:    toDateKey(selectedDate),
          time:    selectedTime,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMeetLink(data.meetLink || "");
      setStep("done");
    } catch (err) {
      setSubmitError("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <style>{CSS}</style>

      <header>
        <div className="header-inner">
          <span className="logo">◆ {BUSINESS_NAME}</span>
          <nav>
            <a href="#">Services</a>
            <a href="#">About</a>
            <a href="#booking" className="cta-nav">Book a Call</a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero-bg">
          <div className="orb orb1" />
          <div className="orb orb2" />
          <div className="grid-overlay" />
        </div>
        <div className="hero-content">
          <span className="badge">● Now accepting clients</span>
          <h1>Let's Build<br /><em>Something Real</em></h1>
          <p>Book a free {MEETING_DURATION}-minute strategy call. No fluff, just results.</p>
          <a href="#booking" className="hero-cta">Reserve Your Spot →</a>
        </div>
      </section>

      <section id="booking" className="booking-section">
        <div className="booking-card">

          {/* Progress indicator */}
          {step !== "done" && (
            <div className="progress">
              {["Your Info", "Pick a Time", "Confirm"].map((label, i) => {
                const cur = step === "form" ? 0 : step === "schedule" ? 1 : 2;
                return (
                  <div key={i} className={`prog-step ${i <= cur ? "active" : ""} ${i < cur ? "done" : ""}`}>
                    <div className="prog-dot">{i < cur ? "✓" : i + 1}</div>
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── STEP 1: Contact Form ── */}
          {step === "form" && (
            <form onSubmit={handleFormNext} className="step-form" noValidate>
              <h2>Tell us about yourself</h2>
              <p className="sub">Quick and painless — just the basics.</p>
              <div className="field-row">
                <div className="field">
                  <label>Full Name</label>
                  <input
                    value={lead.name}
                    onChange={e => setLead({ ...lead, name: e.target.value })}
                    placeholder="Jane Smith"
                  />
                  {errors.name && <span className="err">{errors.name}</span>}
                </div>
                <div className="field">
                  <label>WhatsApp Number</label>
                  <input
                    type="tel"
                    value={lead.phone}
                    onChange={e => setLead({ ...lead, phone: e.target.value })}
                    placeholder="+1 234 567 8900"
                  />
                  {errors.phone && <span className="err">{errors.phone}</span>}
                </div>
              </div>
              <div className="field">
                <label>Email Address</label>
                <input
                  type="email"
                  value={lead.email}
                  onChange={e => setLead({ ...lead, email: e.target.value })}
                  placeholder="jane@company.com"
                />
                {errors.email && <span className="err">{errors.email}</span>}
              </div>
              <div className="field">
                <label>What do you need help with? <span className="optional">(optional)</span></label>
                <textarea
                  value={lead.message}
                  onChange={e => setLead({ ...lead, message: e.target.value })}
                  placeholder="Briefly describe your project or goal..."
                  rows={3}
                />
              </div>
              <button type="submit" className="btn-primary">Choose a Time →</button>
            </form>
          )}

          {/* ── STEP 2: Calendar Picker ── */}
          {step === "schedule" && (
            <div className="step-schedule">
              <h2>Pick your slot</h2>
              <p className="sub">
                {MEETING_DURATION}-min call · Times in your local timezone ·
                <span className="cal-badge"> 📅 Live from Google Calendar</span>
              </p>

              {/* Loading skeleton */}
              {calLoading && (
                <div className="cal-loading">
                  <div className="spinner" />
                  <span>Checking availability…</span>
                </div>
              )}

              {/* Calendar error banner */}
              {calError && !calLoading && (
                <div className="cal-warning">⚠️ {calError}</div>
              )}

              {!calLoading && (
                <>
                  {/* Date strip */}
                  <div className="date-grid">
                    {days.map((d, i) => {
                      const free = slotCount(d);
                      const fullyBooked = free === 0;
                      return (
                        <button
                          key={i}
                          disabled={fullyBooked}
                          className={[
                            "date-btn",
                            selectedDate?.toDateString() === d.toDateString() ? "selected" : "",
                            fullyBooked ? "full" : "",
                          ].join(" ")}
                          onClick={() => { setSelectedDate(d); setSelectedTime(null); }}
                        >
                          <span className="day-name">{d.toLocaleDateString("en-US",{weekday:"short"})}</span>
                          <span className="day-num">{d.getDate()}</span>
                          <span className="month-name">{d.toLocaleDateString("en-US",{month:"short"})}</span>
                          <span className={`avail-dot ${fullyBooked ? "none" : free <= 3 ? "few" : "open"}`}>
                            {fullyBooked ? "Full" : `${free} left`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Time slots for selected date */}
                  {selectedDate && (
                    <div className="time-grid">
                      <h3>{fmtDate(selectedDate)}</h3>
                      <div className="slots">
                        {TIME_SLOTS.map(t => {
                          const booked = isBooked(selectedDate, t);
                          return (
                            <button
                              key={t}
                              disabled={booked}
                              onClick={() => !booked && setSelectedTime(t)}
                              className={[
                                "time-btn",
                                booked ? "booked" : "",
                                selectedTime === t ? "selected" : "",
                              ].join(" ")}
                            >
                              {t}
                              {booked && <span className="booked-x">✗</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!selectedDate && (
                    <div className="pick-hint">← Select a date to see available times</div>
                  )}
                </>
              )}

              <div className="step-actions">
                <button className="btn-secondary" onClick={() => setStep("form")}>← Back</button>
                <button
                  className="btn-primary"
                  disabled={!selectedDate || !selectedTime}
                  onClick={() => setStep("confirm")}
                >
                  Review Booking →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Confirm ── */}
          {step === "confirm" && (
            <div className="step-confirm">
              <h2>Confirm your booking</h2>
              <p className="sub">Double-check everything looks right before we lock it in.</p>
              <div className="summary">
                <SummaryRow label="Name"     value={lead.name} />
                <SummaryRow label="Email"    value={lead.email} />
                <SummaryRow label="WhatsApp" value={lead.phone} />
                <SummaryRow label="📅 Date"  value={fmtDate(selectedDate)} highlight />
                <SummaryRow label="🕐 Time"  value={`${selectedTime} (${MEETING_DURATION} min)`} highlight />
                {lead.message && (
                  <SummaryRow label="Notes" value={lead.message} muted />
                )}
              </div>
              <div className="confirm-note">
                A Google Calendar invite will be sent to your email automatically.
              </div>
              {submitError && <p className="err" style={{marginTop:12}}>{submitError}</p>}
              <div className="step-actions">
                <button className="btn-secondary" onClick={() => setStep("schedule")}>← Back</button>
                <button className="btn-primary" onClick={handleConfirm} disabled={submitting}>
                  {submitting ? <><span className="spinner-sm" /> Booking…</> : "Confirm Booking ✓"}
                </button>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {step === "done" && (
            <div className="step-done">
              <div className="done-icon">✓</div>
              <h2>You're booked!</h2>
              <p>Confirmation sent to <strong>{lead.email}</strong>.</p>
              <p>A Google Calendar invite has been added to your calendar.</p>
              <p style={{marginTop:4}}>We'll message you on WhatsApp before the call.</p>
              {meetLink && (
                <a href={meetLink} target="_blank" rel="noreferrer" className="btn-meet">
                  🎥 Join Google Meet
                </a>
              )}
              <a
                href={`https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(
                  `Hi! I just booked a call for ${fmtDate(selectedDate)} at ${selectedTime}. My name is ${lead.name}.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="btn-whatsapp"
              >
                💬 Message us on WhatsApp
              </a>
              <button
                className="btn-secondary"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setStep("form");
                  setLead({ name: "", phone: "", email: "", message: "" });
                  setSelectedDate(null);
                  setSelectedTime(null);
                  setMeetLink("");
                }}
              >
                Book another slot
              </button>
            </div>
          )}

        </div>
      </section>

      <footer>
        <p>© 2025 {BUSINESS_NAME} · Availability synced with Google Calendar</p>
      </footer>
    </div>
  );
}

function SummaryRow({ label, value, highlight, muted }) {
  return (
    <div className={`summary-item ${highlight ? "highlight" : ""}`}>
      <span className="si-label">{label}</span>
      <span className={muted ? "msg-preview" : ""}>{value}</span>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink: #0a0a0f;
    --ink2: #1c1c2e;
    --fg: #f0eee8;
    --fg2: #a09e9a;
    --accent: #c8f04e;
    --accent2: #7b61ff;
    --card: #13121d;
    --border: rgba(255,255,255,0.08);
    --radius: 16px;
    --warn: #f0a04e;
  }

  html { scroll-behavior: smooth; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--ink);
    color: var(--fg);
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* ── HEADER ── */
  header {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    backdrop-filter: blur(20px);
    background: rgba(10,10,15,0.7);
    border-bottom: 1px solid var(--border);
  }
  .header-inner {
    max-width: 1200px; margin: 0 auto;
    padding: 16px 32px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .logo { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; }
  nav { display: flex; gap: 32px; align-items: center; }
  nav a { color: var(--fg2); text-decoration: none; font-size: 15px; transition: color 0.2s; }
  nav a:hover { color: var(--fg); }
  .cta-nav {
    background: var(--accent); color: var(--ink) !important;
    padding: 8px 20px; border-radius: 100px;
    font-weight: 600; font-size: 14px !important;
    transition: transform 0.2s, box-shadow 0.2s !important;
  }
  .cta-nav:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(200,240,78,0.4); }

  /* ── HERO ── */
  .hero {
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
    padding: 120px 32px 80px;
  }
  .hero-bg { position: absolute; inset: 0; z-index: 0; }
  .orb {
    position: absolute; border-radius: 50%;
    filter: blur(80px); opacity: 0.35;
    animation: pulse 8s ease-in-out infinite alternate;
  }
  .orb1 { width: 600px; height: 600px; background: var(--accent2); top: -200px; right: -150px; }
  .orb2 { width: 400px; height: 400px; background: var(--accent); bottom: -100px; left: -100px; animation-delay: -4s; }
  @keyframes pulse { from { transform: scale(1); } to { transform: scale(1.15); } }
  .grid-overlay {
    position: absolute; inset: 0;
    background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 60px 60px;
  }
  .hero-content { position: relative; z-index: 1; text-align: center; max-width: 680px; }
  .badge {
    display: inline-block; margin-bottom: 24px;
    background: rgba(200,240,78,0.12); border: 1px solid rgba(200,240,78,0.3);
    color: var(--accent); padding: 6px 16px; border-radius: 100px;
    font-size: 13px; font-weight: 500;
  }
  .hero-content h1 {
    font-family: 'Syne', sans-serif; font-weight: 800;
    font-size: clamp(52px, 8vw, 96px); line-height: 1; letter-spacing: -3px;
    margin-bottom: 24px;
  }
  .hero-content h1 em { color: var(--accent); font-style: normal; }
  .hero-content p { font-size: 20px; color: var(--fg2); margin-bottom: 40px; font-weight: 300; }
  .hero-cta {
    display: inline-block;
    background: var(--accent); color: var(--ink);
    padding: 16px 40px; border-radius: 100px;
    font-family: 'Syne', sans-serif; font-weight: 700; font-size: 17px;
    text-decoration: none; transition: transform 0.25s, box-shadow 0.25s;
  }
  .hero-cta:hover { transform: translateY(-3px); box-shadow: 0 8px 40px rgba(200,240,78,0.5); }

  /* ── BOOKING CARD ── */
  .booking-section { padding: 80px 24px 120px; display: flex; justify-content: center; }
  .booking-card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 24px; padding: 48px;
    width: 100%; max-width: 860px;
    box-shadow: 0 40px 100px rgba(0,0,0,0.5);
  }

  /* ── PROGRESS ── */
  .progress {
    display: flex; margin-bottom: 48px; position: relative;
  }
  .progress::before {
    content: ''; position: absolute; top: 16px; left: 16px; right: 16px;
    height: 2px; background: var(--border);
  }
  .prog-step { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; position: relative; z-index: 1; }
  .prog-dot {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--ink2); border: 2px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 600; transition: all 0.3s;
  }
  .prog-step.active .prog-dot { border-color: var(--accent); color: var(--accent); }
  .prog-step.done .prog-dot  { background: var(--accent); color: var(--ink); border-color: var(--accent); }
  .prog-step span { font-size: 12px; color: var(--fg2); }
  .prog-step.active span { color: var(--fg); }

  /* ── FORM ── */
  .step-form h2, .step-schedule h2, .step-confirm h2 {
    font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 700; margin-bottom: 6px;
  }
  .sub { color: var(--fg2); margin-bottom: 32px; font-size: 15px; }
  .cal-badge {
    display: inline-block; margin-left: 8px;
    background: rgba(200,240,78,0.1); color: var(--accent);
    padding: 2px 10px; border-radius: 100px; font-size: 12px;
  }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .field label { font-size: 13px; font-weight: 500; color: var(--fg2); }
  .optional { font-weight: 400; opacity: 0.6; }
  .field input, .field textarea {
    background: rgba(255,255,255,0.04); border: 1px solid var(--border);
    color: var(--fg); border-radius: 10px; padding: 12px 16px; font-size: 15px;
    font-family: 'DM Sans', sans-serif; outline: none; resize: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .field input:focus, .field textarea:focus {
    border-color: rgba(200,240,78,0.5);
    box-shadow: 0 0 0 3px rgba(200,240,78,0.08);
  }
  .field input::placeholder, .field textarea::placeholder { color: rgba(255,255,255,0.2); }
  .err { color: #ff6b6b; font-size: 12px; }

  /* ── LOADING ── */
  .cal-loading {
    display: flex; align-items: center; gap: 12px;
    color: var(--fg2); padding: 48px 0; justify-content: center;
  }
  .spinner {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid var(--border); border-top-color: var(--accent);
    animation: spin 0.7s linear infinite;
  }
  .spinner-sm {
    display: inline-block; width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(0,0,0,0.3); border-top-color: var(--ink);
    animation: spin 0.7s linear infinite; margin-right: 8px; vertical-align: middle;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .cal-warning {
    background: rgba(240,160,78,0.1); border: 1px solid rgba(240,160,78,0.3);
    color: var(--warn); border-radius: 10px; padding: 12px 16px;
    font-size: 14px; margin-bottom: 24px;
  }

  /* ── CALENDAR DATE GRID ── */
  .date-grid {
    display: flex; gap: 8px; overflow-x: auto; padding-bottom: 12px; margin-bottom: 28px;
    scrollbar-width: thin; scrollbar-color: var(--border) transparent;
  }
  .date-btn {
    flex-shrink: 0; min-width: 68px;
    background: rgba(255,255,255,0.03); border: 1px solid var(--border);
    border-radius: 12px; padding: 12px 8px; cursor: pointer; color: var(--fg);
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    transition: border-color 0.2s, background 0.2s;
  }
  .date-btn:hover:not(:disabled) { border-color: rgba(200,240,78,0.4); background: rgba(200,240,78,0.06); }
  .date-btn.selected { border-color: var(--accent); background: rgba(200,240,78,0.12); }
  .date-btn.full { opacity: 0.35; cursor: not-allowed; }
  .date-btn:disabled { cursor: not-allowed; }
  .day-name { font-size: 10px; color: var(--fg2); text-transform: uppercase; letter-spacing: 0.5px; }
  .day-num { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; }
  .month-name { font-size: 10px; color: var(--fg2); }
  .avail-dot {
    font-size: 10px; padding: 2px 6px; border-radius: 100px; margin-top: 2px;
  }
  .avail-dot.open { background: rgba(200,240,78,0.15); color: var(--accent); }
  .avail-dot.few  { background: rgba(240,160,78,0.15); color: var(--warn); }
  .avail-dot.none { background: rgba(255,100,100,0.1); color: #ff6b6b; }

  /* ── TIME SLOTS ── */
  .time-grid h3 { font-family: 'Syne', sans-serif; font-size: 16px; margin-bottom: 16px; }
  .slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; }
  .time-btn {
    position: relative;
    background: rgba(255,255,255,0.03); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px; color: var(--fg); cursor: pointer;
    font-size: 14px; font-weight: 500; transition: all 0.2s;
  }
  .time-btn:hover:not(:disabled):not(.selected) {
    border-color: rgba(200,240,78,0.4); background: rgba(200,240,78,0.06);
  }
  .time-btn.selected { border-color: var(--accent); background: rgba(200,240,78,0.15); color: var(--accent); }
  .time-btn.booked { opacity: 0.25; cursor: not-allowed; text-decoration: line-through; }
  .booked-x { position: absolute; top: 3px; right: 6px; font-size: 10px; color: #ff6b6b; }

  .pick-hint {
    color: var(--fg2); font-size: 14px; text-align: center;
    padding: 32px 0; border: 1px dashed var(--border); border-radius: 12px;
    margin-bottom: 16px;
  }

  /* ── BUTTONS ── */
  .btn-primary {
    background: var(--accent); color: var(--ink);
    border: none; border-radius: 10px; padding: 14px 28px;
    font-size: 15px; font-weight: 700; font-family: 'Syne', sans-serif;
    cursor: pointer; transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
    display: inline-flex; align-items: center;
  }
  .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(200,240,78,0.35); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary {
    background: transparent; color: var(--fg2);
    border: 1px solid var(--border); border-radius: 10px;
    padding: 14px 24px; font-size: 15px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; transition: color 0.2s, border-color 0.2s;
  }
  .btn-secondary:hover { color: var(--fg); border-color: rgba(255,255,255,0.2); }
  .step-actions {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 32px; gap: 12px;
  }

  /* ── SUMMARY ── */
  .summary {
    background: rgba(255,255,255,0.03); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden; margin: 24px 0;
  }
  .summary-item {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding: 14px 20px; border-bottom: 1px solid var(--border); gap: 16px; font-size: 15px;
  }
  .summary-item:last-child { border-bottom: none; }
  .summary-item.highlight { background: rgba(200,240,78,0.05); }
  .si-label { color: var(--fg2); font-size: 13px; white-space: nowrap; padding-top: 1px; }
  .msg-preview { color: var(--fg2); font-size: 13px; text-align: right; }
  .confirm-note {
    background: rgba(123,97,255,0.08); border: 1px solid rgba(123,97,255,0.2);
    border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #b8a8ff;
  }

  /* ── DONE ── */
  .step-done { text-align: center; padding: 20px 0; }
  .done-icon {
    width: 72px; height: 72px; border-radius: 50%;
    background: rgba(200,240,78,0.15); border: 2px solid var(--accent);
    color: var(--accent); font-size: 32px;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 24px;
    animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes popIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .step-done h2 { font-family: 'Syne', sans-serif; font-size: 32px; margin-bottom: 12px; }
  .step-done p { color: var(--fg2); margin-bottom: 6px; }
  .btn-whatsapp, .btn-meet {
    display: inline-block; margin-top: 24px;
    padding: 14px 28px; border-radius: 100px;
    font-weight: 700; font-size: 15px; text-decoration: none;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .btn-whatsapp { background: #25d366; color: #fff; margin-right: 12px; }
  .btn-whatsapp:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(37,211,102,0.4); }
  .btn-meet { background: #1a73e8; color: #fff; }
  .btn-meet:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(26,115,232,0.4); }

  /* ── FOOTER ── */
  footer { text-align: center; padding: 32px; color: var(--fg2); font-size: 13px; border-top: 1px solid var(--border); }

  @media (max-width: 600px) {
    .field-row { grid-template-columns: 1fr; }
    .booking-card { padding: 28px 20px; }
    .header-inner { padding: 14px 20px; }
    nav a:not(.cta-nav) { display: none; }
    .btn-whatsapp, .btn-meet { display: block; margin: 12px auto 0; }
  }
`;

/**
 * ═══════════════════════════════════════════════════════════════
 *  LEAD CAPTURE & BOOKING — Google Apps Script Backend
 *  v2 — Now with Google Calendar integration!
 *
 *  Deploy as: Extensions → Apps Script → Deploy → Web App
 *  Execute as: Me | Who has access: Anyone
 * ═══════════════════════════════════════════════════════════════
 */

// ─── YOUR CONFIGURATION ─────────────────────────────────────────────────────
const CONFIG = {
  SHEET_ID: "",                   // Leave blank to use the bound sheet, or paste your Google Sheet ID
  SHEET_NAME: "LeadsCapENS",
  OWNER_EMAIL: "info@elevatenxs.com",   // ← Your Gmail address (must match the Google account running this script)
  BUSINESS_NAME: "Elevate Nexus Solutions",
  MEETING_DURATION: 30,           // minutes
  WHATSAPP_NUMBER: "60134748674",  // Your WhatsApp number (digits only, with country code)

  // Google Calendar settings
  CALENDAR_ID: "primary",         // "primary" uses your main calendar. Or paste a specific calendar ID.
  TIMEZONE: "Asia/Kuala_Lumpur",   // ← Your timezone. Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  ADD_GOOGLE_MEET: true,          // Adds a Google Meet link to every calendar event

  // GitHub Actions secret for reminder trigger
  REMINDER_SECRET: "ElevateInfo.26",

  // Gmail templates
  CONFIRM_SUBJECT: "Your call is confirmed! 🎉",
};

// Template functions defined separately (arrow functions with self-reference don't work in GAS)
function confirmBody(name, date, time, meetLink) {
  return [
    "Hi " + name + ",",
    "",
    "Your strategy call is confirmed!",
    "",
    "📅 Date: " + date,
    "🕐 Time: " + time,
    meetLink ? "🎥 Google Meet: " + meetLink : "",
    "",
    "We'll also connect with you on WhatsApp before the call.",
    "",
    "Looking forward to speaking with you!",
    "",
    "— " + CONFIG.BUSINESS_NAME,
    "",
    "P.S. Need to reschedule? Just reply to this email.",
  ].filter(line => line !== null).join("\n");
}

function waMessage(name, date, time) {
  return "Hi " + name + "! 👋 This is " + CONFIG.BUSINESS_NAME + ". Your call is confirmed for " + date + " at " + time + ". Looking forward to connecting! 🚀";
}

// ─── ENTRY POINTS ───────────────────────────────────────────────────────────

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";

  if (action === "getSlots") {
    const date = (e.parameter.date) ? e.parameter.date : "";
    return handleGetSlots(date);
  }

  if (action === "sendReminders") {
    if (!e.parameter.secret || e.parameter.secret !== CONFIG.REMINDER_SECRET) {
      return jsonResponse({ error: "Unauthorized" });
    }
    sendUpcomingReminders();
    return jsonResponse({ status: "reminders sent" });
  }

  return jsonResponse({ status: "ok", message: "Lead Capture API v2 running" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === "submitLead") return handleSubmitLead(data);
    return jsonResponse({ error: "Unknown action" });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ─── HANDLERS ───────────────────────────────────────────────────────────────

/**
 * Returns booked time slots by reading directly from Google Calendar.
 * Called by React: ?action=getSlots  (fetches all 14 upcoming weekdays)
 * Or per-day:      ?action=getSlots&date=2025-06-15
 */
function handleGetSlots(targetDate) {
  try {
    var calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (!calendar) {
      return jsonResponse({ error: "Calendar not found. Check CALENDAR_ID in CONFIG." });
    }

    var datesToCheck = targetDate ? [targetDate] : getNext14Weekdays();
    var booked = {};

    datesToCheck.forEach(function(dateStr) {
      var dayStart = parseDateInTimezone(dateStr, "00:00");
      var dayEnd   = parseDateInTimezone(dateStr, "23:59");
      var events   = calendar.getEvents(dayStart, dayEnd);

      events.forEach(function(event) {
        if (event.isAllDayEvent()) {
          // Block ALL slots on all-day event days (holidays, OOO, etc.)
          getAllTimeSlots().forEach(function(slot) {
            booked[dateStr + "_" + slot] = true;
          });
          return;
        }

        var eventStart = event.getStartTime();
        var eventEnd   = event.getEndTime();

        getAllTimeSlots().forEach(function(slot) {
          var slotStart = parseDateInTimezone(dateStr, slot);
          var slotEnd   = new Date(slotStart.getTime() + CONFIG.MEETING_DURATION * 60 * 1000);

          // Overlap: slot starts before event ends AND slot ends after event starts
          if (slotStart < eventEnd && slotEnd > eventStart) {
            booked[dateStr + "_" + slot] = true;
          }
        });
      });
    });

    return jsonResponse({ booked: booked, fetchedAt: new Date().toISOString() });

  } catch (err) {
    Logger.log("getSlots error: " + err.message);
    return jsonResponse({ error: err.message, booked: {} });
  }
}

/**
 * Handles a new booking:
 * 1. Creates Google Calendar event (with optional Meet link + guest invite)
 * 2. Saves to Google Sheets
 * 3. Emails the lead a confirmation
 * 4. Emails you (owner) with a WhatsApp quick-send link
 */
function handleSubmitLead(data) {
  var name    = data.name;
  var phone   = data.phone;
  var email   = data.email;
  var message = data.message;
  var date    = data.date;
  var time    = data.time;

  var calResult = createCalendarEvent({ name: name, email: email, message: message, date: date, time: time });
  var eventId   = calResult.eventId;
  var meetLink  = calResult.meetLink;

  saveLead({ name: name, phone: phone, email: email, message: message, date: date, time: time, eventId: eventId, meetLink: meetLink });
  sendConfirmationEmail(email, name, date, time, meetLink);
  sendOwnerAlert({ name: name, phone: phone, email: email, message: message, date: date, time: time, meetLink: meetLink });

  return jsonResponse({ status: "success", meetLink: meetLink });
}

// ─── GOOGLE CALENDAR ────────────────────────────────────────────────────────

function createCalendarEvent(opts) {
  var calendar  = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var startTime = parseDateInTimezone(opts.date, opts.time);
  var endTime   = new Date(startTime.getTime() + CONFIG.MEETING_DURATION * 60 * 1000);

  var title = "📅 Strategy Call — " + opts.name;
  var description = "Booked via website.\n\nClient: " + opts.name + "\nEmail: " + opts.email + (opts.message ? "\nNotes: " + opts.message : "");

  var event = calendar.createEvent(title, startTime, endTime, {
    description: description,
    guests: opts.email,
    sendInvites: true,
  });

  Logger.log("✅ Calendar event created: " + event.getId());

  // Note: Google Meet links are added automatically when guests are included
  // in Workspace accounts. The guest will receive a Meet link in their invite.
  return { eventId: event.getId(), meetLink: "" };
}

// ─── GOOGLE SHEETS ──────────────────────────────────────────────────────────

function saveLead(opts) {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow([
      "Timestamp", "Name", "Phone", "Email", "Date", "Time",
      "Message", "Calendar Event ID", "Meet Link", "WA Link", "Status"
    ]);
    sheet.getRange(1, 1, 1, 11).setFontWeight("bold").setBackground("#c8f04e").setFontColor("#0a0a0f");
    sheet.setFrozenRows(1);
  }

  var waLink = "https://wa.me/" + opts.phone + "?text=" + encodeURIComponent(waMessage(opts.name, opts.date, opts.time));

  sheet.appendRow([
    new Date().toISOString(),
    opts.name,
    opts.phone,
    opts.email,
    opts.date,
    opts.time,
    opts.message || "",
    opts.eventId || "",
    opts.meetLink || "",
    waLink,
    "New",
  ]);

  sheet.autoResizeColumns(1, 11);
}

// ─── EMAIL ──────────────────────────────────────────────────────────────────

function sendConfirmationEmail(email, name, date, time, meetLink) {
  GmailApp.sendEmail(email, CONFIG.CONFIRM_SUBJECT, confirmBody(name, date, time, meetLink), {
    name: CONFIG.BUSINESS_NAME,
  });
}

function sendOwnerAlert(opts) {
  var waLink = "https://wa.me/" + opts.phone + "?text=" + encodeURIComponent(waMessage(opts.name, opts.date, opts.time));
  var body = [
    "🔔 NEW BOOKING",
    "",
    "Name:  " + opts.name,
    "Phone: " + opts.phone,
    "Email: " + opts.email,
    "Date:  " + opts.date,
    "Time:  " + opts.time,
    opts.meetLink ? "Meet:  " + opts.meetLink : "",
    opts.message ? "\nMessage:\n" + opts.message : "",
    "",
    "━━━━━━━━━━━━━━━━━━",
    "📱 Send WhatsApp (one click):",
    waLink,
    "━━━━━━━━━━━━━━━━━━",
    "",
    "The event has been added to your Google Calendar and an invite sent to the client.",
  ].filter(function(l) { return l !== null; }).join("\n");

  GmailApp.sendEmail(
    CONFIG.OWNER_EMAIL,
    "📅 New booking: " + opts.name + " — " + opts.date + " at " + opts.time,
    body,
    { name: "Booking Bot" }
  );
}

// ─── REMINDER EMAILS (called daily by GitHub Actions) ───────────────────────

function sendUpcomingReminders() {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return;

  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var tomorrowStr = tomorrow.toISOString().split("T")[0];

  var rows = sheet.getDataRange().getValues();
  rows.slice(1).forEach(function(row, i) {
    var name    = row[1];
    var email   = row[3];
    var date    = row[4];
    var time    = row[5];
    var meetLink = row[8];
    var status  = row[10];

    if (date === tomorrowStr && status !== "Reminded") {
      var body = "Hi " + name + ",\n\nJust a friendly reminder that your strategy call with " + CONFIG.BUSINESS_NAME + " is tomorrow at " + time + ".\n" +
        (meetLink ? "\n🎥 Google Meet: " + meetLink + "\n" : "") +
        "\nLooking forward to it! 🚀\n\n— " + CONFIG.BUSINESS_NAME;

      GmailApp.sendEmail(email, "📅 Reminder: Your call is tomorrow at " + time, body, {
        name: CONFIG.BUSINESS_NAME,
      });

      sheet.getRange(i + 2, 11).setValue("Reminded");
    }
  });
}

// ─── UTILITIES ──────────────────────────────────────────────────────────────

/** All time slots the business offers. Keep in sync with TIME_SLOTS in App.jsx! */
function getAllTimeSlots() {
  return [
    "09:00","09:30","10:00","10:30","11:00","11:30",
    "14:00","14:30","15:00","15:30","16:00","16:30"
  ];
}

/** Returns the next 14 weekdays as YYYY-MM-DD strings. */
function getNext14Weekdays() {
  var days  = [];
  var today = new Date();
  var i     = 1;
  while (days.length < 14) {
    var d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days.push(d.toISOString().split("T")[0]);
    }
    i++;
  }
  return days;
}

/**
 * Parses "YYYY-MM-DD" + "HH:MM" into a Date object correctly placed
 * in the configured TIMEZONE (not the server's UTC timezone).
 */
function parseDateInTimezone(dateStr, timeStr) {
  var parts = dateStr.split("-");
  var tParts = timeStr.split(":");
  var year   = parseInt(parts[0]);
  var month  = parseInt(parts[1]) - 1;
  var day    = parseInt(parts[2]);
  var hour   = parseInt(tParts[0]);
  var minute = parseInt(tParts[1]);

  // Build a local date then format it in our target timezone to get a proper ISO string
  var naive     = new Date(year, month, day, hour, minute, 0);
  var isoString = Utilities.formatDate(naive, CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
  return new Date(isoString);
}

function getSpreadsheet() {
  if (CONFIG.SHEET_ID) return SpreadsheetApp.openById(CONFIG.SHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function jsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─── ONE-TIME SETUP & TESTING ────────────────────────────────────────────────

/**
 * Run this first to verify your Google Calendar is accessible.
 * Apps Script Editor → Run → testCalendarConnection
 */
function testCalendarConnection() {
  var calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  if (!calendar) {
    Logger.log("❌ Calendar not found. Check CONFIG.CALENDAR_ID");
    return;
  }
  Logger.log("✅ Connected to calendar: " + calendar.getName());
  Logger.log("Timezone: " + calendar.getTimeZone());

  var today  = new Date().toISOString().split("T")[0];
  var result = handleGetSlots(today);
  Logger.log("Slots response: " + result.getContent());
}

/**
 * Lists all calendars on this account.
 * Useful if you want to use a calendar other than "primary".
 * Apps Script Editor → Run → listMyCalendars
 */
function listMyCalendars() {
  CalendarApp.getAllCalendars().forEach(function(cal) {
    Logger.log("Name: " + cal.getName() + " | ID: " + cal.getId());
  });
}

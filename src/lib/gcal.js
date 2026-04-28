// Google Calendar API helpers

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const CALENDAR_ID = 'primary';

let tokenClient = null;
let accessToken = null;

export function gcalReady() {
  return !!accessToken;
}

export function initGcal(onReady) {
  if (!CLIENT_ID) return;
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.onload = () => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.access_token) {
          accessToken = resp.access_token;
          localStorage.setItem('fss_gcal_token', resp.access_token);
          if (onReady) onReady(true);
        }
      },
    });
    const saved = localStorage.getItem('fss_gcal_token');
    if (saved) { accessToken = saved; if (onReady) onReady(true); }
  };
  document.head.appendChild(script);
}

export function connectGcal() {
  if (!tokenClient) return;
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

export function disconnectGcal() {
  accessToken = null;
  localStorage.removeItem('fss_gcal_token');
  if (window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
}

async function calendarFetch(method, path, body) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { accessToken = null; localStorage.removeItem('fss_gcal_token'); return null; }
  if (res.status === 204) return null;
  return res.json();
}

function jobToEvent(job, clientName) {
  const color = job.division === 'carpentry' ? '5' : '2'; // Banana=5, Sage=2
  const start = job.scheduled_date
    ? job.start_time
      ? { dateTime: `${job.scheduled_date}T${job.start_time}`, timeZone: 'America/Vancouver' }
      : { date: job.scheduled_date }
    : null;
  const end = job.scheduled_date
    ? job.end_time
      ? { dateTime: `${job.scheduled_date}T${job.end_time}`, timeZone: 'America/Vancouver' }
      : { date: job.scheduled_date }
    : null;

  return {
    summary: `${job.division === 'carpentry' ? 'Carpentry' : 'Soft Wash'} — ${job.title}`,
    location: job.property_address || '',
    description: `Client: ${clientName}\nJob: ${job.job_number}\n${job.notes || ''}`,
    colorId: color,
    start: start || { date: new Date().toISOString().slice(0, 10) },
    end: end || { date: new Date().toISOString().slice(0, 10) },
  };
}

export async function createCalendarEvent(job, clientName) {
  if (!accessToken) return null;
  const data = await calendarFetch(
    'POST',
    `/calendars/${CALENDAR_ID}/events`,
    jobToEvent(job, clientName)
  );
  return data?.id || null;
}

export async function updateCalendarEvent(eventId, job, clientName) {
  if (!accessToken || !eventId) return null;
  await calendarFetch(
    'PUT',
    `/calendars/${CALENDAR_ID}/events/${eventId}`,
    jobToEvent(job, clientName)
  );
}

export async function deleteCalendarEvent(eventId) {
  if (!accessToken || !eventId) return;
  await calendarFetch('DELETE', `/calendars/${CALENDAR_ID}/events/${eventId}`);
}

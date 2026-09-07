(() => {
  'use strict';
  const form = document.getElementById('rsvpForm');
  const status = document.getElementById('formStatus');
  const submit = document.getElementById('submitRsvp');
  const config = window.WEDDING_CONFIG || {};
  let pendingId = crypto.randomUUID();
  let sending = false;
  const showStatus = (message, kind = 'error') => {
    status.textContent = message;
    status.className = `status ${kind}`;
    status.hidden = false;
    status.focus();
  };
  const themeButton = document.getElementById('themeToggle');
  function applyTheme(daylight) {
    document.body.classList.toggle('daylight', daylight);
    themeButton.textContent = daylight ? 'Starlight ✧' : 'Daylight ☼';
    themeButton.setAttribute('aria-label', daylight ? 'Switch to starlight theme' : 'Switch to daylight theme');
  }
  try { applyTheme(localStorage.getItem('wedding_display_mode') === 'light'); } catch { /* Storage is optional. */ }
  themeButton.addEventListener('click', () => {
    const daylight = !document.body.classList.contains('daylight');
    applyTheme(daylight);
    try { localStorage.setItem('wedding_display_mode', daylight ? 'light' : 'night'); } catch { /* Storage is optional. */ }
  });
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('page-hidden', document.hidden));

  // The invitation secret stays in the URL fragment, never in a request URL or referrer.
  const fragment = new URLSearchParams(location.hash.slice(1));
  let inviteCode = fragment.get('invite') || '';
  if (!inviteCode) {
    try { inviteCode = sessionStorage.getItem('wedding_invite') || ''; } catch { /* Code can be entered manually. */ }
  }
  document.getElementById('inviteField').hidden = Boolean(inviteCode);
  if (inviteCode) {
    form.elements.invite_code.value = inviteCode;
    try { sessionStorage.setItem('wedding_invite', inviteCode); } catch { /* Optional convenience only. */ }
  }
  if (fragment.has('invite')) history.replaceState(null, '', location.pathname + location.search);
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl || '') && Boolean(config.supabaseAnonKey);
  if (!configured) {
    submit.disabled = true;
    showStatus('Online RSVPs are not available yet. Please contact Ciaran or Cheylin directly to reply.');
  }
  form.addEventListener('change', () => {
    const declined = form.elements.attending.value === 'no';
    document.getElementById('dietaryField').hidden = declined;
    form.elements.dietary_notes.disabled = declined;
  });
  // A new edit gets a new request ID; an unchanged retry keeps its ID if the reply was lost.
  form.addEventListener('input', () => { if (!sending) pendingId = crypto.randomUUID(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending || !configured || !form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    if (!values.first_name.trim() || !values.last_name.trim()) {
      showStatus('Please enter your first and last name.');
      return;
    }
    const payload = {
      p_request_id: pendingId,
      p_invite_code: values.invite_code.trim(),
      p_first_name: values.first_name.trim(),
      p_last_name: values.last_name.trim(),
      p_email: values.email.trim().toLowerCase(),
      p_attending: values.attending === 'yes',
      p_dietary_notes: values.attending === 'yes' ? (values.dietary_notes || '').trim() : '',
      p_message: values.message.trim(),
      p_website: values.website || ''
    };
    sending = true;
    const enabledControls = [...form.elements].filter(el => !el.disabled);
    enabledControls.forEach(el => { el.disabled = true; });
    submit.textContent = 'Sending your RSVP…';
    status.hidden = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/submit_wedding_rsvp`, {
        method: 'POST',
        headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.status !== 'received') {
        const messages = {
          INVALID_INVITATION: 'That invitation code wasn’t recognised. Please open the original link we sent you, or check the code with Ciaran or Cheylin.',
          DUPLICATE_RSVP: 'We already have a response for this name and email. To make a change, please contact Ciaran or Cheylin.',
          RATE_LIMITED: 'Too many responses have been sent recently. Please try again later, or contact Ciaran or Cheylin.',
          RSVPS_CLOSED: 'Online RSVPs are not available at the moment. Please contact Ciaran or Cheylin directly.',
          INVALID_RESPONSE: 'Please check your name, email and response, then try again.'
        };
        if (result?.message === 'INVALID_INVITATION') document.getElementById('inviteField').hidden = false;
        throw new Error(messages[result?.message] || 'We couldn’t confirm your RSVP. Your details are still here; please try again, or contact Ciaran or Cheylin.');
      }
      try { sessionStorage.setItem('wedding_invite', payload.p_invite_code); } catch { /* Optional. */ }
      form.hidden = true;
      document.getElementById('successActions').hidden = false;
      showStatus(payload.p_attending
        ? `Thank you, ${payload.p_first_name}! Your RSVP has been received. We can’t wait to celebrate with you.`
        : `Thank you for letting us know, ${payload.p_first_name}. Your RSVP has been received. We’ll miss you on the day!`, 'success');
    } catch (error) {
      showStatus(error.name === 'AbortError' || error instanceof TypeError
        ? 'We couldn’t confirm delivery. Please check your connection and try again. Retrying the same response won’t send it twice.'
        : error.message);
    } finally {
      clearTimeout(timer);
      sending = false;
      enabledControls.forEach(el => { el.disabled = false; });
      submit.textContent = 'Send RSVP ↗';
    }
  });
  document.getElementById('anotherGuest').addEventListener('click', () => {
    const code = form.elements.invite_code.value;
    const email = form.elements.email.value;
    form.reset();
    form.elements.invite_code.value = code;
    form.elements.email.value = email;
    form.elements.dietary_notes.disabled = false;
    document.getElementById('dietaryField').hidden = false;
    document.getElementById('successActions').hidden = true;
    status.hidden = true;
    form.hidden = false;
    pendingId = crypto.randomUUID();
    form.elements.first_name.focus();
  });
})();

(() => {
  'use strict';
  const config = window.WEDDING_CONFIG || {};
  const form = document.getElementById('rsvpForm');
  if (!form || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl || '') || !config.supabaseAnonKey) return;
  let viewRecorded = false;
  let viewPending = false;
  const pageViewId = crypto.randomUUID();
  const welcome = document.getElementById('guestWelcome');
  const welcomeForm = document.getElementById('welcomeForm');

  function closeWelcome() {
    welcome.close();
    document.body.classList.toggle('welcome-open', false);
  }
  async function identify(firstName, lastName) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      await fetch(`${config.supabaseUrl}/rest/v1/rpc/identify_wedding_visit`, {
        method: 'POST', keepalive: true, signal: controller.signal,
        headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_visit_id: pageViewId, p_invite_code: form.elements.invite_code.value.trim(), p_first_name: firstName, p_last_name: lastName })
      });
    } catch { /* A tracking failure must never hold up the invitation or prefill. */ }
    finally { clearTimeout(timer); }
  }

  async function record(eventType) {
    const code = form.elements.invite_code.value.trim();
    if (!code || (eventType === 'page_view' && (viewRecorded || viewPending))) return;
    if (eventType === 'page_view') viewPending = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/record_wedding_activity`, {
        method: 'POST', keepalive: true, signal: controller.signal,
        headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' },
        // Reuse this load's view ID if its acknowledgement was lost. Clicks get new IDs.
        body: JSON.stringify({ p_event_id: eventType === 'page_view' ? pageViewId : crypto.randomUUID(), p_invite_code: code, p_event_type: eventType, p_visit_id: pageViewId })
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.status === 'recorded' && eventType === 'page_view') viewRecorded = true;
    } catch { /* Activity is best effort and must never interrupt an RSVP. */ }
    finally {
      clearTimeout(timer);
      if (eventType === 'page_view') viewPending = false;
    }
  }

  void record('page_view');
  if (welcome && welcomeForm && typeof welcome.showModal === 'function') {
    welcomeForm.addEventListener('submit', event => {
      event.preventDefault();
      if (!welcomeForm.reportValidity()) return;
      const clean = value => value.trim().replace(/\s+/g, ' ');
      const firstName = clean(welcomeForm.elements.first_name.value);
      const lastName = clean(welcomeForm.elements.last_name.value);
      if (firstName || lastName) {
        if (firstName) form.elements.first_name.value = firstName;
        if (lastName) form.elements.last_name.value = lastName;
        form.dispatchEvent(new Event('input', { bubbles: true }));
        void identify(firstName, lastName);
      }
      closeWelcome();
    });
    document.getElementById('welcomeClose').addEventListener('click', closeWelcome);
    document.getElementById('welcomeSkip').addEventListener('click', closeWelcome);
    welcome.addEventListener('close', () => {
      document.body.classList.toggle('welcome-open', false);
      welcomeForm.reset(); // Names stay in the editable RSVP, not browser storage.
    });
    welcome.addEventListener('click', event => {
      if (event.target !== welcome) return;
      const box = welcome.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeWelcome();
    });
    if (form.elements.invite_code.value.trim()) {
      welcome.showModal();
      document.body.classList.toggle('welcome-open', true);
    }
  }
  form.elements.invite_code.addEventListener('change', () => { void record('page_view'); });
  document.querySelectorAll('a[href="#rsvp"]').forEach(link => {
    link.addEventListener('click', () => {
      void record('page_view');
      void record('rsvp_click');
    });
  });
})();

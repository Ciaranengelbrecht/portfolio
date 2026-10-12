(() => {
  'use strict';
  const config = window.WEDDING_CONFIG || {};
  const $ = id => document.getElementById(id);
  let session = null;
  let rows = [];
  let visibleRows = [];
  let busy = false;
  let generation = 0;
  const dateFormat = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Perth', dateStyle: 'medium', timeStyle: 'short' });
  const dayFormat = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Perth', dateStyle: 'medium' });
  function status(message, error = true) {
    $('adminStatus').textContent = message;
    $('adminStatus').className = `status ${error ? 'error' : 'success'}`;
    $('adminStatus').hidden = !message;
  }
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${config.supabaseUrl}${path}`, {
        ...options, cache: 'no-store', signal: controller.signal,
        headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}), ...options.headers }
      });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403
        ? 'Sign-in or access was denied. Check your organiser account details and try again.'
        : 'The request could not be completed. Please check your connection and try again.');
      return response.status === 204 ? null : response.json();
    } finally { clearTimeout(timer); }
  }
  function clearSession() {
    generation++;
    session = null;
    rows = [];
    visibleRows = [];
    $('responses').replaceChildren();
    renderActivity(null);
    $('dashboard').hidden = true;
    $('signOut').hidden = true;
    $('loginCard').hidden = false;
    $('loginForm').reset();
  }
  async function ensureSession() {
    if (!session) throw new Error('Please sign in again.');
    if (Date.now() >= session.expires_at * 1000 - 60000) {
      const currentGeneration = generation;
      try {
        const fresh = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) });
        if (currentGeneration !== generation) throw new Error('Please sign in again.');
        session = { ...fresh, expires_at: fresh.expires_at || Date.now() / 1000 + fresh.expires_in };
      } catch (error) {
        clearSession();
        status('Your session has expired. Please sign in again.');
        throw error;
      }
    }
  }
  function render() {
    $('total').textContent = rows.length;
    $('accepting').textContent = rows.filter(row => row.attending).length;
    $('declining').textContent = rows.filter(row => !row.attending).length;
    $('dietary').textContent = rows.filter(row => row.attending && row.dietary_notes.trim()).length;
    const search = $('search').value.trim().toLowerCase();
    const filter = $('filter').value;
    visibleRows = rows.filter(row =>
      (filter === 'all' || filter === 'yes' && row.attending || filter === 'no' && !row.attending || filter === 'dietary' && row.attending && row.dietary_notes.trim()) &&
      [row.first_name, row.last_name, `${row.first_name} ${row.last_name}`, row.email, row.dietary_notes, row.message].some(value => value.toLowerCase().includes(search)));
    const fragment = document.createDocumentFragment();
    visibleRows.forEach(row => {
      const tr = document.createElement('tr');
      [row.first_name + ' ' + row.last_name, row.email, row.attending ? 'Yes' : 'No', row.dietary_notes || '—', row.message || '—', dateFormat.format(new Date(row.created_at))].forEach(value => {
        const td = document.createElement('td');
        td.textContent = value; // Guest text must never be interpreted as HTML.
        tr.appendChild(td);
      });
      fragment.appendChild(tr);
    });
    $('responses').replaceChildren(fragment);
    $('resultCount').textContent = `${visibleRows.length} of ${rows.length} responses shown. CSV exports the current selection.`;
    $('empty').hidden = visibleRows.length > 0;
    $('empty').textContent = rows.length ? 'No responses match your filters.' : 'No responses yet. New RSVPs will appear here.';
    $('export').disabled = visibleRows.length === 0;
  }
  function renderActivity(activity, failed = false) {
    for (const [id, key] of [['pageViews', 'page_views'], ['rsvpClicks', 'rsvp_clicks'], ['todayViews', 'today_views'], ['todayClicks', 'today_clicks']]) {
      $(id).textContent = activity ? activity[key] : '—';
    }
    $('activityDays').replaceChildren();
    $('invitationVisits').replaceChildren();
    $('visitDetails').hidden = !activity?.visits?.length;
    $('namedVisitCount').textContent = activity && Number.isFinite(activity.named_visits)
      ? `${activity.named_visits} invitation ${activity.named_visits === 1 ? 'open' : 'opens'} with a shared name. Names are optional and repeat visits count separately.` : '';
    $('activityDetails').hidden = !activity?.days?.length;
    $('activityStatus').textContent = failed
      ? 'Activity counts could not be loaded. Your RSVPs are still shown below; use Refresh to try again.'
      : activity?.last_view ? `Latest invitation open: ${dateFormat.format(new Date(activity.last_view))} (Perth).`
      : activity ? 'No invitation opens have been recorded yet.' : '';
    (activity?.days || []).forEach(day => {
      const tr = document.createElement('tr');
      for (const value of [dayFormat.format(new Date(`${day.day}T00:00:00+08:00`)), day.page_views, day.rsvp_clicks]) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      }
      $('activityDays').appendChild(tr);
    });
    (activity?.visits || []).forEach(visit => {
      const tr = document.createElement('tr');
      const name = [visit.first_name, visit.last_name].filter(Boolean).join(' ') || 'Name not shared';
      for (const value of [name, dateFormat.format(new Date(visit.opened_at)), visit.rsvp_clicks]) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      }
      $('invitationVisits').appendChild(tr);
    });
  }
  async function refresh() {
    if (busy) return;
    busy = true;
    const currentGeneration = generation;
    $('refresh').disabled = true;
    $('export').disabled = true;
    try {
      await ensureSession();
      const organisers = await request('/rest/v1/wedding_organisers?select=user_id&limit=1');
      if (!organisers.length) throw new Error('This account has not been granted wedding organiser access.');
      const loaded = [];
      // Do not silently truncate the list at the API's maximum page size.
      for (let offset = 0; ; offset += 500) {
        const page = await request(`/rest/v1/wedding_responses?select=id,first_name,last_name,email,attending,dietary_notes,message,created_at&order=created_at.desc,id.desc&limit=500&offset=${offset}`);
        loaded.push(...page);
        if (page.length < 500) break;
      }
      let activity = null;
      try {
        activity = await request('/rest/v1/rpc/get_wedding_activity', { method: 'POST', body: '{}' });
        if (!activity || !Array.isArray(activity.days) || ['page_views', 'rsvp_clicks', 'today_views', 'today_clicks'].some(key => !Number.isFinite(activity[key]))) activity = null;
      } catch { /* RSVP responses remain available if activity cannot be loaded. */ }
      if (currentGeneration !== generation) return;
      rows = loaded;
      render();
      renderActivity(activity, !activity);
      $('loginCard').hidden = true;
      $('dashboard').hidden = false;
      $('signOut').hidden = false;
      $('updated').textContent = `Last refreshed: ${dateFormat.format(new Date())} (Perth).`;
      status('');
    } catch (error) {
      if (currentGeneration === generation) status(error.message);
      if (!$('dashboard').hidden) status('Refresh failed. The responses shown are from the last successful refresh. Please try again.');
    } finally {
      busy = false;
      $('refresh').disabled = false;
      $('export').disabled = !visibleRows.length;
    }
  }
  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    $('signIn').disabled = true;
    status('');
    try {
      if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('The wedding database connection has not been configured yet.');
      const data = new FormData(event.target);
      const result = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: data.get('email').trim(), password: data.get('password') }) });
      session = { ...result, expires_at: result.expires_at || Date.now() / 1000 + result.expires_in };
      $('loginForm').elements.password.value = '';
      $('signOut').hidden = false;
      await refresh();
    } catch (error) { status(error.message); }
    finally { $('signIn').disabled = false; }
  });
  $('signOut').addEventListener('click', () => {
    const logout = request('/auth/v1/logout?scope=local', { method: 'POST' });
    clearSession();
    status('Signed out on this device.', false);
    logout.catch(() => status('Signed out on this device. The server could not be reached to revoke the session.', false));
  });
  $('refresh').addEventListener('click', refresh);
  $('search').addEventListener('input', render);
  $('filter').addEventListener('change', render);
  $('export').addEventListener('click', () => {
    const quote = value => {
      let text = String(value ?? '');
      // Prevent spreadsheet formula execution, including leading whitespace/control characters.
      if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const csv = [['First name', 'Last name', 'Email', 'Attending', 'Dietary notes', 'Family & notes', 'Received (UTC)'],
      ...visibleRows.map(row => [row.first_name, row.last_name, row.email, row.attending ? 'Yes' : 'No', row.dietary_notes, row.message, row.created_at])]
      .map(row => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `wedding-rsvps-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  window.addEventListener('pagehide', clearSession);
})();

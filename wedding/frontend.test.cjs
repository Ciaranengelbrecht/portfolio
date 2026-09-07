const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');

class Element {
  constructor(value = '') {
    this.value = value; this.hidden = false; this.disabled = false; this.textContent = '';
    this.children = []; this.listeners = {}; this.attrs = {};
    const classes = new Set();
    this.classList = { toggle(name, on) { const next = on ?? !classes.has(name); next ? classes.add(name) : classes.delete(name); return next; }, contains(name) { return classes.has(name); } };
  }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  async emit(name, event = {}) { for (const fn of this.listeners[name] || []) await fn({ preventDefault() {}, target: this, ...event }); }
  setAttribute(k, v) { this.attrs[k] = v; }
  focus() { this.focused = true; }
  appendChild(el) { this.children.push(el); }
  replaceChildren(...children) { this.children = children; }
  click() { this.clicked = true; }
}
function harness(file, fetch, hash = '') {
  const els = {};
  const get = id => els[id] ||= new Element();
  const createForm = (id, values) => {
    const form = get(id);
    form.elements = Object.entries(values).map(([name, value]) => { const el = new Element(value); el.name = name; return el; });
    form.elements.forEach(el => { form.elements[el.name] = el; });
    form.reportValidity = () => true;
    form.reset = () => form.elements.forEach(el => { el.value = ''; });
    return form;
  };
  const form = createForm('rsvpForm', { first_name: 'First', last_name: 'Last', email: 'guest@local.test', attending: 'yes', dietary_notes: 'Vegetarian', message: 'Hello', invite_code: '', website: '' });
  form.elements.push(get('submitRsvp'));
  createForm('loginForm', { email: 'organiser@local.test', password: 'test-password' });
  ['dashboard', 'successActions', 'signOut', 'formStatus', 'adminStatus'].forEach(id => { get(id).hidden = true; });
  get('filter').value = 'all';
  const storage = new Map();
  const location = { hash, pathname: '/wedding/', search: '' };
  const blobUrls = [];
  const document = new Element();
  document.body = new Element();
  document.getElementById = get;
  document.createElement = () => new Element();
  document.createDocumentFragment = () => new Element();
  const sandbox = {
    document, location, history: { replaceState(_a, _b, value) { location.replaced = value; } },
    window: new Element(), localStorage: { getItem() { return null; }, setItem() {} },
    sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    crypto: webcrypto, URLSearchParams, AbortController, Intl, Date, TypeError, Error,
    setTimeout, clearTimeout, Blob,
    URL: { createObjectURL(blob) { blobUrls.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
    FormData: class { constructor(f) { this.values = f.elements.filter(el => el.name && !el.disabled).map(el => [el.name, el.value]); } [Symbol.iterator]() { return this.values[Symbol.iterator](); } get(name) { return this.values.find(([key]) => key === name)?.[1]; } },
    fetch
  };
  sandbox.window.WEDDING_CONFIG = { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'public-test-key' };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return { get, form, location, storage, sandbox, blobUrls };
}
const guestFile = 'public/wedding/wedding.js';
const adminFile = 'public/wedding/admin/admin.js';
const reply = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });

test('private link fills invitation, strips fragment and avoids exposing it in request URL', async () => {
  let request;
  const app = harness(guestFile, async (url, options) => { request = { url, options }; return reply({ status: 'received' }); }, '#invite=private-code');
  assert.equal(app.form.elements.invite_code.value, 'private-code');
  assert.equal(app.get('inviteField').hidden, true);
  assert.equal(app.location.replaced, '/wedding/');
  app.form.elements.message.value = '3 guests: First Last, Partner Last, Child Last.';
  await app.form.emit('submit');
  assert.equal(JSON.parse(request.options.body).p_message, '3 guests: First Last, Partner Last, Child Last.');
  assert.equal(request.url.includes('private-code'), false);
  assert.equal(JSON.parse(request.options.body).p_invite_code, 'private-code');
  assert.equal(app.form.hidden, true);
  assert.match(app.get('formStatus').textContent, /has been received/);
  await app.get('anotherGuest').emit('click');
  assert.equal(app.form.hidden, false);
  assert.equal(app.form.elements.first_name.value, '');
  assert.equal(app.form.elements.email.value, 'guest@local.test');
  assert.equal(app.form.elements.invite_code.value, 'private-code');
  assert.equal(app.get('inviteField').hidden, true);
  const directVisit = harness(guestFile, async () => reply({}));
  assert.equal(directVisit.get('inviteField').hidden, false);
});

test('network failure keeps inputs and reuses request ID on unchanged retry', async () => {
  const sent = [];
  const app = harness(guestFile, async (_url, options) => {
    sent.push(JSON.parse(options.body));
    if (sent.length === 1) throw new TypeError('offline');
    return reply({ status: 'received' });
  }, '#invite=private-code');
  await app.form.emit('submit');
  assert.equal(app.form.hidden, false);
  assert.equal(app.form.elements.first_name.value, 'First');
  assert.match(app.get('formStatus').textContent, /couldn’t confirm delivery/);
  await app.form.emit('submit');
  assert.equal(sent[0].p_request_id, sent[1].p_request_id);
  assert.equal(app.form.hidden, true);
});

test('double click produces one request and freezes inputs until confirmed', async () => {
  let finish; let calls = 0;
  const app = harness(guestFile, () => { calls++; return new Promise(resolve => { finish = resolve; }); }, '#invite=private-code');
  const sending = app.form.emit('submit');
  assert.equal(app.form.elements.first_name.disabled, true);
  await app.form.emit('submit');
  assert.equal(calls, 1);
  finish(reply({ status: 'received' }));
  await sending;
  assert.equal(app.form.elements.first_name.disabled, false);
});

test('invalid code exposes code field and never shows success', async () => {
  const app = harness(guestFile, async () => reply({ message: 'INVALID_INVITATION' }, false, 400), '#invite=wrong');
  await app.form.emit('submit');
  assert.equal(app.get('inviteField').hidden, false);
  assert.equal(app.form.hidden, false);
  assert.match(app.get('formStatus').textContent, /wasn’t recognised/);
});

test('an unrecognised 200 response cannot claim success', async () => {
  const app = harness(guestFile, async () => reply({}), '#invite=private-code');
  await app.form.emit('submit');
  assert.equal(app.form.hidden, false);
  assert.match(app.get('formStatus').textContent, /couldn’t confirm/);
});

test('declines omit dietary notes and another guest can fill them again', async () => {
  let payload;
  const app = harness(guestFile, async (_url, options) => { payload = JSON.parse(options.body); return reply({ status: 'received' }); }, '#invite=private-code');
  app.form.elements.attending.value = 'no';
  await app.form.emit('change');
  assert.equal(app.form.elements.dietary_notes.disabled, true);
  await app.form.emit('submit');
  assert.equal(payload.p_dietary_notes, '');
  assert.equal(payload.p_attending, false);
  assert.match(app.get('formStatus').textContent, /miss you/);
  await app.get('anotherGuest').emit('click');
  assert.equal(app.form.elements.dietary_notes.disabled, false);
});

test('edited retry gets a new request ID and a duplicate is explained', async () => {
  const sent = [];
  const app = harness(guestFile, async (_url, options) => { sent.push(JSON.parse(options.body)); return reply({ message: 'DUPLICATE_RSVP' }, false, 400); }, '#invite=private-code');
  await app.form.emit('submit');
  assert.match(app.get('formStatus').textContent, /already have a response/);
  app.form.elements.first_name.value = 'Changed';
  await app.form.emit('input');
  await app.form.emit('submit');
  assert.notEqual(sent[0].p_request_id, sent[1].p_request_id);
});

const sample = (n = 0) => ({ id: String(n), first_name: `First${n}`, last_name: 'Last', email: `guest${n}@local.test`, attending: true, dietary_notes: 'Vegetarian', message: '', created_at: '2026-09-07T00:00:00Z' });
test('admin fetches every page, filters, escapes guest text and exports safe CSV', async () => {
  const pages = [];
  const fixture = Array.from({ length: 501 }, (_v, n) => sample(n));
  fixture[500].first_name = '=1+1';
  fixture[500].message = '<img src=x onerror=alert(1)>';
  fixture[500].dietary_notes = '\t=HYPERLINK("bad")';
  const app = harness(adminFile, async (url, options) => {
    if (url.includes('/token?')) return reply({ access_token: 'auth-token', refresh_token: 'refresh-token', expires_in: 3600 });
    if (url.includes('/wedding_organisers')) return reply([{ user_id: 'organiser' }]);
    if (url.includes('/wedding_responses')) {
      assert.equal(options.headers.Authorization, 'Bearer auth-token');
      const offset = Number(new URL(url).searchParams.get('offset'));
      pages.push(offset); return reply(fixture.slice(offset, offset + 500));
    }
    return reply(null, true, 204);
  });
  await app.get('loginForm').emit('submit');
  assert.deepEqual(pages, [0, 500]);
  assert.equal(app.get('dashboard').hidden, false);
  assert.equal(app.get('total').textContent, 501);
  app.get('search').value = '=1+1';
  await app.get('search').emit('input');
  assert.match(app.get('resultCount').textContent, /1 of 501/);
  const tr = app.get('responses').children[0].children[0];
  assert.equal(tr.children[4].textContent, '<img src=x onerror=alert(1)>');
  await app.get('export').emit('click');
  const csv = await app.blobUrls[0].text();
  assert.match(csv, /"'=1\+1"/);
  assert.match(csv, /"'\t=HYPERLINK/);
  await app.get('signOut').emit('click');
  assert.equal(app.get('dashboard').hidden, true);
  assert.equal(app.get('responses').children.length, 0);
});

test('signed-in user without organiser membership cannot open dashboard', async () => {
  let responseRead = false;
  const app = harness(adminFile, async url => {
    if (url.includes('/token?')) return reply({ access_token: 'outsider-token', expires_in: 3600 });
    if (url.includes('/wedding_responses')) responseRead = true;
    return reply([]);
  });
  await app.get('loginForm').emit('submit');
  assert.equal(app.get('dashboard').hidden, true);
  assert.equal(responseRead, false);
  assert.match(app.get('adminStatus').textContent, /not been granted/);
});

test('expired admin session clears private data and explains the next step', async () => {
  const app = harness(adminFile, async url => {
    if (url.includes('grant_type=password')) return reply({ access_token: 'expired-token', refresh_token: 'expired-refresh', expires_at: 1 });
    return reply({}, false, 401);
  });
  await app.get('loginForm').emit('submit');
  assert.equal(app.get('dashboard').hidden, true);
  assert.equal(app.get('loginCard').hidden, false);
  assert.match(app.get('adminStatus').textContent, /session has expired/);
});

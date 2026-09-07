import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const emails = process.argv.slice(2);
if (!emails.length || emails.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
  throw new Error('Usage: node scripts/prepare-wedding-setup.mjs organiser@email.com [second@email.com]');
}
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const code = randomBytes(24).toString('base64url');
const hash = createHash('sha256').update(code).digest('hex');
const schema = (await readFile(root + 'wedding/schema.sql', 'utf8')).replace(/^begin;\s*$/m, '').replace(/^commit;\s*$/m, '');
const recipients = emails.map(email => quote(email.toLowerCase())).join(', ');
const sql = `-- Private activation file. Run in Supabase SQL Editor after creating the organiser Auth users.
-- All changes roll back if either organiser account is missing.
begin;
do $$ begin
  if (select count(*) from auth.users where lower(email) in (${recipients})) <> ${emails.length} then
    raise exception 'Create both organiser accounts under Authentication > Users first, then run this file again.';
  end if;
end $$;
${schema}
insert into wedding_private.settings (invite_hash) values (${quote(hash)});
insert into public.wedding_organisers (user_id)
select id from auth.users where lower(email) in (${recipients});
commit;
`;
await mkdir(root + 'wedding', { recursive: true });
// Refuse to replace an existing invite accidentally: rotating it requires a matching database change.
await writeFile(root + 'wedding/activate.local.sql', sql, { flag: 'wx', mode: 0o600 });
await writeFile(root + 'wedding/invitation.local.txt', `Guest RSVP link (keep private):\nhttps://ciaranengelbrecht.com/wedding/#invite=${code}\n\nInvitation code (if someone needs to enter it manually):\n${code}\n\nOrganiser dashboard:\nhttps://ciaranengelbrecht.com/wedding/admin/\n`, { flag: 'wx', mode: 0o600 });
console.log('Created wedding/activate.local.sql and wedding/invitation.local.txt. Keep both files private.');

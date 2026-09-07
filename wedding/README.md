# Wedding RSVP

The guest page is `public/wedding/index.html` → `/wedding/`. The organiser dashboard is `/wedding/admin/`. The invitation at `/weddinginvite/` is unchanged. This works with the existing GitHub Pages static export: Supabase provides the database and organiser authentication.

## Activate the existing Supabase project

Public connection settings have been copied from the existing Progress production configuration into `public/wedding/config.js`. No service-role key or organiser password belongs in that file.

1. Open that project in Supabase. Under **Authentication → Users**, make sure these accounts exist: `ciaran.engelbrecht@outlook.com` and `cheylin.manuel@outlook.com`. Create a missing account with a password and confirmed email using the dashboard. For an existing account, use its existing password; do not reset it without the account owner's agreement. These are application Auth users, distinct from a Supabase dashboard login.
2. Open the private file `wedding/activate.local.sql` and run it in the Supabase **SQL Editor**. It creates only wedding-specific tables, policies and the submission function. It grants organiser access to the two accounts. The transaction rolls back if either account is missing. Run once; it deliberately refuses to replace an existing setup.
3. Deploy the site through the existing GitHub Pages workflow (a push to `main` runs it). No deployment has been made by this change.
4. Open the guest URL from `wedding/invitation.local.txt`. Submit one real test RSVP, then sign in at `/wedding/admin/` and verify the entry and CSV. Remove the test row in the Supabase Table Editor before sending the link to guests.
5. Send the **full private guest link**, including `#invite=...`, to guests. An ordinary `/wedding/` visit asks for the code. Do not send the organiser dashboard link as the RSVP link.

The activation and invitation files are ignored by Git and live outside `public/` so they are not published. Store the invitation link privately. If those files are unavailable on another checkout, `node scripts/prepare-wedding-setup.mjs organiser@email.com second@email.com` generates a fresh pair for a **new, uninitialised** setup. Running the generator does not update an existing database.

## Guest link and QR code

Copy the complete URL from [invitation.local.txt](invitation.local.txt), including the `#invite=...` fragment, into your QR-code generator. The code is automatically filled and its field stays hidden when guests open that link, including during initial page load. Opening `/wedding/` without a supplied or remembered code shows the field; a rejected code also reveals it for correction. The URL is cleaned after opening, so use the saved private file rather than copying the address bar afterwards. Keep using the same saved link; these changes do not rotate its code.

## Guest behaviour

- One response may cover an individual, couple or family. The name/email fields identify the main contact. Guests list the total number, full names (including children), and any individual declines in Additional guests & notes. These details are stored in the existing `message` column; no database migration is needed.
- No meal choice. Dietary notes are included for attendees; declining omits them.
- Success is shown only when the server confirms storage. There is no local-only save or fake success fallback.
- An unchanged retry uses the same random request ID. Input remains on screen after network failure. Reloading does not preserve personal form details.
- The same normalised name and email cannot submit another response. Guests can email `ciaran.engelbrecht@outlook.com` using the link shown below the form and confirmation for corrections; an organiser can edit the row in Supabase's Table Editor. Guest submissions cannot overwrite earlier responses.
- Guests receive an on-screen confirmation. No confirmation or notification emails are sent.

## Organiser dashboard

Password sign-in is restricted by database policies to explicitly approved organiser IDs. Being a signed-in Progress user is not enough. View all responses, attendance totals and dietary notes; search/filter; refresh; export the current selection as CSV. Every page of results is fetched, rather than just the first 1,000 rows. CSV cells are protected against spreadsheet formula injection, and guest text is displayed as text, never HTML.

Sessions are held in memory, not local storage. Reloading requires sign-in again. Tokens refresh when fetching responses; sign-out clears the displayed guest data immediately. All dashboard totals count submissions, not individual people. Family names, headcounts and mixed attendance are recorded as free-text notes; review the Family & notes column or CSV to calculate the guest headcount. Dietary counts refer to accepting submissions with dietary notes. Times in the dashboard are Perth time; CSV timestamps are UTC. This is a response list, not an invitation roster: it cannot count people who have not replied.

## Spam protection and privacy

The database verifies a randomly generated 192-bit invitation code, stored only as a SHA-256 hash in a private schema. The link fragment is not sent to the web server and is removed from the address bar after loading; it is retained in session storage for navigation on that tab. No invitation code is bundled into the website.

Server-side validation, a honeypot, unique guest identities, and atomic submission limits (12 responses per email per hour; 500 total per rolling 24 hours) apply even if someone bypasses the form. Public clients cannot directly read, insert, edit or delete table rows. The privileged submission function has an empty search path and tightly scoped execute permissions. `noindex` and `no-referrer` reduce discovery/leakage but are not authentication.

A shared invitation link deters random bot submissions; someone who receives or is forwarded the valid link can submit invented names. It does not verify individual identities. If this becomes a problem, use individually issued guest codes or a server-verified CAPTCHA. No CAPTCHA account is required for the current setup. Rejected requests are not stored and do not count against accepted-response limits.

Close RSVPs with:

```sql
update wedding_private.settings set accepting_responses = false where singleton;
```

Reopen by setting it to `true`. To rotate a leaked invitation code, generate a new random secret and replace `invite_hash` with its SHA-256 hash in the SQL Editor, then send the new private link. Keep the secret out of source control. Change limits in `submit_wedding_rsvp` if needed.

## Validation

- `node --test wedding/frontend.test.cjs`: guest confirmation, failure/retry, duplicate clicks, invitation handling, dietary behaviour, admin access, pagination, filtering, CSV safety and sign-out using an isolated DOM harness. These are behaviour checks, not visual browser tests.
- `wedding/test-schema.sql`: run only on a disposable local PostgreSQL database. Creates mock Supabase roles/auth and checks actual SQL validation, RLS, organiser access, duplicates, idempotency and rate limits. Never run this test fixture on the production project.
- `DEPLOY_ENV=CUSTOM_DOMAIN npm run build`: static export including wedding assets.
- Before sending invitations, verify the full flow on the deployed site and visually inspect it on a phone. The in-app browser was unavailable during implementation.

Security references: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

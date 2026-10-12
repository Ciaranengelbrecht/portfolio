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

## Invitation activity

`wedding/activity.sql` adds tracking to an already activated database. It is independent of RSVP submissions and does not rotate the invitation code. Apply it once before publishing the updated page. For a fresh setup, activate `schema.sql` first, then apply `activity.sql`.

The admin page shows invitation opens, RSVP-link clicks, today's counts and daily activity for the past 14 days. It also lists the latest 100 opens, the name optionally shared on each visit and its RSVP-link clicks. It counts only visits carrying a valid invitation code, including a remembered code or one entered manually. An open is counted once per page load; each click on a link to `#rsvp` is counted. Scrolling to the form does not count as a link click. Repeated opens, organisers' own checks and forwarded links count, so these are **not unique guests**. Names are supplied by visitors and do not verify individual identities. Earlier visits cannot be reconstructed from this tracking.

Events contain a fresh random event ID, one of two event types and a server timestamp. From the name-prompt update on 12 October 2026, a temporary visit ID links clicks to their page open; first and last names plus a naming timestamp are saved on that open only when the welcome prompt is submitted with a name. No email addresses, invitation secrets, IP addresses, user agents or persistent visitor IDs are saved in the activity table. No tracking cookies or browser identifiers are added. Supabase and the hosting provider may maintain their own ordinary operational logs. The invitation secret is sent only in the Supabase request body for validation. Invalid secrets and unknown event types are rejected; event IDs prevent a repeated request from being counted twice. A separate atomic limit caps tracking at 1,000 events per rolling hour and 5,000 per rolling day. Failed or blocked tracking requests may leave a visit uncounted and never prevent an RSVP.

Activity reads use the existing wedding organiser membership and row-level security. Signed-in users of other apps cannot read counts. Refresh updates activity and RSVPs; an activity-service failure leaves the RSVP list usable and labels counts as unavailable. Dates and daily boundaries use Perth time.

Apply `wedding/activity-names.sql` once after `activity.sql`, before publishing the name-prompt update. It keeps existing activity and supports the earlier three-argument tracking API while adding visit association and optional names. Fresh setups need both files in that order.

The welcome dialog appears on a page load with a supplied or remembered invitation code. Guests may enter just a first name, both names, or neither. Continue prefills the nonempty name fields in the RSVP, where they remain editable, and sends the voluntarily supplied name to tracking. The ×, Skip for now, Escape and tapping the backdrop all dismiss without saving any name typed in the prompt. Clicking inside the dialog does not dismiss it. No name is stored in local/session storage, and submitting or dismissing the prompt does not send an RSVP. The tracking name is the opening-time snapshot; later edits to the RSVP are only saved with the actual submitted response. Older browsers without native modal-dialog support simply proceed to the page.

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
- `wedding/test-activity.sql`: run after `test-schema.sql` in the same disposable database to verify tracking permissions, invitation validation, idempotency, limits and Perth daily boundaries.
- `wedding/test-activity-names.sql`: run next in that disposable database to verify the upgrade keeps existing events, optional names, linked clicks, race handling and access restrictions. This fixture truncates local test activity; never run it on production.
- `DEPLOY_ENV=CUSTOM_DOMAIN npm run build`: static export including wedding assets.
- Before sending invitations, verify the full flow on the deployed site and visually inspect it on a phone. The in-app browser was unavailable during implementation.

Security references: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

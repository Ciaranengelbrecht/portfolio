# Supabase Setup (LiftLog)

1. Create a Supabase project

- Go to supabase.com > Sign in > New project
- Choose a strong database password (store safely). Region: any nearby.

2. Get your Project URL and Anon key

- In your project, open Settings > API
- Copy the Project URL (ends with .supabase.co)
- Copy the anon public key ("anon key")

3. Configure app environment

- Copy `.env.example` to `.env.local` for local development.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Keep separate Supabase projects/keys for staging and production when possible.

4. Create the database schema and policies

- In Supabase, go to SQL > New Query
- Paste the contents of `supabase.schema.sql` from this folder
- Click Run; you should see success messages

5. Enable Email auth

- Go to Authentication > Providers
- Ensure Email is enabled
- To allow instant account creation (no inbox confirmation step):
  - Go to Authentication > Providers > Email
  - Turn off `Confirm email`
  - Save changes
- If you keep confirmation enabled, users must confirm via email after sign-up (the app now supports resending confirmation emails)
- Under URL Configuration, add your site URL: `https://<yourname>.github.io/portfolio/progress/`
  - For local dev add: `http://localhost:5173`

6. Sign in with magic link

- In the app Settings page, enter your email and click "Send magic link"
- After clicking the link in your email, you should be signed in

7. Verify RLS works

- After signing in, try listing tables from the SQL editor with `select count(*) from sessions;`
- Only your rows (owner = your user id) will be visible

8. Deploy account deletion function

- Install/login to the Supabase CLI.
- Link the project:

```bash
supabase link --project-ref <project-ref>
```

- Deploy the function:

```bash
supabase functions deploy delete-account
```

- The function uses `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from the Supabase runtime.
- Verify deletion with a test account before store review.

9. Production settings checklist

- Enable daily database backups for production.
- Confirm Auth redirect URLs include:
  - `https://ciaranengelbrecht.com/progress/dist/`
  - `https://ciaranengelbrecht.com/progress/`
  - local dev URLs used for testing
- Review email templates for sign-up, magic link, and password reset.
- Check project rate limits and database quota before public beta.
- Keep RLS enabled on `profiles`, `exercises`, `sessions`, `measurements`, `templates`, and `settings`.

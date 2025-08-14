# Supabase Setup (LiftLog)

1. Create a Supabase project

- Go to supabase.com > Sign in > New project
- Choose a strong database password (store safely). Region: any nearby.

2. Get your Project URL and Anon key

- In your project, open Settings > API
- Copy the Project URL (ends with .supabase.co)
- Copy the anon public key ("anon key")

3. Paste into the app

- Edit `src/lib/config.ts`
- Replace SUPABASE_URL and SUPABASE_ANON_KEY with your values

4. Create the database schema and policies

- In Supabase, go to SQL > New Query
- Paste the contents of `supabase.schema.sql` from this folder
- Click Run; you should see success messages

5. Enable Email auth

- Go to Authentication > Providers
- Ensure Email is enabled; optional: disable Confirm email for faster dev
- Under URL Configuration, add your site URL: `https://<yourname>.github.io/portfolio/progress/`
  - For local dev add: `http://localhost:5173`

6. Sign in with magic link

- In the app Settings page, enter your email and click "Send magic link"
- After clicking the link in your email, you should be signed in

7. Verify RLS works

- After signing in, try listing tables from the SQL editor with `select count(*) from sessions;`
- Only your rows (owner = your user id) will be visible

Tip: Keep Gist backups enabled if you want extra redundancy.

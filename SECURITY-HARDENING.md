# Security hardening notes

## Applied
- No secret/service-role/SOOP access token was found in the client bundle. The Supabase publishable key remains client-side by design.
- Guestbook submissions now enter `pending`; they are not publicly visible until an admin approves them.
- Fan-art Storage is constrained to 6 MB and PNG/JPEG/WEBP/GIF at the Supabase bucket and RLS layer, and public inserts are restricted to `submissions/`.
- Added Vercel security headers: CSP, HSTS, frame denial, nosniff, referrer policy, and permissions policy.
- External new-tab links now use `noopener noreferrer`.
- Fan-art preview DOM construction no longer uses HTML interpolation.

## Required deployment step
Run the updated `supabase_schema.sql` in the Supabase SQL Editor so the RLS/bucket changes actually take effect. Redeploy the project to Vercel so `vercel.json` headers take effect.

## Remaining architectural risk
Anonymous direct writes still allow resource-abuse attempts against guestbook/fan-art and viewer-sample endpoints. RLS limits what can be written but is not a true rate limiter. For stronger abuse resistance, route anonymous writes through a server-side endpoint protected by rate limiting / bot verification, then revoke anon INSERT policies.

The current `soop_viewer_samples` browser INSERT policy also means a determined caller can submit fabricated viewer counts. Treat these statistics as non-authoritative until collection is moved to a trusted server-side job/API.

Never place SOOP Client Secret, OAuth access/refresh tokens, or Supabase service-role keys in HTML/JS/config.js. Store secrets only in Vercel server-side environment variables.

# Drama Me

Vertical short-story site for dramame.net. Episodes are 1:00–1:30. A story is 60–75 episodes. Playback is a vertical scroll: finish one episode, it unlocks, scroll up into the next.

This Next.js app lives in `dramame/` beside the Calliotel client. It does not replace that app. No series has been chosen, and this build does not generate video.

## Run locally

```bash
cd dramame
npm install
npm run dev
```

Open http://localhost:3000.

Email and password work with no API keys. With `DATABASE_URL` unset, accounts are stored in `data/dramame.db` (SQLite, created on first use). Passwords are scrypt hashes. See Database below for Postgres.

```bash
npm test
npm run build
```

## Environment

Copy `.env.example` to `.env.local` if you want to set values. `next dev` runs without that file.

| Variable | Needed for |
| --- | --- |
| `AUTH_SECRET` | Production sessions. Dev uses a built-in secret when this is empty. |
| `AUTH_URL` | Reset and verification links. Defaults from the request host. |
| `AUTH_TRUST_HOST` | Host header trust behind a proxy. |
| `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` | Continue with Google (Auth.js). |
| `AUTH_FACEBOOK_ID` and `AUTH_FACEBOOK_SECRET` | Continue with Facebook (Auth.js). |
| `AUTH_APPLE_ID` and `AUTH_APPLE_SECRET` | Continue with Apple (Auth.js). `AUTH_APPLE_SECRET` is the Apple client-secret JWT. |
| `ADMIN_EMAIL` | Signed-in email allowed to open `/admin`. Leave blank and that page stays unavailable. |
| `RESEND_API_KEY` | Resend API key. Leave blank and mail is not sent. |
| `EMAIL_FROM` | Verified sender address, for example `noreply@dramame.net`. |
| `DATABASE_URL` | Postgres connection string. Required in production. Leave blank locally to use SQLite. |

If a provider’s id or secret is missing, its button stays on **Not configured** and does not start OAuth. Instagram is not a login. Footer and account follow links stay hidden until `lib/social.ts` has real profile URLs.

## Database

`DATABASE_URL` is a Postgres connection string. Production uses Postgres. On the first request that uses the database, the app creates its tables. There is no migration command, and `npm run build` does not migrate.

Local `npm run dev` uses SQLite at `data/dramame.db` when `DATABASE_URL` is unset. That file is created on first use.

To use Postgres on your machine, set `DATABASE_URL` in `.env.local` and restart `npm run dev`.

## Email

Verification and password-reset messages are sent with [Resend](https://resend.com).

`RESEND_API_KEY` is the Resend API key. `EMAIL_FROM` is the sender address, and it must be a verified sender. The dramame.net domain needs that sender verified in Resend before mail can go out — for example `noreply@dramame.net`.

If either variable is unset, `sendEmail` does nothing. Sign-up, resend verification, email changes, and forgot-password still finish, and local development still shows the link.

## Password reset and verification

When Resend is configured, the app emails the link. When it is not, nothing is sent. In local development (`next dev`):

- The reset link is shown on the forgot-password screen.
- The same URL is printed in the server log as `[dramame] reset link for …`.
- Verification links show on the account page and in the server log.

Production does not print those links.

## Routes

- `/` landing
- `/genres` `/studio` `/how-it-works` `/pricing` `/faq` `/suggestions`
- `/signup` `/login` `/forgot-password` `/reset-password` `/verify-email`
- `/account` `/account/profile` `/account/password` `/account/connected` `/account/notifications` `/account/delete`
- `/help` `/contact` `/about` `/privacy` `/terms` `/cookies`
- `/search` `/library` `/series/preview`
- `/admin` dashboard for the signed-in `ADMIN_EMAIL`, plus `/admin/users`, `/admin/suggestions`, `/admin/messages`, `/admin/queue`, and `/admin/requests`. Anyone else sees a 404-style page. Leave `ADMIN_EMAIL` blank and those pages stay unavailable.
- unknown paths use the 404 page

Contact address on the contact page: hello@dramame.net.

Plans are listed on `/pricing`. No payment is taken yet. There is no checkout.

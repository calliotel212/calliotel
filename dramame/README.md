# dramame

Vertical short-story site for dramame.net. Episodes are 1:00–1:30. A story is 60–75 episodes. Playback is a vertical scroll: finish one episode, it unlocks, scroll up into the next.

This Next.js app lives in `dramame/` beside the Calliotel client. It does not replace that app. No series has been chosen, and this build does not generate video.

## Run locally

```bash
cd dramame
npm install
npm run dev
```

Open http://localhost:3000.

Email and password work with no API keys. Accounts are stored in `dramame/data/dramame.db` (SQLite, created on first use). Passwords are scrypt hashes.

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

If a provider’s id or secret is missing, its button stays on **Not configured** and does not start OAuth. Instagram is not a login. Footer and account follow links are placeholder profile URLs in `lib/social.ts`.

## Password reset and verification

This demo does not send email. In local development (`next dev`):

- The reset link is shown on the forgot-password screen.
- The same URL is printed in the server log as `[dramame] reset link for …`.
- Verification links show on the account page and in the server log.

Production does not print those links.

## Routes

- `/` landing
- `/signup` `/login` `/forgot-password` `/reset-password` `/verify-email`
- `/account` `/account/profile` `/account/password` `/account/connected` `/account/notifications` `/account/delete`
- `/help` `/contact` `/about` `/privacy` `/terms` `/cookies`
- `/search` `/library` `/series/preview`
- unknown paths use the 404 page

Contact address on the contact page: hello@dramame.net.

There are no payments, coins, or a paywall.

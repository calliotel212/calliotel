# Calliotel

**Virtual numbers · Voice calls · SMS · OTP · HQ proxy**

Live: [https://calliotel.com](https://calliotel.com)

Calliotel is a black-and-yellow communications shop. Clients buy a number, place and receive calls, read SMS, get one-time OTPs, and rent a dedicated proxy in the same country as the number.

## For clients

| Product | What you get | Where |
| --- | --- | --- |
| **Numbers** | Local / international DID with SMS where available | [Browse numbers](https://calliotel.com/browse-numbers) |
| **Calls** | App keypad, inbound/outbound, voicemail | [Keypad](https://calliotel.com/keypad) |
| **One-time OTP** | Disposable numbers for 800+ apps | [OTP](https://calliotel.com/one-otp) |
| **Proxy** | HQ IPv4 dedicated (HTTP + SOCKS5), wallet checkout | [Proxy](https://calliotel.com/proxy) |
| **Wallet** | Card and crypto credits | [Buy credits](https://calliotel.com/buy-credits) |

Use a proxy/VPN in the **same country** as the virtual number for WhatsApp and similar signups. Do not put calliotel.com itself behind a rented proxy.

## Brand

- Yellow `#F5A623`
- Black `#000000`
- Site: calliotel.com

## Repo map

```
src/                     Web app (React)
_server_backend/         API routers (OTP, proxy, billing, calls)
public/                  Static assets
dramame/                 dramame.net site (separate Next.js app)
```

The Calliotel client in `src/` is unchanged. dramame.net lives in `dramame/` so the two products do not share a UI. See `dramame/README.md` to run it.

Secrets stay off GitHub: `.env`, API keys, and production credentials are gitignored.

## Local frontend

```bash
npm install
# copy env vars your team already uses — never commit .env
npm start
```

## Safety

This repository does not include live Stripe, Telnyx, SMSPVA, or wallet keys. Production runs on Calliotel’s server. Do not force-push or wipe databases.

---

© Calliotel · [calliotel.com](https://calliotel.com)

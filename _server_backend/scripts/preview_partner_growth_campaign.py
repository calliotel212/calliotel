"""Generate local previews for the compliant Calliotel partner campaign.

This script never connects to MongoDB, Resend, push services, or Telegram.
It only writes local HTML/text previews for review before any campaign is sent.

Usage:
    python scripts/preview_partner_growth_campaign.py
"""

from html import escape
from pathlib import Path


CAMPAIGN_ID = "partner_growth_pilot_sep2026"
LANDING_URL = "https://calliotel.com/reseller-program"

TOUCHES = [
    {
        "key": "introduction",
        "subject": "Build recurring revenue with virtual business numbers",
        "headline": "Launch a telecom service under your own brand",
        "body": (
            "Calliotel partners can serve verified businesses that need dedicated "
            "sales, support, property-management, and customer-service phone lines."
        ),
        "push_title": "Partner with Calliotel",
        "push_body": "Serve real businesses with branded virtual-number services.",
    },
    {
        "key": "business_plans",
        "subject": "Three ways to grow with Calliotel",
        "headline": "Choose the partner model that fits your business",
        "body": (
            "Start with customer sub-accounts, grow into agency volume, or apply "
            "for a white-label storefront. Approval and compliance checks apply."
        ),
        "push_title": "Explore partner plans",
        "push_body": "Starter, agency, and white-label options are available.",
    },
    {
        "key": "application",
        "subject": "Ready to apply for the Calliotel partner pilot?",
        "headline": "Turn customer relationships into recurring service revenue",
        "body": (
            "Apply for the partner pilot and tell us about your legitimate business "
            "use case. There is no application fee and no guaranteed earnings claim."
        ),
        "push_title": "Partner applications are open",
        "push_body": "Apply free and describe your business use case.",
    },
]


def render_email(touch: dict) -> str:
    subject = escape(touch["subject"])
    headline = escape(touch["headline"])
    body = escape(touch["body"])
    return f"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{subject}</title></head>
<body style="margin:0;background:#07090d;color:#fff;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#10141b;border:1px solid #263128;border-radius:20px">
        <tr><td style="padding:34px">
          <div style="color:#22c55e;font-size:12px;font-weight:800;letter-spacing:1.4px">CALLIOTEL PARTNER PILOT</div>
          <h1 style="font-size:30px;line-height:1.2;margin:14px 0">{headline}</h1>
          <p style="color:#b8c0cc;font-size:16px;line-height:1.7">{body}</p>
          <p style="color:#b8c0cc;font-size:15px;line-height:1.7">
            Partner services are for lawful business communications. Number availability,
            identity requirements, messaging registration, and wholesale pricing vary.
          </p>
          <a href="{LANDING_URL}" style="display:inline-block;margin-top:12px;padding:14px 24px;border-radius:10px;background:#22c55e;color:#07100a;text-decoration:none;font-weight:800">View partner plans</a>
        </td></tr>
        <tr><td style="padding:20px 34px;border-top:1px solid #263128;color:#7f8997;font-size:11px">
          Calliotel · <a href="https://calliotel.com/unsubscribe" style="color:#9aa5b5">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def render_text(touch: dict) -> str:
    return (
        f"{touch['subject']}\n\n"
        f"{touch['headline']}\n\n"
        f"{touch['body']}\n\n"
        "For lawful business communications only. Availability, identity requirements, "
        "messaging registration, and pricing vary.\n\n"
        f"View partner plans: {LANDING_URL}\n"
        "Unsubscribe: https://calliotel.com/unsubscribe\n"
    )


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "previews" / CAMPAIGN_ID
    output.mkdir(parents=True, exist_ok=True)

    summary = []
    for index, touch in enumerate(TOUCHES, start=1):
        stem = f"{index:02d}-{touch['key']}"
        (output / f"{stem}.html").write_text(render_email(touch), encoding="utf-8")
        (output / f"{stem}.txt").write_text(render_text(touch), encoding="utf-8")
        summary.append(
            f"{stem}\n"
            f"Push: {touch['push_title']} — {touch['push_body']}\n"
            f"Telegram: {touch['headline']}\n{touch['body']}\n{LANDING_URL}\n"
        )

    (output / "channel-copy.txt").write_text("\n".join(summary), encoding="utf-8")
    print(f"Generated local-only campaign previews in {output}")


if __name__ == "__main__":
    main()

"""
Disposable / temporary / fake email-domain blocker.

Goal: stop ad spend on visitors who sign up with throwaway addresses
they will never check, top up, or buy from.

The list below covers the top ~250 widely-used disposable / temp / spam
mailbox providers (mailinator, guerrillamail, tempmail, yopmail, etc.)
plus a few caught directly in our own ad traffic (pmdeal.com, spotshops.com).

Maintenance: add new domains to DISPOSABLE_DOMAINS as you spot them in
production data. Comparison is case-insensitive.
"""
from __future__ import annotations

DISPOSABLE_DOMAINS: frozenset[str] = frozenset({
    # ── Caught in our own ad traffic ───────────────────────────────
    "pmdeal.com", "spotshops.com",

    # ── 10-minute / temp-mail providers ────────────────────────────
    "10minutemail.com", "10minutemail.net", "10minemail.com", "10minutemail.de",
    "20minutemail.com", "30minutemail.com", "33mail.com",
    "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
    "guerrillamail.biz", "guerrillamail.info", "guerrillamailblock.com",
    "grr.la", "sharklasers.com", "spam4.me",
    "mailinator.com", "mailinator.net", "mailinator2.com", "mailinator.org",
    "binkmail.com", "bobmail.info", "chammy.info", "devnullmail.com",
    "letthemeatspam.com", "mailinater.com", "mailinator.us", "mailtothis.com",
    "notmailinator.com", "reallymymail.com", "reconmail.com",
    "safetymail.info", "sogetthis.com", "spamherelots.com", "spamhereplease.com",
    "thisisnotmyrealemail.com", "tradermail.info", "veryrealemail.com",
    "zippymail.info",

    # ── Yopmail family ─────────────────────────────────────────────
    "yopmail.com", "yopmail.net", "yopmail.fr", "cool.fr.nf",
    "courriel.fr.nf", "jetable.fr.nf", "moncourrier.fr.nf",
    "monemail.fr.nf", "monmail.fr.nf",

    # ── temp-mail / tempmail.* / tmail / fakemail family ───────────
    "temp-mail.org", "temp-mail.io", "temp-mail.ru", "tempmail.com",
    "tempmail.net", "tempmail.de", "tempmail.us", "tempmailo.com",
    "tempmailaddress.com", "tempmailer.com", "tempmailer.de",
    "temp-mail.com", "tempinbox.com", "tempemail.net", "tempemail.com",
    "tempmail.email", "tempr.email", "tempm.com", "temporarily.de",
    "temporarymail.com", "throwam.com", "throwawaymail.com",
    "throwawayemailaddresses.com", "trbvm.com", "trashmail.com",
    "trashmail.net", "trashmail.de", "trashmail.io", "trashmail.me",
    "trashmail.ws", "trashinbox.com", "trbvn.com", "tmail.ws",
    "tmail.com", "fakeinbox.com", "fakemail.fr", "fakemail.net",
    "fakemailgenerator.com", "fakeemail.de", "dispostable.com",

    # ── Burner / privacy mailboxes & well-known temp providers ─────
    "burnermail.io", "anonbox.net", "anonymbox.com", "anonymousmail.org",
    "deadaddress.com", "dropmail.me", "emailondeck.com", "emailtemporario.com.br",
    "incognitomail.com", "incognitomail.org", "instant-mail.de",
    "maildrop.cc", "mail-temp.com", "mailcatch.com", "mailde.de",
    "maildump.tk", "mailexpire.com", "mailfa.tk", "mailforspam.com",
    "mailfreeonline.com", "mailmoat.com", "mailnesia.com", "mailnull.com",
    "mailspeed.ru", "mailtemp.info", "mailtome.de", "meltmail.com",
    "moakt.com", "mt2014.com", "mytrashmail.com", "no-spam.ws",
    "nospam.ze.tc", "objectmail.com", "spambog.com", "spambog.de",
    "spambog.ru", "spambox.us", "spamfree24.com", "spamfree24.de",
    "spamfree24.eu", "spamfree24.info", "spamfree24.net", "spamfree24.org",
    "spamgourmet.com", "spamgourmet.net", "spamgourmet.org", "spaml.de",
    "spam.la", "trashymail.com", "wegwerfemail.de", "wegwerfmail.de",
    "wegwerfmail.net", "wegwerfmail.org", "yapped.net",

    # ── Snapmail / minutemail / hidemail / etc. ────────────────────
    "snapmail.cc", "minutemail.com", "minuteinbox.com", "hidemail.de",
    "harakirimail.com", "imgof.com", "mt2009.com", "mt2015.com",
    "rcpt.at", "stuffmail.de", "tafmail.com", "tagyourself.com",
    "talkinator.com", "thisisnotmyrealemail.com", "toiea.com",
    "tradermail.info", "veryrealemail.com", "zippymail.info",
    "spamspot.com", "spamthis.co.uk", "spaml.com",

    # ── Generic throwaway TLDs / lookalikes ────────────────────────
    "fakeemailgenerator.com", "fastmail.cn", "garbagemail.org",
    "mail-temporaire.fr", "mailtemp.fr", "yourdomain.com",
    "trash-amil.com", "trash-mail.at", "trash-mail.com", "trash-mail.de",
    "trash2009.com", "trash2010.com", "trash2011.com",

    # ── Recently active throwaway domains 2024-2026 ────────────────
    "mvrht.com", "moakt.cc", "tutye.com", "tafoi.gr", "1secmail.com",
    "1secmail.net", "1secmail.org", "esiix.com", "wwjmp.com",
    "etranquil.net", "letmeinmail.com", "ezehe.com", "dcctb.com",
    "kuruoshi.com", "ckiso.com", "mailpoof.com", "smaillz.com",
    "emltmp.com", "emlhub.com", "pokemail.net", "tempr.email",
    "tempinbox.xyz", "qq.com.spam", "evopo.com", "armyspy.com",
    "cuvox.de", "dayrep.com", "einrot.com", "fleckens.hu",
    "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com",
    "teleworm.us",
})


def is_disposable_email(email: str | None) -> bool:
    """Return True if the email's domain is on the disposable blocklist."""
    if not email or "@" not in email:
        return False
    try:
        domain = email.rsplit("@", 1)[1].strip().lower()
    except IndexError:
        return False
    if not domain:
        return False
    if domain in DISPOSABLE_DOMAINS:
        return True
    # Catch sub-domain abuse (e.g. inbox.mailinator.com)
    parts = domain.split(".")
    for i in range(1, len(parts)):
        candidate = ".".join(parts[i:])
        if candidate in DISPOSABLE_DOMAINS:
            return True
    return False


_GMAIL_DOMAINS: frozenset[str] = frozenset({"gmail.com", "googlemail.com"})


def normalize_email(email: str | None) -> str | None:
    """
    Return the canonical form of an email for duplicate-account detection.

    Rules applied:
      • Lowercase the whole address.
      • For Gmail / Googlemail:
          – Strip dots from the local part  (j.o.h.n → john)
          – Strip everything after a +      (john+spam → john)
      • For all providers: strip + alias from local part.

    The normalized form is ONLY used for duplicate checks — we always
    store and display the original email the user typed.
    """
    if not email or "@" not in email:
        return email
    email = email.strip().lower()
    local, domain = email.rsplit("@", 1)

    # Strip + alias for all providers (common abuse vector)
    local = local.split("+")[0]

    # Strip dots for Gmail family (dots are ignored by Google)
    if domain in _GMAIL_DOMAINS:
        local = local.replace(".", "")

    return f"{local}@{domain}"

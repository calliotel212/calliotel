"""Public funnel: scrape a business URL and return an AI-style audit report."""

from __future__ import annotations

import json
import re
import socket
import ssl
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from app.schemas.audit import WebsiteAuditResponse
from app.services.llm_client import llm_model_for_provider, resolve_llm_provider

SCRAPE_TIMEOUT = 10.0
TEXT_SNIPPET_MAX = 4000

_PRIVATE_NETS = (
    re.compile(r"^127\."),
    re.compile(r"^10\."),
    re.compile(r"^192\.168\."),
    re.compile(r"^172\.(1[6-9]|2\d|3[01])\."),
    re.compile(r"^0\."),
    re.compile(r"^localhost$", re.I),
    re.compile(r"\.local$", re.I),
)


@dataclass
class ScrapeResult:
    title: str | None
    meta_description: str | None
    h1s: list[str]
    text_snippet: str
    response_time_ms: int
    ssl_valid: bool
    final_url: str
    error: str | None = None


def normalize_website_url(raw: str) -> str:
    raw = raw.strip()
    if not raw.startswith(("http://", "https://")):
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must use http or https")
    if not parsed.netloc:
        raise ValueError("Invalid website URL")
    host = parsed.hostname or ""
    for pat in _PRIVATE_NETS:
        if pat.search(host):
            raise ValueError("URL host is not allowed")
    try:
        addrinfos = socket.getaddrinfo(host, None)
        for info in addrinfos:
            ip = info[4][0]
            if ip.startswith("127.") or ip == "0.0.0.0":
                raise ValueError("URL host is not allowed")
            octets = ip.split(".")
            if len(octets) == 4:
                a, b = int(octets[0]), int(octets[1])
                if a == 10 or (a == 172 and 16 <= b <= 31) or (a == 192 and b == 168):
                    raise ValueError("URL host is not allowed")
    except socket.gaierror as exc:
        raise ValueError("Could not resolve website host") from exc
    return parsed.geturl()


def _compute_site_score(
    *,
    ssl_valid: bool,
    title: str | None,
    meta_description: str | None,
    response_time_ms: int,
    content_length: int,
) -> int:
    score = 0
    score += 25 if ssl_valid else 5
    score += 15 if title and title.strip() else 0
    score += 15 if meta_description and meta_description.strip() else 0
    if response_time_ms < 1000:
        score += 25
    elif response_time_ms < 3000:
        score += 15
    elif response_time_ms < 10000:
        score += 5
    if content_length >= 500:
        score += 20
    elif content_length >= 100:
        score += 10
    return max(1, min(100, score))


def scrape_website(url: str) -> ScrapeResult:
    ssl_valid = url.lower().startswith("https://")
    start = time.perf_counter()
    try:
        with httpx.Client(
            timeout=SCRAPE_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": "CalliotelAdsFindAudit/1.0 (+https://calliotel.ai/advertise)"},
        ) as client:
            resp = client.get(url)
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        final_url = str(resp.url)
        ssl_valid = final_url.lower().startswith("https://") and resp.status_code < 500

        if final_url.lower().startswith("https://"):
            try:
                parsed = urlparse(final_url)
                host = parsed.hostname
                if host:
                    ctx = ssl.create_default_context()
                    with socket.create_connection((host, 443), timeout=5) as sock:
                        with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                            cert = ssock.getpeercert()
                            ssl_valid = bool(cert)
            except OSError:
                ssl_valid = False

        soup = BeautifulSoup(resp.text, "html.parser")
        title = soup.title.string.strip() if soup.title and soup.title.string else None
        meta_tag = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
        meta_description = None
        if meta_tag and meta_tag.get("content"):
            meta_description = str(meta_tag["content"]).strip()
        h1s = [h.get_text(strip=True) for h in soup.find_all("h1") if h.get_text(strip=True)][:5]
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = " ".join(soup.get_text(separator=" ", strip=True).split())
        snippet = text[:TEXT_SNIPPET_MAX]

        return ScrapeResult(
            title=title,
            meta_description=meta_description,
            h1s=h1s,
            text_snippet=snippet,
            response_time_ms=elapsed_ms,
            ssl_valid=ssl_valid,
            final_url=final_url,
        )
    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        return ScrapeResult(
            title=None,
            meta_description=None,
            h1s=[],
            text_snippet="",
            response_time_ms=elapsed_ms,
            ssl_valid=ssl_valid,
            final_url=url,
            error=str(exc),
        )


def _hostname_keywords(url: str) -> list[str]:
    host = (urlparse(url).hostname or "").lower()
    parts = re.split(r"[.\-_/]", host)
    return [p for p in parts if len(p) > 2]


def _industry_from_context(url: str, text: str) -> str:
    blob = f"{url} {text}".lower()
    if any(k in blob for k in ("car", "auto", "rental", "vehicle", "fleet")):
        return "car_rental"
    if any(k in blob for k in ("lebanon", ".lb", "beirut", "jounieh")):
        return "lebanon_local"
    if any(k in blob for k in ("hotel", "hospitality", "resort")):
        return "hospitality"
    if any(k in blob for k in ("plumb", "hvac", "repair")):
        return "home_services"
    return "general"


def _mock_insights(
    url: str,
    scrape: ScrapeResult,
    *,
    site_score: int,
) -> tuple[str, list[str], list[str]]:
    industry = _industry_from_context(url, scrape.text_snippet)
    host = urlparse(scrape.final_url).hostname or "your site"
    keywords_found = set(_hostname_keywords(url))
    for word in re.findall(r"[a-z]{4,}", scrape.text_snippet.lower())[:80]:
        keywords_found.add(word)

    templates: dict[str, dict[str, Any]] = {
        "car_rental": {
            "missing": [
                "airport pickup",
                "weekly rate",
                "insurance included",
                "same-day booking",
                "fleet size",
            ],
            "competitors": (
                f"Competitors in the {host} niche often rank for “airport transfer”, "
                "unlimited mileage, and Arabic/English landing pages. Top listings emphasize "
                "instant WhatsApp quotes and Google Maps embeds on the homepage."
            ),
            "ads": [
                "Target voice queries like “rent a car near the airport today”.",
                "Lead with daily rate + deposit in the first line of ad copy.",
                "Geo-bid Lebanon + UAE if you serve both markets.",
            ],
        },
        "lebanon_local": {
            "missing": [
                "Beirut delivery",
                "LBP / USD pricing",
                "WhatsApp booking",
                "neighborhood service area",
                "Arabic meta description",
            ],
            "competitors": (
                "Local Lebanese advertisers win on trust signals: Lebanese phone numbers, "
                ".lb domain or clear Beirut address, and bilingual (AR/EN) hero copy. "
                "Competitors also run AI-voice placements for “near me” intents."
            ),
            "ads": [
                "Use country target LB and language ar,en on AdsFind campaigns.",
                "Highlight fast response and cash/card options in sponsored snippets.",
                "Bid on intent phrases that mention Beirut, Jounieh, or airport corridors.",
            ],
        },
        "hospitality": {
            "missing": ["free cancellation", "breakfast included", "sea view", "check-in time"],
            "competitors": (
                "Hospitality peers optimize for seasonal offers and OTA price-match language. "
                "Strong sites surface reviews, direct-booking discounts, and mobile-first photos."
            ),
            "ads": [
                "Promote direct-booking savings vs. aggregators in ad copy.",
                "Target weekend getaways and business-travel intents separately.",
            ],
        },
        "home_services": {
            "missing": ["24/7 emergency", "licensed & insured", "service area map", "flat-rate pricing"],
            "competitors": (
                "Home-service leaders use click-to-call, same-day slots, and before/after proof. "
                "They capture “emergency” long-tail keywords competitors miss."
            ),
            "ads": [
                "Bid higher on urgent-intent phrases (leak, AC down, no hot water).",
                "Show response-time SLA in the sponsored blurb.",
            ],
        },
        "general": {
            "missing": [
                "clear value proposition",
                "primary CTA above the fold",
                "trust badges",
                "localized keywords",
            ],
            "competitors": (
                f"Sites like {host} compete on clarity: a strong H1, meta description, and "
                "HTTPS are table stakes. Category leaders add FAQ schema and FAQ-style ad copy "
                "for AI assistants."
            ),
            "ads": [
                "Mirror your best H1 as the brand line in AdsFind.",
                "Test intent-led copy vs. brand-led copy on voice placements.",
            ],
        },
    }
    pack = templates.get(industry, templates["general"])
    missing = [k for k in pack["missing"] if k.lower() not in scrape.text_snippet.lower()]
    if site_score < 50:
        missing = missing + ["improve page speed", "fix SSL / HTTPS"][:2]
    return pack["competitors"], missing[:8], pack["ads"]


def _fetch_llm_insights(url: str, scrape: ScrapeResult) -> tuple[str, list[str], list[str]] | None:
    provider_info = resolve_llm_provider()
    if not provider_info:
        return None
    provider, endpoint, api_key = provider_info
    model = llm_model_for_provider(provider)
    prompt = {
        "role": "user",
        "content": (
            "You are an AdsFind marketing analyst. Given scraped website data, return ONLY JSON "
            'with keys: competitor_insights (string), missing_keywords (array of strings), '
            "ad_recommendations (array of strings). Be specific to the business and geography.\n\n"
            f"URL: {url}\n"
            f"Title: {scrape.title}\n"
            f"Meta: {scrape.meta_description}\n"
            f"H1s: {scrape.h1s}\n"
            f"Text excerpt: {scrape.text_snippet[:2500]}"
        ),
    }
    try:
        with httpx.Client(timeout=25.0) as client:
            resp = client.post(
                endpoint,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [{"role": "system", "content": "Output valid JSON only."}, prompt],
                    "temperature": 0.4,
                    "response_format": {"type": "json_object"},
                },
            )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        return (
            str(parsed.get("competitor_insights", "")),
            [str(x) for x in parsed.get("missing_keywords", [])][:12],
            [str(x) for x in parsed.get("ad_recommendations", [])][:8],
        )
    except Exception:
        return None


def run_website_audit(website_url: str) -> WebsiteAuditResponse:
    url = normalize_website_url(website_url)
    scrape = scrape_website(url)
    content_len = len(scrape.text_snippet)
    site_score = _compute_site_score(
        ssl_valid=scrape.ssl_valid,
        title=scrape.title,
        meta_description=scrape.meta_description,
        response_time_ms=scrape.response_time_ms,
        content_length=content_len,
    )
    if scrape.error:
        site_score = max(1, min(site_score, 45))

    llm = _fetch_llm_insights(url, scrape)
    if llm:
        competitor_insights, missing_keywords, ad_recommendations = llm
    else:
        competitor_insights, missing_keywords, ad_recommendations = _mock_insights(
            url, scrape, site_score=site_score
        )

    return WebsiteAuditResponse(
        website_url=scrape.final_url,
        site_score=site_score,
        ssl_status="Valid" if scrape.ssl_valid else "Invalid",
        missing_keywords=missing_keywords,
        competitor_insights=competitor_insights,
        ad_recommendations=ad_recommendations,
        response_time_ms=scrape.response_time_ms,
        title=scrape.title,
    )
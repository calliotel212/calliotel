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

from app.schemas.audit import SeoHealth, TrafficEstimate, WebsiteAuditResponse
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

_LLM_SYSTEM = (
    "You are a Senior Digital Marketing & SEO Director at an enterprise intelligence firm. "
    "Given scraped website data, return ONLY strict JSON (no markdown) with exactly these keys:\n"
    '- "overall_score": integer 1-100\n'
    '- "traffic_estimate": object with "level" (Low|Medium|High) and "reason" (string)\n'
    '- "seo_health": object with "score" (1-100), "issues" (array of strings), "quick_wins" (array of strings)\n'
    '- "competitor_insights": array of strings (each a distinct insight, not one paragraph)\n'
    '- "ai_ad_recommendations": array of strings\n'
    '- "missing_keywords": array of strings\n'
    "Be specific to the business, geography, and SERP competition."
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


def _traffic_level(overall: int, content_len: int) -> TrafficEstimate:
    if overall >= 70 and content_len >= 400:
        return TrafficEstimate(
            level="High",
            reason="Strong technical foundation and substantive on-page content suggest headroom for branded and mid-funnel queries.",
        )
    if overall >= 45:
        return TrafficEstimate(
            level="Medium",
            reason="Baseline discoverability is present; expanding keyword coverage and trust signals should lift impressions.",
        )
    return TrafficEstimate(
        level="Low",
        reason="Thin or slow pages plus weak metadata typically cap organic reach until core SEO fixes ship.",
    )


def _seo_health_from_scrape(scrape: ScrapeResult, overall: int) -> SeoHealth:
    issues: list[str] = []
    quick_wins: list[str] = []
    if not scrape.ssl_valid:
        issues.append("HTTPS / SSL not fully trusted")
        quick_wins.append("Force HTTPS and renew TLS certificate")
    if not scrape.title:
        issues.append("Missing or empty <title> tag")
        quick_wins.append("Add a keyword-rich title under 60 characters")
    if not scrape.meta_description:
        issues.append("No meta description")
        quick_wins.append("Write a compelling meta description with primary intent phrase")
    if not scrape.h1s:
        issues.append("No H1 heading detected")
        quick_wins.append("Add one clear H1 that states your core offer")
    if scrape.response_time_ms > 3000:
        issues.append(f"Slow TTFB ({scrape.response_time_ms} ms)")
        quick_wins.append("Compress images and enable CDN caching")
    if len(scrape.text_snippet) < 200:
        issues.append("Thin body copy for crawlers")
        quick_wins.append("Expand above-the-fold copy with FAQs and local modifiers")
    if not issues:
        issues.append("Monitor Core Web Vitals on mobile")
    if not quick_wins:
        quick_wins.append("Add FAQ schema for AI search surfaces")
    seo_score = max(1, min(100, overall - (5 if scrape.error else 0)))
    return SeoHealth(score=seo_score, issues=issues[:8], quick_wins=quick_wins[:8])


def _competitor_bullets(long_text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", long_text.strip())
    bullets = [p.strip() for p in parts if len(p.strip()) > 20]
    return bullets[:6] if bullets else [long_text.strip() or "Category leaders invest in local trust and fast mobile UX."]


def _mock_report(url: str, scrape: ScrapeResult, overall_score: int) -> dict[str, Any]:
    industry = _industry_from_context(url, scrape.text_snippet)
    host = urlparse(scrape.final_url).hostname or "your site"

    templates: dict[str, dict[str, Any]] = {
        "car_rental": {
            "missing": [
                "airport pickup",
                "weekly rate",
                "insurance included",
                "same-day booking",
                "fleet size",
            ],
            "competitors": [
                f"Rivals serving {host} rank for airport transfer and unlimited mileage intents.",
                "Top listings pair WhatsApp quotes with embedded Google Maps on the homepage.",
                "Aggregator sites capture price-shoppers; direct sites win on deposit transparency.",
            ],
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
            "competitors": [
                "Lebanese advertisers win on trust: local numbers, Beirut address, bilingual hero copy.",
                "Competitors run AI-voice placements for “near me” and district-specific intents.",
                ".lb domains and Arabic snippets improve CTR on mobile SERPs.",
            ],
            "ads": [
                "Use country target LB and language ar,en on AdsFind campaigns.",
                "Highlight fast response and cash/card options in sponsored snippets.",
                "Bid on intent phrases that mention Beirut, Jounieh, or airport corridors.",
            ],
        },
        "hospitality": {
            "missing": ["free cancellation", "breakfast included", "sea view", "check-in time"],
            "competitors": [
                "Peers optimize seasonal offers and OTA price-match language.",
                "Strong sites surface reviews, direct-booking discounts, and mobile-first photos.",
            ],
            "ads": [
                "Promote direct-booking savings vs. aggregators in ad copy.",
                "Target weekend getaways and business-travel intents separately.",
            ],
        },
        "home_services": {
            "missing": ["24/7 emergency", "licensed & insured", "service area map", "flat-rate pricing"],
            "competitors": [
                "Home-service leaders use click-to-call and same-day slots.",
                "They capture “emergency” long-tail keywords competitors miss.",
            ],
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
            "competitors": [
                f"Sites like {host} compete on clarity: H1, meta, and HTTPS are table stakes.",
                "Category leaders add FAQ schema and AI-assistant-friendly Q&A blocks.",
            ],
            "ads": [
                "Mirror your best H1 as the brand line in AdsFind.",
                "Test intent-led copy vs. brand-led copy on voice placements.",
            ],
        },
    }
    pack = templates.get(industry, templates["general"])
    text_lower = scrape.text_snippet.lower()
    missing = [k for k in pack["missing"] if k.lower() not in text_lower]
    if overall_score < 50:
        missing = missing + ["improve page speed", "fix SSL / HTTPS"][:2]

    content_len = len(scrape.text_snippet)
    return {
        "overall_score": overall_score,
        "traffic_estimate": _traffic_level(overall_score, content_len).model_dump(),
        "seo_health": _seo_health_from_scrape(scrape, overall_score).model_dump(),
        "competitor_insights": pack["competitors"],
        "ai_ad_recommendations": pack["ads"],
        "missing_keywords": missing[:8],
    }


def _parse_llm_payload(parsed: dict[str, Any], fallback_overall: int) -> dict[str, Any] | None:
    try:
        overall = int(parsed.get("overall_score", fallback_overall))
        overall = max(1, min(100, overall))
    except (TypeError, ValueError):
        overall = fallback_overall

    te = parsed.get("traffic_estimate") or {}
    if isinstance(te, str):
        traffic = TrafficEstimate(level="Medium", reason=te)
    else:
        level = te.get("level", "Medium")
        if level not in ("Low", "Medium", "High"):
            level = "Medium"
        traffic = TrafficEstimate(level=level, reason=str(te.get("reason", "Estimated from page signals.")))

    sh = parsed.get("seo_health") or {}
    try:
        seo_score = int(sh.get("score", overall))
        seo_score = max(1, min(100, seo_score))
    except (TypeError, ValueError):
        seo_score = overall
    seo = SeoHealth(
        score=seo_score,
        issues=[str(x) for x in sh.get("issues", [])][:12],
        quick_wins=[str(x) for x in sh.get("quick_wins", [])][:12],
    )

    raw_ci = parsed.get("competitor_insights", [])
    if isinstance(raw_ci, str):
        competitor_insights = _competitor_bullets(raw_ci)
    else:
        competitor_insights = [str(x) for x in raw_ci][:12]

    ads_key = "ai_ad_recommendations" if "ai_ad_recommendations" in parsed else "ad_recommendations"
    ai_ads = [str(x) for x in parsed.get(ads_key, [])][:12]
    missing = [str(x) for x in parsed.get("missing_keywords", [])][:12]

    return {
        "overall_score": overall,
        "traffic_estimate": traffic.model_dump(),
        "seo_health": seo.model_dump(),
        "competitor_insights": competitor_insights,
        "ai_ad_recommendations": ai_ads,
        "missing_keywords": missing,
    }


def _fetch_llm_report(url: str, scrape: ScrapeResult, *, fallback_overall: int) -> dict[str, Any] | None:
    provider_info = resolve_llm_provider()
    if not provider_info:
        return None
    provider, endpoint, api_key = provider_info
    model = llm_model_for_provider(provider)
    prompt = {
        "role": "user",
        "content": (
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
                    "messages": [{"role": "system", "content": _LLM_SYSTEM}, prompt],
                    "temperature": 0.35,
                    "response_format": {"type": "json_object"},
                },
            )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        report = _parse_llm_payload(parsed, fallback_overall)
        if report and report.get("ai_ad_recommendations"):
            return report
        return None
    except Exception:
        return None


def _build_response(
    scrape: ScrapeResult,
    report: dict[str, Any],
) -> WebsiteAuditResponse:
    overall = int(report["overall_score"])
    traffic = TrafficEstimate(**report["traffic_estimate"])
    seo = SeoHealth(**report["seo_health"])
    competitor_insights = list(report["competitor_insights"])
    ai_ads = list(report["ai_ad_recommendations"])
    missing = list(report["missing_keywords"])
    legacy_summary = " ".join(competitor_insights)

    return WebsiteAuditResponse(
        website_url=scrape.final_url,
        overall_score=overall,
        traffic_estimate=traffic,
        seo_health=seo,
        competitor_insights=competitor_insights,
        ai_ad_recommendations=ai_ads,
        missing_keywords=missing,
        ssl_status="Valid" if scrape.ssl_valid else "Invalid",
        response_time_ms=scrape.response_time_ms,
        title=scrape.title,
        site_score=overall,
        ad_recommendations=ai_ads,
        competitor_insight=legacy_summary,
    )


def run_website_audit(website_url: str) -> WebsiteAuditResponse:
    url = normalize_website_url(website_url)
    scrape = scrape_website(url)
    content_len = len(scrape.text_snippet)
    overall_score = _compute_site_score(
        ssl_valid=scrape.ssl_valid,
        title=scrape.title,
        meta_description=scrape.meta_description,
        response_time_ms=scrape.response_time_ms,
        content_length=content_len,
    )
    if scrape.error:
        overall_score = max(1, min(overall_score, 45))

    llm_report = _fetch_llm_report(url, scrape, fallback_overall=overall_score)
    if llm_report:
        report = llm_report
    else:
        report = _mock_report(url, scrape, overall_score)

    if not report.get("missing_keywords"):
        report["missing_keywords"] = ["localized keywords", "primary CTA"]
    if not report.get("ai_ad_recommendations"):
        report["ai_ad_recommendations"] = ["Launch an AdsFind test campaign with intent-led copy."]

    return _build_response(scrape, report)
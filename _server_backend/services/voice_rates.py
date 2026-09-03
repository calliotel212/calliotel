"""
Destination-based outbound voice rates (retail USD / minute).

Longest-prefix match on E.164 country calling codes.
Rates include Calliotel margin over typical SIP trunking wholesale.
Unknown destinations fall back to DEFAULT_RATE (safe / higher).
"""
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

# Fallback when prefix is unknown — prefer not underpricing expensive destinations
DEFAULT_RATE = 0.15
DEFAULT_COUNTRY = "International"
DEFAULT_ISO = "XX"

# Inbound forwarded legs: bill by the forward destination when known,
# otherwise this flat rate.
INBOUND_DEFAULT_RATE = 0.05

# (prefix_digits_without_plus, rate_usd, country_name, iso2)
# Longer prefixes win. Keep NANP as "1" for v1 (US/CA/Caribbean share +1).
_RATE_ROWS: Tuple[Tuple[str, float, str, str], ...] = (
    # North America
    ("1", 0.02, "United States / Canada", "US"),
    # Western Europe
    ("44", 0.05, "United Kingdom", "GB"),
    ("33", 0.06, "France", "FR"),
    ("49", 0.05, "Germany", "DE"),
    ("39", 0.06, "Italy", "IT"),
    ("34", 0.06, "Spain", "ES"),
    ("31", 0.05, "Netherlands", "NL"),
    ("32", 0.06, "Belgium", "BE"),
    ("41", 0.07, "Switzerland", "CH"),
    ("43", 0.07, "Austria", "AT"),
    ("351", 0.07, "Portugal", "PT"),
    ("353", 0.06, "Ireland", "IE"),
    ("46", 0.06, "Sweden", "SE"),
    ("47", 0.06, "Norway", "NO"),
    ("45", 0.06, "Denmark", "DK"),
    ("358", 0.07, "Finland", "FI"),
    ("48", 0.06, "Poland", "PL"),
    ("420", 0.07, "Czech Republic", "CZ"),
    ("36", 0.08, "Hungary", "HU"),
    ("30", 0.08, "Greece", "GR"),
    ("40", 0.08, "Romania", "RO"),
    ("359", 0.09, "Bulgaria", "BG"),
    ("385", 0.09, "Croatia", "HR"),
    ("386", 0.09, "Slovenia", "SI"),
    ("421", 0.08, "Slovakia", "SK"),
    ("370", 0.09, "Lithuania", "LT"),
    ("371", 0.09, "Latvia", "LV"),
    ("372", 0.09, "Estonia", "EE"),
    ("352", 0.07, "Luxembourg", "LU"),
    ("356", 0.08, "Malta", "MT"),
    ("357", 0.09, "Cyprus", "CY"),
    # Eastern Europe / CIS
    ("7", 0.12, "Russia / Kazakhstan", "RU"),
    ("380", 0.12, "Ukraine", "UA"),
    ("375", 0.14, "Belarus", "BY"),
    ("373", 0.14, "Moldova", "MD"),
    ("374", 0.15, "Armenia", "AM"),
    ("995", 0.14, "Georgia", "GE"),
    ("994", 0.14, "Azerbaijan", "AZ"),
    # Middle East
    ("961", 0.20, "Lebanon", "LB"),
    ("972", 0.10, "Israel", "IL"),
    ("971", 0.12, "United Arab Emirates", "AE"),
    ("966", 0.14, "Saudi Arabia", "SA"),
    ("974", 0.14, "Qatar", "QA"),
    ("965", 0.14, "Kuwait", "KW"),
    ("973", 0.14, "Bahrain", "BH"),
    ("968", 0.15, "Oman", "OM"),
    ("962", 0.16, "Jordan", "JO"),
    ("963", 0.22, "Syria", "SY"),
    ("964", 0.22, "Iraq", "IQ"),
    ("98", 0.22, "Iran", "IR"),
    ("90", 0.10, "Turkey", "TR"),
    ("970", 0.20, "Palestine", "PS"),
    # Africa
    ("27", 0.10, "South Africa", "ZA"),
    ("20", 0.14, "Egypt", "EG"),
    ("212", 0.14, "Morocco", "MA"),
    ("213", 0.14, "Algeria", "DZ"),
    ("216", 0.14, "Tunisia", "TN"),
    ("234", 0.14, "Nigeria", "NG"),
    ("254", 0.12, "Kenya", "KE"),
    ("233", 0.14, "Ghana", "GH"),
    ("255", 0.14, "Tanzania", "TZ"),
    ("256", 0.14, "Uganda", "UG"),
    ("251", 0.16, "Ethiopia", "ET"),
    ("221", 0.16, "Senegal", "SN"),
    ("225", 0.16, "Ivory Coast", "CI"),
    # Asia Pacific
    ("81", 0.08, "Japan", "JP"),
    ("82", 0.08, "South Korea", "KR"),
    ("86", 0.06, "China", "CN"),
    ("852", 0.07, "Hong Kong", "HK"),
    ("853", 0.08, "Macau", "MO"),
    ("886", 0.08, "Taiwan", "TW"),
    ("65", 0.07, "Singapore", "SG"),
    ("60", 0.07, "Malaysia", "MY"),
    ("66", 0.08, "Thailand", "TH"),
    ("84", 0.08, "Vietnam", "VN"),
    ("63", 0.09, "Philippines", "PH"),
    ("62", 0.09, "Indonesia", "ID"),
    ("91", 0.05, "India", "IN"),
    ("92", 0.10, "Pakistan", "PK"),
    ("880", 0.10, "Bangladesh", "BD"),
    ("94", 0.10, "Sri Lanka", "LK"),
    ("977", 0.12, "Nepal", "NP"),
    ("95", 0.16, "Myanmar", "MM"),
    ("855", 0.12, "Cambodia", "KH"),
    ("856", 0.12, "Laos", "LA"),
    ("61", 0.06, "Australia", "AU"),
    ("64", 0.07, "New Zealand", "NZ"),
    # Latin America
    ("52", 0.06, "Mexico", "MX"),
    ("55", 0.07, "Brazil", "BR"),
    ("54", 0.08, "Argentina", "AR"),
    ("56", 0.08, "Chile", "CL"),
    ("57", 0.08, "Colombia", "CO"),
    ("51", 0.09, "Peru", "PE"),
    ("58", 0.12, "Venezuela", "VE"),
    ("593", 0.10, "Ecuador", "EC"),
    ("595", 0.10, "Paraguay", "PY"),
    ("598", 0.10, "Uruguay", "UY"),
    ("591", 0.12, "Bolivia", "BO"),
    ("502", 0.12, "Guatemala", "GT"),
    ("503", 0.12, "El Salvador", "SV"),
    ("504", 0.12, "Honduras", "HN"),
    ("505", 0.12, "Nicaragua", "NI"),
    ("506", 0.10, "Costa Rica", "CR"),
    ("507", 0.10, "Panama", "PA"),
    ("509", 0.16, "Haiti", "HT"),
    ("53", 0.30, "Cuba", "CU"),
    ("1809", 0.12, "Dominican Republic", "DO"),
    ("1829", 0.12, "Dominican Republic", "DO"),
    ("1849", 0.12, "Dominican Republic", "DO"),
    ("1876", 0.12, "Jamaica", "JM"),
    ("1787", 0.08, "Puerto Rico", "PR"),
    ("1939", 0.08, "Puerto Rico", "PR"),
)

# Precompute longest-first for matching
_PREFIXES_SORTED = sorted(_RATE_ROWS, key=lambda r: len(r[0]), reverse=True)


def _digits(phone: str) -> str:
    if not phone:
        return ""
    s = str(phone).strip().replace(" ", "")
    if s.startswith("00"):
        s = s[2:]
    if s.startswith("+"):
        s = s[1:]
    return "".join(ch for ch in s if ch.isdigit())


def lookup_voice_rate(phone: str) -> Dict[str, Any]:
    """
    Return retail rate info for a destination phone number.
    Always returns a dict with rate_per_min, country, iso, prefix, matched.
    """
    digits = _digits(phone)
    if not digits:
        return {
            "rate_per_min": DEFAULT_RATE,
            "country": DEFAULT_COUNTRY,
            "iso": DEFAULT_ISO,
            "prefix": None,
            "matched": False,
            "currency": "USD",
        }

    for prefix, rate, country, iso in _PREFIXES_SORTED:
        if digits.startswith(prefix):
            return {
                "rate_per_min": float(rate),
                "country": country,
                "iso": iso,
                "prefix": prefix,
                "matched": True,
                "currency": "USD",
            }

    return {
        "rate_per_min": DEFAULT_RATE,
        "country": DEFAULT_COUNTRY,
        "iso": DEFAULT_ISO,
        "prefix": None,
        "matched": False,
        "currency": "USD",
    }


def rate_for_number(phone: str) -> float:
    return float(lookup_voice_rate(phone)["rate_per_min"])


def estimate_minutes(balance: Optional[float], rate_per_min: float) -> int:
    if balance is None or rate_per_min <= 0:
        return 0
    return max(0, int(float(balance) // float(rate_per_min)))

"""
Shared phone-number validation utilities.

Both the API routes (calls.py) and the cleanup job use this module so the
validation contract is defined exactly once and stays in sync.
"""
import re

# Strict ITU E.164: + followed by a non-zero country-code digit, then 6–14
# more digits. Total: 7–15 digits. Allows no spaces, dashes, letters, or
# punctuation — those must be stripped before reaching the API.
E164_RE = re.compile(r"^\+[1-9]\d{6,14}$")


def is_valid_e164(number: str) -> bool:
    """Return True when *number* is a well-formed E.164 string."""
    if not number:
        return False
    return bool(E164_RE.match(number.strip()))


def is_invalid_e164(number: str) -> bool:
    """
    Return True when *number* is non-empty but fails E.164 validation.
    Catches: bare digit strings, +0 prefix, letters, spaces/punctuation,
    multiple plus signs, too-short, and overlength numbers.
    """
    if not number:
        return False  # empty — nothing to clean up
    return not is_valid_e164(number)


def get_invalid_reason(number: str) -> str:
    """
    Return a human-readable reason why *number* fails E.164 validation.
    Call only when is_invalid_e164(number) is True.
    Does not use the `re` module so it is safe to call without any import.
    """
    n = number.strip()
    if not n.startswith("+"):
        return "Number does not start with '+' — not in E.164 format (country code required)"
    if n.startswith("+0"):
        return "Number starts with +0 (no country code begins with 0)"
    digit_count = sum(c.isdigit() for c in n)
    if digit_count < 7:
        return "Number is too short to be a real phone number"
    if digit_count > 15:
        return "Number is too long (exceeds ITU E.164 maximum of 15 digits)"
    # Has correct prefix and digit count but contains non-digit characters
    return "Number contains invalid characters (letters, spaces, or punctuation) after the '+'"

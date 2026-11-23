"""Shared LLM provider resolution for OpenAI-compatible chat APIs."""

from __future__ import annotations

from app.core.config import settings


def resolve_llm_provider() -> tuple[str, str, str] | None:
    """Return ``(provider_name, chat_completions_url, api_key)`` or None.

    Priority: DeepSeek, then OpenAI, then Groq (first configured key wins).
    """
    if settings.deepseek_api_key.strip():
        return (
            "deepseek",
            "https://api.deepseek.com/v1/chat/completions",
            settings.deepseek_api_key.strip(),
        )
    if settings.openai_api_key.strip():
        return (
            "openai",
            "https://api.openai.com/v1/chat/completions",
            settings.openai_api_key.strip(),
        )
    if settings.groq_api_key.strip():
        return (
            "groq",
            "https://api.groq.com/openai/v1/chat/completions",
            settings.groq_api_key.strip(),
        )
    return None


def llm_model_for_provider(provider: str) -> str:
    if provider == "groq":
        return "llama-3.3-70b-versatile"
    if provider == "deepseek":
        return "deepseek-chat"
    return "gpt-4o-mini"
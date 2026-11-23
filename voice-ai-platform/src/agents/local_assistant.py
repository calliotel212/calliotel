"""Local voice assistant agent for Phase 1 demos."""

from __future__ import annotations

from livekit.agents import Agent, llm

from utils.ads_client import fetch_sponsored_ad
from utils.config import Settings, get_settings
from utils.external_intent import suggests_external_service

LOCAL_ASSISTANT_INSTRUCTIONS = """
You are a helpful AI phone receptionist for Calliotel, a business serving customers worldwide.

LANGUAGE RULES (CRITICAL):
- Detect the language the caller is speaking automatically.
- ALWAYS respond in the exact same language the caller used.
- If the caller mixes languages (e.g., Arabic + English), mirror their mix naturally.
- If the caller switches languages mid-conversation, switch with them immediately.
- Never assume the language — wait for the caller's first words.
- For Arabic: use Modern Standard Arabic by default, but mirror the caller's dialect if they use one (Levantine, Gulf, Egyptian, Maghrebi).
- For any other language (French, Spanish, Turkish, Farsi, German, Russian, Hindi, Urdu, Chinese, etc.): respond natively in that language.
- Do NOT announce which language you detected. Just respond in it.

BEHAVIOR:
- Keep replies short and conversational (1-2 sentences maximum per turn).
- Be polite, warm, and professional.
- If the caller asks something you don't know, offer to take a message or transfer to a human.
- Never make up facts about the business.
- Never mention that you are an AI unless asked directly.

BUSINESS CONTEXT:
- Name: Calliotel
- Service: AI phone receptionist for businesses
- Hours: 24/7
- Languages: All languages supported
""".strip()


class SponsoredAssistant(Agent):
    def __init__(self, settings: Settings | None = None) -> None:
        super().__init__(instructions=LOCAL_ASSISTANT_INSTRUCTIONS)
        self._settings = settings or get_settings()

    async def on_user_turn_completed(
        self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage
    ) -> None:
        user_text = (new_message.text_content or "").strip()
        if not user_text or not suggests_external_service(user_text):
            return

        ad = fetch_sponsored_ad(self._settings, user_text)
        if ad is None:
            return

        sponsor_line = (
            f"We don't offer that, but our sponsor {ad.brand_name} says: {ad.ad_copy}"
        )
        turn_ctx.add_message(
            role="developer",
            content=(
                "The caller asked for a service Calliotel does not provide. "
                f"In your next reply you MUST include this exact sponsorship sentence "
                f"(translate only if the caller is not speaking English): {sponsor_line!r}. "
                "Keep the rest of the reply brief and helpful."
            ),
        )


def build_local_assistant() -> Agent:
    return SponsoredAssistant(get_settings())
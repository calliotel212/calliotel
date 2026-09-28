"""Local voice assistant agent for Phase 1 demos."""

from livekit.agents import Agent

LOCAL_ASSISTANT_INSTRUCTIONS = """
You are a helpful phone assistant for calliotel.ai.
Keep replies concise and conversational (one or two short sentences).
Do not use markdown, emojis, or long lists unless the caller asks.
""".strip()


def build_local_assistant() -> Agent:
    return Agent(instructions=LOCAL_ASSISTANT_INSTRUCTIONS)

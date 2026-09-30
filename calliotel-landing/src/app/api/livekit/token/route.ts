import { NextRequest, NextResponse } from "next/server";
import { checkDemoTokenRateLimit } from "@/lib/demo-rate-limit";
import { mintDemoRoomToken, readLiveKitEnv } from "@/lib/livekit-server";

export const runtime = "nodejs";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const rate = checkDemoTokenRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "Too many demo requests from your network. Please try again shortly.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const env = readLiveKitEnv();
  if (!env) {
    return NextResponse.json(
      {
        error:
          "Voice demo is not configured on this server. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.",
      },
      { status: 503 },
    );
  }

  try {
    const payload = await mintDemoRoomToken(env);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[livekit/token] mint failed", err);
    return NextResponse.json(
      { error: "Could not start the voice demo. Please try again." },
      { status: 500 },
    );
  }
}

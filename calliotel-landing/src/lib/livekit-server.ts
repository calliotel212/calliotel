import { randomUUID } from "crypto";
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
} from "livekit-server-sdk";

export const DEFAULT_LIVEKIT_AGENT_NAME = "calliotel-voice-assistant";
export const DEFAULT_DEMO_MAX_SECONDS = 300;

export type LiveKitEnv = {
  serverUrl: string;
  apiKey: string;
  apiSecret: string;
  agentName: string;
  maxSeconds: number;
};

export type DemoTokenPayload = {
  serverUrl: string;
  token: string;
  roomName: string;
  maxSeconds: number;
};

export function readLiveKitEnv(): LiveKitEnv | null {
  const serverUrl = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();

  if (!serverUrl || !apiKey || !apiSecret) {
    return null;
  }

  const agentName =
    process.env.LIVEKIT_AGENT_NAME?.trim() || DEFAULT_LIVEKIT_AGENT_NAME;

  const parsedMax = Number.parseInt(
    process.env.DEMO_MAX_SECONDS ?? String(DEFAULT_DEMO_MAX_SECONDS),
    10,
  );
  const maxSeconds =
    Number.isFinite(parsedMax) && parsedMax > 0
      ? parsedMax
      : DEFAULT_DEMO_MAX_SECONDS;

  return { serverUrl, apiKey, apiSecret, agentName, maxSeconds };
}

export async function mintDemoRoomToken(
  env: LiveKitEnv,
): Promise<DemoTokenPayload> {
  const roomName = `demo-${randomUUID()}`;
  const identity = `visitor-${randomUUID().slice(0, 8)}`;

  const tokenTtlSeconds = Math.min(env.maxSeconds + 120, 3600);

  const at = new AccessToken(env.apiKey, env.apiSecret, {
    identity,
    name: "Demo visitor",
    ttl: tokenTtlSeconds,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  at.roomConfig = new RoomConfiguration({
    agents: [
      new RoomAgentDispatch({
        agentName: env.agentName,
        metadata: JSON.stringify({ source: "calliotel-landing-demo" }),
      }),
    ],
  });

  const token = await at.toJwt();

  return {
    serverUrl: env.serverUrl,
    token,
    roomName,
    maxSeconds: env.maxSeconds,
  };
}

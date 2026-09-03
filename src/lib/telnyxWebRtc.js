/**
 * Thin Telnyx WebRTC helper for Calliotel keypad softphone.
 */
import { TelnyxRTC } from '@telnyx/webrtc';

let client = null;
let activeCall = null;

export function getActiveCall() {
  return activeCall;
}

export function getClient() {
  return client;
}

export async function connectTelnyxClient({ loginToken, sipUsername, sipPassword }) {
  await disconnectTelnyxClient();

  const opts = loginToken
    ? { login_token: loginToken }
    : { login: sipUsername, password: sipPassword };

  client = new TelnyxRTC({
    ...opts,
    ringtoneFile: undefined,
    ringbackFile: undefined,
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanupListeners();
      reject(new Error('WebRTC connect timeout'));
    }, 20000);

    const onReady = () => {
      cleanupListeners();
      resolve(client);
    };
    const onError = (err) => {
      cleanupListeners();
      reject(err instanceof Error ? err : new Error(String(err?.message || err || 'WebRTC error')));
    };
    const cleanupListeners = () => {
      clearTimeout(timer);
      try { client.off('telnyx.ready', onReady); } catch (_) { /* */ }
      try { client.off('telnyx.error', onError); } catch (_) { /* */ }
    };

    client.on('telnyx.ready', onReady);
    client.on('telnyx.error', onError);
    client.connect();
  });
}

export function placeWebRtcCall({ destinationNumber, callerNumber, remoteAudioEl, onState }) {
  if (!client) throw new Error('WebRTC client not connected');

  activeCall = client.newCall({
    destinationNumber,
    callerNumber,
    audio: true,
    remoteElement: remoteAudioEl || undefined,
  });

  const notify = (state, extra = {}) => {
    if (typeof onState === 'function') onState(state, extra);
  };

  activeCall.on('telnyx.notification', (notification) => {
    const call = notification?.call || activeCall;
    const state = call?.state;
    if (!state) return;
    notify(state, { call, notification });
    if (state === 'hangup' || state === 'destroy') {
      activeCall = null;
    }
  });

  return activeCall;
}

export function hangupWebRtcCall() {
  try {
    if (activeCall) {
      activeCall.hangup();
      activeCall = null;
    }
  } catch (_) { /* */ }
}

export async function disconnectTelnyxClient() {
  hangupWebRtcCall();
  if (client) {
    try {
      client.disconnect();
    } catch (_) { /* */ }
    client = null;
  }
}

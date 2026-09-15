import Pusher from "pusher";

const globalForPusher = global as unknown as { pusher?: Pusher };

function isConfiguredValue(value: string | undefined, dummyValue: string) {
  return Boolean(value?.trim()) && value !== dummyValue;
}

export function isPusherConfigured() {
  return (
    isConfiguredValue(process.env.PUSHER_APP_ID, "12345") &&
    isConfiguredValue(process.env.NEXT_PUBLIC_PUSHER_KEY, "dummy-key") &&
    isConfiguredValue(process.env.PUSHER_SECRET, "dummy-secret") &&
    Boolean(process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim())
  );
}

export const pusherServer = isPusherConfigured()
  ? globalForPusher.pusher ||
    new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      useTLS: true,
    })
  : null;

if (process.env.NODE_ENV !== "production" && pusherServer) {
  globalForPusher.pusher = pusherServer;
}

export function triggerPusherEvent(channel: string, event: string, data: unknown) {
  if (!pusherServer) {
    return;
  }

  pusherServer.trigger(channel, event, data).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown Pusher error";
    console.warn(`[pusher] event skipped: ${message}`);
  });
}

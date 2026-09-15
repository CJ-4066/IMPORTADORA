import PusherClient from "pusher-js";

let pusherClientInstance: PusherClient | null = null;

export const getPusherClient = () => {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY?.trim();
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim();

  if (!key || !cluster || key === "dummy-key") {
    return null;
  }

  if (!pusherClientInstance) {
    pusherClientInstance = new PusherClient(key, {
      cluster,
    });
  }
  return pusherClientInstance;
};

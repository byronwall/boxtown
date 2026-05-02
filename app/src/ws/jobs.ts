import { eventHandler } from "vinxi/http";
import {
  type ProjectSocketEvent,
  subscribeProjectSocketEvents,
} from "./project-events";

type JobSocketServerMessage =
  | {
      type: "jobs:init";
      connectedPeers: number;
      serverTime: string;
    }
  | {
      type: "jobs:pong";
      connectedPeers: number;
      serverTime: string;
    }
  | ProjectSocketEvent;

type JobSocketClientMessage = {
  type: "jobs:ping";
};

type Peer = Parameters<
  NonNullable<
    NonNullable<Parameters<typeof eventHandler>[0]["__websocket__"]>["open"]
  >
>[0];

const peers = new Set<Peer>();

const sendMessage = (peer: Peer, message: JobSocketServerMessage) => {
  peer.send(JSON.stringify(message));
};

const broadcastMessage = (message: JobSocketServerMessage) => {
  for (const peer of peers) {
    sendMessage(peer, message);
  }
};

const parseMessage = (payload: unknown): JobSocketClientMessage | null => {
  if (typeof payload !== "string") return null;

  try {
    const parsed = JSON.parse(payload) as Partial<JobSocketClientMessage>;
    return parsed.type === "jobs:ping" ? { type: "jobs:ping" } : null;
  } catch {
    return null;
  }
};

const createStatusMessage = (
  type: "jobs:init" | "jobs:pong",
) => ({
  type,
  connectedPeers: peers.size,
  serverTime: new Date().toISOString(),
}) as Extract<JobSocketServerMessage, { type: "jobs:init" | "jobs:pong" }>;

subscribeProjectSocketEvents((event) => {
  broadcastMessage(event);
});

export default eventHandler({
  handler() {},
  websocket: {
    open(peer) {
      peers.add(peer);
      sendMessage(peer, createStatusMessage("jobs:init"));
    },
    message(peer, payload) {
      const message = parseMessage(payload.text());
      if (!message) return;

      if (message.type === "jobs:ping") {
        sendMessage(peer, createStatusMessage("jobs:pong"));
      }
    },
    close(peer) {
      peers.delete(peer);
    },
    error(peer, error) {
      console.error("jobs-socket:error", {
        id: peer.id,
        error,
      });
    },
  },
});

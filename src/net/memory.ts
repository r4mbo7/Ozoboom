import { decodeMessage, encodeMessage } from './wire';
import type { NetMessage, PeerId, Transport } from './types';

export interface MemoryTransport extends Transport {
  // Delivers every queued message and peer change of the whole network, except to held peers.
  flush(): void;
  // Withholds deliveries to this peer, in order, until release().
  hold(): void;
  release(): void;
}

type Delivery =
  | { kind: 'message'; from: PeerId; message: NetMessage }
  | { kind: 'peer'; peer: PeerId; change: 'joined' | 'left' };

type MessageListener = (from: PeerId, message: NetMessage) => void;
type PeerListener = (peer: PeerId, change: 'joined' | 'left') => void;

interface Node {
  id: PeerId;
  inbox: Delivery[];
  held: boolean;
  closed: boolean;
  messageListeners: Set<MessageListener>;
  peerListeners: Set<PeerListener>;
}

export function createMemoryTransports(count: number): MemoryTransport[] {
  const nodes = new Map<PeerId, Node>();
  const severed = new Set<string>();
  const link = (a: PeerId, b: PeerId): string => [a, b].sort().join('|');

  function deliver(node: Node): boolean {
    const delivery = node.inbox.shift();
    if (delivery === undefined) {
      return false;
    }
    if (delivery.kind === 'message') {
      for (const listener of [...node.messageListeners]) {
        listener(delivery.from, delivery.message);
      }
    } else {
      for (const listener of [...node.peerListeners]) {
        listener(delivery.peer, delivery.change);
      }
    }
    return true;
  }

  function flush(): void {
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const node of nodes.values()) {
        if (!node.held && !node.closed && deliver(node)) {
          progressed = true;
        }
      }
    }
  }

  function createTransport(id: PeerId): MemoryTransport {
    const node: Node = {
      id,
      inbox: [],
      held: false,
      closed: false,
      messageListeners: new Set(),
      peerListeners: new Set(),
    };
    nodes.set(id, node);

    const send = (to: PeerId, message: NetMessage): void => {
      const target = nodes.get(to);
      if (
        node.closed ||
        target === undefined ||
        target.closed ||
        to === id ||
        severed.has(link(id, to))
      ) {
        return;
      }
      target.inbox.push({
        kind: 'message',
        from: id,
        message: decodeMessage(encodeMessage(message)),
      });
    };

    return {
      id,
      send,
      broadcast(message) {
        for (const peer of nodes.keys()) {
          send(peer, message);
        }
      },
      disconnect(peer) {
        const other = nodes.get(peer);
        if (other === undefined || other.closed || node.closed || severed.has(link(id, peer))) {
          return;
        }
        severed.add(link(id, peer));
        other.inbox.push({ kind: 'peer', peer: id, change: 'left' });
        node.inbox.push({ kind: 'peer', peer, change: 'left' });
      },
      onMessage(listener) {
        node.messageListeners.add(listener);
        return () => node.messageListeners.delete(listener);
      },
      onPeer(listener) {
        node.peerListeners.add(listener);
        return () => node.peerListeners.delete(listener);
      },
      close() {
        if (node.closed) {
          return;
        }
        node.closed = true;
        for (const other of nodes.values()) {
          if (other !== node && !other.closed) {
            other.inbox.push({ kind: 'peer', peer: id, change: 'left' });
          }
        }
      },
      flush,
      hold() {
        node.held = true;
      },
      release() {
        node.held = false;
      },
    };
  }

  return Array.from({ length: count }, (_, index) => createTransport(`peer-${String(index)}`));
}

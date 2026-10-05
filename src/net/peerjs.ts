import type { DataConnection, Peer, PeerOptions } from 'peerjs';
import { hostPeerId } from './code';
import { decodeMessage, encodeMessage } from './wire';
import { roundTripFromStats, type StatEntry } from './stats';
import type { NetMessage, PeerId, Transport } from './types';

export type PeerTransportOptions = (
  { role: 'host'; code: string } | { role: 'guest'; code: string }
) & {
  // Failures after the transport is returned (broker lost, channel error, malformed message).
  onError: (error: Error) => void;
  // Server given as `host:port[/path]`; defaults to VITE_PEER_SERVER, then to the public broker.
  server?: string;
  connectTimeoutMs?: number;
};

const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;

export function parsePeerServer(server: string | undefined): PeerOptions {
  if (server === undefined || server === '') {
    return {};
  }
  const match = /^([^:/]+):(\d+)(\/.*)?$/.exec(server);
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new Error(`VITE_PEER_SERVER must look like host:port[/path], got "${server}"`);
  }
  const host = match[1];
  const local = host === 'localhost';
  return {
    host,
    port: Number(match[2]),
    path: match[3] ?? '/',
    secure: !local,
    // A local broker means no Internet is assumed: skip the public STUN servers.
    ...(local ? { config: { iceServers: [] } } : {}),
  };
}

function describeError(context: string, error: unknown): Error {
  if (error instanceof Error) {
    const type = 'type' in error ? ` (${String((error as { type: unknown }).type)})` : '';
    return new Error(`${context}${type}: ${error.message}`, { cause: error });
  }
  return new Error(`${context}: ${String(error)}`, { cause: error });
}

export interface PeerTransport extends Transport {
  // Smallest recent round trip to a connected peer, from RTCPeerConnection.getStats; null when
  // there is no peer or the browser reports none.
  roundTripMs(): Promise<number | null>;
}

export async function createPeerTransport(options: PeerTransportOptions): Promise<PeerTransport> {
  const { Peer: PeerClass } = await import('peerjs');
  const peerOptions = parsePeerServer(options.server ?? import.meta.env.VITE_PEER_SERVER);
  const timeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;

  const connections = new Map<PeerId, DataConnection>();
  const messageListeners = new Set<(from: PeerId, message: NetMessage) => void>();
  const peerListeners = new Set<(peer: PeerId, change: 'joined' | 'left') => void>();
  let closed = false;
  let ready = false;

  const fail = (context: string, error: unknown): void => {
    if (ready && !closed) {
      options.onError(describeError(context, error));
    }
  };

  const peer: Peer =
    options.role === 'host'
      ? new PeerClass(hostPeerId(options.code), peerOptions)
      : new PeerClass(peerOptions);

  const attach = (connection: DataConnection): void => {
    const remote = connection.peer;
    connection.on('data', (data) => {
      let message: NetMessage;
      try {
        message = decodeMessage(data);
      } catch (error) {
        fail(`malformed message from ${remote}`, error);
        return;
      }
      for (const listener of [...messageListeners]) {
        listener(remote, message);
      }
    });
    connection.on('error', (error) => {
      fail(`connection with ${remote}`, error);
    });
    connection.on('close', () => {
      if (connections.get(remote) === connection) {
        connections.delete(remote);
        for (const listener of [...peerListeners]) {
          listener(remote, 'left');
        }
      }
    });
  };

  const registerOpen = (connection: DataConnection): void => {
    connections.set(connection.peer, connection);
    for (const listener of [...peerListeners]) {
      listener(connection.peer, 'joined');
    }
  };

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          options.role === 'host'
            ? `the PeerJS broker did not answer within ${String(timeoutMs)} ms`
            : `no answer from the room ${options.code} within ${String(timeoutMs)} ms`,
        ),
      );
    }, timeoutMs);
    const settle = (error?: Error): void => {
      clearTimeout(timer);
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    };

    peer.on('error', (error) => {
      if (ready) {
        fail('PeerJS', error);
      } else if (error.type === 'peer-unavailable') {
        settle(describeError(`no room with the code ${options.code}`, error));
      } else if (error.type === 'unavailable-id') {
        settle(describeError(`the room code ${options.code} is already taken`, error));
      } else {
        settle(describeError('PeerJS broker', error));
      }
    });
    peer.on('disconnected', () => {
      if (ready && options.role === 'host') {
        fail('PeerJS broker', new Error('connection to the broker lost: nobody new can join'));
      }
    });

    if (options.role === 'host') {
      peer.on('open', () => {
        peer.on('connection', (connection) => {
          attach(connection);
          connection.on('open', () => {
            registerOpen(connection);
          });
        });
        settle();
      });
    } else {
      peer.on('open', () => {
        const connection = peer.connect(hostPeerId(options.code), {
          reliable: true,
          serialization: 'raw',
        });
        attach(connection);
        connection.on('open', () => {
          connections.set(connection.peer, connection);
          settle();
        });
        connection.on('error', (error) => {
          settle(describeError(`room ${options.code}`, error));
        });
        connection.on('close', () => {
          settle(new Error(`the room ${options.code} closed the connection`));
        });
      });
    }
  }).catch((error: unknown) => {
    closed = true;
    peer.destroy();
    throw error;
  });

  ready = true;

  const push = (connection: DataConnection, message: NetMessage): void => {
    Promise.resolve(connection.send(encodeMessage(message))).catch((error: unknown) => {
      fail(`sending ${message.type} to ${connection.peer}`, error);
    });
  };

  return {
    id: peer.id,
    send(to, message) {
      const connection = connections.get(to);
      if (connection !== undefined) {
        push(connection, message);
      }
    },
    broadcast(message) {
      for (const connection of connections.values()) {
        push(connection, message);
      }
    },
    disconnect(remote) {
      connections.get(remote)?.close();
    },
    onMessage(listener) {
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },
    onPeer(listener) {
      peerListeners.add(listener);
      return () => peerListeners.delete(listener);
    },
    async roundTripMs() {
      const measures: number[] = [];
      for (const connection of connections.values()) {
        const rtc = connection.peerConnection as RTCPeerConnection | undefined;
        const report = await rtc?.getStats();
        const rtt = roundTripFromStats((report?.values() ?? []) as Iterable<StatEntry>);
        if (rtt !== null) {
          measures.push(rtt);
        }
      }
      return measures.length === 0 ? null : Math.min(...measures);
    },
    close() {
      closed = true;
      peer.destroy();
      connections.clear();
    },
  };
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { NanometerEvent } from "./types";

const SELLER_URL = process.env.NEXT_PUBLIC_SELLER_URL ?? "http://localhost:3001";

/**
 * Subscribes to the seller's SSE feed and pushes events into a ring buffer
 * of the last `bufferSize` calls. Returns the buffer + a connection state.
 */
export function useNanoStream(bufferSize = 1000) {
  const [events, setEvents] = useState<NanometerEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const bufferRef = useRef<NanometerEvent[]>([]);

  useEffect(() => {
    const url = `${SELLER_URL}/events`;
    const es = new EventSource(url);

    es.onopen = () => setConnected(true);

    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as NanometerEvent;
        bufferRef.current = [parsed, ...bufferRef.current].slice(0, bufferSize);
        setEvents(bufferRef.current);
      } catch {
        // ignore malformed payloads
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; we just flip the flag for UI feedback.
      setConnected(false);
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [bufferSize]);

  return { events, connected };
}

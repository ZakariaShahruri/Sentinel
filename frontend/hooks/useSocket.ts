"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket";

export type SentinelPayload = {
  seq: number;
  peak: number;
  rms: number;
  zcr: number;
  decay: number;
  lastx: number;
  lasty: number;
  lastz: number;
  room: string;
};

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [latestData, setLatestData] = useState<SentinelPayload | null>(null);
  const [history, setHistory] = useState<SentinelPayload[]>([]);
  const socket = useRef(getSocket());

  useEffect(() => {
    const sio = socket.current;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onData = (data: SentinelPayload) => {
      setLatestData(data);
      setHistory((prev) => [...prev.slice(-59), data]); // keep last 60 points
    };

    sio.on("connect", onConnect);
    sio.on("disconnect", onDisconnect);
    sio.on("sentinel_data", onData);

    if (sio.connected) setConnected(true);

    return () => {
      sio.off("connect", onConnect);
      sio.off("disconnect", onDisconnect);
      sio.off("sentinel_data", onData);
    };
  }, []);

  const sendCommand = useCallback((command: string) => {
    socket.current.emit("send_command", {
      room: "sentinel",
      command,
    });
  }, []);

  return { connected, latestData, history, sendCommand };
}

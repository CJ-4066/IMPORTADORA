"use client";

import { useEffect, useState } from "react";

type SyncDurationProps = {
  durationMs: number | null;
  finishedAt: string | null;
  startedAt: string;
  status: "RUNNING" | "SUCCESS" | "ERROR" | "CANCELED";
};

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function SyncDuration({
  durationMs,
  finishedAt,
  startedAt,
  status,
}: SyncDurationProps) {
  const [elapsedMs, setElapsedMs] = useState(durationMs ?? 0);

  useEffect(() => {
    if (status !== "RUNNING" || finishedAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - new Date(startedAt).getTime());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [finishedAt, startedAt, status]);

  return <span>{status === "RUNNING" ? `Corriendo ${formatDuration(elapsedMs)}` : formatDuration(elapsedMs)}</span>;
}

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

const SPINNER_CHARS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FILLED = "█";
const EMPTY = "░";

function useSpinner(active: boolean): string {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_CHARS.length), 80);
    return () => clearInterval(id);
  }, [active]);

  return SPINNER_CHARS[frame];
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(id);
  }, [active]);

  return now;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function buildBar(value: number, max: number, width: number): string {
  if (width <= 0) return "";
  if (max <= 0) return EMPTY.repeat(width);
  const filled = Math.round((value / max) * width);
  return FILLED.repeat(filled) + EMPTY.repeat(Math.max(0, width - filled));
}

type Status = "idle" | "connecting" | "queued" | "executing" | "done" | "failed";

interface StatusBarProps {
  status: Status;
  currentNode: string;
  progressValue: number;
  progressMax: number;
  runNumber: number;
  runDuration: number;
  runStartedAt: number | null;
  host: string;
  watchFile: string;
  errorMessage: string | null;
  width: number;
}

export function StatusBar({
  status,
  currentNode,
  progressValue,
  progressMax,
  runNumber,
  runDuration,
  runStartedAt,
  host,
  watchFile,
  errorMessage,
  width
}: StatusBarProps) {
  const isLive = status === "executing" || status === "queued" || status === "connecting";
  const spinner = useSpinner(isLive);
  const now = useNow(isLive);

  const progressWidth = Math.max(12, width - 10);
  const bar = buildBar(progressValue, progressMax, progressWidth);
  const elapsed = runStartedAt ? now - runStartedAt : runDuration;
  const percent = progressMax > 0 ? Math.round((progressValue / progressMax) * 100) : status === "done" ? 100 : 0;

  const statusLabel =
    status === "executing"
      ? `${spinner} Executing ${currentNode || "workflow"}`
      : status === "queued"
        ? `${spinner} Queued`
        : status === "connecting"
          ? `${spinner} Preparing run`
          : status === "done"
            ? "Completed"
            : status === "failed"
              ? "Failed"
              : "Watching for changes";

  const metaParts = [
    `Run #${Math.max(runNumber, 1)}`,
    progressMax > 0 ? `${progressValue}/${progressMax}` : "waiting for progress",
    `${percent}%`,
    formatDuration(elapsed)
  ];

  return (
    <Box flexDirection='column' width={width} borderStyle='round' borderColor='blue' paddingX={1}>
      <Box justifyContent='space-between'>
        <Text bold color={status === "failed" ? "red" : status === "done" ? "green" : "cyan"}>
          {statusLabel}
        </Text>
        <Text color='cyan'>{metaParts.join("  ")}</Text>
      </Box>
      <Text color='blue'>{bar}</Text>
      <Box justifyContent='space-between'>
        <Text wrap='truncate-end'>Host: {host}</Text>
        <Text wrap='truncate-end'>File: {watchFile}</Text>
      </Box>
      {errorMessage ? (
        <Text color='red' wrap='truncate-end'>
          Error: {errorMessage}
        </Text>
      ) : (
        <Text dimColor wrap='truncate-end'>
          Progress rail stays pinned while logs and images continue above.
        </Text>
      )}
    </Box>
  );
}

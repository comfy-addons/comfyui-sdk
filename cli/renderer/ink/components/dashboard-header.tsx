import React from "react";
import { Box, Text } from "ink";

type DashboardHeaderProps = {
  connected: boolean;
  status: "idle" | "connecting" | "queued" | "executing" | "done" | "failed";
  host: string;
  watchFile: string;
  runNumber: number;
  promptId: string;
  lastRunOutcome: "idle" | "success" | "failed" | "interrupted";
  lastRunLabel: string;
  inlineImagesSupported: boolean;
  width: number;
};

function toneForOutcome(outcome: DashboardHeaderProps["lastRunOutcome"]): "green" | "red" | "yellow" | "cyan" {
  if (outcome === "success") return "green";
  if (outcome === "failed") return "red";
  if (outcome === "interrupted") return "yellow";
  return "cyan";
}

export function DashboardHeader({
  connected,
  status,
  host,
  watchFile,
  runNumber,
  promptId,
  lastRunOutcome,
  lastRunLabel,
  inlineImagesSupported,
  width
}: DashboardHeaderProps) {
  const statusLabel =
    status === "executing"
      ? "Executing"
      : status === "queued"
        ? "Queued"
        : status === "failed"
          ? "Failed"
          : status === "done"
            ? "Completed"
            : status === "connecting"
              ? "Preparing"
              : "Watching";

  return (
    <Box
      flexDirection='column'
      width={width}
      borderStyle='round'
      borderColor={connected ? "cyan" : "yellow"}
      paddingX={1}
    >
      <Box justifyContent='space-between'>
        <Text bold color='cyan'>
          CFLI WATCH
        </Text>
        <Box>
          <Text color={connected ? "green" : "yellow"}>{connected ? "ONLINE" : "CONNECTING"}</Text>
          <Text dimColor>  </Text>
          <Text color='blue'>{statusLabel}</Text>
        </Box>
      </Box>
      <Box justifyContent='space-between'>
        <Text wrap='truncate-end'>Host: {host}</Text>
        <Text color='cyan'>Run #{Math.max(runNumber, 1)}</Text>
      </Box>
      <Box justifyContent='space-between'>
        <Text wrap='truncate-end'>File: {watchFile}</Text>
        <Text color={inlineImagesSupported ? "green" : "yellow"}>
          {inlineImagesSupported ? "Image preview ready" : "Image preview fallback"}
        </Text>
      </Box>
      <Box justifyContent='space-between'>
        <Text wrap='truncate-end'>{promptId ? `Prompt: ${promptId}` : "Prompt: waiting for queue id"}</Text>
        <Text color={toneForOutcome(lastRunOutcome)} wrap='truncate-end'>
          {lastRunLabel}
        </Text>
      </Box>
    </Box>
  );
}

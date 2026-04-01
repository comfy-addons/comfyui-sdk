import React from "react";
import { Box, Text } from "ink";
import { ImageBlock } from "./image-block";
import type { FeedEntry, MediaEntry } from "../state";

const STYLE_MAP: Record<string, { color?: string; dimColor?: boolean; bold?: boolean }> = {
  success: { color: "green" },
  danger: { color: "red", bold: true },
  warning: { color: "yellow" },
  accent: { color: "cyan" },
  muted: { dimColor: true },
  default: {}
};

export function LogEntryComponent({ entry, width }: { entry: FeedEntry | MediaEntry; width: number }) {
  if (entry.type === "image") {
    return <ImageBlock url={entry.imageUrl} label={entry.label} localPath={entry.localPath} width={width} />;
  }

  const style = STYLE_MAP[entry.tone] ?? {};
  const prefix =
    entry.source === "server"
      ? "server"
      : entry.source === "watch"
        ? "watch"
        : entry.source === "result"
          ? "result"
          : "system";

  return (
    <Box width={width}>
      <Text {...style} wrap='truncate-end'>
        {prefix.padEnd(6)} {entry.text}
      </Text>
    </Box>
  );
}

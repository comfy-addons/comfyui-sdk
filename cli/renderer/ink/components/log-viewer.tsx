import React from "react";
import { Box, Text } from "ink";
import type { FeedEntry, MediaEntry } from "../state";
import { LogEntryComponent } from "./log-entry";

const HEADER_LINES = 2;
const INLINE_IMAGE_ROWS = 16;
const FALLBACK_IMAGE_ROWS = 3;

interface LogViewerProps {
  feed: FeedEntry[];
  media: MediaEntry[];
  maxLines: number;
  width: number;
  inlineImagesSupported: boolean;
}

function estimateGalleryLines(media: MediaEntry[], inlineImagesSupported: boolean): number {
  if (media.length === 0) return 0;
  if (inlineImagesSupported) return media.length * INLINE_IMAGE_ROWS + HEADER_LINES;
  return media.length * FALLBACK_IMAGE_ROWS + HEADER_LINES;
}

export function LogViewer({ feed, media, maxLines, width, inlineImagesSupported }: LogViewerProps) {
  const safeMaxLines = Math.max(3, maxLines - 2);
  const galleryLines = Math.min(Math.max(0, safeMaxLines - 2), estimateGalleryLines(media, inlineImagesSupported));
  const visibleFeedCount = Math.max(1, safeMaxLines - galleryLines);
  const visible = feed.slice(-visibleFeedCount);
  const empty = Math.max(0, visibleFeedCount - visible.length - 1);

  return (
    <Box flexDirection='column' width={width} borderStyle='round' borderColor='gray' paddingX={1} flexGrow={1}>
      <Text bold color='cyan'>
        Live Feed
      </Text>
      {Array.from({ length: empty }).map((_, i) => (
        <Text key={`pad-${i}`} dimColor>
          {" "}
        </Text>
      ))}
      {visible.map((entry) => (
        <LogEntryComponent key={entry.id} entry={entry} width={Math.max(1, width - 4)} />
      ))}
      {media.length > 0 ? (
        <Box flexDirection='column' marginTop={1}>
          <Text bold color='green'>
            Latest Images
          </Text>
          {media.map((entry) => (
            <LogEntryComponent key={entry.id} entry={entry} width={Math.max(1, width - 4)} />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

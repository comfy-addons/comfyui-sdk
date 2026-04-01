import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { statSync } from "fs";
import { createRequire } from "module";
import { isAbsolute, resolve } from "path";
import { pathToFileURL } from "url";

const require = createRequire(import.meta.url);
const Jimp = require("jimp") as {
  HORIZONTAL_ALIGN_LEFT: number;
  VERTICAL_ALIGN_TOP: number;
  read: (source: string | Buffer) => Promise<{
    contain: (width: number, height: number, alignBits?: number) => any;
    getPixelColor: (x: number, y: number) => number;
  }>;
  intToRGBA: (value: number) => { r: number; g: number; b: number; a: number };
};

const RESET = "\x1b[0m";
const MIN_PREVIEW_WIDTH = 16;
const MAX_PREVIEW_WIDTH = 56;
const MIN_PREVIEW_HEIGHT = 8;
const MAX_PREVIEW_HEIGHT = 24;

interface ImageBlockProps {
  url: string;
  label?: string;
  localPath?: string | null;
  width: number;
}

type RenderState =
  | { status: "loading" }
  | { status: "ready"; lines: string[] }
  | { status: "error"; message: string };

const previewCache = new Map<string, Promise<string[]>>();

function reserveLines(count: number, keyPrefix: string) {
  return Array.from({ length: count }).map((_, idx) => <Text key={`${keyPrefix}-${idx}`}> </Text>);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getPreviewDimensions(width: number) {
  const previewWidth = clamp(width - 6, MIN_PREVIEW_WIDTH, MAX_PREVIEW_WIDTH);
  const previewHeight = clamp(Math.round(previewWidth * 0.45), MIN_PREVIEW_HEIGHT, MAX_PREVIEW_HEIGHT);

  return {
    previewWidth,
    previewHeight,
    reservedLines: previewHeight
  };
}

function fg({ r, g, b }: { r: number; g: number; b: number }) {
  return `\x1b[38;2;${r};${g};${b}m`;
}

function bg({ r, g, b }: { r: number; g: number; b: number }) {
  return `\x1b[48;2;${r};${g};${b}m`;
}

function blendOnBlack(color: { r: number; g: number; b: number; a: number }) {
  const alpha = color.a / 255;
  return {
    r: Math.round(color.r * alpha),
    g: Math.round(color.g * alpha),
    b: Math.round(color.b * alpha),
    a: color.a
  };
}

function renderBlock(topRaw: { r: number; g: number; b: number; a: number }, bottomRaw: { r: number; g: number; b: number; a: number }) {
  const top = blendOnBlack(topRaw);
  const bottom = blendOnBlack(bottomRaw);

  if (top.a === 0 && bottom.a === 0) return " ";
  if (top.a === 0) return `${fg(bottom)}▄${RESET}`;
  if (bottom.a === 0) return `${fg(top)}▀${RESET}`;
  return `${fg(top)}${bg(bottom)}▀${RESET}`;
}

async function convertToAnsiBlocks(
  source: string,
  cacheKey: string,
  previewWidth: number,
  previewHeight: number
): Promise<string[]> {
  const cached = previewCache.get(cacheKey);
  if (cached) return cached;

  const task = Jimp.read(source).then((image) => {
    const resized = image.contain(previewWidth, previewHeight * 2, Jimp.HORIZONTAL_ALIGN_LEFT | Jimp.VERTICAL_ALIGN_TOP);
    const lines: string[] = [];

    for (let y = 0; y < previewHeight * 2; y += 2) {
      let line = "";

      for (let x = 0; x < previewWidth; x++) {
        const top = Jimp.intToRGBA(resized.getPixelColor(x, y));
        const bottom = Jimp.intToRGBA(resized.getPixelColor(x, Math.min(y + 1, previewHeight * 2 - 1)));
        line += renderBlock(top, bottom);
      }

      lines.push(line);
    }

    return lines;
  });

  previewCache.set(cacheKey, task);
  return task;
}

function getPreviewSource(
  localPath: string | null | undefined,
  url: string,
  previewWidth: number,
  previewHeight: number
): { source: string; cacheKey: string } {
  if (!localPath) {
    return { source: url, cacheKey: `${url}:${previewWidth}:${previewHeight}` };
  }

  try {
    const stats = statSync(localPath);
    return {
      source: localPath,
      cacheKey: `${localPath}:${stats.mtimeMs}:${stats.size}:${previewWidth}:${previewHeight}`
    };
  } catch {
    return {
      source: localPath,
      cacheKey: `${localPath}:${previewWidth}:${previewHeight}`
    };
  }
}

function formatFileLink(localPath: string): string {
  const absolutePath = isAbsolute(localPath) ? localPath : resolve(process.cwd(), localPath);
  const target = pathToFileURL(absolutePath).toString();
  return `\u001B]8;;${target}\u0007saved to ${localPath}\u001B]8;;\u0007`;
}

export function ImageBlock({ url, label, localPath, width }: ImageBlockProps) {
  const [state, setState] = useState<RenderState>({ status: "loading" });
  const { previewWidth, previewHeight, reservedLines } = getPreviewDimensions(width);
  const { source, cacheKey } = getPreviewSource(localPath, url, previewWidth, previewHeight);

  useEffect(() => {
    let cancelled = false;

    setState({ status: "loading" });
    convertToAnsiBlocks(source, cacheKey, previewWidth, previewHeight)
      .then((lines) => {
        if (cancelled) return;
        setState({ status: "ready", lines });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Preview conversion failed"
        });
      });

    return () => {
      cancelled = true;
    };
  }, [source, cacheKey, previewWidth, previewHeight]);

  if (state.status === "ready") {
    const padding = Math.max(0, reservedLines - state.lines.length);

    return (
      <Box flexDirection='column' marginTop={1}>
        {label && <Text dimColor>{label}</Text>}
        {state.lines.map((line, idx) => (
          <Text key={`ascii-${idx}`}>{line}</Text>
        ))}
        {reserveLines(padding, "preview-pad")}
        {localPath ? <Text dimColor>{formatFileLink(localPath)}</Text> : <Text dimColor>source: {url}</Text>}
      </Box>
    );
  }

  if (state.status === "error") {
    return (
      <Box flexDirection='column' marginTop={1}>
        {label && <Text dimColor>{label}</Text>}
        <Text color='red'> color preview failed</Text>
        {reserveLines(reservedLines, "error-pad")}
        <Text dimColor>{state.message}</Text>
        {localPath ? <Text dimColor>{formatFileLink(localPath)}</Text> : <Text dimColor>source: {url}</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection='column' marginTop={1}>
      {label && <Text dimColor>{label}</Text>}
      <Text dimColor> rendering color preview...</Text>
      {reserveLines(reservedLines, "loading-pad")}
      {localPath ? <Text dimColor>{formatFileLink(localPath)}</Text> : <Text dimColor>source: {url}</Text>}
    </Box>
  );
}

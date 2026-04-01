import React, { useSyncExternalStore, useEffect, useState } from "react";
import { Box, useStdout, useApp } from "ink";
import type { TuiStore } from "./state";
import { LogViewer } from "./components/log-viewer";
import { StatusBar } from "./components/progress-bar";
import { DashboardHeader } from "./components/dashboard-header";

interface AppProps {
  store: TuiStore;
  persistent: boolean;
}

export function App({ store, persistent }: AppProps) {
  const { stdout } = useStdout();
  const { exit } = useApp();
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [viewport, setViewport] = useState({
    cols: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24
  });

  useEffect(() => {
    if (!persistent && state.status === "done") {
      const timer = setTimeout(() => exit(), 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state.status, persistent, exit]);

  useEffect(() => {
    if (!stdout) return undefined;

    const syncViewport = () => {
      setViewport({
        cols: stdout.columns ?? 80,
        rows: stdout.rows ?? 24
      });
    };

    syncViewport();
    stdout.on("resize", syncViewport);

    return () => {
      stdout.off("resize", syncViewport);
    };
  }, [stdout]);

  const cols = viewport.cols;
  const rows = viewport.rows;

  const HEADER_LINES = 6;
  const STATUS_BAR_LINES = 6;
  const logLines = Math.max(4, rows - HEADER_LINES - STATUS_BAR_LINES);

  return (
    <Box flexDirection='column' width={cols} height={rows}>
      <DashboardHeader
        connected={state.connected}
        status={state.status}
        host={state.host}
        watchFile={state.watchFile}
        runNumber={state.runNumber}
        promptId={state.promptId}
        lastRunOutcome={state.lastRunOutcome}
        lastRunLabel={state.lastRunLabel}
        inlineImagesSupported={state.inlineImagesSupported}
        width={cols}
      />
      <LogViewer
        feed={state.feed}
        media={state.media}
        maxLines={logLines}
        width={cols}
        inlineImagesSupported={state.inlineImagesSupported}
      />
      <StatusBar
        status={state.status}
        currentNode={state.currentNode}
        progressValue={state.progressValue}
        progressMax={state.progressMax}
        runNumber={state.runNumber}
        runDuration={state.runDuration}
        runStartedAt={state.runStartedAt}
        host={state.host}
        watchFile={state.watchFile}
        errorMessage={state.errorMessage}
        width={cols}
      />
    </Box>
  );
}

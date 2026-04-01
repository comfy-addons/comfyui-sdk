import { describe, expect, it } from "bun:test";
import { attachTerminalLogStream, buildWatchClientOptions } from "cli/commands/watch";

describe("buildWatchClientOptions", () => {
  it("should enable terminal subscriptions for watch TUI clients", () => {
    const options = buildWatchClientOptions({ type: "bearer_token", token: "secret" }, true);

    expect(options.listenTerminal).toBe(true);
    expect(options.credentials).toEqual({ type: "bearer_token", token: "secret" });
  });
});

describe("attachTerminalLogStream", () => {
  it("should forward terminal entries and warn once on subscription failure", () => {
    const client = new EventTarget();
    const serverLogs: string[] = [];
    const watchStatuses: string[] = [];

    const detach = attachTerminalLogStream(client as any, {
      addServerLog(message: string) {
        serverLogs.push(message);
      },
      showWatchStatus(message: string) {
        watchStatuses.push(message);
      }
    });

    client.dispatchEvent(new CustomEvent("terminal", { detail: { m: "sampler step 1/20", t: "stdout" } }));
    client.dispatchEvent(new CustomEvent("terminal_subscription_error", { detail: new Error("500") }));
    client.dispatchEvent(new CustomEvent("terminal_subscription_error", { detail: new Error("500") }));

    expect(serverLogs).toEqual(["sampler step 1/20"]);
    expect(watchStatuses).toHaveLength(1);
    expect(watchStatuses[0]).toContain("Live terminal logs unavailable");

    detach();
    client.dispatchEvent(new CustomEvent("terminal", { detail: { m: "step 2/20", t: "stdout" } }));
    expect(serverLogs).toHaveLength(1);
  });
});

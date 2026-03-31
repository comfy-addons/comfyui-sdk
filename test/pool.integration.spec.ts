import { ComfyPool, EQueueMode } from "../src/pool";
import { ComfyApi } from "../src/client";
import { getTestHost, createTestClient } from "./fixtures";

import { describe, it, expect, afterEach } from "bun:test";

const needsHost = () => {
  if (!getTestHost()) return true;
  return false;
};

describe.skipIf(!getTestHost())("ComfyPool Integration", () => {
  let pool: ComfyPool;
  let client: ComfyApi;

  afterEach(() => {
    if (pool) {
      pool.destroy();
      pool = undefined as any;
    }
  });

  it("should initialize and emit ready event", async () => {
    if (needsHost()) return;
    client = createTestClient();
    pool = new ComfyPool([client], EQueueMode.PICK_ZERO);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Pool ready timeout")), 30_000);
      pool.on("ready", () => {
        clearTimeout(timeout);
        resolve();
      });
      pool.on("connection_error", (ev) => {
        clearTimeout(timeout);
        reject(new Error(`Connection error: ${JSON.stringify(ev.detail)}`));
      });
    });

    expect(pool.clients.length).toBe(1);
  });

  it("should pick client by index", async () => {
    if (needsHost()) return;
    client = createTestClient();
    pool = new ComfyPool([client], EQueueMode.PICK_ZERO);

    await new Promise<void>((resolve) => {
      pool.on("ready", () => resolve());
    });

    const picked = pool.pick(0);
    expect(picked).toBe(client);
  });

  it("should pick client by id", async () => {
    if (needsHost()) return;
    client = createTestClient("test-pick-by-id");
    pool = new ComfyPool([client], EQueueMode.PICK_ZERO);

    await new Promise<void>((resolve) => {
      pool.on("ready", () => resolve());
    });

    const picked = pool.pickById("test-pick-by-id");
    expect(picked).toBe(client);
  });

  it("should pickById return undefined for unknown id", async () => {
    if (needsHost()) return;
    client = createTestClient();
    pool = new ComfyPool([client], EQueueMode.PICK_ZERO);

    await new Promise<void>((resolve) => {
      pool.on("ready", () => resolve());
    });

    const picked = pool.pickById("nonexistent");
    expect(picked).toBeUndefined();
  });

  it("should add a new client", async () => {
    if (needsHost()) return;
    client = createTestClient("pool-client-1");
    pool = new ComfyPool([client], EQueueMode.PICK_ZERO);

    await new Promise<void>((resolve) => {
      pool.on("ready", () => resolve());
    });

    const newClient = createTestClient("pool-client-2");
    await pool.addClient(newClient);

    expect(pool.clients.length).toBe(2);
  });

  it("should remove a client by reference", async () => {
    if (needsHost()) return;
    client = createTestClient("pool-rm-1");
    pool = new ComfyPool([client], EQueueMode.PICK_ZERO);

    await new Promise<void>((resolve) => {
      pool.on("ready", () => resolve());
    });

    pool.removeClient(client);
    expect(pool.clients.length).toBe(0);
  });

  it("should remove a client by index", async () => {
    if (needsHost()) return;
    client = createTestClient("pool-rmidx-1");
    pool = new ComfyPool([client], EQueueMode.PICK_ZERO);

    await new Promise<void>((resolve) => {
      pool.on("ready", () => resolve());
    });

    pool.removeClientByIndex(0);
    expect(pool.clients.length).toBe(0);
  });

  it("should change mode and dispatch event", async () => {
    if (needsHost()) return;
    client = createTestClient();
    pool = new ComfyPool([client], EQueueMode.PICK_ZERO);

    await new Promise<void>((resolve) => {
      pool.on("ready", () => resolve());
    });

    let modeChanged = false;
    pool.on("change_mode", (ev) => {
      expect(ev.detail.mode).toBe(EQueueMode.PICK_ROUTINE);
      modeChanged = true;
    });

    pool.changeMode(EQueueMode.PICK_ROUTINE);
    expect(modeChanged).toBe(true);
  });

  it("should run a job on the pool", async () => {
    if (needsHost()) return;
    client = createTestClient();
    pool = new ComfyPool([client], EQueueMode.PICK_ZERO);

    await new Promise<void>((resolve) => {
      pool.on("ready", () => resolve());
    });

    const result = await pool.run(async (api) => {
      return await api.getSystemStats();
    });

    expect(result.system).toBeDefined();
    expect(result.devices).toBeDefined();
  });

  it("should batch multiple jobs", async () => {
    if (needsHost()) return;
    client = createTestClient();
    pool = new ComfyPool([client], EQueueMode.PICK_ROUTINE);

    await new Promise<void>((resolve) => {
      pool.on("ready", () => resolve());
    });

    const results = await pool.batch<any>([
      async (api) => "result1",
      async (api) => "result2",
      async (api) => "result3"
    ]);

    expect(results.length).toBe(3);
    expect(results).toEqual(["result1", "result2", "result3"]);
  }, 30_000);

  it("should dispatch executing and executed events", async () => {
    if (needsHost()) return;
    client = createTestClient();
    pool = new ComfyPool([client], EQueueMode.PICK_ZERO);

    await new Promise<void>((resolve) => {
      pool.on("ready", () => resolve());
    });

    let executingFired = false;
    let executedFired = false;

    pool.on("executing", () => {
      executingFired = true;
    });
    pool.on("executed", () => {
      executedFired = true;
    });

    await pool.run(async (api) => api.ping());

    expect(executingFired).toBe(true);
    expect(executedFired).toBe(true);
  });
});

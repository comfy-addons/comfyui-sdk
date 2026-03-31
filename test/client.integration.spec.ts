import { ComfyApi } from "../src/client";
import { QueueStatus, QueuePromptResponse, HistoryEntry, SystemStatsResponse, QueueResponse } from "../src/types/api";
import { getTestHost, createTestClient, waitForClient } from "./fixtures";
import SampleWorkflow from "../sample.json";

import { describe, beforeAll, afterAll, it, expect } from "bun:test";

describe.skipIf(!getTestHost())("ComfyApi Integration", () => {
  let api: ComfyApi;
  let host: string;

  beforeAll(async () => {
    host = getTestHost();
    api = createTestClient();
    await waitForClient(api);
  });

  afterAll(() => {
    api.destroy();
  });

  it("should have isReady=true after init", () => {
    expect(api.isReady).toBe(true);
  });

  it("should expose correct host and id", () => {
    expect(api.apiHost).toBe(host);
    expect(api.id).toBeDefined();
  });

  describe("ping", () => {
    it("should ping successfully", async () => {
      const result = await api.ping();
      expect(result.status).toBe(true);
      if (result.status) {
        expect(result.time).toBeDefined();
        expect(result.time!).toBeGreaterThan(0);
      }
    });
  });

  describe("pollStatus", () => {
    it("should return queue status", async () => {
      const status: QueueStatus = await api.pollStatus(5000);
      expect(status.exec_info).toBeDefined();
      expect(typeof status.exec_info.queue_remaining).toBe("number");
    });
  });

  describe("getSystemStats", () => {
    it("should return system stats", async () => {
      const stats: SystemStatsResponse = await api.getSystemStats();
      expect(stats.system).toBeDefined();
      expect(stats.system.os).toBeDefined();
      expect(stats.system.python_version).toBeDefined();
      expect(Array.isArray(stats.devices)).toBe(true);
      if (stats.devices.length > 0) {
        expect(stats.devices[0].name).toBeDefined();
        expect(stats.devices[0].vram_total).toBeGreaterThan(0);
      }
    });
  });

  describe("getExtensions", () => {
    it("should return array of extensions", async () => {
      const exts = await api.getExtensions();
      expect(Array.isArray(exts)).toBe(true);
      expect(exts.length).toBeGreaterThan(0);
    });
  });

  describe("getEmbeddings", () => {
    it("should return array of embeddings", async () => {
      const embs = await api.getEmbeddings();
      expect(Array.isArray(embs)).toBe(true);
    });
  });

  describe("getNodeDefs", () => {
    it("should return all node definitions", async () => {
      const defs = await api.getNodeDefs();
      expect(defs).not.toBeNull();
      expect(Object.keys(defs!).length).toBeGreaterThan(0);
    });

    it("should return specific node definition", async () => {
      const defs = await api.getNodeDefs("KSampler");
      expect(defs).not.toBeNull();
      expect(defs!["KSampler"]).toBeDefined();
      expect(defs!["KSampler"].input.required).toBeDefined();
    });

    it("should return null for unknown node", async () => {
      const defs = await api.getNodeDefs("NonExistentNode_xyz");
      expect(defs).toBeNull();
    });
  });

  describe("getCheckpoints", () => {
    it("should return array of checkpoints", async () => {
      const ckpts = await api.getCheckpoints();
      expect(Array.isArray(ckpts)).toBe(true);
    });
  });

  describe("getLoras", () => {
    it("should return array of loras", async () => {
      const loras = await api.getLoras();
      expect(Array.isArray(loras)).toBe(true);
    });
  });

  describe("getSamplerInfo", () => {
    it("should return sampler and scheduler info", async () => {
      const info = await api.getSamplerInfo();
      expect(info).toBeDefined();
      if (Object.keys(info).length > 0) {
        expect(info.sampler).toBeDefined();
        expect(info.scheduler).toBeDefined();
      }
    });
  });

  describe("getQueue", () => {
    it("should return queue with running and pending arrays", async () => {
      const q: QueueResponse = await api.getQueue();
      expect(Array.isArray(q.queue_running)).toBe(true);
      expect(Array.isArray(q.queue_pending)).toBe(true);
    });
  });

  describe("queuePrompt + getHistory", () => {
    let promptId: string;

    it("should queue a prompt and get a prompt_id", async () => {
      const result: QueuePromptResponse = await api.queuePrompt(null, SampleWorkflow);
      expect(result.prompt_id).toBeDefined();
      promptId = result.prompt_id;
      expect(result.number).toBeDefined();
    });

    it("should retrieve history entries", async () => {
      const hist = await api.getHistories(10);
      const keys = Object.keys(hist);
      expect(keys.length).toBeGreaterThan(0);
      const entry = hist[keys[0]];
      expect(entry.prompt).toBeDefined();
      expect(entry.outputs).toBeDefined();
      expect(entry.status).toBeDefined();
    });

    it("should retrieve history for a known prompt", async () => {
      let entry: HistoryEntry | undefined;
      for (let i = 0; i < 5; i++) {
        entry = await api.getHistory(promptId);
        if (entry) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      if (entry) {
        expect(entry.prompt).toBeDefined();
        expect(entry.outputs).toBeDefined();
      } else {
        console.log("  (skipped: prompt history not available yet)");
      }
    }, 10000);
  });

  describe("getHistories", () => {
    it("should return history object with prompt entries", async () => {
      const hist = await api.getHistories(5);
      expect(hist).toBeDefined();
      expect(typeof hist).toBe("object");
    });
  });

  describe("getSettings / getSetting", () => {
    it("should get all settings", async () => {
      const settings = await api.getSettings();
      expect(settings).toBeDefined();
      expect(typeof settings).toBe("object");
    });

    it("should get a specific setting", async () => {
      const value = await api.getSetting("ComfyUI.Version");
      expect(value).toBeDefined();
    });
  });

  describe("storeSetting + getSetting round-trip", () => {
    const testKey = "sdk.test.key";

    afterAll(async () => {
      try {
        await api.storeSetting(testKey, undefined);
      } catch {}
    });

    it("should store and retrieve a setting", async () => {
      await api.storeSetting(testKey, "test_value_123");
      const value = await api.getSetting(testKey);
      expect(value).toBe("test_value_123");
    });

    it("should update the setting", async () => {
      await api.storeSetting(testKey, "updated_value_456");
      const value = await api.getSetting(testKey);
      expect(value).toBe("updated_value_456");
    });
  });

  describe("storeSettings", () => {
    it("should store multiple settings", async () => {
      await expect(api.storeSettings({ "sdk.test.batch.1": "a", "sdk.test.batch.2": "b" })).resolves.toBeUndefined();
    });
  });

  describe("User data CRUD", () => {
    const testDir = "sdk-test";
    const testFile = `${testDir}/test-file.json`;
    const testData = { hello: "world", ts: Date.now() };
    const movedFile = `${testDir}/test-file-moved.json`;

    afterAll(async () => {
      try {
        await api.deleteUserData(movedFile);
      } catch {}
    });

    it("should store user data", async () => {
      const res = await api.storeUserData(testFile, testData, {
        overwrite: true,
        stringify: true,
        throwOnError: true
      });
      expect(res.status).toBe(200);
    });

    it("should read user data back", async () => {
      const res = await api.getUserData(testFile);
      const data = await res.json();
      expect(data.hello).toBe("world");
    });

    it("should list user data directory", async () => {
      const files = await api.listUserData(testDir);
      expect(Array.isArray(files)).toBe(true);
    });

    it("should list user data directory (v2)", async () => {
      const entries = await api.listUserDataV2(testDir);
      expect(Array.isArray(entries)).toBe(true);
      if (entries.length > 0) {
        expect(entries[0].type).toMatch(/^(file|directory)$/);
      }
    });

    it("should move user data file", async () => {
      const res = await api.moveUserData(testFile, movedFile, { overwrite: true });
      expect(res.status).toBe(200);
    });

    it("should delete user data file", async () => {
      await expect(api.deleteUserData(movedFile)).resolves.toBeUndefined();
    });

    it("should return empty array for non-existent directory", async () => {
      const files = await api.listUserData("non_existent_dir_xyz");
      expect(files).toEqual([]);
    });
  });

  describe("getPathImage", () => {
    it("should construct correct image URL", () => {
      const url = api.getPathImage({
        filename: "test.png",
        subfolder: "",
        type: "output"
      });
      expect(url).toContain("filename=test.png");
      expect(url).toContain("type=output");
      expect(url).toContain("subfolder=");
    });

    it("should handle subfolder in image URL", () => {
      const url = api.getPathImage({
        filename: "test.png",
        subfolder: "sub/dir",
        type: "input"
      });
      expect(url).toContain("subfolder=sub/dir");
    });
  });

  describe("getTerminalLogs", () => {
    it("should return terminal logs structure", async () => {
      const logs = await api.getTerminalLogs();
      expect(logs).toBeDefined();
      expect(logs.entries).toBeDefined();
      expect(Array.isArray(logs.entries)).toBe(true);
      expect(logs.size).toBeDefined();
    });
  });

  describe("freeMemory", () => {
    it("should return true on success", async () => {
      const result = await api.freeMemory(true, true);
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Event system", () => {
    it("on() should return a cleanup function", () => {
      const cleanup = api.on("status", () => {});
      expect(typeof cleanup).toBe("function");
      cleanup();
    });

    it("off() should remove listener", () => {
      const handler = () => {};
      const countBefore = api["listeners"].length;
      api.on("status", handler);
      api.off("status", handler);
      expect(api["listeners"].length).toBe(countBefore);
    });

    it("removeAllListeners() should clear all listeners", () => {
      api.on("status", () => {});
      api.on("progress", () => {});
      api.removeAllListeners();
      expect(api["listeners"].length).toBe(0);
    });

    it("should receive dispatched events", () => {
      let received = false;
      api.addEventListener("status", () => {
        received = true;
      });
      api.dispatchEvent(
        new CustomEvent("status", { detail: { status: { exec_info: { queue_remaining: 0 } }, sid: "test" } })
      );
      expect(received).toBe(true);
    });

    it("availableFeatures should return feature map", () => {
      const features = api.availableFeatures;
      expect(features).toBeDefined();
      expect(typeof features).toBe("object");
      expect("manager" in features).toBe(true);
      expect("monitor" in features).toBe(true);
    });
  });

  describe("getModelFolders (experimental)", () => {
    it("should return array of model folders", async () => {
      const folders = await api.getModelFolders();
      expect(Array.isArray(folders)).toBe(true);
      if (folders.length > 0) {
        expect(folders[0].name).toBeDefined();
      }
    });
  });

  describe("getModelFiles (experimental, deprecated)", () => {
    it("should return model files for a folder", async () => {
      const folders = await api.getModelFolders();
      if (folders.length > 0) {
        const files = await api.getModelFiles(folders[0].name);
        expect(Array.isArray(files)).toBe(true);
      }
    });
  });

  describe("getModelTypes (stable)", () => {
    it("should return array of model folder names", async () => {
      const types = await api.getModelTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain("checkpoints");
    });
  });

  describe("getModels (stable)", () => {
    it("should return models for a known folder", async () => {
      const models = await api.getModels("checkpoints");
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe("getFeatures", () => {
    it("should return server features", async () => {
      const features = await api.getFeatures();
      expect(features).toBeDefined();
      expect(typeof features.supports_preview_metadata).toBe("boolean");
      expect(typeof features.max_upload_size).toBe("number");
    });
  });

  describe("getModelTypes", () => {
    it("should return array of model folder names", async () => {
      const types = await api.getModelTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain("checkpoints");
    });
  });

  describe("getModels", () => {
    it("should return models for a known folder", async () => {
      const models = await api.getModels("checkpoints");
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe("getWorkflowTemplates", () => {
    it("should return workflow templates map", async () => {
      const templates = await api.getWorkflowTemplates();
      expect(templates).toBeDefined();
      expect(typeof templates).toBe("object");
    });
  });

  describe("getViewMetadata", () => {
    it("should return metadata for a known model", async () => {
      const checkpoints = await api.getCheckpoints();
      if (checkpoints.length === 0) return;
      const metadata = await api.getViewMetadata("checkpoints", checkpoints[0]);
      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe("object");
    });

    it("should return empty object for unknown model", async () => {
      const metadata = await api.getViewMetadata("checkpoints", "nonexistent_model.safetensors");
      expect(metadata).toEqual({});
    });
  });

  describe("clearHistory", () => {
    it("should accept clear option without error", async () => {
      await expect(api.clearHistory({ clear: true })).resolves.toBeUndefined();
    });
  });

  describe("manageQueue", () => {
    it("should accept clear option without error", async () => {
      await expect(api.manageQueue({ clear: ["queue_pending", "queue_running"] })).resolves.toBeUndefined();
    });
  });

  describe("ext.manager", () => {
    it("should expose manager feature", () => {
      expect(api.ext.manager).toBeDefined();
      expect(typeof api.ext.manager.isSupported).toBe("boolean");
    });

    it("getVersion should throw when not supported", async () => {
      if (api.ext.manager.isSupported) return;
      expect(api.ext.manager.getVersion()).rejects.toThrow();
    });
  });

  describe("ext.monitor", () => {
    it("should expose monitor feature", () => {
      expect(api.ext.monitor).toBeDefined();
    });

    it("should report isSupported correctly", () => {
      expect(typeof api.ext.monitor.isSupported).toBe("boolean");
    });

    it("getGpuList should return data when supported", async () => {
      if (!api.ext.monitor.isSupported) return;
      const gpus = await api.ext.monitor.getGpuList();
      expect(gpus).not.toBeNull();
      expect(Array.isArray(gpus)).toBe(true);
    });

    it("getHddList should return data when supported", async () => {
      if (!api.ext.monitor.isSupported) return;
      const hdds = await api.ext.monitor.getHddList();
      expect(hdds).not.toBeNull();
    });

    it("switch should toggle monitoring", async () => {
      if (!api.ext.monitor.isSupported) return;
      const result = await api.ext.monitor.switch(true);
      expect(result).toBeDefined();
      await api.ext.monitor.switch(false);
    });

    it("setConfig should accept configuration", async () => {
      if (!api.ext.monitor.isSupported) return;
      const result = await api.ext.monitor.setConfig({ rate: 0.5 });
      expect(result).toBeDefined();
    });

    it("on/off should work for system_monitor events", () => {
      const cleanup = api.ext.monitor.on("system_monitor", () => {});
      expect(typeof cleanup).toBe("function");
      cleanup();
    });

    it("monitorData should reflect state", () => {
      const data = api.ext.monitor.monitorData;
      if (!api.ext.monitor.isSupported) {
        expect(data).toBe(false);
      }
    });
  });
});

describe("ComfyApi credentials", () => {
  it("should construct with basic credentials", () => {
    const client = new ComfyApi("http://localhost:9999", "test-id", {
      credentials: { type: "basic", username: "user", password: "pass" }
    });
    expect(client).toBeDefined();
    client.destroy();
  });

  it("should construct with bearer token credentials", () => {
    const client = new ComfyApi("http://localhost:9999", "test-id", {
      credentials: { type: "bearer_token", token: "my-token" }
    });
    expect(client).toBeDefined();
    client.destroy();
  });

  it("should construct with custom credentials", () => {
    const client = new ComfyApi("http://localhost:9999", "test-id", {
      credentials: { type: "custom", headers: { "X-Custom": "value" } }
    });
    expect(client).toBeDefined();
    client.destroy();
  });

  it("should accept custom WebSocket timeout", () => {
    if (!getTestHost()) return;
    const client = new ComfyApi(getTestHost(), "test-ws-timeout", {
      wsTimeout: 5000
    });
    expect(client).toBeDefined();
    client.destroy();
  });

  it("should accept listenTerminal option", () => {
    if (!getTestHost()) return;
    const client = new ComfyApi(getTestHost(), "test-terminal", {
      listenTerminal: true
    });
    expect(client.listenTerminal).toBe(true);
    client.destroy();
  });
});

describe("ComfyApi generateId", () => {
  it("should generate a UUID-like id", () => {
    const id = ComfyApi.generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("should generate unique ids", () => {
    const ids = new Set(Array.from({ length: 20 }, () => ComfyApi.generateId()));
    expect(ids.size).toBe(20);
  });
});

describe("ComfyApi fetchApi", () => {
  it("should make raw fetch requests", async () => {
    if (!getTestHost()) return;
    const res = await createTestClient().fetchApi("/system_stats");
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.system).toBeDefined();
  });
});

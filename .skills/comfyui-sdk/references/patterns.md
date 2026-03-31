# Usage Patterns

## Authentication

### Basic Auth

```typescript
const api = new ComfyApi("http://host:8188", undefined, {
  credentials: { type: "basic", username: "user", password: "pass" }
});
```

### Bearer Token

```typescript
const api = new ComfyApi("http://host:8188", undefined, {
  credentials: { type: "bearer_token", token: "my-token" }
});
```

### Custom Headers

```typescript
const api = new ComfyApi("http://host:8188", undefined, {
  credentials: { type: "custom", headers: { "X-API-Key": "key123" } }
});
```

## Event Handling

### WebSocket Events

```typescript
const cleanup = api.on("execution_success", (ev) => {
  console.log("Prompt completed:", ev.detail);
});

// Cleanup when done
cleanup();
```

### Available Events

- `connected`, `disconnected`, `reconnected` — connection lifecycle
- `execution_start`, `executing`, `executed`, `execution_success` — workflow execution
- `progress` — `{ value, max, prompt_id, node }` progress updates
- `execution_error`, `execution_interrupted` — failures
- `status` — `{ status: { exec_info: { queue_remaining } } }` queue status
- `log` — `{ msg, data }` internal log messages

### Log Events

Use `addEventListener` directly (not `api.on`) to avoid `off()` recursion:

```typescript
const handler = (ev: any) => {
  api.removeEventListener("log", handler);
  // process ev.detail
};
api.addEventListener("log", handler);
```

## PromptBuilder Patterns

### Multi-value Input (e.g., width + height)

```typescript
builder.setInputNode("size", "5.inputs.width").appendInputNode("size", "5.inputs.height").input("size", 1024); // sets both width and height
```

### Bypass Nodes (e.g., skip upscaling)

```typescript
const builder = baseWorkflow
  .bypass("10") // bypass upscale model
  .bypass(["11", "12"]); // bypass upscale + save steps
```

### Path Encoding for Cross-Platform

```typescript
import { OSType } from "@saintno/comfyui-sdk";

builder.input("checkpoint", "models/SDXL/model.safetensors", OSType.NT);
// Result: "models\\SDXL\\model.safetensors"
```

### InputRaw for Direct Path Access

```typescript
builder.inputRaw("3.inputs.seed", 42); // mutates in-place, no clone
```

## Error Handling

### CallWrapper — Always Handle onFailed

```typescript
new CallWrapper(api, workflow)
  .onFinished((data) => {
    /* success */
  })
  .onFailed((err) => {
    console.error(err.message);
  }) // REQUIRED
  .run();
```

### Invalid Checkpoint — Expect Failure

```typescript
new CallWrapper(api, invalidWorkflow)
  .onFinished(() => {
    /* should not reach */
  })
  .onFailed((err) => {
    // err is an Error object with .message
  })
  .run();
```

### Timeout for Long Workflows

```typescript
new CallWrapper(api, workflow)
  .onFinished(() => {
    /* ... */
  })
  .onFailed(() => {
    /* ... */
  })
  .run();

// External timeout wrapper:
const timeout = setTimeout(() => {
  /* handle */
}, 120_000);
```

## ComfyPool Patterns

### Single Job

```typescript
const stats = await pool.run(async (api) => api.getSystemStats());
```

### Filtered Execution

```typescript
const result = await pool.run(jobFn, 1, { includeIds: ["gpu-fast"] });
```

### Pool Events

```typescript
pool.on("ready", (ev) => console.log(`Client ${ev.detail.clientIdx} ready`));
pool.on("execution_error", (ev) => console.error(`Error on ${ev.detail.clientIdx}`));
pool.on("change_mode", (ev) => console.log("Mode:", ev.detail.mode));
```

### Mode Switching

```typescript
pool.changeMode(EQueueMode.PICK_ROUTINE);
```

## User Data CRUD

### Store JSON

```typescript
await api.storeUserData("workflows/my-workflow.json", { prompt: {...} }, {
  overwrite: true,
  stringify: true,
  throwOnError: true
});
```

### Read Back

```typescript
const res = await api.getUserData("workflows/my-workflow.json");
const data = await res.json();
```

### V2 Listing with Metadata

```typescript
const entries = await api.listUserDataV2("workflows");
entries.forEach((e) => {
  if (e.type === "file") {
    console.log(`${e.name}: ${e.size} bytes, modified ${new Date(e.modified * 1000)}`);
  }
});
```

### Move / Delete

```typescript
await api.moveUserData("workflows/old.json", "workflows/new.json", { overwrite: true });
await api.deleteUserData("workflows/new.json");
```

## Queue Management

### Clear All Queues

```typescript
await api.manageQueue({ clear: ["queue_pending", "queue_running"] });
```

### Delete Specific Item

```typescript
await api.manageQueue({ delete: [promptId] });
```

### Interrupt Running Workflow

```typescript
await api.interrupt();
```

### Clear History

```typescript
await api.clearHistory({ clear: true });
```

### Delete Specific History

```typescript
await api.clearHistory({ delete: [promptId1, promptId2] });
```

## Monitoring (Crystools)

```typescript
if (api.ext.monitor.isSupported) {
  const gpus = await api.ext.monitor.getGpuList();
  await api.ext.monitor.switch(true);
  await api.ext.monitor.setConfig({ rate: 1 });

  api.ext.monitor.on("system_monitor", (ev) => {
    const d = ev.detail;
    console.log(`CPU: ${d.cpu_utilization}%`);
    console.log(`RAM: ${d.ram_used_percent}%`);
    d.gpus?.forEach((g) => {
      console.log(`GPU ${g.gpu_name}: ${g.gpu_utilization}%, ${g.vram_used_percent}% VRAM`);
    });
  });
}
```

---
name: comfyui-sdk
description: "TypeScript SDK for ComfyUI server communication (@saintno/comfyui-sdk). Use when building apps that interact with a ComfyUI server - including workflow submission, progress tracking, image retrieval, multi-client pool management, prompt building, and server monitoring. Covers ComfyApi client, CallWrapper for workflow execution, PromptBuilder for workflow mutation, ComfyPool for multi-node distribution, and ext features (ManagerFeature, MonitoringFeature). Install via bun add @saintno/comfyui-sdk or npm install @saintno/comfyui-sdk. Runtime: Bun or Node.js with ws dependency."
---

# ComfyUI SDK

## Quick Start

```typescript
import { ComfyApi } from "@saintno/comfyui-sdk";

const api = new ComfyApi("http://localhost:8188");
await api.init().waitForReady();
const stats = await api.getSystemStats();
api.destroy();
```

### Workflow Execution

```typescript
import { ComfyApi } from "@saintno/comfyui-sdk";
import { PromptBuilder } from "@saintno/comfyui-sdk";
import { CallWrapper } from "@saintno/comfyui-sdk";
import { seed } from "@saintno/comfyui-sdk";

const api = new ComfyApi("http://localhost:8188");
await api.init().waitForReady();

const builder = new PromptBuilder(workflowJson, ["positive", "negative", "checkpoint", "seed"], ["images"])
  .setInputNode("positive", "6.inputs.text")
  .setInputNode("negative", "7.inputs.text")
  .setInputNode("checkpoint", "4.inputs.ckpt_name")
  .setInputNode("seed", "3.inputs.seed")
  .setOutputNode("images", "9")
  .input("positive", "a beautiful landscape")
  .input("negative", "blurry, watermark")
  .input("checkpoint", "model.safetensors")
  .input("seed", seed());

new CallWrapper(api, builder)
  .onFinished((data) => {
    console.log(api.getPathImage(data.images.images[0]));
  })
  .onFailed((err) => console.error("Failed:", err.message))
  .run();
```

### Multi-Client Pool

```typescript
import { ComfyPool, EQueueMode } from "@saintno/comfyui-sdk";

const pool = new ComfyPool(
  [new ComfyApi("http://gpu1:8188", "client-1"), new ComfyApi("http://gpu2:8188", "client-2")],
  EQueueMode.PICK_ZERO
);

pool.on("ready", (ev) => console.log(`Client ${ev.detail.clientIdx} ready`));

const result = await pool.run(async (api) => api.getSystemStats());
pool.destroy();
```

## Architecture

```
ComfyApi          → Main client, extends EventTarget
CallWrapper       → Runs a PromptBuilder workflow, emits callbacks
PromptBuilder     → Immutable fluent API to mutate workflow JSON
ComfyPool         → Distributes jobs across multiple ComfyApi clients
WebSocketClient   → Auto-picks native ws (browser) vs ws (Node)
```

## Key Rules

1. Always call `api.init().waitForReady()` before making API calls
2. Always call `api.destroy()` when done (closes WebSocket, cleans up listeners)
3. Never call `fetch` directly — use `api.fetchApi(route, options)`
4. Check `api.ext.manager.isSupported` / `api.ext.monitor.isSupported` before calling feature methods
5. PromptBuilder methods return clones — original is not mutated
6. CallWrapper `onFailed` is mandatory — unhandled errors crash silently

## Conventions

- **No comments** in code — self-documenting only
- **Imports** use path alias `import { X } from "src/module"`, not relative paths
- **Type imports** use inline `import("path").Type` to avoid circular deps
- **Error handling** — `this.log(fnName, message, data)` dispatches `"log"` event, then re-throws
- **No emojis** unless explicitly requested
- **Naming** — PascalCase classes, camelCase methods, UPPER_SNAKE_CASE constants

## API Reference

See [references/api-reference.md](references/api-reference.md) for complete method signatures, return types, and deprecation status.

## Usage Patterns

See [references/patterns.md](references/patterns.md) for common workflows including authentication, event handling, error handling, and batch processing.

## Testing

```bash
bun test                         # Unit tests only (integration auto-skipped)
COMFYUI_HOST=http://host:8188 bun test  # Full suite with live server
```

Integration tests use `describe.skipIf(!process.env.COMFYUI_HOST)` — they skip silently without a server. Set `COMFYUI_HOST` to enable them. Workflow execution tests need `it("name", fn, 120_000)` timeout.

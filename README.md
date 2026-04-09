# ✨ ComfyUI SDK ✨

[![NPM Version](https://img.shields.io/npm/v/@saintno/comfyui-sdk?style=flat-square)](https://www.npmjs.com/package/@saintno/comfyui-sdk)
[![License](https://img.shields.io/npm/l/@saintno/comfyui-sdk?style=flat-square)](https://github.com/tctien342/comfyui-sdk/blob/main/LICENSE)
![CI](https://github.com/tctien342/comfyui-sdk/actions/workflows/release.yml/badge.svg)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-donate-yellow.svg)](https://www.buymeacoffee.com/tctien342)

A robust and meticulously crafted TypeScript SDK 🚀 for seamless interaction with the [ComfyUI](https://github.com/comfyanonymous/ComfyUI) API. This SDK significantly simplifies the complexities of building, executing, and managing ComfyUI workflows, all while providing real-time updates and supporting multiple instances. 🖼️

## 🧭 Table of Contents

- [🌟 Key Features 🌟](#-key-features-)
- [📦 Installation 📦](#-installation-)
- [🛠️ CLI — `cfli` 🛠️](#-cli--cfli-)
  - [Install](#install)
  - [Quick Start](#quick-start)
  - [Flags](#flags)
  - [Codegen Typed Workflow Builder](#codegen-typed-workflow-builder)
  - [Output Format](#output-format)
  - [Downloading Media](#downloading-media)
- [🚀 Getting Started 🚀](#-getting-started-)
  - [🎬 Basic Usage](#-basic-usage)
  - [🧠 Type-Safe Workflow Builder (Generated)](#-type-safe-workflow-builder-generated)
  - [🔄 Managing Multiple Instances with `ComfyPool`](#-managing-multiple-instances-with-comfypool)
  - [🔑 Authentication](#-authentication)
- [📚 API Reference 📚](#-api-reference-)
  - [`ComfyApi`](#comfyapi)
  - [`CallWrapper`](#callwrapper)
  - [`PromptBuilder`](#promptbuilder)
  - [`WorkflowBuilder` and `NodeRef`](#workflowbuilder-and-noderef)
  - [`ComfyPool`](#comfypool)
  - [🗂️ Enums](#-enums)
  - [🗄️ Types](#-types)
  - [🧩 Features](#-features)
- [📂 Examples](#-examples)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)

## 🌟 Key Features 🌟

- **💎 TypeScript Powered**: Enjoy a fully typed codebase, ensuring enhanced development, maintainability, and type safety. 🛡️
- **🏗️ Workflow Builder**: Construct and manipulate intricate ComfyUI workflows effortlessly using a fluent, intuitive builder pattern. 🧩
- **🧠 Typed Codegen Builder**: Generate a fully typed `WorkflowBuilder` from your live ComfyUI server and build workflows with autocomplete. ✨
- **🤹 Multi-Instance Management**: Handle a pool of ComfyUI instances with ease, employing flexible queueing strategies for optimal resource utilization. 🌐
- **⚡ Real-Time Updates**: Subscribe to WebSocket events for live progress tracking, image previews, and error notifications. 🔔
- **🔧 Custom WebSocket Support**: Supply your own WebSocket implementation for greater flexibility in different environments, with robust reconnection handling and fallback options. 🔄
- **🔑 Authentication Flexibility**: Supports Basic Auth, Bearer Token, and Custom Authentication Headers, catering to diverse security requirements. 🔒
- **🔌 Extension Support**: Seamlessly integrate with ComfyUI Manager and leverage system monitoring through the ComfyUI-Crystools extension. 🛠️
- **🔀 Flexible Node Bypassing**: Strategically bypass specific nodes in your workflows during generation, enabling advanced customization. ⏭️
- **📚 Comprehensive Examples**: Includes practical examples for Text-to-Image (T2I), Image-to-Image (I2I), and complex multi-node workflows. 📝
- **🚨 Robust Error Handling**: Provides detailed error messages to facilitate debugging and graceful handling of API failures. 🐛
- **📝 Automatic Changelog**: Automatically generates a changelog with each release, utilizing `auto-changelog` for transparent version tracking. 🔄

## 📦 Installation 📦

```bash
bun add @saintno/comfyui-sdk
```

or

```bash
npm i @saintno/comfyui-sdk
```

## 🛠️ CLI — `cfli`

Run ComfyUI workflows directly from the terminal. Installed automatically with the SDK.

### Install

```bash
# Already included with the SDK
npm install -g @saintno/comfyui-sdk

# Or use without installing
npx @saintno/comfyui-sdk -f workflow.json --json
```

### Quick Start

```bash
cfli -f workflow.json \
  -i 4.inputs.ckpt_name=SDXL/realvisxlV40_v40LightningBakedvae.safetensors \
  -i 5.inputs.width=1024 \
  -i 5.inputs.height=1024 \
  -p 6.inputs.text="A picture of cute cat"
```

### Flags

| Flag                          | Short | Description                                                              |
| ----------------------------- | ----- | ------------------------------------------------------------------------ |
| `-f, --file <path>`           |       | Workflow JSON file to execute (required)                                 |
| `-i, --input <key=value>`     |       | Set workflow input value (repeatable)                                    |
| `-p, --prompt <key=value>`    |       | Alias for `--input`                                                      |
| `-H, --host <url>`            |       | ComfyUI server URL (default: `$COMFYUI_HOST` or `http://localhost:8188`) |
| `-t, --timeout <ms>`          |       | Execution timeout (default: `120000`)                                    |
| `-o, --output <path>`         |       | Output path (default: `./output`, or `./comfyui-nodes.ts` for `codegen`) |
| `-j, --json`                  |       | Output results as JSON                                                   |
| `-q, --quiet`                 |       | Suppress progress output                                                 |
| `-d, --download`              |       | Download output images to `-o` directory                                 |
| `--no-download`               |       | Skip downloading output images                                           |
| `--token <token>`             |       | Bearer token for authentication                                          |
| `--user <user> --pass <pass>` |       | Basic auth credentials                                                   |
| `--output-nodes <id,id>`      |       | Comma-separated node IDs to capture output                               |
| `-v, --version`               |       | Print version                                                            |
| `-h, --help`                  |       | Show help                                                                |

### Codegen Typed Workflow Builder

Generate a typed `WorkflowBuilder` from your server node definitions:

```bash
cfli codegen -H http://localhost:8188 -o ./src/comfyui/nodes.ts
```

Then use it in your SDK code for type-safe node inputs/outputs with autocomplete.

### Output Format

Terminal mode (default):

```
Connected to http://192.168.14.93:8188
Queued: 3c9b01ee-eaed-435a-8c0c-2a41706c5c90
Done sample.json in 508ms
Outputs: _raw
Media:
  ComfyUI_00102_.png: http://192.168.14.93:8188/view?filename=ComfyUI_00102_.png&type=output&subfolder=
```

JSON mode (`--json`):

```json
{
  "status": "completed",
  "duration_ms": 531,
  "server": { "host": "http://192.168.14.93:8188" },
  "overrides": { "6.inputs.text": "A picture of cute cat" },
  "outputs": {
    "_raw": {
      "9": {
        "images": [{ "filename": "ComfyUI_00102_.png", "subfolder": "", "type": "output" }]
      }
    }
  },
  "_media": {
    "ComfyUI_00102_.png": "http://192.168.14.93:8188/view?filename=ComfyUI_00102_.png&type=output&subfolder="
  }
}
```

### Downloading Media

Use `-d` to auto-download all output images:

```bash
cfli -f workflow.json -d
# Saves to ./output/ComfyUI_00102_.png

cfli -f workflow.json -d -o ./renders
# Saves to ./renders/ComfyUI_00102_.png
```

In download mode, the `_media` and terminal output show both the URL and local path:

```
Media:
  ComfyUI_00102_.png: http://... -> /Users/you/output/ComfyUI_00102_.png
```

---

## 🚀 Getting Started (SDK) 🚀

### 🎬 Basic Usage

Here's a simplified example to quickly get you started:

```typescript
import { ComfyApi, CallWrapper, PromptBuilder, TSamplerName, TSchedulerName, seed } from "@saintno/comfyui-sdk";
import ExampleTxt2ImgWorkflow from "./example-txt2img-workflow.json";

const api = new ComfyApi("http://localhost:8189").init();
const workflow = new PromptBuilder(
  ExampleTxt2ImgWorkflow,
  ["positive", "negative", "checkpoint", "seed", "batch", "step", "cfg", "sampler", "sheduler", "width", "height"],
  ["images"]
)
  .setInputNode("checkpoint", "4.inputs.ckpt_name")
  .setInputNode("seed", "3.inputs.seed")
  .setInputNode("batch", "5.inputs.batch_size")
  .setInputNode("negative", "7.inputs.text")
  .setInputNode("positive", "6.inputs.text")
  .setInputNode("cfg", "3.inputs.cfg")
  .setInputNode("sampler", "3.inputs.sampler_name")
  .setInputNode("sheduler", "3.inputs.scheduler")
  .setInputNode("step", "3.inputs.steps")
  .setInputNode("width", "5.inputs.width")
  .setInputNode("height", "5.inputs.height")
  .setOutputNode("images", "9")
  .input("checkpoint", "SDXL/realvisxlV40_v40LightningBakedvae.safetensors", api.osType)
  .input("seed", seed())
  .input("step", 6)
  .input("cfg", 1)
  .input<TSamplerName>("sampler", "dpmpp_2m_sde_gpu")
  .input<TSchedulerName>("sheduler", "sgm_uniform")
  .input("width", 1024)
  .input("height", 1024)
  .input("batch", 1)
  .input("positive", "A picture of cute dog on the street");

new CallWrapper(api, workflow)
  .onFinished((data) => console.log(data.images?.images.map((img: any) => api.getPathImage(img))))
  .run();
```

#### 🔍 Breakdown

- Import essential components from the SDK.
- Create and initialize the `ComfyApi` instance.
- Use `PromptBuilder` to define the workflow structure and set input nodes.
- Set specific input values, including the checkpoint path, seed, and prompt.
- Execute the workflow and log the generated image URLs using the `CallWrapper`.

### 🧠 Type-Safe Workflow Builder (Generated)

Use the generated typed builder from `cfli codegen`:

```typescript
import { ComfyApi, CallWrapper } from "@saintno/comfyui-sdk";
import { WorkflowBuilder } from "./comfyui/nodes";

const api = new ComfyApi("http://localhost:8188");
await api.init(5, 2000).waitForReady();

const wf = new WorkflowBuilder();
const ckpt = wf.CheckpointLoaderSimple({ ckpt_name: "v1-5-pruned.safetensors" });
const pos = wf.CLIPTextEncode({ text: "landscape", clip: ckpt.CLIP });
const neg = wf.CLIPTextEncode({ text: "ugly", clip: ckpt.CLIP });
const lat = wf.EmptyLatentImage({ width: 512, height: 512, batch_size: 1 });
const smp = wf.KSampler({
  model: ckpt.MODEL,
  positive: pos.CONDITIONING,
  negative: neg.CONDITIONING,
  latent_image: lat.LATENT,
  seed: 42,
  steps: 20,
  cfg: 7,
  sampler_name: "euler",
  scheduler: "normal",
  denoise: 1
});
const vae = wf.VAEDecode({ samples: smp.LATENT, vae: ckpt.VAE });
const save = wf.SaveImage({ images: vae.IMAGE, filename_prefix: "output" });

const builder = wf.build({
  inputs: { seed: smp.inputs.seed },
  outputs: { images: save.__id }
});

await new CallWrapper(api, builder).run();
```

#### 🔍 Breakdown

- Generate once per server setup/version: `cfli codegen -H <host> -o ./src/comfyui/nodes.ts`.
- Build workflows directly in TypeScript instead of hand-editing workflow JSON.
- Use generated input path metadata like `smp.inputs.seed` to avoid hard-coded node path strings.
- `CallWrapper` infers named output payload types from generated `__id` handles (with safe fallback for unknown node outputs).
- `NodeRef` typing prevents mismatched node output/input wiring at compile time.

### 🔄 Managing Multiple Instances with `ComfyPool`

```typescript
import {
  ComfyApi,
  CallWrapper,
  ComfyPool,
  EQueueMode,
  PromptBuilder,
  seed,
  TSamplerName,
  TSchedulerName
} from "@saintno/comfyui-sdk";
import ExampleTxt2ImgWorkflow from "./example-txt2img-workflow.json";

const ApiPool = new ComfyPool(
  [new ComfyApi("http://localhost:8188"), new ComfyApi("http://localhost:8189")],
  EQueueMode.PICK_ZERO
)
  .on("init", () => console.log("Pool in initializing"))
  .on("add_job", (ev) => console.log("Job added at index", ev.detail.jobIdx, "weight:", ev.detail.weight))
  .on("added", (ev) => console.log("Client added", ev.detail.clientIdx));

const generateFn = async (api: ComfyApi, clientIdx?: number) => {
  const workflow = new PromptBuilder(
    ExampleTxt2ImgWorkflow,
    ["positive", "negative", "checkpoint", "seed", "batch", "step", "cfg", "sampler", "sheduler", "width", "height"],
    ["images"]
  )
    .setInputNode("checkpoint", "4.inputs.ckpt_name")
    .setInputNode("seed", "3.inputs.seed")
    .setInputNode("batch", "5.inputs.batch_size")
    .setInputNode("negative", "7.inputs.text")
    .setInputNode("positive", "6.inputs.text")
    .setInputNode("step", "3.inputs.steps")
    .setInputNode("width", "5.inputs.width")
    .setInputNode("height", "5.inputs.height")
    .setInputNode("cfg", "3.inputs.cfg")
    .setInputNode("sampler", "3.inputs.sampler_name")
    .setInputNode("scheduler", "3.inputs.scheduler")
    .setOutputNode("images", "9")
    .input("checkpoint", "SDXL/realvisxlV40_v40LightningBakedvae.safetensors", api.osType)
    .input("seed", seed())
    .input("step", 6)
    .input("width", 512)
    .input("height", 512)
    .input("batch", 2)
    .input("cfg", 1)
    .input<TSamplerName>("sampler", "dpmpp_2m_sde_gpu")
    .input<TSchedulerName>("scheduler", "sgm_uniform")
    .input("positive", "A close up picture of cute Cat")
    .input("negative", "text, blurry, bad picture, nsfw");

  return new Promise<string[]>((resolve) => {
    new CallWrapper(api, workflow)
      .onFinished((data) => {
        const url = data.images?.images.map((img: any) => api.getPathImage(img));
        resolve(url as string[]);
      })
      .run();
  });
};

const jobA = ApiPool.batch(Array(5).fill(generateFn), 10).then((res) => {
  console.log("Batch A done");
  return res.flat();
});

const jobB = ApiPool.batch(Array(5).fill(generateFn), 0).then((res) => {
  console.log("Batch B done");
  return res.flat();
});

console.log(await Promise.all([jobA, jobB]).then((res) => res.flat()));
```

#### 🔍 Breakdown

- Create a `ComfyPool` with multiple `ComfyApi` instances.
- Set up event listeners for pool initialization, job additions, and client connections.
- Define an async function (`generateFn`) that creates a workflow, sets its inputs, and executes it with a `CallWrapper`.
- Use `ApiPool.batch` to run multiple jobs and wait for all batches to complete.

### 🔑 Authentication

```typescript
import { ComfyApi, BasicCredentials, BearerTokenCredentials, CustomCredentials } from "@saintno/comfyui-sdk";

// Basic Authentication
const basicAuth = new ComfyApi("http://localhost:8189", "node-id", {
  credentials: { type: "basic", username: "username", password: "password" } as BasicCredentials
}).init();

// Bearer Token Authentication
const bearerAuth = new ComfyApi("http://localhost:8189", "node-id", {
  credentials: { type: "bearer_token", token: "your_bearer_token" } as BearerTokenCredentials
}).init();

// Custom Header Authentication
const customAuth = new ComfyApi("http://localhost:8189", "node-id", {
  credentials: { type: "custom", headers: { "X-Custom-Header": "your_custom_header" } } as CustomCredentials
}).init();
```

#### 🔍 Breakdown

- Import the necessary types from the SDK.
- Create `ComfyApi` instances using the corresponding credential types: `BasicCredentials`, `BearerTokenCredentials`, and `CustomCredentials`..

### 🔌 Custom WebSocket Implementation

```typescript
import { ComfyApi, WebSocketInterface } from "@saintno/comfyui-sdk";
import CustomWebSocket from "your-custom-websocket-library";

// Create a ComfyApi instance with a custom WebSocket implementation
const api = new ComfyApi("http://localhost:8189", "node-id", {
  credentials: { type: "basic", username: "username", password: "password" },
  customWebSocketImpl: CustomWebSocket as WebSocketInterface
}).init();
```

#### 🔍 Breakdown

- Import the necessary types and your custom WebSocket implementation.
- Pass the custom WebSocket implementation to the ComfyApi constructor using the `customWebSocketImpl` option.
- The SDK will use your implementation instead of the default one, allowing for greater flexibility in environments where the standard WebSocket implementation might not be available or suitable.

#### 📝 Benefits

- **Environment Flexibility**: Run in environments where the standard WebSocket might not be available or optimal.
- **Enhanced Stability**: The SDK includes robust reconnection logic with exponential backoff and jitter to handle connection issues gracefully.
- **Fallback Mechanism**: Automatically falls back to HTTP polling if WebSocket connections fail, ensuring your application remains functional.
- **Custom Protocol Support**: Implement custom protocols or security features through your WebSocket implementation.

## 📚 API Reference 📚

### `ComfyApi`

#### 🏗️ Constructor

```typescript
constructor(host: string, clientId: string, opts?: { forceWs?: boolean, wsTimeout?: number, credentials?: BasicCredentials | BearerTokenCredentials | CustomCredentials; })
```

- `host`: The base URL of your ComfyUI server.
- `clientId`: A unique ID for WebSocket communication (optional). Defaults to a generated ID.
- `opts`: Optional settings:
  - `forceWs`: Boolean to force WebSocket usage.
  - `wsTimeout`: Timeout for WebSocket connections (milliseconds).
  - `credentials`: Optional authentication credentials.

#### ⚙️ Methods

- `init(maxTries?: number, delayTime?: number)`: Initializes the client and establishes connection.
- `on<K extends keyof TComfyAPIEventMap>(type: K, callback: (event: TComfyAPIEventMap[K]) => void, options?: AddEventListenerOptions | boolean)`: Attach an event listener.
- `off<K extends keyof TComfyAPIEventMap>(type: K, callback: (event: TComfyAPIEventMap[K]) => void, options?: EventListenerOptions | boolean)`: Detach an event listener.
- `removeAllListeners()`: Detach all event listeners.
- `fetchApi(route: string, options?: FetchOptions)`: Fetch data from the API endpoint.
- `pollStatus(timeout?: number)`: Polls the ComfyUI server status.
- `queuePrompt(number: number | null, workflow: object)`: Queues a prompt for processing.
- `appendPrompt(workflow: object)`: Adds a prompt to the workflow queue.
- `getQueue()`: Retrieves the current state of the queue.
- `getHistories(maxItems?: number)`: Retrieves the prompt execution history.
- `getHistory(promptId: string)`: Retrieves a specific history entry by ID.
- `getSystemStats()`: Retrieves system and device statistics.
- `getExtensions()`: Retrieves a list of installed extensions.
- `getEmbeddings()`: Retrieves a list of available embeddings.
- `getCheckpoints()`: Retrieves a list of available checkpoints.
- `getLoras()`: Retrieves a list of available Loras.
- `getSamplerInfo()`: Retrieves sampler and scheduler information.
- `getNodeDefs(nodeName?: string)`: Retrieves node object definitions.
- `getUserConfig()`: Get user configuration data.
- `createUser(username: string)`: Create new user.
- `getSettings()`: Get all setting values for the current user.
- `getSetting(id: string)`: Get a specific setting for the current user.
- `storeSettings(settings: Record<string, unknown>)`: Store setting for the current user.
- `storeSetting(id: string, value: unknown)`: Store a specific setting for the current user.
- `uploadImage(file: Buffer | Blob, fileName: string, config?: { override?: boolean; subfolder?: string })`: Uploads an image file.
- `uploadMask(file: Buffer | Blob, originalRef: ImageInfo)`: Uploads a mask file.
- `freeMemory(unloadModels: boolean, freeMemory: boolean)`: Frees memory by unloading models.
- `getPathImage(imageInfo: ImageInfo)`: Returns the path to an image.
- `getImage(imageInfo: ImageInfo)`: Returns the blob data of image.
- `getUserData(file: string)`: Get a user data file.
- `storeUserData(file: string, data: unknown, options?: RequestInit & { overwrite?: boolean, stringify?: boolean, throwOnError?: boolean })`: Store a user data file.
- `deleteUserData(file: string)`: Delete a user data file.
- `moveUserData(source: string, dest: string, options?: RequestInit & { overwrite?: boolean })`: Move a user data file.
- `listUserData(dir: string, recurse?: boolean, split?: boolean)`: List a user data file.
- `interrupt()`: Interrupts the execution of the running prompt.
- `reconnectWs(opened?: boolean)`: Reconnects to the WebSocket server.

### `CallWrapper`

#### 🏗️ Constructor

```typescript
constructor(client: ComfyApi, workflow: PromptBuilder<I, O, T>)
```

- `client`: An instance of the `ComfyApi` client.
- `workflow`: An instance of `PromptBuilder` defining the workflow.

#### ⚙️ Methods

- `onPreview(fn: (ev: Blob, promptId?: string) => void)`: Set callback for preview events.
- `onPending(fn: (promptId?: string) => void)`: Set callback when job is queued.
- `onStart(fn: (promptId?: string) => void)`: Set callback when the job is started.
- `onOutput(fn: (key: keyof PromptBuilder<I, O, T>["mapOutputKeys"], data: any, promptId?: string) => void)`: Sets a callback for when an output node is executed.
- `onFinished(fn: (data: Record<keyof PromptBuilder<I, O, T>["mapOutputKeys"], any>, promptId?: string) => void)`: Set callback when the job is finished.
- `onFailed(fn: (err: Error, promptId?: string) => void)`: Set callback when the job failed.
- `onProgress(fn: (info: NodeProgress, promptId?: string) => void)`: Set callback for progress updates.
- `run()`: Executes the workflow.

### `PromptBuilder`

#### 🏗️ Constructor

```typescript
constructor(prompt: T, inputKeys: I[], outputKeys: O[])
```

- `prompt`: The initial workflow data object.
- `inputKeys`: An array of input node keys.
- `outputKeys`: An array of output node keys.

#### ⚙️ Methods

- `clone()`: Creates a new `PromptBuilder` instance with the same configuration.
- `bypass(node: keyof T | (keyof T)[]): PromptBuilder<I, O, T>`: Marks node(s) to be bypassed at generation.
- `reinstate(node: keyof T | (keyof T)[]): PromptBuilder<I, O, T>`: Unmarks node(s) from bypass at generation.
- `setInputNode(input: I, key: DeepKeys<T> | Array<DeepKeys<T>>)`: Sets input node path for a key.
- `setRawInputNode(input: I, key: string | string[])`: Sets raw input node path for a key.
- `appendInputNode(input: I, key: DeepKeys<T> | Array<DeepKeys<T>>)`: Appends a node to the input node path.
- `appendRawInputNode(input: I, key: string | string[])`: Appends a node to the raw input node path.
- `setOutputNode(output: O, key: DeepKeys<T>)`: Sets output node path for a key.
- `setRawOutputNode(output: O, key: string)`: Sets raw output node path for a key.
- `input<V = string | number | undefined>(key: I, value: V, encodeOs?: OSType)`: Sets an input value.
- `inputRaw<V = string | number | undefined>(key: string, value: V, encodeOs?: OSType)`: Sets a raw input value with dynamic key.
- `get workflow`: Retrieves the workflow object.
- `get caller`: Retrieves current `PromptBuilder` object.

### `WorkflowBuilder` and `NodeRef`

`WorkflowBuilder` is a base class for generated builders created by `cfli codegen`.

- `NodeRef<T>`: A typed `[nodeId, outputIndex]` tuple used for connecting node outputs to node inputs.
- `workflow`: Returns the assembled workflow JSON (`NodeData`) as a deep clone.
- `build(config?)`: Returns a `PromptBuilder` mapped with optional dynamic `inputs` and `outputs`.

Use this flow for best DX:

1. Generate: `cfli codegen -H http://localhost:8188 -o ./src/comfyui/nodes.ts`
2. Import generated `WorkflowBuilder` from your app.
3. Compose nodes with full autocomplete and run via `CallWrapper`.

### `ComfyPool`

#### 🏗️ Constructor

```typescript
constructor(clients: ComfyApi[], mode: EQueueMode = EQueueMode.PICK_ZERO)
```

- `clients`: Array of `ComfyApi` instances.
- `mode`: The queue mode using `EQueueMode` enum values.

#### ⚙️ Methods

- `on<K extends keyof TComfyPoolEventMap>(type: K, callback: (event: TComfyPoolEventMap[K]) => void, options?: AddEventListenerOptions | boolean)`: Attach an event listener.
- `off<K extends keyof TComfyPoolEventMap>(type: K, callback: (event: TComfyPoolEventMap[K]) => void, options?: EventListenerOptions | boolean)`: Detach an event listener.
- `addClient(client: ComfyApi)`: Adds a new client to the pool.
- `removeClient(client: ComfyApi)`: Removes a client from the pool.
- `removeClientByIndex(index: number)`: Removes a client by index.
- `changeMode(mode: EQueueMode)`: Changes the queue mode.
- `pick(idx?: number)`: Picks a client by index.
- `pickById(id: string)`: Picks a client by ID.
- `run<T>(job: (client: ComfyApi, clientIdx?: number) => Promise<T>, weight?: number, clientFilter?: { includeIds?: string[]; excludeIds?: string[] })`: Run a job with priority on an available client.
- `batch<T>(jobs: Array<(client: ComfyApi, clientIdx?: number) => Promise<T>>, weight?: number, clientFilter?: { includeIds?: string[]; excludeIds?: string[] })`: Run multiple jobs concurrently.

### 🗂️ Enums

- `EQueueMode`:
  - `PICK_ZERO`: Selects the client with zero remaining queue.
  - `PICK_LOWEST`: Selects the client with the lowest remaining queue.
  - `PICK_ROUTINE`: Selects clients in a round-robin manner.

### 🗄️ Types

- `OSType`:
  - `POSIX`: For Unix-like systems.
  - `NT`: For Windows systems.
  - `JAVA`: For Java virtual machine.
- `TSamplerName`: A union type of all available sampler names.
- `TSchedulerName`: A union type of all available scheduler names.

### 🧩 Features

- `ManagerFeature`: Provides methods to manage ComfyUI Manager Extension.

  ```typescript
  const api = new ComfyApi("http://localhost:8189").init();
  await api.waitForReady();

  if (api.ext.manager.isSupported) {
    await api.ext.manager.getExtensionList().then(console.log);
    // Check api.ext.manager for more methods
  }
  ```

- `MonitoringFeature`: Provides methods to monitor system resources using ComfyUI-Crystools Extension.

  ```typescript
  const api = new ComfyApi("http://localhost:8189").init();
  await api.waitForReady();

  if (api.ext.monitor.isSupported) {
    // For subscribing to system monitor events
    api.ext.monitor.on("system_monitor", (ev) => {
      console.log(ev.detail);
    });

    // For getting current monitor data
    console.log(api.ext.monitor.monitorData);
  }
  ```

> Note: Features require respective extensions ([ComfyUI-Manager](https://github.com/ltdrdata/ComfyUI-Manager) and [ComfyUI-Crystools](https://github.com/crystian/ComfyUI-Crystools)) to be installed.

## 📂 Examples

The `examples` directory contains practical demonstrations of SDK usage:

- `example-i2i.ts`: Demonstrates image-to-image generation.
- `example-pool.ts`: Demonstrates how to manage multiple ComfyUI instances using `ComfyPool`.
- `example-pool-basic-auth.ts`: Demonstrates how to use `ComfyPool` with HTTP Basic Authentication.
- `example-t2i.ts`: Demonstrates text-to-image generation.
- `example-t2i-upscaled.ts`: Demonstrates text-to-image generation with upscaling.
- `example-img2img-workflow.json`: Example workflow for image-to-image.
- `example-txt2img-workflow.json`: Example workflow for text-to-image.
- `example-txt2img-upscaled-workflow.json`: Example workflow for text-to-image with upscaling.

## 🤝 Contributing

Contributions are always welcome! Feel free to submit pull requests or create issues for bug reports and feature enhancements. 🙏

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for more details. 📄

# API Reference

## ComfyApi

```typescript
new ComfyApi(
  host: string,
  clientId?: string,              // auto-generated UUID if omitted
  opts?: {
    forceWs?: boolean
    wsTimeout?: number
    listenTerminal?: boolean
    customWebSocketImpl?: WebSocketInterface
    credentials?: BasicCredentials | BearerTokenCredentials | CustomCredentials
  }
)
```

### Lifecycle

| Method               | Signature                                            | Description                              |
| -------------------- | ---------------------------------------------------- | ---------------------------------------- |
| `init`               | `init(maxTries?, delayTime?)`                        | Start ping, features, WebSocket          |
| `waitForReady`       | `async waitForReady()`                               | Wait for WebSocket connection            |
| `destroy`            | `destroy()`                                          | Close WebSocket, remove listeners        |
| `ping`               | `async ping()`                                       | Health check, returns `{ status, time }` |
| `reconnectWs`        | `async reconnectWs(triggerEvent?)`                   | Reconnect WebSocket                      |
| `fetchApi`           | `async fetchApi(route, options?): Promise<Response>` | Raw HTTP, auto-injects credentials       |
| `on`                 | `on<K>(type, callback): () => void`                  | Listen to event, returns cleanup fn      |
| `off`                | `off<K>(type, callback)`                             | Remove listener                          |
| `removeAllListeners` | `removeAllListeners()`                               | Clear all listeners                      |

### Properties

| Property            | Type                                                      | Description               |
| ------------------- | --------------------------------------------------------- | ------------------------- |
| `apiHost`           | `string`                                                  | Server host URL           |
| `id`                | `string`                                                  | Client ID                 |
| `isReady`           | `boolean`                                                 | WebSocket connected       |
| `availableFeatures` | `{ manager: boolean, monitor: boolean }`                  | Feature support flags     |
| `listenTerminal`    | `boolean`                                                 | Terminal log subscription |
| `ext`               | `{ manager: ManagerFeature, monitor: MonitoringFeature }` | Extension features        |

### Stable API Methods

#### System

| Method             | Returns               | Route             |
| ------------------ | --------------------- | ----------------- |
| `getSystemStats()` | `SystemStatsResponse` | GET /system_stats |
| `getFeatures()`    | `ServerFeatures`      | GET /features     |
| `getExtensions()`  | `string[]`            | GET /extensions   |
| `getEmbeddings()`  | `string[]`            | GET /embeddings   |

#### Models

| Method                              | Returns                    | Route                       |
| ----------------------------------- | -------------------------- | --------------------------- |
| `getModelTypes()`                   | `string[]`                 | GET /models                 |
| `getModels(folder)`                 | `string[]`                 | GET /models/{folder}        |
| `getCheckpoints()`                  | `string[]`                 | parsed from object_info     |
| `getLoras()`                        | `string[]`                 | parsed from object_info     |
| `getSamplerInfo()`                  | `{ sampler, scheduler }`   | parsed from object_info     |
| `getNodeDefs(node?)`                | `NodeDefsResponse \| null` | GET /object_info            |
| `getWorkflowTemplates()`            | `WorkflowTemplates`        | GET /workflow_templates     |
| `getViewMetadata(folder, filename)` | `ModelMetadata`            | GET /view_metadata/{folder} |

#### Queue & Execution

| Method                                 | Returns               | Route           |
| -------------------------------------- | --------------------- | --------------- |
| `pollStatus(timeout?)`                 | `QueueStatus`         | GET /prompt     |
| `queuePrompt(number, workflow)`        | `QueuePromptResponse` | POST /prompt    |
| `appendPrompt(workflow)`               | `QueuePromptResponse` | POST /prompt    |
| `getQueue()`                           | `QueueResponse`       | GET /queue      |
| `manageQueue(options)`                 | `void`                | POST /queue     |
| `interrupt()`                          | `void`                | POST /interrupt |
| `freeMemory(unloadModels, freeMemory)` | `boolean`             | POST /free      |

#### History

| Method                    | Returns                     | Route             |
| ------------------------- | --------------------------- | ----------------- |
| `getHistory(promptId)`    | `HistoryEntry \| undefined` | GET /history/{id} |
| `getHistories(maxItems?)` | `HistoryResponse`           | GET /history      |
| `clearHistory(options)`   | `void`                      | POST /history     |

#### Settings

| Method                    | Returns | Route               |
| ------------------------- | ------- | ------------------- |
| `getSettings()`           | `any`   | GET /settings       |
| `getSetting(id)`          | `any`   | GET /settings/{id}  |
| `storeSetting(id, value)` | `void`  | POST /settings/{id} |
| `storeSettings(settings)` | `void`  | POST /settings      |

#### Images

| Method                             | Returns                  | Route                         |
| ---------------------------------- | ------------------------ | ----------------------------- |
| `getPathImage(imageInfo)`          | `string`                 | URL construction (no request) |
| `getImage(imageInfo)`              | `Blob`                   | GET /view                     |
| `uploadImage(file, name, config?)` | `{ info, url } \| false` | POST /upload/image            |
| `uploadMask(file, originalRef)`    | `{ info, url } \| false` | POST /upload/mask             |

#### User Data

| Method                                 | Returns             | Route                             |
| -------------------------------------- | ------------------- | --------------------------------- |
| `getUserData(file)`                    | `Response`          | GET /userdata/{file}              |
| `storeUserData(file, data, options?)`  | `Response`          | POST /userdata/{file}             |
| `deleteUserData(file)`                 | `void`              | DELETE /userdata/{file}           |
| `moveUserData(source, dest, options?)` | `Response`          | POST /userdata/{file}/move/{dest} |
| `listUserDataV2(dir)`                  | `UserDataV2Entry[]` | GET /v2/userdata                  |

#### Users

| Method                 | Returns    | Route       |
| ---------------------- | ---------- | ----------- |
| `getUserConfig()`      | `any`      | GET /users  |
| `createUser(username)` | `Response` | POST /users |

#### Terminal

| Method                               | Returns             | Route                          |
| ------------------------------------ | ------------------- | ------------------------------ |
| `getTerminalLogs()`                  | `{ entries, size }` | GET /internal/logs/raw         |
| `setTerminalSubscription(subscribe)` | `void`              | PATCH /internal/logs/subscribe |

### Deprecated Methods

| Method                  | Replacement         | Notes                                      |
| ----------------------- | ------------------- | ------------------------------------------ |
| `listUserData()`        | `listUserDataV2()`  | V2 returns type/size/modified per entry    |
| `getModelFolders()`     | `getModelTypes()`   | Experimental, returns full paths           |
| `getModelFiles(folder)` | `getModels(folder)` | Experimental, returns pathIndex/timestamps |

### Removed Methods (ComfyUI 0.18.1)

| Method                 | Reason                                |
| ---------------------- | ------------------------------------- |
| `getModelPreview()`    | /experiment/models/preview/\* removed |
| `getModelPreviewUrl()` | /experiment/models/preview/\* removed |

### Static

| Method                  | Returns         |
| ----------------------- | --------------- |
| `ComfyApi.generateId()` | `string` — UUID |

---

## CallWrapper

```typescript
new CallWrapper<I, O, T>(client: ComfyApi, workflow: PromptBuilder<I, O, T>)
```

| Method           | Callback Signature                                |
| ---------------- | ------------------------------------------------- |
| `onPreview(fn)`  | `(blob: Blob, promptId?: string) => void`         |
| `onPending(fn)`  | `(promptId?: string) => void`                     |
| `onStart(fn)`    | `(promptId?: string) => void`                     |
| `onProgress(fn)` | `(info: NodeProgress, promptId?: string) => void` |
| `onOutput(fn)`   | `(key, data, promptId?) => void`                  |
| `onFinished(fn)` | `(data, promptId?) => void`                       |
| `onFailed(fn)`   | `(err: Error, promptId?) => void`                 |
| `run()`          | `Promise<data \| false>`                          |

`NodeProgress`: `{ value: number; max: number; prompt_id: string; node: string }`

---

## PromptBuilder

```typescript
new PromptBuilder<I extends string, O extends string, T extends NodeData>(
  prompt: T,
  inputKeys: I[],
  outputKeys: O[]
)
```

| Method                            | Returns         | Description                               |
| --------------------------------- | --------------- | ----------------------------------------- |
| `clone()`                         | `PromptBuilder` | Deep clone                                |
| `setInputNode(input, key)`        | `this`          | Map input key to workflow path            |
| `setRawInputNode(input, key)`     | `this`          | Map to raw dot-notation string            |
| `appendInputNode(input, key)`     | `this`          | Append another path for same key          |
| `appendRawInputNode(input, key)`  | `this`          | Append raw path for same key              |
| `setOutputNode(output, key)`      | `this`          | Map output key to workflow node           |
| `setRawOutputNode(output, key)`   | `this`          | Map to raw node ID                        |
| `input(key, value, encodeOs?)`    | `this`          | Set value, returns clone                  |
| `inputRaw(key, value, encodeOs?)` | `this`          | Set at raw path, mutates in-place         |
| `bypass(node)`                    | `PromptBuilder` | Bypass node(s), returns clone             |
| `reinstate(node)`                 | `PromptBuilder` | Re-enable bypassed node(s), returns clone |
| `workflow`                        | `T`             | Original workflow JSON                    |
| `caller`                          | `this`          | Self-reference                            |
| `mapInputKeys`                    | `Record`        | Input key → path mappings                 |
| `mapOutputKeys`                   | `Record`        | Output key → node mappings                |
| `bypassNodes`                     | `string[]`      | Currently bypassed node IDs               |
| `prompt`                          | `T`             | Current workflow state                    |

---

## ComfyPool

```typescript
enum EQueueMode { PICK_ZERO, PICK_LOWEST, PICK_ROUTINE }

new ComfyPool(
  clients: ComfyApi[],
  mode?: EQueueMode,
  opts?: { maxQueueSize?: number }
)
```

| Method                          | Returns                 | Description           |
| ------------------------------- | ----------------------- | --------------------- |
| `on(type, callback)`            | cleanup fn              | Listen to pool events |
| `off(type, callback)`           | `void`                  | Remove listener       |
| `removeAllListeners()`          | `void`                  | Clear all             |
| `addClient(client)`             | `Promise<void>`         | Add client to pool    |
| `destroy()`                     | `void`                  | Tear down all clients |
| `removeClient(client)`          | `void`                  | Remove by reference   |
| `removeClientByIndex(idx)`      | `void`                  | Remove by index       |
| `changeMode(mode)`              | `void`                  | Switch queue mode     |
| `pick(idx?)`                    | `ComfyApi`              | Get client by index   |
| `pickById(id)`                  | `ComfyApi \| undefined` | Get client by ID      |
| `run(job, weight?, filter?)`    | `Promise<T>`            | Run single job        |
| `batch(jobs, weight?, filter?)` | `Promise<T[]>`          | Run multiple jobs     |

`pool.batch()` is designed for workflow jobs. Use `pool.run()` for non-workflow API calls.

---

## Feature: ManagerFeature (`api.ext.manager`)

Check `api.ext.manager.isSupported` before use.

| Method                                 | Description                 |
| -------------------------------------- | --------------------------- |
| `getVersion()`                         | ComfyUI-Manager version     |
| `getNodeMapList(mode?)`                | All registered custom nodes |
| `checkExtensionUpdate(mode?)`          | Check for available updates |
| `updataAllExtensions(mode?)`           | Update all extensions       |
| `updateComfyUI()`                      | Update ComfyUI itself       |
| `getExtensionList(mode?, skipUpdate?)` | Installed extensions        |
| `previewMethod(mode?)`                 | Get/set preview method      |
| `rebootInstance()`                     | Reboot ComfyUI server       |
| `installExtension(config)`             | Install by config           |
| `installExtensionFromGit(url)`         | Install from git URL        |
| `uninstallExtension(config)`           | Uninstall extension         |
| `updateExtension(config)`              | Update extension            |
| `installModel(info)`                   | Install model               |

## Feature: MonitoringFeature (`api.ext.monitor`)

Check `api.ext.monitor.isSupported` before use.

| Method                         | Description                            |
| ------------------------------ | -------------------------------------- |
| `switch(active)`               | Start/stop monitoring                  |
| `getGpuList()`                 | List GPUs with index and name          |
| `getHddList()`                 | List monitored drives                  |
| `setConfig(config?)`           | Set rate, CPU/RAM/HDD toggles          |
| `setGpuConfig(index, config?)` | Set GPU utilization/vram/temp tracking |
| `on("system_monitor", fn)`     | Listen to monitoring events            |
| `monitorData`                  | Current monitoring data                |

---

## Types

Key types from `src/types/api.ts`:

```typescript
interface ImageInfo { filename: string; subfolder: string; type: string }
interface QueueStatus { exec_info: { queue_remaining: number } }
interface QueueResponse { queue_running: QueueItem[]; queue_pending: QueueItem[] }
interface QueuePromptResponse { prompt_id: string; number: number; node_errors: {...} }
interface SystemStatsResponse { system: {...}; devices: DeviceStats[] }
interface ServerFeatures { supports_preview_metadata: boolean; max_upload_size: number; ... }
interface HistoryEntry { prompt: PromptData; outputs: OutputData; status: StatusData }
interface UserDataV2Entry { name: string; path: string; type: "file"|"directory"; size?; modified? }
enum OSType { POSIX, NT, JAVA }
```

Credentials types:

```typescript
{
  type: "basic";
  username: string;
  password: string;
}
{
  type: "bearer_token";
  token: string;
}
{
  type: "custom";
  headers: Record<string, string>;
}
```

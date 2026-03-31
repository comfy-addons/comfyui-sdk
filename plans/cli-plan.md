# `cfli` — ComfyUI CLI

A CLI tool that wraps `@saintno/comfyui-sdk` to run ComfyUI workflows from the terminal. Installable via `npm install -g` or runnable with `npx`.

---

## Installation

```bash
# Install globally
npm install -g @saintno/comfyui-sdk

# Or use npx (no install needed)
npx @saintno/comfyui-sdk -f workflow.json -i 6.inputs.text="hello"

# Or with bun
bunx @saintno/comfyui-sdk -f workflow.json -i 6.inputs.text="hello"

# Verify
cfli --version
```

---

## Usage Examples

```bash
# Run a workflow with input overrides
cfli -f workflow.json \
  -i 4.inputs.ckpt_name=SDXL/realvisxlV40_v40LightningBakedvae.safetensors \
  -i 5.inputs.width=1024 \
  -i 5.inputs.height=1024 \
  -p 6.inputs.text="A picture of cute cat"

# JSON-only output (pipe-friendly)
cfli -f workflow.json -i 4.inputs.ckpt_name=model.safetensors --json | jq .outputs

# Interactive mode (no -i flags, drop into picker)
cfli -f workflow.json

# Save outputs to specific directory
cfli -f workflow.json -i 6.inputs.text="sunset" --output ./renders

# Custom server with auth
cfli -f workflow.json --host https://comfy.example.com --token my-secret-token

# Watch mode (re-run on workflow file change)
cfli -f workflow.json -i 6.inputs.text="cat" --watch
```

---

## CLI Arguments

| Flag                | Short | Type       | Default                                    | Description                                             |
| ------------------- | ----- | ---------- | ------------------------------------------ | ------------------------------------------------------- |
| `--file`            | `-f`  | `string`   | (required)                                 | Path to workflow JSON file (API format)                 |
| `--input`           | `-i`  | `string[]` | `[]`                                       | Workflow input override: `nodePath.inputName=value`     |
| `--prompt`          | `-p`  | `string[]` | `[]`                                       | Alias for `-i`, semantic sugar for text prompts         |
| `--host`            | `-H`  | `string`   | `$COMFYUI_HOST` or `http://localhost:8188` | ComfyUI server URL                                      |
| `--timeout`         | `-t`  | `number`   | `120000`                                   | Execution timeout in ms                                 |
| `--output`          | `-o`  | `string`   | `./output`                                 | Directory to save output images                         |
| `--json`            | `-j`  | `boolean`  | `false`                                    | Output raw JSON, no terminal UI                         |
| `--quiet`           | `-q`  | `boolean`  | `false`                                    | Suppress all output except errors                       |
| `--watch`           | `-w`  | `boolean`  | `false`                                    | Re-run on workflow file change                          |
| `--token`           |       | `string`   |                                            | Bearer token for authenticated servers                  |
| `--user` / `--pass` |       | `string`   |                                            | Basic auth credentials                                  |
| `--download`        | `-d`  | `boolean`  | `false`                                    | Download output images to `--output` dir                |
| `--no-download`     |       | `boolean`  | `false`                                    | Skip image download, only print URLs                    |
| `--completions`     |       | `string`   |                                            | Generate shell completion script: `bash`, `zsh`, `fish` |
| `--interactive`     |       | `boolean`  | `false`                                    | Force interactive mode even with `-i` flags             |
| `--version`         | `-v`  |            |                                            | Print version and exit                                  |
| `--help`            | `-h`  |            |                                            | Print help and exit                                     |

---

## Package Architecture

The CLI ships as a `bin` entry inside `@saintno/comfyui-sdk`. Users install the SDK and get `cfli` for free. No separate package needed.

```
@saintno/comfyui-sdk (this package)
├── index.ts                 # SDK exports (ComfyApi, CallWrapper, etc.)
├── build/                   # Bundled SDK (index.esm.js, index.cjs, index.d.ts)
├── cli/                     # CLI source (built separately for bin entry)
│   ├── bin.ts               # thin shim: re-exports and calls main()
│   ├── index.ts             # entry point — arg parsing, dispatch
│   ├── args.ts              # CLI argument parser
│   ├── runner.ts            # Core execution: load workflow, apply overrides, run via SDK
│   ├── renderer/
│   │   ├── index.ts         # Renderer factory — picks json|terminal|quiet
│   │   ├── json.ts          # Raw JSON output renderer
│   │   ├── terminal.ts      # Rich terminal UI (Ink-based React components)
│   │   └── quiet.ts         # Silent renderer (errors only)
│   ├── completions/
│   │   ├── index.ts         # Completion engine
│   │   ├── bash.ts          # Bash completion script generator
│   │   ├── zsh.ts           # Zsh completion script generator
│   │   ├── fish.ts          # Fish completion script generator
│   │   └── resolver.ts      # Resolve completion candidates from workflow + server
│   ├── commands/
│   │   ├── run.ts           # `cfli run` (default) — execute workflow
│   │   ├── inspect.ts       # `cfli inspect` — show workflow nodes/inputs summary
│   │   ├── queue.ts         # `cfli queue` — show server queue status
│   │   ├── list.ts          # `cfli list checkpoints|loras|embeddings|samplers`
│   │   └── download.ts      # `cfli download <prompt_id>` — re-download outputs
│   └── utils/
│       ├── fs.ts            # Workflow loading, output directory creation
│       ├── value-parser.ts  # Parse `-i key=value` with type coercion
│       └── progress.ts      # Progress bar helpers
└── package.json             # exposes "bin": { "cfli": "./dist/cli.js" }
```

### How npm/npx Works

```
npm install -g @saintno/comfyui-sdk
    ↓
npm reads package.json → sees "bin": { "cfli": "./dist/cli.js" }
    ↓
npm creates symlink: /usr/local/bin/cfli → /usr/local/lib/node_modules/@saintno/comfyui-sdk/dist/cli.js
    ↓
user runs: cfli -f workflow.json
    ↓
Node.js executes dist/cli.js (shebang: #!/usr/bin/env node)
```

```
npx @saintno/comfyui-sdk -f workflow.json
    ↓
npx downloads @saintno/comfyui-sdk (if not cached)
    ↓
npx looks up "bin" field → finds "cfli" → ./dist/cli.js
    ↓
npx runs: node ./dist/cli.js -f workflow.json
```

### Build Pipeline

The CLI is **built separately** from the SDK bundle. Two independent builds:

```bash
# 1. Build SDK (unchanged)
bun run build
# → build/index.esm.js, build/index.cjs, build/index.d.ts

# 2. Build CLI (new)
bun run build:cli
# → dist/cli.js  (self-contained, no external imports)
```

The CLI build bundles everything into a single `dist/cli.js`:

- All `cli/*.ts` source files
- The SDK itself (inlined, not imported from `build/`)
- All dependencies (`ws`, `picocolors`, etc.)

This is critical for `npx` to work — `dist/cli.js` must have **zero** imports from the package itself or `node_modules`. It's a single self-contained file.

### package.json Changes

```jsonc
{
  "name": "@saintno/comfyui-sdk",
  "version": "0.2.49",
  "bin": {
    "cfli": "./dist/cli.js"
  },
  "files": ["build", "dist/cli.js"],
  "scripts": {
    "build": "bun build.ts",
    "build:cli": "bun build cli/bin.ts --outfile dist/cli.js --target=node --format=esm --minify",
    "build:all": "bun run build && bun run build:cli",
    "cli:dev": "bun cli/bin.ts",
    "prepublishOnly": "bun run build:all",
    "test": "bun test"
  }
}
```

Key points:

- `"bin"` — tells npm this package exposes a CLI command
- `"files"` — only `build/` (SDK) and `dist/cli.js` (CLI) are published to npm
- `"prepublishOnly"` — ensures both SDK and CLI are built before publishing
- `dist/cli.js` is gitignored, built on-the-fly (like `build/`)

### cli/bin.ts — The Shim

A thin entry point that makes the CLI work both as a `bin` target and via `bun cli/bin.ts`:

```typescript
#!/usr/bin/env node
// @ts-nocheck — this file is the bundled entry, types checked in cli/index.ts
export { main } from "./index.ts";
main();
```

The shebang `#!/usr/bin/env node` is required so that:

- `npx` / `npm exec` can execute it directly on Node.js
- `npm install -g` creates a working symlink

Note: `bun build` strips the shebang from the output. We must add it back either via:

- A post-build script that prepends `#!/usr/bin/env node\n` to `dist/cli.js`, or
- Wrapping the build: `echo '#!/usr/bin/env node' > dist/cli.js && bun build cli/bin.ts >> dist/cli.js`

---

## Execution Flow

```
cfli -f workflow.json -i 3.inputs.seed=42 -p 6.inputs.text="hello"
│
├─ 1. Parse CLI args (args.ts)
│     ├─ Validate: -f required, file exists, valid JSON
│     ├─ Parse -i/-p pairs into Map<string, string>
│     └─ Detect mode: --json | --quiet | terminal (default)
│
├─ 2. Load workflow (runner.ts)
│     ├─ Read and parse workflow.json
│     ├─ Validate: must be API format (has node IDs as keys)
│     └─ Detect output nodes (class_type with output_node=true, or SaveImage/PreviewImage)
│
├─ 3. Apply overrides (runner.ts)
│     ├─ For each -i pair: builder.inputRaw(path, parsedValue)
│     ├─ Type coercion: "1024" → 1024, "true" → true, "1.5" → 1.5
│     └─ Fail fast on invalid paths (node or input not found)
│
├─ 4. Connect to server (runner.ts)
│     ├─ new ComfyApi(host, clientId, { credentials })
│     ├─ api.init(5, 2000).waitForReady()
│     └─ Fetch osType for path encoding
│
├─ 5. Execute workflow (runner.ts)
│     ├─ new PromptBuilder(workflow, [], outputNodeIds)
│     ├─ new CallWrapper(api, builder)
│     ├─ Wire callbacks → renderer
│     └─ runner.run()
│
├─ 6. Render output (renderer/)
│     ├─ terminal: Ink UI with progress + image preview
│     ├─ json: structured JSON to stdout
│     └─ quiet: exit code only (0=success, 1=error)
│
└─ 7. Download outputs (optional)
      ├─ For each output image: api.getImage(imgInfo)
      ├─ Save to --output dir with original filename
      └─ Print file paths to stdout
```

---

## Terminal UI (Ink)

Default mode when no `--json` or `--quiet` flag:

```
 cfli  Connected to http://192.168.14.93:8188  Queue #47

 Workflow  sample.json  12 nodes

 Progress
   [done] CheckpointLoaderSimple (4)
   [done] CLIPTextEncode (6) positive
   [done] CLIPTextEncode (7) negative
   [done] EmptyLatentImage (5)
   [busy] KSampler (3)         step 12/20  ████████░░░░  60%
   [wait] VAEDecode (9)
   [wait] SaveImage (10)

 Output (1 image)
   ./output/ComfyUI_00001_.png  1024x1024  1.2MB
```

### Components (Ink/React)

| Component        | Purpose                                           |
| ---------------- | ------------------------------------------------- |
| `<Header>`       | Connection status, host, queue number             |
| `<WorkflowInfo>` | File name, node count, input overrides applied    |
| `<NodeProgress>` | Per-node status: done/busy/wait with spinner      |
| `<ProgressBar>`  | Step progress for KSampler nodes                  |
| `<OutputList>`   | Downloaded image paths with metadata              |
| `<PreviewImage>` | Inline terminal image (Sixel/iTerm2) if supported |
| `<ErrorBox>`     | Error display with node ID and message            |

---

## Autocomplete System

### Architecture

The completion system has two layers:

**Layer 1: Static completions (no server connection needed)**

Parse the workflow JSON to extract:

- Node IDs → `4.`, `5.`, `6.`, etc.
- For each node: `4.inputs.ckpt_name`, `4.inputs.config_name`, etc.
- For each node: `class_type` for description display

**Layer 2: Dynamic completions (requires server connection)**

When `--host` is provided (or `$COMFYUI_HOST` is set):

- `ckpt_name` fields → `api.getCheckpoints()`
- `lora_name` fields → `api.getLoras()`
- `sampler_name` fields → `api.getSamplerInfo()`
- `scheduler` fields → `api.getSamplerInfo()`
- `embeddings` fields → `api.getEmbeddings()`
- Any `COMBO` type input → fetch valid values from `api.getNodeDefs()`

### How It Works

```bash
# Install completions (one-time setup)
eval "$(cfli completions bash)"
# or
cfli completions zsh > ~/.zfunc/_cfli
cfli completions fish > ~/.config/fish/completions/cfli.fish
```

The completion script calls `cfli __complete --cursor "<current_input>"`:

```
User types:  cfli -f wf.json -i 4.in<TAB>
                                          └─ cursor position

cfli __complete --cursor "cfli -f wf.json -i 4.in"
│
├─ Parse already-provided args: -f workflow.json
├─ Load workflow.json from disk
├─ Extract all node.input paths starting with "4.in"
│   → ["4.inputs.ckpt_name", "4.inputs.config_name"]
└─ Output completion candidates:
    4.inputs.ckpt_name
    4.inputs.config_name
```

```
User types:  cfli -f wf.json -i 4.inputs.ckpt_name=<TAB>
                                                       └─ cursor after =

cfli __complete --cursor "cfli -f wf.json -i 4.inputs.ckpt_name="
│
├─ Detect field is "ckpt_name" → needs server values
├─ Connect to server (--host or $COMFYUI_HOST)
├─ api.getCheckpoints()
└─ Output completion candidates:
    v1-5-pruned.ckpt
    SDXL/realvisxlV40_v40LightningBakedvae.safetensors
    ...
```

### Fallback

If server is unreachable, Layer 2 falls back to the current value in the workflow JSON as the single completion candidate. Layer 1 always works (local file parse only).

---

## JSON Output Format

```json
{
  "prompt_id": "abc-123-def-456",
  "status": "completed",
  "duration_ms": 12400,
  "server": {
    "host": "http://192.168.14.93:8188",
    "os": "posix",
    "queue_position": null
  },
  "overrides": {
    "4.inputs.ckpt_name": "SDXL/realvisxlV40_v40LightningBakedvae.safetensors",
    "5.inputs.width": 1024,
    "6.inputs.text": "A picture of cute cat"
  },
  "outputs": {
    "9": {
      "class_type": "SaveImage",
      "images": [
        {
          "filename": "ComfyUI_00001_.png",
          "subfolder": "",
          "type": "output",
          "url": "http://192.168.14.93:8188/view?filename=ComfyUI_00001_.png&type=output&subfolder=",
          "local_path": "./output/ComfyUI_00001_.png"
        }
      ]
    }
  },
  "workflow_hash": "a1b2c3d4"
}
```

On error:

```json
{
  "status": "failed",
  "error": {
    "type": "ExecutionFailedError",
    "message": "Execution failed",
    "prompt_id": "abc-123-def-456"
  }
}
```

---

## Type Coercion for `-i` Values

Values from the CLI are always strings. The parser infers types:

| Input                    | Coerced              | Logic                        |
| ------------------------ | -------------------- | ---------------------------- |
| `1024`                   | `1024` (number)      | Pure digits, no leading zero |
| `1.5`                    | `1.5` (number)       | Valid float                  |
| `true` / `false`         | boolean              | Literal match                |
| `["a","b"]`              | `["a", "b"]` (array) | JSON parse                   |
| `["4", 0]`               | `["4", 0]` (tuple)   | JSON parse                   |
| `SDXL/model.safetensors` | string (unchanged)   | Default                      |

The parser can also peek at the workflow JSON to check the current value's type and coerce accordingly. This is important for fields like `seed` that should be numbers, and `model: ["4", 0]` that should be tuples.

---

## Detection of Output Nodes

The CLI needs to know which nodes produce outputs (for `CallWrapper.mapOutputKeys` and for downloading). Strategy:

1. **Explicit `_meta` check**: Some workflows have `_meta` with output flags
2. **Class type heuristic**: Nodes with `class_type` ending in `SaveImage`, `PreviewImage`, `VAEDecode` are likely outputs
3. **Server node defs**: Fetch `api.getNodeDefs()` and check `output_node: true`
4. **Fallback**: If none found, output all nodes that have `images` in their output schema

For the CLI, the simplest approach: detect `SaveImage` and `VAEDecode` nodes by class_type heuristic. Add `--output-nodes` flag to override: `--output-nodes 9,10`.

---

## Commands

### `cfli run` (default)

Execute a workflow. This is the primary command and the default when no subcommand is given.

### `cfli inspect -f workflow.json`

Print a summary of the workflow: all nodes, their class types, inputs, and detected output nodes. Useful for discovering what `-i` paths are available.

```
 Workflow: workflow.json (12 nodes)

 Node 3  KSampler
   inputs: seed, steps, cfg, sampler_name, scheduler, denoise, model, positive, negative, latent_image

 Node 4  CheckpointLoaderSimple
   inputs: ckpt_name

 Node 5  EmptyLatentImage
   inputs: width, height, batch_size

 Node 6  CLIPTextEncode (positive prompt)
   inputs: text, clip

 Node 9  SaveImage (output)
   inputs: images, filename_prefix

 Output nodes: 9

 Available -i paths:
   3.inputs.seed, 3.inputs.steps, 3.inputs.cfg, 3.inputs.sampler_name,
   3.inputs.scheduler, 3.inputs.denoise, 4.inputs.ckpt_name,
   5.inputs.width, 5.inputs.height, 5.inputs.batch_size,
   6.inputs.text, 7.inputs.text, 10.inputs.filename_prefix
```

### `cfli list checkpoints|loras|embeddings|samplers`

Query the server for available resources.

```bash
cfli list checkpoints
# SDXL/realvisxlV40_v40LightningBakedvae.safetensors
# v1-5-pruned-emaonly.ckpt
# ...

cfli list samplers
# samplers: euler, euler_ancestral, dpmpp_2m_sde_gpu, ...
# schedulers: normal, karras, sgm_uniform, ...
```

### `cfli queue`

Show current server queue status.

```
 Running: 1  |  Pending: 3
 Running: [prompt_id: abc-123, number: 5]
 Pending: [prompt_id: def-456, number: 6], [prompt_id: ghi-789, number: 7], ...
```

### `cfli download <prompt_id>`

Re-download output images from a previous execution.

---

## Dependencies

| Package          | Purpose                                       | Phase   | Bundled? |
| ---------------- | --------------------------------------------- | ------- | -------- |
| `ws`             | WebSocket (already a dep of SDK)              | Phase 1 | Yes      |
| `picocolors`     | Terminal colors (tiny, <1KB)                  | Phase 1 | Yes      |
| `ink`            | React-based terminal UI                       | Phase 2 | Yes      |
| `ink-spinner`    | Loading spinner component                     | Phase 2 | Yes      |
| `ink-text-input` | Interactive text input (for interactive mode) | Phase 5 | Yes      |
| `terminal-image` | Render images in terminal (iTerm2/Sixel)      | Phase 3 | Yes      |
| `chokidar`       | File watcher for `--watch` mode               | Phase 5 | Yes      |
| `@clack/prompts` | Beautiful interactive prompts                 | Phase 5 | Yes      |

All deps are bundled into `dist/cli.js` via `bun build`. The published npm package has **zero runtime dependencies** — everything is self-contained in the single file.

Phase 1 can be built with only `ws` + `picocolors` (keeping the bundle tiny).

---

## Build Details

### Build Commands

```bash
# Build SDK only (existing, unchanged)
bun run build

# Build CLI only
bun run build:cli

# Build both (for publishing)
bun run build:all
```

### CLI Build Script (`cli/build.ts`)

```typescript
/// <reference types="bun-types" />
import fs from "fs";

if (!fs.existsSync("./dist")) {
  fs.mkdirSync("./dist");
}

const result = await Bun.build({
  entrypoints: ["./cli/bin.ts"],
  target: "node",
  format: "esm",
  minify: true,
  outdir: "./dist",
  naming: "cli.js"
  // Do NOT externalize ws — bundle it into cli.js
});

if (!result.success) {
  console.error("CLI build failed:", result.logs);
  process.exit(1);
}

// Prepend shebang (bun strips it)
const outPath = "./dist/cli.js";
const content = fs.readFileSync(outPath, "utf8");
fs.writeFileSync(outPath, "#!/usr/bin/env node\n" + content);
fs.chmodSync(outPath, 0o755);
```

### package.json `bin` Field

```json
{
  "bin": {
    "cfli": "./dist/cli.js"
  }
}
```

This is all npm needs to:

1. Create the `cfli` symlink on `npm install -g`
2. Run `cfli` via `npx @saintno/comfyui-sdk`
3. Register the command in the package registry

---

## Implementation Phases

### Phase 1 — Minimal Working CLI (npm/npx-ready) — DONE

**Status**: Completed. All tasks implemented and verified.

**What was built**:

1. **package.json** — `"bin": { "cfli": "./dist/cli.js" }`, `"files": ["build", "dist/cli.js"]`, scripts: `build:cli`, `build:all`, `cli:dev`, `test:cli`, `test:cli:integration`

2. **`cli/build.ts`** — Bun build with `target: "bun"` (not `"node"` — see lesson learned below), `format: "esm"`, `minify: true`. Prepends `#!/usr/bin/env node` shebang, sets `0o755`.

3. **`cli/bin.ts`** — thin entry shim that imports and calls `main()` from `cli/index.ts`.

4. **`cli/args.ts`** — manual arg parser (no external deps). Parses all flags listed in the flags table. Validates inputs, prints `USAGE_TEXT` on error.

5. **`cli/utils/value-parser.ts`** — `parseOverride()`, `coerceValue()` (number, boolean, JSON array/tuple, string), `isValidNodePath()`.

6. **`cli/utils/fs.ts`** — `loadWorkflow()` (uses `fs.readFileSync` — not `Bun.file()` — for Node.js compat), `detectOutputNodes()`.

7. **`cli/utils/progress.ts`** — `formatProgressBar(value, max, width)` — returns `████████░░░░░░░ 12/20`.

8. **`cli/runner.ts`** — `runWorkflow(config, callbacks)` core engine. Loads workflow, applies overrides via `inputRaw()`, connects to server, executes via `CallWrapper`. Also exports `extractMediaFromOutputs()` for recursive image URL extraction and optional download.

9. **`cli/renderer/json.ts`** — `JsonRenderer` with `render()` and no-op callbacks. `RunResult` type includes `_media` field.

10. **`cli/renderer/terminal.ts`** — `TerminalRenderer` with ANSI colors, in-place progress bar (uses `\r` + `\x1b[2K` to overwrite same line), media links section.

11. **`cli/renderer/quiet.ts`** — `QuietRenderer` (all no-ops except `onFailed`).

12. **`cli/renderer/index.ts`** — `createRenderer()` factory: `json` / `terminal` / `quiet`.

13. **`cli/index.ts`** — `main()` entry. Parses args, runs workflow, extracts media URLs, renders result. Calls `process.exit()` at the end.

14. **Tests** — 6 test files in `test/cli/`: `value-parser.spec.ts`, `args.spec.ts`, `fs.spec.ts`, `runner.spec.ts`, `renderer.spec.ts`, `media.spec.ts`. 73 unit tests pass. 200 total tests pass (including integration).

15. **README** — CLI section added with install, quick start, flags table, output format, download instructions.

**Verified**:

- `bun cli/bin.ts -f sample.json --json` works
- `node dist/cli.js -f sample.json --json` works
- `bun dist/cli.js -f sample.json --json` works
- `npm pack --dry-run` includes `dist/cli.js` (94.9KB)
- `COMFYUI_HOST=http://192.168.14.93:8188 bun test` — 200 pass, 0 fail

**Deviations from plan**:

- `target: "bun"` instead of `"node"` — required for Bun runtime compat (see below)
- `fs.readFileSync` instead of `Bun.file()` — required for Node.js runtime compat
- Media extraction + download implemented early (planned for Phase 3)
- In-place progress bar implemented directly (no Ink needed)
- `tsconfig.build.json` added to fix SDK build (`dts-bundle-generator` + `bun-types` conflict)

**Lesson learned — Bun vs Node compatibility**:

- `target: "node"` bundles the npm `ws` polyfill, which keeps Bun's event loop alive after `process.exit()`
- `target: "bun"` uses Bun's native WebSocket, which exits cleanly
- `Bun.file()` is not available in Node.js — use `fs.readFileSync` instead
- `Bun.exit()` is not available in bundled output when `target: "node"` — `process.exit()` works in both runtimes
- `#!/usr/bin/env bun` in source is stripped by Bun bundler — must re-prepend shebang in build script

---

### Phase 2 — Rich Terminal UI

**Status**: Not started. The simple ANSI terminal renderer from Phase 1 is sufficient for now.

**Original plan** (Ink-based React UI): Consider if needed. The current terminal renderer provides progress bars, colors, and media output without external dependencies.

---

### Phase 3 — Image Download + Preview — PARTIALLY DONE

**Status**: Image download implemented in Phase 1 as part of `extractMediaFromOutputs()`. Inline terminal image preview not yet implemented.

**What was done**:

- `extractMediaFromOutputs(host, outputs, outputDir)` recursively finds all `ImageInfo[]` in output tree
- Builds URLs using `host/view?filename=X&type=Y&subfolder=Z` pattern
- When `outputDir` is provided: fetches images, saves to disk, appends ` -> localPath` to media output
- `-d` flag triggers download, `-o` sets output directory
- `_media` field in JSON output maps `filename` to `url` (or `url -> localPath` when downloaded)

**Not yet done**:

- Inline terminal image rendering (iTerm2/Sixel via `terminal-image`)
- Image metadata (dimensions, file size) in output
- Duplicate filename handling with incrementing numbers

---

### Phase 4 — Shell Completions — NOT STARTED

**Goal**: Tab completion for node paths and values in bash/zsh/fish.

**Tasks**:

1. Create `cli/completions/resolver.ts` — completion candidate resolution
   - `resolveNodePaths(workflowJson)` — extract all `nodeId.inputs.fieldName` paths
   - `resolveValues(workflowJson, fieldPath)` — determine completion strategy:
     - If field is `ckpt_name` → mark as "server-checkpoint" type
     - If field is `lora_name` → mark as "server-lora" type
     - If field is `sampler_name` → mark as "server-sampler" type
     - If field is `scheduler` → mark as "server-scheduler" type
     - If current value is an array → mark as "json" type
     - Otherwise → mark as "literal" type (use current workflow value)
   - `fetchServerValues(host, type)` — connect to server, fetch values:
     - `server-checkpoint` → `api.getCheckpoints()`
     - `server-lora` → `api.getLoras()`
     - `server-sampler` → `api.getSamplerInfo().samplers`
     - `server-scheduler` → `api.getSamplerInfo().schedulers`
     - `server-embedding` → `api.getEmbeddings()`
     - For any `COMBO` type: `api.getNodeDefs()` → extract `[0]` array from required/optional input

2. Create `cli/completions/index.ts` — `__complete` subcommand handler
   - `cfli __complete --cursor "<raw_input>"`:
     1. Parse the raw CLI string up to cursor position
     2. Extract `-f <file>` if present
     3. If completing after `-i` or `-p` with a partial key:
        - Load workflow from `-f` file
        - Call `resolveNodePaths()` → filter by prefix
        - Return candidates
     4. If completing after `key=` (partial value):
        - Load workflow, detect field type
        - Call `resolveValues()` → if server type, fetch from server
        - Return candidates
     5. If completing `-f`:
        - Return `.json` files in current directory
     6. Output: one candidate per line to stdout
   - `COMPLETION_TIMEOUT=3000` — server completions must respond within 3s or fall back to local

3. Create `cli/completions/bash.ts` — bash completion script generator
   - `_cfli()` function with `COMPREPLY` setup
   - Handle: flags, file paths, `-i`/`-p` key=value completion
   - Dynamic completion via `cfli __complete`

4. Create `cli/completions/zsh.ts` — zsh completion script generator
   - `#compdef cfli` directive
   - `_cfli()` function with `_arguments` and custom completion
   - Description metadata for completion menu

5. Create `cli/completions/fish.ts` — fish completion script generator
   - `complete -c cfli` directives
   - `__cfli_complete` function using `cfli __complete`

6. Wire up `--completions bash|zsh|fish` in `cli/index.ts`
   - Print the completion script to stdout
   - User pipes to file or `eval`

**Testing**:

- `cfli __complete --cursor "cfli -f sample.json -i 4.in"` → outputs node paths starting with `4.in`
- `cfli __complete --cursor "cfli -f sample.json -i 4.inputs.ckpt_name="` → outputs checkpoint filenames
- Test with no server running → falls back to workflow value
- Test each shell: source completion script, verify TAB works

**Exit Criteria**: `eval "$(cfli completions bash)"` enables TAB completion for node paths and server-side values.

---

### Phase 5 — Interactive Mode + Watch + Subcommands — DONE

**Status**: Completed. Subcommands, watch mode, and queue implemented. Interactive REPL mode not implemented (low priority).

**What was built**:

1. **Subcommand dispatch** — `parseArgs()` now detects first positional arg as subcommand (`run`, `inspect`, `list`, `queue`, `download`). Default is `run`. Refactored `main()` in `cli/index.ts` to switch on subcommand with separate handler functions.

2. **`cfli inspect -f workflow.json`** — `cli/commands/inspect.ts`
   - Loads workflow, iterates nodes sorted by ID
   - Shows node ID, class_type, inputs (filters out node-link arrays)
   - Marks output nodes (SaveImage/PreviewImage) in green
   - Lists all available `-i` paths at bottom
   - Supports `--json` output
   - No server connection needed

3. **`cfli list <resource>`** — `cli/commands/list.ts`
   - Supports: `checkpoints`, `loras`, `embeddings`, `samplers`
   - Connects to server, fetches via SDK methods (`getCheckpoints`, `getLoras`, `getEmbeddings`, `getSamplerInfo`)
   - Samplers show both `samplers` and `schedulers` sections
   - Supports `--json` output
   - Validates resource argument, clear error on invalid resource

4. **`cfli queue`** — `cli/commands/queue.ts`
   - Connects to server, calls `api.getQueue()`
   - Shows running/pending counts and individual items with prompt IDs
   - Supports `--json` output

5. **`cfli download <prompt_id>`** — `cli/commands/download.ts`
   - Fetches history via `api.getHistory(promptId)`
   - Downloads images via `extractMediaFromOutputs()`
   - Handles not-found and not-completed states gracefully
   - Supports `--json` output

6. **`--watch` mode** — `cli/commands/watch.ts`
   - Uses `fs.watch()` (built-in, no chokidar dependency)
   - Debounced 500ms to avoid rapid re-runs on save
   - **Interrupts current execution** on file change: sends `api.interrupt()`, waits up to 10s for current run to finish
   - Clear UX messages: `[change detected]`, `[interrupted]`, `Run #N completed in Xms`
   - Shows watching indicator between runs
   - Persistent ComfyApi connection (reused across runs)
   - Clean Ctrl+C handler with watcher cleanup and client destroy

7. **Updated `cli/args.ts`** — Added `Subcommand` type, `promptId`, `resource` fields. Parser handles positional args for subcommands.

8. **Updated `USAGE_TEXT`** — Documents all subcommands with examples.

9. **Tests** — 14 new tests in `test/cli/subcommands.spec.ts` (subcommand parsing) and `test/cli/inspect.spec.ts` (inspect data building). Fixed pre-existing `onProgress` test that captured `console.log` instead of `process.stdout.write`. Total: 87 CLI tests pass.

**Not implemented**:

- Interactive REPL mode (requires `@clack/prompts` or similar, deferred as low priority)

**Deviations from plan**:

- No `chokidar` dependency — uses built-in `fs.watch()` instead
- `queue` command added (was in plan as utility)
- Watch mode uses persistent client connection instead of reconnecting each run

---

### Phase 6 — Polish + Distribution — PARTIALLY DONE

**Goal**: Production-ready CLI with good DX and multi-platform distribution.

**What was done**:

- `npm pack --dry-run` verified — `dist/cli.js` (94.9KB) is in tarball
- `"files": ["build", "dist/cli.js"]` whitelists published files
- `--help` with usage text and examples
- README updated with CLI section

**Remaining tasks**:

1. Error handling polish
   - Connection refused → clear message: "Cannot connect to http://host:8188. Is ComfyUI running?"
   - Workflow validation → "Invalid workflow: missing node ID format (expected { '3': {...}, '4': {...} })"
   - Timeout → "Execution timed out after 120000ms. Use --timeout to increase."
   - Unknown node path → "Node path '99.inputs.foo' not found. Run `cfli inspect -f wf.json` to see available paths."
   - Auth failure → "Authentication failed. Check --token or --user/--pass."
   - Node missing from server → "Node type 'FooCustomNode' not found on server. Check installed extensions."

2. Config file support (`~/.cfli.json` or `.cfli.json` in project)

   ```json
   {
     "host": "http://192.168.14.93:8188",
     "timeout": 120000,
     "output": "./output",
     "download": true,
     "token": null
   }
   ```

   - CLI args override config file
   - Config file overrides env vars

3. Env var support
   - `COMFYUI_HOST` — server URL
   - `COMFYUI_TOKEN` — bearer token
   - `COMFYUI_TIMEOUT` — timeout ms
   - `COMFYUI_OUTPUT` — output directory

4. Man page / help text
   - Rich `--help` with examples
   - Subcommand help: `cfli run --help`, `cfli list --help`

5. npm publish checklist
   - `"prepublishOnly"` runs `build:all` automatically
   - `"files"` whitelist ensures only `build/` and `dist/cli.js` ship
   - `"bin"` field is correct
   - `dist/cli.js` has executable permissions
   - Test `npm pack --dry-run` output
   - Test `npx @saintno/comfyui-sdk@0.2.49 -f wf.json` after publish

6. CI/CD for CLI
   - GitHub Action: on publish, run `npm pack --dry-run` and verify `dist/cli.js` exists
   - Optional: build standalone binaries via `bun build --compile` for GitHub releases
     - `bun build --compile cli/bin.ts --target=bun-linux-x64 --outfile cfli-linux`
     - `bun build --compile cli/bin.ts --target=bun-darwin-arm64 --outfile cfli-mac`
   - These are **optional extras** — the primary distribution is npm/npx

7. README documentation
   - Installation section (`npm install -g`, `npx`)
   - Quick start example
   - All flags reference
   - Completion setup instructions
   - Subcommand reference

**Testing**:

- `npm pack --dry-run` → verify contents
- `npm publish --dry-run` → verify registry metadata
- Fresh machine test: `npx @saintno/comfyui-sdk -f wf.json`
- Verify no `node_modules` needed at runtime

**Exit Criteria**: CLI handles all edge cases gracefully. `npm install -g @saintno/comfyui-sdk` gives a working `cfli` command. `npx @saintno/comfyui-sdk` works with zero setup.

---

## Timeline Estimate

| Phase     | Scope                             | Effort      |
| --------- | --------------------------------- | ----------- |
| Phase 1   | Minimal CLI + npm/npx packaging   | ~1 day      |
| Phase 2   | Rich terminal UI (Ink)            | ~1 day      |
| Phase 3   | Image download + preview          | ~0.5 day    |
| Phase 4   | Shell completions                 | ~1 day      |
| Phase 5   | Interactive + watch + subcommands | ~1.5 days   |
| Phase 6   | Polish + distribution             | ~1 day      |
| **Total** |                                   | **~6 days** |

---

## Open Questions

1. **Completion cache** — Server queries for completions are slow (~100-200ms). Should we cache `getNodeDefs()`, `getCheckpoints()`, etc. in a local file or just accept the latency?

2. **Workflow format conversion** — Should `cfli` support loading the ComfyUI web UI format (with `extra`, `last_node_id`, etc.) and auto-convert to API format? The web UI exports a different format than what the SDK expects.

3. **Template system** — Should `cfli` support workflow templates? E.g., `cfli template txt2img -p "hello"` that wraps a built-in workflow with sensible defaults, so users don't need to provide their own JSON.

4. **Pipeline support** — Should `cfli` support piping output images into the next workflow? E.g., `cfli -f txt2img.json | cfli -f upscale.json -i input.image=-`. This would require stdin parsing and image upload.

5. **Standalone binary vs npm** — The standalone binary (`bun build --compile`) is a nice-to-have for users who don't want Node.js. Should we offer it as a GitHub release asset alongside the npm package, or skip it entirely since `npx` covers most use cases?

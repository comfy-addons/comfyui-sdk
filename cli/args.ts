export type Subcommand = "run" | "inspect" | "list" | "download" | "queue";

export interface ParsedArgs {
  subcommand: Subcommand;
  file?: string;
  inputs: Array<{ key: string; value: string }>;
  host: string;
  timeout: number;
  output: string;
  json: boolean;
  quiet: boolean;
  noTui: boolean;
  download: boolean;
  noDownload: boolean;
  version: boolean;
  help: boolean;
  completions?: string;
  token?: string;
  user?: string;
  pass?: string;
  watch: boolean;
  interactive: boolean;
  outputNodes?: string[];
  promptId?: string;
  resource?: string;
}

export const USAGE_TEXT = `cfli - ComfyUI CLI workflow runner

Usage: cfli [command] [options]

Commands:
  run [options]                 Execute workflow (default command)
  inspect -f <workflow.json>    Show workflow nodes, inputs, and output paths
  list <resource>               List server resources (checkpoints|loras|embeddings|samplers)
  queue                         Show server queue status
  download <prompt_id>          Re-download outputs from a previous run

Options:
  -f, --file <path>           Workflow JSON file to execute
  -i, --input <key=value>     Set workflow input value (repeatable)
  -p, --prompt <key=value>    Alias for --input
  -H, --host <url>            ComfyUI server URL (default: http://localhost:8188)
  -t, --timeout <ms>          Execution timeout in ms (default: 120000)
  -o, --output <dir>          Output directory (default: ./output)
  -j, --json                  Output results as JSON
  -q, --quiet                 Suppress progress output
  -d, --download               Download output images
      --no-download            Skip downloading output images
      --no-tui                 Use basic terminal output instead of TUI
      --token <token>         Bearer token for authentication
      --user <user>           Username for basic auth
      --pass <pass>           Password for basic auth
  -w, --watch                 Watch file for changes and re-run
      --interactive            Start interactive REPL mode
      --completions <shell>   Print shell completions (bash|zsh|fish)
      --output-nodes <id,id>  Comma-separated node IDs to capture output
  -v, --version               Print version
  -h, --help                  Show this help

Examples:
  cfli -f workflow.json -i "seed=42" -o ./results
  cfli inspect -f workflow.json
  cfli list checkpoints
  cfli queue
  cfli download abc-123-def
  cfli -f workflow.json --host http://192.168.1.100:8188 --json --quiet
  cfli -f workflow.json --output-nodes 9,12 --download
  cfli -f workflow.json -i 6.inputs.text="cat" --watch
`;

const VALUE_FLAGS = new Set([
  "-f",
  "--file",
  "-i",
  "--input",
  "-p",
  "--prompt",
  "-H",
  "--host",
  "-t",
  "--timeout",
  "-o",
  "--output",
  "--token",
  "--user",
  "--pass",
  "--completions",
  "--output-nodes"
]);

const BOOLEAN_FLAGS = [
  "-j",
  "--json",
  "-q",
  "--quiet",
  "-d",
  "--download",
  "--no-download",
  "--no-tui",
  "-w",
  "--watch",
  "--interactive",
  "-v",
  "--version",
  "-h",
  "--help"
];

const KNOWN_FLAGS = new Set([...VALUE_FLAGS, ...BOOLEAN_FLAGS]);

function requireValue(flag: string, args: string[], i: number): string {
  if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
    throw new Error(`Missing value for ${flag}\n${USAGE_TEXT}`);
  }
  return args[i + 1];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const SUBCOMMANDS = new Set<string>(["run", "inspect", "list", "download", "queue"]);

  const result: ParsedArgs = {
    subcommand: "run",
    inputs: [],
    host: process.env.COMFYUI_HOST || "http://localhost:8188",
    timeout: 120000,
    output: "./output",
    json: false,
    quiet: false,
    noTui: false,
    download: false,
    noDownload: false,
    version: false,
    help: false,
    watch: false,
    interactive: false
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (!arg.startsWith("-")) {
      if (SUBCOMMANDS.has(arg)) {
        result.subcommand = arg as Subcommand;
        i += 1;
        continue;
      }
      if (result.subcommand === "download") {
        result.promptId = arg;
        i += 1;
        continue;
      }
      if (result.subcommand === "list") {
        result.resource = arg;
        i += 1;
        continue;
      }
      throw new Error(`Unknown argument: ${arg}\n${USAGE_TEXT}`);
    }

    if (!KNOWN_FLAGS.has(arg)) {
      throw new Error(`Unknown flag: ${arg}\n${USAGE_TEXT}`);
    }

    switch (arg) {
      case "-f":
      case "--file":
        result.file = requireValue(arg, argv, i);
        i += 2;
        break;
      case "-i":
      case "--input":
      case "-p":
      case "--prompt": {
        const raw = requireValue(arg, argv, i);
        const eq = raw.indexOf("=");
        if (eq === -1 || eq === raw.length - 1) {
          throw new Error(`Invalid input format: ${raw} (expected key=value)\n${USAGE_TEXT}`);
        }
        result.inputs.push({ key: raw.slice(0, eq), value: raw.slice(eq + 1) });
        i += 2;
        break;
      }
      case "-H":
      case "--host":
        result.host = requireValue(arg, argv, i);
        i += 2;
        break;
      case "-t":
      case "--timeout": {
        const val = requireValue(arg, argv, i);
        const num = Number(val);
        if (!Number.isFinite(num) || num <= 0) {
          throw new Error(`Invalid timeout: ${val} (must be a positive number)\n${USAGE_TEXT}`);
        }
        result.timeout = num;
        i += 2;
        break;
      }
      case "-o":
      case "--output":
        result.output = requireValue(arg, argv, i);
        i += 2;
        break;
      case "-j":
      case "--json":
        result.json = true;
        i += 1;
        break;
      case "-q":
      case "--quiet":
        result.quiet = true;
        i += 1;
        break;
      case "--no-tui":
        result.noTui = true;
        i += 1;
        break;
      case "-d":
      case "--download":
        result.download = true;
        i += 1;
        break;
      case "--no-download":
        result.noDownload = true;
        i += 1;
        break;
      case "--token":
        result.token = requireValue(arg, argv, i);
        i += 2;
        break;
      case "--user":
        result.user = requireValue(arg, argv, i);
        i += 2;
        break;
      case "--pass":
        result.pass = requireValue(arg, argv, i);
        i += 2;
        break;
      case "-w":
      case "--watch":
        result.watch = true;
        i += 1;
        break;
      case "--interactive":
        result.interactive = true;
        i += 1;
        break;
      case "--completions": {
        const val = requireValue(arg, argv, i);
        if (val !== "bash" && val !== "zsh" && val !== "fish") {
          throw new Error(`Invalid completions shell: ${val} (expected bash|zsh|fish)\n${USAGE_TEXT}`);
        }
        result.completions = val;
        i += 2;
        break;
      }
      case "--output-nodes": {
        const val = requireValue(arg, argv, i);
        result.outputNodes = val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        i += 2;
        break;
      }
      case "-v":
      case "--version":
        result.version = true;
        i += 1;
        break;
      case "-h":
      case "--help":
        result.help = true;
        i += 1;
        break;
      default:
        i += 1;
    }
  }

  return result;
}

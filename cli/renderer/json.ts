export type { ImageInfo } from "src/types/api";

export interface RunResult {
  prompt_id?: string;
  status: "completed" | "failed" | "timeout";
  duration_ms: number;
  server: { host: string; os?: string };
  overrides: Record<string, string>;
  outputs?: Record<string, any>;
  _media?: Record<string, string>;
  error?: { type: string; message: string };
}

export class JsonRenderer {
  render(result: RunResult): void {
    console.log(JSON.stringify(result, null, 2));
  }
  onConnect(): void {}
  onPending(_promptId: string): void {}
  onProgress(_info: any): void {}
  onOutput(_key: string, _data: any): void {}
  onFinished(_result: any): void {}
  onFailed(_err: Error): void {}
  info(_msg: string): void {}
  blank(): void {}
}

export function renderJsonResult(result: RunResult): void {
  console.log(JSON.stringify(result, null, 2));
}

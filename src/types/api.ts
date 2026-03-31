export enum OSType {
  /**
   * Unix-like operating systems
   */
  POSIX = "posix",
  /**
   * Windows operating systems
   */
  NT = "nt",
  /**
   * Java virtual machine
   */
  JAVA = "java"
}

export interface BasicCredentials {
  type: "basic";
  username: string;
  password: string;
}

export interface BearerTokenCredentials {
  type: "bearer_token";
  token: string;
}

export interface CustomCredentials {
  type: "custom";
  headers: Record<string, string>;
}

export interface HistoryResponse {
  [key: string]: HistoryEntry;
}

export interface HistoryEntry {
  prompt: PromptData;
  outputs: OutputData;
  status: StatusData;
}

export interface PromptData {
  [index: number]: number | string | NodeData | MetadataData;
}

export interface NodeData {
  [key: string]: {
    inputs: { [key: string]: any };
    class_type: string;
    _meta: { title: string };
  };
}

export interface MetadataData {
  [key: string]: any;
}

export interface ImageInfo {
  filename: string;
  subfolder: string;
  type: string;
}

export interface OutputData {
  [key: string]: {
    width?: number[];
    height?: number[];
    ratio?: number[];
    images?: ImageInfo[];
  };
}

export interface StatusData {
  status_str: string;
  completed: boolean;
  messages: [string, { [key: string]: any }][];
}

export interface QueueResponse {
  queue_running: QueueItem[];
  queue_pending: QueueItem[];
}

export interface QueueItem {
  [index: number]: number | string | NodeData | MetadataData;
}

export interface QueuePromptResponse {
  prompt_id: string;
  number: number;
  node_errors: { [key: string]: any };
}

export interface SystemStatsResponse {
  system: {
    os: OSType;
    python_version: string;
    embedded_python: boolean;
  };
  devices: DeviceStats[];
}

export interface DeviceStats {
  name: string;
  type: string;
  index: number;
  vram_total: number;
  vram_free: number;
  torch_vram_total: number;
  torch_vram_free: number;
}

export interface QueueStatus {
  exec_info: { queue_remaining: number };
}

export interface NodeDefsResponse {
  [key: string]: NodeDef;
}

export interface NodeDef {
  input: {
    required: {
      [key: string]:
        | [string[], { tooltip?: string }]
        | [string, { tooltip?: string }]
        | TStringInput
        | TBoolInput
        | TNumberInput;
    };
    optional?: {
      [key: string]:
        | [string[], { tooltip?: string }]
        | [string, { tooltip?: string }]
        | TStringInput
        | TBoolInput
        | TNumberInput;
    };
    hidden: {
      [key: string]: string;
    };
  };
  input_order: {
    required: string[];
    optional?: string[];
    hidden: string[];
  };
  output: string[];
  output_is_list: boolean[];
  output_name: string[];
  name: string;
  display_name: string;
  description: string;
  category: string;
  python_module: string;
  output_node: boolean;
  output_tooltips: string[];
}

export interface NodeProgress {
  value: number;
  max: number;
  prompt_id: string;
  node: string;
}

export interface IInputNumberConfig {
  default: number;
  min: number;
  max: number;
  step?: number;
  round?: number;
  tooltip?: string;
}
export interface IInputStringConfig {
  default?: string;
  multiline?: boolean;
  dynamicPrompts?: boolean;
  tooltip?: string;
}

export type TStringInput = ["STRING", IInputStringConfig];
export type TBoolInput = ["BOOLEAN", { default: boolean; tooltip?: string }];
export type TNumberInput = ["INT" | "FLOAT", IInputNumberConfig];

/**
 * Represents a model folder in the ComfyUI system
 * @experimental API that may change in future versions
 */
export interface ModelFolder {
  name: string;
  folders: string[];
}

/**
 * Represents a model file in the ComfyUI system
 * @experimental API that may change in future versions
 */
export interface ModelFile {
  name: string;
  pathIndex: number;
}

/**
 * Response format for model preview images
 * @experimental API that may change in future versions
 */
export interface ModelPreviewResponse {
  body: ArrayBuffer;
  contentType: string;
}

/**
 * Response format for a list of model files
 * @experimental API that may change in future versions
 */
export interface ModelFileListResponse {
  files: ModelFile[];
}

/**
 * Response format for a list of model folders
 * @experimental API that may change in future versions
 */
export interface ModelFoldersResponse {
  folders: ModelFolder[];
}

export interface ServerFeatures {
  supports_preview_metadata: boolean;
  max_upload_size: number;
  node_replacements: boolean;
  assets: boolean;
  extension?: Record<string, Record<string, any>>;
  [key: string]: any;
}

export interface WorkflowTemplates {
  [moduleName: string]: string[];
}

export interface ModelMetadata {
  [key: string]: any;
}

export interface HistoryClearRequest {
  clear?: boolean;
  delete?: string[];
}

export interface QueueManageRequest {
  clear?: boolean | string[];
  delete?: string[];
}

export interface UserDataV2Entry {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: number;
}

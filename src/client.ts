import { WebSocketClient, WebSocketInterface } from "./socket";

import {
  BasicCredentials,
  BearerTokenCredentials,
  CustomCredentials,
  HistoryEntry,
  HistoryResponse,
  ImageInfo,
  ModelFile,
  ModelFolder,
  ModelPreviewResponse,
  NodeDefsResponse,
  OSType,
  QueuePromptResponse,
  QueueResponse,
  QueueStatus,
  SystemStatsResponse
} from "./types/api";

import { LOAD_CHECKPOINTS_EXTENSION, LOAD_KSAMPLER_EXTENSION, LOAD_LORAS_EXTENSION } from "./contansts";
import { TComfyAPIEventMap } from "./types/event";
import { delay } from "./tools";
import { ManagerFeature } from "./features/manager";
import { MonitoringFeature } from "./features/monitoring";

interface FetchOptions extends RequestInit {
  headers?: { [key: string]: string };
}

export class ComfyApi extends EventTarget {
  public apiHost: string;
  public osType: OSType;
  public isReady: boolean = false;
  public listenTerminal: boolean = false;
  public lastActivity: number = Date.now();

  private wsTimeout: number = 10000;
  private wsTimer: Timer | null = null;
  private _pollingTimer: NodeJS.Timeout | number | null = null;

  private apiBase: string;
  private clientId: string | null;
  private socket: WebSocketClient | null = null;
  private customWsImpl: WebSocketInterface | null = null;
  private listeners: {
    event: keyof TComfyAPIEventMap;
    options?: AddEventListenerOptions | boolean;
    handler: (event: TComfyAPIEventMap[keyof TComfyAPIEventMap]) => void;
  }[] = [];
  private credentials: BasicCredentials | BearerTokenCredentials | CustomCredentials | null = null;

  public ext = {
    /**
     * Interact with ComfyUI-Manager Extension
     */
    manager: new ManagerFeature(this),
    /**
     * Interact with ComfyUI-Crystools Extension for track system resouces
     */
    monitor: new MonitoringFeature(this)
  };

  static generateId(): string {
    return "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  public on<K extends keyof TComfyAPIEventMap>(
    type: K,
    callback: (event: TComfyAPIEventMap[K]) => void,
    options?: AddEventListenerOptions | boolean
  ) {
    this.log("on", "Add listener", { type, callback, options });
    this.addEventListener(type, callback as any, options);
    this.listeners.push({ event: type, handler: callback, options });
    const clr = () => this.off(type, callback, options);
    return clr;
  }

  public off<K extends keyof TComfyAPIEventMap>(
    type: K,
    callback: (event: TComfyAPIEventMap[K]) => void,
    options?: EventListenerOptions | boolean
  ): void {
    this.log("off", "Remove listener", { type, callback, options });
    this.listeners = this.listeners.filter((listener) => listener.event !== type && listener.handler !== callback);
    this.removeEventListener(type, callback as any, options);
  }

  public removeAllListeners() {
    this.log("removeAllListeners", "Triggered");
    this.listeners.forEach((listener) => {
      this.removeEventListener(listener.event, listener.handler, listener.options);
    });
    this.listeners = [];
  }

  get id(): string {
    return this.clientId ?? this.apiBase;
  }

  /**
   * Retrieves the available features of the client.
   *
   * @returns An object containing the available features, where each feature is a key-value pair.
   */
  get availableFeatures() {
    return Object.keys(this.ext).reduce(
      (acc, key) => ({ ...acc, [key]: this.ext[key as keyof typeof this.ext].isSupported }),
      {}
    );
  }

  constructor(
    host: string,
    clientId: string = ComfyApi.generateId(),
    opts?: {
      /**
       * Do not fallback to HTTP if WebSocket is not available.
       * This will retry to connect to WebSocket on error.
       */
      forceWs?: boolean;
      /**
       * Timeout for WebSocket connection.
       * Default is 10000ms.
       */
      wsTimeout?: number;
      /**
       * Listen to terminal logs from the server. Default (false)
       */
      listenTerminal?: boolean;
      /**
       * Custom WebSocket implementation.
       */
      customWebSocketImpl?: WebSocketInterface;
      credentials?: BasicCredentials | BearerTokenCredentials | CustomCredentials;
    }
  ) {
    super();
    this.apiHost = host;
    this.apiBase = host.split("://")[1];
    this.clientId = clientId;
    if (opts?.credentials) {
      this.credentials = opts?.credentials;
      this.testCredentials();
    }
    if (opts?.wsTimeout) {
      this.wsTimeout = opts.wsTimeout;
    }
    if (opts?.listenTerminal) {
      this.listenTerminal = opts.listenTerminal;
    }
    if (opts?.customWebSocketImpl) {
      this.customWsImpl = opts.customWebSocketImpl;
    }
    this.log("constructor", "Initialized", { host, clientId, opts });
    return this;
  }

  /**
   * Destroys the client instance.
   */
  destroy() {
    this.log("destroy", "Destroying client...");
    // Clean up WebSocket timer
    if (this.wsTimer) clearInterval(this.wsTimer);
    // Clean up polling timer if exists
    if (this._pollingTimer) {
      clearInterval(this._pollingTimer as any);
      this._pollingTimer = null;
    }
    // Clean up socket event handlers
    if (this.socket?.client) {
      this.socket.client.onclose = null;
      this.socket.client.onerror = null;
      this.socket.client.onmessage = null;
      this.socket.client.onopen = null;
      this.socket.client.close();
    }
    for (const ext in this.ext) {
      this.ext[ext as keyof typeof this.ext].destroy();
    }
    this.socket?.close();
    this.log("destroy", "Client destroyed");
    this.removeAllListeners();
  }

  private log(fnName: string, message: string, data?: any) {
    this.dispatchEvent(new CustomEvent("log", { detail: { fnName, message, data } }));
  }

  private apiURL(route: string): string {
    return `${this.apiHost}${route}`;
  }

  private getCredentialHeaders(): Record<string, string> {
    if (!this.credentials) return {};
    switch (this.credentials?.type) {
      case "basic":
        return { Authorization: `Basic ${btoa(`${this.credentials.username}:${this.credentials.password}`)}` };
      case "bearer_token":
        return { Authorization: `Bearer ${this.credentials.token}` };
      case "custom":
        return this.credentials.headers;
      default:
        return {};
    }
  }

  private async testCredentials() {
    try {
      if (!this.credentials) return false;
      await this.pollStatus(2000);
      this.dispatchEvent(new CustomEvent("auth_success"));
      return true;
    } catch (e) {
      this.log("testCredentials", "Failed", e);
      if (e instanceof Response) {
        if (e.status === 401) {
          this.dispatchEvent(new CustomEvent("auth_error", { detail: e }));
          return;
        }
      }
      this.dispatchEvent(new CustomEvent("connection_error", { detail: e }));
      return false;
    }
  }

  private async testFeatures() {
    const exts = Object.values(this.ext);
    await Promise.all(exts.map((ext) => ext.checkSupported()));
    /**
     * Mark the client is ready to use the API.
     */
    this.isReady = true;
  }

  /**
   * Fetches data from the API.
   *
   * @param route - The route to fetch data from.
   * @param options - The options for the fetch request.
   * @returns A promise that resolves to the response from the API.
   */
  public async fetchApi(route: string, options?: FetchOptions): Promise<Response> {
    if (!options) {
      options = {};
    }
    options.headers = { ...this.getCredentialHeaders() };
    options.mode = "cors";
    return fetch(this.apiURL(route), options);
  }

  /**
   * Polls the status for colab and other things that don't support websockets.
   * @returns {Promise<QueueStatus>} The status information.
   */
  async pollStatus(timeout = 1000): Promise<QueueStatus> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await this.fetchApi("/prompt", { signal: controller.signal });
      if (response.status === 200) {
        return response.json();
      } else {
        throw response;
      }
    } catch (error: any) {
      this.log("pollStatus", "Failed", error);
      if (error.name === "AbortError") {
        throw new Error("Request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Queues a prompt for processing.
   * @param {number} number The index at which to queue the prompt. using NULL will append to the end of the queue.
   * @param {object} workflow Additional workflow data.
   * @returns {Promise<QueuePromptResponse>} The response from the API.
   */
  async queuePrompt(number: number | null, workflow: object): Promise<QueuePromptResponse> {
    const body = { client_id: this.clientId, prompt: workflow } as any;

    if (number !== null) {
      if (number === -1) {
        body["front"] = true;
      } else if (number !== 0) {
        body["number"] = number;
      }
    }

    try {
      const response = await this.fetchApi("/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (response.status !== 200) {
        throw { response };
      }

      return response.json();
    } catch (e) {
      this.log("queuePrompt", "Can't queue prompt", e);
      throw e.response as Response;
    }
  }

  /**
   * Appends a prompt to the workflow queue.
   *
   * @param {object} workflow Additional workflow data.
   * @returns {Promise<QueuePromptResponse>} The response from the API.
   */
  async appendPrompt(workflow: object): Promise<QueuePromptResponse> {
    return this.queuePrompt(null, workflow).catch((e) => {
      this.dispatchEvent(new CustomEvent("queue_error"));
      throw e;
    });
  }

  /**
   * Retrieves the current state of the queue.
   * @returns {Promise<QueueResponse>} The queue state.
   */
  async getQueue(): Promise<QueueResponse> {
    const response = await this.fetchApi("/queue");
    return response.json();
  }

  /**
   * Retrieves the prompt execution history.
   * @param {number} [maxItems=200] The maximum number of items to retrieve.
   * @returns {Promise<HistoryResponse>} The prompt execution history.
   */
  async getHistories(maxItems: number = 200): Promise<HistoryResponse> {
    const response = await this.fetchApi(`/history?max_items=${maxItems}`);
    return response.json();
  }

  /**
   * Retrieves the history entry for a given prompt ID.
   * @param promptId - The ID of the prompt.
   * @returns A Promise that resolves to the HistoryEntry object.
   */
  async getHistory(promptId: string): Promise<HistoryEntry | undefined> {
    const response = await this.fetchApi(`/history/${promptId}`);
    const history: HistoryResponse = await response.json();
    return history[promptId];
  }

  /**
   * Retrieves system and device stats.
   * @returns {Promise<SystemStatsResponse>} The system stats.
   */
  async getSystemStats(): Promise<SystemStatsResponse> {
    const response = await this.fetchApi("/system_stats");
    return response.json();
  }

  /**
   * Retrieves the terminal logs from the server.
   */
  async getTerminalLogs(): Promise<{ entries: Array<{ t: string; m: string }>; size: { cols: number; rows: number } }> {
    const response = await this.fetchApi("/internal/logs/raw");
    return response.json();
  }

  /**
   * Sets the terminal subscription status.
   * Enable will subscribe to terminal logs from websocket.
   */
  async setTerminalSubscription(subscribe: boolean) {
    // Set the terminal subscription status again if call again
    this.listenTerminal = subscribe;
    // Send the request to the server
    await this.fetchApi("/internal/logs/subscribe", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: this.clientId, enabled: subscribe })
    });
  }

  /**
   * Retrieves a list of extension URLs.
   * @returns {Promise<string[]>} A list of extension URLs.
   */
  async getExtensions(): Promise<string[]> {
    const response = await this.fetchApi("/extensions");
    return response.json();
  }

  /**
   * Retrieves a list of embedding names.
   * @returns {Promise<string[]>} A list of embedding names.
   */
  async getEmbeddings(): Promise<string[]> {
    const response = await this.fetchApi("/embeddings");
    return response.json();
  }

  /**
   * Retrieves the checkpoints from the server.
   * @returns A promise that resolves to an array of strings representing the checkpoints.
   */
  async getCheckpoints(): Promise<string[]> {
    const nodeInfo = await this.getNodeDefs(LOAD_CHECKPOINTS_EXTENSION);
    if (!nodeInfo) return [];
    const output = nodeInfo[LOAD_CHECKPOINTS_EXTENSION].input.required?.ckpt_name?.[0];
    if (!output) return [];
    return output as string[];
  }

  /**
   * Retrieves the Loras from the node definitions.
   * @returns A Promise that resolves to an array of strings representing the Loras.
   */
  async getLoras(): Promise<string[]> {
    const nodeInfo = await this.getNodeDefs(LOAD_LORAS_EXTENSION);
    if (!nodeInfo) return [];
    const output = nodeInfo[LOAD_LORAS_EXTENSION].input.required?.lora_name?.[0];
    if (!output) return [];
    return output as string[];
  }

  /**
   * Retrieves the sampler information.
   * @returns An object containing the sampler and scheduler information.
   */
  async getSamplerInfo() {
    const nodeInfo = await this.getNodeDefs(LOAD_KSAMPLER_EXTENSION);
    if (!nodeInfo) return {};
    return {
      sampler: nodeInfo[LOAD_KSAMPLER_EXTENSION].input.required.sampler_name ?? [],
      scheduler: nodeInfo[LOAD_KSAMPLER_EXTENSION].input.required.scheduler ?? []
    };
  }

  /**
   * Retrieves node object definitions for the graph.
   * @returns {Promise<NodeDefsResponse>} The node definitions.
   */
  async getNodeDefs(nodeName?: string): Promise<NodeDefsResponse | null> {
    const response = await this.fetchApi(`/object_info${nodeName ? `/${nodeName}` : ""}`);
    const result = await response.json();
    if (Object.keys(result).length === 0) {
      return null;
    }
    return result;
  }

  /**
   * Retrieves user configuration data.
   * @returns {Promise<any>} The user configuration data.
   */
  async getUserConfig(): Promise<any> {
    const response = await this.fetchApi("/users");
    return response.json();
  }

  /**
   * Creates a new user.
   * @param {string} username The username of the new user.
   * @returns {Promise<Response>} The response from the API.
   */
  async createUser(username: string): Promise<Response> {
    const response = await this.fetchApi("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    return response;
  }

  /**
   * Retrieves all setting values for the current user.
   * @returns {Promise<any>} A dictionary of setting id to value.
   */
  async getSettings(): Promise<any> {
    const response = await this.fetchApi("/settings");
    return response.json();
  }

  /**
   * Retrieves a specific setting for the current user.
   * @param {string} id The id of the setting to fetch.
   * @returns {Promise<any>} The setting value.
   */
  async getSetting(id: string): Promise<any> {
    const response = await this.fetchApi(`/settings/${encodeURIComponent(id)}`);
    return response.json();
  }

  /**
   * Stores a dictionary of settings for the current user.
   * @param {Record<string, unknown>} settings Dictionary of setting id to value to save.
   * @returns {Promise<void>}
   */
  async storeSettings(settings: Record<string, unknown>): Promise<void> {
    await this.fetchApi(`/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
  }

  /**
   * Stores a specific setting for the current user.
   * @param {string} id The id of the setting to update.
   * @param {unknown} value The value of the setting.
   * @returns {Promise<void>}
   */
  async storeSetting(id: string, value: unknown): Promise<void> {
    await this.fetchApi(`/settings/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value)
    });
  }

  /**
   * Uploads an image file to the server.
   * @param file - The image file to upload.
   * @param fileName - The name of the image file.
   * @param override - Optional. Specifies whether to override an existing file with the same name. Default is true.
   * @returns A Promise that resolves to an object containing the image information and the URL of the uploaded image,
   *          or false if the upload fails.
   */
  async uploadImage(
    file: Buffer | Blob,
    fileName: string,
    config?: { override?: boolean; subfolder?: string }
  ): Promise<{ info: ImageInfo; url: string } | false> {
    const formData = new FormData();
    if (file instanceof Buffer) {
      formData.append("image", new Blob([file as BlobPart]), fileName);
    } else {
      formData.append("image", file as Blob, fileName);
    }
    formData.append("subfolder", config?.subfolder ?? "");
    formData.append("overwrite", config?.override?.toString() ?? "false");

    try {
      const response = await this.fetchApi("/upload/image", { method: "POST", body: formData });
      const imgInfo = await response.json();
      const mapped = { ...imgInfo, filename: imgInfo.name };

      // Check if the response is successful
      if (!response.ok) {
        this.log("uploadImage", "Upload failed", response);
        return false;
      }

      return { info: mapped, url: this.getPathImage(mapped) };
    } catch (e) {
      this.log("uploadImage", "Upload failed", e);
      return false;
    }
  }

  /**
   * Uploads a mask file to the server.
   *
   * @param file - The mask file to upload, can be a Buffer or Blob.
   * @param originalRef - The original reference information for the file.
   * @returns A Promise that resolves to an object containing the image info and URL if the upload is successful, or false if the upload fails.
   */
  async uploadMask(file: Buffer | Blob, originalRef: ImageInfo): Promise<{ info: ImageInfo; url: string } | false> {
    const formData = new FormData();

    // Append the image file to the form data
    if (file instanceof Buffer) {
      formData.append("image", new Blob([file as BlobPart]), "mask.png");
    } else {
      formData.append("image", file as Blob, "mask.png");
    }

    // Append the original reference as a JSON string
    formData.append("original_ref", JSON.stringify(originalRef));

    try {
      // Send the POST request to the /upload/mask endpoint
      const response = await this.fetchApi("/upload/mask", { method: "POST", body: formData });

      // Check if the response is successful
      if (!response.ok) {
        this.log("uploadMask", "Upload failed", response);
        return false;
      }

      const imgInfo = await response.json();
      const mapped = { ...imgInfo, filename: imgInfo.name };
      return { info: mapped, url: this.getPathImage(mapped) };
    } catch (error) {
      this.log("uploadMask", "Upload failed", error);
      return false;
    }
  }

  /**
   * Frees memory by unloading models and freeing memory.
   *
   * @param unloadModels - A boolean indicating whether to unload models.
   * @param freeMemory - A boolean indicating whether to free memory.
   * @returns A promise that resolves to a boolean indicating whether the memory was successfully freed.
   */
  async freeMemory(unloadModels: boolean, freeMemory: boolean): Promise<boolean> {
    const payload = { unload_models: unloadModels, free_memory: freeMemory };

    try {
      const response = await this.fetchApi("/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // Check if the response is successful
      if (!response.ok) {
        this.log("freeMemory", "Free memory failed", response);
        return false;
      }

      // Return the response object
      return true;
    } catch (error) {
      this.log("freeMemory", "Free memory failed", error);
      return false;
    }
  }

  /**
   * Returns the path to an image based on the provided image information.
   * @param imageInfo - The information of the image.
   * @returns The path to the image.
   */
  getPathImage(imageInfo: ImageInfo): string {
    return this.apiURL(
      `/view?filename=${imageInfo.filename}&type=${imageInfo.type}&subfolder=${imageInfo.subfolder ?? ""}`
    );
  }

  /**
   * Get blob of image based on the provided image information. Use when the server have credential.
   */
  async getImage(imageInfo: ImageInfo): Promise<Blob> {
    return this.fetchApi(
      `/view?filename=${imageInfo.filename}&type=${imageInfo.type}&subfolder=${imageInfo.subfolder ?? ""}`
    ).then((res) => res.blob());
  }

  /**
   * Retrieves a user data file for the current user.
   * @param {string} file The name of the userdata file to load.
   * @returns {Promise<Response>} The fetch response object.
   */
  async getUserData(file: string): Promise<Response> {
    return this.fetchApi(`/userdata/${encodeURIComponent(file)}`);
  }

  /**
   * Stores a user data file for the current user.
   * @param {string} file The name of the userdata file to save.
   * @param {unknown} data The data to save to the file.
   * @param {RequestInit & { overwrite?: boolean, stringify?: boolean, throwOnError?: boolean }} [options] Additional options for storing the file.
   * @returns {Promise<Response>}
   */
  async storeUserData(
    file: string,
    data: unknown,
    options: RequestInit & { overwrite?: boolean; stringify?: boolean; throwOnError?: boolean } = {
      overwrite: true,
      stringify: true,
      throwOnError: true
    }
  ): Promise<Response> {
    const response = await this.fetchApi(`/userdata/${encodeURIComponent(file)}?overwrite=${options.overwrite}`, {
      method: "POST",
      headers: { "Content-Type": options.stringify ? "application/json" : "application/octet-stream" } as any,
      body: options.stringify ? JSON.stringify(data) : (data as any),
      ...options
    });

    if (response.status !== 200 && options.throwOnError !== false) {
      this.log("storeUserData", "Error storing user data file", response);
      throw new Error(`Error storing user data file '${file}': ${response.status} ${response.statusText}`);
    }

    return response;
  }

  /**
   * Deletes a user data file for the current user.
   * @param {string} file The name of the userdata file to delete.
   * @returns {Promise<void>}
   */
  async deleteUserData(file: string): Promise<void> {
    const response = await this.fetchApi(`/userdata/${encodeURIComponent(file)}`, { method: "DELETE" });

    if (response.status !== 204) {
      this.log("deleteUserData", "Error deleting user data file", response);
      throw new Error(`Error removing user data file '${file}': ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Moves a user data file for the current user.
   * @param {string} source The userdata file to move.
   * @param {string} dest The destination for the file.
   * @param {RequestInit & { overwrite?: boolean }} [options] Additional options for moving the file.
   * @returns {Promise<Response>}
   */
  async moveUserData(
    source: string,
    dest: string,
    options: RequestInit & { overwrite?: boolean } = { overwrite: false }
  ): Promise<Response> {
    return this.fetchApi(
      `/userdata/${encodeURIComponent(source)}/move/${encodeURIComponent(dest)}?overwrite=${options.overwrite}`,
      { method: "POST" }
    );
  }

  /**
   * Lists user data files for the current user.
   * @param {string} dir The directory in which to list files.
   * @param {boolean} [recurse] If the listing should be recursive.
   * @param {boolean} [split] If the paths should be split based on the OS path separator.
   * @returns {Promise<string[]>} The list of files.
   */
  async listUserData(dir: string, recurse?: boolean, split?: boolean): Promise<string[]> {
    const response = await this.fetchApi(
      `/userdata?${new URLSearchParams({ dir, recurse: recurse?.toString() ?? "", split: split?.toString() ?? "" })}`
    );

    if (response.status === 404) return [];
    if (response.status !== 200) {
      this.log("listUserData", "Error getting user data list", response);
      throw new Error(`Error getting user data list '${dir}': ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Interrupts the execution of the running prompt.
   * @returns {Promise<void>}
   */
  async interrupt(): Promise<void> {
    await this.fetchApi("/interrupt", { method: "POST" });
  }

  /**
   * Initializes the client.
   *
   * @param maxTries - The maximum number of ping tries.
   * @param delayTime - The delay time between ping tries in milliseconds.
   * @returns The initialized client instance.
   */
  init(maxTries = 10, delayTime = 1000) {
    this.pingSuccess(maxTries, delayTime)
      .then(() => {
        /**
         * Get system OS type on initialization.
         */
        this.pullOsType();
        /**
         * Test features on initialization.
         */
        this.testFeatures();
        /**
         * Create WebSocket connection on initialization.
         */
        this.createSocket();
        /**
         * Set terminal subscription on initialization.
         */
        this.setTerminalSubscription(this.listenTerminal);
      })
      .catch((e) => {
        this.log("init", "Failed", e);
        this.dispatchEvent(new CustomEvent("connection_error", { detail: e }));
      });
    return this;
  }

  private async pingSuccess(maxTries = 10, delayTime = 1000) {
    let tries = 0;
    let ping = await this.ping();
    while (!ping.status) {
      if (tries > maxTries) {
        throw new Error("Can't connect to the server");
      }
      await delay(delayTime); // Wait for 1s before trying again
      ping = await this.ping();
      tries++;
    }
  }

  async waitForReady() {
    while (!this.isReady) {
      await delay(100);
    }
    return this;
  }

  private async pullOsType() {
    this.getSystemStats().then((data) => {
      this.osType = data.system.os;
    });
  }

  /**
   * Sends a ping request to the server and returns a boolean indicating whether the server is reachable.
   * @returns A promise that resolves to `true` if the server is reachable, or `false` otherwise.
   */
  async ping() {
    const start = performance.now();
    return this.pollStatus(5000)
      .then(() => {
        return { status: true, time: performance.now() - start } as const;
      })
      .catch((error) => {
        this.log("ping", "Can't connect to the server", error);
        return { status: false } as const;
      });
  }

  /**
   * Attempts to reconnect the WebSocket with an exponential backoff strategy
   * @param triggerEvent Whether to trigger disconnect/reconnect events
   */
  public async reconnectWs(triggerEvent?: boolean) {
    if (triggerEvent) {
      this.dispatchEvent(new CustomEvent("disconnected"));
      this.dispatchEvent(new CustomEvent("reconnecting"));
    }

    // Maximum number of reconnection attempts
    const MAX_ATTEMPTS = 10;
    // Base delay in milliseconds
    const BASE_DELAY = 1000;
    // Maximum delay between attempts (15 seconds)
    const MAX_DELAY = 15000;

    let attempt = 0;

    const tryReconnect = () => {
      attempt++;
      this.log("socket", `WebSocket reconnection attempt #${attempt}`);

      // Clean up any existing socket
      if (this.socket?.client) {
        try {
          this.socket.close();
        } catch (error) {
          this.log("socket", "Error while closing previous socket", error);
        }
      }

      this.socket = null;

      // Create new socket connection
      try {
        this.createSocket(true);
      } catch (error) {
        this.log("socket", "Error creating socket during reconnect", error);
      }

      // Calculate next retry delay with exponential backoff and jitter
      if (attempt < MAX_ATTEMPTS) {
        // Exponential backoff formula: baseDelay * 2^attempt + random jitter
        const exponentialDelay = Math.min(BASE_DELAY * Math.pow(2, attempt - 1), MAX_DELAY);

        // Add jitter (±30% of the delay) to prevent all clients reconnecting simultaneously
        const jitter = exponentialDelay * 0.3 * (Math.random() - 0.5);
        const delay = Math.max(1000, exponentialDelay + jitter);

        this.log("socket", `Will retry in ${Math.round(delay / 1000)} seconds`);

        // Check if the socket is reconnected within the timeout
        setTimeout(() => {
          if (
            !this.socket?.client ||
            (this.socket.client.readyState !== WebSocket.OPEN && this.socket.client.readyState !== WebSocket.CONNECTING)
          ) {
            this.log("socket", "Reconnection failed or timed out, retrying...");
            tryReconnect(); // Retry if not connected
          } else {
            this.log("socket", "Reconnection successful");
          }
        }, delay);
      } else {
        this.log("socket", `Maximum reconnection attempts (${MAX_ATTEMPTS}) reached.`);
        this.dispatchEvent(new CustomEvent("reconnection_failed"));
      }
    };

    tryReconnect();
  }

  private resetLastActivity() {
    this.lastActivity = Date.now();
  }

  /**
   * Creates and connects a WebSocket for real-time updates.
   * @param {boolean} isReconnect If the socket connection is a reconnect attempt.
   */
  /**
   * Creates and connects a WebSocket for real-time updates.
   * Falls back to polling if WebSocket is unavailable.
   * @param {boolean} isReconnect If the socket connection is a reconnect attempt.
   */
  private createSocket(isReconnect: boolean = false) {
    let reconnecting = false;
    let usePolling = false;

    if (this.socket) {
      this.log("socket", "Socket already exists, skipping creation.");
      return;
    }

    const headers = { ...this.getCredentialHeaders() };

    const existingSession = `?clientId=${this.clientId}`;
    const wsUrl = `ws${this.apiHost.includes("https:") ? "s" : ""}://${this.apiBase}/ws${existingSession}`;

    // Try to create WebSocket connection
    try {
      this.socket = new WebSocketClient(wsUrl, { headers, customWebSocketImpl: this.customWsImpl });

      this.socket.client.onclose = () => {
        if (reconnecting || isReconnect) return;
        reconnecting = true;
        this.log("socket", "Socket closed -> Reconnecting");
        this.reconnectWs(true);
      };

      this.socket.client.onopen = () => {
        this.resetLastActivity();
        reconnecting = false;
        usePolling = false; // Reset polling flag if we have an open connection
        this.log("socket", "Socket opened");
        if (isReconnect) {
          this.dispatchEvent(new CustomEvent("reconnected"));
        } else {
          this.dispatchEvent(new CustomEvent("connected"));
        }
      };
    } catch (error) {
      this.log("socket", "WebSocket creation failed, falling back to polling", error);
      this.socket = null;
      usePolling = true;
      this.dispatchEvent(new CustomEvent("websocket_unavailable", { detail: error }));

      // Set up polling mechanism
      this.setupPollingFallback();
    }

    // Only continue with WebSocket setup if creation was successful
    if (this.socket?.client) {
      this.socket.client.onmessage = (event) => {
        this.resetLastActivity();
        try {
          if (event.data instanceof Buffer) {
            const buffer = event.data;
            const view = new DataView(buffer.buffer);
            const eventType = view.getUint32(0);
            switch (eventType) {
              case 1:
                const imageType = view.getUint32(0);
                let imageMime;
                switch (imageType) {
                  case 1:
                  default:
                    imageMime = "image/jpeg";
                    break;
                  case 2:
                    imageMime = "image/png";
                }
                const imageBlob = new Blob([buffer.slice(8)], { type: imageMime });
                this.dispatchEvent(new CustomEvent("b_preview", { detail: imageBlob }));
                break;
              default:
                throw new Error(`Unknown binary websocket message of type ${eventType}`);
            }
          } else if (typeof event.data === "string") {
            const msg = JSON.parse(event.data);
            if (!msg.data || !msg.type) return;
            this.dispatchEvent(new CustomEvent("all", { detail: msg }));
            if (msg.type === "logs") {
              this.dispatchEvent(new CustomEvent("terminal", { detail: msg.data.entries?.[0] || null }));
            } else {
              this.dispatchEvent(new CustomEvent(msg.type, { detail: msg.data }));
            }
            if (msg.data.sid) {
              this.clientId = msg.data.sid;
            }
          } else {
            this.log("socket", "Unhandled message", event);
          }
        } catch (error) {
          this.log("socket", "Unhandled message", { event, error });
        }
      };

      this.socket.client.onerror = (e) => {
        this.log("socket", "Socket error", e);

        // If this is the first error and we're not already in reconnect mode
        if (!reconnecting && !usePolling) {
          usePolling = true;
          this.log("socket", "WebSocket error, will try polling as fallback");
          this.setupPollingFallback();
        }
      };

      if (!isReconnect) {
        this.wsTimer = setInterval(() => {
          if (reconnecting) return;
          if (Date.now() - this.lastActivity > this.wsTimeout) {
            reconnecting = true;
            this.log("socket", "Connection timed out, reconnecting...");
            this.reconnectWs(true);
          }
        }, this.wsTimeout / 2);
      }
    }
  }

  /**
   * Sets up a polling mechanism as a fallback when WebSockets are unavailable
   * Polls the server every 2 seconds for status updates
   */
  /**
   * Sets up a polling mechanism as a fallback when WebSockets are unavailable
   * Polls the server every 2 seconds for status updates
   */
  private setupPollingFallback() {
    this.log("socket", "Setting up polling fallback mechanism");

    // Clear any existing polling timer
    if (this._pollingTimer) {
      try {
        clearInterval(this._pollingTimer as any);
        this._pollingTimer = null;
      } catch (e) {
        this.log("socket", "Error clearing polling timer", e);
      }
    }

    // Poll every 2 seconds
    const POLLING_INTERVAL = 2000;

    const pollFn = async () => {
      try {
        // Poll execution status
        const status = await this.pollStatus();

        // Simulate an event dispatch similar to WebSocket
        this.dispatchEvent(new CustomEvent("status", { detail: status }));

        // Reset activity timestamp to prevent timeout
        this.resetLastActivity();

        // Try to re-establish WebSocket connection periodically
        if (!this.socket || !this.socket.client || this.socket.client.readyState !== WebSocket.OPEN) {
          this.log("socket", "Attempting to restore WebSocket connection");
          try {
            this.createSocket(true);
          } catch (error) {
            // Continue with polling if WebSocket creation fails
            this.log("socket", "WebSocket still unavailable, continuing with polling", error);
          }
        } else {
          // WebSocket is back, we can stop polling
          this.log("socket", "WebSocket connection restored, stopping polling");
          if (this._pollingTimer) {
            clearInterval(this._pollingTimer as any);
            this._pollingTimer = null;
          }
        }
      } catch (error) {
        this.log("socket", "Polling error", error);
      }
    };

    // Using setInterval and casting to the expected type
    this._pollingTimer = setInterval(pollFn, POLLING_INTERVAL) as any;

    this.log("socket", `Polling started with interval of ${POLLING_INTERVAL}ms`);
  }

  /**
   * Retrieves a list of all available model folders.
   * @experimental API that may change in future versions
   * @returns A promise that resolves to an array of ModelFolder objects.
   */
  async getModelFolders(): Promise<ModelFolder[]> {
    try {
      const response = await this.fetchApi("/experiment/models");
      if (!response.ok) {
        this.log("getModelFolders", "Failed to fetch model folders", response);
        throw new Error(`Failed to fetch model folders: ${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      this.log("getModelFolders", "Error fetching model folders", error);
      throw error;
    }
  }

  /**
   * Retrieves a list of all model files in a specific folder.
   * @experimental API that may change in future versions
   * @param folder - The name of the model folder.
   * @returns A promise that resolves to an array of ModelFile objects.
   */
  async getModelFiles(folder: string): Promise<ModelFile[]> {
    try {
      const response = await this.fetchApi(`/experiment/models/${encodeURIComponent(folder)}`);
      if (!response.ok) {
        this.log("getModelFiles", "Failed to fetch model files", { folder, response });
        throw new Error(`Failed to fetch model files: ${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      this.log("getModelFiles", "Error fetching model files", { folder, error });
      throw error;
    }
  }

  /**
   * Retrieves a preview image for a specific model file.
   * @experimental API that may change in future versions
   * @param folder - The name of the model folder.
   * @param pathIndex - The index of the folder path where the file is stored.
   * @param filename - The name of the model file.
   * @returns A promise that resolves to a ModelPreviewResponse object containing the preview image data.
   */
  async getModelPreview(folder: string, pathIndex: number, filename: string): Promise<ModelPreviewResponse> {
    try {
      const response = await this.fetchApi(
        `/experiment/models/preview/${encodeURIComponent(folder)}/${pathIndex}/${encodeURIComponent(filename)}`
      );

      if (!response.ok) {
        this.log("getModelPreview", "Failed to fetch model preview", { folder, pathIndex, filename, response });
        throw new Error(`Failed to fetch model preview: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "image/webp";
      const body = await response.arrayBuffer();

      return { body, contentType };
    } catch (error) {
      this.log("getModelPreview", "Error fetching model preview", { folder, pathIndex, filename, error });
      throw error;
    }
  }

  /**
   * Creates a URL for a model preview image.
   * @experimental API that may change in future versions
   * @param folder - The name of the model folder.
   * @param pathIndex - The index of the folder path where the file is stored.
   * @param filename - The name of the model file.
   * @returns The URL string for the model preview.
   */
  getModelPreviewUrl(folder: string, pathIndex: number, filename: string): string {
    return this.apiURL(
      `/experiment/models/preview/${encodeURIComponent(folder)}/${pathIndex}/${encodeURIComponent(filename)}`
    );
  }
}

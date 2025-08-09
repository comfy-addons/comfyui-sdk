// src/WebSocketClient.ts

import WebSocketLib from "ws";

// Define WebSocketInterface to allow for custom implementation
export interface WebSocketInterface {
  new (url: string, protocols?: string | string[]): WebSocket;
  new (url: string, options?: any): WebSocket;
  CONNECTING: number;
  OPEN: number;
  CLOSING: number;
  CLOSED: number;
}

// Default WebSocket implementation based on environment
let DefaultWebSocketImpl: WebSocketInterface;

if (typeof window !== "undefined" && window.WebSocket) {
  // In a browser environment
  DefaultWebSocketImpl = window.WebSocket;
} else {
  // In a Node.js environment
  DefaultWebSocketImpl = WebSocketLib as any;
}

export interface WebSocketClientOptions {
  headers?: { [key: string]: string };
  customWebSocketImpl?: WebSocketInterface | null;
}

export class WebSocketClient {
  private socket: WebSocket;
  private readonly webSocketImpl: WebSocketInterface;

  constructor(url: string, options: WebSocketClientOptions = {}) {
    const { headers, customWebSocketImpl } = options;
    
    // Use custom WebSocket implementation if provided, otherwise use default
    this.webSocketImpl = customWebSocketImpl || DefaultWebSocketImpl;

    try {
      if (typeof window !== "undefined" && window.WebSocket) {
        // Browser environment - WebSocket does not support custom headers
        this.socket = new this.webSocketImpl(url);
      } else {
        // Node.js environment - using ws package, which supports custom headers
        const WebSocketConstructor = this.webSocketImpl as any;
        this.socket = new WebSocketConstructor(url, { headers });
      }
    } catch (error) {
      console.error("WebSocket initialization failed:", error);
      throw new Error(`WebSocket initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return this;
  }

  get client() {
    return this.socket;
  }

  public send(message: string) {
    if (this.socket && this.socket.readyState === this.webSocketImpl.OPEN) {
      this.socket.send(message);
    } else {
      console.error("WebSocket is not open or available");
    }
  }

  public close() {
    if (this.socket) {
      this.socket.close();
    }
  }
}

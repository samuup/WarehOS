import type { RendererBridge } from './bridge';

declare global {
  interface Window {
    api: RendererBridge;
  }
}

export const api: RendererBridge = window.api;
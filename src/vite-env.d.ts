/// <reference types="vite/client" />

/** Compile-time provenance supplied by vite.config.ts. */
declare const __SALESSHOP_BUILD__: Readonly<{
  channel: 'DEV' | 'MAIN' | 'BUILD';
  branch: string;
  commit: string;
}>;

/** True only in public Cloudflare Workers non-main preview builds. */
declare const __SALESSHOP_PREVIEW_SANDBOX__: boolean;

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API prefix, e.g. `http://127.0.0.1:4174/api` — overrides default `/api` (and dev proxy behavior when set). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

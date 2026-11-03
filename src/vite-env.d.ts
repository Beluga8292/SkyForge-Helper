/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_PROXY_TARGET?: string;
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

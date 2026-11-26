/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Store name shown in the header and browser tab (CFG-04). */
  readonly VITE_STORE_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

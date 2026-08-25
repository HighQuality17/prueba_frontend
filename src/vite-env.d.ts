/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IGNORE_REDUCED_MOTION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/// <reference types="vite/client" />

// Tell TypeScript which VITE_* variables exist, so import.meta.env.VITE_API_URL
// is typed (and a typo like VITE_API_ULR is a compile error).
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

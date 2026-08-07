import { defineConfig } from "vite";
import { resolve } from "path";

// Standalone SDK build — produces dist/plugin-sdk.js (fixed name) with
// preserved export names. react/react-dom stay external: the document
// import map points them at the app's shared react chunk (dist/react.js).
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/plugins/sdk.ts"),
      formats: ["es"],
      fileName: () => "plugin-sdk.js",
    },
    rollupOptions: {
      external: ["react", "react-dom"],
    },
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: false,
  },
});

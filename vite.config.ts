import { defineConfig } from "vite";

export default defineConfig({
  root: "apps/web/test/components/d01",
  server: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
});

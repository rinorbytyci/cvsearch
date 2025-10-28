import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: false,
  splitting: false,
  clean: true,
  treeshake: true,
  outDir: "dist",
  outExtension() {
    return {
      js: ".js"
    };
  }
});

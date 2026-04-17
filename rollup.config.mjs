import alias from "@rollup/plugin-alias";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  input: "static/js/gleo-bridge.mjs",
  output: {
    file: "static/js/gleo_all.js",
    format: "es",
  },
  plugins: [
    alias({
      entries: [{ find: /^\/gleo\/(.*)/, replacement: resolve(__dirname, "static/js/gleo/$1") }],
    }),
  ],
};

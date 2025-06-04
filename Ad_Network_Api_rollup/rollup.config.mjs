// minimal-rollup.config.mjs
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

export default {
  input: "./index.js", // the minimal index
  output: {
    file: "./ad-network-api.bundle.js",
    format: "iife",
    name: "AdNetworkAPI", // So it attaches to window.AdNetworkAPI if we want iife format
  },
  plugins: [
    json(),
    resolve({ browser: true, preferBuiltins: false }),
    commonjs(),
  ],
};

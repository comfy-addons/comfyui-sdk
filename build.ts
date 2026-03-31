/// <reference types="bun-types" />
import { generateDtsBundle } from "dts-bundle-generator";
import fs from "fs";
import path from "path";

import { dependencies, peerDependencies } from "./package.json";

const BUN_GLOBALS = path.join(path.dirname(require.resolve("bun-types/package.json")), "globals.d.ts");

const originalGlobals = fs.readFileSync(BUN_GLOBALS, "utf8");
const patchedGlobals = originalGlobals.replace(/import\("node:util"\)\.\w+/g, "any");

if (!fs.existsSync("./build")) {
  fs.mkdirSync("./build");
}

const start = Date.now();

console.log("JSCompiling", "Building...");

fs.writeFileSync(BUN_GLOBALS, patchedGlobals);

try {
  await Promise.all([
    Bun.build({
      entrypoints: ["./index.ts"],
      external: Object.keys(dependencies).concat(Object.keys(peerDependencies)),
      format: "esm",
      minify: true,
      outdir: "./build",
      naming: "index.esm.js",
      sourcemap: "external",
      target: "browser"
    }),
    Bun.build({
      entrypoints: ["./index.ts"],
      external: Object.keys(dependencies).concat(Object.keys(peerDependencies)),
      format: "cjs",
      minify: true,
      outdir: "./build",
      naming: "index.cjs",
      sourcemap: "external",
      target: "node"
    })
  ]);
  console.log("JSCompiling", "Done!");

  console.log("TypeCompiling", "Building...");
  const typedContent = generateDtsBundle(
    [
      {
        filePath: "./index.ts"
      }
    ],
    {
      preferredConfigPath: "./tsconfig.build.json"
    }
  );

  fs.writeFileSync("./build/index.d.ts", typedContent.join("\n"));
  console.log("TypeCompiling", "Done!");
  console.log("Build", `Build success, take ${Date.now() - start}ms`);
} finally {
  fs.writeFileSync(BUN_GLOBALS, originalGlobals);
}

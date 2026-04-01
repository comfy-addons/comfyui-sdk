/// <reference types="bun-types" />
import fs from "fs";

if (!fs.existsSync("./dist")) {
  fs.mkdirSync("./dist");
}

const result = await Bun.build({
  entrypoints: ["./cli/bin.ts"],
  target: "node",
  format: "esm",
  minify: false,
  outdir: "./dist",
  naming: "cli.js",
  external: ["sharp", "sixel"]
});

if (!result.success) {
  console.error("CLI build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

const outPath = "./dist/cli.js";
let content = fs.readFileSync(outPath, "utf8");

if (content.startsWith("#!/usr/bin/env bun")) {
  content = "#!/usr/bin/env node" + content.slice("#!/usr/bin/env bun".length);
} else {
  content = "#!/usr/bin/env node\n" + content;
}

fs.writeFileSync(outPath, content);
fs.chmodSync(outPath, 0o755);

console.log("CLI built successfully: dist/cli.js");

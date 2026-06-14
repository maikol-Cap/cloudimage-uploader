import esbuild from "esbuild";

const production = process.argv.includes("production");

const ctx = await esbuild.build({
  entryPoints: ["main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2018",
  platform: "browser",
  outfile: "main.js",
  minify: production,
  sourcemap: production ? false : "inline",
  logLevel: "info",
});

if (!production) {
  await ctx.watch();
  console.log("Watching for changes...");
}

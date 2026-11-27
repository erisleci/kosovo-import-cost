// Bundles the extension into dist. Load that folder once in
// chrome://extensions with "Load unpacked"; Chrome remembers it.
//
// With --watch, every rebuild writes a new build id to dist/build-id.txt. The
// dev build's content script asks the background worker every second whether
// that id has changed; when it has, the worker reloads the extension and the
// open Amazon tabs. Plain builds leave that code out.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import * as esbuild from "esbuild"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "dist")
const watch = process.argv.includes("--watch")
const placeholder = "__LANDED_BUILD_ID__"

// dist is overwritten, not deleted, so Chrome never finds the folder missing.
async function copyStatic() {
  await mkdir(dist, { recursive: true })
  for (const file of ["manifest.json", "options.html", "public/tariff.json"]) {
    await copyFile(join(root, file), join(dist, file.replace(/^public\//, "")))
  }
}

const stampBuild = {
  name: "stamp-build",
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) return
      await copyStatic()
      if (!watch) return
      const id = String(Date.now())
      const background = join(dist, "background.js")
      const code = await readFile(background, "utf8")
      await writeFile(background, code.replaceAll(placeholder, id))
      await writeFile(join(dist, "build-id.txt"), id)
      console.log(`Build ${id} ready. Chrome reloads it within a second.`)
    })
  },
}

const options = {
  entryPoints: {
    content: join(root, "src/content.ts"),
    background: join(root, "src/background.ts"),
    options: join(root, "src/options.ts"),
  },
  outdir: dist,
  bundle: true,
  format: "iife",
  target: "chrome120",
  logLevel: "info",
  define: {
    __DEV__: String(watch),
    __BUILD_ID__: JSON.stringify(placeholder),
  },
  plugins: [stampBuild],
}

if (watch) {
  const context = await esbuild.context(options)
  await context.watch()
} else {
  await esbuild.build(options)
}

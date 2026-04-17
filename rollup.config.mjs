import { fileURLToPath } from "url";
import { dirname, resolve, relative, basename } from "path";
import { readdirSync, readFileSync, statSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gleoDir = resolve(__dirname, "static/js/gleo");
const VIRTUAL_ENTRY_ID = "\0gleo-virtual-entry";

/**
 * Recursively collect all .mjs files under a directory,
 * excluding the src/ subdirectory (which mirrors the root files).
 */
function collectMjsFiles(dir, root) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const rel = relative(root, full);
    // Skip the src/ directory to avoid duplicates
    if (rel === "src" || rel.startsWith("src/") || rel.startsWith("src\\")) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectMjsFiles(full, root));
    } else if (entry.endsWith(".mjs")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Rollup plugin that generates a virtual entry module which:
 * 1. Imports every .mjs file under static/js/gleo (for side effects)
 * 2. Re-exports the default export of every file containing "export default class"
 */
function gleoAutoEntry() {
  return {
    name: "gleo-auto-entry",
    resolveId(source, importer) {
      if (source === VIRTUAL_ENTRY_ID) return VIRTUAL_ENTRY_ID;
      // Fix broken import: acetates/AcetateFuelPoint.mjs imports ./Field.mjs
      // but the file is at fields/Field.mjs
      if (source === "./Field.mjs" && importer && importer.includes("acetates")) {
        return resolve(gleoDir, "fields/Field.mjs");
      }
      return null;
    },
    load(id) {
      if (id !== VIRTUAL_ENTRY_ID) return null;

      const files = collectMjsFiles(gleoDir, gleoDir);
      const exportLines = [];
      const sideEffectImports = [];
      const seenNames = new Set();

      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        const match = content.match(/^export default class\s+(\w+)/m);
        const relPath = "./" + relative(__dirname, file).replace(/\\/g, "/");

        if (match) {
          let className = match[1];
          // Handle duplicate class names by using the file basename instead
          if (seenNames.has(className)) {
            const fileBaseName = basename(file, ".mjs");
            // If the file basename is also taken, skip true duplicates
            if (seenNames.has(fileBaseName)) {
              continue;
            }
            className = fileBaseName;
          }
          if (seenNames.has(className)) continue;
          seenNames.add(className);
          exportLines.push(
            `export { default as ${className} } from "${relPath}";`
          );
        } else {
          sideEffectImports.push(`import "${relPath}";`);
        }
      }

      return [...sideEffectImports, ...exportLines].join("\n");
    },
  };
}

export default {
  input: VIRTUAL_ENTRY_ID,
  output: {
    file: "static/js/gleo_all.js",
    format: "es",
  },
  external: ["geotiff", "pmtiles"],
  plugins: [gleoAutoEntry()],
};

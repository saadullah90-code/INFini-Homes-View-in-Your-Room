import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Reads shopify-custom-liquid/view-in-your-room.liquid live from disk on
// every call (no caching, no copy) so the admin dashboard always shows the
// exact current file -- there is deliberately no second, hand-maintained
// copy of this code anywhere in the app.
//
// The path is resolved relative to this module's own location rather than
// `process.cwd()`, since that varies with how the process was launched
// (pnpm --filter runs with the package dir as cwd, not the repo root).
// esbuild bundles this file into artifacts/api-server/dist/index.mjs, so
// `import.meta.url` at runtime always points inside that dist/ folder --
// three levels below the repo root (dist -> api-server -> artifacts ->
// root) -- regardless of the source file's own location before bundling.
const REPO_ROOT_FROM_DIST = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const LIQUID_FILE_PATH = path.join(REPO_ROOT_FROM_DIST, "shopify-custom-liquid", "view-in-your-room.liquid");

const BACKEND_URL_PATTERN = /VIEW_IN_YOUR_ROOM_API\s*=\s*"([^"]+)"/;

export interface LiquidSourceResult {
  code: string;
  backendUrl: string;
}

export async function getLiquidSource(): Promise<LiquidSourceResult> {
  let code: string;
  try {
    code = await readFile(LIQUID_FILE_PATH, "utf-8");
  } catch (err) {
    throw new Error(
      `Could not read the Custom Liquid source file at ${LIQUID_FILE_PATH}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const match = code.match(BACKEND_URL_PATTERN);
  if (!match) {
    throw new Error("Could not find VIEW_IN_YOUR_ROOM_API in the Custom Liquid source file.");
  }

  if (process.env.SERVE_FRONTEND === "1") {
    const publicUrl = process.env.PUBLIC_APP_URL;
    if (!publicUrl) throw new Error("PUBLIC_APP_URL must be set for Railway Custom Liquid.");
    const url = new URL(publicUrl);
    if (url.protocol !== "https:") throw new Error("PUBLIC_APP_URL must use HTTPS.");
    code = code.replace(BACKEND_URL_PATTERN, `VIEW_IN_YOUR_ROOM_API = "${url.origin}"`);
    return { code, backendUrl: url.origin };
  }

  return { code, backendUrl: match[1] };
}

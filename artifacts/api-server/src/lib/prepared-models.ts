import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ObjectStorageService } from "./objectStorage";

const registryPath = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../assets/prepared-models.json");
export const PREPARED_MATTRESS_HANDLE = "infini-homes-high-density-foam-premium-white-medical-mattress-200w-x-210l-x-20h";
export const PREPARED_WARDROBE_HANDLE = "infini-homes-2-door-wooden-wardrobe-cabinet-cupboard-of-engineered-wood-with-1-lockable-drawer-perfect-modern-stylish-heavy-duty-color-white-without-assembly";
const preparedPaths: Record<string, string> = {
  [PREPARED_MATTRESS_HANDLE]: "product-models/infini-medical-mattress-200x210x20-v1.glb",
  [PREPARED_WARDROBE_HANDLE]: "product-models/infini-white-wardrobe-80x40x185-v1.glb",
};
export interface PreparedModel {
  handle: string;
  objectPath: string;
  fileSizeBytes: number;
  dimensions: { width: number; height: number; depth: number; unit: "cm" };
  notice: string;
}
const storage = new ObjectStorageService();
export const PUBLIC_OBJECT_PREFIX = "/api/storage/public-objects/";

export async function getPreparedModel(handle: string): Promise<PreparedModel | null> {
  if (!Object.hasOwn(preparedPaths, handle)) return null;
  let raw: string;
  try {
    raw = await readFile(registryPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries)) throw new Error("Prepared model registry must be a JSON array.");
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" ||
      typeof entry.handle !== "string" || !entry.handle ||
      typeof entry.objectPath !== "string" || !/^product-models\/[a-z0-9-]+\.glb$/.test(entry.objectPath) ||
      typeof entry.fileSizeBytes !== "number" || !Number.isSafeInteger(entry.fileSizeBytes) || entry.fileSizeBytes <= 0 ||
      !entry.dimensions || entry.dimensions.unit !== "cm" ||
      !["width", "height", "depth"].every((key) => typeof entry.dimensions[key] === "number" && entry.dimensions[key] > 0) ||
      typeof entry.notice !== "string" || !entry.notice.trim()) {
      throw new Error("Invalid prepared model registry entry.");
    }
  }
  const entry = (entries as PreparedModel[]).find((candidate) => candidate.handle === handle) ?? null;
  if (entry && entry.objectPath !== preparedPaths[handle]) {
    throw new Error(`Unexpected public object path for ${handle}`);
  }
  return entry;
}

export async function verifyPreparedModel(entry: PreparedModel): Promise<boolean> {
  return !!(await storage.searchPublicObject(entry.objectPath));
}

export function isRealGlbUrl(url: string | null): boolean {
  if (!url) return false;
  if (url.startsWith(PUBLIC_OBJECT_PREFIX)) {
    return /^\/api\/storage\/public-objects\/product-models\/[a-z0-9-]+\.glb$/.test(url);
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.pathname.endsWith(".glb") &&
      !["modelviewer.dev", "raw.githubusercontent.com"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function resolveModelUrl(url: string, baseUrl: string): string {
  return url.startsWith(PUBLIC_OBJECT_PREFIX) ? `${baseUrl}${url}` : url;
}
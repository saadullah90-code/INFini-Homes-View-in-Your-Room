import { Readable } from "node:stream";
import { Storage, type File } from "@google-cloud/storage";

// Replit sidecar authentication: identical to the App Storage service template.
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

// Only the public lookup/streaming methods are exposed; there are no upload
// URLs or private object routes in this application.
export class ObjectStorageService {
  getPublicObjectSearchPaths(): string[] {
    const paths = Array.from(new Set((process.env.PUBLIC_OBJECT_SEARCH_PATHS || "")
      .split(",").map((part) => part.trim()).filter(Boolean)));
    if (!paths.length) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set. Set up App Storage first.");
    return paths;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
      if (parts.length < 2 || !parts[0]) throw new Error("Invalid public object search path.");
      const file = objectStorageClient.bucket(parts[0]).file(parts.slice(1).join("/"));
      const [exists] = await file.exists();
      if (exists) return file;
    }
    return null;
  }

  async downloadObject(file: File, cacheTtlSec = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const nodeStream = file.createReadStream();
    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `public, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) headers["Content-Length"] = String(metadata.size);
    return new Response(Readable.toWeb(nodeStream) as ReadableStream, { headers });
  }
}
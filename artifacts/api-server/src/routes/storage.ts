import { Readable } from "node:stream";
import { Router, type IRouter } from "express";
import { ObjectStorageService } from "../lib/objectStorage";
import { bundledPreparedModelPath } from "../lib/prepared-models";

const router: IRouter = Router();
const storage = new ObjectStorageService();

// Public assets only. There is deliberately no upload or private-object API.
router.get("/storage/public-objects/*filePath", async (req, res): Promise<void> => {
  const raw = req.params.filePath;
  const filePath = Array.isArray(raw) ? raw.join("/") : raw;
  if (!filePath || filePath.includes("..") || filePath.startsWith("/")) {
    res.status(400).json({ error: "Invalid public object path" });
    return;
  }
  if (process.env.SERVE_FRONTEND === "1") {
    const bundled = bundledPreparedModelPath(filePath);
    if (!bundled) {
      res.status(404).json({ error: `Public object not found: ${filePath}` });
      return;
    }
    res.type("model/gltf-binary").sendFile(bundled);
    return;
  }
  try {
    const file = await storage.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: `Public object not found: ${filePath}` });
      return;
    }
    const response = await storage.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (!response.body) { res.end(); return; }
    Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
  } catch (err) {
    req.log.error({ err, filePath }, "Could not serve public object");
    res.status(500).json({ error: "Could not serve public object" });
  }
});

export default router;
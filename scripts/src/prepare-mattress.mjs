// Run from the workspace root via pnpm --filter @workspace/scripts prepare:mattress.
// No database changes. --upload publishes only the generated model bytes to
// the configured public App Storage directory, never a shopper upload endpoint.
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { Storage } from "@google-cloud/storage";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const source = path.join(root, "attached_assets/generated_models/infini-medical-mattress.glb");
const output = path.join(root, "attached_assets/generated_models/infini-medical-mattress-200x210x20.glb");
const objectPath = "product-models/infini-medical-mattress-200x210x20-v1.glb";
const dimensions = { width: 200, height: 20, depth: 210, unit: "cm" };
const notice = "Size-based 3D approximation, not a product scan. Modeled size: 200 W × 210 L × 20 H cm. Other sizes and exact fabric details are not represented.";

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco.createDecoderModule(),
  "draco3d.encoder": await draco.createEncoderModule(),
  "meshopt.decoder": MeshoptDecoder,
  "meshopt.encoder": MeshoptEncoder,
});
const document = await io.read(source);
const scenes = document.getRoot().listScenes();
if (scenes.length !== 1 || document.getRoot().listSkins().length) {
  throw new Error("Expected one static model scene; inspect this asset manually.");
}
const scene = scenes[0];
const before = getBounds(scene);
const extent = before.max.map((max, axis) => max - before.min[axis]);
if (extent.some((value) => !Number.isFinite(value) || value <= 0)) {
  throw new Error("Invalid model bounding box.");
}
if (extent[1] > Math.min(extent[0], extent[2])) {
  throw new Error("Y is not the shortest axis: inspect mattress orientation before scaling.");
}
const scale = [2 / extent[0], 0.2 / extent[1], 2.1 / extent[2]];
const normalized = document.createNode("Mattress — 200W × 210L × 20H cm")
  .setScale(scale)
  .setTranslation([
    -((before.min[0] + before.max[0]) / 2) * scale[0],
    -before.min[1] * scale[1],
    -((before.min[2] + before.max[2]) / 2) * scale[2],
  ])
  .setExtras({ dimensions, notice, groundContact: "bottom at y=0", units: "meters" });
for (const child of scene.listChildren()) {
  scene.removeChild(child);
  normalized.addChild(child);
}
scene.addChild(normalized);
document.getRoot().setDefaultScene(scene);
await io.write(output, document);
const written = await io.read(output);
const after = getBounds(written.getRoot().listScenes()[0]);
const sizes = after.max.map((max, axis) => max - after.min[axis]);
if (sizes.some((value, axis) => Math.abs(value - [2, 0.2, 2.1][axis]) > 0.00001)) {
  throw new Error("Normalized dimensions did not verify.");
}
const { size: fileSizeBytes } = await stat(output);
console.log(JSON.stringify({ file: path.relative(root, output), originalExtent: extent, meters: sizes, fileSizeBytes }));

if (process.argv.includes("--upload")) {
  const publicRoot = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(",").map((s) => s.trim()).find(Boolean);
  if (!publicRoot) throw new Error("App Storage public directory is not configured.");
  const parts = publicRoot.replace(/^\/+/, "").split("/");
  const bucketName = parts.shift();
  const objectName = [...parts, objectPath].join("/");
  // Keep this sidecar credential configuration identical to the App Storage template.
  const storage = new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: "http://127.0.0.1:1106/token",
      type: "external_account",
      credential_source: {
        url: "http://127.0.0.1:1106/credential",
        format: { type: "json", subject_token_field_name: "access_token" },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
  const object = storage.bucket(bucketName).file(objectName);
  await object.save(await readFile(output), {
    resumable: false,
    metadata: { contentType: "model/gltf-binary", cacheControl: "public, max-age=3600" },
  });
  const [metadata] = await object.getMetadata();
  if (Number(metadata.size) !== fileSizeBytes) throw new Error("Stored object size does not match GLB.");
  const registry = path.join(root, "artifacts/api-server/assets/prepared-models.json");
  await mkdir(path.dirname(registry), { recursive: true });
  await writeFile(registry, JSON.stringify([{
    handle: "infini-homes-high-density-foam-premium-white-medical-mattress-200w-x-210l-x-20h",
    objectPath, fileSizeBytes, dimensions, notice,
  }], null, 2) + "\n");
  console.log("Verified public model upload and wrote prepared-asset registry. No database rows changed.");
}
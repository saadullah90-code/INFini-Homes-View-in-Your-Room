// White wardrobe visual approximation based on the supplied product photo.
// Outer dimensions from the supplied size diagram: 80 W × 40 D × 185 H cm.
import { Document, NodeIO } from "@gltf-transform/core";
import { BoxGeometry, CylinderGeometry, TorusGeometry } from "three";
import { Storage } from "@google-cloud/storage";
import { mkdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const handle = "infini-homes-2-door-wooden-wardrobe-cabinet-cupboard-of-engineered-wood-with-1-lockable-drawer-perfect-modern-stylish-heavy-duty-color-white-without-assembly";
const objectPath = "product-models/infini-white-wardrobe-80x40x185-v1.glb";
const dimensions = { width: 80, height: 185, depth: 40, unit: "cm" };
const notice = "Size-based 3D approximation of the white 2-door wardrobe, not a product scan. Outer size: 80 W × 40 D × 185 H cm. Interior layout, fittings and other colour variants are not verified.";
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene("White two-door wardrobe");
const white = doc.createMaterial("White engineered wood").setBaseColorFactor([0.88, 0.89, 0.89, 1]).setRoughnessFactor(0.83);
const door = doc.createMaterial("White door panels").setBaseColorFactor([0.95, 0.95, 0.95, 1]).setRoughnessFactor(0.72);
const edge = doc.createMaterial("Panel edge").setBaseColorFactor([0.72, 0.73, 0.73, 1]).setRoughnessFactor(0.84);
const metal = doc.createMaterial("Silver handles").setBaseColorFactor([0.60, 0.64, 0.66, 1]).setMetallicFactor(0.7).setRoughnessFactor(0.28);
const lock = doc.createMaterial("Dark lock").setBaseColorFactor([0.10, 0.11, 0.12, 1]).setMetallicFactor(0.45).setRoughnessFactor(0.35);

function mesh(name, geometry, material, position, rotation) {
  const primitive = doc.createPrimitive().setMaterial(material);
  for (const [key, attr] of [["POSITION", "position"], ["NORMAL", "normal"]]) {
    primitive.setAttribute(key, doc.createAccessor().setType("VEC3")
      .setArray(new Float32Array(geometry.attributes[attr].array)).setBuffer(buffer));
  }
  if (geometry.index) primitive.setIndices(doc.createAccessor().setType("SCALAR")
    .setArray(new Uint32Array(geometry.index.array)).setBuffer(buffer));
  const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)).setTranslation(position);
  if (rotation) node.setRotation(rotation);
  scene.addChild(node);
}
function box(name, size, position, material = white) {
  mesh(name, new BoxGeometry(...size), material, position);
}
// Front is positive Z. Keep visible geometry within the measured 0.8 × 1.85 × 0.4 m footprint.
box("Left side panel", [.018, 1.79, .375], [-.385, .925, -.008]);
box("Right side panel", [.018, 1.79, .375], [.385, .925, -.008]);
box("Back panel", [.75, 1.79, .012], [0, .925, -.19]);
box("Top cap", [.8, .025, .4], [0, 1.8375, 0]);
box("Bottom plinth", [.78, .08, .39], [0, .04, 0]);
box("Front header", [.75, .035, .023], [0, 1.79, .18], edge);
box("Left full-height door", [.365, 1.65, .017], [-.19, .952, .186], door);
box("Right upper door", [.365, 1.36, .017], [.19, 1.097, .186], door);
box("Drawer front (lower right)", [.36, .24, .019], [.19, .285, .188], door);
box("Drawer reveal", [.365, .004, .019], [.19, .41, .196], edge);
box("Centre door reveal", [.004, 1.65, .018], [0, .952, .198], edge);

// Curved silver grab bars: uprights and short feet mimic the photo without
// implying that the cabinet doors are animated or that the locks operate.
function handleBar(name, x, y, z, length = .105) {
  mesh(name, new CylinderGeometry(.005, .005, length, 10), metal, [x, y, z]);
  for (const offset of [-length / 2, length / 2]) {
    mesh(name + " mount", new CylinderGeometry(.004, .004, .014, 10), metal,
      [x, y + offset, z - .007], [Math.sin(Math.PI / 4), 0, 0, Math.cos(Math.PI / 4)]);
  }
}
handleBar("Left door pull", -.032, 1.065, .21);
handleBar("Right door pull", .032, 1.065, .21);
mesh("Drawer horizontal pull", new CylinderGeometry(.004, .004, .09, 10), metal,
  [.19, .295, .213], [0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)]);
for (const x of [-.043, .043]) {
  mesh("Door lock escutcheon", new CylinderGeometry(.008, .008, .003, 12), metal,
    [x, .935, .201], [Math.sin(Math.PI / 4), 0, 0, Math.cos(Math.PI / 4)]);
  box("Dark keyhole", [.003, .006, .002], [x, .935, .204], lock);
}
mesh("Drawer keyhole surround", new TorusGeometry(.007, .002, 5, 12), metal, [.19, .344, .201]);
box("Drawer keyhole", [.003, .006, .002], [.19, .344, .203], lock);

doc.getRoot().setDefaultScene(scene).setExtras({
  provenance: "Procedural, size-based approximation from supplied photos; not a scan.",
  dimensions, notice, handle,
});
const output = fileURLToPath(new URL("../../attached_assets/generated_models/infini-white-wardrobe-80x40x185.glb", import.meta.url));
await mkdir(fileURLToPath(new URL("../../attached_assets/generated_models/", import.meta.url)), { recursive: true });
await new NodeIO().write(output, doc);
const { size } = await stat(output);
console.log(JSON.stringify({ objectPath, fileSizeBytes: size, dimensions, notice }));

if (process.argv.includes("--upload")) {
  const publicRoot = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(",").map(s => s.trim()).find(Boolean);
  if (!publicRoot) throw new Error("App Storage public directory is not configured.");
  const [bucket, ...directory] = publicRoot.replace(/^\/+/, "").split("/");
  const storage = new Storage({
    credentials: {
      audience: "replit", subject_token_type: "access_token",
      token_url: "http://127.0.0.1:1106/token", type: "external_account",
      credential_source: {
        url: "http://127.0.0.1:1106/credential",
        format: { type: "json", subject_token_field_name: "access_token" },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
  const file = storage.bucket(bucket).file([...directory, objectPath].join("/"));
  await file.save(await readFile(output), {
    resumable: false,
    metadata: { contentType: "model/gltf-binary", cacheControl: "public, max-age=3600" },
  });
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size) !== size) throw new Error("Uploaded GLB size mismatch.");
  console.log("Uploaded and verified wardrobe GLB in App Storage.");
}
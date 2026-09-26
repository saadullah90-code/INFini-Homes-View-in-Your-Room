import { Document, NodeIO } from "@gltf-transform/core";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { TubeGeometry, CatmullRomCurve3, Vector3 } from "three";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene("White medical mattress");
const fabric = doc.createMaterial("White woven fabric").setBaseColorFactor([0.92,0.91,0.88,1]).setRoughnessFactor(0.96);
const top = doc.createMaterial("White quilted top").setBaseColorFactor([0.99,0.98,0.95,1]).setRoughnessFactor(0.98);
const seam = doc.createMaterial("Fine stitched seams").setBaseColorFactor([0.78,0.78,0.75,1]).setRoughnessFactor(1);
function mesh(name, geometry, material, y=0) {
  const primitive = doc.createPrimitive().setMaterial(material);
  for (const [key, attr] of [["POSITION","position"],["NORMAL","normal"]]) {
    primitive.setAttribute(key, doc.createAccessor().setType("VEC3").setArray(new Float32Array(geometry.attributes[attr].array)).setBuffer(buffer));
  }
  if (geometry.index) primitive.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(geometry.index.array)).setBuffer(buffer));
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)).setTranslation([0,y,0]));
}
mesh("High density foam mattress",new RoundedBoxGeometry(2,0.174,2.1,5,0.032),fabric,0.087);
mesh("Quilted upper panel",new RoundedBoxGeometry(1.975,0.028,2.075,4,0.013),top,0.186);
for (const height of [0.035,0.178]) {
  const points=[];
  const hw=.982, hd=1.032, r=.055;
  for(let corner=0;corner<4;corner++){
    const cx=[hw-r,-hw+r,-hw+r,hw-r][corner],cz=[hd-r,hd-r,-hd+r,-hd+r][corner];
    for(let k=0;k<=16;k++){
      const angle=(corner*90+k*90/16)*Math.PI/180;
      points.push(new Vector3(cx+r*Math.cos(angle),height,cz+r*Math.sin(angle)));
    }
  }
  mesh("Perimeter piping",new TubeGeometry(new CatmullRomCurve3(points,true),220,.0028,6,true),seam);
}
// Fine diagonal quilting follows the top panel without adding unrelated furniture.
for(const slope of [-1,1]) for(let intercept=-1.8;intercept<=1.81;intercept+=.22) {
  const points=[];
  for(let step=0;step<=120;step++){
    const x=-.935+step*1.87/120,z=slope*x+intercept;
    if(Math.abs(z)<.985) points.push(new Vector3(x,.2008,z));
  }
  if(points.length>2) mesh("Diamond quilting",new TubeGeometry(new CatmullRomCurve3(points),points.length,.00065,4,false),seam);
}
doc.getRoot().setDefaultScene(scene).setExtras({provenance:"Procedural size-based visual approximation, not a scan or AI-generated mesh."});
const out=fileURLToPath(new URL("../../attached_assets/generated_models/infini-medical-mattress.glb",import.meta.url));
await mkdir(fileURLToPath(new URL("../../attached_assets/generated_models/",import.meta.url)),{recursive:true});
await new NodeIO().write(out,doc);
console.log("Created size-based mattress GLB.");
// CPU-only visual inspection of the actual GLB triangles for non-WebGL runners.
import { NodeIO } from "@gltf-transform/core";
import { Vector3, Matrix4 } from "three";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
const input=fileURLToPath(new URL("../../attached_assets/generated_models/infini-medical-mattress-200x210x20.glb",import.meta.url));
const output=fileURLToPath(new URL("../../attached_assets/generated_models/mattress-inspection.png",import.meta.url));
const doc=await new NodeIO().read(input), triangles=[];
const right=new Vector3(.8,0,-.6),up=new Vector3(-.3,.866,-.4),view=new Vector3(.52,.5,.69),light=new Vector3(-.3,.9,.3).normalize();
for(const node of doc.getRoot().listNodes()){
  const mesh=node.getMesh(); if(!mesh)continue;
  const matrix=new Matrix4().fromArray(node.getWorldMatrix());
  for(const prim of mesh.listPrimitives()){
    const pos=prim.getAttribute("POSITION"), indices=prim.getIndices();
    const colors=prim.getMaterial()?.getBaseColorFactor()??[1,1,1,1];
    for(let i=0;i<(indices?.getCount()??pos.getCount());i+=3){
      const verts=[0,1,2].map(k=>{const a=[];pos.getElement(indices?indices.getScalar(i+k):i+k,a);return new Vector3(...a).applyMatrix4(matrix);});
      const normal=new Vector3().crossVectors(verts[1].clone().sub(verts[0]),verts[2].clone().sub(verts[0])).normalize();
      if(normal.dot(view)<=0)continue;
      const shade=.68+.32*Math.max(0,normal.dot(light));
      triangles.push({verts:verts.map(v=>[450+v.dot(right)*260,380-v.dot(up)*260,v.dot(view)]),color:colors.slice(0,3).map(c=>Math.round(c*shade*255))});
    }
  }
}
const pixels=Buffer.alloc(900*620*3,238), depths=new Float64Array(900*620).fill(-Infinity);
for(const t of triangles){
  const [a,b,c]=t.verts, den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)continue;
  for(let y=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1])));y<=Math.min(619,Math.ceil(Math.max(a[1],b[1],c[1])));y++)
  for(let x=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0])));x<=Math.min(899,Math.ceil(Math.max(a[0],b[0],c[0])));x++){
    const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den,w=1-u-v;
    if(Math.min(u,v,w)<0)continue;
    const z=u*a[2]+v*b[2]+w*c[2],i=y*900+x;
    if(z>depths[i]){depths[i]=z;for(let ch=0;ch<3;ch++)pixels[i*3+ch]=t.color[ch];}
  }
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620"><text x="30" y="555" font-family="sans-serif" font-size="22" fill="#213b3d">Mattress GLB — 200 × 210 × 20 cm</text><text x="30" y="586" font-family="sans-serif" font-size="16" fill="#526366">Size-based approximation · Actual mesh, CPU-rendered inspection</text></svg>`;
await sharp(pixels,{raw:{width:900,height:620,channels:3}}).composite([{input:Buffer.from(svg)}]).png().toFile(output);
console.log(output);
import * as T from "three";
import { createForkMaterials } from "./fork-materials";
import { approachPose, branchPose, nextFork, type ForkPose } from "@/lib/fork-world";
import type { ForkWorldProps } from "./ForkCanvasWorld";

/** 직접 만든 지형·관절 모델입니다. 게임 판정과 같은 월드 좌표를 사용합니다. */
export function createForkEngine(host: HTMLElement, initial: ForkWorldProps, onLost: () => void) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.06; renderer.setClearColor(0x000000,0);
  const canvas = renderer.domElement; host.appendChild(canvas);
  const scene = new T.Scene(); scene.background = null; scene.fog = new T.Fog("#d0ddd1", 85, 260);
  const camera = new T.PerspectiveCamera(55, 1, .1, 550);
  scene.add(new T.HemisphereLight("#e5faff", "#9c7850", 2.1));
  const sun = new T.DirectionalLight("#ffe6ad", 3.4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -35; sun.shadow.camera.right = 35; sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45; sun.shadow.camera.far = 140; sun.shadow.bias = -.0008;
  scene.add(sun, sun.target);
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
  const geo = <G extends T.BufferGeometry>(g: G) => { geometries.add(g); return g; };
  const mat = (color: string, extra: T.MeshStandardMaterialParameters = {}) => { const m = new T.MeshStandardMaterial({ color, roughness: .85, ...extra }); materials.add(m); return m; };
  const cream = mat("#fff0d4"), orange = mat("#eb9b49"), blue = mat("#40546f"), teal = mat("#257f83"), skin = mat("#dca679"), shoes = mat("#59566b");
  const rockMats = [mat("#bc905a"), mat("#d4b174"), mat("#957345")], leafMats = [mat("#436c2d"), mat("#729348"), mat("#355c29")];
  const trunkGeo=geo(new T.CylinderGeometry(.7,1,1,7));
  const rockGeo = geo(new T.IcosahedronGeometry(1, 1)), cube = geo(new T.BoxGeometry(1, 1, 1)), sphere = geo(new T.SphereGeometry(1, 12, 8)), capsule = geo(new T.CapsuleGeometry(1, 1, 3, 8));
  function mesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, xyz: number[], scale: number[], shadow = true) {
    const object = new T.Mesh(geometry, material); object.position.set(xyz[0], xyz[1], xyz[2]); object.scale.set(scale[0], scale[1], scale[2]); object.castShadow = shadow; object.receiveShadow = true; parent.add(object); return object;
  }
  const avatar = new T.Group(); avatar.name = "직접 제작한 달리기 캐릭터"; scene.add(avatar);
  mesh(avatar, capsule, cream, [0, 1.75, 0], [.34, .34, .27]); mesh(avatar, cube, blue, [0, 1.15, 0], [.54, .28, .4]);
  mesh(avatar, sphere, skin, [0, 2.43, .02], [.3, .32, .28]); mesh(avatar, sphere, teal, [0, 2.61, -.02], [.32, .17, .31]); mesh(avatar, cube, teal, [0, 2.55, .28], [.42, .045, .24]);
  mesh(avatar, cube, orange, [0, 1.82, -.32], [.5, .68, .24]); mesh(avatar, cube, cream, [0, 1.65, -.47], [.32, .15, .04]);
  const legs: T.Group[] = [], arms: T.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group(); leg.position.set(side * .18, 1.12, 0); avatar.add(leg); legs.push(leg);
    mesh(leg, capsule, blue, [0, -.3, 0], [.11, .24, .12]); mesh(leg, capsule, blue, [0, -.74, .01], [.095, .21, .1]); mesh(leg, cube, shoes, [0, -1.03, .09], [.23, .14, .38]);
    const arm = new T.Group(); arm.position.set(side * .4, 2.05, 0); avatar.add(arm); arms.push(arm);
    mesh(arm, capsule, cream, [0, -.25, 0], [.12, .22, .12]); mesh(arm, capsule, skin, [0, -.62, .06], [.09, .16, .09]);
  }
  const surface=createForkMaterials();
  const terrain = new T.Group(); scene.add(terrain);
  const terrainGeometries:T.BufferGeometry[]=[];
  let worldKey = "";
  const decorations = new T.Group(); terrain.add(decorations);
  const hash = (x: number, z: number) => { const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return n - Math.floor(n); };
  function clearTerrain() {
    for(const child of [...terrain.children])if(child!==decorations)terrain.remove(child);
    for(const child of decorations.children)if(child instanceof T.InstancedMesh)child.dispose();
    decorations.clear();for(const geometry of terrainGeometries)geometry.dispose();terrainGeometries.length=0;
  }
  function rebuild(state: ForkWorldProps) {
    const key = `${state.origin.x},${state.origin.z},${state.origin.heading},${state.phase === "fall"},${state.phase==="fall" ? state.choice : ""}`;
    if (key === worldKey) return; worldKey = key;clearTerrain();
    type Surface="path"|"wall"|"verge";
    const buffers:Record<Surface,{p:number[];c:number[];uv:number[]}>= {path:{p:[],c:[],uv:[]},wall:{p:[],c:[],uv:[]},verge:{p:[],c:[],uv:[]}};
    const color = new T.Color();
    function face(a:number[],b:number[],c:number[],d:number[],kind:Surface,tint:string,uv?:number[][]) {
      const buffer=buffers[kind];color.set(tint);
      for(const index of [0,1,2,0,2,3]){const point=[a,b,c,d][index];buffer.p.push(...point);buffer.c.push(color.r,color.g,color.b);buffer.uv.push(...(uv?.[index]??[point[0]/7,point[2]/7]));}
    }
    const batches=new Map<string,{geometry:T.BufferGeometry;material:T.Material;matrices:T.Matrix4[]}>(),dummy=new T.Object3D();
    function stamp(geometry:T.BufferGeometry,material:T.Material,position:number[],scale:number[],angle=0){
      const key=geometry.uuid+material.uuid;let batch=batches.get(key);if(!batch){batch={geometry,material,matrices:[]};batches.set(key,batch);}
      dummy.position.set(position[0],position[1],position[2]);dummy.scale.set(scale[0],scale[1],scale[2]);dummy.rotation.set(0,angle,0);dummy.updateMatrix();batch.matrices.push(dummy.matrix.clone());
    }
    function edge(p:ForkPose,side:number,y=0){return [p.x+Math.cos(p.heading)*side,y,p.z-Math.sin(p.heading)*side];}
    function segment(a:ForkPose,b:ForkPose,i:number){
      face(edge(a,-3),edge(b,-3),edge(b,3),edge(a,3),"path",i%2 ? "#fff1d8" : "#fff5df");
      for(const side of [-1,1]){
        face(edge(a,side*3,.015),edge(b,side*3,.015),edge(b,side*4,.015),edge(a,side*4,.015),"verge","#e6dea7");
        const layers=[[0,4],[-2.5,4.3],[-6,4.1],[-11,4.6],[-18,3.8],[-29,3.2],[-38,2.5]];
        for(let layer=0;layer<layers.length-1;layer++){
          const [y,w]=layers[layer],[ny,nw]=layers[layer+1];
          const warp=(p:ForkPose)=>Math.sin(p.x*.3+p.z*.27+layer)*.22;
          const u=(a.x+a.z)/12,v=(b.x+b.z)/12;
          face(edge(a,side*(w+warp(a)),y),edge(a,side*(nw+warp(a)),ny),edge(b,side*(nw+warp(b)),ny),edge(b,side*(w+warp(b)),y),"wall",layer%2 ? "#edcda4" : "#fff1cf",[[u,-y/30],[u,-ny/30],[v,-ny/30],[v,-y/30]]);
        }
        if(i%2===0){const p=edge(a,side*(3.35+hash(a.x,a.z)*.6));stamp(rockGeo,rockMats[i%3],[p[0],.17,p[2]],[.35+hash(p[0],p[2])*.45,.23,.4],a.heading);}
      }
      if(i%5===0){
        const side=hash(a.x,a.z)>.5 ? -1:1,p=edge(a,side*3.65),size=.7+hash(p[0],p[2])*.7;
        stamp(trunkGeo,rockMats[2],[p[0],size*.8,p[2]],[.15,size*1.7,.15],a.heading);
        for(let crown=0;crown<4;crown++){const angle=crown*2.1+hash(p[0],p[2])*5;stamp(sphere,leafMats[crown%3],[p[0]+Math.cos(angle)*size*.45,size*(1.6+crown*.15),p[2]+Math.sin(angle)*size*.45],[size*.85,size*.5,size*.7]);}
        for(let shrub=0;shrub<2;shrub++)stamp(sphere,leafMats[(i+shrub)%3],[p[0]+side*.4,.18,p[2]+shrub*.4],[.5,.3,.45]);
      }
    }
    function straight(origin:ForkPose){for(let i=0;i<11;i++)segment(approachPose(origin,i/11),approachPose(origin,(i+1)/11),i);}
    function branch(origin:ForkPose,side:number,broken=false){for(let i=0;i<12;i++){if(broken && i>3)break;segment(branchPose(origin,side,i/12),branchPose(origin,side,(i+1)/12),i);}}
    function tree(origin:ForkPose,depth:number){straight(origin);for(const side of [0,1]){const broken=depth===0 && state.phase==="fall" && side===(state.choice??0);branch(origin,side,broken);if(depth<2 && !broken)tree(nextFork(origin,side),depth+1);}}
    if(!state.trail.length)straight({...state.origin,x:state.origin.x-Math.sin(state.origin.heading)*44,z:state.origin.z-Math.cos(state.origin.heading)*44});
    for(const leg of state.trail){straight(leg.origin);branch(leg.origin,leg.choice);}tree(state.origin,0);
    for(const kind of ["path","wall","verge"] as const){const buffer=buffers[kind],geometry=new T.BufferGeometry();geometry.setAttribute("position",new T.Float32BufferAttribute(buffer.p,3));geometry.setAttribute("color",new T.Float32BufferAttribute(buffer.c,3));geometry.setAttribute("uv",new T.Float32BufferAttribute(buffer.uv,2));geometry.computeVertexNormals();terrainGeometries.push(geometry);const road=new T.Mesh(geometry,surface[kind]);road.receiveShadow=true;road.castShadow=kind==="wall";terrain.add(road);}
    for(const batch of batches.values()){const instances=new T.InstancedMesh(batch.geometry,batch.material,batch.matrices.length);batch.matrices.forEach((matrix,i)=>instances.setMatrixAt(i,matrix));instances.castShadow=true;instances.receiveShadow=true;decorations.add(instances);}
  }
  const distant = new T.Group(); scene.add(distant); let distantKey="";
  const waterfallMat=new T.MeshBasicMaterial({map:surface.flow,transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false});materials.add(waterfallMat);
  const mistMaterial=new T.SpriteMaterial({map:surface.mist,transparent:true,opacity:.28,depthWrite:false,color:"#eef3db"});materials.add(mistMaterial);
  const falls:T.Mesh[]=[];
  function scenery(x:number,z:number){
    const gx=Math.floor(x/100),gz=Math.floor(z/100),key=`${gx},${gz}`;if(key===distantKey)return;distantKey=key;distant.clear();falls.length=0;
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
      const px=(gx+dx)*100+hash(dx,dz)*25,pz=(gz+dz)*100+hash(dz,dx)*25;
      if(Math.hypot(px-x,pz-z)<42)continue;
      const fall=mesh(distant,cube,waterfallMat,[px,-17,pz],[1.8,34,.3],false);falls.push(fall);
      const cloud=new T.Sprite(mistMaterial);cloud.position.set(px,-15-hash(px,pz)*9,pz);cloud.scale.set(75,22,1);distant.add(cloud);
    }
  }
  const waterMat=mat("#3cbdc1",{roughness:.2,metalness:.4,transparent:true,opacity:.72});
  const water=mesh(scene,geo(new T.PlaneGeometry(1800,1800)),waterMat,[0,-39,0],[1,1,1],false);water.rotation.x=-Math.PI/2;
  let state=initial, frame=0, disposed=false, time=0, last=performance.now();
  // 기존 고해상도 캐릭터 원화를 월드 좌표의 빌보드로 결합합니다. 실패 시 관절 모델을 유지합니다.
  const runnerMaterial=new T.SpriteMaterial({transparent:true,alphaTest:.08,toneMapped:false,depthWrite:false});materials.add(runnerMaterial);
  const runner=new T.Sprite(runnerMaterial);runner.center.set(.5,0);runner.scale.set(3.6,3.6,1);runner.visible=false;scene.add(runner);
  let runnerReady=false;
  const runnerTexture=new T.TextureLoader().load("/arcade/runner-back-v1.webp",texture=>{if(disposed){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;texture.repeat.set(.5,.5);runnerMaterial.map=texture;runnerMaterial.needsUpdate=true;runnerReady=true;},undefined,()=>{runnerReady=false;});
  const shadowMaterial=new T.MeshBasicMaterial({map:surface.mist,color:"#382a1e",transparent:true,opacity:.55,depthWrite:false});materials.add(shadowMaterial);
  const footShadow=mesh(scene,geo(new T.PlaneGeometry(3,2)),shadowMaterial,[0,.04,0],[1,1,1],false);footShadow.rotation.x=-Math.PI/2;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  const resize=()=>{const box=host.getBoundingClientRect();camera.aspect=box.width/Math.max(1,box.height);camera.updateProjectionMatrix();renderer.setSize(box.width,box.height);};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const onContextLost=(event:Event)=>{event.preventDefault();onLost();};canvas.addEventListener("webglcontextlost",onContextLost);
  function render(now:number) {
    if(disposed)return;frame=requestAnimationFrame(render);
    const delta=Math.min(.05,(now-last)/1000);last=now;if(document.hidden)return;
    const moving=!state.paused && ["run","cross","fall"].includes(state.phase);if(moving && !reduced.matches)time+=delta;
    rebuild(state);
    const turning=state.phase==="cross" || state.phase==="fall";
    const player=turning ? branchPose(state.origin,state.choice??0,state.transition) : approachPose(state.origin,state.phase==="run" ? state.progress : 0);
    scenery(player.x,player.z);
    avatar.position.set(player.x,state.phase==="fall" ? -state.transition*state.transition*24 : moving ? Math.abs(Math.sin(time*12))*.08 : 0,player.z);avatar.rotation.set(0,player.heading,turning ? (state.choice===0 ? .1 : -.1) : 0);
    for(let i=0;i<2;i++){legs[i].rotation.x=moving ? Math.sin(time*12+i*Math.PI)*.7 : 0;arms[i].rotation.x=moving ? -Math.sin(time*12+i*Math.PI)*.65 : 0;}
    avatar.visible=!runnerReady && (state.phase!=="fall" || state.transition<.95);
    runner.visible=runnerReady && (state.phase!=="fall" || state.transition<.95);runner.position.copy(avatar.position);
    const pose=Math.floor(time*9)%4;runnerTexture.offset.set((pose%2)*.5,pose<2 ? .5:0);
    runnerMaterial.rotation=state.phase==="fall" ? state.transition*.8 : turning ? (state.choice===0 ? .055:-.055):0;
    footShadow.position.set(player.x,.04,player.z);footShadow.visible=state.phase!=="fall";
    camera.position.set(player.x-Math.sin(player.heading)*14,7,player.z-Math.cos(player.heading)*14);camera.lookAt(player.x+Math.sin(player.heading)*12,1,player.z+Math.cos(player.heading)*12);
    sun.position.set(player.x-25,60,player.z-15);sun.target.position.set(player.x,0,player.z);
    surface.flow.offset.y=-time*.35;
    host.parentElement?.style.setProperty("--fork-pan",`${-Math.sin(player.heading)*5}%`);
    for(const fall of falls)fall.scale.x=1.9+Math.sin(time*3+fall.position.x)*.12;
    renderer.render(scene,camera);
    canvas.dataset.camera=`${camera.position.x.toFixed(2)},${camera.position.z.toFixed(2)},${player.heading.toFixed(2)}`;canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.materials="sandstone";canvas.dataset.runner=runnerReady ? "original-art":"model";canvas.dataset.textureSource=surface.path.map?.userData.source??"procedural";
    const head=new T.Vector3(player.x,avatar.position.y+(runnerReady ? 3.6:2.8),player.z).project(camera);canvas.dataset.characterTop=String((1-head.y)/2*host.clientHeight);
  }
  render(performance.now());
  return {
    update(next:ForkWorldProps){state=next;},
    dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener("webglcontextlost",onContextLost);clearTerrain();runnerTexture.dispose();surface.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();}
  };
}

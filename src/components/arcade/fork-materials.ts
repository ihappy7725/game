import * as T from "three";

/** 원화의 사암·흙·초록색에 맞춘 타일 재질입니다. 외부 이미지/API를 생성하지 않습니다. */
export function createForkMaterials() {
  let seed = 83421;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const textures: T.Texture[] = [];
  function paint(draw: (ctx: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("지형 재질을 만들 수 없습니다.");
    draw(ctx);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.anisotropy = 4; textures.push(texture); return texture;
  }
  const sand = paint(ctx => {
    ctx.fillStyle = "#d7ae70"; ctx.fillRect(0,0,512,512);
    for(let i=0;i<14000;i++) { const x=random()*512,y=random()*512,r=.3+random()*2.5;ctx.fillStyle=i%3 ? `rgba(255,235,190,${.05+random()*.2})` : `rgba(102,64,30,${.04+random()*.16})`;ctx.fillRect(x,y,r,r); }
    for(let i=0;i<110;i++) {
      const x=random()*512,y=random()*512,r=1+random()*5;
      ctx.fillStyle="#ad83514d";ctx.beginPath();ctx.ellipse(x+1,y+2,r*1.3,r*.6,random(),0,Math.PI*2);ctx.fill();
      ctx.fillStyle=i%2 ? "#efc990" : "#be925e";ctx.beginPath();ctx.ellipse(x,y,r,r*.55,random(),0,Math.PI*2);ctx.fill();
    }
    ctx.lineWidth=1;ctx.strokeStyle="#9b75452c";
    for(let i=0;i<25;i++){const x=random()*512,y=random()*512;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*16,y+6);ctx.lineTo(x+12,y+18);ctx.stroke();}
  });
  const cliff = paint(ctx => {
    ctx.fillStyle="#b97843";ctx.fillRect(0,0,512,512);
    for(let row=0;row<5;row++) {
      const y=row*104,offset=row%2 ? -75 : -9;
      for(let col=0;col<4;col++) {
        const x=offset+col*174,w=165+random()*10,h=94+random()*7;
        const gradient=ctx.createLinearGradient(x,y,x,y+h);gradient.addColorStop(0,"#e5b274");gradient.addColorStop(.15,["#cb955c","#d2a068","#bd814c"][col%3]);gradient.addColorStop(1,"#925c36");
        ctx.fillStyle=gradient;ctx.beginPath();ctx.roundRect(x,y,w,h,5);ctx.fill();ctx.strokeStyle="#704b3245";ctx.lineWidth=1;ctx.stroke();
      }
    }
    for(let i=0;i<18000;i++){ctx.fillStyle=i%2 ? "#ffe6b615" : "#57351c12";ctx.fillRect(random()*512,random()*512,1+random()*3,1+random()*4);}
  });
  const grass=paint(ctx=>{
    ctx.fillStyle="#6c8241";ctx.fillRect(0,0,512,512);
    for(let i=0;i<12000;i++){ctx.strokeStyle=i%2 ? "#c9c36a88" : "#314e2f70";const x=random()*512,y=random()*512;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*6-3,y-3-random()*9);ctx.stroke();}
  });
  const mist=paint(ctx=>{
    const gradient=ctx.createRadialGradient(256,256,0,256,256,256);gradient.addColorStop(0,"#fff9e8a0");gradient.addColorStop(.4,"#f2f8ed50");gradient.addColorStop(1,"#fff0");ctx.fillStyle=gradient;ctx.fillRect(0,0,512,512);
  });
  const flow=paint(ctx=>{
    ctx.clearRect(0,0,512,512);
    for(let i=0;i<140;i++){const x=random()*512,y=random()*512;ctx.fillStyle=`rgba(215,255,251,${.04+random()*.3})`;ctx.fillRect(x,y,1+random()*9,20+random()*140);}
  });
  const path=new T.MeshStandardMaterial({map:sand,bumpMap:sand,bumpScale:.08,roughness:.97,vertexColors:true,side:T.DoubleSide});
  const wall=new T.MeshStandardMaterial({map:cliff,bumpMap:cliff,bumpScale:.35,roughness:.92,vertexColors:true,side:T.DoubleSide});
  const verge=new T.MeshStandardMaterial({map:grass,roughness:1,side:T.DoubleSide,vertexColors:true});
  // 원화의 길·암벽 영역을 실제 움직이는 메시 재질에도 사용합니다. 로드 실패 시 위 타일을 유지합니다.
  let disposed=false;
  const art=new Image();
  art.onload=()=>{
    if(disposed)return;
    for(const [texture,x,y,w,h] of [[sand,.45,.66,.1,.14],[cliff,.64,.46,.1,.18]] as const){
      const canvas=texture.image as HTMLCanvasElement,ctx=canvas.getContext("2d");if(!ctx)continue;
      // 원근이 들어 있는 원화를 그대로 반복하면 늘어난 무늬가 생기므로 바탕 재질에 옅게 혼합합니다.
      ctx.globalAlpha=texture===sand ? .35:.22;
      ctx.drawImage(art,art.naturalWidth*x,art.naturalHeight*y,art.naturalWidth*w,art.naturalHeight*h,0,0,512,512);ctx.globalAlpha=1;texture.needsUpdate=true;texture.userData.source="original-art";
    }
  };
  art.src="/arcade/cliff-world-v1.webp";
  return { path,wall,verge,mist,flow,textures,dispose(){disposed=true;art.onload=null;art.src="";path.dispose();wall.dispose();verge.dispose();for(const texture of textures)texture.dispose();} };
}

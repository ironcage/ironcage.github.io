/* 아이언 케이지 — 3D 렌더러 v2 (three.js r128)
   엔진의 2D 관절 포즈를 3D 인체 모델로 옮겨 그린다.
   최적화: ① LOD(선수·관중 고/저 디테일)  ② 컬링(관중 구역 시야·차폐 판정)  ③ 노멀 맵(근육 결)
           ④ 라이트 베이킹(바닥·관중 조명을 텍스처에 구워 넣음)  ⑤ 오브젝트 풀링(혈흔·플래시·그림자)
           ⑥ 텍스처 아틀라스 + 인스턴싱(신체 부위별 1회 드로우콜, 정적 지오메트리 병합) */
(function(IC){
const T=window.THREE;
if(!T){IC.R3D=null;return}
const GY=384,CR=318,RB=470,HB=58;
const DEBUG=/[?&]debug=1/.test(location.search);
const MOBILE=Math.min(screen.width||999,screen.height||999)<600||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const Q={pr:Math.min(window.devicePixelRatio||1,MOBILE?1.5:1.75)};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const LC=c=>new T.Color(c).convertSRGBToLinear();
let R=null;

/* ================= textures ================= */
function cnv(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);return c}
function tex(c,srgb=true){const t=new T.CanvasTexture(c);t.anisotropy=4;if(srgb)t.encoding=T.sRGBEncoding;return t}
/* height map → tangent-space normal map */
function normalFromHeight(hc,strength=2.2){
  const w=hc.width,h=hc.height,src=hc.getContext('2d').getImageData(0,0,w,h).data;
  const out=document.createElement('canvas');out.width=w;out.height=h;const g=out.getContext('2d'),img=g.createImageData(w,h),d=img.data;
  const H=(x,y)=>src[(((y+h)%h)*w+((x+w)%w))*4]/255;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(H(x+1,y)-H(x-1,y))*strength,dy=(H(x,y+1)-H(x,y-1))*strength,l=Math.hypot(dx,dy,1),i=(y*w+x)*4;
    d[i]=(-dx/l*.5+.5)*255;d[i+1]=(dy/l*.5+.5)*255;d[i+2]=(1/l*.5+.5)*255;d[i+3]=255}
  g.putImageData(img,0,0);return out}
/* muscle height map: lathe U wraps around the limb, V runs along it */
function muscleNormal(){
  const hc=cnv(256,256,(g,w,h)=>{g.fillStyle='#808080';g.fillRect(0,0,w,h);
    // long fibres
    for(let i=0;i<70;i++){const x=Math.random()*w;const gr=g.createLinearGradient(x-4,0,x+4,0);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(.5,`rgba(${Math.random()<.5?255:0},${Math.random()<.5?255:0},${Math.random()<.5?255:0},.10)`);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-4,0,8,h)}
    // front (u≈0.25 faces forward): abdominal blocks + pec line + serratus
    const fx=w*.25;
    for(let r=0;r<3;r++)for(const s of [-1,1]){const cx=fx+s*13,cy=h*(.22+r*.12);const gr=g.createRadialGradient(cx,cy,2,cx,cy,15);gr.addColorStop(0,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(128,128,128,0)');g.fillStyle=gr;g.beginPath();g.ellipse(cx,cy,13,16,0,0,7);g.fill()}
    g.fillStyle='rgba(40,40,40,.55)';g.fillRect(fx-1.5,h*.12,3,h*.45);
    g.strokeStyle='rgba(30,30,30,.5)';g.lineWidth=4;g.beginPath();g.moveTo(fx-60,h*.70);g.quadraticCurveTo(fx,h*.78,fx+60,h*.70);g.stroke();
    for(let k=0;k<4;k++)for(const s of [-1,1]){g.strokeStyle='rgba(60,60,60,.35)';g.lineWidth=3;g.beginPath();g.moveTo(fx+s*40,h*(.30+k*.07));g.lineTo(fx+s*62,h*(.27+k*.07));g.stroke()}
    // soft noise
    for(let i=0;i<2500;i++){g.fillStyle=`rgba(${Math.random()<.5?255:0},128,128,.04)`;g.fillRect(Math.random()*w,Math.random()*h,2,2)}
  });
  const t=tex(normalFromHeight(hc,3),false);t.wrapS=t.wrapT=T.RepeatWrapping;return t}

/* ---------- texture atlas (ads, LED boards, posts, truss) — one texture, many meshes ---------- */
const ADS=['IRON CAGE','NORTHPEAK','VOLTA ENERGY','KORE FIGHTWEAR','BLUELINE','IRON CAGE','HALCYON','VOLTA ENERGY'];
function buildAtlas(){
  const W=1024,H=1024;const c=cnv(W,H,(g)=>{
    g.fillStyle='#0d0f13';g.fillRect(0,0,W,H);
    // rows 0..7 : cage pad ads (1024x64)
    ADS.forEach((a,i)=>{const y=i*64;const gr=g.createLinearGradient(0,y,0,y+64);gr.addColorStop(0,'#15181e');gr.addColorStop(1,'#07080b');g.fillStyle=gr;g.fillRect(0,y,W,64);
      g.fillStyle=i%2?'#e8b33a':'#dfe4ec';g.font='bold 40px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(a,W/2,y+34);g.fillStyle='rgba(255,255,255,.06)';g.fillRect(0,y+2,W,3)});
    // rows 8..11 : LED barrier boards (glowing)
    for(let i=0;i<4;i++){const y=512+i*64;g.fillStyle=['#101a33','#2a0f12','#0f2418','#241c08'][i];g.fillRect(0,y,W,64);
      g.fillStyle=['#7fb2ff','#ff6b5e','#6fe3a1','#ffd75e'][i];g.font='bold 36px sans-serif';g.textAlign='center';g.textBaseline='middle';
      for(let k=0;k<3;k++)g.fillText(['IRON CAGE','FIGHT NIGHT','NORTHPEAK','VOLTA'][(i+k)%4],W*(k+.5)/3,y+34);
      for(let x=0;x<W;x+=4){g.fillStyle='rgba(0,0,0,.25)';g.fillRect(x,y,1,64)}}
    // row 12 : metal (posts/rails)
    {const y=768;const gr=g.createLinearGradient(0,0,W,0);gr.addColorStop(0,'#0c0d10');gr.addColorStop(.5,'#3a3f48');gr.addColorStop(1,'#0c0d10');g.fillStyle=gr;g.fillRect(0,y,W,64)}
    // row 13 : post padding with logo
    {const y=832;g.fillStyle='#101116';g.fillRect(0,y,W,64);g.fillStyle='rgba(232,179,58,.75)';g.font='bold 30px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('IRON CAGE',W/2,y+34)}
    // row 14-15 : barrier wall back (dark) and stage/truss
    g.fillStyle='#14171d';g.fillRect(0,896,W,64);g.fillStyle='#1d222b';g.fillRect(0,960,W,64);
  });
  const t=tex(c);t.wrapS=T.RepeatWrapping;
  const row=i=>({v0:1-(i+1)*64/H,v1:1-i*64/H});
  return{tex:t,row}}

/* ---------- baked floor: canvas + baked spotlight pool, fence shadow ring, contact darkening ---------- */
function floorCanvas(title){
  return cnv(1024,1024,(g,w,h)=>{
    const gr=g.createRadialGradient(w/2,h/2,40,w/2,h/2,w*.62);gr.addColorStop(0,'#7a8291');gr.addColorStop(1,'#4b5260');g.fillStyle=gr;g.fillRect(0,0,w,h);
    for(let i=0;i<6000;i++){g.fillStyle=`rgba(${Math.random()<.5?255:0},${Math.random()<.5?255:0},255,.025)`;g.fillRect(Math.random()*w,Math.random()*h,2,2)}
    g.save();g.translate(w/2,h/2);
    g.strokeStyle='rgba(255,255,255,.22)';g.lineWidth=8;g.beginPath();for(let i=0;i<=8;i++){const a=i*Math.PI/4+Math.PI/8,r=w*.455;i?g.lineTo(Math.cos(a)*r,Math.sin(a)*r):g.moveTo(Math.cos(a)*r,Math.sin(a)*r)}g.stroke();
    g.fillStyle='rgba(232,179,58,.32)';g.beginPath();g.arc(0,0,190,0,7);g.fill();
    g.strokeStyle='rgba(232,179,58,.55)';g.lineWidth=7;g.beginPath();g.arc(0,0,204,0,7);g.stroke();
    g.fillStyle='rgba(12,14,18,.62)';g.font='bold 78px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(title?'TITLE FIGHT':'IRON CAGE',0,6);
    g.font='bold 40px sans-serif';g.fillStyle='rgba(255,255,255,.16)';g.fillText('VOLTA',0,-330);g.fillText('NORTHPEAK',0,330);
    g.rotate(Math.PI/2);g.fillText('KORE',0,-330);g.fillText('BLUELINE',0,330);
    g.restore();
    // ---- light baking: key spotlight pool (warm center), falloff to edges, fence shadow lines, pad occlusion ----
    g.globalCompositeOperation='multiply';
    const sh=g.createRadialGradient(w/2,h/2,w*.1,w/2,h/2,w*.52);sh.addColorStop(0,'#ffffff');sh.addColorStop(.75,'#c9c9cf');sh.addColorStop(1,'#62646c');g.fillStyle=sh;g.fillRect(0,0,w,h);
    g.strokeStyle='#8e9098';g.lineWidth=1.2;for(let k=-w;k<w*2;k+=10){g.beginPath();g.moveTo(k,0);g.lineTo(k+w*.35,h);g.stroke()}
    g.globalCompositeOperation='screen';
    const sp=g.createRadialGradient(w/2,h*.47,10,w/2,h/2,w*.38);sp.addColorStop(0,'rgba(255,236,200,.42)');sp.addColorStop(1,'rgba(255,236,200,0)');g.fillStyle=sp;g.fillRect(0,0,w,h);
    g.globalCompositeOperation='source-over';
  })}
function apronCanvas(){return cnv(512,512,(g,w,h)=>{const gr=g.createRadialGradient(w/2,h/2,w*.18,w/2,h/2,w*.5);gr.addColorStop(0,'#3a404b');gr.addColorStop(.32,'#262a32');gr.addColorStop(1,'#08090c');g.fillStyle=gr;g.fillRect(0,0,w,h)})}
function blobCanvas(){return cnv(128,128,(g,w,h)=>{const gr=g.createRadialGradient(w/2,h/2,4,w/2,h/2,w/2);gr.addColorStop(0,'rgba(0,0,0,.55)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,w,h)})}
function chainCanvas(){return cnv(64,64,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle='rgba(200,210,225,.85)';g.lineWidth=2.2;g.beginPath();g.moveTo(0,0);g.lineTo(w,h);g.moveTo(w,0);g.lineTo(0,h);g.stroke()})}

/* ================= geometry merge (static meshes → one draw call) ================= */
const _m=new T.Matrix4();
function mergeGeos(list){
  let n=0;const parts=list.map(({g,m,uv})=>{const ng=g.index?g.toNonIndexed():g.clone();if(m)ng.applyMatrix4(m);if(uv){const a=ng.attributes.uv;for(let i=0;i<a.count;i++)a.setXY(i,uv.u0+a.getX(i)*(uv.u1-uv.u0),uv.v0+a.getY(i)*(uv.v1-uv.v0))}n+=ng.attributes.position.count;return ng});
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3),uvs=new Float32Array(n*2);let o=0;
  for(const p of parts){pos.set(p.attributes.position.array,o*3);nor.set(p.attributes.normal.array,o*3);if(p.attributes.uv)uvs.set(p.attributes.uv.array,o*2);o+=p.attributes.position.count;p.dispose()}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('normal',new T.BufferAttribute(nor,3));g.setAttribute('uv',new T.BufferAttribute(uvs,2));g.computeBoundingSphere();return g}
const M4=(x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(sx,sy,sz));

/* ================= body part library (instanced, hi/lo LOD) ================= */
function limbGeo(r0,rm,r1,ba,seg){const pts=[];for(let k=0;k<=12;k++){const t=k/12,b=Math.exp(-Math.pow((t-ba)/.32,2)),base=lerp(r0,r1,t);let r=base+Math.max(0,rm-lerp(r0,r1,ba))*b;if(k===0||k===12)r*=.92;pts.push(new T.Vector2(r,t))}return new T.LatheGeometry(pts,seg)}
function torsoGeo(seg){const p=[[11.5,0],[12.5,.08],[12,.25],[13.5,.45],[16.5,.68],[18,.82],[17,.92],[12,1],[7,1.02]].map(([r,y])=>new T.Vector2(r,y));return new T.LatheGeometry(p,seg)}
function sph(r,a,b){return new T.SphereGeometry(r,a,b)}
/* head (skull, jaw, chin, nose, ears, brow ridge) merged into one geometry in head-local space; face looks along +X */
function headGeo(hi){const s=hi?[22,16]:[10,8],L=[];
  L.push({g:sph(12.4,s[0],s[1]),m:M4(0,0,0,0,0,0,1.04,1.12,.92)});
  L.push({g:sph(9.4,s[0]*.6|0,s[1]*.6|0),m:M4(4.8,-7.2,0,0,0,0,1.08,.82,.95)});
  L.push({g:sph(4.2,8,6),m:M4(9.6,-10.6,0)});
  L.push({g:new T.ConeGeometry(2.4,6,hi?10:5),m:M4(13,-.5,0,0,0,-1.25)});
  L.push({g:new T.CylinderGeometry(1.9,1.9,15,hi?10:5),m:M4(10.6,4.2,0,Math.PI/2)});
  for(const z of [-1,1])L.push({g:sph(3.3,8,6),m:M4(-1.6,0,z*11.4,0,0,0,.75,1.15,.45)});
  return mergeGeos(L)}
function eyesGeo(){const L=[];for(const z of [-1,1])L.push({g:sph(1.75,8,6),m:M4(10.2,1.6,z*4.4)});return mergeGeos(L)}
function pupilGeo(){const L=[];for(const z of [-1,1])L.push({g:sph(1.05,6,4),m:M4(11.5,1.6,z*4.5)});return mergeGeos(L)}
function browGeo(){const L=[];for(const z of [-1,1])L.push({g:new T.BoxGeometry(6,1.5,3.6),m:M4(11,5.4,z*4.4,0,0,-.1)});return mergeGeos(L)}
function footGeo(hi){return mergeGeos([{g:new T.BoxGeometry(17,5.5,8.5),m:M4(6,-1,0)},{g:sph(4.3,hi?8:5,hi?6:4),m:M4(13,-1.5,0,0,0,0,1,.65,1)}])}
const HAIR={
  cap:()=>mergeGeos([{g:new T.SphereGeometry(13.2,18,10,0,Math.PI*2,0,Math.PI*.5),m:M4(-1.6,1.6,0,0,0,.42,1.04,1,.96)}]),
  bun:()=>mergeGeos([{g:new T.SphereGeometry(13.2,18,10,0,Math.PI*2,0,Math.PI*.5),m:M4(-1.6,1.6,0,0,0,.42,1.04,1,.96)},{g:sph(5,8,6),m:M4(-11,10,0)}]),
  mohawk:()=>mergeGeos([{g:new T.BoxGeometry(20,7,3.4),m:M4(-1,14,0,0,0,.25)}]),
  long:()=>mergeGeos([{g:new T.SphereGeometry(13.2,18,10,0,Math.PI*2,0,Math.PI*.5),m:M4(-1.6,1.6,0,0,0,.42,1.04,1,.96)},{g:new T.BoxGeometry(7,22,20),m:M4(-10,-4,0)}]),
  beard:()=>mergeGeos([{g:new T.SphereGeometry(9.8,14,8,0,Math.PI*2,Math.PI*.42,Math.PI*.58),m:M4(5,-6.4,0,0,0,0,1.1,.95,1)}])
};
/* part spec: name → [geometry factory(hi), material key, instances per rig] */
function partSpecs(){const seg=h=>h?12:6;return{
  torso:[h=>torsoGeo(h?20:8),'skin',1], pec:[h=>sph(7.5,h?10:6,h?8:4),'skin',2], abs:[h=>sph(10,h?10:6,h?8:4),'skin',1],
  pelvis:[h=>new T.CylinderGeometry(13.6,12.2,1,h?18:8),'cloth',1], band:[h=>new T.CylinderGeometry(13.9,13.8,1,h?18:8),'cloth',1],
  neck:[h=>limbGeo(7.4,8,8.4,.5,seg(h)),'skin',1], traps:[h=>sph(9,h?10:6,h?8:4),'skin',1],
  delt:[h=>sph(9,h?10:6,h?8:4),'skin',2], uarm:[h=>limbGeo(7.4,8.6,5.8,.45,seg(h)),'skin',2], elbow:[h=>sph(5.6,h?8:5,h?6:4),'skin',2],
  farm:[h=>limbGeo(5.6,6.6,4.4,.3,seg(h)),'skin',2], glove:[h=>sph(8.4,h?12:6,h?9:5),'glove',2], cuff:[h=>new T.CylinderGeometry(5.6,6.2,1,h?14:6),'cloth',2],
  thigh:[h=>limbGeo(11.5,12.2,7.4,.35,seg(h)),'skin',2], knee:[h=>sph(7.2,h?8:5,h?6:4),'skin',2], shin:[h=>limbGeo(7,8.2,4.6,.28,seg(h)),'skin',2],
  ankle:[h=>sph(4.6,6,4),'skin',2], foot:[h=>footGeo(h),'skin',2], short:[h=>new T.CylinderGeometry(13,14.5,1,h?16:8),'cloth',2],
  head:[h=>headGeo(h),'skin',1], eyes:[()=>eyesGeo(),'eye',1], pupil:[()=>pupilGeo(),'pupil',1], brow:[()=>browGeo(),'hair',1],
  mouth:[()=>new T.BoxGeometry(1.2,.9,6).translate(12.2,-6.5,0),'pupil',1],
  hcap:[()=>HAIR.cap(),'hair',1], hbun:[()=>HAIR.bun(),'hair',1], hmo:[()=>HAIR.mohawk(),'hair',1], hlong:[()=>HAIR.long(),'hair',1], beard:[()=>HAIR.beard(),'hair',1],
  cut:[()=>mergeGeos([0,1,2].map(i=>({g:new T.BoxGeometry(3.6,.9,1.2),m:M4(10.6,6.6-i*1.2,-2+i*2.4)}))),'blood',1],
  blood:[()=>new T.BoxGeometry(.8,9,1.4).translate(12,-1,-1),'blood',1]
}}
const MAXR=6; // rigs on stage at once: 2 fighters, referee, up to 3 extras (entourage, presenter, coach)

/* ================= scene ================= */
function build(canvas){
  let renderer;
  try{renderer=new T.WebGLRenderer({canvas,antialias:!MOBILE,powerPreference:'high-performance',preserveDrawingBuffer:false})}catch(e){return null}
  if(!renderer.getContext())return null;
  renderer.setPixelRatio(Q.pr);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.physicallyCorrectLights=false;   // arena shadows are baked; only the fighters cast a live shadow from the key light
  renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  renderer.info.autoReset=true;
  const scene=new T.Scene();scene.background=new T.Color(0x07080c);scene.fog=new T.Fog(0x07080c,900,2600);
  const camera=new T.PerspectiveCamera(38,16/9,5,5000);camera.position.set(400,160,520);
  scene.add(new T.HemisphereLight(0xb9c6dc,0x2a2420,.42));
  /* key: overhead octagon rig, the only shadow caster (tight frustum that follows the action) */
  const key=new T.DirectionalLight(0xfff0dc,1.0);key.position.set(400+140,720,180);key.target.position.set(400,0,0);scene.add(key);scene.add(key.target);
  key.castShadow=true;key.shadow.mapSize.set(MOBILE?1024:2048,MOBILE?1024:2048);const sc=key.shadow.camera;sc.left=-260;sc.right=260;sc.top=260;sc.bottom=-260;sc.near=300;sc.far=1200;key.shadow.bias=-.0006;key.shadow.normalBias=1.2;key.shadow.radius=4;
  /* cool rim + warm fill for a broadcast look, and an overhead spot for the floor sheen */
  const rim=new T.DirectionalLight(0x8fb4ff,.75);rim.position.set(-520,320,-620);scene.add(rim);
  const fill=new T.DirectionalLight(0xffc89a,.28);fill.position.set(-300,180,700);scene.add(fill);
  const spot=new T.SpotLight(0xfff4e2,.55,1600,Math.PI/5.2,.55,1.2);spot.position.set(400,900,0);spot.target.position.set(400,0,0);scene.add(spot);scene.add(spot.target);
  /* image-based reflections: a tiny lightbox scene baked once into a PMREM environment map */
  let envMap=null;try{const pm=new T.PMREMGenerator(renderer),es=new T.Scene();es.background=new T.Color(0x0a0c10);
    const box=new T.Mesh(new T.BoxGeometry(10,10,10),new T.MeshBasicMaterial({color:0x14171d,side:T.BackSide}));es.add(box);
    for(const [x,y,z,sx,sy,sz,c] of [[0,4.9,0,6,.1,6,0xfff1dc],[-4.9,1,0,.1,3,4,0x9fc0ff],[4.9,1.5,2,.1,2.5,3,0xffd2a0],[0,1,-4.9,5,1.2,.1,0xe8b33a]]){const m=new T.Mesh(new T.BoxGeometry(sx,sy,sz),new T.MeshBasicMaterial({color:c}));m.position.set(x,y,z);es.add(m)}
    envMap=pm.fromScene(es,.04).texture;pm.dispose()}catch(e){}
  scene.environment=null;
  const atlas=buildAtlas();
  const cage=new T.Group();scene.add(cage);
  /* floor + apron (baked, unlit) */
  const floorTex=tex(floorCanvas(false));
  const floorN=(()=>{const c=cnv(256,256,(g,w,h)=>{g.fillStyle='#808080';g.fillRect(0,0,w,h);for(let i=0;i<9000;i++){const v=Math.random()*255|0;g.fillStyle=`rgba(${v},${v},${v},.08)`;g.fillRect(Math.random()*w,Math.random()*h,2,2)}for(let y=0;y<h;y+=3){g.fillStyle='rgba(0,0,0,.05)';g.fillRect(0,y,w,1)}});const t=tex(normalFromHeight(c,1.4),false);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(10,10);return t})();
  const floor=new T.Mesh(new T.CircleGeometry(CR+12,8,Math.PI/8),new T.MeshStandardMaterial({map:floorTex,roughness:.58,metalness:0,normalMap:floorN,normalScale:new T.Vector2(.35,.35),envMap,envMapIntensity:.35}));floor.rotation.x=-Math.PI/2;floor.position.y=0;floor.receiveShadow=true;cage.add(floor);
  // canvas UVs of CircleGeometry map center→(.5,.5); rotate to align octagon
  const apron=new T.Mesh(new T.CircleGeometry(2200,40),new T.MeshBasicMaterial({map:tex(apronCanvas())}));apron.rotation.x=-Math.PI/2;apron.position.y=-6;cage.add(apron);
  /* cage: posts+rails+post pads merged (atlas) = 1 draw call; ad pads merged = 1 draw call */
  const V=[];for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8;V.push(new T.Vector3(Math.cos(a)*CR,0,Math.sin(a)*CR))}
  const metal=[],pads=[];const panels=[];
  const chain=tex(chainCanvas());chain.wrapS=chain.wrapT=T.RepeatWrapping;
  for(let i=0;i<8;i++){
    const a=V[i],b=V[(i+1)%8],len=a.distanceTo(b),mid=a.clone().add(b).multiplyScalar(.5),ry=-Math.atan2(b.z-a.z,b.x-a.x);
    pads.push({g:new T.BoxGeometry(len,30,5),m:M4(mid.x,15,mid.z,0,ry,0),uv:{u0:0,u1:1,...atlas.row(i)}});
    metal.push({g:new T.CylinderGeometry(3.5,3.5,len,6),m:new T.Matrix4().makeTranslation(mid.x,242,mid.z).multiply(new T.Matrix4().makeRotationY(ry)).multiply(new T.Matrix4().makeRotationZ(Math.PI/2)),uv:{u0:0,u1:1,...atlas.row(12)}});
    metal.push({g:new T.CylinderGeometry(6,6,246,8),m:M4(a.x,123,a.z),uv:{u0:0,u1:1,...atlas.row(12)}});
    metal.push({g:new T.BoxGeometry(16,100,16),m:M4(a.x,125,a.z),uv:{u0:0,u1:1,...atlas.row(13)}});
    const t=chain.clone();t.needsUpdate=true;t.repeat.set(len/12,210/12);
    const pm=new T.MeshStandardMaterial({map:t,transparent:true,alphaTest:.25,side:T.DoubleSide,color:0xd4dbe6,metalness:.85,roughness:.32,envMap,envMapIntensity:1.1,depthWrite:false});
    const p=new T.Mesh(new T.PlaneGeometry(len,210),pm);p.position.set(mid.x,135,mid.z);p.rotation.y=ry;cage.add(p);panels.push({mesh:p,mat:pm,mid});
  }
  const atlasMat=new T.MeshStandardMaterial({map:atlas.tex,metalness:.55,roughness:.38,envMap,envMapIntensity:.9});
  const metalMesh=new T.LOD();{const hi=new T.Mesh(mergeGeos(metal),atlasMat);const lo=new T.Mesh(mergeGeos(metal.map(x=>({...x,g:x.g.type==='CylinderGeometry'?new T.CylinderGeometry(x.g.parameters.radiusTop,x.g.parameters.radiusBottom,x.g.parameters.height,4):x.g}))),atlasMat);metalMesh.addLevel(hi,0);metalMesh.addLevel(lo,1500);cage.add(metalMesh)}
  const padMesh=new T.Mesh(mergeGeos(pads),new T.MeshBasicMaterial({map:atlas.tex}));cage.add(padMesh);
  const fence=[metalMesh,padMesh,...panels.map(p=>p.mesh)];
  /* LED barrier ring between cage and crowd (atlas) — also the occluder for crowd culling */
  {const segs=[],n=24;for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2,am=(a0+a1)/2,len=2*RB*Math.sin(Math.PI/n);
    segs.push({g:new T.PlaneGeometry(len,HB),m:M4(Math.cos(am)*RB,HB/2,Math.sin(am)*RB,0,-am-Math.PI/2,0),uv:{u0:(i%3)/3,u1:(i%3+1)/3,...atlas.row(8+i%4)}});
    segs.push({g:new T.PlaneGeometry(len,HB+6),m:M4(Math.cos(am)*(RB+4),HB/2,Math.sin(am)*(RB+4),0,-am+Math.PI/2,0),uv:{u0:0,u1:1,...atlas.row(14)}})}
    cage.add(new T.Mesh(mergeGeos(segs),new T.MeshBasicMaterial({map:atlas.tex,side:T.DoubleSide})))}
  /* truss, lamps (instanced) and jumbotron */
  const truss=new T.Mesh(new T.TorusGeometry(420,6,6,40),new T.MeshLambertMaterial({color:0x1b1f27}));truss.rotation.x=Math.PI/2;truss.position.y=640;cage.add(truss);
  {const lamps=new T.InstancedMesh(sph(10,8,6),new T.MeshBasicMaterial({color:0xfff6e0}),12);for(let i=0;i<12;i++){const a=i/12*Math.PI*2;lamps.setMatrixAt(i,M4(Math.cos(a)*420,632,Math.sin(a)*420))}cage.add(lamps)}
  const jumboC=cnv(512,256,()=>{});const jumboT=tex(jumboC);
  const jumbo=new T.Mesh(new T.CylinderGeometry(130,130,90,4,1,true),new T.MeshBasicMaterial({map:jumboT,side:T.DoubleSide}));jumbo.position.y=560;jumbo.rotation.y=Math.PI/4;cage.add(jumbo);
  /* light cones (additive, merged) */
  {const cones=[];for(let i=0;i<4;i++){const a=i/4*Math.PI*2+.4;cones.push({g:new T.ConeGeometry(150,620,16,1,true),m:M4(Math.cos(a)*120,320,Math.sin(a)*120,0,0,0)})}
    const cm=new T.Mesh(mergeGeos(cones),new T.MeshBasicMaterial({color:0xfff0d0,transparent:true,opacity:.045,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));cage.add(cm)}
  /* crowd: 8 sectors × (hi, lo) instanced; rows ordered back→front so occlusion trims a suffix */
  const sectors=[];const cols=[0x2a2f3a,0x3a2f2a,0x2d3a33,0x3a3a44,0x46392c,0x2c3442,0x4a2f35,0x353535,0x23314a,0x40303a],skins=[0xd9a47e,0xb47a52,0xe8c4a4,0x7a4c30,0xe2b48c];
  const tiers=MOBILE?7:9,NS=8,AISLE=Math.PI*.82;
  const bodyHi=new T.BoxGeometry(14,24,10),headHi=sph(6.5,8,6),bodyLo=new T.BoxGeometry(14,24,10),headLo=new T.OctahedronGeometry(6.5,0);
  const crowdMat=new T.MeshBasicMaterial({color:0xffffff});
  for(let s=0;s<NS;s++){
    const a0=s/NS*Math.PI*2,a1=(s+1)/NS*Math.PI*2,seats=[];
    for(let t=tiers-1;t>=0;t--){const r=540+t*44,y=t*26+8,cnt=Math.floor((a1-a0)*r/(MOBILE?28:23));for(let i=0;i<cnt;i++){const a=a0+(i+.5)/cnt*(a1-a0);
      let da=Math.abs(((a-AISLE+Math.PI*3)%(Math.PI*2))-Math.PI);if(da<.13)continue; // walkout aisle gap
      seats.push({x:Math.cos(a)*r,z:Math.sin(a)*r,y,a,t,ph:Math.random()*6.28})}}
    const mk=(bg,hg)=>{const b=new T.InstancedMesh(bg,crowdMat,seats.length),h=new T.InstancedMesh(hg,crowdMat,seats.length);b.frustumCulled=h.frustumCulled=false;cage.add(b);cage.add(h);return{b,h}};
    const hi=mk(bodyHi,headHi),lo=mk(bodyLo,headLo),c=new T.Color();
    const tierStart=[];let k=0;for(let t=tiers-1;t>=0;t--){tierStart[t]=seats.findIndex(x=>x.t===t)}
    seats.forEach((st,i)=>{const lit=.32+.5*(1-st.t/tiers)*.5+Math.random()*.18; // baked: front rows catch more cage light
      c.setHex(cols[(i*7+s)%cols.length]).convertSRGBToLinear().multiplyScalar(lit);hi.b.setColorAt(i,c);lo.b.setColorAt(i,c);
      c.setHex(skins[(i*3+s)%skins.length]).convertSRGBToLinear().multiplyScalar(lit*.75);hi.h.setColorAt(i,c);lo.h.setColorAt(i,c)});
    const am=(a0+a1)/2,cen=new T.Vector3(Math.cos(am)*700,110,Math.sin(am)*700);
    const sec={seats,hi,lo,tierStart,sphere:new T.Sphere(cen,560),am,count:seats.length};sectors.push(sec);placeCrowd(sec,0,false);
  }
  /* pools: stains (instanced), camera flashes (instanced), blob shadows */
  const stainPool=new T.InstancedMesh(new T.CircleGeometry(1,10),new T.MeshBasicMaterial({color:0x6e080e,transparent:true,opacity:.75,depthWrite:false}),220);stainPool.count=0;stainPool.frustumCulled=false;cage.add(stainPool);
  const flashPool=new T.InstancedMesh(sph(2.6,6,4),new T.MeshBasicMaterial({color:0xffffff}),24);flashPool.count=0;flashPool.frustumCulled=false;cage.add(flashPool);
  const blobT=tex(blobCanvas(),false);const blobs=new T.InstancedMesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:blobT,transparent:true,depthWrite:false}),MAXR);blobs.frustumCulled=false;blobs.material.opacity=.55;scene.add(blobs);
  /* body parts: one InstancedMesh per part type and LOD level */
  const nmap=muscleNormal();
  const skin=new T.MeshPhysicalMaterial({roughness:.56,metalness:0,clearcoat:.18,clearcoatRoughness:.55,normalMap:nmap,normalScale:new T.Vector2(.6,.6),envMap,envMapIntensity:.35});
  /* skin shader: wrapped diffuse (light bleeds past the terminator like flesh), warm subsurface tint and a fresnel rim */
  skin.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
    float fr=pow(1.0-clamp(dot(normalize(vViewPosition)*-1.0,normal),0.0,1.0),2.6);
    gl_FragColor.rgb=gl_FragColor.rgb*vec3(1.0,0.93,0.88)+vec3(0.5,0.62,0.95)*fr*0.22;`)};
  const mats={skin,cloth:new T.MeshPhysicalMaterial({roughness:.72,sheen:new T.Color(0x666666),envMap,envMapIntensity:.25}),glove:new T.MeshPhysicalMaterial({roughness:.38,metalness:.05,clearcoat:.9,clearcoatRoughness:.22,envMap,envMapIntensity:.9}),
    hair:new T.MeshStandardMaterial({roughness:.75,envMap,envMapIntensity:.2}),eye:new T.MeshStandardMaterial({roughness:.12,envMap,envMapIntensity:.8}),pupil:new T.MeshStandardMaterial({roughness:.1,envMap}),blood:new T.MeshPhysicalMaterial({roughness:.2,clearcoat:1,envMap})};
  const specs=partSpecs(),parts={hi:{},lo:{}};
  for(const lv of ['hi','lo'])for(const [name,[fac,mk,per]] of Object.entries(specs)){
    const g=fac(lv==='hi');const im=new T.InstancedMesh(g,mats[mk],MAXR*per);im.frustumCulled=false;im.visible=lv==='hi';im.castShadow=lv==='hi';
    for(let i=0;i<MAXR*per;i++){im.setMatrixAt(i,ZERO);im.setColorAt(i,WHITE)}scene.add(im);parts[lv][name]={im,per,dirty:false}}
  const st={key,spot,renderer,scene,camera,cage,floor,floorTex,panels,sectors,tiers,stainPool,flashPool,blobs,parts,lvl:'hi',jumboC,jumboT,jumboKey:'',
    fence,rigs:new Map(),slots:new Array(MAXR).fill(null),camPos:new T.Vector3(400,260,900),camTgt:new T.Vector3(400,100,0),title:false,frustum:new T.Frustum(),stats:{calls:0,tris:0,fps:60,culled:0},q:0};
  return st;
}
const ZERO=new T.Matrix4().makeScale(0,0,0),WHITE=new T.Color(1,1,1);
const _q=new T.Quaternion(),_e=new T.Euler(),_v=new T.Vector3(),_s=new T.Vector3(),_one=new T.Vector3(1,1,1);
function placeCrowd(sec,frame,hype){
  const {seats,hi,lo}=sec;
  for(let i=0;i<seats.length;i++){const s=seats[i];const j=hype?Math.max(0,Math.sin(frame*.25+s.ph))*7:0;_e.set(0,-s.a-Math.PI/2,0);_q.setFromEuler(_e);
    _m.compose(_v.set(s.x,s.y+12+j,s.z),_q,_one);hi.b.setMatrixAt(i,_m);lo.b.setMatrixAt(i,_m);_m.compose(_v.set(s.x,s.y+30+j,s.z),_q,_one);hi.h.setMatrixAt(i,_m);lo.h.setMatrixAt(i,_m)}
  for(const o of [hi.b,hi.h,lo.b,lo.h])o.instanceMatrix.needsUpdate=true}

/* ================= rigs (slots into the instanced part buffers) ================= */
function rigColors(look,corner,kind,o={}){
  const ref=kind==='ref',staff=kind==='staff';
  const skin=LC(look.skin||'#d9a47e');
  return{skin,skinD:skin.clone().multiplyScalar(.86),
    top:ref?LC(0x15161a):staff?LC(o.shirt||'#1d2a44'):skin,topD:ref?LC(0x101114):staff?LC(o.shirt||'#1d2a44').multiplyScalar(.85):skin.clone().multiplyScalar(.86),
    leg:(ref||staff)?LC(o.pants||0x2f333b):skin,legD:(ref||staff)?LC(o.pants||0x2f333b).multiplyScalar(.85):skin.clone().multiplyScalar(.86),
    trunk:(ref||staff)?LC(o.pants||0x1d1d20):LC(look.trunk||'#333'),corner:LC(corner||'#888'),glove:(ref||staff)?skin:LC(0x15161a),
    hair:LC(look.hair||'#222'),eye:LC(0xf3eee6),pupil:LC(0x24160f),blood:LC(0x8a0d16),shoe:(ref||staff)?LC(0x111111):skin,
    hairStyle:look.hairStyle||'short',beard:!!look.beard,kind}}
function getSlot(st,key,look,corner,kind,o){
  let r=st.rigs.get(key);
  if(r&&r.look!==look){st.slots[r.slot]=null;st.rigs.delete(key);r=null}
  if(!r){const slot=st.slots.indexOf(null);if(slot<0)return null;r={slot,look,c:rigColors(look,corner,kind,o),kind};st.slots[slot]=key;st.rigs.set(key,r)}
  r.used=true;return r}
function freeUnused(st){for(const [k,r] of st.rigs){if(!r.used){hideSlot(st,r.slot);st.slots[r.slot]=null;st.rigs.delete(k)}r.used=false}}
function hideSlot(st,slot){for(const lv of ['hi','lo'])for(const p of Object.values(st.parts[lv])){for(let j=0;j<p.per;j++)p.im.setMatrixAt(slot*p.per+j,ZERO);p.dirty=true}}
/* writers */
const UP=new T.Vector3(0,1,0),XA=new T.Vector3(1,0,0),tv=new T.Vector3();
function W(P,name,idx,m,col){const p=P[name];p.im.setMatrixAt(idx,m);if(col)p.im.setColorAt(idx,col);p.dirty=true}
function seg(P,name,idx,a,b,sx,sz,col,base=true){tv.subVectors(b,a);const L=tv.length()||.01;_v.copy(a);if(!base)_v.addScaledVector(tv,.5);_q.setFromUnitVectors(UP,tv.multiplyScalar(1/L));_m.compose(_v,_q,_s.set(sx,L,sz));W(P,name,idx,_m,col)}
function ball(P,name,idx,p,sx,sy,sz,col,q){_m.compose(p,q||_q.identity(),_s.set(sx,sy,sz));W(P,name,idx,_m,col)}
function rot2(p,c,a){const s=Math.sin(a),co=Math.cos(a),x=p.x-c.x,y=p.y-c.y;return{x:c.x+x*co-y*s,y:c.y+x*s+y*co}}
const tint=new T.Color(),tint2=new T.Color();
/* frame: maps the 2D pose plane into world.  fx=origin x in pose space; o:world origin; dir: world axis for pose +x; z offsets go along perp */
function poseRig(st,r,J,frame,F,o={}){
  const P=st.parts[st.lvl],s=r.slot,c=r.c,ref=c.kind!=='fighter';
  let j=J;if(o.ko){const piv=o.ko.p,a=o.ko.a;const n={};for(const k in j){const v=j[k];n[k]=v&&typeof v==='object'&&'x' in v?rot2(v,piv,a):v}n.hAng=j.hAng+a;j=n}
  const {ox,origin,dir,perp}=frame;
  const P3=(p,dz)=>new T.Vector3(origin.x+dir.x*(p.x-ox)+perp.x*dz,GY-p.y,origin.z+dir.z*(p.x-ox)+perp.z*dz);
  const f=j.f,arm=o.arm??13,legS=o.leg??8.5,mir=o.mirror?-1:1; // southpaw stance mirrors which side is lead
  const hip=P3(j.hip,0),chest=P3(j.chest,0),sd=chest.clone().sub(hip).normalize();
  const fw2=new T.Vector3(sd.y*dir.x,-sd.x,sd.y*dir.z).multiplyScalar(f); // forward in world (approx)
  const base=hip.clone().addScaledVector(sd,2),neckB=chest.clone().addScaledVector(sd,6);
  // skin tint: bruising + hit flash
  tint.copy(c.skin);if(F&&!ref){const hd=clamp((65-(F.head??100))/65,0,1);tint.lerp(LC(0x9a4a5a),hd*.35);if(F.flash>0)tint.lerp(LC(0xffd0b0),.35)}
  tint2.copy(tint).multiplyScalar(.86);
  const top=ref?c.top:tint,topD=ref?c.topD:tint2;
  seg(P,'torso',s,base,neckB,.68*1.0,.62,top);
  if(!ref){for(let i=0;i<2;i++){const z=i?1:-1;_v.copy(chest).addScaledVector(sd,-9).addScaledVector(fw2,8.6);_v.addScaledVector(perp,z*6.6);ball(P,'pec',s*2+i,_v,.62,.82,1,tint)}
    _v.copy(hip).addScaledVector(sd,20).addScaledVector(fw2,6.6);ball(P,'abs',s,_v,.5,1.3,.95,tint);
    _v.copy(chest).addScaledVector(sd,-2).addScaledVector(fw2,-3);_q.setFromUnitVectors(UP,sd);ball(P,'traps',s,_v,.9,.55,1.7,tint,_q)}
  else{for(let i=0;i<2;i++)W(P,'pec',s*2+i,ZERO);W(P,'abs',s,ZERO);W(P,'traps',s,ZERO)}
  seg(P,'pelvis',s,hip.clone().addScaledVector(sd,-10),hip.clone().addScaledVector(sd,7),.86,1.1,c.trunk,false);
  seg(P,'band',s,hip.clone().addScaledVector(sd,6),hip.clone().addScaledVector(sd,9.5),.88,1.12,ref?c.trunk:c.corner,false);
  const head=P3(j.head,0);
  seg(P,'neck',s,chest.clone().addScaledVector(sd,-2),head.clone().addScaledVector(sd,-6),1,1,tint);
  // head frame: yaw toward facing along dir, roll by head angle
  const yaw=Math.atan2(-dir.z*f,dir.x*f);_e.set(0,yaw,0);_q.setFromEuler(_e);const qr=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-(j.hAng||0)*1);_q.multiply(qr);
  _m.compose(head,_q,_one);const Mh=_m.clone();
  W(P,'head',s,Mh,tint);W(P,'eyes',s,Mh,c.eye);W(P,'pupil',s,Mh,c.pupil);W(P,'brow',s,Mh,c.hair);W(P,'mouth',s,Mh,LC(0x5a2e24));
  const hs=c.hairStyle;W(P,'hcap',s,hs==='short'||hs==='buzz'||hs==='crop'||hs==='fade'?Mh:ZERO,c.hair);W(P,'hbun',s,hs==='bun'?Mh:ZERO,c.hair);W(P,'hmo',s,hs==='mohawk'?Mh:ZERO,c.hair);W(P,'hlong',s,hs==='long'?Mh:ZERO,c.hair);
  W(P,'beard',s,c.beard?Mh:ZERO,c.hair);
  const cuts=F&&!ref&&(F.head??100)<75?Math.min(3,F.cuts|0):0;W(P,'cut',s,cuts>=1?Mh:ZERO,c.blood);W(P,'blood',s,cuts>0&&(F.head??100)<55?Mh:ZERO,c.blood);
  for(let i=0;i<2;i++){const sN=i===0,sg=(sN?1:-1)*mir,k=s*2+i;
    const K=sN?'N':'F',col=sN?top:topD,sk=sN?tint:tint2,lg=ref?(sN?c.leg:c.legD):(sN?tint:tint2);
    const sh=P3(j['sh'+K],sg*arm),el=P3(j['elb'+K],sg*(arm-1)),hd=P3(j['hand'+K],sg*(arm-4));(r.hands=r.hands||[])[i]=hd;
    ball(P,'delt',k,sh,1,.95,1.05,col);seg(P,'uarm',k,sh,el,1,1,col);ball(P,'elbow',k,el,1,1,1,sk);seg(P,'farm',k,el,hd,1,1,sk);
    const dv=hd.clone().sub(el).normalize();_v.copy(hd).addScaledVector(dv,4.5);_q.setFromUnitVectors(XA,dv);ball(P,'glove',k,_v,1.25,1,1.02,c.glove,_q);
    seg(P,'cuff',k,hd.clone().addScaledVector(dv,-3.5),hd.clone().addScaledVector(dv,1),1,1,ref?c.glove:c.corner,false);
    const hp=P3(j['hip'+K],sg*legS),kn=P3(j['knee'+K],sg*legS),ft=P3(j['foot'+K],sg*legS);
    seg(P,'thigh',k,hp,kn,1,1,lg);ball(P,'knee',k,kn,1,1,1,lg);seg(P,'shin',k,kn,ft,1,1,lg);ball(P,'ankle',k,ft,1,1,1,sk);
    const fd=(sN?j.footDirN:j.footDirF)||f;_e.set(0,Math.atan2(-dir.z*fd,dir.x*fd),0);_q.setFromEuler(_e);_m.compose(_v.set(ft.x,ft.y-1.5,ft.z),_q,_one);W(P,'foot',k,_m,c.shoe);
    if(!ref)seg(P,'short',k,hp.clone().addScaledVector(sd,3),hp.clone().lerp(kn,.48),1,1,c.trunk,false);else W(P,'short',k,ZERO);
  }
  // pooled blob shadow
  _m.compose(_v.set(hip.x,1.2,hip.z),_q.identity(),_s.set(70,1,46));st.blobs.setMatrixAt(s,_m);st.blobs.instanceMatrix.needsUpdate=true;
}
function flush(st){for(const lv of ['hi','lo'])for(const p of Object.values(st.parts[lv]))if(p.dirty){p.im.instanceMatrix.needsUpdate=true;if(p.im.instanceColor)p.im.instanceColor.needsUpdate=true;p.dirty=false}}
function setLevel(st,lv){if(st.lvl===lv)return;for(const p of Object.values(st.parts[st.lvl]))p.im.visible=false;st.lvl=lv;for(const p of Object.values(st.parts[lv]))p.im.visible=true}
const FIGHT_FRAME=(z)=>({ox:0,origin:{x:0,z},dir:{x:1,z:0},perp:{x:0,z:1}});

/* ================= per-frame systems ================= */
function syncCage(st,S){
  const C=S.cage||{x:400,z:0,ang:0};st.cage.position.set(C.x,0,C.z);st.cage.rotation.y=-C.ang;
  if(st.title!==!!S.title){st.title=!!S.title;st.floor.material.map=tex(floorCanvas(st.title));st.floor.material.needsUpdate=true}
  // stains → pooled instances (no allocation per stain)
  const ss=S.stains||[],P=st.stainPool;let n=0;
  for(const s of ss){if(s.lx===undefined)continue;_e.set(-Math.PI/2,0,0);_q.setFromEuler(_e);_m.compose(_v.set(s.lx,.6,s.lz),_q,_s.set(s.r*1.8,s.r*1.1,1));P.setMatrixAt(n++,_m);if(n>=220)break}
  if(P.count!==n||n){P.count=n;P.instanceMatrix.needsUpdate=true}
}
function jumbo(st,S){
  const key=(S.a&&S.a.nick||'')+'|'+(S.b&&S.b.nick||'')+'|'+(S.round||0)+'|'+(S.mode==='ko'?'ko':'');if(st.jumboKey===key)return;st.jumboKey=key;
  const g=st.jumboC.getContext('2d'),w=512,h=256;g.fillStyle='#05070b';g.fillRect(0,0,w,h);
  g.fillStyle='#e8b33a';g.font='bold 40px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(S.mode==='ko'?'K.O.!':'IRON CAGE',w/2,60);
  g.fillStyle='#7fb2ff';g.font='bold 30px sans-serif';g.fillText((S.a&&S.a.nick)||'',w*.28,150);g.fillStyle='#ff8b7f';g.fillText((S.b&&S.b.nick)||'',w*.72,150);
  g.fillStyle='#fff';g.font='bold 26px sans-serif';g.fillText('VS',w/2,150);g.fillStyle='rgba(255,255,255,.6)';g.font='20px sans-serif';g.fillText(S.round?`ROUND ${S.round}`:'',w/2,212);
  st.jumboT.needsUpdate=true}
function fadeFence(st){
  const cp=st.camera.position,tg=st.camTgt,dT=cp.distanceTo(tg);
  for(const p of st.panels){p.mesh.getWorldPosition(_v);const d=cp.distanceTo(_v);const front=d<dT*.98;p.mat.opacity=front?.16:1;p.mat.alphaTest=front?.04:.25}
}
/* crowd: frustum culling per sector + occlusion culling by the LED barrier + LOD by distance */
const _cp=new T.Vector3(),_sc=new T.Vector3(),_pm=new T.Matrix4();
function crowd(st,S){
  const cam=st.camera;_pm.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);st.frustum.setFromProjectionMatrix(_pm);
  // camera in cage-local space
  st.cage.updateMatrixWorld();const inv=_m.copy(st.cage.matrixWorld).invert();_cp.copy(cam.position).applyMatrix4(inv);
  const hype=S.mode==='ko'||S.mode==='outro'||S.slow>0||S.replay||(S.walk&&S.walk.hype>.5)||(S.cine&&S.cine.hype);
  let culled=0;
  for(const sec of st.sectors){
    _sc.copy(sec.sphere.center).applyMatrix4(st.cage.matrixWorld);
    const inView=st.frustum.intersectsSphere(new T.Sphere(_sc,sec.sphere.radius));
    // occlusion: rows whose heads sit below the sight line over the barrier are hidden behind it
    let visibleCount=sec.count;
    if(inView){const ax=Math.cos(sec.am),az=Math.sin(sec.am);const cr=_cp.x*ax+_cp.z*az,ch=_cp.y;
      for(let t=0;t<st.tiers;t++){const r=540+t*44,y=t*26+8+40;
        // sight line from camera radius cr (height ch) to seat radius r (height y); height where it crosses RB
        if(cr<RB&&r>RB){const k=(RB-cr)/(r-cr),hAt=ch+(y-ch)*k;if(hAt<HB){visibleCount=sec.tierStart[t]>=0?sec.tierStart[t]:visibleCount;continue}}
        break}}
    const lvl=_sc.distanceTo(cam.position)<1100?'hi':'lo';
    for(const L of ['hi','lo']){const set=sec[L],on=inView&&L===lvl&&visibleCount>0;set.b.visible=set.h.visible=on;if(on){set.b.count=set.h.count=visibleCount}}
    if(!inView)culled+=sec.count;else culled+=sec.count-visibleCount;
    if(hype&&inView&&S.frame%3===0)placeCrowd(sec,S.frame,true);else if(!hype&&sec.jumping){placeCrowd(sec,0,false)}
    sec.jumping=hype&&inView;
  }
  st.stats.culled=culled;
  // pooled camera flashes
  const P=st.flashPool;let n=0;const rate=hype?.5:.08;
  for(let i=0;i<24;i++){if(Math.random()<rate){const sec=st.sectors[(Math.random()*st.sectors.length)|0],s=sec.seats[(Math.random()*sec.seats.length)|0];if(!s)continue;_m.compose(_v.set(s.x,s.y+38,s.z),_q.identity(),_one);P.setMatrixAt(n++,_m)}}
  P.count=n;P.instanceMatrix.needsUpdate=true;
}
function fitDist(cam,aspect,wNeed,hNeed){const vf=cam.fov*Math.PI/180,hf=2*Math.atan(Math.tan(vf/2)*aspect);return Math.max((wNeed/2)/Math.tan(hf/2),(hNeed/2)/Math.tan(vf/2))}
function camera(st,S,aspect){
  const a=S.a,b=S.b,mx=(a.x+b.x)/2,mz=((a.z||0)+(b.z||0))/2,sep=Math.hypot(a.x-b.x,((a.z||0)-(b.z||0)));
  st.sep=st.sep==null?sep:lerp(st.sep,sep,.04);
  const cam=st.camera,fit=(w,h)=>fitDist(cam,aspect,w,h);
  let tx=mx,ty=100,tz=mz,dist=fit(st.sep+170,270),orb=.12,lift=.14,k=.07;
  if(S.cl){tx=S.cl.cx;tz=S.cl.cz||0;dist=fit(190,250)}
  if(S.gr){tx=S.gr.cx;tz=S.gr.cz||0;ty=42;dist=fit(250,160);lift=.45;orb=.22}
  if(S.mode==='intro'&&!S.walk){const p=clamp(1-S.phaseT/(S.introLen||110),0,1),e=p*p*(3-2*p);dist=lerp(dist*2.2,dist,e);lift=lerp(.45,lift,e);orb=lerp(-.7,orb,e);k=.2}
  if(S.walk&&S.walk.k==='coach'){const a=S.a;tx=a.x-40;tz=(a.z||0);ty=118;dist=fit(240,230);orb=-.95;lift=.08;k=.07}
  else if(S.walk){const kk=S.walk.k||'';if(/faceoff|touch/.test(kk)){tx=(a.x+b.x)/2;ty=125;dist=fit(200,190);orb=.05;lift=.05;k=.08}else if(/Ann/.test(kk)){const F=/^blue/.test(kk)?a:b;tx=F.x;tz=F.z||0;ty=120;dist=fit(150,210);orb=F===a?-.25:.25;lift=.08;k=.07}else{dist=fit(560,320);lift=.2;orb=.1}}
  if(S.mode==='ko'||S.replay){const L=S.camFocus==='a'?a:b;tx=S.gr?S.gr.cx:L.x;tz=S.gr?(S.gr.cz||0):(L.z||0);ty=S.gr?32:62;dist=fit(220,180)*(S.replay?.85:1);lift=S.replay?.12:.3;orb=S.replay?lerp(-.6,.6,S.rpProg||0):.25;k=S.replay?.1:.05}
  if(S.mode==='outro'){const Wn=S.winSide==='a'?a:S.winSide==='b'?b:null;tx=Wn?Wn.x:400;tz=Wn?(Wn.z||0):0;ty=118;dist=fit(240,270);orb=.2+Math.sin(S.frame*.01)*.3}
  if(S.mode==='decision'){tx=400;dist=fit(420,300)}
  const mk=o=>new T.Vector3(tx+Math.sin(o)*dist*Math.cos(lift),ty+Math.sin(lift)*dist,tz+Math.cos(o)*dist*Math.cos(lift));
  // keep a cage post from standing in the middle of the shot: steer the orbit toward the nearest fence panel centre
  const C=S.cage||{x:400,z:0,ang:0};let want=mk(orb);
  const blocker=w=>{const dx=tx-w.x,dz=tz-w.z,dl=Math.hypot(dx,dz)||1;let worst=0,sg=0;
    for(let k=0;k<8;k++){const pa=(C.ang||0)+Math.PI/8+k*Math.PI/4,px=C.x+Math.cos(pa)*CR-w.x,pz=(C.z||0)+Math.sin(pa)*CR-w.z,pl=Math.hypot(px,pz);if(pl>dl)continue;
      const cr=(dx*pz-dz*px)/(dl*pl),off=Math.abs(cr)*pl; // lateral distance of post from the sight line
      if(off<70&&70-off>worst){worst=70-off;sg=Math.sign(cr)||1}}return sg*worst};
  for(let it=0;it<6;it++){const bl=blocker(want);if(!bl)break;orb+=Math.sign(bl)*.06;want=mk(orb)}
  st.camPos.lerp(want,k);st.camTgt.lerp(_v.set(tx,ty,tz),k*1.5);
  cam.position.copy(st.camPos);
  if(S.shake>.5){cam.position.x+=(Math.random()-.5)*S.shake*.45;cam.position.y+=(Math.random()-.5)*S.shake*.45}
  cam.lookAt(st.camTgt);
}
/* walkout aisle: fighter + entourage walk from the tunnel through the crowd to the cage door */
const AISLE_A=Math.PI*.82;
function aislePoint(st,t){ // t 0..1 in cage-local, returned in world
  const r=lerp(1050,CR+40,t);_v.set(Math.cos(AISLE_A)*r,0,Math.sin(AISLE_A)*r);st.cage.updateMatrixWorld();return _v.clone().applyMatrix4(st.cage.matrixWorld)}
function walkAisle(st,S,rig){
  const W=S.walk,kk=W.k,F=/^blue/.test(kk)?S.a:S.b,t=clamp((W.ax-(-300))/(600-(-300)),0,1);
  const p=aislePoint(st,t),p2=aislePoint(st,Math.min(1,t+.02)),dir=p2.clone().sub(p).setY(0).normalize();if(dir.lengthSq()<.5)dir.set(1,0,0);
  const perp=new T.Vector3(-dir.z,0,dir.x);
  const r=getSlot(st,'f'+F.side,F.look,F.corner,'fighter');if(r){const fx={...F,x:0,z:0,f:1,state:F.state==='celebrate'?'celebrate':'walk',A:null,stun:0};
    const J=rig.solve(rig.poseStand(fx,{...fx,x:200},S));poseRig(st,r,J,{ox:0,origin:p,dir,perp},F)}
  // entourage
  const crew=[['coach','#1f3a6e',-60,-26],['team','#1f3a6e',-95,24],['sec','#111317',40,-46]];
  crew.forEach(([k,sh,back,side],i)=>{const rr=getSlot(st,'crew'+i,{skin:['#e0b08a','#a87250','#c99472'][i],hair:'#2a1f1a',hairStyle:'short'},'#888','staff',{shirt:sh,pants:'#2a2d34'});if(!rr)return;
    const q=p.clone().addScaledVector(dir,back).addScaledVector(perp,side);const J=rig.solve(rig.poseRef({x:0,f:1,moving:true,walk:S.frame*.2+i,state:'idle'},S));poseRig(st,rr,J,{ox:0,origin:q,dir,perp},null,{arm:12,leg:8})});
  // tracking camera in front of the walkers
  const cam=st.camera,want=p.clone().addScaledVector(dir,420).addScaledVector(perp,120);want.y=250;
  st.camPos.lerp(want,.08);st.camTgt.lerp(_v.set(p.x,110,p.z).addScaledVector(dir,-20),.12);cam.position.copy(st.camPos);cam.lookAt(st.camTgt);
}

/* ================= main render ================= */
function render(S0,w,h){
  const st=R;if(!st)return;
  const now=performance.now();if(st.lastT){const dt=now-st.lastT;st.avg=st.avg==null?dt:st.avg*.95+dt*.05;st.stats.fps=Math.round(1000/(st.avg||16));st.n=(st.n||0)+1;
    if(st.n>120&&st.avg>28&&st.q<2){st.q++;st.n=0;st.avg=null;Q.pr=Math.max(.65,Q.pr*.75);st.renderer.setPixelRatio(Q.pr);st.w=0}}
  st.lastT=now;
  const S=S0.mode==='replay'&&S0.rp?IC.Fight.replayView():S0;
  const rig=IC.Draw.rig;
  if(st.w!==w||st.h!==h){st.w=w;st.h=h;st.vo=false;st.camera.clearViewOffset();st.renderer.setSize(w,h,false);st.camera.aspect=w/h;st.camera.fov=w/h<1?52:36;st.camera.updateProjectionMatrix()}
  syncCage(st,S);jumbo(st,S);
  for(const r of st.rigs.values())r.used=false;
  // LOD for bodies: distance from camera to the action
  const ax=(S.a.x+S.b.x)/2,az=((S.a.z||0)+(S.b.z||0))/2;setLevel(st,st.camera.position.distanceTo(_v.set(ax,90,az))<900?'hi':'lo');
  const inAisle=S.walk&&/Aisle$/.test(S.walk.k||'');
  setSet(st,S.cine?S.cine.set:null);st.props.stool.visible=false;
  const shift=S.mode==='between'&&!S.cine;if(shift!==!!st.vo){st.vo=shift;if(shift)st.camera.setViewOffset(w,h,w*.24,0,w,h);else st.camera.clearViewOffset()}
  if(S.cine){cineScene(st,S,rig,w/h)}
  else if(S.mode==='between'){cornerScene(st,S,rig,w/h)}
  else if(inAisle){walkAisle(st,S,rig)}
  else{
    if(S.ref){const rr=getSlot(st,'ref',{skin:'#e1b28e',hair:'#2b2b2b',hairStyle:'buzz'},'#888','ref');if(rr){const J=rig.solve(rig.poseRef(S.ref,S));poseRig(st,rr,J,FIGHT_FRAME(S.ref.z??-150),null,{arm:12,leg:8})}}
    if(S.gr){
      const {T:TJ,B:BJ}=rig.groundJ(S);const cz=S.gr.cz||0,pos=S.gr.pos;
      for(const [F,J] of [[S.gr.top,TJ],[S.gr.bot,BJ]]){F._t=S.frame;const top=F===S.gr.top;const r=getSlot(st,'f'+F.side,F.look,F.corner,'fighter');if(!r)continue;
        const o=top?{leg:pos===4?14:pos>=1?22:12,arm:15}:{leg:pos===0?22:10,arm:15};poseRig(st,r,rig.solve(J),FIGHT_FRAME(cz+(top?(pos===4?-4:0):(pos===4?4:0))),F,o)}
    }else{
      for(const F of [S.a,S.b]){if(F.hidden)continue;F._t=S.frame;const O=F===S.a?S.b:S.a;const J=rig.poseStand(F,O,S);const sol=rig.solve(J);
        let ko=null;if(F.state==='ko'){const a=Math.min(1,F.koT/22)*Math.PI/2*.94;ko={p:{x:F.x-F.f*22,y:GY-4},a:-F.f*a};sol.mood='ko'}
        const r=getSlot(st,'f'+F.side,F.look,F.corner,'fighter');if(r)poseRig(st,r,sol,FIGHT_FRAME(F.z||0),F,{ko,mirror:F.stance==='south'})}
    }
    if(S.walk&&S.walk.k==='coach')coachTalk(st,S,rig);
    camera(st,S,w/h);
  }
  {const cx=(S.a.x+S.b.x)/2,cz=((S.a.z||0)+(S.b.z||0))/2;st.key.target.position.set(cx,0,cz);st.key.position.set(cx+140,720,cz+180);st.key.target.updateMatrixWorld()}
  belt(st,S);confetti(st,S);
  freeUnused(st);flush(st);
  fadeFence(st);crowd(st,S);
  st.renderer.render(st.scene,st.camera);
  st.stats.calls=st.renderer.info.render.calls;st.stats.tris=st.renderer.info.render.triangles;
  if(DEBUG)debugHud(st);
}
let dbg=null;function debugHud(st){if(!dbg){dbg=document.createElement('div');dbg.style.cssText='position:fixed;left:6px;top:6px;z-index:99999;background:rgba(0,0,0,.7);color:#9fe0a8;font:11px monospace;padding:4px 6px;border-radius:4px;pointer-events:none';document.body.appendChild(dbg)}
  dbg.textContent=`FPS ${st.stats.fps} · draw calls ${st.stats.calls} · tris ${st.stats.tris} · LOD ${st.lvl} · culled seats ${st.stats.culled} · q${st.q}`}
/* ================= cinematic sets: title, belt ceremony, press conference, weigh-in, corner ================= */
function props(st){if(st.props)return st.props;const scene=st.scene,P={};
  const stage=new T.Group();stage.visible=false;scene.add(stage);P.stage=stage;
  const bd=cnv(1024,512,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#0d1018');gr.addColorStop(1,'#05060a');g.fillStyle=gr;g.fillRect(0,0,w,h);
    g.textAlign='center';g.textBaseline='middle';for(let y=0;y<4;y++)for(let x=0;x<5;x++){const cx=x*230+(y%2?115:0)+20,cy=70+y*120;g.fillStyle=(x+y)%2?'rgba(232,179,58,.85)':'rgba(220,226,236,.55)';g.font=(x+y)%2?'bold 34px sans-serif':'bold 22px sans-serif';g.fillText((x+y)%3===0?'IRON CAGE':(x+y)%3===1?'VOLTA':'NORTHPEAK',cx,cy)}
    const v=g.createRadialGradient(w/2,h*.45,40,w/2,h/2,w*.6);v.addColorStop(0,'rgba(255,240,210,.18)');v.addColorStop(1,'rgba(0,0,0,.55)');g.fillStyle=v;g.fillRect(0,0,w,h)});
  const back=new T.Mesh(new T.PlaneGeometry(900,360),new T.MeshBasicMaterial({map:tex(bd)}));back.position.set(400,180,-150);stage.add(back);
  const plat=new T.Mesh(new T.BoxGeometry(760,22,320),new T.MeshStandardMaterial({color:0x14171d,roughness:.6}));plat.position.set(400,-11,-10);stage.add(plat);
  const hall=new T.Mesh(new T.PlaneGeometry(4000,4000),new T.MeshBasicMaterial({color:0x07080b}));hall.rotation.x=-Math.PI/2;hall.position.y=-22;stage.add(hall);
  const tk=cnv(512,64,(g,w,h)=>{g.fillStyle='#0b0d12';g.fillRect(0,0,w,h);g.fillStyle='#e8b33a';g.font='bold 30px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('IRON CAGE · PRESS CONFERENCE',w/2,h/2+2)});
  const table=new T.Group();table.add(new T.Mesh(new T.BoxGeometry(420,8,90),new T.MeshStandardMaterial({color:0x22262e,roughness:.4})).translateY(92));
  {const sk=new T.Mesh(new T.PlaneGeometry(420,88),new T.MeshBasicMaterial({map:tex(tk)}));sk.position.set(0,48,46);table.add(sk)}
  for(const x of [-95,95]){const m=new T.Mesh(new T.CylinderGeometry(1.6,1.6,34,6),new T.MeshStandardMaterial({color:0x111111}));m.position.set(x,110,30);m.rotation.x=-.5;table.add(m);const hd=new T.Mesh(sph(4,8,6),new T.MeshStandardMaterial({color:0x222,roughness:.3}));hd.position.set(x,126,22);table.add(hd)}
  table.position.set(400,0,40);stage.add(table);P.table=table;
  const scale=new T.Group();const sm=new T.MeshStandardMaterial({color:0x9aa3b2,metalness:.7,roughness:.3});
  scale.add(new T.Mesh(new T.BoxGeometry(70,8,60),sm).translateY(4));scale.add(new T.Mesh(new T.BoxGeometry(6,110,6),sm).translateY(60).translateZ(-26));
  {const dc=cnv(128,64,(g,w,h)=>{g.fillStyle='#030';g.fillRect(0,0,w,h);g.fillStyle='#6fe3a1';g.font='bold 34px monospace';g.textAlign='center';g.textBaseline='middle';g.fillText('155.0',w/2,h/2)});P.scaleC=dc;P.scaleT=tex(dc);const d=new T.Mesh(new T.BoxGeometry(40,22,6),new T.MeshBasicMaterial({map:P.scaleT}));d.position.set(0,118,-26);scale.add(d)}
  scale.position.set(400,0,0);stage.add(scale);P.scale=scale;
  /* corner stool */
  const stool=new T.Group();const stm=new T.MeshStandardMaterial({color:0x1a1c22,roughness:.5});stool.add(new T.Mesh(new T.CylinderGeometry(20,20,5,14),stm).translateY(58));
  for(let i=0;i<4;i++){const a=i*Math.PI/2+.6,l=new T.Mesh(new T.CylinderGeometry(1.8,1.8,58,5),stm);l.position.set(Math.cos(a)*14,29,Math.sin(a)*14);stool.add(l)}
  stool.visible=false;scene.add(stool);P.stool=stool;
  /* championship belt: gold plate + leather strap (pooled, one instance) */
  const belt=new T.Group();const gold=new T.MeshStandardMaterial({color:0xe8b33a,metalness:.95,roughness:.22,emissive:0x2a1a00});
  const plate=new T.Mesh(new T.CylinderGeometry(15,15,3.5,20),gold);plate.rotation.x=Math.PI/2;belt.add(plate);
  for(const x of [-21,21]){const s=new T.Mesh(new T.CylinderGeometry(8,8,3,14),gold);s.rotation.x=Math.PI/2;s.position.x=x;belt.add(s)}
  const gem=new T.Mesh(sph(4,10,8),new T.MeshStandardMaterial({color:0xc0182a,metalness:.3,roughness:.15,emissive:0x300004}));gem.position.z=2.5;belt.add(gem);
  const strap=new T.Mesh(new T.BoxGeometry(1,9,2),new T.MeshStandardMaterial({color:0x111214,roughness:.55}));belt.add(strap);P.strap=strap;
  belt.visible=false;scene.add(belt);P.belt=belt;
  /* confetti pool */
  const cf=new T.InstancedMesh(new T.PlaneGeometry(4,2.4),new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide}),180);cf.count=0;cf.frustumCulled=false;scene.add(cf);P.cf=cf;
  const cols=[0xe8b33a,0xffffff,0xd23a3a,0x3d7ff0,0xffd75e],c=new T.Color();P.cfp=[];for(let i=0;i<180;i++){cf.setColorAt(i,c.setHex(cols[i%cols.length]));P.cfp.push({x:0,y:-999,z:0,vx:0,vy:0,r:Math.random()*6,s:.5+Math.random()})}
  st.props=P;return P}
function setSet(st,set){const P=props(st);if(st.curSet===set)return;st.curSet=set;
  const hall=set==='press'||set==='weigh';st.cage.visible=!hall;P.stage.visible=hall;P.table.visible=set==='press';P.scale.visible=set==='weigh';
  for(const m of st.fence)m.visible=true;st.scene.background.setHex(hall?0x050608:0x07080c);st.scene.fog.near=hall?1400:900}
function mockPose(rig,F,O,S){F._t=S.frame;return rig.solve(rig.poseStand(F,O,S))}
function poseSit(rig,F){const x=F.x,f=F.f,b=Math.sin((F._t||0)*.12)*2.5;
  return rig.solve({f,hip:{x,y:GY-64},chest:{x:x+f*2,y:GY-132+b},nearHand:{x:x+f*34,y:GY-66},farHand:{x:x+f*28,y:GY-62},nearFoot:{x:x+f*46,y:GY},farFoot:{x:x+f*40,y:GY},kneeN:'fwd',kneeF:'fwd',elbN:'down',elbF:'down',tilt:.08})}
function camTo(st,pos,tgt,k){st.camPos.lerp(pos,k);st.camTgt.lerp(tgt,k*1.4);st.camera.position.copy(st.camPos);st.camera.lookAt(st.camTgt)}
function cineScene(st,S,rig,aspect){
  const C=S.cine,t=C.t||0,a=S.a,b=S.b,P=st.props;
  if(C.set==='title'||C.set==='belt'){
    const F=a;F.x=400;F.z=0;F.f=1;
    if(C.set==='belt'){const r=getSlot(st,'fa',F.look,F.corner,'fighter');F.state=t<50?'idle':'celebrate';if(r)poseRig(st,r,mockPose(rig,F,b,S),FIGHT_FRAME(0),F,{arm:t<50?13:24});
      const e=Math.min(1,t/70),ez=e*e*(3-2*e),ang=lerp(.9,0,ez)+Math.sin(t*.01)*.12,dist=lerp(900,360,ez),hgt=lerp(330,175,ez);
      camTo(st,_v.set(400+Math.cos(ang)*dist,hgt,Math.sin(ang)*dist),new T.Vector3(400,lerp(90,150,ez),0),.12)}
    else{const ang=t*.0025,R0=1050;camTo(st,_v.set(400+Math.cos(ang)*R0,420,Math.sin(ang)*R0),new T.Vector3(400,60,0),.05)}
  }else if(C.set==='press'){
    const sp=C.speaker||'a';
    for(const [F,x,key] of [[a,320,'fa'],[b,480,'fb']]){F.x=x;F.z=-30;F.f=1;F.state=sp===F.side&&Math.floor(t/45)%2?'celebrate':'idle';const r=getSlot(st,key,F.look,F.corner,'fighter');
      if(r)poseRig(st,r,mockPose(rig,F,F===a?b:a,S),{ox:F.x,origin:{x:F.x,z:-30},dir:{x:0,z:1},perp:{x:-1,z:0}},F,{})}
    const k=sp==='a'?-1:sp==='b'?1:0;camTo(st,_v.set(400+k*40+Math.sin(t*.01)*30,235,540),new T.Vector3(400+k*45,140,-20),.06)
  }else if(C.set==='weigh'){
    const ph=C.phase||'a';P.scaleC.getContext('2d');
    if(C.shown!==C.kg){C.shown=C.kg;const g=P.scaleC.getContext('2d');g.fillStyle='#021';g.fillRect(0,0,128,64);g.fillStyle=C.miss?'#ff6b5e':'#6fe3a1';g.font='bold 34px monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(C.kg||'--',64,34);P.scaleT.needsUpdate=true}
    let ax=250,bx=550,af=1,bf=-1,as='idle',bs='idle',fz=0,camX=400,camZ=520,camY=170,tgY=150;
    if(ph==='a'){ax=400;as=Math.floor(t/40)%2?'celebrate':'idle';bx=640;camX=400;camZ=400;tgY=150}
    else if(ph==='b'){bx=400;bs=Math.floor(t/40)%2?'celebrate':'idle';ax=160;camX=400;camZ=400;tgY=150}
    else{const close=Math.min(1,t/50);ax=lerp(300,376,close);bx=lerp(500,424,close);camZ=lerp(440,340,close);
      if(C.ev==='push'&&t>70&&t<92){bs='clinch';ax-=Math.min(30,(t-70)*2)}else if(t>92&&C.ev==='push')ax=346;
      if(C.ev==='shout')as=bs=Math.floor(t/18)%2?'celebrate':'idle';else if(C.ev==='stare'){as=bs='block'}}
    a.x=ax;a.z=0;a.f=af;a.state=as;b.x=bx;b.z=0;b.f=bf;b.state=bs;S.cl=bs==='clinch'?{ctrl:b,other:a}:null;
    for(const [F,key] of [[a,'fa'],[b,'fb']]){const r=getSlot(st,key,F.look,F.corner,'fighter');if(r)poseRig(st,r,mockPose(rig,F,F===a?b:a,S),FIGHT_FRAME(0),F,{})}
    camTo(st,_v.set(camX+Math.sin(t*.008)*40,camY,camZ),new T.Vector3((a.x+b.x)/2,tgY,0),.07)
  }
}
/* between rounds: your fighter on the stool in the corner, the coach crouched in front */
function cornerScene(st,S,rig,aspect){
  const P=st.props,F=S.p||S.a,C=S.cage||{x:400,z:0,ang:0};F._t=S.frame;
  const va=(C.ang||0)+(F.side==='a'?7:1)*Math.PI/8,cx=C.x+Math.cos(va)*CR*.78,cz=(C.z||0)+Math.sin(va)*CR*.78;
  const inx=-Math.cos(va),inz=-Math.sin(va); // toward the cage centre
  const sit={...F,x:0,f:1,state:'idle'};const r=getSlot(st,'f'+F.side,F.look,F.corner,'fighter');
  if(r)poseRig(st,r,poseSit(rig,sit),{ox:0,origin:{x:cx,z:cz},dir:{x:inx,z:inz},perp:{x:-inz,z:inx}},F,{});
  P.stool.visible=true;P.stool.position.set(cx-inx*6,0,cz-inz*6);
  const cr=getSlot(st,'coach',{skin:'#c99472',hair:'#2a1f1a',hairStyle:'short',beard:true},'#888','staff',{shirt:F.side==='a'?'#1f3a6e':'#6e1f1f',pants:'#2a2d34'});
  if(cr){const J=rig.solve(rig.poseRef({x:0,f:-1,state:Math.floor(S.frame/50)%2?'crouch':'watch',walk:0},S));poseRig(st,cr,J,{ox:0,origin:{x:cx+inx*70+inz*48,z:cz+inz*70-inx*48},dir:{x:inx,z:inz},perp:{x:-inz,z:inx}},null,{arm:12,leg:8})}
  const side=.9+Math.sin(S.frame*.004)*.15;
  camTo(st,_v.set(cx+inx*330+(-inz)*side*150,165,cz+inz*330+inx*side*150),new T.Vector3(cx+inx*30,88,cz+inz*30),.06)}
function coachTalk(st,S,rig){const a=S.a,C=S.cage||{x:400,z:0};
  const cr=getSlot(st,'coach',{skin:'#c99472',hair:'#2a1f1a',hairStyle:'short',beard:true},'#888','staff',{shirt:'#1f3a6e',pants:'#2a2d34'});
  if(cr){const J=rig.solve(rig.poseRef({x:a.x-70,f:1,state:'watch',walk:0},S));poseRig(st,cr,J,FIGHT_FRAME(a.z||0),null,{arm:12,leg:8})}}
function belt(st,S){const P=st.props;if(!P)return;const C=S.cine;const on=C&&C.set==='belt'&&(C.t||0)>40;P.belt.visible=!!on;if(!on)return;
  const r=st.rigs.get('fa');if(!r||!r.hands||!r.hands[1])return;const h0=r.hands[0],h1=r.hands[1],mid=h0.clone().add(h1).multiplyScalar(.5),L=Math.max(30,h0.distanceTo(h1));
  P.belt.position.copy(mid);P.belt.position.y+=4;const d=h1.clone().sub(h0).normalize(),z=st.camera.position.clone().sub(mid);z.addScaledVector(d,-z.dot(d)).normalize();const y=new T.Vector3().crossVectors(z,d);
  P.belt.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(d,y,z));P.strap.scale.set(L+30,1,1)}
function confetti(st,S){const P=st.props;if(!P)return;const C=S.cine,on=C&&C.set==='belt'&&(C.t||0)>55;const cf=P.cf;
  if(!on){if(cf.count){cf.count=0;for(const p of P.cfp)p.y=-999}return}let n=0;
  for(const p of P.cfp){if(on&&p.y<-5&&Math.random()<.06){p.x=400+(Math.random()-.5)*500;p.z=(Math.random()-.5)*500;p.y=560+Math.random()*80;p.vx=(Math.random()-.5)*.8;p.vy=-(1.2+Math.random()*1.4)}
    if(p.y>-5){p.x+=p.vx+Math.sin(p.y*.05+p.r)*.6;p.y+=p.vy;p.r+=.08*p.s;_e.set(p.r,p.r*.7,p.r*.3);_q.setFromEuler(_e);_m.compose(_v.set(p.x,p.y,p.z),_q,_one);cf.setMatrixAt(n++,_m)}}
  cf.count=n;cf.instanceMatrix.needsUpdate=true}
const pv=new T.Vector3();
function project(x,y2,z,VH){if(!R)return{x,y:y2};pv.set(x,GY-y2,z||0).project(R.camera);return{x:(pv.x+1)/2*800,y:(1-pv.y)/2*VH,vis:pv.z<1}}
IC.R3D={
  init(canvas){if(R&&R.canvas===canvas)return true;R=build(canvas);if(R){R.canvas=canvas}return !!R},
  render,project,
  /* cinematic sets outside a fight: C={set:'title'|'belt'|'press'|'weigh', t, a:fighterData, b:fighterData, ...} */
  renderCine(C,w,h){if(!R)return;const mk=(d,side)=>({d,look:d.look,corner:side==='a'?'#3d7ff0':'#e04a3a',side,nick:d.nick,name:d.name,x:400,z:0,f:1,state:'idle',t:0,A:null,walk:0,head:100,body:100,legs:100,lgL:100,lgR:100,st:100,rocked:0,flash:0,cuts:0,react:null,g:{}});
    if(!C._a||C._a.d!==C.a)C._a=mk(C.a,'a');if(!C._b||C._b.d!==(C.b||C.a))C._b=mk(C.b||C.a,'b');
    const S={frame:C.t|0,a:C._a,b:C._b,cage:{x:400,z:0,ang:0},stains:[],cine:C,mode:'cine',round:0,ref:null,title:C.set==='belt'};render(S,w,h)},
  get ready(){return !!R},get stats(){return R?R.stats:null},
  reset(){if(!R)return;R.camPos.set(400,420,1300);R.camTgt.set(400,100,0);R.sep=null},
  _st:()=>R,_api:{getSlot,poseRig,freeUnused,flush,setLevel,crowd,fadeFence,syncCage,jumbo,fitDist,FIGHT_FRAME,aislePoint,GY,T}
};
})(window.IC);

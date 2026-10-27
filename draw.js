/* 아이언 케이지 — 그래픽 엔진: 골격 기반 선수 렌더링, 카메라, 아레나, 방송 HUD */
(function(IC){
const W=800,H=450,GY=384;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
let ctx=null;
const cam={x:400,y:255,z:1.1};
let VH=H;
const OPT=IC.opts=IC.opts||{nums:false,replay:true};

/* ---------- color & vector helpers ---------- */
function rgbOf(h){if(h[0]!=='#'){const m=/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(h);return m?[+m[1],+m[2],+m[3]]:[200,200,200]}const n=parseInt(h.slice(1),16);return[n>>16,n>>8&255,n&255]}
function shade(h,k){const [r,g,b]=rgbOf(h);const f=v=>Math.round(clamp(k>1?v+(255-v)*(k-1):v*k,0,255));return `rgb(${f(r)},${f(g)},${f(b)})`}
function rgba(h,a){const [r,g,b]=rgbOf(h);return `rgba(${r},${g},${b},${a})`}
const V2=(x,y)=>({x,y}),vadd=(a,b)=>({x:a.x+b.x,y:a.y+b.y}),vsub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}),vmul=(a,k)=>({x:a.x*k,y:a.y*k}),vlen=a=>Math.hypot(a.x,a.y),vn=a=>{const l=vlen(a)||1;return{x:a.x/l,y:a.y/l}},vl=(a,b,t)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});

/* two-bone IK */
function ik(a,b,l1,l2,pref,f){
  let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  const mx=l1+l2-.5;
  if(d>mx){const k=mx/d;b={x:a.x+dx*k,y:a.y+dy*k};dx*=k;dy*=k;d=mx}
  d=Math.max(d,Math.abs(l1-l2)+1);
  const ang=Math.atan2(dy,dx),t=Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));
  const j1={x:a.x+Math.cos(ang+t)*l1,y:a.y+Math.sin(ang+t)*l1},j2={x:a.x+Math.cos(ang-t)*l1,y:a.y+Math.sin(ang-t)*l1};
  let j;
  if(pref&&typeof pref==='object'){j=Math.hypot(j1.x-pref.x,j1.y-pref.y)<Math.hypot(j2.x-pref.x,j2.y-pref.y)?j1:j2}else switch(pref){case 'up':j=j1.y<j2.y?j1:j2;break;case 'fwd':j=j1.x*f>j2.x*f?j1:j2;break;case 'back':j=j1.x*f<j2.x*f?j1:j2;break;default:j=j1.y>j2.y?j1:j2}
  return{j,end:b};
}
/* tapered, shaded limb */
function capsule(a,b,ra,rb,base,gloss){
  const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||.01,ang=Math.atan2(dy,dx);
  const d=Math.asin(clamp((ra-rb)/L,-.98,.98));
  ctx.beginPath();
  ctx.arc(a.x,a.y,ra,ang+Math.PI/2-d,ang+Math.PI*1.5+d);
  ctx.arc(b.x,b.y,rb,ang-Math.PI/2+d,ang+Math.PI/2-d);
  ctx.closePath();
  let nx=-dy/L,ny=dx/L;if(ny>0){nx=-nx;ny=-ny}
  const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,r=Math.max(ra,rb);
  const g=ctx.createLinearGradient(mx+nx*r,my+ny*r,mx-nx*r,my-ny*r);
  g.addColorStop(0,shade(base,1.1));g.addColorStop(.3,base);g.addColorStop(.85,shade(base,.74));g.addColorStop(1,shade(base,.6));
  ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='rgba(20,10,8,.28)';ctx.lineWidth=.8;ctx.stroke();
  if(gloss>0){ctx.strokeStyle=`rgba(255,255,255,${gloss})`;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(a.x+nx*ra*.55,a.y+ny*ra*.55);ctx.lineTo(b.x+nx*rb*.55,b.y+ny*rb*.55);ctx.stroke()}
}
/* organic two-bone limb: one continuous outline with a muscle profile, so elbows and knees bend instead of hinging */
const PROF={arm:[[0,8.4],[.18,8.9],[.5,7.4],[.85,5.9],[1,5.3],[1.14,6.3],[1.45,5.5],[1.85,4.2],[2,3.9]],
  leg:[[0,12.2],[.2,12.6],[.55,10.4],[.88,7.4],[1,6.8],[1.12,7.8],[1.32,8.1],[1.65,5.6],[1.92,4.3],[2,4.1]]};
function profW(P,s){for(let i=1;i<P.length;i++)if(s<=P[i][0]){const a=P[i-1],b=P[i],t=(s-a[0])/(b[0]-a[0]),e=t*t*(3-2*t);return a[1]+(b[1]-a[1])*e}return P[P.length-1][1]}
function limbPts(p0,p1,p2,P,k,s0=0,s1=2,ex=0){
  const L=[],R=[],C=[],N=16,d1=vn(vsub(p1,p0)),d2=vn(vsub(p2,p1)),dj=vn(vadd(d1,d2));
  for(let i=0;i<=N;i++){const s=s0+(s1-s0)*i/N;let pt,dir;
    if(s<=1){pt=vl(p0,p1,s);dir=s>.82?vn(vl(d1,dj,(s-.82)/.18)):d1}else{pt=vl(p1,p2,s-1);dir=s<1.18?vn(vl(dj,d2,(s-1)/.18)):d2}
    // round the inside of the bend a little
    if(s>.8&&s<1.2){const b=1-Math.abs(s-1)/.2;pt=vl(pt,vl(vl(p0,p1,.8),vl(p1,p2,.2),.5),b*.22)}
    const w=profW(P,s)*k+ex,n={x:-dir.y,y:dir.x};L.push({x:pt.x+n.x*w,y:pt.y+n.y*w});R.push({x:pt.x-n.x*w,y:pt.y-n.y*w});C.push({pt,n,w})}
  return{L,R,C};
}
function smoothPath(pts,move){if(move)ctx.moveTo(pts[0].x,pts[0].y);else ctx.lineTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length-1;i++){const m={x:(pts[i].x+pts[i+1].x)/2,y:(pts[i].y+pts[i+1].y)/2};ctx.quadraticCurveTo(pts[i].x,pts[i].y,m.x,m.y)}const l=pts[pts.length-1];ctx.lineTo(l.x,l.y)}
/* pilot: photo skin textures mapped onto the drawn limbs and torso (test only) */
const TEXC={};let TEXON=null;
function texImg(src){let im=TEXC[src];if(!im){im=TEXC[src]=new Image();im.src=src}return im.complete&&im.naturalWidth?im:null}
function texSet(F){const pl=IC.pilot&&F&&F.d&&F.kind!=='ref'&&IC.pilot(F.d);if(!pl)return null;const g=n=>texImg(`art/pilot/${pl.key}_${n}.png`);return{armu:g('armu'),arml:g('arml'),legu:g('legu'),legl:g('legl'),torso:g('torso')}}
function texSeg(im,a,b,w){if(!im)return;const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(dy,dx));ctx.drawImage(im,-w*.3,-w*1.15,len+w*.6,w*2.3);ctx.restore()}
function limb(p0,p1,p2,P,k,base,o={}){
  const {L,R,C}=limbPts(p0,p1,p2,P,k);
  ctx.beginPath();smoothPath(L,true);const e=C[C.length-1],st=C[0];
  ctx.arc(e.pt.x,e.pt.y,e.w,Math.atan2(e.n.y,e.n.x),Math.atan2(e.n.y,e.n.x)-Math.PI,true);
  smoothPath(R.slice().reverse(),false);
  ctx.arc(st.pt.x,st.pt.y,st.w,Math.atan2(-st.n.y,-st.n.x),Math.atan2(-st.n.y,-st.n.x)-Math.PI,true);ctx.closePath();
  // light from above: pick the upward-facing side of the upper bone as lit
  const n0=C[4].n,up=n0.y<0?1:-1,mx=(p0.x+p2.x)/2,my=(p0.y+p2.y)/2,r=16*k;
  const g=ctx.createLinearGradient(mx+n0.x*r*up,my+n0.y*r*up,mx-n0.x*r*up,my-n0.y*r*up);
  g.addColorStop(0,shade(base,1.2));g.addColorStop(.3,shade(base,1.04));g.addColorStop(.62,shade(base,.84));g.addColorStop(.9,shade(base,.6));g.addColorStop(1,shade(base,.72));
  ctx.fillStyle=g;ctx.fill();
  if(TEXON&&!o.flat){const kind=P===PROF.arm?'arm':P===PROF.leg?'leg':null;if(kind){ctx.save();ctx.clip();const wU=C[4].w,wL=C[12].w;
      texSeg(TEXON[kind+'u'],p0,p1,wU);texSeg(TEXON[kind+'l'],p1,p2,wL);
      ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.55;ctx.fillStyle=g;ctx.fill();ctx.restore()}}
  if(!o.flat){ctx.save();ctx.clip();ctx.strokeStyle='rgba(185,215,255,.22)';ctx.lineWidth=1;ctx.beginPath();smoothPath(C.slice(1,15).map(c=>({x:c.pt.x-c.n.x*(c.w-.9)*up,y:c.pt.y-c.n.y*(c.w-.9)*up})),true);ctx.stroke();ctx.restore()}
  ctx.strokeStyle='rgba(28,12,6,.55)';ctx.lineWidth=1.05;ctx.lineJoin='round';ctx.stroke();
  if(!o.flat){
    ctx.save();ctx.clip();
    // muscle highlights: biceps/quad belly and forearm/calf belly
    for(const [s,a] of o.bellies||[]){const i=Math.round(s/2*16),c=C[i];const hx=c.pt.x+c.n.x*c.w*.35*up,hy=c.pt.y+c.n.y*c.w*.35*up;const rg=ctx.createRadialGradient(hx,hy,0,hx,hy,c.w*1.3);rg.addColorStop(0,`rgba(255,240,225,${a})`);rg.addColorStop(1,'rgba(255,240,225,0)');ctx.fillStyle=rg;ctx.fillRect(hx-c.w*1.4,hy-c.w*1.4,c.w*2.8,c.w*2.8)}
    // occlusion in the crease of the joint
    const cj=C[8],og=ctx.createRadialGradient(cj.pt.x-cj.n.x*cj.w*up,cj.pt.y-cj.n.y*cj.w*up,0,cj.pt.x,cj.pt.y,cj.w*1.6);og.addColorStop(0,'rgba(60,25,15,.28)');og.addColorStop(1,'rgba(60,25,15,0)');ctx.fillStyle=og;ctx.fillRect(cj.pt.x-20,cj.pt.y-20,40,40);
    /* muscle contours: a soft crease between the muscle heads, kneecap / elbow point, and sweat beads in the light */
    if(false){const cr=(i0,i1,sideK,al)=>{ctx.strokeStyle=`rgba(70,30,18,${al})`;ctx.lineWidth=.75;ctx.beginPath();smoothPath(C.slice(i0,i1).map((c,j,arr)=>({x:c.pt.x+c.n.x*c.w*sideK*up*Math.sin((j+1)/(arr.length+1)*Math.PI),y:c.pt.y+c.n.y*c.w*sideK*up*Math.sin((j+1)/(arr.length+1)*Math.PI)})),true);ctx.stroke()};
      cr(2,7,-.15,.22);cr(10,15,.25,.18);const kc=C[8];ell(kc.pt.x+kc.n.x*kc.w*.25*up,kc.pt.y+kc.n.y*kc.w*.25*up,kc.w*.42,kc.w*.32,'rgba(255,238,220,.16)');
      if(o.sheen>.12)for(const i of [3,6,11,13]){const c=C[i];ell(c.pt.x+c.n.x*c.w*.5*up,c.pt.y+c.n.y*c.w*.5*up,.8,.55,`rgba(255,255,255,${Math.min(.8,o.sheen*2.2)})`)}}
    if(o.sheen>0){ctx.strokeStyle=`rgba(255,255,255,${o.sheen})`;ctx.lineWidth=1.4;ctx.beginPath();smoothPath(C.slice(2,14).map(c=>({x:c.pt.x+c.n.x*c.w*.55*up,y:c.pt.y+c.n.y*c.w*.55*up})),true);ctx.stroke()}
    ctx.restore();
  }
  return{L,R,C};
}
function mixc(a,b,k){const A=rgbOf(a),B=rgbOf(b);return `rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*k)).join(",")})`}
function ell(x,y,rx,ry,col,rot=0){ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(x,y,rx,ry,rot,0,Math.PI*2);ctx.fill()}

/* ---------- body parts ---------- */
function torsoPath(L){
  ctx.beginPath();
  ctx.moveTo(-11.5,4);
  ctx.bezierCurveTo(-14.5,-L*.12,-13.5,-L*.3,-13.8,-L*.42);
  ctx.bezierCurveTo(-14.2,-L*.55,-16.8,-L*.66,-16.4,-L*.8);
  ctx.bezierCurveTo(-16,-L*.92,-12.5,-L-1,-7.5,-L-4.5);
  ctx.bezierCurveTo(-4,-L-6.5,1,-L-6.5,4.5,-L-4.5);
  ctx.bezierCurveTo(10,-L-2.5,15,-L*.95,17.2,-L*.82);
  ctx.bezierCurveTo(19,-L*.72,17,-L*.6,14,-L*.58);
  ctx.bezierCurveTo(14.8,-L*.45,14.6,-L*.3,13.6,-L*.18);
  ctx.bezierCurveTo(12.8,-L*.06,12.2,0,10.5,4);
  ctx.closePath();
}
function drawTorso(F,hip,chest,f,o){
  const sp=vsub(chest,hip),L=vlen(sp),ang=Math.atan2(sp.y,sp.x)+Math.PI/2;
  ctx.save();ctx.translate(hip.x,hip.y);ctx.rotate(ang);ctx.scale(f,1);
  const base=o.shirt||o.skinNow;
  torsoPath(L);
  const g=ctx.createLinearGradient(17,0,-17,0);g.addColorStop(0,shade(base,1.14));g.addColorStop(.38,shade(base,1.02));g.addColorStop(.8,shade(base,.7));g.addColorStop(1,shade(base,.58));
  ctx.fillStyle=g;ctx.fill();
  if(TEXON&&TEXON.torso&&!o.shirt){ctx.save();ctx.clip();ctx.drawImage(TEXON.torso,-17,-L-7,36,L+12);ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.5;ctx.fillStyle=g;ctx.fill();ctx.restore()}
  if(!o.shirt){ctx.save();ctx.clip();ctx.strokeStyle='rgba(185,215,255,.38)';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(-13.2,-L*.1);ctx.bezierCurveTo(-13.8,-L*.35,-15.6,-L*.62,-15.4,-L*.82);ctx.stroke();ctx.restore()}
  ctx.strokeStyle='rgba(28,12,6,.55)';ctx.lineWidth=1.15;ctx.lineJoin='round';ctx.stroke();
  if(o.belly>0){ctx.beginPath();ctx.ellipse(6+2.5*o.belly,-L*.24,10+3*o.belly,13+2*o.belly,.05,0,7);ctx.fill();torsoPath(L)}
  const tl=ctx.createRadialGradient(7,-L*.85,2,7,-L*.85,26);tl.addColorStop(0,'rgba(255,248,235,.22)');tl.addColorStop(1,'rgba(255,248,235,0)');ctx.fillStyle=tl;ctx.fill();
  if(o.shirt){
    ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-6,-L*.2);ctx.quadraticCurveTo(2,-L*.5,-4,-L*.8);ctx.stroke();
    ctx.fillStyle='#e7e7e7';ctx.font='bold 5px sans-serif';ctx.textAlign='center';ctx.save();ctx.scale(f,1);ctx.fillText(o.logo!=null?o.logo:'REF',f*2,-L*.62);ctx.restore();
    ctx.fillStyle=shade(base,1.4);ctx.beginPath();ctx.moveTo(-3,-L-4);ctx.lineTo(5,-L-3);ctx.lineTo(2,-L+3);ctx.closePath();ctx.fill();
  }else{
    ctx.save();ctx.clip();
    const soft=(x,y,rx,ry,col)=>{const g=ctx.createRadialGradient(x,y,0,x,y,Math.max(rx,ry));g.addColorStop(0,col);g.addColorStop(1,col.replace(/[\d.]+\)$/,'0)'));ctx.save();ctx.translate(x,y);ctx.scale(rx/Math.max(rx,ry),ry/Math.max(rx,ry));ctx.translate(-x,-y);ctx.fillStyle=g;ctx.fillRect(x-Math.max(rx,ry),y-Math.max(rx,ry),Math.max(rx,ry)*2,Math.max(rx,ry)*2);ctx.restore()};
    soft(13,-L*.56,9,4,'rgba(70,30,18,.30)');           // shadow under the pec
    soft(10,-L*.76,8,7,'rgba(255,240,225,.18)');         // pec highlight
    for(const yy of [.46,.34,.22])soft(11.2,-L*yy,3.6,3,'rgba(255,240,225,.13)'); // ab bellies
    for(const yy of [.4,.28])soft(11.5,-L*yy,4.5,1.2,'rgba(70,30,18,.14)');
    soft(-10,-L*.66,6,12,'rgba(70,30,18,.16)');          // lat shadow
    soft(-6,-L*.9,8,5,'rgba(255,240,225,.12)');          // trapezius light
    soft(4,-L*.12,9,6,'rgba(70,30,18,.12)');             // obliques
    ctx.restore();
    ctx.strokeStyle='rgba(70,30,18,.16)';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(11.4,-L*.52);ctx.quadraticCurveTo(11.8,-L*.3,11.2,-L*.08);ctx.stroke();
    ell(11.2,-L*.1,.8,1.1,'rgba(60,30,20,.3)');
    if(o.body<60){ctx.fillStyle=`rgba(150,30,60,${clamp((60-o.body)/120,0,.4)})`;ctx.beginPath();ctx.ellipse(6,-L*.3,7,10,0,0,7);ctx.fill()}
    {const bl=clamp((o.cuts||0)*.5+(100-(o.head??100))/30,0,6);if(bl>2.5){ctx.strokeStyle=`rgba(140,8,18,${Math.min(.8,(bl-2)*.2)})`;ctx.lineCap='round';
      for(const [x0,len,w] of [[12,.5,2.2],[9,.38,1.6],[14.5,.28,1.3],[6,.22,1.2]].slice(0,Math.ceil(bl-2))){ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x0,-L*.97);ctx.quadraticCurveTo(x0+1.5,-L*(.97-len*.5),x0-.5,-L*(.97-len));ctx.stroke()}}}
    if(o.tattoo){ctx.strokeStyle='rgba(25,35,55,.55)';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(-12,-L*.9);ctx.quadraticCurveTo(-2,-L*.98,6,-L*.86);ctx.quadraticCurveTo(0,-L*.8,-4,-L*.7);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-10,-L*.78);ctx.quadraticCurveTo(-6,-L*.72,-8,-L*.64);ctx.stroke()}
    const sw=o.sweat;if(sw>.05){ctx.strokeStyle=`rgba(255,255,255,${sw*.5})`;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(13,-L*.75);ctx.quadraticCurveTo(15,-L*.66,13,-L*.6);ctx.stroke();ctx.beginPath();ctx.moveTo(11,-L*.4);ctx.lineTo(11.6,-L*.3);ctx.stroke()}
  }
  ctx.restore();
}
function waistband(F,hip,chest,f,o){
  const sp=vsub(chest,hip),ang=Math.atan2(sp.y,sp.x)+Math.PI/2;
  ctx.save();ctx.translate(hip.x,hip.y);ctx.rotate(ang);ctx.scale(f,1);
  if(o.pants){ctx.fillStyle='#1d1d20';ctx.fillRect(-12,-3,24,5);ctx.fillStyle='#8a8f99';ctx.fillRect(-2,-2.5,5,4);ctx.restore();return}
  const g=ctx.createLinearGradient(0,-9,0,8);g.addColorStop(0,shade(o.trunk,1.15));g.addColorStop(1,shade(o.trunk,.7));
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-12.5,-5);ctx.quadraticCurveTo(0,-7,12,-5);ctx.quadraticCurveTo(14.5,2,12.5,8);ctx.quadraticCurveTo(0,10,-12.5,8);ctx.quadraticCurveTo(-14.5,2,-12.5,-5);ctx.fill();
  ctx.fillStyle=shade(o.trunk,.5);ctx.beginPath();ctx.moveTo(-12.5,-5);ctx.quadraticCurveTo(0,-7,12,-5);ctx.lineTo(12.4,-1.6);ctx.quadraticCurveTo(0,-3.6,-12.6,-1.6);ctx.closePath();ctx.fill();
  ctx.fillStyle=o.corner;ctx.fillRect(-12.6,-1.6,25,1.2);
  ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=.4;for(let x=-11.5;x<12;x+=1.6){ctx.beginPath();ctx.moveTo(x,-5.6);ctx.lineTo(x,-2);ctx.stroke()}
  ctx.strokeStyle='rgba(240,240,240,.85)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(10.6,-3.6);ctx.quadraticCurveTo(12.4,1,11,4.2);ctx.moveTo(11.4,-3.6);ctx.quadraticCurveTo(13.6,.4,13,3.4);ctx.stroke();
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(-9.6,1.6,7.4,4.6);ctx.strokeStyle=rgba(o.corner,.9);ctx.lineWidth=.5;ctx.setLineDash([.8,.8]);ctx.strokeRect(-9.6,1.6,7.4,4.6);ctx.setLineDash([]);
  ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='bold 4.5px sans-serif';ctx.textAlign='center';ctx.save();ctx.scale(f,1);ctx.fillText('IC',f*-5.9,5.2);ctx.restore();
  ctx.restore();
}
function shortsLeg(hip,knee,o,dark,ankle){
  if(o.pants)return;
  const {L,R,C}=limbPts(hip,knee,ankle||knee,PROF.leg,1,0,.6,2.2);
  const col=dark?shade(o.trunk,.78):o.trunk;
  ctx.beginPath();smoothPath(L,true);const e=C[C.length-1];
  // hem flares slightly and is cut straight
  ctx.lineTo(e.pt.x+e.n.x*(e.w+1.5),e.pt.y+e.n.y*(e.w+1.5));ctx.lineTo(e.pt.x-e.n.x*(e.w+1.5),e.pt.y-e.n.y*(e.w+1.5));
  smoothPath(R.slice().reverse(),false);ctx.closePath();
  const n=C[4].n,up=n.y<0?1:-1,mx=(hip.x+e.pt.x)/2,my=(hip.y+e.pt.y)/2;const g=ctx.createLinearGradient(mx+n.x*14*up,my+n.y*14*up,mx-n.x*14*up,my-n.y*14*up);
  g.addColorStop(0,shade(col,1.2));g.addColorStop(.5,col);g.addColorStop(1,shade(col,.62));ctx.fillStyle=g;ctx.fill();
  // fabric folds and side stripe
  ctx.save();ctx.clip();ctx.strokeStyle='rgba(0,0,0,.16)';ctx.lineWidth=1.2;for(const t of [.35,.6]){const c=C[Math.round(t*16)];ctx.beginPath();ctx.moveTo(c.pt.x+c.n.x*c.w,c.pt.y+c.n.y*c.w);ctx.quadraticCurveTo(c.pt.x+c.n.x*2,c.pt.y+c.n.y*2+3,c.pt.x-c.n.x*c.w*.3,c.pt.y-c.n.y*c.w*.3);ctx.stroke()}
  ctx.strokeStyle=rgba(o.corner,.9);ctx.lineWidth=2.2;ctx.beginPath();smoothPath(C.map(c=>({x:c.pt.x+c.n.x*c.w*.8*up,y:c.pt.y+c.n.y*c.w*.8*up})),true);ctx.stroke();ctx.restore();
  ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(e.pt.x+e.n.x*(e.w+1.5),e.pt.y+e.n.y*(e.w+1.5));ctx.lineTo(e.pt.x-e.n.x*(e.w+1.5),e.pt.y-e.n.y*(e.w+1.5));ctx.stroke();
  /* hi-q fight shorts: satin sheen, extra folds, stitched hem, side split with a contrast gusset */
  {ctx.save();ctx.beginPath();smoothPath(L,true);ctx.lineTo(e.pt.x+e.n.x*(e.w+1.5),e.pt.y+e.n.y*(e.w+1.5));ctx.lineTo(e.pt.x-e.n.x*(e.w+1.5),e.pt.y-e.n.y*(e.w+1.5));smoothPath(R.slice().reverse(),false);ctx.closePath();ctx.clip();
   ctx.strokeStyle='rgba(255,255,255,.22)';ctx.lineWidth=1.6;ctx.beginPath();smoothPath(C.slice(1,14).map(c=>({x:c.pt.x+c.n.x*c.w*.35*up,y:c.pt.y+c.n.y*c.w*.35*up})),true);ctx.stroke();
   ctx.strokeStyle='rgba(0,0,0,.13)';ctx.lineWidth=.9;for(const t of [.2,.48,.75]){const c=C[Math.round(t*16)];ctx.beginPath();ctx.moveTo(c.pt.x-c.n.x*c.w,c.pt.y-c.n.y*c.w);ctx.quadraticCurveTo(c.pt.x+3,c.pt.y+2,c.pt.x+c.n.x*c.w*.4,c.pt.y+c.n.y*c.w*.4);ctx.stroke()}
   const sx=e.pt.x+e.n.x*e.w*.8*up,sy=e.pt.y+e.n.y*e.w*.8*up,c2=C[11],tx=c2.pt.x+c2.n.x*c2.w*.8*up,ty=c2.pt.y+c2.n.y*c2.w*.8*up;
   ctx.fillStyle=shade(o.corner,.85);ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(sx+e.n.x*3*up,sy+e.n.y*3*up);ctx.lineTo(sx-e.n.x*3.5*up,sy-e.n.y*3.5*up);ctx.closePath();ctx.fill();
   const hx=e.pt.x-(e.pt.x-C[14].pt.x)*.9,hy=e.pt.y-(e.pt.y-C[14].pt.y)*.9;ctx.setLineDash([1.2,1.2]);ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(hx+e.n.x*e.w,hy+e.n.y*e.w);ctx.lineTo(hx-e.n.x*e.w,hy-e.n.y*e.w);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
  ctx.beginPath();smoothPath(L,true);ctx.lineTo(e.pt.x+e.n.x*(e.w+1.5),e.pt.y+e.n.y*(e.w+1.5));ctx.lineTo(e.pt.x-e.n.x*(e.w+1.5),e.pt.y-e.n.y*(e.w+1.5));smoothPath(R.slice().reverse(),false);ctx.closePath();ctx.strokeStyle='rgba(20,10,6,.45)';ctx.lineWidth=.9;ctx.stroke();
}
function sleeve(sh,el,wr,col){const {L,R,C}=limbPts(sh,el,wr,PROF.arm,1,0,.55,1.4);ctx.beginPath();smoothPath(L,true);smoothPath(R.slice().reverse(),false);const st=C[0];ctx.arc(st.pt.x,st.pt.y,st.w,Math.atan2(-st.n.y,-st.n.x),Math.atan2(-st.n.y,-st.n.x)-Math.PI,true);ctx.closePath();ctx.fillStyle=col;ctx.fill();ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=.8;ctx.stroke()}
function glove(p,ang,o,dark){
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(ang);
  if(o.kind==='ref'){ell(2,0,5.2,4.6,dark?'#16171a':'#24262b');ctx.restore();return}
  /* 4oz open-finger MMA glove seen from the side: corner-colored wrist strap, black leather back, thick knuckle pad, bare fingers curled under, thumb */
  const sk=dark?shade(o.skinNow||'#d2a07a',.72):(o.skinNow||'#d2a07a'),skD=shade(sk,.7),cc=dark?shade(o.corner,.7):o.corner;
  /* fingers curled under the pad (bare skin, the open-finger look) */
  ctx.fillStyle=sk;ctx.beginPath();ctx.roundRect(4.5,1.8,8.2,5.6,2.6);ctx.fill();
  ctx.strokeStyle=skD;ctx.lineWidth=.55;for(const xx of [6.6,8.7,10.7]){ctx.beginPath();ctx.moveTo(xx,2.6);ctx.lineTo(xx,6.9);ctx.stroke()}
  /* leather back of the hand + padding */
  const g=ctx.createLinearGradient(0,-8,0,4);g.addColorStop(0,dark?'#34373d':'#5a5f69');g.addColorStop(.35,dark?'#17181b':'#24262c');g.addColorStop(1,'#0a0b0d');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-1.5,-5.6);ctx.quadraticCurveTo(4,-7.6,10,-7);ctx.quadraticCurveTo(14.2,-6.2,14,-1.2);ctx.quadraticCurveTo(13.6,2.6,10.2,2.8);ctx.lineTo(-1.5,3.6);ctx.closePath();ctx.fill();
  /* knuckle pad seam + stitching */
  ctx.strokeStyle='rgba(0,0,0,.55)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(7.6,-6.6);ctx.quadraticCurveTo(6.6,-2,7.8,2.6);ctx.stroke();
  ctx.setLineDash([.9,1.1]);ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(-.8,-4.8);ctx.quadraticCurveTo(4,-6.6,9.8,-6.1);ctx.quadraticCurveTo(13.2,-5.4,13.1,-1.4);ctx.stroke();ctx.setLineDash([]);
  /* leather sheen on the knuckles */
  ctx.fillStyle=`rgba(255,255,255,${dark?.08:.22})`;ctx.beginPath();ctx.ellipse(10.2,-5,3.4,1.2,-.15,0,7);ctx.fill();
  /* thumb with its leather loop */
  ctx.fillStyle=sk;ctx.beginPath();ctx.ellipse(4.2,-6.9,3.2,1.7,-.25,0,7);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.roundRect(2.6,-8.3,2.4,2.6,.8);ctx.fill();
  /* wrist strap: corner color, velcro band and a small white logo tab */
  const sg=ctx.createLinearGradient(0,-6.6,0,6.6);sg.addColorStop(0,shade(cc,1.25));sg.addColorStop(.5,cc);sg.addColorStop(1,shade(cc,.6));
  ctx.fillStyle=sg;ctx.beginPath();ctx.roundRect(-8.6,-6.2,7.6,11.4,2.2);ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(-7.4,-6.2,1.2,11.4);
  ctx.fillStyle=dark?'rgba(255,255,255,.35)':'rgba(255,255,255,.8)';ctx.beginPath();ctx.roundRect(-5.6,-2,3,4,.8);ctx.fill();
  ctx.restore();
}
function foot(ankle,f,col,o){
  const toe={x:ankle.x+f*14,y:ankle.y+3};
  if(o.kind==='ref'){capsule(ankle,{x:ankle.x+f*15,y:ankle.y+3},5.6,4.4,'#121214',0);return}
  capsule(ankle,toe,5,3.4,col,0);
  ell(ankle.x-f*1.5,ankle.y+2,4.6,3.6,col);
}
/* ---------- individuality: every fighter gets a stable, distinct face ---------- */
const FACEC=new Map();
function seedStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
const HVAR={bald:['bald','bald','shaved'],buzz:['buzz','lines','fade','buzz'],short:['crop','side','slick','curly','spiky','faux','receding','cornrow','afro','crop'],
  long:['flow','dreads','pony','halfshave','afro','flow'],bun:['bun','topknot','manbun'],mohawk:['mohawk','fauxdye','mohawk']};
function faceOf(F){const d=F.d,key=(d&&(d.id||d.name))||JSON.stringify(F.look||{});let v=FACEC.get(key);if(v)return v;
  let s=seedStr('f2'+String(key));const r=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
  const pk=a=>a[Math.floor(r()*a.length)],st=d&&d.style,own=!!(d&&(d.custom||d.me)),hs=(F.look&&F.look.hairStyle)||'short',age=(d&&d.age)||28;
  v={shape:pk(['round','long','square','wide','egg','square','round']),hs:.9+r()*.2,jaw:r()*2-1,chin:r()*2-1,cleft:r()<.15,
    nose:pk(['straight','hook','flat','button','big','straight','flat']),brow:r(),browA:r()*2-1,eye:r(),iris:pk(['#2a1b14','#2a1b14','#4a3020','#5d7a3a','#3f6f9a','#2a1b14']),lid:r()<.35,
    mouth:pk(['flat','smirk','frown','flat','thin','full']),guard:pk(['#1f6fe0','#e04a3a','#f2f2f2','#18c06a','#111','#f0b93a','#b04ad8']),
    ear:.85+r()*.35,cauli:r()<((st==='wrestler'||st==='bjj'||st==='sambo')?.65:.1),scar:r()<.3,scar2:r()<.12,crooked:r()<.25,
    freck:r()<.14,cheek:r(),age,gray:age>=33?Math.min(1,(age-32)/6):0,
    beardS:pk(['full','goatee','stubble','mustache','chin','horse','soul','long','full','stubble']),side:r()<.3,
    hairV:pk(HVAR[hs]||HVAR.short),
    hairTone:(()=>{const a=r(),b=r();return own?null:a<.22?['#c9a15a','#8a3a1a','#8f8f8f','#e1cfa0','#b8742a'][Math.floor(b*5)]:null})(),
    dye:r()<.12?pk(['#e8b33a','#3d7ff0','#e04a3a','#f2f2f2','#b04ad8']):null,
    band:r()<.05?pk(['#e04a3a','#111','#f2f2f2','#3d7ff0']):null,stud:r()<.16,tat:r()<.08,tape:r()<.06,
    skinK:own?1:.9+r()*.2,belly:r()};
  FACEC.set(key,v);return v}
/* ---- photo faces: an AI portrait face pasted on the drawn head (menus + fights) ---- */
const FACES={},FSKIN={};
/* average cheek colour of a face photo, so the drawn body matches the face */
function faceSkinOf(F){const im=faceImgOf(F);if(!im)return null;const k=im.src;if(FSKIN[k]!==undefined)return FSKIN[k];
  try{const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.drawImage(im,0,0,16,16);const d=x.getImageData(5,6,6,4).data;let r=0,g=0,b=0,n=0;
    for(let i=0;i<d.length;i+=4){const l=(d[i]+d[i+1]+d[i+2])/3;if(d[i+3]>200&&l>40&&l<235){r+=d[i];g+=d[i+1];b+=d[i+2];n++}}
    FSKIN[k]=n?'#'+[r,g,b].map(v=>Math.round(Math.min(255,v/n*1.15)).toString(16).padStart(2,'0')).join(''):null}catch(e){FSKIN[k]=null}return FSKIN[k]}
function lookOf(F){const L=F.look||{};const fs=faceSkinOf(F);return fs&&fs!==L.skin?Object.assign({},L,{skin:fs}):L}
function faceImgOf(F,view){const d=F&&F.d;if(!d||!d.id||!IC.facePath)return null;const src=IC.facePath(d,view);if(!src)return null;let im=FACES[src];if(!im){im=FACES[src]=new Image();im.onload=()=>{clearTimeout(faceImgOf.t);faceImgOf.t=setTimeout(()=>{try{IC.onFaceLoad&&IC.onFaceLoad()}catch(e){}},80)};im.src=src}return im.complete&&im.naturalWidth?im:null}
/* photo head (hair, ears, neck) in place of the drawn head; face centre at (cx,cy), fw = face width */
function photoHead(im,cx,cy,fw,dm,cuts,sq=1){const k=fw/94,W=160*k,H=200*k;ctx.save();ctx.translate(cx,cy);ctx.scale(sq,1);
  ctx.drawImage(im,-W/2,-90*k,W,H);
  const u=fw/2;/* bruises, swelling and blood painted on top of the photo */
  if(dm>.15){ctx.globalCompositeOperation='multiply';ctx.fillStyle=`rgba(205,95,105,${Math.min(.45,(dm-.15)*.6)})`;ctx.beginPath();ctx.ellipse(-u*.42,u*.18,u*.32,u*.22,0,0,7);ctx.ellipse(u*.42,u*.18,u*.32,u*.22,0,0,7);ctx.fill();ctx.globalCompositeOperation='source-over'}
  if(dm>.35){const a=Math.min(.55,(dm-.35)*1.1);ctx.fillStyle=`rgba(80,25,70,${a})`;ctx.beginPath();ctx.ellipse(u*.38,-u*.12,u*.26,u*.17,0,0,7);ctx.fill();if(dm>.55){ctx.beginPath();ctx.ellipse(-u*.38,-u*.12,u*.24,u*.16,0,0,7);ctx.fill()}}
  const n=Math.min(5,cuts|0);ctx.strokeStyle='rgba(150,8,18,.9)';ctx.lineCap='round';for(let i=0;i<n;i++){const bx=u*(-.35+i*.2),by=-u*.62;ctx.lineWidth=u*.07;ctx.beginPath();ctx.moveTo(bx,by);ctx.quadraticCurveTo(bx+u*.04,by+u*.45,bx-u*.02,by+u*(.7+i*.12));ctx.stroke()}
  if(dm>.45){ctx.strokeStyle='rgba(140,8,18,.85)';ctx.lineWidth=u*.07;ctx.beginPath();ctx.moveTo(-u*.04,u*.3);ctx.lineTo(-u*.06,u*.7);ctx.stroke()}
  ctx.restore()}
/* which way the head should face: side (default), tq = 3/4 (rocked/hurt), down (ground top), up (on the back) */
function headView(F){if(F.state==='ko')return F.koK==='face'?'down':'up';
  if(typeof S!=='undefined'&&S&&S.gr&&!S.gr.done){if(S.gr.top===F)return 'down';if(S.gr.bot===F)return 'up'}
  if(F.state==='hit'||(F.flash||0)>0||(F.stun||0)>0)return 'tq';return 'side'}
/* drawn heads stay in profile during the fight and turn to face the camera for the result announcement;
   the turn is a quick squash so it reads as the head rotating */
function wantsProfile(F){/* side profile during the fight; face the camera only for the result announcement */
  const S=IC.Fight&&IC.Fight.S;if(!S||F.state==='ko')return true;return !(S.mode==='decision'||S.mode==='outro')}
function drawHeadFront(F,c,ang,o,sx){const P=o.face||{hs:1},mood=o.mood||(F.state==='hit'||F.rocked>0?'hurt':F.exh?'tired':null);
  ctx.save();ctx.translate(c.x,c.y);ctx.rotate(ang);ctx.scale(.8*sx,.8);ctx.beginPath();ctx.ellipse(0,-3,25,26,0,0,Math.PI*2);ctx.clip();ctx.translate(0,212);
  drawFront(F,0,{walk:0,perf:'hud',noBuild:true,dmg:{head:F.head??100,cuts:F.cuts||0,mood},blink:o.blink,t:o.t||0,sweat:o.sweat});ctx.restore()}
function exprView(F,view){if(!(IC.pilot&&IC.pilot(F.d)))return view;/* expression sets: shout on power shots and celebrations, grimace when hurt */
  const A=F.A,pw=A&&F.state==='attack'&&/cross|hook|overhand|upper|kick|knee|special|super|spin/.test(A.anim||'');
  if(view==='side'||view==='tq'){if(F.state==='hit'||(F.rocked||0)>0||(F.stun||0)>0)return 'hurttq';if(pw||F.state==='celebrate'||(F.state==='perf'&&/chest|taunt/.test(F.perfK||'')))return 'yelltq'}
  if(view==='front'){if((F.head??100)<35||F.state==='ko')return 'hurt';if(F.state==='celebrate')return 'yell'}return view}
function drawHead(F,c,ang,f,o){const view=exprView(F,headView(F));let im=faceImgOf(F,view),multi=!!(im&&IC.headHasViews&&IC.headHasViews(F.d));
  if(!im&&o.kind==='fighter'&&F.d&&!F.noFront){const tgt=wantsProfile(F)?1:0;F._hv=F._hv==null?tgt:F._hv+(tgt-F._hv)*.35;const k=F._hv;
    if(k<.5){drawHeadFront(F,c,ang,o,Math.max(.25,1-2*k));return}
    if(k<.98){ctx.save();ctx.translate(c.x,c.y);ctx.scale(Math.max(.25,2*k-1),1);ctx.translate(-c.x,-c.y);drawHead0(F,c,ang,f,o);ctx.restore();return}}
  if(!im)return drawHead0(F,c,ang,f,o);
  const P=o.face||{hs:1},dm=clamp((100-(F.head==null?100:F.head))/100,0,1);ctx.save();ctx.translate(c.x,c.y);ctx.rotate(ang);ctx.scale(P.hs||1,P.hs||1);
  if(multi){if(IC.pilot&&IC.pilot(F.d)){/* photos look wrong when the whole head spins: keep at most a small tilt */ctx.rotate(-ang+clamp(ang-(f>0?0:0),-.22,.22)*.6)}ctx.scale(f,1);photoHeadV(im,0,-1,IC.pilot&&IC.pilot(F.d)?30:34,dm,F.head<85?F.cuts:0,view)}else photoHead(im,f*1.6,.5,24,dm,F.head<85?F.cuts:0,.9);ctx.restore()}
/* multi-view head: 200x200 sprite, head (crown to chin) normalised to 150px and centred; side views face right */
function photoHeadV(im,cx,cy,hh,dm,cuts,view){const k=hh/150,W=200*k;ctx.drawImage(im,cx-W/2,cy-W/2,W,W);
  const u=hh*.34,ox=view==='front'?0:view==='tq'?u*.25:u*.55;ctx.save();ctx.translate(cx+ox,cy+u*.15);ctx.scale(view==='front'?1:.7,1);
  if(dm>.35){ctx.fillStyle=`rgba(80,25,70,${Math.min(.5,(dm-.35))})`;ctx.beginPath();ctx.ellipse(u*.2,-u*.15,u*.25,u*.16,0,0,7);ctx.fill()}
  const n=Math.min(4,cuts|0);ctx.strokeStyle='rgba(150,8,18,.9)';ctx.lineCap='round';for(let i=0;i<n;i++){ctx.lineWidth=u*.08;ctx.beginPath();ctx.moveTo(u*(-.1+i*.18),-u*.6);ctx.quadraticCurveTo(u*(-.05+i*.18),-u*.2,u*(-.1+i*.16),u*(.1+i*.1));ctx.stroke()}
  if(dm>.45){ctx.strokeStyle='rgba(140,8,18,.85)';ctx.lineWidth=u*.08;ctx.beginPath();ctx.moveTo(u*.45,u*.25);ctx.lineTo(u*.42,u*.6);ctx.stroke()}
  ctx.restore()}
function drawHead0(F,c,ang,f,o){
  const P=o.face||{shape:'round',hs:1,jaw:0,chin:0,nose:'straight',brow:.4,browA:0,eye:.5,iris:'#2a1b14',mouth:'flat',guard:'#1f6fe0',ear:1,beardS:'full',hairV:(o.look&&o.look.hairStyle)||'crop',gray:0,cheek:.5,skinK:1};
  const L=P.hairTone?Object.assign({},o.look,{hair:P.hairTone}):o.look,skin=P.skinK!==1?shade(o.skinNow,P.skinK):o.skinNow,j=P.jaw,ch=P.chin,hv=P.hairV,hair=L.hair;
  const grayed=col=>P.gray>0?mixc(col,'#b9b9b9',P.gray*.55):col,hairC=grayed(hair),beardC=P.gray>0?mixc(hair,'#c8c8c8',P.gray*.7):hair;
  ctx.save();ctx.translate(c.x,c.y);ctx.rotate(ang);ctx.scale(f,1);ctx.scale(P.hs,P.hs);
  const SH={round:[13.2,13.8],long:[11.6,15.6],square:[12.9,14.2],wide:[14,13.6],egg:[12,15]}[P.shape]||[12.5,14.2],rx=SH[0],ry=SH[1];
  const sq=P.shape==='square'?1:P.shape==='egg'?-.8:0,jj=j+sq*.8;
  /* hair behind the skull */
  ctx.fillStyle=hairC;
  if(hv==='flow'){ctx.beginPath();ctx.moveTo(-10,-10);ctx.quadraticCurveTo(-19,4,-14,20);ctx.lineTo(-5,17);ctx.quadraticCurveTo(-8,6,-3,-4);ctx.fill()}
  if(hv==='halfshave'){ctx.beginPath();ctx.moveTo(-6,-13);ctx.quadraticCurveTo(-18,0,-12,16);ctx.lineTo(-6,13);ctx.quadraticCurveTo(-9,2,-2,-8);ctx.fill()}
  if(hv==='pony'){ctx.beginPath();ctx.moveTo(-11,-6);ctx.quadraticCurveTo(-22,-2,-19,14);ctx.quadraticCurveTo(-15,6,-9,1);ctx.fill()}
  if(hv==='afro'){ctx.beginPath();ctx.ellipse(-1,-6,rx+6,ry+3.5,0,0,7);ctx.fill();for(let i=0;i<14;i++){const a=Math.PI*(.75+i*.11);ell(Math.cos(a)*(rx+5)-1,Math.sin(a)*(ry+3)-6,3,3,hairC)}}
  if(hv==='dreads'){ctx.strokeStyle=hairC;ctx.lineWidth=2.6;ctx.lineCap='round';for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(-5-i*1.5,-13+i*2.3);ctx.quadraticCurveTo(-13-i,1+i*2,-10-i*.9,13+i*2.4);ctx.stroke()}}
  /* skull & face */
  const g=ctx.createRadialGradient(5,-7,2,0,0,17);g.addColorStop(0,shade(skin,1.18));g.addColorStop(.6,skin);g.addColorStop(1,shade(skin,.72));ctx.fillStyle=g;
  ctx.beginPath();ctx.ellipse(0,-1,rx,ry,0,0,Math.PI*2);ctx.fill();
  const NO={straight:[15.6,.8,13.6,-3],hook:[16.6,2,15.6,-4.5],flat:[14.8,1.8,13.4,-1.5],button:[14.6,.1,13.2,-2.4],big:[17.8,1.6,15,-3.6]}[P.nose]||[15.6,.8,13.6,-3];
  const nx=NO[0],ny=NO[1]+(P.crooked?.8:0),fx=rx-1.5;
  ctx.beginPath();ctx.moveTo(fx-.5,-7);ctx.quadraticCurveTo(NO[2]+(P.crooked?1:0),NO[3],nx,ny);
  if(P.nose==='flat'){ctx.quadraticCurveTo(nx+.4,ny+1.6,13,3.2)}else ctx.lineTo(13.2,2.6);
  const lipF=P.mouth==='full'?1:P.mouth==='thin'?-.6:0;
  ctx.quadraticCurveTo(14+lipF*.6,4.4,13.6+ch*.7+lipF*.4,6.2);
  ctx.quadraticCurveTo(13.8+ch*1.1,9+jj*.9,11.6+jj*1.1+ch*.6,10.6+jj*1.4);
  ctx.quadraticCurveTo(8+jj*2.4,14.4+jj*2,1+jj*.9,12.4+jj*1.8);ctx.lineTo(-4-jj*.8,8+jj*1.3);ctx.closePath();ctx.fill();
  /* hi-q face planes */
  {
   ell(fx-3.6,-3.2,3.8,2.8,'rgba(70,32,20,.20)');                               /* eye socket */
   ell(fx-1.2,4.2,2.2,1.1,'rgba(70,32,20,.22)');                                /* under the nose */
   ell(fx-2.6,-8.4,4.4,1.4,'rgba(255,240,225,.16)');                             /* brow ridge light */
   ell(fx-1.6,.6,1.4,2.8,'rgba(255,245,230,.16)');                               /* nose bridge light */
   const jg=ctx.createLinearGradient(0,6,0,14+jj*2);jg.addColorStop(0,'rgba(60,26,16,0)');jg.addColorStop(1,'rgba(60,26,16,.28)');ctx.fillStyle=jg;ctx.beginPath();ctx.moveTo(-4,8);ctx.quadraticCurveTo(6,14+jj*2,12,10+jj);ctx.lineTo(12,14+jj*2);ctx.lineTo(-4,14);ctx.fill();
   ell(-6,-4,4,7,'rgba(50,22,14,.14)')}                                          /* back of the skull falls into shadow */
  if(P.cleft){ctx.strokeStyle=shade(skin,.7);ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(12.4+ch*.6,10.2+jj*1.2);ctx.lineTo(11.6+ch*.6,11.6+jj*1.3);ctx.stroke()}
  /* cheekbone light, jaw shadow */
  ell(7.5,1.5,4.2,2.6,`rgba(255,240,225,${.08+P.cheek*.12})`);ell(4,9+jj,6,2.4,'rgba(60,28,18,.12)');
  if(P.freck)for(let i=0;i<7;i++)ell(7+(i*37%5),-1+(i*53%4),.45,.45,'rgba(120,60,30,.55)');
  if(P.gray>.3){ctx.strokeStyle=shade(skin,.72);ctx.lineWidth=.6;for(const y0 of [-9,-7.4]){ctx.beginPath();ctx.moveTo(4,y0);ctx.quadraticCurveTo(7,y0-.8,10,y0);ctx.stroke()}ctx.beginPath();ctx.moveTo(11.4,-1.2);ctx.quadraticCurveTo(12.6,.4,12.4,2);ctx.stroke()}
  if(P.tat){ctx.strokeStyle='rgba(20,24,40,.45)';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(3.5,3);ctx.quadraticCurveTo(6,1,8,3.4);ctx.quadraticCurveTo(6,4.6,4.5,6.4);ctx.stroke()}
  /* ear */
  const es=P.ear;if(P.cauli){ell(-2.8,1.5,4.2*es,5.4*es,shade(skin,.8));for(const [bx,by,br] of [[-3.6,-1.4,1.8],[-1.6,2.6,1.6],[-3.4,3.6,1.4]])ell(bx,by,br*es,br*es,shade(skin,.95));ctx.strokeStyle=shade(skin,.55);ctx.lineWidth=.7;ctx.beginPath();ctx.arc(-2.6,1.4,2.2,-1.4,1.8);ctx.stroke()}
  else{ell(-2.5,1.5,3.1*es,4.6*es,shade(skin,.86));ctx.strokeStyle=shade(skin,.6);ctx.lineWidth=.8;ctx.beginPath();ctx.arc(-2.3,1.5,1.8*es,-1.2,1.6);ctx.stroke()}
  if(P.stud)ell(-2.2,5.4*es,.9,.9,'#f4e2a0');
  /* swelling */
  {const dmg=clamp((100-o.head)/100,0,1);
   if(dmg>.15)ell(7,3,4.5,3.4,`rgba(170,50,60,${(dmg-.15)*.45})`);                         /* reddened cheek */
   if(dmg>.35){const a=clamp((dmg-.35)*1.1,0,.6);ell(fx-3.4,-2.2,4.4,3.6,`rgba(90,30,80,${a})`)}  /* black eye */
   if(dmg>.5){const a=clamp((dmg-.5)*1.2,0,.55);ell(fx-4,-6.8,4.6,2.6,`rgba(150,60,90,${a})`);ell(4,4,4,3,`rgba(120,40,70,${a*.7})`)} /* swollen brow */
   if(dmg>.7){ctx.strokeStyle='rgba(140,10,20,.85)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(10.5,7.8);ctx.lineTo(10.2,10.6);ctx.stroke()}}
  /* eye */
  const tired=o.mood==='tired',shut=o.mood==='ko'||o.mood==='hurt'||o.blink,ez2=.8+P.eye*.42,ex=fx-3.4;
  if(shut){ctx.strokeStyle='#2a1b14';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(ex-2.2,-2);ctx.quadraticCurveTo(ex,-1.2,ex+2,-2.2);ctx.stroke()}
  else if(o.head<30){ctx.strokeStyle='#2a1b14';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(ex-2.4,-2.4);ctx.quadraticCurveTo(ex,-1.6,ex+2.2,-2.4);ctx.stroke()}
  else{ell(ex,-2.6,2.7*ez2,1.6*ez2,'#f2ece4');ell(ex+.9,-2.6,1.35*ez2,1.4*ez2,P.iris||'#2a1b14');ell(ex+1,-2.6,.6*ez2,.65*ez2,'#0e0806');ell(ex+1.2,-3,.4,.4,'#fff');ctx.strokeStyle='#22140e';ctx.lineWidth=.85;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(ex-2.6,-2.9);ctx.quadraticCurveTo(ex-.2,-4.6*ez2,ex+2.7,-3.1);ctx.stroke();ctx.strokeStyle='rgba(70,32,20,.35)';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(ex-1.8,-.9);ctx.quadraticCurveTo(ex,-.4,ex+2,-1.1);ctx.stroke();
    if(P.lid||tired){ctx.fillStyle=shade(skin,.8);ctx.beginPath();ctx.ellipse(ex,-3.5+(tired?.7:0),3*ez2,tired?1.7:1.15,0,Math.PI,0);ctx.fill()}
    if(P.gray>.4)ell(ex,-.6,2.4,.7,'rgba(90,40,30,.18)')}
  /* brow */
  ctx.strokeStyle=shade(hairC==='#000000'?'#1a1310':(P.hairTone&&P.hairTone==='#e1cfa0'?'#a8875a':hairC),.85);ctx.lineWidth=1.2+P.brow*2.6;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(ex-4,-6.8-P.browA*1);ctx.quadraticCurveTo(ex-.5,-8,ex+3,-6.2+P.browA*1.2);ctx.stroke();
  if(P.scar){ctx.strokeStyle=skin;ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(ex-.6,-8.6);ctx.lineTo(ex+.6,-5.6);ctx.stroke();ctx.strokeStyle='rgba(255,235,220,.5)';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(ex-1.2,-10);ctx.lineTo(ex+1.4,-3.8);ctx.stroke()}
  if(P.scar2){ctx.strokeStyle='rgba(255,230,215,.45)';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(5,3);ctx.quadraticCurveTo(7,5,9.5,4.4);ctx.stroke()}
  /* nose line, tape */
  ctx.strokeStyle=shade(skin,.6);ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(nx-1.6,ny+.7);ctx.quadraticCurveTo(13,2.8,12,2.1);ctx.stroke();
  if(P.tape){ctx.fillStyle='rgba(245,240,230,.9)';ctx.save();ctx.translate(nx-2.6,ny-2.6);ctx.rotate(.5);ctx.fillRect(-2.2,-.9,4.4,1.8);ctx.restore()}
  /* mouth */
  const my=6.6+lipF*.2;
  if(tired){const g2=1.3+Math.abs(Math.sin((o.t||0)*.24))*1.1;ell(12,7.2,2,g2,'#3a1414')}else if(o.mood==='hurt'||o.mood==='yell'){ell(12.2,7,2.3,1.6,'#3a1414');ctx.fillStyle=P.guard||o.corner;ctx.fillRect(10.9,6,2.8,1.3)}
  else{ctx.strokeStyle=P.mouth==='full'?'#7a3a2e':'#5a2e24';ctx.lineWidth=P.mouth==='full'?1.6:P.mouth==='thin'?.8:1.1;ctx.beginPath();
    if(P.mouth==='smirk'){ctx.moveTo(10.4,my+.5);ctx.quadraticCurveTo(12,my+.3,13.2,my-.6)}else if(P.mouth==='frown'){ctx.moveTo(10.4,my-.2);ctx.quadraticCurveTo(12,my-.5,13.2,my+.5)}else{ctx.moveTo(10.6,my+.2);ctx.lineTo(13.1,my)}ctx.stroke();ell(11.9,my+1.3,1.5,.55,'rgba(150,70,60,.35)')}
  /* hair on top */
  const hs=L.hairStyle;ctx.fillStyle=hairC;
  const cap=(a=1)=>{ctx.globalAlpha=a;ctx.beginPath();ctx.moveTo(-rx+.1,4);ctx.quadraticCurveTo(-rx-2,-12,-2,-ry-1.4);ctx.quadraticCurveTo(8,-ry-1.8,fx-.3,-8.4);ctx.quadraticCurveTo(7,-10.6,3,-9.6);ctx.quadraticCurveTo(-4,-8,-6,-1);ctx.quadraticCurveTo(-8,3,-rx+.1,4);ctx.fill();ctx.globalAlpha=1};
  if(hv==='bald'){ell(2,-11,5,2.4,'rgba(255,255,255,.2)',-.3)}
  else if(hv==='shaved'){cap(.22);ell(2,-11,5,2.4,'rgba(255,255,255,.16)',-.3)}
  else if(hv==='buzz'){cap(.6);}
  else if(hv==='lines'){cap(.6);ctx.strokeStyle=skin;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(-9,-4);ctx.quadraticCurveTo(-4,-9,1,-6);ctx.moveTo(-8,-1);ctx.lineTo(-3,-3);ctx.stroke()}
  else if(hv==='fade'){cap(.35);ctx.beginPath();ctx.ellipse(1,-12.5,9,4.4,-.1,0,7);ctx.fill()}
  else{cap(1);
    if(hv==='curly')for(let i=0;i<9;i++){const a=Math.PI*(1.02+i*.11);ell(Math.cos(a)*rx+1,Math.sin(a)*ry-2,3.3,3,hairC)}
    if(hv==='spiky'){ctx.beginPath();for(let i=0;i<6;i++){const a=Math.PI*(1.12+i*.13),x0=Math.cos(a)*rx+1,y0=Math.sin(a)*ry-2;ctx.moveTo(x0-2.6,y0+2);ctx.lineTo(x0+Math.cos(a)*5.5,y0+Math.sin(a)*5.5-1);ctx.lineTo(x0+2.6,y0+2)}ctx.fill()}
    if(hv==='side'){ctx.beginPath();ctx.moveTo(-4,-ry);ctx.quadraticCurveTo(10,-ry-3,fx+2.4,-8);ctx.quadraticCurveTo(8,-11,2,-10);ctx.closePath();ctx.fill()}
    if(hv==='slick'){ctx.beginPath();ctx.moveTo(fx-1,-9);ctx.quadraticCurveTo(4,-ry-4,-rx-1,-4);ctx.quadraticCurveTo(-6,-8,fx-1,-9);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=.7;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(fx-3-i,-10-i*1.4);ctx.quadraticCurveTo(0,-ry-1.5+i*1.6,-rx+1,-5+i*1.5);ctx.stroke()}}
    if(hv==='faux'||hv==='fauxdye'||hs==='mohawk'){ctx.fillStyle=hv==='fauxdye'?(P.dye||'#e8b33a'):hairC;ctx.beginPath();ctx.moveTo(-7,-ry+2);ctx.quadraticCurveTo(0,-ry-(hs==='mohawk'?10:6),fx-1,-ry+3);ctx.lineTo(fx-3,-9);ctx.quadraticCurveTo(0,-ry-1,-6,-8);ctx.fill();ctx.fillStyle=hairC}
    if(hs==='mohawk'){ctx.fillStyle=skin;ctx.globalAlpha=.75;ctx.beginPath();ctx.moveTo(-rx+.5,2);ctx.quadraticCurveTo(-rx-1,-6,-7,-10);ctx.lineTo(-5,-2);ctx.closePath();ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=hairC}
    if(hv==='receding'){ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(6.5,-11,6.5,3.8,-.35,0,7);ctx.fill();ctx.fillStyle=hairC}
    if(hv==='cornrow'){ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=.8;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(8-i*1.5,-9.5-i*1.4);ctx.quadraticCurveTo(-2,-14.5+i*2,-11.5,-3+i*2.2);ctx.stroke()}}
    if(hv==='halfshave'){ctx.fillStyle=skin;ctx.globalAlpha=.7;ctx.beginPath();ctx.ellipse(-4,-1,5,6,0,0,7);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=hairC}
    if(hv==='bun'||hv==='manbun')ell(-10,-12.5,5,4.6,hairC);
    if(hv==='topknot'){ell(-2,-ry-3,4,4,hairC);ctx.fillRect(-3.4,-ry-1,2.8,2)}
    if(P.dye&&hv!=='fauxdye'){ctx.fillStyle=P.dye;ctx.globalAlpha=.85;ctx.beginPath();ctx.moveTo(fx-1,-8.6);ctx.quadraticCurveTo(6,-ry-1,0,-ry-.6);ctx.quadraticCurveTo(5,-11,fx-1,-8.6);ctx.fill();ctx.globalAlpha=1}
    ctx.save();ctx.beginPath();ctx.moveTo(-rx+.1,4);ctx.quadraticCurveTo(-rx-2,-12,-2,-ry-1.4);ctx.quadraticCurveTo(8,-ry-1.8,fx-.3,-8.4);ctx.quadraticCurveTo(7,-10.6,3,-9.6);ctx.quadraticCurveTo(-4,-8,-6,-1);ctx.quadraticCurveTo(-8,3,-rx+.1,4);ctx.clip();
      ctx.lineCap='round';for(let i=0;i<0;i++){const u=i/15,x0=fx-2-u*(rx+fx-1),y0=-9.5-Math.sin(u*Math.PI)*4.5;ctx.strokeStyle=i%3?'rgba(0,0,0,.22)':'rgba(255,255,255,.16)';ctx.lineWidth=i%3?.55:.45;ctx.beginPath();ctx.moveTo(x0,y0);ctx.quadraticCurveTo(x0-3,y0+2.5+u*2,x0-4.5-u*2,y0+6+u*4);ctx.stroke()}
      const hg=ctx.createLinearGradient(0,-ry-2,0,4);hg.addColorStop(0,'rgba(255,255,255,.14)');hg.addColorStop(.45,'rgba(255,255,255,0)');hg.addColorStop(1,'rgba(0,0,0,.28)');ctx.fillStyle=hg;ctx.fillRect(-rx-4,-ry-4,rx*2+8,ry+10);ctx.restore();
    ctx.fillStyle='rgba(255,255,255,.12)';ctx.beginPath();ctx.ellipse(1,-12.5,5,1.6,-.2,0,7);ctx.fill()}
  if(P.gray>.2&&hv!=='bald'){ctx.fillStyle=`rgba(225,225,225,${P.gray*.55})`;ctx.beginPath();ctx.ellipse(-5,-1,3.4,4.8,.2,0,7);ctx.fill()}
  if(P.band){ctx.strokeStyle=P.band;ctx.lineCap='butt';ctx.lineWidth=2.8;ctx.beginPath();ctx.moveTo(fx-.2,-8.2);ctx.quadraticCurveTo(2,-11.6,-rx+.4,-6.4);ctx.stroke();ctx.lineWidth=1.5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-rx+.8,-6.6);ctx.quadraticCurveTo(-rx-4,-5,-rx-5,0);ctx.moveTo(-rx+.8,-6);ctx.quadraticCurveTo(-rx-2.6,-2,-rx-2.4,3);ctx.stroke()}
  /* facial hair */
  if((P.side||L.beard)&&hv!=='bald'&&hv!=='shaved'){ctx.fillStyle=beardC;ctx.globalAlpha=.7;ctx.beginPath();ctx.moveTo(.8,-4.5);ctx.lineTo(2.6,-4.5);ctx.lineTo(2.3,3.2);ctx.lineTo(1.2,3.2);ctx.closePath();ctx.fill();ctx.globalAlpha=1}
  if(L.beard){const bs=P.beardS,jy=jj*1.4;ctx.fillStyle=beardC;ctx.strokeStyle=beardC;
    if(bs==='full'||bs==='stubble'||bs==='long'){ctx.globalAlpha=bs==='stubble'?.36:.93;ctx.beginPath();ctx.moveTo(-1,4);ctx.quadraticCurveTo(2,10.5+jy,6,12.6+jy+(bs==='long'?6:0));ctx.quadraticCurveTo(10.4,13+jy+(bs==='long'?7:0),12.4,9.4+jy*.6);ctx.lineTo(13.2,7.4);ctx.lineTo(10.4,8.4);ctx.quadraticCurveTo(6,8,1,2.6);ctx.closePath();ctx.fill();
      if(bs!=='stubble'){ctx.beginPath();ctx.moveTo(9.6,6.1);ctx.quadraticCurveTo(12,4.4,14,5.8);ctx.quadraticCurveTo(12.2,6,9.6,6.9);ctx.fill()}}
    else if(bs==='goatee'){ctx.globalAlpha=.92;ctx.beginPath();ctx.moveTo(9.6,8.4);ctx.quadraticCurveTo(13.2,8.6,12.6,11+jy*.6);ctx.quadraticCurveTo(10,14+jy,7.4,12.4+jy);ctx.closePath();ctx.fill();ctx.fillRect(10.2,5.2,3.2,.9)}
    else if(bs==='mustache'){ctx.globalAlpha=.95;ctx.beginPath();ctx.moveTo(9.2,6.3);ctx.quadraticCurveTo(12,4.2,14.2,5.8);ctx.quadraticCurveTo(12.2,6,9.2,7.5);ctx.closePath();ctx.fill()}
    else if(bs==='horse'){ctx.globalAlpha=.95;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(10.4,10.6+jy*.5);ctx.lineTo(10.6,6.2);ctx.quadraticCurveTo(12.4,4.6,14,5.8);ctx.stroke()}
    else if(bs==='soul'){ctx.globalAlpha=.95;ell(12.2,8.6,1,1.3,beardC)}
    else{ctx.globalAlpha=.9;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(-1.5,4);ctx.quadraticCurveTo(3,11+jy,8,12.8+jy);ctx.quadraticCurveTo(11.6,12.6+jy,12.4,10+jy*.6);ctx.stroke()}
    ctx.globalAlpha=1;}
  // cuts & blood
  const cuts=Math.min(5,o.cuts|0);
  if(o.head<85&&cuts>0){const gx=ex-1,gy=-8.6;ctx.lineCap='round';ctx.strokeStyle='#5e0710';ctx.lineWidth=1+cuts*.18;ctx.beginPath();ctx.moveTo(gx-2.4,gy+.4);ctx.quadraticCurveTo(gx,gy-.5,gx+2.6,gy+.2);ctx.stroke();
    ctx.strokeStyle='rgba(210,40,50,.7)';ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(gx-1.8,gy+.1);ctx.quadraticCurveTo(gx,gy-.5,gx+2,gy);ctx.stroke();
    const len=clamp((80-o.head)/5,1.5,9)+cuts;ctx.strokeStyle='rgba(140,8,18,.75)';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(gx+1.2,gy+.4);ctx.quadraticCurveTo(gx+2.1,gy+len*.5,gx+1.6,gy+len);ctx.stroke()}
  const bl=clamp((o.cuts||0)*.5+(100-o.head)/30,0,6);
  if(bl>.8){ctx.strokeStyle='rgba(150,10,20,.85)';ctx.lineWidth=1.3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(13.6,2.5);ctx.quadraticCurveTo(13.8,5,12.8,8.5);ctx.stroke()}
  if(bl>2){ctx.fillStyle='rgba(140,8,18,.55)';ctx.beginPath();ctx.ellipse(11.8,8.2,2.6,1.4,0,0,7);ctx.fill();ctx.strokeStyle='rgba(140,8,18,.8)';ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(10.5,9.5);ctx.quadraticCurveTo(10,12,10.8,14.5);ctx.stroke()}
  if(bl>3){ctx.fillStyle='rgba(130,6,16,.16)';ctx.beginPath();ctx.ellipse(8.5,-3,3.6,4.4,0,0,7);ctx.fill();ctx.strokeStyle='rgba(150,10,20,.6)';ctx.lineWidth=.95;for(const [x0,y0,l] of [[8,-6,10],[10,-5,12]]){ctx.beginPath();ctx.moveTo(x0,y0);ctx.quadraticCurveTo(x0+1,y0+l*.5,x0-.5,y0+l);ctx.stroke()}}
  if(o.sweat>.3){ell(6,-10,1.2,.7,`rgba(255,255,255,${o.sweat*.6})`);ell(2,-8,1,.6,`rgba(255,255,255,${o.sweat*.5})`)}
  ctx.restore();
  if(o.rocked){for(let i=0;i<3;i++){const a=o.t*.12+i*2.1;ell(c.x+Math.cos(a)*21,c.y-23+Math.sin(a)*5,2.6,2.6,'#ffd75e')}}
}

/* draw a full figure from joints */
function drawBody(F,J){
  const bd=buildOf(F);if(!bd)return drawBody0(F,J);
  const ax=J.hip.x,ay=Math.max(J.hip.y,J.nearFoot.y,J.farFoot.y),M=p=>p&&{x:ax+(p.x-ax)*bd[0],y:ay+(p.y-ay)*bd[1]};
  ctx.save();ctx.translate(ax,ay);ctx.scale(bd[0],bd[1]);ctx.translate(-ax,-ay);const r=drawBody0(F,J);ctx.restore();
  return{head:M(r.head),handN:M(r.handN),handF:M(r.handF),footF:M(r.footF)}}
function drawBody0(F,J){TEXON=texSet(F);try{return drawBody0_(F,J)}finally{TEXON=null}}
function drawBody0_(F,J){
  /* stance depth: the lead (forward) arm and leg sit on the camera side only when the fighter's lead side faces the camera.
     orthodox facing right / southpaw facing left → lead limbs near; otherwise they swing behind the torso */
  const sw=!!J.swapD;if(sw)J=Object.assign({},J,{nearHand:J.farHand,farHand:J.nearHand,nearFoot:J.farFoot,farFoot:J.nearFoot,kneeN:J.kneeF,kneeF:J.kneeN,elbN:J.elbF,elbF:J.elbN,footN:J.footF,footF:J.footN});
  const f=J.f,o=F.kind==='ref'?F:fighterLook(F,J);
  const skin=o.skinNow,skinD=shade(o.look.skin,.8);
  const sp=vsub(J.chest,J.hip),sd=vn(sp),fwd=vmul({x:-sd.y,y:sd.x},f);
  const shB=vadd(J.chest,vmul(sd,-5));
  const tw=J.twist||0,ht=J.hipTwist||0;
  const shL=vadd(vadd(shB,vmul(fwd,4-tw*6)),vmul(sd,tw<0?tw*1.5:0)),shR=vadd(vadd(shB,vmul(fwd,-5+tw*9)),vmul(sd,tw>0?-tw*1.5:0));
  const hpL=vadd(J.hip,vmul(fwd,3-ht*3)),hpR=vadd(J.hip,vmul(fwd,-3+ht*8));
  const shN=sw?shR:shL,shF=sw?shL:shR,hipN=sw?hpR:hpL,hipF=sw?hpL:hpR;
  const head=J.head||vadd(vadd(vadd(J.chest,vmul(sd,21)),vmul(fwd,3)),J._hd?{x:J._hd.x*.5,y:J._hd.y*.5}:{x:0,y:0});
  const hAng=Math.atan2(sd.y,sd.x)+Math.PI/2+(J.tilt||0)*f;
  const legF=ik(hipF,J.farFoot,46,44,J.kneeF||'fwd',f),legN=ik(hipN,J.nearFoot,46,44,J.kneeN||'fwd',f);
  const armF=ik(shF,J.farHand,27,26,J.elbF||'down',f),armN=ik(shN,J.nearHand,27,26,J.elbN||'down',f);
  const pants=o.pants,legCol=pants?'#3b3f47':null;
  if(J._only==='legN'){limb(hipN,legN.j,legN.end,PROF.leg,1,legCol||skin,{flat:!!legCol,sheen:o.sweat*.25,bellies:[[.45,.16],[1.3,.14]]});foot(legN.end,J.footN||f,skin,o);shortsLeg(hipN,legN.j,o,false,legN.end);return{head}}
  if(J._only==='armN'){limb(shN,armN.j,armN.end,PROF.arm,1,skin,{sheen:o.sweat*.25,bellies:[[.42,.2],[1.25,.14]]});glove(armN.end,Math.atan2(armN.end.y-armN.j.y,armN.end.x-armN.j.x),o,false);return{head}}
  // far leg
  limb(hipF,legF.j,legF.end,PROF.leg,.94,legCol?shade(legCol,.72):shade(o.look.skin,.7),{flat:!!legCol,bellies:[[.45,.12],[1.3,.1]]});foot(legF.end,J.footF||f,skinD,o);
  shortsLeg(hipF,legF.j,o,true,legF.end);
  // far arm
  limb(shF,armF.j,armF.end,PROF.arm,.92,skinD,{bellies:[[.45,.12],[1.25,.1]]});
  if(o.shirt)sleeve(shF,armF.j,armF.end,shade(o.shirt,.75));
  glove(armF.end,Math.atan2(armF.end.y-armF.j.y,armF.end.x-armF.j.x),o,true);
  // near leg
  limb(hipN,legN.j,legN.end,PROF.leg,1,legCol||skin,{flat:!!legCol,sheen:o.sweat*.25,bellies:[[.45,.16],[1.3,.14]]});foot(legN.end,J.footN||f,skin,o);
  if(!pants&&o.legs<55){const m=vl(hipN,legN.j,.65);ell(m.x,m.y,6.5,8,`rgba(120,30,70,${clamp((55-o.legs)/100,0,.45)})`);const m2=vl(legN.j,legN.end,.25);ell(m2.x,m2.y,5,6,`rgba(120,30,70,${clamp((55-o.legs)/120,0,.35)})`)}
  shortsLeg(hipN,legN.j,o,false,legN.end);
  // torso
  drawTorso(F,J.hip,J.chest,f,o);
  waistband(F,J.hip,J.chest,f,o);
  // neck & head
  {const n0=vadd(J.chest,vmul(sd,-3)),n1=vadd(head,vmul(sd,-5));capsule(vadd(n0,vmul(fwd,-1)),n1,9.2,7.4,shade(o.look.skin,.92),0);
   const tr=ctx.createRadialGradient(n0.x,n0.y,0,n0.x,n0.y,10);tr.addColorStop(0,'rgba(70,30,18,.18)');tr.addColorStop(1,'rgba(70,30,18,0)');ctx.fillStyle=tr;ctx.fillRect(n0.x-10,n0.y-10,20,20)}
  drawHead(F,head,hAng,f,o);
  // near arm
  limb(shN,armN.j,armN.end,PROF.arm,1,skin,{sheen:o.sweat*.25,bellies:[[.42,.2],[1.25,.14]]});
  {const dg=ctx.createRadialGradient(shN.x+fwd.x*2,shN.y-3,0,shN.x,shN.y,10);dg.addColorStop(0,'rgba(255,240,225,.22)');dg.addColorStop(1,'rgba(255,240,225,0)');ctx.fillStyle=dg;ctx.beginPath();ctx.arc(shN.x,shN.y,9,0,7);ctx.fill()}
  if(o.shirt)sleeve(shN,armN.j,armN.end,o.shirt);
  glove(armN.end,Math.atan2(armN.end.y-armN.j.y,armN.end.x-armN.j.x),o,false);
  return sw?{head,handN:armF.end,handF:armN.end,footF:legN.end}:{head,handN:armN.end,handF:armF.end,footF:legF.end};
}
/* weight class → body build [width, height]; each fighter's listed height nudges it further */
const BUILD={fly:[.86,.92],bw:[.92,.96],fw:[.93,.96],lw:[1,1],ww:[1.06,1.02],mw:[1.11,1.05],lhw:[1.17,1.07],hw:[1.23,1.09]};
function buildOf(F){if(F.kind==='ref'||F.noBuild)return null;const d=F.d;if(!d||!d.cls)return null;const b=BUILD[d.cls]||BUILD[(IC.CLSMAP||{})[d.cls]]||[1,1];
  const C=(IC.CLASSES8||[]).find(c=>c.id===d.cls);let sy=b[1];if(C&&d.height){const mid=(C.h[0]+C.h[1])/2;sy*=1+clamp((d.height-mid)/360,-.04,.04)}return [b[0],sy]}
function fighterLook(F,J){
  const L=lookOf(F);
  return{look:L,kind:'fighter',logo:'IC',shirt:F.walkShirt?shade(F.walkShirt,.55):null,skinNow:F.flash?shade(L.skin,1.3):L.skin,trunk:L.trunk,corner:F.corner,tattoo:L.tattoo,
    head:F.head??100,body:F.body??100,legs:F.legs??100,cuts:F.cuts||0,sweat:clamp(1-(F.st??100)/100,0,1)*.8+.15,
    rocked:F.rocked>0&&F.state!=='ko',t:F._t||0,mood:J.mood,face:faceOf(F),belly:F.d&&/^(hw|lhw)$/.test(F.d.cls)&&faceOf(F).belly>.5?(faceOf(F).belly-.5)*2:0};
}
const REF={kind:'ref',look:{skin:'#e1b28e',hair:'#2b2b2b',hairStyle:'buzz',beard:false},skinNow:'#e1b28e',shirt:'#15161a',pants:true,corner:'#888',head:100,body:100,legs:100,cuts:0,sweat:0,t:0};

/* ---------- poses ---------- */
function ext(F){
  if(F.state!=='attack'||!F.A)return 0;const A=F.A;
  if(F.t<A.w){const p=F.t/A.w;return -.24*p*p*(3-2*p)}
  if(F.t<A.w+A.a){const p=(F.t-A.w)/Math.max(1,A.a);return 1+.09*Math.sin(Math.min(1,p*1.6)*Math.PI)}
  const p=Math.min(1,(F.t-A.w-A.a)/A.r);return Math.max(0,1-p*p*(3-2*p));
}
/* real kick mechanics: knee chambers first, the shin whips out on an arc, re-chambers, then steps down */
/* ================= motion capture retarget (Mixamo, side view) =================
   IC.MOCAP[key].d = frames of 15 joints (x forward, y up, hip height = 1000). Each segment's DIRECTION comes from the
   capture and its LENGTH from our rig, so the 2D fighter moves like a person but keeps its proportions. */
const MCJ=['hip','chest','head','nS','nE','nH','fS','fE','fH','nK','nF','fK','fF','nT','fT'];
const MCI={};
function mcInfo(key){if(MCI[key])return MCI[key];const M=IC.MOCAP&&IC.MOCAP[key];if(!M)return null;
  const g=(fr,j)=>{const i=MCJ.indexOf(j)*2;return{x:fr[i]/1000,y:fr[i+1]/1000}},f0=M.d[0],L=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const arm=L(g(f0,'nS'),g(f0,'nE'))+L(g(f0,'nE'),g(f0,'nH')),leg=L(g(f0,'hip'),g(f0,'nK'))+L(g(f0,'nK'),g(f0,'nF'));
  return MCI[key]={M,g,arm,leg}}
/* the frame where a limb is most extended (x forward or y up) */
function mcPeak(key,j,axis){const I=mcInfo(key);if(!I)return 0;let b=-1e9,bi=0;I.M.d.forEach((fr,i)=>{const p=I.g(fr,j),h=I.g(fr,'hip'),v=axis==='y'?p.y:p.x-h.x;if(v>b){b=v;bi=i}});return bi/(I.M.n-1)}
function mcPose(F,key,u,o={}){const I=mcInfo(key);if(!I)return null;const M=I.M,n=M.n,q=clamp(u,0,1)*(n-1),i0=Math.floor(q),i1=Math.min(n-1,i0+1),k=q-i0;
  const P=j=>{const a=I.g(M.d[i0],j),b=I.g(M.d[i1],j);return{x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k}};
  const sw=o.swap,N=sw?'f':'n',Fr=sw?'n':'f',f=F.f,x=F.x+(o.dx||0),K=90/I.leg;
  const hp=P('hip'),hip={x:x+f*hp.x*K*(o.travel??1),y:GY-hp.y*K*.98};
  const dirTo=(a,b,len)=>{const d=Math.hypot(b.x-a.x,b.y-a.y)||1;return{x:(b.x-a.x)/d*len,y:(b.y-a.y)/d*len}};
  const W=(base,a,b,len)=>{const d=dirTo(P(a),P(b),len);return{x:base.x+f*d.x,y:base.y-d.y}};
  const chest=W(hip,'hip','chest',66),head=W(chest,'chest','head',23);
  const ka=53/I.arm,kl=90/I.leg,rel=(base,a,b,kk)=>{const A=P(a),B=P(b);return{x:base.x+f*(B.x-A.x)*kk,y:base.y-(B.y-A.y)*kk}};
  const shN={x:chest.x+f*4,y:chest.y+5},shF={x:chest.x-f*5,y:chest.y+5};
  const out={f,hip,chest,head,tilt:0,mood:o.mood||null,
    nearHand:rel(shN,N+'S',N+'H',ka),farHand:rel(shF,Fr+'S',Fr+'H',ka),elbN:rel(shN,N+'S',N+'E',ka),elbF:rel(shF,Fr+'S',Fr+'E',ka),
    nearFoot:rel(hip,'hip',N+'F',kl),farFoot:rel(hip,'hip',Fr+'F',kl),kneeN:rel(hip,'hip',N+'K',kl),kneeF:rel(hip,'hip',Fr+'K',kl),twist:0,hipTwist:0};
  if(o.footH!=null){const pk=o.footPk||1;out.farFoot.y=hip.y+(out.farFoot.y-hip.y)*1;const lift=GY-out.farFoot.y;out.farFoot.y=GY-lift*o.footH/Math.max(1,pk)}
  for(const q of ['nearFoot','farFoot'])out[q].y=Math.min(out[q].y,GY);
  return out}
/* blend two rig poses (bend hints switch halfway) */
function mixJ(A,B,w){if(w<=0)return A;if(w>=1)return B;const o={...A};
  for(const q of ['hip','chest','nearHand','farHand','nearFoot','farFoot'])o[q]={x:A[q].x+(B[q].x-A[q].x)*w,y:A[q].y+(B[q].y-A[q].y)*w};
  if(B.head)o.head=A.head?{x:A.head.x+(B.head.x-A.head.x)*w,y:A.head.y+(B.head.y-A.head.y)*w}:null;
  for(const q of ['kneeN','kneeF','elbN','elbF'])o[q]=w>.5?B[q]:A[q];o.tilt=(A.tilt||0)*(1-w);return o}
/* additive mocap: keep OUR stance/strike as the base pose and add only the captured MOVEMENT on top
   (joint offset from the clip's first frame). This keeps the bladed side stance and our strike targets,
   and borrows the weight shift, torso lean, head snap and guard motion from the real capture. */
function mcDelta(F,key,u,swap){const I=mcInfo(key);if(!I)return null;const M=I.M,n=M.n,q=clamp(u,0,1)*(n-1),i0=Math.floor(q),i1=Math.min(n-1,i0+1),k=q-i0;
  const P=(fr,j)=>I.g(fr,j),at=j=>{const a=P(M.d[i0],j),b=P(M.d[i1],j);return{x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k}},r0=j=>P(M.d[0],j),S=90/I.leg,f=F.f;
  const N=swap?'f':'n',Fr=swap?'n':'f',D=j=>{const a=at(j),b=r0(j);return{x:(a.x-b.x)*S*f,y:-(a.y-b.y)*S}};
  return{hip:D('hip'),chest:D('chest'),head:D('head'),nearHand:D(N+'H'),farHand:D(Fr+'H'),nearFoot:D(N+'F'),farFoot:D(Fr+'F')}}
function addJ(J,d,g){if(!d)return J;const o={...J};for(const q in g){if(!d[q]||!J[q]&&q!=='head')continue;const gg=g[q];
    if(q==='head'){if(J.head)o.head={x:J.head.x+d.head.x*gg,y:J.head.y+d.head.y*gg};else o._hd={x:d.head.x*gg,y:d.head.y*gg};continue}
    o[q]={x:J[q].x+d[q].x*gg,y:J[q].y+d[q].y*gg}}
  /* hands follow the chest, feet stay planted unless asked */
  /* guard hands ride with the head (that is where they protect) */
  for(const q of ['nearHand','farHand'])if(!(q in g)&&d.head){const gh=(g.head||0)*.5+(g.chest||0)*.5,mx={x:(d.head.x+d.chest.x)/2,y:(d.head.y+d.chest.y)/2};o[q]={x:J[q].x+mx.x*gh,y:J[q].y+mx.y*gh}}
  for(const q of ['nearFoot','farFoot'])if(o[q])o[q].y=Math.min(o[q].y,GY);return o}
const MC_ATK={jab:{k:'Punching',lim:'nH'},cross:{k:'Cross_Punch',lim:'fH'},hook:{k:'Hook_2',lim:'nH'},midkick:{k:'Roundhouse_Kick',lim:'nF',swap:1,axis:'y',h:1.15},highkick:{k:'Roundhouse_Kick',lim:'nF',swap:1,axis:'y',h:1.7}};
/* map the game's windup/active/recovery frames onto the capture: start → impact → settle */
function mcAttack(F,base){const A=F.A,m=A&&MC_ATK[A.anim];if(!m||!mcInfo(m.k))return base;
  const imp=m.imp??(m.imp=mcPeak(m.k,m.lim,m.axis)),s0=imp*.35,s1=Math.min(1,imp+(1-imp)*.55),t=F.t,w=A.w,a=Math.max(1,A.a),r=Math.max(1,A.r);
  let u;if(t<w+a*.4)u=lerp(s0,imp,Math.min(1,t/(w+a*.4)));else u=lerp(imp,s1,Math.min(1,(t-w-a*.4)/(a*.6+r)));
  const d0=mcDelta(F,m.k,s0,m.swap),d=mcDelta(F,m.k,u,m.swap);if(!d||!d0)return base;
  for(const q in d)d[q]={x:d[q].x-d0[q].x,y:d[q].y-d0[q].y};/* motion relative to the windup start, not the clip's first frame */
  const kick=/kick/.test(A.anim),g=kick?{hip:0,chest:0,head:0,nearHand:0,nearFoot:0}:A.anim==='hook'?{hip:.4,chest:.35,head:.35,nearFoot:.2,farFoot:.2}:{hip:.6,chest:.85,head:.8,nearFoot:.2,farFoot:.25};
  if(kick){d.hip.y=0;d.nearFoot={x:0,y:0};d.nearHand.y=Math.max(-12,Math.min(12,d.nearHand.y))}
  const edge=clamp(Math.min(1,t/3,(w+a+r-t)/4),0,1);for(const q in g)g[q]*=edge;const o=addJ(base,d,g);
  /* the free hand guards the chin, in front of the face rather than over the head */
  if(!kick){const q=(m.hand||m.lim)==='nH'?'farHand':'nearHand',G={x:o.chest.x+F.f*(q==='nearHand'?24:17),y:o.chest.y-30};o[q]={x:lerp(o[q].x,G.x,edge),y:lerp(o[q].y,G.y,edge)};o[q==='nearHand'?'elbN':'elbF']='down'}
  return o}
function mcLoop(F,key,t,speed=1,o={}){const I=mcInfo(key);if(!I)return null;const u=((t*speed/4)/(I.M.n))%1;return mcPose(F,key,u,o)}
function kickPath(F,A,x,f,an){const H={lowkick:40,midkick:112,highkick:188}[an],R={lowkick:100,midkick:112,highkick:106}[an];
  /* clean kick, no flapping: the knee lifts toward the target with the shin hanging straight down under it, then the foot travels
     in a straight line out to the target (sideways for body/head, low and level for the leg), and comes back along the same line. */
  const hipY=GY-92,sm=p=>p*p*(3-2*p),W=(u,y)=>({x:x+f*u,y}),L=(a,b,k)=>({x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k});
  const B0=W(-24,GY),T=W(R,GY-H);
  const Kc={lowkick:W(30,hipY+14),midkick:W(34,hipY-4),highkick:W(32,hipY-30)}[an];/* chambered knee */
  const Fc={x:Kc.x-f*4,y:Kc.y+46};/* foot hanging under the knee */
  const Kx=W(R*.52,(Kc.y+T.y)/2+(an==='lowkick'?6:-6));/* knee at full extension: on the hip→foot line, leg nearly straight */
  const t=F.t,w=A.w,a=Math.max(1,A.a),r=Math.max(1,A.r);let foot,knee,ext=0,pivot=0;
  const K0=W(10,GY-50);
  if(t<w){const p=sm(t/w);knee=L(K0,Kc,p);foot=L(B0,Fc,p);if(p<.5)foot.y=Math.min(foot.y,GY-2-p*40);pivot=p*.5}
  else if(t<w+a){const p=sm(Math.min(1,(t-w)/a));foot=L(Fc,T,p);knee=L(Kc,Kx,p);ext=p;pivot=.5+p*.5}
  else{const p=Math.min(1,(t-w-a)/r);
    if(p<.45){const q=sm(p/.45);foot=L(T,Fc,q);knee=L(Kx,Kc,q);ext=1-q;pivot=1}
    else{const q=sm((p-.45)/.55);foot=L(Fc,B0,q);knee=L(Kc,W(-4,(hipY+GY)/2),q);pivot=1-q}}
  return{foot,knee,ext,pivot}}
function poseStand(F,O,S){
  const x=F.x,f=F.f,A=F.A,an=A&&A.anim,t=S.frame,st=F.state,isK=st==='attack'&&(an==='lowkick'||an==='midkick'||an==='highkick'),kpv=isK?kickPath(F,A,x,f,an).pivot:0,E=isK?kpv*kpv*(3-2*kpv):ext(F),e=Math.max(E,0);/* kicks: one smooth progress curve drives everything, so nothing snaps when the windup ends */
  const bob=st==='stroll'?-Math.abs(Math.sin(F.walk))*3.5:(st==='idle'||st==='block'||st==='walk')?Math.sin(t*.12+(F.side==='a'?0:1.5))*2.2:0;
  let lean=0,lift=0,drop=0,tilt=0,mood=null;
  if(st==='hit'){lean=-f*11;tilt=-.4;mood='hurt'}
  if(st==='block'){lean=-f*3;tilt=.18}
  if(st==='slip'){const p=Math.sin(Math.min(1,F.t/16)*Math.PI);lean=-f*14*p;drop=12*p;tilt=.35*p}
  if(F.rocked>0&&st!=='ko'){lean+=Math.sin(t*.15)*5;tilt+=Math.sin(t*.11)*.18}
  if(st==='clinch'){lean=f*12;tilt=.3}
  if(st==='celebrate'){lift=Math.abs(Math.sin(t*.13))*14;tilt=-.3;mood='yell'}
  const PK=st==='perf'?(F.perfK||'taunt'):null,pt=F.perfT||0;
  if(PK==='waikru'){const k=clamp(pt/14,0,1);drop=58*k;tilt=.55*k;lean=f*10*k}
  if(PK==='chest'){lift=Math.abs(Math.sin(pt*.2))*6;tilt=-.25;mood='yell'}
  if(PK==='taunt'){tilt=-.15;mood='yell';lean=Math.sin(pt*.15)*6}
  if(PK==='bow'){const k=clamp(Math.sin(Math.min(1,pt/40)*Math.PI),0,1);tilt=.9*k;lean=f*18*k;drop=10*k}
  if(PK==='shadow'){lean=f*(8+Math.sin(pt*.6)*6);mood='yell'}
  if(PK==='kicks'){mood='yell'}
  if(st==='dejected'){tilt=.5;lean=-f*2}
  if(st==='attack'){
    switch(an){
      case 'jab':lean+=f*9*e;drop=3*e;break;case 'cross':lean+=f*17*e;drop=5*e;break;case 'hook':lean+=f*4*e;tilt=.1*e;drop=2*e;break;
      case 'upper':lean+=f*5*e;drop=8*Math.max(0,-E*4)+4*e;break;case 'bodyshot':lean+=f*7*e;drop=20*e;tilt=.2*e;break;
      case 'lowkick':case 'midkick':case 'highkick':{/* lean follows the kick's own smooth progress (no snap when the windup ends) */const pv=kickPath(F,A,x,f,an).pivot,sm=pv*pv*(3-2*pv);lean-=f*({lowkick:5,midkick:13,highkick:22}[an])*sm;break}case 'qmark':lean-=f*11*e;break;case 'tornado':lean-=f*13*e;tilt=.25*e;break;
      case 'superman':lift=24*e;lean+=f*16*e;break;case 'headbutt':lean+=f*24*e;drop=8*e;tilt=.4*e;break;case 'spinfist':lean+=f*8*e;break;case 'spinkick':lean-=f*11*e;break;
      case 'flyknee':lift=30*e;lean+=f*6*e;break;case 'overhand':lean+=f*13*e;tilt=.15*e;break;
      case 'shoot':drop=Math.max(e,F.t<A.w?F.t/A.w*.6:0)*46;lean+=f*drop*.3;tilt=.3*drop/46;break;
    }
    if(A.special&&e>.5)mood='yell';
  }
  const hip={x:x+lean*.25,y:300+bob-lift+drop*.55};
  const chest={x:x+lean+f*2+f*(an==='shoot'?drop*.75:0),y:234+bob-lift+drop*(an==='shoot'?.9:1)};
  const mv=st==='walk'||st==='stroll',wk=mv?F.walk:0,w=mv?Math.sin(wk)*(st==='stroll'?13:10):0;
  let front={x:x+f*(30+(an==='shoot'?drop*.6:0))+w,y:GY-lift*1.3-(mv?Math.max(0,Math.sin(wk))*6:0)};
  let back={x:x-f*27-w,y:GY-lift*.6-(mv?Math.max(0,-Math.sin(wk))*6:0)};
  let kneeN='fwd',kneeF='fwd',footF=null;
  if(st==='attack'){
    if(an==='jab'||an==='superman'){front={x:front.x+f*12*e,y:front.y-4*Math.sin(Math.min(1,e)*Math.PI)}}
    if(an==='cross'||an==='overhand'||an==='bodyshot'){back={x:back.x+f*7*e,y:back.y-6*e};kneeF=e>.3?'down':kneeF}
    if(an==='hook'){front={x:front.x-f*3*e,y:front.y-3*e}}
    if(an==='lowkick'||an==='midkick'||an==='highkick'){const K=kickPath(F,A,x,f,an);back=K.foot;kneeF=K.knee;front={x:front.x+f*K.pivot*4,y:front.y-K.pivot*3};const up=an==='highkick'?15:7;hip.y-=up*K.pivot;chest.y-=up*K.pivot;chest.x-=f*(an==='highkick'?16:an==='midkick'?7:0)*K.pivot;hip.x-=f*(an==='highkick'?4:0)*K.pivot}
    if(an==='spinkick'){back={x:x+f*(-24+e*120),y:GY-e*96};kneeF='back'}
    if(an==='tornado'){back={x:x+f*(-24+e*118),y:GY-e*142};kneeF='back'}
    if(an==='qmark')back={x:x+f*(-24+e*116),y:GY-(F.t<A.w?40:e*142)};
    if(an==='flyknee'){front={x:x+f*(6+e*24),y:GY-lift-e*58};kneeN='up'}
    if(an==='qmark'&&e>.2)kneeF='up';
  }
  if(st==='clinch'&&F.g&&F.g.act&&(F.g.act==='c_knee'||F.g.act==='c_kneeH'||F.g.act==='c_thigh')){
    const G=F.g.A,p=F.g.t<G.w?F.g.t/G.w:Math.max(0,1-(F.g.t-G.w)/G.r);
    back={x:x+f*(6+p*30),y:GY-p*(F.g.act==='c_kneeH'?112:F.g.act==='c_thigh'?44:76)};kneeF='up';
  }
  const hi=st==='block';
  let near={x:x+f*(hi?24:40)+lean,y:hi?198:218+bob},far={x:x+f*(hi?17:13)+lean,y:hi?203:208+bob},elbN='down',elbF='down';
  if(st==='attack'){
    switch(an){
      case 'jab':near={x:x+f*(30+e*76)+lean,y:206-e*3};far={x:x+f*(16-e*4)+lean*.5,y:200};break;
      case 'cross':far={x:x+f*(14+e*98)+lean,y:205-e*3};near={x:x+f*(22-e*6)+lean*.5,y:198};break;
      case 'hook':{/* windup: glove opens out and back; strike: elbow up at shoulder height, forearm level, glove arcs across in front of the face */
        const sw=E<0?-E:0,arc=Math.sin(e*Math.PI*.5);near={x:x+f*(24-sw*8+arc*22)+lean,y:212-sw*4-Math.sin(e*Math.PI)*6};
        elbN=e>.05||sw>.1?{x:near.x-f*(14-arc*4),y:near.y-14-sw*4}:'down';far={x:x+f*14+lean*.5,y:198};break}
      case 'upper':far={x:x+f*(22+e*44)+lean,y:E<0?250:246-e*40};break;
      case 'bodyshot':far={x:x+f*(16+e*66)+lean,y:214+drop+e*22};break;
      case 'lowkick':case 'midkick':case 'highkick':{const K=kickPath(F,A,x,f,an),sw=K.ext;near={x:x+f*(26-sw*2)+lean*.6,y:208-sw*2};far={x:x-f*(6+sw*(an==='lowkick'?14:24)),y:226+sw*(an==='lowkick'?6:24)};elbN='down';elbF='down';break}
      case 'spinkick':case 'qmark':case 'tornado':near={x:x+f*24,y:214};far={x:x-f*24,y:252};break;
      case 'superman':far={x:x+f*(14+e*94)+lean,y:204-lift};near={x:x-f*2,y:226-lift};break;
      case 'spinfist':far={x:x+f*(E<0?-30:10+e*72)+lean,y:206};elbF='up';break;
      case 'overhand':far={x:x+f*(10+e*74)+lean,y:E<=0?176:178+E*30};elbF='up';break;
      case 'flyknee':near={x:x+f*42,y:198-lift};far={x:x+f*36,y:202-lift};break;
      case 'headbutt':near={x:x+f*(30+e*14)+lean*.6,y:236};far={x:x+f*(22+e*10)+lean*.6,y:240};break;
      case 'shoot':near={x:chest.x+f*34,y:chest.y+40};far={x:chest.x+f*26,y:chest.y+46};break;
    }
  }
  if(st==='clinch'){
    const c=S.cl,ctrl=c&&c.ctrl===F;
    if(ctrl){near={x:O.x-f*4,y:204};far={x:O.x-f*10,y:212};elbN='down';elbF='down'}else{near={x:x+f*26,y:236};far={x:x+f*20,y:246}}
    if(F.g&&(F.g.act==='c_elbow'||F.g.act==='c_short')){const G=F.g.A,p=F.g.t<G.w?F.g.t/G.w:Math.max(0,1-(F.g.t-G.w)/G.r);far={x:lerp(x+f*10,O.x-f*12,p),y:lerp(194,206,p)};elbF=F.g.act==='c_elbow'?'up':'down'}
    if(F.blockHeld&&!ctrl){near={x:x+f*20,y:198};far={x:x+f*14,y:204}}
  }
  if(st==='hit'){near={x:x+f*12+lean,y:234};far={x:x+lean,y:240}}
  if(st==='stuffed'){const k=clamp(1-(F.stun||0)/40,0,1),s=1-k*k;
    /* the stuffed shooter: level dropped, head buried under the sprawl, hands still reaching for the legs */
    hip.x=lerp(hip.x,x-f*6,s);hip.y=lerp(hip.y,GY-62,s);chest.x=lerp(chest.x,x+f*34,s);chest.y=lerp(chest.y,GY-84,s);
    front={x:x+f*20,y:GY};back={x:x-f*46,y:GY};kneeN='down';kneeF='down';near={x:x+f*58,y:GY-28};far={x:x+f*50,y:GY-22};tilt=lerp(tilt,.9,s);mood='hurt'}
  if(st==='sprawl'){const k=clamp(F.t/7,0,1),ee=k*k*(3-2*k),rec=F.t>18?clamp((F.t-18)/8,0,1):0,s=ee*(1-rec);
    /* hips drop to the mat, both legs shoot back, chest drives down onto the shooter's back */
    hip.x=lerp(hip.x,x-f*26,s);hip.y=lerp(hip.y,GY-44,s);chest.x=lerp(chest.x,x+f*30,s);chest.y=lerp(chest.y,GY-74,s);
    front={x:lerp(front.x,x-f*58,s),y:GY};back={x:lerp(back.x,x-f*92,s),y:GY};kneeN='down';kneeF='down';
    near={x:lerp(near.x,x+f*66,s),y:lerp(near.y,GY-50,s)};far={x:lerp(far.x,x+f*58,s),y:lerp(far.y,GY-44,s)};elbN='down';elbF='down';tilt=lerp(tilt,1.05,s);mood='yell'}
  if(st==='celebrate'){near={x:chest.x+f*16,y:chest.y-74};far={x:chest.x-f*6,y:chest.y-76};elbN='fwd';elbF='back'}
  if(PK==='shadow'){const ph=Math.floor(pt/7)%4,e2=Math.sin((pt%7)/7*Math.PI);if(ph%2===0)near={x:x+f*(30+e2*62)+lean,y:206};else far={x:x+f*(14+e2*78)+lean,y:205};if(ph===3)near={x:x+f*(28+e2*40)+lean,y:204-e2*6}}
  if(PK==='kicks'){const c=pt%40,e2=Math.sin(clamp(c/18,0,1)*Math.PI);back={x:x+f*(-24+e2*112),y:GY-e2*138};kneeF=e2>.2?'up':'fwd';near={x:x+f*24,y:214};far={x:x-f*24,y:250};lean=-f*11*e2}
  if(PK==='chest'){const hit=Math.floor(pt/9)%2;near={x:chest.x+f*(hit?6:30),y:chest.y+(hit?10:-50)};far={x:chest.x+f*(hit?30:4),y:chest.y+(hit?-50:12)};elbN='fwd';elbF='fwd'}
  if(PK==='waikru'){const k=clamp(pt/14,0,1);front={x:x+f*18,y:GY};back={x:x-f*30,y:GY};kneeN='down';kneeF='down';near={x:chest.x+f*14,y:chest.y-26*k};far={x:chest.x+f*10,y:chest.y-24*k};elbN='down';elbF='down'}
  if(PK==='taunt'){const w=Math.sin(pt*.25);near={x:chest.x+f*(24+w*10),y:chest.y-60-w*8};far={x:chest.x-f*20,y:chest.y-40+w*10};elbN='fwd';elbF='back'}
  if(PK==='arms'){near={x:chest.x+f*42,y:chest.y+6};far={x:chest.x-f*36,y:chest.y+4};elbN='down';elbF='down'}
  if(PK==='bow'){near={x:chest.x+f*8,y:chest.y+18};far={x:chest.x+f*4,y:chest.y+22};elbN='down';elbF='down'}
  if(st==='stroll'){near={x:hip.x+f*8+Math.sin(wk)*12,y:hip.y-4};far={x:hip.x-f*6-Math.sin(wk)*12,y:hip.y-2};elbN='fwd';elbF='fwd'}
  if(st==='dejected'){near={x:hip.x+f*13,y:hip.y-10};far={x:hip.x-f*13,y:hip.y-10};elbN='fwd';elbF='back'}
  /* waiting for the decision: guard down, arms relaxed by the sides */
  if(st==='idle'&&IC.Fight&&IC.Fight.S&&IC.Fight.S.mode==='decision'){near={x:hip.x+f*12,y:hip.y-4};far={x:hip.x-f*8,y:hip.y-2};elbN='down';elbF='down'}
  if(st==='ko'){near={x:x+f*22,y:276};far={x:x-f*8,y:282}}
  /* stamina_exhaustion_idle: hunched over, hands on the thighs, chest heaving */
  if(F.exh&&(st==='idle'||st==='walk')){const ph0=F.side==='a'?0:1,br=Math.sin(t*.24+ph0),sway=Math.sin(t*.05+ph0);
    chest.y+=5+br*4.5;chest.x+=-f*3+sway*3;hip.y+=7;hip.x+=sway*1.5;tilt-=.16+br*.06;
    near={x:x+f*(24+sway*2),y:chest.y+34+br*3};far={x:x+f*(12+sway*2),y:chest.y+40+br*3};elbN='down';elbF='down';mood=mood||'tired';
    front={x:front.x+f*5,y:front.y};back={x:back.x-f*5,y:back.y}}
  /* athletic stance: sink the hips so the knees bend */
  const cr=(st==='ko'||an==='shoot'||st==='sprawl'||st==='stuffed')?0:st==='celebrate'?4:9;
  hip.y+=cr;chest.y+=cr;near.y+=cr;far.y+=cr;
  if(['lowkick','midkick','highkick','spinkick','qmark','tornado'].includes(an)){back.y+=cr*.4}
  /* living stance: breathing, weight shifting, hands feinting and the head never still */
  const ph=F.side==='a'?0:2.1;
  if(st==='idle'||st==='walk'||st==='block'||st==='stroll'){
    const br=Math.sin(t*.055+ph),sh=Math.sin(t*.031+ph);
    chest.y+=br*1.4;chest.x+=sh*2.2*f;hip.x+=sh*1.4*f;
    if(st!=='stroll'){near.x+=Math.sin(t*.083+ph)*2.6;near.y+=Math.cos(t*.11+ph)*1.8+br;far.x+=Math.sin(t*.067+ph+1)*1.6;far.y+=Math.cos(t*.09+ph)*1.4+br}
    tilt+=Math.sin(t*.045+ph)*.05;
  }
  /* hit reactions: the strike's target decides how the body gives */
  const RX=F.react;if(RX&&st!=='ko'){const k=Math.max(0,1-RX.t/(RX.k==='big'?26:RX.k==='body'?28:18)),e2=k*k*(3-2*k)*(st==='clinch'?.35:1);
    if(RX.k==='head'||RX.k==='big'){const b=RX.k==='big'?1.6:1;chest.x-=f*9*b*e2;chest.y+=(RX.up?-6:3)*e2;tilt-=(RX.up?.7:.45)*b*e2;if(RX.k==='big'){near={x:near.x-f*16*e2,y:near.y+18*e2};far={x:far.x-f*20*e2,y:far.y+24*e2}}}
    else if(RX.k==='body'){chest.x+=f*7*e2;chest.y+=16*e2;hip.y+=5*e2;tilt+=.45*e2;near={x:lerp(near.x,hip.x+f*16,e2),y:lerp(near.y,hip.y-26,e2)};far={x:lerp(far.x,hip.x+f*10,e2),y:lerp(far.y,hip.y-20,e2)};mood='hurt'}
    else if(RX.k==='leg'){front={x:front.x-f*8*e2,y:front.y-10*e2};hip.y+=12*e2;chest.y+=9*e2;chest.x-=f*3*e2;kneeN='fwd'}
    else if(RX.k==='check'){front={x:front.x+f*6*e2,y:front.y-38*e2};kneeN='up'}}
  /* worn-out legs: weight shifts off the damaged lead leg */
  const lg=F.legs??100;if(lg<50&&st!=='ko'&&st!=='attack'){const k=(50-lg)/50;front={x:front.x-f*6*k,y:front.y-5*k*(1+Math.sin(t*.07))};hip.y+=4*k;hip.x-=f*3*k}
  /* body mechanics: shoulders turn into punches, hips open on kicks, rear heel lifts on power shots */
  let twist=0,hipTwist=0;
  if(st==='attack'){
    const tw={jab:-.35,cross:1,hook:-.9,upper:.7,bodyshot:.9,overhand:1.15,superman:1,spinfist:1.2,lowkick:0,midkick:0,highkick:0,spinkick:.6,qmark:.5,tornado:.9,flyknee:.3}[an]||0;
    twist=tw*Math.max(E,-.6);
    hipTwist={lowkick:0,midkick:0,highkick:0,spinkick:1.2,qmark:1,tornado:1.3,cross:.45,overhand:.5,hook:-.3}[an]*Math.max(0,E)||0;
    if(['cross','overhand','upper','bodyshot','superman'].includes(an))back={x:back.x+f*4*e,y:back.y-5*e};
    if(['lowkick','midkick','highkick','spinkick','qmark','tornado'].includes(an)){front={x:front.x-f*2*e,y:front.y-2*e};chest.x-=f*3*e}
  }
  if(st==='hit'){const k=F.t!=null?Math.max(0,1-F.t/18):1;tilt-=.25*k;chest.x-=f*4*k}
  /* stance switch: a quick hop where the feet scissor through each other */
  /* stance switch: a real step — the new lead foot travels from the back to the front while the old lead slides back */
  if(F.swT>0&&st!=='ko'){const p=1-F.swT/16,k=p*p*(3-2*p),arc=Math.sin(p*Math.PI),fx0=front.x,bx0=back.x;
    front={x:lerp(bx0,fx0,k),y:GY-16*arc};back={x:lerp(fx0,bx0,k),y:GY-3*arc};kneeN='up';hip.y-=4*arc;chest.y-=4*arc}
  let J0={f,hip,chest,tilt,mood,nearHand:near,farHand:far,nearFoot:front,farFoot:back,kneeN,kneeF,elbN,elbF,twist,hipTwist};
  if(IC.MOCAP&&IC.opts&&IC.opts.mocap!==false){
    if(st==='attack')J0=mcAttack(F,J0);
    else if((st==='idle'||st==='block')&&!F.exh&&!RX&&!(F.swT>0)){const I=mcInfo('Fighting_Idle');if(I){const u=(((t+(F.side==='a'?0:37))/4)/I.M.n)%1,d=mcDelta(F,'Fighting_Idle',u);
      J0=addJ(J0,d,st==='block'?{hip:.5,chest:.6,head:.6}:{hip:.6,chest:.7,head:.7,nearHand:.45,farHand:.45})}}
    else if(st==='perf'&&(PK==='chest'||PK==='taunt')){const key=PK==='chest'?'Standing_Taunt_Chest_Thump':'Taunt',I=mcInfo(key);if(I){const u=((pt/4)/I.M.n)%1;J0=addJ(J0,mcDelta(F,key,u),{hip:.8,chest:1,head:1,nearHand:1,farHand:1,nearFoot:.3,farFoot:.3});J0.mood='yell'}}
    else if(st==='dejected'){const I=mcInfo('Defeated');if(I){const u=Math.min(.55,(F.perfT||t%600)/((I.M.n-1)*4));J0=addJ(J0,mcDelta(F,'Defeated',u),{hip:.8,chest:1,head:1,nearHand:.9,farHand:.9})}}
    /* no captured flinch while clinched: it threw the arms over the head and folded the legs into a kneel */
    if(RX&&st!=='ko'&&st!=='attack'&&st!=='clinch'){const key=RX.k==='big'?'Receive_Uppercut_To_The_Face':RX.k==='body'?'Hit_Reaction':RX.k==='head'?'Receive_Punch_To_The_Face':null;
      if(key&&mcInfo(key)){const dur=RX.k==='big'?26:RX.k==='body'?28:18,p=clamp(RX.t/dur,0,1),pk=key==='Hit_Reaction'?.45:.42,w=Math.sin(Math.min(1,p*1.15)*Math.PI);
        J0=addJ(J0,mcDelta(F,key,p*pk),{hip:.8*w,chest:1.1*w,head:1.2*w,nearHand:.7*w,farHand:.7*w,nearFoot:.2*w,farFoot:.2*w})}}
  }
  /* keep the spine believable: limit how far the torso leans from upright (big leans read as the body snapping) */
  if(!['ko','sprawl','stuffed','clinch'].includes(st)&&an!=='shoot'&&PK!=='waikru'&&PK!=='bow'&&!F.exh){const dx=J0.chest.x-J0.hip.x,dy=J0.hip.y-J0.chest.y,L=Math.hypot(dx,dy)||1,ang=Math.atan2(dx,dy),mx=st==='attack'&&/kick/.test(an||'')?.2:.34;
    if(Math.abs(ang)>mx){const a2=Math.sign(ang)*mx,nx=J0.hip.x+Math.sin(a2)*L,ny=J0.hip.y-Math.cos(a2)*L,sx=nx-J0.chest.x,sy=ny-J0.chest.y;
      J0={...J0,chest:{x:nx,y:ny}};for(const q of ['nearHand','farHand'])J0[q]={x:J0[q].x+sx,y:J0[q].y+sy};if(J0._hd)J0._hd={x:J0._hd.x+sx,y:J0._hd.y+sy}}
    if(J0._hd){const h=Math.hypot(J0._hd.x,J0._hd.y);if(h>14)J0._hd={x:J0._hd.x*14/h,y:J0._hd.y*14/h}}}
  return J0;
}
function poseRef(R,S){
  const x=R.x,f=R.f,t=S.frame,w=R.moving?Math.sin(R.walk)*9:0,st=R.state;
  const cr=st==='crouch'?26:st==='watch'?7:st==='stop'?4:0;
  const hip={x,y:298+cr},chest={x:x+f*(cr>20?14:3),y:230+cr*1.25};
  let near={x:x+f*8,y:284},far={x:x-f*4,y:286},elbN='down',elbF='down';
  if(st==='watch'){near={x:x+f*24,y:hip.y-4};far={x:x+f*16,y:hip.y}}
  if(st==='crouch'){near={x:x+f*22,y:hip.y+24};far={x:x+f*16,y:hip.y+26}}
  if(st==='start'){near={x:x+f*52,y:224};far={x:x+f*6,y:272}}
  if(st==='stop'){near={x:x+f*(30+Math.sin(t*.45)*16),y:176};far={x:x+f*(12-Math.sin(t*.45)*16),y:184};elbN='fwd';elbF='back'}
  if(st==='raise'){near={x:x+f*12,y:150};elbN='fwd'}
  /* decision: referee stands between them holding both fighters' wrists, then lifts the winner's arm */
  if(st==='hold'){near={x:x+f*44,y:236};far={x:x-f*40,y:238};elbN='down';elbF='down'}
  if(st==='raiseW'){near={x:x+f*40,y:150};far={x:x-f*38,y:240};elbN='fwd';elbF='down'}
  if(st==='cover'){const b=Math.sin(t*.5)*3;hip.y=318;chest.x=x+f*24;chest.y=262;near={x:x+f*58,y:268+b};far={x:x+f*50,y:276-b};elbN='fwd';elbF='fwd'}
  if(st==='push'){chest.x=x+f*12;near={x:x+f*52,y:222};far={x:x+f*48,y:232};elbN='fwd';elbF='fwd'}
  return{f,hip,chest,tilt:st==='crouch'?.35:st==='cover'?.5:0,nearHand:near,farHand:far,nearFoot:{x:x+f*(cr>20||st==='cover'?30:20)+w,y:GY},farFoot:{x:x-f*(cr>20||st==='cover'?24:18)-w,y:GY},kneeN:'fwd',kneeF:st==='cover'?'up':'fwd',elbN,elbF};
}
/* ---------- submission poses: full-body holds for every submission (attacker A, victim V) ---------- */
function stagedJ(A,B,k){if(k>=1)return B;if(k<=0)return A;if(B.head&&!A.head)A={...A,head:solve(A).head};if(A.head&&!B.head)B={...B,head:solve(B).head};const sm=x=>{x=clamp(x,0,1);return x*x*(3-2*x)},o={...B};
  const L=(q,kk,lift)=>{if(A[q]&&B[q]){const e=sm(kk);o[q]={x:A[q].x+(B[q].x-A[q].x)*e,y:A[q].y+(B[q].y-A[q].y)*e-(lift?Math.sin(e*Math.PI)*lift:0)}}};
  L('head',(k-.12)/.6);L('nearHand',k/.5);L('farHand',k/.55);L('chest',(k-.12)/.6);L('hip',(k-.28)/.65,8);L('nearFoot',(k-.3)/.7,34);L('farFoot',(k-.36)/.64,26);
  for(const q of ['kneeN','kneeF','elbN','elbF','footN','footF','mood','f'])o[q]=k>.5?B[q]:A[q];o.tilt=(A.tilt||0)+((B.tilt||0)-(A.tilt||0))*sm((k-.12)/.6);return o}
function groundJNoSub(S){const s0=S.sub,e0=S.subEnd,m0=S.mode;S.sub=null;S.subEnd=null;S.mode='fight';try{return groundJ(S)}finally{S.sub=s0;S.subEnd=e0;S.mode=m0}}
function subPose(gr,sub,t){
  /* v66 submissions: each hold is drawn from where the two fighters already are (no body swapping),
     knees/elbows are steered with points so limbs wrap the right way. A = attacker, V = victim.
     P(dx,dy): dx toward gr.hd from the pair's centre, dy up from the mat (negative = higher). */
  const {cx,hd,pos,top}=gr,P=(dx,dy)=>({x:cx+hd*dx,y:GY+dy}),att=sub.att===top?'t':'b',name=sub.name,fam=IC.Fight.SUBK?IC.Fight.SUBK[name]:null;
  const q=clamp(sub.prog/100,0,1),jA=(sub.jA||0)/10,jD=(sub.jD||0)/10,w=Math.sin(t*.35)*(1-q*.4)+Math.sin(t*1.3)*jD*.9,sq=clamp(q*.8+w*.2+jA*.22,0,1.15),wg=Math.sin(t*.9)*jD;
  let A,V,first='V',tapAt=null,ov=null,legOv=0;
  /* victim flat on the back, head toward +x (the bottom fighter's normal place) */
  const back=(o={})=>Object.assign({f:-hd,hip:P(-6,-16),chest:P(56,-18-sq*2),nearFoot:P(-54,-4),farFoot:P(-46,-30-w*8),kneeN:'up',kneeF:'up',nearHand:P(30,-40),farHand:P(24,-30),elbN:'up',elbF:'up',footN:-hd,footF:-hd,tilt:0,mood:'hurt'},o);
  if(name==='암바'&&att==='t'){
    /* from mount: attacker swings to the head side and falls back, both legs across the chest, arm stretched up between the thighs */
    V=back({hip:P(-36,-16),nearFoot:P(-84,-4),farFoot:P(-76,-34-w*10),chest:P(24,-22-sq*3),nearHand:P(30+sq*4,-72-sq*5),elbN:P(28,-48),farHand:P(14,-48+wg*6),elbF:P(2,-40)});
    A={f:-hd,hip:P(30,-12-sq*9),chest:P(86,-10),nearFoot:P(-32,-30),farFoot:P(-12,-38),kneeN:P(-4,-62),kneeF:P(10,-68),nearHand:P(34,-70-sq*5),farHand:P(38,-64-sq*5),elbN:P(58,-48),elbF:P(62,-42),footN:-hd,footF:-hd,tilt:.15,mood:'yell'};first='A';tapAt='Vf';legOv=1;
  }else if(name==='암바'){
    /* from guard: leg swung over the neck drives the head down beside the chest, the arm is stretched across the hips, hips lift */
    A=back({hip:P(-8,-22-sq*8),chest:P(54,-14),nearFoot:P(48,-30+sq*4),kneeN:P(4,-74),farFoot:P(-48,-36),kneeF:P(-30,-58),nearHand:P(36,-24),farHand:P(42,-20),elbN:P(26,-6),elbF:P(50,-4),mood:'yell',footN:hd,footF:-hd});
    V={f:hd,hip:P(-46,-48),chest:P(0,-42+sq*6),nearFoot:P(-82,-6),farFoot:P(-76,-4),kneeN:'down',kneeF:'down',nearHand:P(34-sq*2,-24),elbN:P(18,-30),farHand:P(-16,-6+wg*4),elbF:'down',tilt:.6+sq*.15,mood:'hurt'};first='A';tapAt='Vf';legOv=1;
  }else if(name==='트라이앵글 초크'){
    /* bottom man's legs lock around head and one arm, he pulls the head down, hips up */
    A=back({hip:P(-12,-30-sq*6),chest:P(48,-14),nearFoot:P(10,-90+sq*4),kneeN:P(-32,-70),farFoot:P(-26,-84),kneeF:P(6,-70),nearHand:P(20,-62),farHand:P(14,-58),elbN:P(30,-34),elbF:P(36,-30),mood:'yell',footN:hd,footF:-hd});
    V={f:hd,hip:P(-52,-40),chest:P(-6,-62+sq*8),nearFoot:P(-86,-6),farFoot:P(-80,-4),kneeN:'down',kneeF:'down',nearHand:P(32,-26),elbN:P(14,-40),farHand:P(-26,-12+wg*6),elbF:'down',tilt:.75+sq*.15,mood:'hurt'};first='A';tapAt='Vf';legOv=1;
  }else if(fam==='back'){
    /* rear: attacker sits tight behind with hooks in, head tucked beside the victim's; the choking arm is drawn over the throat */
    V={f:hd,hip:P(16,-22),chest:P(24,-80+sq*4),nearFoot:P(100,-6),farFoot:P(104,-4+w*6),kneeN:'up',kneeF:'up',nearHand:P(44,-80+sq*2),farHand:P(38,-76+wg*6),elbN:P(40,-60),elbF:P(34,-58),footN:hd,footF:hd,tilt:-.3-sq*.25,mood:'hurt'};
    A={f:hd,hip:P(-10,-24),chest:P(2,-86),head:P(6,-108+sq*3),nearFoot:P(54,-30),farFoot:P(64,-42),kneeN:'up',kneeF:'up',nearHand:P(32,-96),farHand:P(12,-116),elbN:P(14,-80),elbF:P(-4,-104),footN:hd,footF:hd,tilt:.25,mood:'yell'};
    if(name==='넥 크랭크'){A.nearHand=P(38,-104);A.farHand=P(26,-114);V.tilt=-.6-sq*.3}
    first='A';tapAt='Vf';ov=[[P(16,-90+sq*3),P(40,-92+sq*2),7.5,6.2,'A'],[P(40,-92+sq*2),P(44,-94),6.5,6.5,'G']];
  }else if(name==='길로틴 초크'&&att==='b'){
    /* from guard: head trapped under the armpit at the chest, closed guard, hips bridge */
    A=back({hip:P(-6,-20-sq*6),chest:P(50,-30),nearFoot:P(-52,-44),kneeN:P(-30,-64),farFoot:P(-58,-38),kneeF:P(-36,-58),nearHand:P(26,-50),farHand:P(30,-44),elbN:P(36,-72),elbF:P(46,-60),tilt:.2,mood:'yell'});
    V={f:hd,hip:P(-44,-46),chest:P(4,-54+sq*4),nearFoot:P(-80,-6),farFoot:P(-74,-4),kneeN:'down',kneeF:'down',nearHand:P(30,-4),elbN:P(26,-30),farHand:P(-6,-20+wg*6),elbF:'down',tilt:.95,mood:'hurt'};first='A';tapAt='Vf';legOv=2;
  }else if(fam==='front'&&pos===5){
    /* front headlock: attacker sprawled in front, arm wrapped under the neck, pulling up and back */
    V={f:-hd,hip:P(46,-50),chest:P(8,-50+sq*2),nearFoot:P(84,-4),farFoot:P(90,-4),kneeN:'down',kneeF:'down',nearHand:P(-4,-8),farHand:P(4,-6+wg*6),elbN:'down',elbF:'down',footN:hd,footF:hd,tilt:.85,mood:'hurt'};
    A={f:hd,hip:P(-58,-52+sq*4),chest:P(-28,-100+sq*4),nearFoot:P(-96,-4),farFoot:P(-44,-4),kneeN:'fwd',kneeF:'fwd',nearHand:P(-6,-46+sq*4),farHand:P(-12,-58),elbN:P(-30,-60),elbF:P(-22,-82),tilt:-.1-sq*.15,mood:'yell'};first='V';tapAt='Vf';
  }else if(fam==='front'||fam==='neck'){
    if(name==='에제키엘 초크'){
      /* from mount: chest over the face, forearm across the throat */
      V=back({nearHand:P(64,-62),elbN:P(64,-40),farHand:P(58,-56+wg*6),elbF:P(48,-40)});
      A={f:hd,hip:P(14,-36),chest:P(64,-62+sq*10),nearFoot:P(-26,-6),farFoot:P(-18,-4),kneeN:'down',kneeF:'down',nearHand:P(76,-24),farHand:P(82,-30),elbN:P(56,-30),elbF:P(62,-36),tilt:.75+sq*.2,mood:'yell'};first='V';tapAt='Vf';
    }else{
      /* arm triangle / darce / anaconda / bone-flute from the top: chest on chest, head on the mat beside the victim's, hands locked around the neck */
      V=back({nearHand:P(84,-48),elbN:P(70,-56),farHand:P(14,-40+wg*6),elbF:P(22,-30)});
      A={f:hd,hip:P(4,-38+sq*4),chest:P(64,-40+sq*6),nearFoot:P(-48,-4),farFoot:P(-38,-6),kneeN:'down',kneeF:'down',nearHand:P(76,-24),farHand:P(84,-28),elbN:P(66,-14),elbF:P(78,-12),tilt:1.05,mood:'yell'};first='V';tapAt='Vf';
    }
  }else if(name==='오모플라타'){
    /* legs over the shoulder, victim forced face-down, attacker sits up and leans toward the hips */
    V={f:hd,hip:P(-34,-30),chest:P(28,-16+sq*2),nearFoot:P(-92,-6),farFoot:P(-86,-4),kneeN:'down',kneeF:'down',nearHand:P(-12,-46-sq*6),elbN:P(14,-40),farHand:P(52,-6+wg*4),elbF:'down',tilt:.2,mood:'hurt'};
    A={f:-hd,hip:P(44,-14),chest:P(10-sq*6,-66+sq*6),nearFoot:P(60,-30),kneeN:P(30,-50),farFoot:P(70,-20),kneeF:P(40,-42),nearHand:P(-14,-44),farHand:P(-20,-36),elbN:'down',elbF:'down',tilt:-.15,mood:'yell'};first='V';tapAt='Vn';legOv=1;
  }else if(name==='기무라'&&att==='b'){
    /* bottom man crunches up toward the trapped arm, figure-four on the wrist, cranking the hand up behind the victim's back; legs clamp the back */
    A=back({hip:P(-4,-18),chest:P(30,-48+sq*4),nearFoot:P(-62,-58),kneeN:P(-30,-62),farFoot:P(-46,-10),kneeF:'up',nearHand:P(-22,-82-sq*6),farHand:P(-14,-76-sq*6),elbN:P(8,-80),elbF:P(12,-70),tilt:-.2,mood:'yell'});
    V={f:hd,hip:P(-46,-44),chest:P(-8,-74+sq*4),nearFoot:P(-82,-6),farFoot:P(-76,-4),kneeN:'down',kneeF:'down',nearHand:P(-28,-82-sq*6),elbN:P(8,-66),farHand:P(14,-26+wg*6),elbF:'down',tilt:.55+sq*.2,mood:'hurt'};first='V';tapAt='Vf';
  }else if(fam==='arm'){
    /* americana / kimura from the top */
    const am=name==='아메리카나';
    V=am?back({nearHand:P(88,-8),elbN:P(66,-14-sq*12),farHand:P(30,-36+wg*6),elbF:'up'})
        :back({nearHand:P(40,-40-sq*10),elbN:P(66,-46),farHand:P(28,-36+wg*6),elbF:'up'});
    A={f:hd,hip:P(16,-40),chest:P(56,-74+sq*8),nearFoot:P(-28,-6),farFoot:P(-20,-4),kneeN:'down',kneeF:'down',
       nearHand:am?P(88,-12):P(42,-44-sq*10),farHand:am?P(68,-22):P(52,-54-sq*8),elbN:am?P(80,-46):P(36,-66),elbF:am?P(56,-44):P(62,-70),tilt:.55,mood:'yell'};first='V';tapAt='Vf';
  }else if(fam==='leg'&&att==='t'){
    /* from inside the guard: attacker falls back, the victim's leg trapped under his armpit, legs entangled */
    V=back({chest:P(48,-32+w*6),nearFoot:P(-84-sq*4,-50),kneeN:P(-40,-34),farFoot:P(-56,-20-w*12),farHand:P(30,-30+wg*6),nearHand:P(44,-20)});
    A={f:hd,hip:P(-58,-16),chest:P(-118,-22),nearFoot:P(-6,-34),farFoot:P(-20,-12),kneeN:P(-30,-46),kneeF:P(-40,-30),nearHand:P(-84,-52-sq*4),farHand:P(-78,-44),elbN:P(-100,-34),elbF:P(-96,-30),footN:hd,footF:hd,tilt:-.05,mood:'yell'};first='V';tapAt='Vf';
  }else if(fam==='leg'){
    /* from half guard bottom: attacker spins under onto the near leg, the victim sits back fighting it */
    V={f:hd,hip:P(-14,-30),chest:P(30,-84+sq*6),nearFoot:P(-88-sq*4,-48),kneeN:P(-50,-34),farFoot:P(-40,-4),kneeF:'down',nearHand:P(40,-40),farHand:P(22,-50+wg*6),elbN:'down',elbF:'down',tilt:-.25-sq*.15,mood:'hurt'};
    A={f:hd,hip:P(-50,-16),chest:P(-110,-20),nearFoot:P(-24,-48),farFoot:P(-8,-26),kneeN:P(-34,-58),kneeF:P(-30,-30),nearHand:P(-86,-50),farHand:P(-80,-42),elbN:P(-100,-32),elbF:P(-96,-28),footN:hd,footF:hd,tilt:-.05,mood:'yell'};first='V';tapAt='Vf';
  }else return null;
  /* the victim taps (the free hand slaps the attacker/mat) when it is nearly over */
  if(sub.prog>82&&tapAt){const tp=Math.abs(Math.sin(t*.42)),k=tapAt==='Vn'?'nearHand':'farHand',h=V[k];V[k]={x:h.x,y:h.y-12*tp};V[tapAt==='Vn'?'elbN':'elbF']='up'}
  const T=att==='t'?A:V,B=att==='t'?V:A,firstIsT=(first==='A')===(att==='t');
  return{T,B,order:firstIsT?'TB':'BT',ov,ovA:att==='t'?'T':'B',legOv}}
function groundJ(S){
  const gr=S.gr,{cx,hd,pos,top,bot}=gr,P=(dx,dy)=>({x:cx+hd*dx,y:GY+dy}),t=S.frame,sub=S.sub;
  let T,B;
  if(pos===0){
    B={f:-hd,hip:P(-6,-16),chest:P(56,-18),nearFoot:P(-48,-60),farFoot:P(-44,-52),kneeN:'up',kneeF:'up',nearHand:P(-6,-98),farHand:P(-14,-82),elbN:'up',elbF:'up',footN:-hd,footF:-hd};
    T={f:hd,hip:P(-38,-40),chest:P(-12,-100),nearFoot:P(-74,-6),farFoot:P(-68,-4),kneeN:'down',kneeF:'down',nearHand:P(40,-36),farHand:P(30,-30),tilt:.35};
  }else if(pos===1){
    B={f:-hd,hip:P(-6,-16),chest:P(56,-18),nearFoot:P(-58,-34),farFoot:P(-94,-8),kneeN:'up',kneeF:'up',nearHand:P(18,-80),farHand:P(10,-70),elbN:'up',elbF:'up',footN:-hd,footF:-hd};
    T={f:hd,hip:P(-12,-38),chest:P(22,-96),nearFoot:P(-50,-6),farFoot:P(-58,-4),kneeN:'down',kneeF:'down',nearHand:P(46,-34),farHand:P(36,-28),tilt:.45};
  }else if(pos===2){
    B={f:-hd,hip:P(-6,-16),chest:P(56,-18),nearFoot:P(-58,-4),farFoot:P(-66,-4),kneeN:'up',kneeF:'up',nearHand:P(50,-56),farHand:P(40,-50),elbN:'up',elbF:'up',footN:-hd,footF:-hd};
    T={f:hd,hip:P(-16,-40),chest:P(46,-52),nearFoot:P(-62,-4),farFoot:P(-56,-6),kneeN:'down',kneeF:'down',nearHand:P(88,-12),farHand:P(12,-22),tilt:.2};
  }else if(pos===3){
    B={f:-hd,hip:P(-6,-16),chest:P(56,-18),nearFoot:P(-92,-8),farFoot:P(-96,-6),kneeN:'up',kneeF:'up',nearHand:P(64,-44),farHand:P(56,-36),elbN:'up',elbF:'up',footN:-hd,footF:-hd};
    T={f:hd,hip:P(22,-40),chest:P(32,-104),nearFoot:P(-12,-6),farFoot:P(-18,-4),kneeN:'down',kneeF:'down',nearHand:P(54,-30),farHand:P(46,-26),tilt:.4};
  }else if(pos===5){
    B={f:-hd,hip:P(46,-50),chest:P(8,-46),nearFoot:P(82,-4),farFoot:P(88,-4),kneeN:'down',kneeF:'down',nearHand:P(-6,-4),farHand:P(2,-6),elbN:'down',elbF:'down',footN:hd,footF:hd,tilt:.9};
    T={f:hd,hip:P(-62,-34),chest:P(-18,-70),nearFoot:P(-118,-4),farFoot:P(-108,-6),kneeN:'down',kneeF:'down',nearHand:P(10,-40),farHand:P(4,-50),elbN:'down',elbF:'down',tilt:.75};
  }else{
    B={f:hd,hip:P(12,-22),chest:P(34,-86),nearFoot:P(98,-6),farFoot:P(102,-4),kneeN:'up',kneeF:'up',nearHand:P(48,-92),farHand:P(44,-84),tilt:.2};
    T={f:hd,hip:P(-14,-24),chest:P(6,-90),nearFoot:P(42,-30),farFoot:P(46,-38),kneeN:'up',kneeF:'up',nearHand:P(46,-96),farHand:P(42,-90),tilt:.25};
  }
  // bottom defensive cover
  if(bot.blockHeld&&pos<4&&pos!==5){const h=vadd(B.chest,{x:hd*24,y:-2});B.nearHand={x:h.x,y:h.y-16};B.farHand={x:h.x-hd*6,y:h.y-10}}
  // top strikes
  const ga=top.g&&top.g.act,gA=top.g&&top.g.A,gt=top.g?top.g.t:0;
  if(ga&&gA&&gA.dmg){
    const tgt=gA.target==='body'?vadd(B.chest,{x:-hd*24,y:-4}):vadd(B.chest,{x:hd*24,y:-6});
    const up=vadd(T.chest,{x:-hd*4,y:-46});
    T.nearHand=gt<gA.w?vl(vadd(T.chest,{x:hd*18,y:20}),up,gt/gA.w):vl(tgt,up,Math.min(1,(gt-gA.w)/gA.r));T.elbN=ga==='g_elbow'?'up':'down';
    if(pos===2)T.nearHand=gt<gA.w?vl(T.nearHand,up,.5):T.nearHand;
  }
  // bottom strikes
  const ba=bot.g&&bot.g.act;
  if(ba==='b_punch'||ba==='b_elbow'){const pr=Math.min(1,bot.g.t/bot.g.A.w);const th=vadd(T.chest,{x:0,y:-22});B.nearHand=vl(B.chest,th,pr)}
  // submissions
  if(sub){
    const att=sub.att===top?'t':'b',name=sub.name;
    if(att==='b'&&pos===0){
      const th=vadd(T.chest,{x:hd*6,y:-26});
      if(name==='길로틴 초크'){B.nearHand=vadd(th,{x:0,y:8});B.farHand=vadd(th,{x:-hd*6,y:12})}
      else{B.nearFoot=vadd(th,{x:hd*16,y:-6});B.farFoot=vadd(th,{x:-hd*14,y:-14});B.nearHand=vadd(th,{x:hd*4,y:6});T.tilt=.6}
    }
    const fam=IC.Fight.SUBK?IC.Fight.SUBK[name]:null;
    if(fam==='leg'){
      if(att==='t'){T.hip=P(-70,-20);T.chest=P(-100,-64);T.nearHand=vadd(B.nearFoot,{x:0,y:4});T.farHand=vadd(B.nearFoot,{x:-hd*6,y:10});T.nearFoot=P(-20,-26);T.farFoot=P(-28,-10);T.kneeN='up';T.kneeF='up';T.tilt=-.3;B.nearFoot=P(-58,-52)}
      else{B.chest=P(-30,-60);B.hip=P(-10,-18);const tf=T.nearFoot;B.nearHand=vadd(tf,{x:0,y:-6});B.farHand=vadd(tf,{x:hd*6,y:-2});B.nearFoot=P(-70,-20);B.farFoot=P(-48,-36);T.tilt=.7;T.nearFoot=P(-52,-24)}
    }else if(fam==='front'&&att==='t'){const hh=vadd(B.chest,{x:hd*26,y:-10});T.nearHand=vadd(hh,{x:hd*4,y:6});T.farHand=vadd(hh,{x:-hd*6,y:-2});T.chest=vadd(T.chest,{x:hd*14,y:16})}
    else if(fam==='neck'&&att==='t'){const hh=vadd(B.chest,{x:hd*22,y:-14});T.nearHand=hh;T.farHand=vadd(hh,{x:hd*6,y:4});T.chest=vadd(T.chest,{x:hd*8,y:8})}
    else if(att==='t'){
      if(pos===4){T.nearHand=vadd(B.chest,{x:hd*8,y:-14});T.farHand=vadd(B.chest,{x:hd*2,y:-10});B.nearHand=vadd(B.chest,{x:hd*10,y:-10})}
      else if(name==='암바'){T.chest=vadd(T.hip,{x:-hd*30,y:-46});T.nearHand=vadd(B.chest,{x:0,y:-36});T.farHand=vadd(B.chest,{x:-hd*6,y:-30});B.nearHand=vadd(B.chest,{x:hd*2,y:-48})}
      else{T.nearHand=vadd(B.chest,{x:hd*10,y:-20});T.farHand=vadd(B.chest,{x:-hd*4,y:-16});B.nearHand=vadd(B.chest,{x:hd*4,y:-34})}
    }
  }
  let order=null;
  /* submissions: staged entry (hands grab first, then torso, then hips and legs swing over on an arc),
     the hold stays on screen through the tap, and an escape unwinds out of it instead of snapping */
  let ov=null,limbOv=null;
  const held=sub||(S.mode==='ko'&&S.subEnd&&S.frame-S.subEnd.end<150?S.subEnd:null);
  if(held){const R=subPose(gr,held,t);if(R){const k=clamp((held.t||0)/34,0,1);
      T=stagedJ(T,R.T,k);B=stagedJ(B,R.B,k*1.15);order=R.order;if(R.ov&&k>.8)ov={list:R.ov,who:R.ovA==='T'?top:bot};
      if(R.legOv&&k>.35)limbOv={who:R.ovA==='T'?top:bot,part:R.legOv===2?'armN':'legN',side:R.ovA};
      if(!sub){const e=clamp((S.frame-S.subEnd.end-90)/50,0,1),ee=e*e*(3-2*e);if(ee>0){const P0=groundJNoSub(S);T=blendJ(T,P0.T,ee);B=blendJ(B,P0.B,ee)}}}}
  else if(S.subOut&&S.frame-S.subOut.out<40){const u=(S.frame-S.subOut.out)/40,ee=u*u*(3-2*u),R=subPose(gr,Object.assign({},S.subOut,{t:99}),t);if(R){T=stagedJ(R.T,T,ee);B=stagedJ(R.B,B,ee)}}
  if(bot.state==='ko'||(S.mode==='ko'&&S.camFocus===bot.side)){B.nearHand=vadd(B.chest,{x:-hd*4,y:20});B.farHand=vadd(B.chest,{x:hd*10,y:18});B.mood='ko'}
  if(limbOv)limbOv.J=limbOv.side==='T'?T:B;
  return{T,B,order,ov,limbOv};
}

/* ---------- arena ---------- */
let CROWD=null;
function initCrowd(){
  const r=IC.seeded?IC.seeded(77):Math.random;CROWD=[];
  const cols=['#2a2f3a','#3a2f2a','#2d3a33','#3a3a44','#46392c','#2c3442','#4a2f35','#353535'];
  for(let row=0;row<12;row++)for(let i=0;i<70;i++){
    CROWD.push({row,keep:r(),x:-260+i*21+(row%2)*10+r()*8,y:6+row*24+r()*6,s:.75+row*.07+r()*.12,c:cols[Math.floor(r()*cols.length)],ph:r()*6.28,sk:['#d9a47e','#b47a52','#e8c4a4','#7a4c30','#e2b48c'][Math.floor(r()*5)]});
  }
}
/* perspective is taken from where the camera is, so panning reads as a camera moving past a rigid cage */
let VPX=400;
/* true pinhole projection: straight lines on the floor and fence stay straight from every camera angle */
const ZYd=.35,ZC=820,CAMH=ZYd*ZC,HOR=GY-CAMH,PS=z=>ZC/(ZC-Math.min(z,ZC-220)),PR=(x,z,h=0)=>{const s=PS(z);return{x:VPX+(x-VPX)*s,y:HOR+(CAMH-h)*s,s}};
function edgeFront(S,a,b){const C=S.cage||{x:400,z:0},mx=(a.x+b.x)/2,mz=(a.z+b.z)/2;return (VPX-mx)*(mx-C.x)+(ZC-mz)*(mz-C.z)>0}
function cageVerts(S){const C=S.cage||{x:400,z:0,ang:0},R=S.arena?S.arena.r:318,v=[];for(let i=0;i<8;i++){const a=C.ang+i*Math.PI/4+Math.PI/8;v.push({x:C.x+Math.cos(a)*R,z:C.z+Math.sin(a)*R})}return v}
const ADS0=['IRON CAGE','NORTHPEAK','VOLTA ENERGY','KORE FIGHTWEAR','BLUELINE','IRON CAGE','HALCYON','VOLTA ENERGY'],ADSU=['NO RULES','지하 격투','NO REF','BLOOD MONEY','언더그라운드','NO RULES','죽어도 책임 없음','BET HERE'];let ADS=ADS0;
function panel(i,a,b,front){
  const p1=PR(a.x,a.z),p2=PR(b.x,b.z),t1=PR(a.x,a.z,232),t2=PR(b.x,b.z,232),q1=PR(a.x,a.z,34),q2=PR(b.x,b.z,34);
  ctx.save();ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(t2.x,t2.y);ctx.lineTo(t1.x,t1.y);ctx.closePath();
  ctx.fillStyle=front?'rgba(18,22,28,.05)':'rgba(16,20,26,.42)';ctx.fill();ctx.clip();
  const minx=Math.min(p1.x,p2.x,t1.x,t2.x),maxx=Math.max(p1.x,p2.x,t1.x,t2.x),miny=Math.min(t1.y,t2.y),maxy=Math.max(p1.y,p2.y),sp=11*(p1.s+p2.s)/2,hgt=maxy-miny;
  ctx.strokeStyle=front?'rgba(190,200,215,.05)':'rgba(175,190,210,.17)';ctx.lineWidth=Math.max(.6,(p1.s+p2.s)/2*.9);ctx.beginPath();
  for(let x=minx-hgt;x<maxx+hgt;x+=sp){ctx.moveTo(x,miny);ctx.lineTo(x+hgt,maxy);ctx.moveTo(x+hgt,miny);ctx.lineTo(x,maxy)}ctx.stroke();
  ctx.restore();
  if(!front){
    ctx.fillStyle='#0d0f13';ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(q2.x,q2.y);ctx.lineTo(q1.x,q1.y);ctx.closePath();ctx.fill();
    const mx=(q1.x+q2.x+p1.x+p2.x)/4,my=(q1.y+q2.y+p1.y+p2.y)/4,sc=(p1.s+p2.s)/2,w=Math.abs(p2.x-p1.x);
    if(w>40*sc){ctx.save();ctx.translate(mx,my);const ang=Math.atan2(p2.y-p1.y,p2.x-p1.x);ctx.rotate(Math.abs(ang)>Math.PI/2?ang+Math.PI:ang);ctx.scale(sc,sc);
      ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=ADS===ADSU?(i%2?'rgba(255,90,70,.75)':'rgba(230,230,220,.5)'):(i%2?'rgba(232,179,58,.6)':'rgba(220,226,235,.45)');ctx.fillText(ADS[i],0,1);ctx.restore()}
  }
  ctx.strokeStyle=front?'rgba(30,34,42,.35)':'#16191f';ctx.lineWidth=7*(t1.s+t2.s)/2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(t1.x,t1.y);ctx.lineTo(t2.x,t2.y);ctx.stroke();
}
function post(v,front){
  const f=PR(v.x,v.z),t=PR(v.x,v.z,240),w=9*f.s;
  if(front)return;/* near-side posts were drawn see-through over the fighters; leave them out */
  ctx.globalAlpha=1;
  const g=ctx.createLinearGradient(f.x-w,0,f.x+w,0);g.addColorStop(0,'#0b0c0f');g.addColorStop(.5,'#2c3038');g.addColorStop(1,'#0b0c0f');
  ctx.fillStyle=g;ctx.fillRect(f.x-w,t.y,w*2,f.y-t.y);
  const pad=PR(v.x,v.z,170),pb=PR(v.x,v.z,70);ctx.fillStyle='#101116';ctx.fillRect(f.x-w*1.35,pad.y,w*2.7,pb.y-pad.y);
  if(!front&&f.s>.45){ctx.save();ctx.translate(f.x,(pad.y+pb.y)/2);ctx.rotate(-Math.PI/2);ctx.scale(f.s,f.s);ctx.fillStyle='rgba(232,179,58,.65)';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ADS===ADSU?'NO RULES':'IRON CAGE',0,0);ctx.restore()}
  ctx.globalAlpha=1;
}
function arena(S){
  if(!CROWD)initCrowd();
  const X0=cam.x-1000;ctx.fillStyle='#07080b';ctx.fillRect(X0,-300,2000,1400);
  const AR=S.arena||{crowd:.82,rows:9,beams:3,beamA:.1,flash:2,k:'main'},hype=S.mode==='ko'||S.mode==='outro'||S.slow>0||S.replay,amp=AR.k==='title'?1.6:AR.k==='practice'?.4:1;
  // crowd ring scrolls with the orbiting camera
  const off=(cam.x-400)*.35+(S.camTheta||0)*420;
  const hz=ctx.createLinearGradient(0,-40,0,300);hz.addColorStop(0,'#0b0d12');hz.addColorStop(1,'#161b24');ctx.fillStyle=hz;ctx.fillRect(X0,-40,2000,340);
  for(const c of CROWD){if(c.row<12-AR.rows||c.keep>AR.crowd)continue;
    const x=((c.x+off-(cam.x-735))%1470+1470)%1470+cam.x-735;
    const jump=(hype?Math.max(0,Math.sin(S.frame*.25+c.ph))*5:Math.sin(S.frame*.03+c.ph)*.8+(IC.Fight.intensity?IC.Fight.intensity()*Math.max(0,Math.sin(S.frame*.2+c.ph))*4:0))*amp;const y=c.y-jump+40;
    ctx.fillStyle=c.c;ctx.beginPath();ctx.ellipse(x,y+14*c.s,10*c.s,9*c.s,0,0,7);ctx.fill();
    ctx.fillStyle=shade(c.sk,.45);ctx.beginPath();ctx.arc(x,y,5.5*c.s,0,7);ctx.fill();
    if(hype&&((c.ph*100|0)%5===0)){ctx.strokeStyle=shade(c.sk,.45);ctx.lineWidth=3*c.s;ctx.beginPath();ctx.moveTo(x+6*c.s,y+8*c.s);ctx.lineTo(x+9*c.s,y-10*c.s-jump);ctx.stroke()}
  }
  for(let i=0;i<AR.flash*2;i++){const k=(S.frame*7+i*131)%997;if(k<3+(hype?10:0)){const c=CROWD[(S.frame*13+i*71)%CROWD.length];const x=((c.x+off-(cam.x-735))%1470+1470)%1470+cam.x-735;ell(x,c.y+36,3,3,'rgba(255,255,255,.9)');const g=ctx.createRadialGradient(x,c.y+36,0,x,c.y+36,18);g.addColorStop(0,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(x-18,c.y+18,36,36)}}
  ctx.fillStyle='rgba(6,8,12,.3)';ctx.fillRect(X0,-40,2000,360);
  ctx.fillStyle='#14171d';ctx.fillRect(X0,-30,2000,22);ctx.fillStyle='#1d2129';for(let x=X0+20;x<X0+2000;x+=24)ctx.fillRect(x+((S.camTheta||0)*200%24),-28,3,18);
  // apron
  const V=cageVerts(S);
  {const ay=Math.min(...V.map(v=>PR(v.x,v.z).y))-2;ctx.fillStyle='#0c0e12';ctx.fillRect(X0,ay-14,2000,16);ctx.fillStyle='#1c2028';ctx.fillRect(X0,ay,2000,1400);ctx.fillStyle='rgba(232,179,58,.35)';for(let x=Math.floor(X0/90)*90;x<X0+2000;x+=90)ctx.fillRect(x,ay-9,40,2)}
  // canvas floor
  ctx.save();ctx.beginPath();V.forEach((v,i)=>{const p=PR(v.x,v.z);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.closePath();
  const m=ctx.createLinearGradient(0,250,0,560);m.addColorStop(0,'#4a5160');m.addColorStop(.45,'#5e6676');m.addColorStop(1,'#444b57');ctx.fillStyle=m;ctx.fill();ctx.clip();
  const c0=PR((S.cage||{x:400}).x,(S.cage||{z:0}).z);const sp=ctx.createRadialGradient(c0.x,c0.y,20,c0.x,c0.y,440);sp.addColorStop(0,'rgba(255,248,230,.24)');sp.addColorStop(1,'rgba(255,248,230,0)');ctx.fillStyle=sp;ctx.fillRect(cam.x-1000,150,2000,900);
  // markings: inner octagon line and centre logo, projected on the floor
  const C=S.cage||{x:400,z:0,ang:0};
  ctx.strokeStyle='rgba(255,255,255,.13)';ctx.lineWidth=3;ctx.beginPath();
  const IR=(S.arena?S.arena.r:318)-33;for(let i=0;i<=8;i++){const a=C.ang+i*Math.PI/4+Math.PI/8,p=PR(C.x+Math.cos(a)*IR,C.z+Math.sin(a)*IR);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.stroke();
  const cc=PR(C.x,C.z);
  ctx.save();ctx.translate(cc.x,cc.y);ctx.scale(cc.s,cc.s*ZYd*cc.s);ctx.rotate(C.ang);
  ctx.fillStyle='rgba(232,179,58,.17)';ctx.beginPath();ctx.arc(0,0,120,0,7);ctx.fill();
  ctx.strokeStyle='rgba(232,179,58,.25)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,128,0,7);ctx.stroke();
  ctx.fillStyle='rgba(10,12,16,.32)';ctx.font='bold 46px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(S.arena&&S.arena.k==='under'?'UNDERGROUND':S.title?'TITLE FIGHT':'IRON CAGE',0,4);
  ctx.rotate(Math.PI/2);ctx.font='bold 22px sans-serif';ctx.fillStyle='rgba(255,255,255,.07)';ctx.fillText('VOLTA',0,-205);ctx.fillText('NORTHPEAK',0,205);
  ctx.restore();
  const co=Math.cos(C.ang),si=Math.sin(C.ang);
  for(const s of S.stains){if(s.lx===undefined)continue;const p=PR(C.x+s.lx*co-s.lz*si,C.z+s.lx*si+s.lz*co);ell(p.x,p.y,s.r*1.6*p.s,s.r*.6*p.s,'rgba(110,8,14,.55)')}
  ctx.restore();
  // back fence: panels and posts behind the fighters, far ones first
  const edges=V.map((v,i)=>({i,a:v,b:V[(i+1)%8],mz:(v.z+V[(i+1)%8].z)/2})).sort((p,q)=>p.mz-q.mz);
  for(const e of edges)if(!edgeFront(S,e.a,e.b))panel(e.i,e.a,e.b,false);
  V.filter((v,i)=>!(edgeFront(S,V[(i+7)%8],v)&&edgeFront(S,v,V[(i+1)%8]))).sort((p,q)=>p.z-q.z).forEach(v=>post(v,false));
}
function arenaFront(S){
  const V=cageVerts(S);
  const edges=V.map((v,i)=>({i,a:v,b:V[(i+1)%8],mz:(v.z+V[(i+1)%8].z)/2})).sort((p,q)=>p.mz-q.mz);
  for(const e of edges)if(edgeFront(S,e.a,e.b))panel(e.i,e.a,e.b,true);
}
/* impact frame: white star burst + speed lines thrown along the punch */
function impacts(S){for(const im of S.impacts||[]){const k=im.t/im.max,r=(1-k)*(im.big?70:44)+8;ctx.save();ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=k;ctx.fillStyle=im.col;ctx.beginPath();for(let i=0;i<10;i++){const a=i/10*Math.PI*2,rr=i%2?r*.38:r;ctx.lineTo(im.x+Math.cos(a)*rr,im.y+Math.sin(a)*rr*.8)}ctx.closePath();ctx.globalAlpha=k*.55;ctx.fill();
  ctx.globalAlpha=k*.9;ctx.strokeStyle='#fff';ctx.lineWidth=2.4;for(let i=0;i<7;i++){const a=(i-3)*.18,l=r*(1.2+((i*37)%5)*.15);ctx.beginPath();ctx.moveTo(im.x-im.f*r*.4*Math.cos(a),im.y-r*.4*Math.sin(a));ctx.lineTo(im.x-im.f*l*Math.cos(a)*1.6,im.y-l*Math.sin(a))}ctx.stroke();ctx.restore()}}
/* soft volumetric beam: several stacked cones (wide & faint → narrow & bright) fake a blurred edge, plus haze motes drifting inside */
function softBeam(x0,y0,x1,y1,w0,w1,rgb,a,t,seed,still){
  for(const [k,al] of (still?[[1,.22],[.72,.26],[.46,.3],[.22,.42]]:[[1,.3],[.5,.55]])){const g=ctx.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,`rgba(${rgb},${a*al*1.6})`);g.addColorStop(.55,`rgba(${rgb},${a*al*.7})`);g.addColorStop(1,`rgba(${rgb},0)`);
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x0-w0*k,y0);ctx.lineTo(x0+w0*k,y0);ctx.lineTo(x1+w1*k,y1);ctx.lineTo(x1-w1*k,y1);ctx.closePath();ctx.fill()}
  if(!still)for(let i=0;i<4;i++){const h=((seed*97+i*53)%100)/100,u=((h*1.7+t*.0009*(1+i%3))%1),px=lerp(x0,x1,u)+Math.sin(t*.01+i*2+seed)*w1*.5*u,py=lerp(y0,y1,u);ctx.fillStyle=`rgba(${rgb},${a*.9*(1-u)})`;ctx.fillRect(px,py,1.6,1.6)}}
function beams(S){
  const AR=S.arena||{beams:3,beamA:.1,k:'main'},n=AR.beams,xs=n===1?[400]:Array.from({length:n},(_,i)=>lerp(120,680,i/(n-1)));
  ctx.save();ctx.globalCompositeOperation='lighter';
  xs.forEach((lx,i)=>{const tx=lerp(lx,400,.35);softBeam(lx,0,tx,GY,7,150,'255,240,214',AR.beamA,S.frame,i+1);
    /* where the beam lands: a soft warm pool on the mat */
    {ctx.save();ctx.translate(tx,GY);ctx.scale(1,.2);const pg=ctx.createRadialGradient(0,0,0,0,0,150);pg.addColorStop(0,`rgba(255,236,200,${AR.beamA*.9})`);pg.addColorStop(1,'rgba(255,236,200,0)');ctx.fillStyle=pg;ctx.fillRect(-150,-150,300,300);ctx.restore()}
    /* the lamp itself: hot core + glow, no flat disc */
    const lg=ctx.createRadialGradient(lx,4,0,lx,4,22);lg.addColorStop(0,'rgba(255,252,240,.95)');lg.addColorStop(.25,'rgba(255,240,200,.45)');lg.addColorStop(1,'rgba(255,240,200,0)');ctx.fillStyle=lg;ctx.fillRect(lx-22,-18,44,44)});
  /* title fights: corner-coloured sweeping beams over the crowd */
  if(AR.k==='title'){for(const [c,ph] of [['rgba(61,127,240,',0],['rgba(224,74,58,',2.1],['rgba(232,179,58,',4.2]]){const a=Math.sin(S.frame*.012+ph)*.55,x0=400+Math.sin(S.frame*.009+ph)*260;
      ctx.save();ctx.translate(x0,-40);ctx.rotate(a);softBeam(0,0,0,420,5,80,c.slice(5,-1),.2,S.frame,ph*3+1);ctx.restore()}}
  if(AR.k==='practice'){ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(cam.x-1000,-300,2000,1400)}
  ctx.restore();
}
function shadowAt(x,w){const g=ctx.createRadialGradient(x,GY+4,2,x,GY+4,w);g.addColorStop(0,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.save();ctx.translate(x,GY+4);ctx.scale(1,.18);ctx.translate(-x,-(GY+4));ctx.beginPath();ctx.arc(x,GY+4,w,0,7);ctx.fill();ctx.restore()}

/* ---------- world ---------- */
function depth(x,z){const p=PR(x,z);ctx.translate(p.x,p.y);ctx.scale(p.s,p.s);ctx.translate(-x,-GY)}
function drawRef(S){
  const R=S.ref;if(!R)return;
  ctx.save();depth(R.x,R.z??-50);ctx.translate(R.x,GY);ctx.scale(.94,.94);ctx.translate(-R.x,-GY);
  shadowAt(R.x,40);
  drawBody(REF,poseRef(R,S));
  ctx.restore();
}
/* blend toward the target pose so motion has weight: snappy while a strike is live, softer otherwise */
/* ---------- knockout falls: five different ways to go down, all ending flat on the canvas ---------- */
const KOK=['back','face','crumple','fence','spin'];
function koPose(F,J0,t){
  const kind=F.koK||KOK[(IC.hash?IC.hash(String(F.name||F.d&&F.d.name||'')):0)%KOK.length],f=F.f,x=F.x;
  const kt=Math.min(1,(F.koT||0)/(kind==='crumple'?40:28)),ease=q=>q*q*(3-2*q);
  const d=kind==='face'||kind==='spin'||kind==='crumple'?f:-f;           /* which side the head ends up on */
  /* final lying poses */
  let E;
  if(kind==='face'){E={f:d,hip:{x:x+d*6,y:GY-14},chest:{x:x+d*68,y:GY-15},nearFoot:{x:x-d*52,y:GY-5},farFoot:{x:x-d*58,y:GY-4},kneeN:'down',kneeF:'down',nearHand:{x:x+d*96,y:GY-5},farHand:{x:x+d*30,y:GY-4},elbN:'down',elbF:'down',tilt:0}}
  else if(kind==='crumple'){E={f:d,hip:{x:x,y:GY-20},chest:{x:x+d*58,y:GY-26},nearFoot:{x:x-d*20,y:GY-5},farFoot:{x:x-d*30,y:GY-6},kneeN:'fwd',kneeF:'fwd',nearHand:{x:x+d*50,y:GY-4},farHand:{x:x+d*20,y:GY-6},elbN:'down',elbF:'down',tilt:0}}
  else if(kind==='spin'){E={f:d,hip:{x:x+d*4,y:GY-18},chest:{x:x+d*64,y:GY-22},nearFoot:{x:x-d*44,y:GY-14},farFoot:{x:x-d*60,y:GY-4},kneeN:'fwd',kneeF:'down',nearHand:{x:x+d*82,y:GY-30},farHand:{x:x+d*40,y:GY-6},elbN:'up',elbF:'down',tilt:0}}
  else{E={f:-d,hip:{x:x+d*6,y:GY-16},chest:{x:x+d*68,y:GY-18},nearFoot:{x:x-d*50,y:GY-16},farFoot:{x:x-d*58,y:GY-4},kneeN:'up',kneeF:'down',nearHand:{x:x+d*44,y:GY-8},farHand:kind==='fence'?{x:x+d*70,y:GY-70}:{x:x+d*92,y:GY-6},elbN:'down',elbF:kind==='fence'?'up':'down',tilt:0}}
  E.mood='ko';E.footN=-E.f;E.footF=-E.f;
  if(kt>=1)return E;
  /* the fall: hips drop, the torso swings from upright to flat around the hips, limbs go limp toward the final pose */
  let k=ease(kt),hip,ang,L=66;
  if(kind==='crumple'){const k1=ease(Math.min(1,kt/.5)),k2=ease(clamp((kt-.5)/.5,0,1));
    hip={x:x,y:300+(GY-46-300)*k1+((GY-20)-(GY-46))*k2};ang=.18*k1+(Math.PI/2-.12)*k2;
    const J={f:k2>.5?E.f:f,hip,chest:{x:hip.x+Math.sin(ang)*L*d,y:hip.y-Math.cos(ang)*L},nearFoot:{x:x-d*14*k1,y:GY-2},farFoot:{x:x-d*26*k1,y:GY-3},kneeN:'down',kneeF:'down',
      nearHand:{x:x+d*(20+20*k2),y:hip.y-10+8*k2},farHand:{x:x+d*(8+12*k2),y:hip.y-4},elbN:'down',elbF:'down',tilt:.3*k1,mood:'ko'};
    if(k2>0){for(const q of ['nearFoot','farFoot','nearHand','farHand'])J[q]={x:J[q].x+(E[q].x-J[q].x)*k2,y:J[q].y+(E[q].y-J[q].y)*k2}}return J}
  const hx=x+(E.hip.x-x)*k-(kind==='face'?-d*10*Math.sin(k*Math.PI):0),hy=300+(E.hip.y-300)*Math.pow(k,1.4);hip={x:hx,y:hy};
  ang=(Math.PI/2)*Math.pow(k,kind==='back'||kind==='fence'?1.6:1.2);
  const J={f:kt>.5?E.f:f,hip,chest:{x:hip.x+Math.sin(ang)*L*d,y:hip.y-Math.cos(ang)*L},kneeN:E.kneeN,kneeF:E.kneeF,elbN:E.elbN,elbF:E.elbF,tilt:0,mood:'ko'};
  for(const q of ['nearFoot','farFoot','nearHand','farHand']){const a=J0[q]||E[q];J[q]={x:a.x+(E[q].x-a.x)*k,y:a.y+(E[q].y-a.y)*k}}
  if(kind==='spin'&&kt<.5){J.f=Math.floor(kt*8)%2?-f:f}
  if(kind==='fence'&&kt>.3){J.farHand={x:J.chest.x+d*4,y:J.chest.y-46*Math.min(1,(kt-.3)/.4)};J.elbF='up'}
  return J}
function smoothPose(F,J){
  const A=F.A,live=F.state==='attack'&&A&&F.t>=A.w-1&&F.t<=A.w+A.a+1;
  const k=F.state==='ko'?.5:live?.72:F.state==='attack'?.42:F.state==='hit'?.5:F.state==='slip'?.45:.26;
  const P=F._pj,keys=['hip','chest','nearHand','farHand','nearFoot','farFoot'];
  /* kicks: the kick path is already smooth and the knee is aimed from the raw foot — smoothing the foot made the knee flip sides frame to frame (the 'fish flop') */
  const kk=F.state==='attack'&&A&&/kick/.test(A.anim||'');
  if(P&&Math.abs(P.hip.x-J.hip.x)<90&&P.f===J.f){for(const q of keys){if(kk&&(q==='nearFoot'||q==='farFoot'))continue;J[q]={x:P[q].x+(J[q].x-P[q].x)*k,y:P[q].y+(J[q].y-P[q].y)*k}}
    J.tilt=P.tilt+(J.tilt-P.tilt)*Math.max(k,.3);J.twist=P.twist+((J.twist||0)-P.twist)*Math.max(k,.4);J.hipTwist=P.hipTwist+((J.hipTwist||0)-P.hipTwist)*Math.max(k,.4)}
  F._pj={f:J.f,tilt:J.tilt||0,twist:J.twist||0,hipTwist:J.hipTwist||0};for(const q of keys)F._pj[q]={x:J[q].x,y:J[q].y};
  return J;
}
function drawStandingFighter(F,O,S){
  F._t=S.frame;
  ctx.save();depth(F.x,F.z||0);
  shadowAt(F.x,52);
  let J=smoothPose(F,poseStand(F,O,S));if(F.state==='ko'){J=koPose(F,J,S.frame);F._pj=null}
  if(F.stance&&F.state!=='ko')J.swapD=(F.f===1)===(F.stance==='south');
  if(F.swT>0){const k=1-F.swT/16;ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=`rgba(127,227,255,${(1-k)*.8})`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(F.x,GY+2,30+k*46,7+k*9,0,0,7);ctx.stroke();ctx.restore()}
  ctx.save();
  if(F.heart>0){const g=ctx.createRadialGradient(J.chest.x,J.chest.y,10,J.chest.x,J.chest.y,90);g.addColorStop(0,`rgba(255,60,40,${.18+.1*Math.sin(S.frame*.2)})`);g.addColorStop(1,'rgba(255,60,40,0)');ctx.fillStyle=g;ctx.fillRect(J.chest.x-90,J.chest.y-90,180,180)}
  /* result announcement: the whole body turns to face the crowd (quick squash turn), winner raises both arms, loser hangs his head */
  const S0=IC.Fight&&IC.Fight.S,face=S0&&(S0.mode==='decision'||S0.mode==='outro')&&F.state!=='ko';F._bv=F._bv==null?(face?1:0):F._bv+((face?1:0)-F._bv)*.25;
  if(F._bv>.02){const k=F._bv;if(k>=.5){const sx=Math.max(.2,2*k-1),win=F.state==='celebrate',lose=F.state==='dejected';
      ctx.save();ctx.translate(F.x,GY);ctx.scale(.82*sx,.82);drawFront(F,S.frame,{walk:0,perf:win?'win':lose?'bow':null,pt:S.frame,dmg:{head:F.head??100,cuts:F.cuts||0,mood:win?'yell':lose?'hurt':null},t:S.frame,sweat:.4});ctx.restore();ctx.restore();ctx.restore();return}
    ctx.translate(F.x,0);ctx.scale(Math.max(.2,1-2*k),1);ctx.translate(-F.x,0)}
  const r=drawBody(F,J);
  if(F.exh&&r.head&&F.state!=='ko'){const k=(S.frame%34)/34;ctx.save();ctx.globalAlpha=(1-k)*.35;ctx.fillStyle='#e8eef6';ctx.beginPath();ctx.ellipse(r.head.x+F.f*(16+k*22),r.head.y+8-k*10,4+k*9,3+k*6,0,0,7);ctx.fill();
    ctx.globalAlpha=.7*(1-((S.frame+11)%40)/40);ctx.fillStyle='#bfe3ff';ctx.beginPath();ctx.ellipse(r.head.x-F.f*4,r.head.y+6+((S.frame+11)%40)*.9,1.4,2.2,0,0,7);ctx.fill();ctx.restore()}
  if(F.state==='attack'&&F.A&&F.A.kind!=='shoot'&&F.t>=F.A.w-(/kick/.test(F.A.anim||'')?0:3)&&F.t<=F.A.w+F.A.a+4){
    const an=F.A.anim,tip=['lowkick','midkick','highkick','spinkick','qmark','tornado'].includes(an)?r.footF:an==='flyknee'?J.nearFoot:['jab','hook'].includes(an)?r.handN:r.handF;
    F._trail=(F._trail&&F._trail.k===F.A?F._trail:{k:F.A,p:[]});F._trail.p.push({x:tip.x,y:tip.y});if(F._trail.p.length>8)F._trail.p.shift();
    const P=F._trail.p;ctx.lineCap='round';for(let i=1;i<P.length;i++){ctx.strokeStyle=`rgba(255,250,240,${i/P.length*.62})`;ctx.lineWidth=3+i*2.6;ctx.beginPath();ctx.moveTo(P[i-1].x,P[i-1].y);ctx.lineTo(P[i].x,P[i].y);ctx.stroke()}
  }else F._trail=null;
  if(F.A&&F.A.special&&F.t>=F.A.w-2&&F.t<=F.A.w+F.A.a+3){
    const tip=['spinkick','qmark','tornado'].includes(F.A.anim)?r.footF:F.A.anim==='flyknee'?J.nearFoot:r.handF;
    ctx.strokeStyle='rgba(255,215,94,.6)';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.arc(tip.x-F.f*32,tip.y+10,36,F.f>0?-1.2:Math.PI-.6,F.f>0?.6:Math.PI+1.2);ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}
function blendJ(A,B,k){const o={...B};for(const q of ['hip','chest','nearHand','farHand','nearFoot','farFoot']){if(A[q]&&B[q])o[q]={x:A[q].x+(B[q].x-A[q].x)*k,y:A[q].y+(B[q].y-A[q].y)*k}}o.tilt=(A.tilt||0)+((B.tilt||0)-(A.tilt||0))*k;return o}
function drawGround(S){
  const gr=S.gr;let {T,B,order,ov,limbOv}=groundJ(S);
  if(gr.trans>0&&gr.prevPos!=null&&gr.prevPos!==gr.pos){const cur=gr.pos;gr.pos=gr.prevPos;const P0=groundJ(S);gr.pos=cur;const k=1-gr.trans/16,e=k*k*(3-2*k);T=blendJ(P0.T,T,e);B=blendJ(P0.B,B,e);
    if(e<.5){T.chest={x:T.chest.x,y:T.chest.y-14*Math.sin(e*Math.PI)}}}
  gr.top._t=gr.bot._t=S.frame;
  ctx.save();depth(gr.cx,gr.cz||0);
  shadowAt(gr.cx,120);
  if(order==='TB'||(!order&&gr.pos===4)){drawBody(gr.top,T);drawBody(gr.bot,B)}else{drawBody(gr.bot,B);drawBody(gr.top,T)}
  /* the attacker's wrapping leg/arm is drawn again over the victim with the normal limb renderer */
  if(limbOv)drawBody(limbOv.who,Object.assign({},limbOv.J,{_only:limbOv.part}));
  /* choking arm drawn over the victim's throat */
  if(ov){const sk=(ov.who.look&&ov.who.look.skin)||'#d2a07a';for(const [a,b,r1,r2,k] of ov.list){if(k==='G'){const g=ctx.createRadialGradient(b.x-2,b.y-3,1,b.x,b.y,9);g.addColorStop(0,'#4b4f58');g.addColorStop(1,'#0b0c0e');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(b.x,b.y,8,7,0,0,7);ctx.fill();ctx.fillStyle=ov.who.corner||'#3d7ff0';ctx.fillRect(b.x-9,b.y-3,4,7)}else capsule(a,b,r1,r2,sk,0)}}
  ctx.restore();
}
/* ---------- walkout aisle: the fighter walks through the crowd to the cage ---------- */
let AIS=null;
const FLAGS={'대한민국':{t:'kr'},'일본':{t:'jp'},'미국':{t:'us'},'브라질':{t:'br'},'러시아':{t:'h',c:['#ffffff','#1c3fa8','#d52b1e']},'멕시코':{t:'v',c:['#006847','#ffffff','#ce1126']},'아일랜드':{t:'v',c:['#169b62','#ffffff','#ff883e']},
  '나이지리아':{t:'v',c:['#008751','#ffffff','#008751']},'폴란드':{t:'h',c:['#ffffff','#dc143c']},'스웨덴':{t:'se'},'카메룬':{t:'v',c:['#007a5e','#ce1126','#fcd116']},'스페인':{t:'h',c:['#aa151b','#f1bf00','#f1bf00','#aa151b']},
  '카자흐스탄':{t:'h',c:['#00afca']},'뉴질랜드':{t:'h',c:['#012169']},'다게스탄':{t:'h',c:['#1f9e3a','#2b6fd6','#d52b1e']},'체첸':{t:'h',c:['#1f9e3a','#ffffff','#d52b1e']},'모로코':{t:'h',c:['#c1272d']},'사모아':{t:'h',c:['#ce1126']},'캐나다':{t:'v',c:['#d52b1e','#ffffff','#d52b1e']},'네덜란드':{t:'h',c:['#ae1c28','#ffffff','#21468b']},'프랑스':{t:'v',c:['#0055a4','#ffffff','#ef4135']},
  '태국':{t:'h',c:['#a51931','#f4f5f8','#2d2a4a','#2d2a4a','#f4f5f8','#a51931']},'중국':{t:'h',c:['#de2910']},'영국':{t:'h',c:['#012169','#c8102e','#012169']},'호주':{t:'h',c:['#012169']},'조지아':{t:'h',c:['#ffffff','#e8112d','#ffffff']}};
function drawFlag(x,y,w,h,from,t){
  const F=FLAGS[from]||{t:'h',c:['#333','#e8b33a','#333']};
  ctx.save();ctx.translate(x,y);
  // cloth ripple: draw in vertical strips with a travelling wave
  const n=14,amp=t?6:0;for(let i=0;i<n;i++){const u=i/n,dy=Math.sin(t*.18-u*5)*amp*u,dw=w/n+.6;ctx.save();ctx.beginPath();ctx.rect(u*w,dy,dw,h);ctx.clip();ctx.translate(0,dy);
    if(F.t==='h'){F.c.forEach((c,k)=>{ctx.fillStyle=c;ctx.fillRect(0,k*h/F.c.length,w,h/F.c.length+.5)})}
    else if(F.t==='v'){F.c.forEach((c,k)=>{ctx.fillStyle=c;ctx.fillRect(k*w/F.c.length,0,w/F.c.length+.5,h)})}
    else if(F.t==='kr'){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.fillStyle='#c60c30';ctx.beginPath();ctx.arc(w/2,h/2,h*.22,Math.PI,0);ctx.fill();ctx.fillStyle='#003478';ctx.beginPath();ctx.arc(w/2,h/2,h*.22,0,Math.PI);ctx.fill();
      ctx.fillStyle='#111';for(const [cx,cy] of [[.22,.24],[.78,.24],[.22,.76],[.78,.76]])ctx.fillRect(w*cx-5,h*cy-4,10,8)}
    else if(F.t==='jp'){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.fillStyle='#bc002d';ctx.beginPath();ctx.arc(w/2,h/2,h*.28,0,7);ctx.fill()}
    else if(F.t==='us'){for(let k=0;k<7;k++){ctx.fillStyle=k%2?'#fff':'#b22234';ctx.fillRect(0,k*h/7,w,h/7+.5)}ctx.fillStyle='#3c3b6e';ctx.fillRect(0,0,w*.42,h*.57)}
    else if(F.t==='br'){ctx.fillStyle='#009c3b';ctx.fillRect(0,0,w,h);ctx.fillStyle='#ffdf00';ctx.beginPath();ctx.moveTo(w/2,h*.1);ctx.lineTo(w*.92,h/2);ctx.lineTo(w/2,h*.9);ctx.lineTo(w*.08,h/2);ctx.fill();ctx.fillStyle='#002776';ctx.beginPath();ctx.arc(w/2,h/2,h*.22,0,7);ctx.fill()}
    else if(F.t==='se'){ctx.fillStyle='#006aa7';ctx.fillRect(0,0,w,h);ctx.fillStyle='#fecc00';ctx.fillRect(w*.3,0,w*.14,h);ctx.fillRect(0,h*.43,w,h*.14)}
    ctx.restore()}
  // shading folds
  if(amp)for(let i=0;i<n;i++){const u=i/n,v=Math.cos(t*.18-u*5);ctx.fillStyle=v>0?`rgba(255,255,255,${v*.10})`:`rgba(0,0,0,${-v*.22})`;ctx.fillRect(u*w,Math.sin(t*.18-u*5)*amp*u,w/n+.6,h)}
  ctx.restore();
}
function initAisle(){
  const r=IC.seeded(4242);AIS={far:[],mid:[],near:[],cols:['#2a2f3a','#3a2f2a','#2d3a33','#3a3a44','#46392c','#2c3442','#4a2f35','#353535','#5a4a3a','#24303a']};
  const sk=['#d9a47e','#b47a52','#e8c4a4','#7a4c30','#e2b48c','#5a3824'];
  for(let row=0;row<9;row++)for(let i=0;i<120;i++)AIS.far.push({x:-900+i*22+(row%2)*11+r()*8,y:40+row*20+r()*5,s:.45+row*.05,c:AIS.cols[r()*10|0],sk:sk[r()*6|0],ph:r()*6.28,ph2:r()*1});
  for(let i=0;i<90;i++)AIS.mid.push({x:-700+i*30+r()*14,y:300+r()*16,s:.95+r()*.15,c:AIS.cols[r()*10|0],sk:sk[r()*6|0],ph:r()*6.28,arm:r(),phone:r()<.3});
  for(let i=0;i<34;i++)AIS.near.push({x:-800+i*72+r()*30,y:470+r()*30,s:1.9+r()*.4,ph:r()*6.28,arm:r()});
}
function crowdPerson(p,t,hype,scale,dark){
  const s=p.s*scale,j=hype?Math.max(0,Math.sin(t*.25+p.ph))*6*s:Math.sin(t*.05+p.ph)*.8;
  const x=p.x,y=p.y-j;
  ctx.fillStyle=dark?'#0b0c10':p.c;ctx.beginPath();ctx.ellipse(x,y+16*s,12*s,14*s,0,0,7);ctx.fill();
  ctx.fillStyle=dark?'#101217':shade(p.sk,.55);ctx.beginPath();ctx.arc(x,y,6.5*s,0,7);ctx.fill();
  if(dark){ctx.strokeStyle='rgba(255,240,215,.16)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,6.5*s,-2.6,-.6);ctx.stroke()}
  return {x,y,s};
}
function aisleScene(S){
  if(!AIS)initAisle();
  const W0=S.walk,F=W0.k==='blueAisle'?S.a:S.b,t=S.frame,hype=W0.hype>.3,ax=W0.ax,col=F.corner;
  const z=Math.max(.9,Math.min(1.22*Math.max(1,Math.min(1.35,Math.sqrt(VH/450)*.95)),VH/300)),cx=clamp(ax+60,-200,640),cy=Math.min(268,412-VH/(2*z)),topY=cy-VH/(2*z),botY=cy+VH/(2*z);
  ctx.save();ctx.translate(W/2,VH/2);ctx.scale(z,z);
  const L=(p)=>{ctx.setTransform(1,0,0,1,0,0);ctx.translate(TX0,TY0);ctx.scale(K0*z,K0*z);ctx.translate(-cx*p,-cy)};
  // remember base transform (caller already scaled canvas to logical units)
  ctx.restore();
  const m=ctx.getTransform();const K0=m.a,TX0=m.e+W/2*K0,TY0=m.f+VH/2*K0;
  // arena bowl
  ctx.save();L(0);ctx.translate(cx,0);
  const bg=ctx.createLinearGradient(0,-200,0,500);bg.addColorStop(0,'#05060a');bg.addColorStop(.6,'#0d1018');bg.addColorStop(1,'#11141b');ctx.fillStyle=bg;ctx.fillRect(-1200,-400,2400,1400);ctx.restore();
  // far tiers (slow parallax)
  ctx.save();L(.3);
  for(const p of AIS.far){const q=crowdPerson(p,t,hype,1,false);
    if(p.ph2<.12){const on=Math.sin(t*.07+p.ph*3)>.2;if(on){ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(q.x+4*q.s,q.y-6*q.s,2.2,2.2)}}}
  ctx.fillStyle='rgba(5,6,10,.45)';ctx.fillRect(-1200,0,3000,260);
  // camera flashes
  for(let i=0;i<4;i++){const k=(t*11+i*313)%600;if(k<(hype?40:12)){const p=AIS.far[(t*7+i*97)%AIS.far.length];const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,24);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(p.x-24,p.y-24,48,48)}}
  ctx.restore();
  // hanging jumbotron with the fighter's name
  ctx.save();L(.15);ctx.globalAlpha=clamp(1-(W0.t-60)/25,0,1);if(ctx.globalAlpha>0){const jx=cx*.15+(W/2)/z*.62,jy=topY+70;ctx.translate(jx,jy);ctx.scale(.72,.72);ctx.translate(-jx,-jy);ctx.fillStyle='#0a0b0f';ctx.fillRect(jx-170,jy-6,340,108);ctx.strokeStyle='#22262f';ctx.lineWidth=4;ctx.strokeRect(jx-170,jy-6,340,108);
    const g=ctx.createLinearGradient(jx-160,0,jx+160,0);g.addColorStop(0,rgba(col,.85));g.addColorStop(1,'rgba(15,18,26,.9)');ctx.fillStyle=g;ctx.fillRect(jx-162,jy+2,324,92);
    ctx.fillStyle='#fff';ctx.font='26px "Black Han Sans",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`"${F.nick}"`,jx,jy+36);
    ctx.font='700 13px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillText(F.name+' · '+F.d.from,jx,jy+66);
    ctx.fillStyle='#16191f';ctx.fillRect(jx-120,jy-80,4,74);ctx.fillRect(jx+116,jy-80,4,74)}
  ctx.restore();
  // sweeping stage beams in corner colour
  ctx.save();L(.3);ctx.globalCompositeOperation='lighter';
  for(let i=0;i<4;i++){const bx=cx*.3-300+i*200,a=Math.sin(t*.02+i*1.7)*.5;ctx.save();ctx.translate(bx,-60);ctx.rotate(a);const g=ctx.createLinearGradient(0,0,0,460);g.addColorStop(0,rgba(i%2?col:'#fff4dc',.22));g.addColorStop(1,rgba(i%2?col:'#fff4dc',0));ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(8,0);ctx.lineTo(90,460);ctx.lineTo(-90,460);ctx.fill();ctx.restore()}
  ctx.restore();
  // mid crowd standing at the barrier, arms up and phones out
  ctx.save();L(.8);
  for(const p of AIS.mid){const near=Math.abs(p.x-(ax-cx*.2))<170;const q=crowdPerson(p,t,hype||near,1,false);
    const up=(hype||near)&&p.arm>.35,armY=up?q.y-24*q.s-Math.max(0,Math.sin(t*.2+p.ph))*8:q.y+10*q.s;
    ctx.strokeStyle=p.c;ctx.lineWidth=4.5*q.s;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(q.x+8*q.s,q.y+10*q.s);ctx.lineTo(q.x+12*q.s+(up?Math.sin(t*.15+p.ph)*4:0),armY);ctx.stroke();
    if(p.phone&&up){ctx.fillStyle='#0e0f12';ctx.fillRect(q.x+9*q.s,armY-9,7,11);ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(q.x+10*q.s,armY-8,5,6)}}
  // barrier with sponsor boards
  ctx.fillStyle='#0c0d11';ctx.fillRect(-1000,330,3200,34);
  for(let x=-1000;x<2200;x+=170){ctx.fillStyle=(x/170|0)%2?'#14171e':'#171a22';ctx.fillRect(x,332,166,30);ctx.fillStyle=(x/170|0)%3===0?'rgba(232,179,58,.75)':'rgba(220,226,235,.55)';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ADS[((x/170|0)%8+8)%8],x+83,347)}
  ctx.fillStyle='#2a2f38';ctx.fillRect(-1000,328,3200,4);
  ctx.restore();
  // the walkway: dark runway with LED edge chasing toward the cage
  ctx.save();L(1);
  ctx.fillStyle='#0b0c10';ctx.fillRect(-1000,362,3200,200);
  const fl=ctx.createLinearGradient(0,362,0,430);fl.addColorStop(0,'#1a1d25');fl.addColorStop(1,'#0e1015');ctx.fillStyle=fl;ctx.fillRect(-1000,364,3200,60);
  for(let x=-1000;x<1400;x+=26){const ph=((x-t*6)%260+260)%260<60;ctx.fillStyle=ph?rgba(col,.95):rgba(col,.25);ctx.fillRect(x,364,16,3);ctx.fillRect(x,420,16,3)}
  // spotlight pool following the fighter
  {const g=ctx.createRadialGradient(ax,392,4,ax,392,150);g.addColorStop(0,'rgba(255,248,230,.32)');g.addColorStop(1,'rgba(255,248,230,0)');ctx.fillStyle=g;ctx.save();ctx.translate(ax,392);ctx.scale(1,.28);ctx.translate(-ax,-392);ctx.fillRect(ax-150,242,300,300);ctx.restore()}
  // cage at the end of the walkway: steps, door and fence
  {const gx=AISLE_END+150;ctx.fillStyle='#1c2028';ctx.fillRect(gx-40,300,600,70);ctx.fillStyle='#262b35';for(let k=0;k<3;k++)ctx.fillRect(gx-40-k*26,330+k*12,30,40-k*12);
    ctx.fillStyle='rgba(16,20,26,.6)';ctx.fillRect(gx,80,500,222);ctx.strokeStyle='rgba(175,190,210,.2)';ctx.lineWidth=1;ctx.beginPath();for(let x=gx-230;x<gx+500;x+=12){ctx.moveTo(x,80);ctx.lineTo(x+222,302);ctx.moveTo(x+222,80);ctx.lineTo(x,302)}ctx.save();ctx.beginPath();ctx.rect(gx,80,500,222);ctx.clip();ctx.stroke();ctx.restore();
    ctx.fillStyle='#16191f';ctx.fillRect(gx-8,70,16,232);ctx.fillRect(gx+240,70,16,232);ctx.fillStyle='#e8b33a';ctx.font='bold 10px sans-serif';ctx.save();ctx.translate(gx,190);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText('IRON CAGE',0,3);ctx.restore();
    ctx.fillStyle='#0d0f13';ctx.fillRect(gx,268,500,34)}
  // entourage + security
  const crew=W0.crew||(W0.crew=[{dx:-78,shirt:col,skin:'#c99a76',hair:'#1a1310',hs:'short',beard:true},{dx:-150,shirt:col,skin:'#e2b48c',hair:'#2a1f1a',hs:'buzz',beard:false,flag:true},{dx:-220,shirt:'#1a1c22',skin:'#b47a52',hair:'#141010',hs:'bald',beard:true},{dx:110,shirt:'#0d0e12',skin:'#8a5a3c',hair:'#141010',hs:'bald',beard:false,sec:true}]);
  const moving=F.state==='stroll';
  const people=crew.map(c=>({c,x:ax+c.dx})).concat([{F,x:ax}]).sort((p,q)=>p.x-q.x);
  for(const p of people){
    if(p.F){const ox=F.x,oz=F.z,oh=F.hidden;F.x=ax;F.z=0;drawStandingFighter(F,F===S.a?S.b:S.a,S);F.x=ox;F.z=oz;continue}
    const c=p.c,o={kind:'ref',logo:c.sec?'':'TEAM',look:{skin:c.skin,hair:c.hair,hairStyle:c.hs,beard:c.beard},skinNow:c.skin,shirt:c.shirt,pants:true,corner:col,head:100,body:100,legs:100,cuts:0,sweat:0,t};
    const R={x:p.x,f:1,moving,walk:F.walk+c.dx*.05,state:c.flag?'raise':'idle'};
    ctx.save();ctx.translate(p.x,GY);ctx.scale(.93,.93);ctx.translate(-p.x,-GY);shadowAt(p.x,40);drawBody(o,poseRef(R,S));
    if(c.sec){ctx.fillStyle='rgba(255,255,255,.8)';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText('SECURITY',p.x+3,262)}
    if(c.flag){ctx.strokeStyle='#c9c9c9';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x+12,170);ctx.lineTo(p.x+12,96);ctx.stroke();drawFlag(p.x+13,98,84,54,F.d.from,t)}
    ctx.restore();
  }
  /* cage-side ritual: the cutman greases the face, the commission checks gloves and body, then a hug with the coach */
  if((W0.ritV??W0.rit)>0&&(W0.ritV??W0.rit)<120){const r=W0.ritV??W0.rit,ox=ax+56+Math.max(0,r-82)*1.6,face=r<45,check=r>=45&&r<82;
    const o={kind:'ref',logo:'',look:{skin:'#d9a47e',hair:'#2a2a2a',hairStyle:'buzz',beard:false},skinNow:'#d9a47e',shirt:'#101114',pants:true,corner:'#888',head:100,body:100,legs:100,cuts:0,sweat:0,t};
    const w=Math.sin(t*.5),nh=face?{x:ax+14,y:207+w*4}:check?{x:ax+12,y:262+Math.abs(w)*10}:{x:ox-4,y:286},fh=face?{x:ax+20,y:214}:check?{x:ax+18,y:244+Math.abs(Math.sin(t*.5+1))*10}:{x:ox+6,y:288};
    ctx.save();ctx.translate(ox,GY);ctx.scale(.93,.93);ctx.translate(-ox,-GY);shadowAt(ox,40);
    drawBody(o,{f:-1,hip:{x:ox,y:300},chest:{x:ox-(face||check?6:0),y:233},tilt:face||check?.12:0,nearHand:nh,farHand:fh,nearFoot:{x:ox-12,y:GY},farFoot:{x:ox+12,y:GY},kneeN:'fwd',kneeF:'fwd',elbN:'down',elbF:'down'});
    ctx.fillStyle='rgba(255,255,255,.75)';ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.fillText(face?'CUTMAN':'COMMISSION',ox-3,262);ctx.restore();
  }
  // floor haze
  for(let i=0;i<8;i++){const hx=ax-260+i*80+Math.sin(t*.01+i)*30,hy=380+Math.sin(t*.013+i*2)*8,r=90;const g=ctx.createRadialGradient(hx,hy,0,hx,hy,r);g.addColorStop(0,'rgba(210,218,235,.09)');g.addColorStop(1,'rgba(210,218,235,0)');ctx.fillStyle=g;ctx.fillRect(hx-r,hy-r,r*2,r*2)}
  ctx.restore();
  // near crowd silhouettes passing in front, reaching out for high fives
  ctx.save();L(1.35);ctx.translate(0,botY-505);
  for(const p of AIS.near){const q=crowdPerson(p,t,hype,1,true);const rx=Math.abs(p.x-(ax+cx*.35))<200;
    if(rx&&p.arm>.3){ctx.strokeStyle='#0b0c10';ctx.lineWidth=5*q.s;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(q.x+6*q.s,q.y+8*q.s);ctx.lineTo(q.x+(rx?26:10)*q.s,q.y-(rx?30:22)*q.s-Math.sin(t*.2+p.ph)*5);ctx.stroke()}}
  ctx.restore();
  ctx.setTransform(m);
  // vignette + corner wash
  const vg=ctx.createRadialGradient(W/2,VH*.55,VH*.2,W/2,VH*.55,Math.max(W,VH)*.7);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.6)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,VH);
  ctx.fillStyle=rgba(col,.06);ctx.fillRect(0,0,W,VH);
}
const AISLE_END=600;
function computeCam(S){
  const a=S.a,b=S.b,az=S.gr?(S.gr.cz||0):((a.z||0)+(b.z||0))/2;let fx=(a.x+b.x)/2,fy=268+az*ZYd,z=clamp(1.44-(Math.abs(a.x-b.x)-70)/700,1.2,1.42);
  if(S.cl){fx=S.cl.cx;z=1.48}
  if(S.gr){fx=S.gr.cx;fy=318+az*ZYd;z=1.55}
  if(S.mode==='intro'){const p=1-S.phaseT/(S.introLen||110);fx=400;z=lerp(1,1.12,p);fy=255;
    if(S.walk){const k=S.walk.k||'';const F=/^blue/.test(k)?a:/^red/.test(k)?b:null,an=/Ann$/.test(k);if(F){fx=an?(F.x+400)/2:F.x;z=an?1.3:1.3;fy=an?232:225}else{fx=400;z=k==='faceoff'||k==='touch'||k==='rules'?1.32:1.3;fy=k==='faceoff'||k==='rules'?236:250}}}
  if(S.mode==='ko'||S.replay){const L=S.camFocus==='a'?a:b;fx=S.gr?S.gr.cx:L.x;z=S.replay?1.85:1.62;fy=S.gr?320:300}
  if(S.mode==='outro'){const Wn=S.winSide==='a'?a:S.winSide==='b'?b:null;if(S.cer&&(S.outT||0)<IC.Fight.OUT.reveal+30){fx=(a.x+b.x)/2;z=1.3;fy=245}else{fx=Wn?Wn.x:400;z=1.38;fy=250}}
  if(S.mode==='decision'){fx=400;z=1.2;fy=255}
  if(S.mode==='between'||S.mode==='pause'){z=1.05}
  if(VH>470)z*=Math.min(1.35,Math.sqrt(VH/450)*.95);
  z*=1+(S.zoomKick||0);
  /* keep every head below the HUD band (plates + commentary line): cap the zoom and lift the framing */
  if(!S.gr&&!S.replay&&!S.demo&&(S.mode==='fight'||S.mode==='pause'||S.mode==='between')){const hb=(OPT.hudBottom?94:108)*HS,headTop=165;
    const zc=(VH-hb-4)/(GY+6-headTop);if(z>zc)z=zc;const fyMax=headTop+(VH/2-hb)/z;if(fy>fyMax)fy=fyMax}
  const k=S.replay?.12:.07;
  cam.x+=(fx-cam.x)*k;cam.y+=(fy-cam.y)*k*.7;cam.z+=(z-cam.z)*k*.4;
  const zMin=Math.max(1,VH/(H+80));if(cam.z<zMin)cam.z=zMin;
  const hw=W/(2*cam.z),hh=VH/(2*cam.z),top=-10+hh,bot=H+70-hh;
  const Cg=S.cage||{x:400};cam.x=clamp(cam.x,Cg.x-330,Cg.x+330);cam.y=top<=bot?clamp(cam.y,top,bot):(top+bot)/2;
}

/* ---------- HUD (screen space, scaled for small screens) ---------- */
let HS=1,WH=W,HH=H;
function txt(t,x,y,size,col,align='left',weight='700',font='"IBM Plex Sans KR"'){ctx.font=`${weight} ${size}px ${font},sans-serif`;ctx.textAlign=align;ctx.fillStyle=col;ctx.fillText(t,x,y)}
function disp(t,x,y,size,col,align='left'){ctx.font=`${size}px "Black Han Sans",sans-serif`;ctx.textAlign=align;ctx.fillStyle=col;ctx.fillText(t,x,y)}
/* ---------- HUD design system: dark brushed metal plates, chamfered bars, glass panels ---------- */
const NUM='"Rajdhani","IBM Plex Sans KR"';
function num(t,x,y,size,col,align='left'){ctx.font=`700 ${size}px ${NUM},sans-serif`;ctx.textAlign=align;ctx.fillStyle=col;ctx.fillText(t,x,y)}
/* parallelogram path: slant > 0 leans the right edge */
function slab(x,y,w,h,sl,left=true){ctx.beginPath();if(left){ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w-sl,y+h);ctx.lineTo(x,y+h)}else{ctx.moveTo(x+sl,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h)}ctx.closePath()}
function metal(x,y,w,h){const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#3a404b');g.addColorStop(.08,'#232831');g.addColorStop(.55,'#12151b');g.addColorStop(1,'#07080b');return g}
function glass(x,y,w,h,r,a=.62){ctx.fillStyle=`rgba(12,15,22,${a})`;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
  const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'rgba(255,255,255,.14)');g.addColorStop(.45,'rgba(255,255,255,.03)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1;ctx.stroke()}
/* a premium bar: recessed track, glossy fill, delayed damage ghost, segment ticks, chamfered ends */
function lux(x,y,w,h,v,ghost,c0,c1,fromRight,ticks){
  const ch=Math.min(h*.7,6);const path=()=>{ctx.beginPath();ctx.moveTo(x+ch,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w-ch,y+h);ctx.lineTo(x,y+h);ctx.closePath()};
  ctx.save();path();ctx.fillStyle='#050608';ctx.fill();ctx.clip();
  const tg=ctx.createLinearGradient(0,y,0,y+h);tg.addColorStop(0,'rgba(0,0,0,.6)');tg.addColorStop(1,'rgba(255,255,255,.04)');ctx.fillStyle=tg;ctx.fillRect(x,y,w,h);
  const seg=(val,fill)=>{const vw=w*clamp(val,0,1);ctx.fillStyle=fill;ctx.fillRect(fromRight?x+w-vw:x,y,vw,h)};
  if(ghost!=null&&ghost>v)seg(ghost,'rgba(255,236,200,.85)');
  const fg=ctx.createLinearGradient(0,y,0,y+h);fg.addColorStop(0,shade(c0,1.45));fg.addColorStop(.45,c0);fg.addColorStop(.5,c1);fg.addColorStop(1,shade(c1,.7));seg(v,fg);
  ctx.fillStyle='rgba(255,255,255,.22)';const vw=w*clamp(v,0,1);ctx.fillRect(fromRight?x+w-vw:x,y+1,vw,Math.max(1,h*.22));
  if(ticks){ctx.fillStyle='rgba(0,0,0,.45)';for(let i=1;i<ticks;i++)ctx.fillRect(x+w*i/ticks,y,1,h)}
  ctx.restore();path();ctx.strokeStyle='rgba(255,255,255,.22)';ctx.lineWidth=1;ctx.stroke()}
/* metallic hairline border: cool chrome gradient stroked around a glass panel */
function chrome(x,y,w,h,r,accent){const g=ctx.createLinearGradient(x,y,x+w*.35,y+h);g.addColorStop(0,'rgba(236,240,246,.85)');g.addColorStop(.35,'rgba(120,128,142,.55)');g.addColorStop(.6,'rgba(40,44,52,.6)');g.addColorStop(1,accent?rgba(accent,.7):'rgba(190,198,210,.7)');
  ctx.beginPath();ctx.roundRect(x+.75,y+.75,w-1.5,h-1.5,r);ctx.strokeStyle=g;ctx.lineWidth=1.5;ctx.stroke()}
function frost(x,y,w,h,r,a=.5){ctx.save();ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=16;ctx.shadowOffsetY=4;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=`rgba(10,13,19,${a})`;ctx.fill();ctx.restore();
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.clip();const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'rgba(255,255,255,.13)');g.addColorStop(.5,'rgba(255,255,255,.035)');g.addColorStop(.5,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,.03)');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);ctx.restore()}
/* thin labelled bar used for stamina and each leg */
function miniBar(x,y,w,label,v,c,fromRight){ctx.textBaseline='middle';num(label,fromRight?x+w:x,y+3,9,'rgba(214,220,230,.7)',fromRight?'right':'left');ctx.font=`700 9px ${NUM},sans-serif`;const lw=ctx.measureText(label).width+5;
  lux(fromRight?x:x+lw,y,w-lw,6,v,null,c,shade(c,.72),fromRight,0)}
/* live face in the HUD: same face as the fighter, reacting in real time (hurt, rocked, gasping, blood, swelling) */
function hudFace(F,cx,cy,r,f,S){if(!F.look)return;ctx.save();
  const hitK=F.state==='hit'?1:0,rock=F.rocked>0;
  ctx.beginPath();ctx.arc(cx,cy,r,0,7);const bg=ctx.createRadialGradient(cx,cy-r*.3,2,cx,cy,r);bg.addColorStop(0,rgba(F.corner,.55));bg.addColorStop(1,'rgba(8,10,14,.95)');ctx.fillStyle=bg;ctx.fill();
  ctx.save();ctx.clip();
  const mood=F.state==='ko'?'ko':(hitK||rock||(S.sub&&S.sub.def===F))?'hurt':F.exh?'tired':(F.state==='attack'&&F.A&&(F.A.special||F.A.kind==='shoot'))?'yell':null;
  const o=fighterLook(F,{mood});o.blink=!mood&&((S.frame+(f>0?0:57))%170)<6;o.t=S.frame;
  const shake=hitK?Math.sin(S.frame*2.1)*1.6:rock?Math.sin(S.frame*.3)*1.2:0,sc=r/22;
  ctx.translate(cx+shake,cy+r*.1);ctx.scale(sc,sc);
  ctx.rotate(rock?Math.sin(S.frame*.15)*.12:0);ctx.translate(0,212);
  drawFront(F,S.frame,{walk:0,perf:'hud',noBuild:true,dmg:{head:F.head??100,cuts:F.cuts||0,mood},blink:o.blink,t:S.frame,sweat:o.sweat,guard:(o.face||{}).guard});
  ctx.setTransform(ctx.getTransform());ctx.restore();
  if(hitK){ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fillStyle='rgba(255,40,30,.28)';ctx.fill();ctx.restore()}
  ctx.restore();
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.lineWidth=2;ctx.strokeStyle=hitK?'#ff5a4a':rgba(F.corner,.9);ctx.stroke();ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.35)';ctx.beginPath();ctx.arc(cx,cy,r-2.5,Math.PI*1.1,Math.PI*1.7);ctx.stroke();ctx.restore();
  if(r>=20){const h=F.head,st=F.state==='ko'?['KO','#ff3b2e']:rock?['그로기','#ff5a4a']:F.exh?['탈진','#c0c6d0']:h<30?['위험','#ff5a4a']:h<55?['출혈·부음','#ffb02e']:h<80?['타격 누적','#ffd54a']:['멀쩡','#8fe0a6'];
   ctx.font='800 7.5px "IBM Plex Sans KR",sans-serif';const tw=ctx.measureText(st[0]).width+8;ctx.fillStyle='rgba(8,10,14,.9)';ctx.beginPath();ctx.roundRect(cx-tw/2,cy+r-3,tw,11,5.5);ctx.fill();ctx.strokeStyle=st[1];ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=st[1];ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(st[0],cx,cy+r+2.6)}
}
/* UFC-game style HUD: slim name bar, stamina (short-term over long-term), and a body damage silhouette that bruises red */
function dmgCol(v){v=clamp(v,0,100);const k=1-v/100;const a=[[0,[226,232,240]],[.25,[255,214,120]],[.5,[255,140,60]],[.75,[230,40,40]],[1,[140,0,0]]];let i=0;while(i<a.length-2&&k>a[i+1][0])i++;const [k0,c0]=a[i],[k1,c1]=a[i+1],t=clamp((k-k0)/(k1-k0),0,1);return `rgb(${c0.map((c,j)=>Math.round(c+(c1[j]-c)*t)).join(',')})`}
function bodySil(F,cx,cy,s,S,f){ctx.save();ctx.translate(cx,cy);ctx.scale(s,s);
  const fl=v=>v<25&&Math.floor(S.frame/9)%2,pulse=v=>v<45?.35+.25*Math.sin(S.frame*.2):0;
  const part=(v,draw,glowR,gx,gy)=>{const p=pulse(v);if(p>0){const g=ctx.createRadialGradient(gx,gy,0,gx,gy,glowR);g.addColorStop(0,`rgba(255,40,30,${p})`);g.addColorStop(1,'rgba(255,40,30,0)');ctx.fillStyle=g;ctx.fillRect(gx-glowR,gy-glowR,glowR*2,glowR*2)}
    ctx.beginPath();draw();ctx.fillStyle=fl(v)?'#ffffff':dmgCol(v);ctx.fill();ctx.strokeStyle='rgba(0,0,0,.65)';ctx.lineWidth=1.1;ctx.stroke()};
  const lL=F.lgL??F.legs,lR=F.lgR??F.legs;
  /* the figure faces the camera: the fighter's left leg is on our right */
  part(lR,()=>{ctx.moveTo(-7,14);ctx.lineTo(-1.2,14);ctx.lineTo(-1.8,38);ctx.lineTo(-7.5,38);ctx.closePath()},10,-4,28);
  part(lL,()=>{ctx.moveTo(1.2,14);ctx.lineTo(7,14);ctx.lineTo(7.5,38);ctx.lineTo(1.8,38);ctx.closePath()},10,4,28);
  part(F.body,()=>{ctx.moveTo(-10,-8);ctx.quadraticCurveTo(0,-11,10,-8);ctx.lineTo(13,0);ctx.lineTo(8,4);ctx.lineTo(7.5,15);ctx.lineTo(-7.5,15);ctx.lineTo(-8,4);ctx.lineTo(-13,0);ctx.closePath()},16,0,3);
  part(F.head,()=>{ctx.ellipse(0,-17,6,7.2,0,0,7)},12,0,-17);
  ctx.restore()}
function staBar(x,y,w,h,F,rtl){const mx=clamp((100-(100-(F.body??100))*.4)/100,0,1),st=clamp((F.st??100)/100,0,1);
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,h/2);ctx.fillStyle='rgba(0,0,0,.55)';ctx.fill();ctx.clip();
  const seg=(v,col)=>{const ww=w*v;ctx.fillStyle=col;ctx.fillRect(rtl?x+w-ww:x,y,ww,h)};
  seg(mx,'rgba(120,90,40,.55)');                                   /* long-term: body damage caps the tank */
  const g=ctx.createLinearGradient(0,y,0,y+h);const c=F.exh?['#9aa3b2','#5c6370']:st<.25?['#ffd27a','#c8811c']:['#fff3a8','#e8b33a'];g.addColorStop(0,c[0]);g.addColorStop(1,c[1]);seg(Math.min(st,mx),g);
  ctx.fillStyle='rgba(0,0,0,.35)';for(let i=1;i<10;i++)ctx.fillRect(x+w*i/10,y,1,h);ctx.restore()}
function plate(F,side,S){
  const left=side==='a',cc=F.corner,pw=Math.min(300,WH/2-64),x=left?10:WH-10-pw,y=8,al=left?'left':'right';
  /* name bar */
  const nh=30;frost(x,y,pw,nh,8,.78);ctx.save();ctx.beginPath();ctx.roundRect(x,y,pw,nh,8);ctx.clip();
  const cw=ctx.createLinearGradient(left?x:x+pw,0,left?x+pw*.55:x+pw*.45,0);cw.addColorStop(0,rgba(cc,.55));cw.addColorStop(1,rgba(cc,0));ctx.fillStyle=cw;ctx.fillRect(x,y,pw,nh);
  ctx.fillStyle=cc;ctx.fillRect(left?x:x+pw-5,y,5,nh);ctx.restore();chrome(x,y,pw,nh,8,cc);
  const fx=left?x+28:x+pw-28;hudFace(F,fx,y+nh/2+1,17,left?1:-1,S);
  ctx.textBaseline='middle';const nx=left?x+52:x+pw-52;let nm=(F.nick||'').toUpperCase();ctx.font='17px "Black Han Sans",sans-serif';while(ctx.measureText(nm).width>pw*.5&&nm.length>2)nm=nm.slice(0,-1);
  ctx.save();ctx.shadowColor='rgba(0,0,0,.8)';ctx.shadowBlur=4;disp(nm,nx,y+nh/2+1,17,'#ffffff',al);ctx.restore();
  ctx.font='17px "Black Han Sans",sans-serif';const nw=ctx.measureText(nm).width;const rec=(F.d&&F.d.rec?F.d.rec.slice(0,2).join('-'):'')+(F.stance==='south'?' · 사우스포':'');
  txt(rec,left?nx+nw+8:nx-nw-8,y+nh/2+1,9.5,'rgba(220,226,236,.7)',al,'700');
  /* stamina + body silhouette under the name bar */
  const sy=y+nh+6,sw=pw-38,sx=left?x+4:x+pw-4-sw;staBar(sx,sy,sw,7,F,!left);
  txt('STAMINA',left?sx:sx+sw,sy+15,7.5,'rgba(214,220,230,.5)',al,'800');
  if(F.rocked>0){ctx.save();ctx.globalAlpha=.6+.4*Math.sin(S.frame*.4);txt('ROCKED',left?sx+sw:sx,sy+15,8.5,'#ff5a4a',left?'right':'left','800');ctx.restore()}
  bodySil(F,left?x+pw-15:x+15,y+nh+26,.75,S,left?1:-1);
  /* special diamonds + status tags */
  const ry=y+nh+34;for(let i=0;i<5;i++){const fill=clamp(F.meter/20-i,0,1),px=left?x+10+i*13:x+pw-10-i*13;
    ctx.save();ctx.translate(px,ry);ctx.rotate(Math.PI/4);ctx.fillStyle='rgba(10,13,19,.7)';ctx.fillRect(-4,-4,8,8);ctx.strokeStyle='rgba(220,226,236,.35)';ctx.lineWidth=.8;ctx.strokeRect(-4,-4,8,8);
      if(fill>0){ctx.globalAlpha=fill;ctx.fillStyle=F.meter>=100?'#ffd75e':'#b98cff';if(F.meter>=100){ctx.shadowColor='#ffd75e';ctx.shadowBlur=10}ctx.fillRect(-2.8,-2.8,5.6,5.6)}ctx.restore()}
  const tags=[];if(F.meter>=100)tags.push(['필살기 READY','#ffd75e']);if(F.heart>0)tags.push(['투혼','#ff6a55']);if(F.exh)tags.push(['탈진','#c0c6d0']);
  if(F.inj){const t=Object.keys(F.inj).map(k=>({hand:'손',knee:'무릎',rib:'갈비',eye:'눈'})[k]).join('·');if(t)tags.push(['부상 '+t,'#ff8b7f'])}
  let tx=left?x+10+5*13+2:x+pw-10-5*13-2;ctx.textBaseline='middle';
  for(const [t,c] of tags){ctx.font='11px "Black Han Sans",sans-serif';const w=ctx.measureText(t).width;if(F.heart>0&&t==='투혼')ctx.globalAlpha=.6+.4*Math.abs(Math.sin(S.frame*.15));disp(t,tx,ry+1,11,c,al);ctx.globalAlpha=1;tx+=left?w+10:-(w+10)}
  ctx.textBaseline='alphabetic';
}
/* left / right leg health as two small vertical bars (the figure faces us, so its left leg sits on our right) */
function legGauges(F,sx,top,c){const h=15;for(const [k,dx] of [['R',-3.2],['L',3.2]]){const v=clamp((F['lg'+k]??F.legs)/100,0,1);
    ctx.fillStyle='#262b33';ctx.fillRect(sx+dx-1.9,top,3.8,h);ctx.fillStyle=v<.3?'#e2553f':c(v*100);ctx.fillRect(sx+dx-1.9,top+h*(1-v),3.8,h*v);
    if(v<.3&&Math.floor(Date.now()/250)%2){ctx.strokeStyle='#ff6b5e';ctx.lineWidth=1;ctx.strokeRect(sx+dx-2.4,top-.5,4.8,h+1)}}}
function comboOverlay(S){
  const c=S.comboFx;if(!c)return;const k=c.t/60,sc=1+Math.max(0,(c.t-50)/10)*.35;
  ctx.save();ctx.globalAlpha=Math.min(1,c.t/15);ctx.translate(WH*.24,HH*.36);ctx.scale(sc,sc);ctx.rotate(-.06);ctx.textAlign='center';ctx.textBaseline='middle';
  if(c.txt){ctx.font='20px "Black Han Sans",sans-serif';ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText(c.txt,0,0);ctx.fillStyle=c.col;ctx.fillText(c.txt,0,0)}
  else{ctx.font='40px "Black Han Sans",sans-serif';ctx.lineWidth=7;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText(c.n,0,-6);ctx.fillStyle=c.col;ctx.fillText(c.n,0,-6);
    ctx.font='15px "Black Han Sans",sans-serif';ctx.lineWidth=4;ctx.strokeText('HIT COMBO',0,22);ctx.fillText('HIT COMBO',0,22);
    if(c.n>=3){ctx.font='700 11px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#ffd75e';ctx.fillText(`데미지 +${Math.round(Math.min(45,(c.n-1)*9))}%`,0,40)}}
  ctx.restore();
}
function heartOverlay(S){
  const P=S.p;if(!(P.heart>0))return;const a=.18+.12*Math.abs(Math.sin(S.frame*.12));
  const g=ctx.createRadialGradient(WH/2,HH/2,Math.min(WH,HH)*.35,WH/2,HH/2,Math.max(WH,HH)*.7);g.addColorStop(0,'rgba(255,40,30,0)');g.addColorStop(1,`rgba(255,40,30,${a})`);ctx.fillStyle=g;ctx.fillRect(0,0,WH,HH);
}
/* compact scoreboard for phones held sideways: sits above the centre buttons, clear of the app's top bar */
function hudBottom(S){
  const w=Math.min(WH*.36,320),h=50,x=WH/2-w/2,y=HH*.835-h,cx=WH/2;
  ctx.fillStyle='rgba(8,10,14,.92)';ctx.beginPath();ctx.roundRect(x,y,w,h,8);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;ctx.stroke();
  const cw=46,bw=(w-cw-20)/2;
  for(const [F,left] of [[S.a,true],[S.b,false]]){
    const bx=left?x+8:cx+cw/2+2,hp=Math.max(0,Math.round(Math.min(F.head,F.body,F.legs)));
    ctx.textBaseline='alphabetic';let nm=F.nick;ctx.font='700 11px "IBM Plex Sans KR",sans-serif';while(ctx.measureText(nm).width>bw-30&&nm.length>2)nm=nm.slice(0,-1);
    txt(nm,left?bx:bx+bw,y+14,11,'#ffffff',left?'left':'right','700');txt(hp+'%',left?bx+bw:bx,y+14,11,hp<30?'#ffb02e':'#d9dce2',left?'right':'left','700');
    ctx.fillStyle='#3a1216';ctx.fillRect(bx,y+19,bw,11);const v=clamp(F.head/100,0,1),vw=bw*v,hc=F.head<30?'#ffb02e':F.head<55?'#ffd54a':F.corner;
    ctx.fillStyle=hc;ctx.fillRect(left?bx+bw-vw:bx,y+19,vw,11);ctx.fillStyle='rgba(0,0,0,.35)';for(let i=1;i<10;i++)ctx.fillRect(bx+bw*i/10,y+19,1,11);
    ctx.fillStyle='#262b33';ctx.fillRect(bx,y+33,bw,4);const sw=bw*clamp(F.st/100,0,1);ctx.fillStyle=F.st<25?'#c0c6d0':'#f2c043';ctx.fillRect(left?bx+bw-sw:bx,y+33,sw,4);
    for(let i=0;i<5;i++){const fill=clamp(F.meter/20-i,0,1),px=left?bx+i*9:bx+bw-i*9-6;ctx.fillStyle='#2a2f3a';ctx.fillRect(px,y+41,6,4);ctx.globalAlpha=fill;ctx.fillStyle=F.meter>=100?'#ffd75e':'#b98cff';ctx.fillRect(px,y+41,6,4);ctx.globalAlpha=1}
    {const lx=left?bx+50:bx+bw-50-30;for(const [k,i] of [['L',0],['R',1]]){const v=clamp((F['lg'+k]??F.legs)/100,0,1),xx=lx+i*16;ctx.fillStyle='#2a2f3a';ctx.fillRect(xx,y+41,13,4);ctx.fillStyle=v<.3?'#e2553f':v<.6?'#e8b33a':'#5fbf72';ctx.fillRect(xx,y+41,13*v,4)}}
    if(F.exh)txt('탈진',left?bx+bw:bx,y+46,9,'#c0c6d0',left?'right':'left','800');
    else if(F.heart>0)txt('투혼',left?bx+bw:bx,y+46,9,'#ff6a55',left?'right':'left','700');
  }
  ctx.fillStyle=S.title?'#e8b33a':'#2a2f3a';ctx.fillRect(cx-cw/2,y+4,cw,13);ctx.textBaseline='middle';txt(S.inf?'연습':`R${S.round}`,cx,y+11,9.5,S.title?'#101318':'#e9e6df','center','700');
  const s=Math.ceil(S.timer/60);disp(S.inf?'∞':`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`,cx,y+33,16,S.timer<600&&S.mode==='fight'&&!S.inf?'#ff6b5e':'#f2efe8','center');
}
function hud(S){
  heartOverlay(S);
  const cx=WH/2;
  if(OPT.hudBottom)hudBottom(S);
  else{
  {const tb=ctx.createLinearGradient(0,0,0,92);tb.addColorStop(0,'rgba(6,7,10,.95)');tb.addColorStop(.7,'rgba(6,7,10,.8)');tb.addColorStop(1,'rgba(6,7,10,0)');ctx.fillStyle=tb;ctx.fillRect(0,0,WH,92)}
  plate(S.a,'a',S);plate(S.b,'b',S);
  // clock
  {const w=92,h=50,x0=cx-w/2,y0=8;frost(x0,y0,w,h,14,.6);chrome(x0,y0,w,h,14,S.title?'#e8b33a':null);
    ctx.textBaseline='middle';num(S.inf?'PRACTICE':S.title?`TITLE · ROUND ${S.round}`:`ROUND ${S.round} / ${S.rounds}`,cx,y0+11,8.5,S.title?'#e8b33a':'rgba(214,220,230,.75)','center');
    ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(x0+14,y0+18,w-28,1);
    const s=Math.ceil(S.timer/60),warn=S.timer<600&&S.mode==='fight'&&!S.inf;
    ctx.save();if(warn){ctx.shadowColor='#ff3b2e';ctx.shadowBlur=10}num(S.inf?'∞':`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`,cx,y0+34,24,warn?'#ff6b5e':'#f2efe8','center');ctx.restore()}
  }
  // live scoring lean for the current round
  if(S.mode==='fight'&&!S.inf&&!OPT.hudBottom){const l=clamp((S.lean||0)/40,-1,1),w=80,x0=cx-w/2,y0=64;ctx.fillStyle='rgba(11,13,18,.7)';ctx.beginPath();ctx.roundRect(x0,y0,w,5,2.5);ctx.fill();
    ctx.fillStyle=l>=0?S.a.corner:S.b.corner;const half=w/2;if(l>=0)ctx.fillRect(cx-half*l,y0,half*l,5);else ctx.fillRect(cx,y0,half*-l,5);ctx.fillStyle='#fff';ctx.fillRect(cx-.5,y0-1,1,7);
    if(S.a.plan){txt({press:'압박',wrestle:'레슬링',safe:'안전'}[S.a.plan]||'',x0-6,y0+3,9,'#8e97a6','right','700')}}
  // position chip
  let chip=null;
  if(S.gr&&!S.sub)chip=`${IC.Fight.POSN[S.gr.pos]} · ${S.gr.top.nick} 상위`;
  else if(S.cl&&!S.gr)chip=`클린치 · ${S.cl.ctrl.nick}${S.cl.cage?' · 케이지':''}`;
  if(chip){ctx.font='700 10.5px "IBM Plex Sans KR",sans-serif';const w=ctx.measureText(chip).width+18;frost(cx-w/2,76,w,20,10,.6);chrome(cx-w/2,76,w,20,10);ctx.textBaseline='middle';txt(chip,cx,86.5,10.5,'#f2efe8','center')}
  // corner coach call
  if(S.coach&&!S.demo&&!S.replay&&S.mode==='fight'){const C=S.coach,a=Math.min(1,C.t/8)*(C.t>C.dur+50?Math.max(0,1-(C.t-C.dur-50)/20):1);
    ctx.save();ctx.globalAlpha=a;ctx.font='800 14px "IBM Plex Sans KR",sans-serif';const tw=ctx.measureText(C.text).width,bw=Math.min(WH*.62,Math.max(tw+64,C.want?190:0)),bh=C.want?52:36,bx=10,by=Math.round(HH*.36),pop=C.t<8?1+(8-C.t)*.02:1;
    ctx.translate(bx,by+bh/2);ctx.scale(pop,pop);ctx.translate(-bx,-(by+bh/2));
    glass(bx,by,bw,bh,12,.78);ctx.beginPath();ctx.roundRect(bx,by,bw,bh,12);ctx.strokeStyle=C.done?'#4cc38a':C.fail?'rgba(255,107,94,.7)':'rgba(61,127,240,.8)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle=S.a.corner;ctx.beginPath();ctx.arc(bx+20,by+18,12,0,7);ctx.fill();txt('🗣',bx+20,by+23,13,'#fff','center','400','sans-serif');
    txt('코치',bx+40,by+13,9.5,'#7fb2ff','left','800');txt(C.text,bx+40,by+28,14,'#fff','left','800');
    if(C.want){const k=C.done?1:C.fail?0:Math.max(0,1-C.t/C.dur);ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(bx+40,by+38,bw-52,4);ctx.fillStyle=C.done?'#4cc38a':C.fail?'#ff6b5e':'#3d7ff0';ctx.fillRect(bx+40,by+38,(bw-52)*(C.done?1:k),4);
      txt(C.done?'✓ 성공! 필살기 게이지 +18 · 스태미나 회복':C.fail?'지시를 놓쳤다':(C.need>1?`${C.n}/${C.need}`:'지시를 따르면 보너스'),bx+40,by+50,9.5,C.done?'#9fe0a8':C.fail?'#ff8b7f':'rgba(233,230,223,.7)','left','700')}
    ctx.restore()}
  // commentary lower third
  /* commentary ticker: one line, tucked under the HUD between the two plates so it never covers a face */
  {const f=S.feed[S.feed.length-1],stc=S.stCall&&S.frame-S.stCall.f>=0&&S.frame-S.stCall.f<=80;if(f&&f.t>40&&!stc){const wideV=VH/W<.56,a=Math.min(1,(f.t-40)/20,f.t/30);
    /* up top, centred under the round clock between the two fighters' plates (the bottom belongs to the controls) */
    const top=!OPT.hudBottom,TB=OPT.tickBand,fw=top?Math.min(WH*.46,360):wideV&&TB?Math.max(150,Math.min(420,TB.r-TB.l)):Math.min(WH*(wideV?.34:.86),420),fx=top?cx-fw/2:wideV&&TB?TB.l+((TB.r-TB.l)-fw)/2:WH/2-fw/2,fy=top?(S.sub?150:chip?126:104):HH-30,h=22;
    ctx.save();ctx.globalAlpha=a;frost(fx,fy,fw,h,11,.62);chrome(fx,fy,fw,h,11);
    const lab=f.who==='color'?'해설':'캐스터',lc=f.who==='color'?'#e8b33a':'#7fb2ff';ctx.textBaseline='middle';
    ctx.fillStyle=f.who==='color'?'#e8b33a':'#ff5a4a';ctx.beginPath();ctx.arc(fx+11,fy+h/2,3,0,7);ctx.fill();
    txt(lab,fx+19,fy+h/2+.5,9.5,lc,'left','800');ctx.font='800 9.5px "IBM Plex Sans KR",sans-serif';const lw=ctx.measureText(lab).width+26;
    let t=f.text;ctx.font='600 11px "IBM Plex Sans KR",sans-serif';while(ctx.measureText(t).width>fw-lw-12&&t.length>4)t=t.slice(0,-2)+'…';
    ctx.fillStyle=f.who==='color'?'#f3e3b8':'#f1f2f5';ctx.textAlign='left';ctx.fillText(t,fx+lw,fy+h/2+.5);ctx.restore()}}
  // submission meter
  if(S.sub){
    const s=S.sub,bw=Math.min(300,WH*.7),bx=cx-bw/2,by=86,me=s.att===S.p,them=s.def===S.p;
    ctx.fillStyle='rgba(12,14,19,.9)';ctx.beginPath();ctx.roundRect(bx-12,by-28,bw+24,64,6);ctx.fill();
    disp(s.name,cx,by-13,16,'#ffd75e','center');
    const p=clamp(s.prog,0,100)/100,ac=s.att.corner,dc=s.def.corner;
    ctx.fillStyle=rgba(dc,.85);ctx.fillRect(bx,by,bw,14);ctx.fillStyle=ac;ctx.fillRect(bx,by,bw*p,14);
    ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(bx+bw/3,by,1.5,14);ctx.fillRect(bx+bw*2/3,by,1.5,14);
    ctx.fillStyle='#fff';ctx.fillRect(bx+bw*p-2,by-3,4,20);
    txt('탈출',bx,by+26,9.5,'#8e97a6','left','600');txt('그립',bx+bw/6,by+26,9.5,'#8e97a6','center','600');txt('고정',bx+bw/2,by+26,9.5,'#8e97a6','center','600');txt('피니시',bx+bw*5/6,by+26,9.5,'#8e97a6','center','600');
    if(me||them){const pulse=.6+.4*Math.abs(Math.sin(S.frame*.3));ctx.globalAlpha=pulse;disp(me?'연타로 조여라!':'연타로 탈출!',cx,by+46,14,me?'#9fe0a8':'#ff9f94','center');ctx.globalAlpha=1}
  }
  if(S.practice&&S.tasks){
    const x=10,y0=118,n=S.tasks.filter(tk=>(S.events[tk.ev]||0)>0).length,show=S.tasks.filter(tk=>!(S.events[tk.ev]>0)).slice(0,5),ph=Math.max(1,show.length)*12.5+30;frost(x,y0-22,136,ph,14,.55);chrome(x,y0-22,136,ph,14);ctx.fillStyle='rgba(255,255,255,.1)';ctx.fillRect(x+10,y0-2,116,1);
    ctx.textBaseline='alphabetic';disp('훈련 과제',x+11,y0-7,12,'#e8b33a');num(`${n} / ${S.tasks.length}`,x+60+4,y0-7,10,'rgba(214,220,230,.7)','left');
    (show.length?show:[{label:'모든 과제 완료!',ev:'__'}]).forEach((tk,i)=>{const done=!show.length;txt((done?'✓  ':'•  ')+tk.label,x+12,y0+10+i*12.5,9.5,done?'#7fe3a8':'rgba(226,230,238,.85)','left','600')});
  }
}
/* walkout: spotlight, haze, broadcast name graphics and the announcer's lines */
const STYLE_LINE={taekwondo:'눈으로 쫓을 수 없는 발, 뒤후려차기 한 방이 있는 태권 파이터',kickboxer:'긴 다리로 거리를 지배하는 킥 스페셜리스트',boxer:'날카로운 손기술과 카운터의 장인',muaythai:'팔꿈치와 니킥, 클린치에서 가장 위험한 남자',karate:'번개 같은 출입과 예측 불가한 킥',wrestler:'한 번 잡으면 놓지 않는 레슬링 머신',bjj:'바닥으로 가는 순간 끝나는 서브미션 사냥꾼',sambo:'던지고 누르고 꺾는 삼보의 압박',brawler:'모든 주먹에 KO를 담는 난타전의 왕',allround:'어디서 싸워도 약점이 없는 완성형'};
function introPanel(S,F,t,songK){
  const d=F.d,p=clamp((t-35)/18,0,1);if(p<=0)return;const e=1-Math.pow(1-p,3);
  const w=Math.min(WH*.44,300),h=Math.min(HH-24,268),x=lerp(WH+10,WH-w-12,e),y=12,col=F.corner;
  ctx.save();ctx.globalAlpha=Math.min(1,p*1.5);
  ctx.fillStyle='rgba(9,11,15,.9)';ctx.beginPath();ctx.roundRect(x,y,w,h,8);ctx.fill();
  const hg=ctx.createLinearGradient(x,0,x+w,0);hg.addColorStop(0,rgba(col,.95));hg.addColorStop(1,rgba(col,.25));ctx.fillStyle=hg;ctx.beginPath();ctx.roundRect(x,y,w,26,[8,8,0,0]);ctx.fill();
  ctx.textBaseline='alphabetic';
  const champ=S.title&&F.side==='b',cls=(IC.CLASSES.find(c=>c.id===d.cls)||{}).name||'';
  txt(`${F.side==='a'?'블루':'레드'} 코너 · ${cls}${champ?' 챔피언':''}`,x+12,y+17,11,'#ffffff','left','700');
  txt(`종합 ${d.ovr}`,x+w-12,y+17,11,'#ffffff','right','700');
  // flag + name
  drawFlagMini(x+12,y+36,26,17,d.from);
  disp(`"${F.nick}"`,x+46,y+52,Math.min(22,w*.08),'#ffffff','left');
  txt(`${F.name} · ${d.from}`,x+12,y+72,12,'rgba(233,230,223,.85)','left','700');
  // tale rows
  const rec=d.rec||[0,0,0],rows=[['전적',`${rec[0]}승 ${rec[1]}패${rec[2]?' '+rec[2]+'무':''}`],['스타일',IC.STYLES[d.style].name],['나이',`${d.age||'-'}세`],['키 · 리치',`${d.height||'-'} / ${d.reach||'-'}cm`],['필살기',(IC.SPM[d.special]||{}).name||'-']];
  const rh=Math.max(14,Math.min(17,(h-150)/rows.length));
  rows.forEach((r,i)=>{const ry=y+92+i*rh;if(i%2===0){ctx.fillStyle='rgba(255,255,255,.04)';ctx.fillRect(x+8,ry-11,w-16,rh)}txt(r[0],x+14,ry,10.5,'rgba(233,230,223,.6)','left','700');txt(r[1],x+w-14,ry,11.5,'#f3f1ea','right','700')});
  // top strengths as bars
  const by=y+92+rows.length*rh+6,top=Object.entries(d.s||{}).sort((a,b)=>b[1]-a[1]).slice(0,3);
  txt('강점',x+14,by+4,10,'#e8b33a','left','700');
  top.forEach(([k,v],i)=>{const yy=by+12+i*13,bw=w-120,pv=clamp((t-90-i*8)/30,0,1)*v/100;
    txt(IC.STATN[k]||k,x+14,yy+8,10,'rgba(233,230,223,.8)','left','600');ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(x+92,yy+1,bw,7);ctx.fillStyle=col;ctx.fillRect(x+92,yy+1,bw*pv,7);txt(String(v),x+w-12,yy+8,10,'#ffffff','right','700')});
  // one-line scouting description
  const line=STYLE_LINE[d.style]||'';const ly=Math.min(by+12+top.length*13+12,y+h-8);
  if(ly>by+12+top.length*13){ctx.font='italic 600 10.5px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='rgba(243,227,184,.9)';ctx.textAlign='left';let ln=line;while(ln.length>4&&ctx.measureText('“'+ln+'”').width>w-24)ln=ln.slice(0,-2);ctx.fillText('“'+ln+(ln!==line?'…':'')+'”',x+12,ly)}
  ctx.restore();
}
function drawFlagMini(x,y,w,h,from){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();drawFlag(x,y,w,h,from,0);ctx.restore();ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h)}
const TIERL={practice:0,regional:0,prelim:1,main:2,title:3,under:0};
/* deterministic spark fountain (gerb): sparks shoot up from (x,y) and fall back */
function gerb(x,y,h,t,n,col){ctx.save();ctx.globalCompositeOperation='lighter';
  const g=ctx.createRadialGradient(x,y,0,x,y,h*.45);g.addColorStop(0,'rgba(255,190,90,.55)');g.addColorStop(1,'rgba(255,120,30,0)');ctx.fillStyle=g;ctx.fillRect(x-h*.45,y-h*.45,h*.9,h*.9);
  for(let i=0;i<n;i++){const s=(i*97.13)%1,life=34+(i*13%20),age=(t+i*7)%life,k=age/life,vx=(Math.sin(i*12.9)*.55)*h*.012,vy=-(h/life)*(1.6+s*.6);
    const px=x+vx*age,py=y+vy*age+.5*(h*.0045)*age*age;ctx.globalAlpha=(1-k)*.9;ctx.fillStyle=k<.3?'#fff4c8':k<.6?'#ffb347':col||'#ff6a1a';ctx.fillRect(px,py,1.6,3+4*(1-k))}
  ctx.restore()}
/* firework shell bursting at (x,y) */
/* flame jet: a roaring column of fire from a floor cannon (t = frames since ignition) */
function flameJet(x,y,h,t,dur=34){if(t<0||t>dur+18)return;const up=Math.min(1,t/5),fade=t>dur?1-(t-dur)/18:1,H=h*up*(.9+.1*Math.sin(t*1.7));if(fade<=0)return;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;
  for(let i=0;i<14;i++){const k=i/14,yy=y-H*k,w=(10+k*26)*(1+.25*Math.sin(t*.9+i*1.3)),xx=x+Math.sin(t*.6+i*2.1)*k*10;const g=ctx.createRadialGradient(xx,yy,0,xx,yy,w);
    g.addColorStop(0,k<.25?'rgba(255,250,220,.9)':k<.6?'rgba(255,190,70,.7)':'rgba(255,110,30,.45)');g.addColorStop(1,'rgba(255,60,10,0)');ctx.fillStyle=g;ctx.fillRect(xx-w,yy-w,w*2,w*2)}
  const gl=ctx.createRadialGradient(x,y,0,x,y,h*.9);gl.addColorStop(0,'rgba(255,160,60,.35)');gl.addColorStop(1,'rgba(255,120,40,0)');ctx.fillStyle=gl;ctx.fillRect(x-h,y-h,h*2,h*1.2);
  ctx.fillStyle='#1a1a1e';ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillRect(x-7,y-4,14,8);ctx.restore()}
/* spark waterfall: a curtain of sparks pouring from the truss */
function sparkFall(x0,x1,y,h,t,n){ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<n;i++){const s=((i*0.618)%1),x=x0+(x1-x0)*s,life=40+(i*7)%24,age=(t+i*5)%life,k=age/life,py=y+k*k*h;
  ctx.globalAlpha=(1-k)*.9;ctx.fillStyle=k<.3?'#fff8dc':'#ffb347';ctx.fillRect(x+Math.sin(i+t*.05)*2,py,1.6,4+6*(1-k))}ctx.restore()}
function burstFW(x,y,t,col,r){if(t<0||t>70)return;const k=t/70;ctx.save();ctx.globalCompositeOperation='lighter';
  r*=1.45;if(t<10){const g=ctx.createRadialGradient(x,y,0,x,y,r*.6);g.addColorStop(0,`rgba(255,250,230,${.5*(1-t/10)})`);g.addColorStop(1,'rgba(255,250,230,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
  for(let ring=0;ring<2;ring++)for(let i=0;i<40;i++){const a=i/40*Math.PI*2+ring*.08,rr=ring?.62:1,d=r*rr*Math.sqrt(k)*(1+((i*7)%3)*.06),px=x+Math.cos(a)*d,py=y+Math.sin(a)*d+k*k*46;ctx.globalAlpha=(1-k);ctx.fillStyle=ring?'#fff6d8':(i%3?col:'#ffe08a');
    ctx.beginPath();ctx.arc(px,py,2.4*(1-k*.5),0,7);ctx.fill();if(!ring&&k<.7){ctx.globalAlpha=(1-k)*.35;ctx.fillRect(px-Math.cos(a)*8,py-Math.sin(a)*8-1,Math.cos(a)*8,2)}}
  ctx.restore()}
/* front-facing stage reveal: truss, LED walls, smoking tunnel, runway and spark fountains */
/* ---------- front view: a fighter walking straight at the camera (entrance runway) ---------- */
function drawFront(F,t,o2={}){
  const L=lookOf(F),P=faceOf(F),hair0=P.hairTone?P.hairTone:L.hair||'#2a1f1a',hair=P.gray>0?mixc(hair0,'#b9b9b9',P.gray*.55):hair0,beardC=P.gray>0?mixc(hair0,'#c8c8c8',P.gray*.7):hair0,skin=P.skinK&&P.skinK!==1?shade(L.skin||'#d2a07a',P.skinK):(L.skin||'#d2a07a'),skinD=shade(skin,.78);
  const trunk=L.trunk||'#333',shirt=F.walkShirt?shade(F.walkShirt,.55):null,perf=o2.perf,ph=o2.walk||0,pt=o2.pt||0;
  const sw=Math.sin(ph),bob=-Math.abs(Math.cos(ph))*4;
  const bd=o2.noBuild?[1,1]:buildOf(F)||[1,1];ctx.save();ctx.scale(bd[0],bd[1]);
  const hipY=-112+bob,chestY=-178+bob,shW=34,wW=22;
  /* legs: the stepping leg comes toward the camera (lower + bigger) */
  const leg=(side,fw)=>{const hx=side*13,kx=side*15,fx=side*14,lift=Math.max(0,-fw)*14,near=1+Math.max(0,fw)*.06;
    const hip={x:hx,y:hipY+8},knee={x:kx,y:-58+bob-lift*.6+(fw>0?2:0)},ank={x:fx,y:-8-lift+(fw>0?4:0)};
    capsule(hip,knee,14*near,10*near,side<0?skin:shade(skin,.92),0);capsule(knee,ank,10*near,6.5*near,side<0?skin:shade(skin,.9),0);
    ctx.fillStyle=shade(skin,.85);ctx.beginPath();ctx.ellipse(ank.x,ank.y+5,7*near,5*near,0,0,7);ctx.fill();return knee};
  if(perf==='waikru'){const k=clamp(pt/14,0,1);ctx.translate(0,40*k)}
  const fwA=perf?0:sw,fwB=perf?0:-sw;
  if(fwA<fwB){leg(-1,fwA);leg(1,fwB)}else{leg(1,fwB);leg(-1,fwA)}
  /* shorts */
  {const g=ctx.createLinearGradient(-wW-6,0,wW+6,0);g.addColorStop(0,shade(trunk,.7));g.addColorStop(.5,trunk);g.addColorStop(1,shade(trunk,.6));ctx.fillStyle=g;
   ctx.beginPath();ctx.moveTo(-wW-3,hipY-6);ctx.lineTo(wW+3,hipY-6);ctx.lineTo(wW+8,hipY+40);ctx.lineTo(3,hipY+38);ctx.lineTo(0,hipY+20);ctx.lineTo(-3,hipY+38);ctx.lineTo(-wW-8,hipY+40);ctx.closePath();ctx.fill();
   ctx.fillStyle=shade(trunk,.45);ctx.fillRect(-wW-3,hipY-8,wW*2+6,7);ctx.fillStyle=F.corner||'#3d7ff0';ctx.fillRect(-wW-7,hipY+4,3,32);ctx.fillRect(wW+4,hipY+4,3,32);
   ctx.fillStyle='rgba(255,255,255,.8)';ctx.font='bold 6px sans-serif';ctx.textAlign='center';ctx.fillText('IC',-12,hipY+12)}
  /* torso */
  const torso=()=>{ctx.beginPath();ctx.moveTo(-shW,chestY+4);ctx.quadraticCurveTo(-shW-4,chestY+30,-wW-2,hipY-6);ctx.lineTo(wW+2,hipY-6);ctx.quadraticCurveTo(shW+4,chestY+30,shW,chestY+4);ctx.quadraticCurveTo(0,chestY-6,-shW,chestY+4);ctx.closePath()};
  {const base=shirt||skin,g=ctx.createLinearGradient(-shW,0,shW,0);g.addColorStop(0,shade(base,.7));g.addColorStop(.45,shade(base,1.06));g.addColorStop(1,shade(base,.68));torso();ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='rgba(20,10,8,.3)';ctx.lineWidth=.9;ctx.stroke();
   if(!shirt){ctx.save();torso();ctx.clip();const sft=(x,y,rx,ry,c)=>{ell(x,y,rx,ry,c)};
     sft(-12,chestY+20,13,8,'rgba(70,30,18,.16)');sft(12,chestY+20,13,8,'rgba(70,30,18,.16)');sft(-11,chestY+13,11,6,'rgba(255,240,225,.14)');sft(11,chestY+13,11,6,'rgba(255,240,225,.14)');
     for(const yy of [42,54,66])for(const xx of [-6,6])sft(xx,chestY+yy,5,4.2,'rgba(255,240,225,.12)');ctx.strokeStyle='rgba(70,30,18,.18)';ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(0,chestY+30);ctx.lineTo(0,hipY-12);ctx.stroke();
     if(L.tattoo){ctx.strokeStyle='rgba(30,35,55,.5)';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(-24,chestY+8);ctx.quadraticCurveTo(-30,chestY+18,-22,chestY+26);ctx.stroke()}ctx.restore()}
   else{ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText('IRON CAGE',0,chestY+34);ctx.fillStyle=shade(base,.55);ctx.beginPath();ctx.moveTo(-8,chestY);ctx.lineTo(0,chestY+16);ctx.lineTo(8,chestY);ctx.fill()}}
  /* arms */
  const arm=(side,swing)=>{const sh={x:side*(shW-3),y:chestY+8};let el={x:side*(shW+6),y:chestY+44-swing*4},hd={x:side*(shW+2)+swing*2*side,y:chestY+80-swing*8};
    if(perf==='taunt'||perf==='kicks'||perf==='shadow'||perf==='win'){const up=side>0||perf!=='taunt';if(up){el={x:side*(shW+12),y:chestY-10};hd={x:side*(shW+4),y:chestY-48+Math.sin(pt*.3+side)*4}}}
    if(perf==='chest'){const hit=(Math.floor(pt/9)+(side>0?1:0))%2;el={x:side*(shW+8),y:chestY+30};hd={x:side*(hit?10:shW+14),y:chestY+(hit?18:-6)}}
    if(perf==='bow'||perf==='waikru'){el={x:side*(shW+2),y:chestY+36};hd={x:side*8,y:chestY+30}}
    if(perf==='coach'&&side>0){const g=Math.sin(pt*.13);el={x:shW+16,y:chestY+30};hd={x:18+g*8,y:chestY-2-Math.abs(g)*10}}
    const c=shirt||skin;capsule(sh,el,9.5,7.5,c,0);capsule(el,hd,7.5,6,shirt||skin,0);
    if(o2.bare){ell(hd.x,hd.y+3,6,7.5,skin);ctx.strokeStyle=shade(skin,.6);ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(hd.x+2,hd.y-4);ctx.lineTo(hd.x+3,hd.y-11);ctx.stroke();return}
    const g=ctx.createRadialGradient(hd.x-2,hd.y-3,1,hd.x,hd.y,10);g.addColorStop(0,'#4b4f58');g.addColorStop(1,'#0b0c0e');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(hd.x,hd.y+4,9,10,0,0,7);ctx.fill();ctx.fillStyle=F.corner||'#3d7ff0';ctx.fillRect(hd.x-8,hd.y-6,16,4)};
  arm(-1,perf?0:-sw);arm(1,perf?0:sw);
  /* hood behind the head when wearing the walkout shirt */
  if(shirt){ctx.fillStyle=shade(shirt,.75);ctx.beginPath();ctx.ellipse(0,chestY-6,22,12,0,0,7);ctx.fill()}
  /* neck + head (front) */
  capsule({x:0,y:chestY+(shirt?-4:4)},{x:0,y:chestY-14},10,9,shade(skin,.9),0);if(shirt){ctx.fillStyle=shade(shirt,.6);ctx.beginPath();ctx.ellipse(0,chestY-1,15,6,0,0,7);ctx.fill();ctx.fillStyle=shirt;ctx.beginPath();ctx.ellipse(0,chestY+2,17,5,0,0,Math.PI);ctx.fill()}
  {const im=faceImgOf(F,'front');if(im){const HD=o2.dmg||{head:100,cuts:0},dmv=clamp((100-HD.head)/100,0,1),cu=HD.head<85?HD.cuts:0;if(IC.headHasViews&&IC.headHasViews(F.d))photoHeadV(im,0,chestY-30,38*(P.hs||1),dmv,cu,'front');else photoHead(im,0,chestY-28,27*(P.hs||1),dmv,cu);ctx.restore();return}}
  const SHF={round:[1.06,.97],long:[.9,1.08],square:[1.04,1],wide:[1.13,.96],egg:[.94,1.05]}[P.shape]||[1,1],hy=chestY-29,rx=15*SHF[0]*(P.hs||1),ry=18*SHF[1]*(P.hs||1),jw=(P.jaw||0)+(P.shape==='square'?.8:P.shape==='egg'?-.8:0);
  ell(-rx+1,hy+2,3.6,6,skinD);ell(rx-1,hy+2,3.6,6,skinD);if(P.cauli){ell(-rx,hy+2,4.6,6.6,shade(skin,.75));ell(rx,hy+2,4.6,6.6,shade(skin,.75))}
  {const g=ctx.createRadialGradient(-3,hy-6,2,0,hy,22);g.addColorStop(0,shade(skin,1.15));g.addColorStop(.6,skin);g.addColorStop(1,shade(skin,.75));ctx.fillStyle=g;
   ctx.beginPath();ctx.moveTo(-rx,hy-2);ctx.quadraticCurveTo(-rx,hy-ry,0,hy-ry);ctx.quadraticCurveTo(rx,hy-ry,rx,hy-2);ctx.quadraticCurveTo(rx-1+jw,hy+ry*.7,0,hy+ry+jw*1.5);ctx.quadraticCurveTo(-rx+1-jw,hy+ry*.7,-rx,hy-2);ctx.fill()}
  /* eyes, brows, nose, mouth */
  const ey=hy-1,es=.85+(P.eye||.5)*.35,HD=o2.dmg||{head:100,cuts:0,mood:null},dm=clamp((100-HD.head)/100,0,1),md=HD.mood,blink=o2.blink;
  /* damage under the eyes: red cheeks → black eyes → swollen brows */
  if(dm>.15){ell(-8,ey+7,4.5,3,`rgba(170,50,60,${(dm-.15)*.45})`);ell(8,ey+7,4.5,3,`rgba(170,50,60,${(dm-.15)*.4})`)}
  if(dm>.35){const a=clamp((dm-.35)*1.1,0,.6);ell(6,ey+.5,5.2,4.2,`rgba(90,30,80,${a})`);if(dm>.55)ell(-6,ey+.5,4.6,3.8,`rgba(90,30,80,${a*.8})`)}
  if(dm>.5){const a=clamp((dm-.5)*1.2,0,.55);ell(6,ey-5,5.4,2.8,`rgba(150,60,90,${a})`)}
  for(const s of [-1,1]){const shut=md==='ko'||md==='hurt'||blink||(dm>.7&&s>0),half=md==='tired';
    if(shut){ctx.strokeStyle='#2a1b14';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(s*6-3,ey);ctx.quadraticCurveTo(s*6,ey+(md==='ko'?-1:1.2),s*6+3,ey);ctx.stroke()}
    else{ell(s*6,ey,3.2*es,1.9*es,'#f2ece4');ell(s*6,ey,1.6*es,1.7*es,P.iris||'#2a1b14');ell(s*6+.6,ey-.6,.5,.5,'#fff');if(half){ctx.fillStyle=shade(skin,.8);ctx.beginPath();ctx.ellipse(s*6,ey-.6,3.5*es,1.4*es,0,Math.PI,0);ctx.fill()}}
    ctx.strokeStyle=shade(hair,.85);ctx.lineWidth=1.3+(P.brow||.4)*2.2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(s*2.5,ey-5+(P.browA||0)*s*.0-(P.browA||0)*.8);ctx.lineTo(s*10,ey-6+(P.browA||0)*.8);ctx.stroke()}
  {const nw={big:1.5,flat:1.6,hook:1.1,button:.75}[P.nose]||1,nl={big:1.25,hook:1.2,button:.8,flat:.85}[P.nose]||1,cr=P.crooked?1.2:0;ctx.strokeStyle=shade(skin,.62);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-1+cr*.3,ey+2);ctx.lineTo(-1.6+cr,ey+2+5*nl);ctx.stroke();
   ell(-2.6*nw+cr,ey+2+5.8*nl,1.2,.8,shade(skin,.55));ell(2.6*nw+cr,ey+2+5.8*nl,1.2,.8,shade(skin,.55));ctx.beginPath();ctx.moveTo(-3.4*nw+cr,ey+2+5.4*nl);ctx.quadraticCurveTo(cr,ey+2+7.6*nl,3.4*nw+cr,ey+2+5.4*nl);ctx.stroke();
   if(P.tape){ctx.fillStyle='rgba(245,240,230,.9)';ctx.fillRect(-4+cr,ey+3,8,2.2)}}
  if(P.freck)for(let i=0;i<10;i++)ell(((i*37)%9)-4.5+(i%2?6:-6),ey+4+((i*53)%4),.45,.45,'rgba(120,60,30,.55)');
  if(P.tat){ctx.strokeStyle='rgba(20,24,40,.45)';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(8,ey+5);ctx.quadraticCurveTo(11,ey+3,12,ey+7);ctx.stroke()}
  if(P.gray>.3){ctx.strokeStyle=shade(skin,.72);ctx.lineWidth=.6;for(const y0 of [ey-11,ey-9]){ctx.beginPath();ctx.moveTo(-6,y0);ctx.quadraticCurveTo(0,y0-1,6,y0);ctx.stroke()}}
  if(P.cleft){ctx.strokeStyle=shade(skin,.7);ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(0,hy+ry-2+jw);ctx.lineTo(0,hy+ry+1+jw);ctx.stroke()}
  if(P.stud){ell(-rx+.5,hy+5,1,1,'#f4e2a0');ell(rx-.5,hy+5,1,1,'#f4e2a0')}
  const my=ey+12;if(md==='tired'||md==='hurt'||md==='yell'){const g2=md==='tired'?1.6+Math.abs(Math.sin((o2.t||0)*.24))*1.6:md==='yell'?3:2;ell(0,my,md==='yell'?4.6:3.6,g2,'#3a1414');if(md!=='tired'){ctx.fillStyle=o2.guard||'#1f6fe0';ctx.fillRect(-3.4,my-g2+.4,6.8,1.6)}}else if(o2.talk){ell(0,my,4.2,1+o2.talk*2.6,'#3a1414');ell(0,my-1-o2.talk*1.4,3,.8,'rgba(255,255,255,.75)')}else{ctx.strokeStyle='#5a2e24';ctx.lineWidth=1.3;ctx.beginPath();if(P.mouth==='smirk'){ctx.moveTo(-4,my+.6);ctx.quadraticCurveTo(0,my+.8,4.5,my-1)}else if(P.mouth==='frown'){ctx.moveTo(-4,my);ctx.quadraticCurveTo(0,my-1,4,my)}else{ctx.moveTo(-4,my);ctx.lineTo(4,my)}ctx.stroke()}
  if(P.scar){ctx.strokeStyle='rgba(255,235,220,.55)';ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(5,ey-9);ctx.lineTo(8,ey-2);ctx.stroke()}
  /* blood: cuts on the brow run down the face, a bloody nose when the head is hurt */
  {const cuts=HD.head<85?Math.min(5,HD.cuts|0):0,bl=clamp((HD.cuts||0)*.5+(100-HD.head)/30,0,6);ctx.strokeStyle='rgba(150,10,20,.9)';ctx.lineCap='round';for(let i=0;i<cuts;i++){const bx=3+i*2.4,by=ey-8+i*.6;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+3,by+1);ctx.stroke();const len=clamp((80-HD.head)/3,3,16)*(1-i*.2);ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(bx+1.5,by+1);ctx.quadraticCurveTo(bx+2.4,by+len*.5,bx+1,by+len);ctx.stroke()}
   if(bl>.8){ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(-1.5,ey+8.5);ctx.quadraticCurveTo(-1.8,my-1,-1.4,my+1);ctx.stroke()}
   if(bl>2){ctx.fillStyle='rgba(140,8,18,.55)';ctx.beginPath();ctx.ellipse(-1,my+1.5,3,1.4,0,0,7);ctx.fill();ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(-2,my+2.5);ctx.quadraticCurveTo(-2.4,my+6,-1.8,my+9);ctx.stroke()}
   if(bl>3){ctx.fillStyle='rgba(130,6,16,.35)';ctx.beginPath();ctx.ellipse(6,ey+1,6,7,0,0,7);ctx.fill()}}
  if(o2.sweat>.3){ell(-9,hy-ry+8,1.1,.7,`rgba(255,255,255,${o2.sweat*.6})`);ell(10,hy-6,1,.6,`rgba(255,255,255,${o2.sweat*.5})`)}
  /* beard */
  if(P.side&&L.hairStyle!=='bald'){ctx.fillStyle=beardC;ctx.globalAlpha=.7;ctx.fillRect(-rx+.5,hy-6,2.2,9);ctx.fillRect(rx-2.7,hy-6,2.2,9);ctx.globalAlpha=1}
  if(L.beard){const bs=P.beardS||'full';ctx.fillStyle=beardC;ctx.globalAlpha=bs==='stubble'?.35:.92;
    if(bs==='goatee'||bs==='soul'){ctx.beginPath();ctx.ellipse(0,hy+ry-3,bs==='soul'?2:5,bs==='soul'?2.5:5,0,0,7);ctx.fill()}
    else if(bs==='mustache'||bs==='horse'){ctx.beginPath();ctx.moveTo(-6,my-2);ctx.quadraticCurveTo(0,my-5,6,my-2);ctx.quadraticCurveTo(0,my-2.6,-6,my-2);ctx.fill();if(bs==='horse'){ctx.fillRect(-6.6,my-2,1.6,8);ctx.fillRect(5,my-2,1.6,8)}}
    else{ctx.beginPath();ctx.moveTo(-rx+1,hy+1);ctx.quadraticCurveTo(-rx+1,hy+ry*.9+(bs==='long'?8:0),0,hy+ry+3+jw*1.5+(bs==='long'?10:0));ctx.quadraticCurveTo(rx-1,hy+ry*.9+(bs==='long'?8:0),rx-1,hy+1);ctx.quadraticCurveTo(rx-3,hy+8,4,my+2.6);ctx.lineTo(-4,my+2.6);ctx.quadraticCurveTo(-rx+3,hy+8,-rx+1,hy+1);ctx.fill();
      if(bs!=='stubble'){ctx.beginPath();ctx.moveTo(-6,my-2);ctx.quadraticCurveTo(0,my-5,6,my-2);ctx.quadraticCurveTo(0,my-2.4,-6,my-2);ctx.fill()}}
    ctx.globalAlpha=1}
  /* hair (front) */
  const hs=L.hairStyle||'short',hv=P.hairV||'crop';ctx.fillStyle=hair;
  const cap=a=>{ctx.globalAlpha=a;ctx.beginPath();ctx.moveTo(-rx-.5,hy-1);ctx.quadraticCurveTo(-rx-1,hy-ry-3,0,hy-ry-2.5);ctx.quadraticCurveTo(rx+1,hy-ry-3,rx+.5,hy-1);ctx.quadraticCurveTo(rx-3,hy-10,0,hy-11+(hv==='receding'?-4:0));ctx.quadraticCurveTo(-rx+3,hy-10,-rx-.5,hy-1);ctx.fill();ctx.globalAlpha=1};
  if(hs==='bald'){if(hv==='shaved')cap(.22);ell(-4,hy-ry+5,5,2.5,'rgba(255,255,255,.2)')}
  else if(hs==='buzz'){if(hv==='fade'){cap(.35);ctx.beginPath();ctx.ellipse(0,hy-ry+2,rx*.8,5,0,0,7);ctx.fill()}else cap(.6);
    if(hv==='lines'){ctx.strokeStyle=skin;ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(-rx+2,hy-6);ctx.quadraticCurveTo(-rx+5,hy-12,-rx+9,hy-11);ctx.stroke()}}
  else{if(hs==='long'||hv==='flow'||hv==='dreads'){ctx.beginPath();ctx.moveTo(-rx-1,hy-6);ctx.quadraticCurveTo(-rx-6,hy+16,-rx-2,hy+28);ctx.lineTo(-rx+4,hy+18);ctx.lineTo(-rx+2,hy-2);ctx.fill();ctx.beginPath();ctx.moveTo(rx+1,hy-6);ctx.quadraticCurveTo(rx+6,hy+16,rx+2,hy+28);ctx.lineTo(rx-4,hy+18);ctx.lineTo(rx-2,hy-2);ctx.fill()}
    cap(1);
    if(hv==='afro'||hv==='curly'){for(let i=0;i<9;i++){const a=Math.PI*(1.05+i*.1);ell(Math.cos(a)*(rx+2),hy-4+Math.sin(a)*(ry+1),hv==='afro'?6:3.6,hv==='afro'?6:3.4,hair)}}
    if(hv==='spiky'){ctx.beginPath();for(let i=0;i<5;i++){const x0=-rx+4+i*(rx*2-8)/4;ctx.moveTo(x0-4,hy-ry+2);ctx.lineTo(x0,hy-ry-7);ctx.lineTo(x0+4,hy-ry+2)}ctx.fill()}
    if(hs==='mohawk'||hv==='faux'||hv==='fauxdye'){ctx.fillStyle=hv==='fauxdye'?(P.dye||'#e8b33a'):hair;ctx.beginPath();ctx.moveTo(-4,hy-ry+1);ctx.quadraticCurveTo(0,hy-ry-(hs==='mohawk'?12:7),4,hy-ry+1);ctx.fill();ctx.fillStyle=hair}
    if(hs==='bun'||hv==='topknot'||hv==='manbun'||hv==='bun')ell(0,hy-ry-4,5,4.5,hair);
    if(hv==='side'){ctx.beginPath();ctx.moveTo(-rx+2,hy-ry+3);ctx.quadraticCurveTo(4,hy-ry-3,rx+1,hy-8);ctx.quadraticCurveTo(4,hy-ry+4,-rx+2,hy-ry+3);ctx.fill()}
    if(hv==='slick'){ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=.7;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(-6+i*4,hy-12);ctx.lineTo(-6+i*4+1,hy-ry-1);ctx.stroke()}}
    if(hv==='cornrow'){ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=.8;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(-8+i*4,hy-11);ctx.lineTo(-8+i*4,hy-ry-1);ctx.stroke()}}
    if(hv==='pony'){ell(rx+2,hy+2,3,7,hair)}
    if(hv==='halfshave'){ctx.fillStyle=skin;ctx.globalAlpha=.7;ctx.beginPath();ctx.ellipse(-rx+3,hy-5,3.6,6,0,0,7);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=hair}
    if(hv==='dreads'){ctx.strokeStyle=hair;ctx.lineWidth=2.4;ctx.lineCap='round';for(let i=0;i<4;i++){for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(s*(rx-2-i*2),hy-ry+4);ctx.quadraticCurveTo(s*(rx+2),hy+6,s*(rx-1-i),hy+18+i*2);ctx.stroke()}}}
    if(P.dye&&hv!=='fauxdye'){ctx.fillStyle=P.dye;ctx.globalAlpha=.85;ctx.beginPath();ctx.ellipse(5,hy-ry+2,5,2.6,.3,0,7);ctx.fill();ctx.globalAlpha=1}}
  if(P.band){ctx.strokeStyle=P.band;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-rx,hy-8);ctx.quadraticCurveTo(0,hy-12,rx,hy-8);ctx.stroke()}
  ctx.restore()}
function stageReveal(S,F,t){
  const W0=WH,H0=HH,cx=W0/2,AR=S.arena||{k:'main'},L=TIERL[AR.k]??2,col=F.corner,horizon=H0*.58,d=F.d||{};
  const on=k=>clamp((t-k)/10,0,1);
  const bg=ctx.createLinearGradient(0,0,0,H0);bg.addColorStop(0,'#020306');bg.addColorStop(1,'#0a0c12');ctx.fillStyle=bg;ctx.fillRect(0,0,W0,H0);
  /* truss + bulbs that switch on left to right */
  const tw=W0*.7,tx=cx-tw/2,ty=H0*.08,th=horizon-ty;ctx.fillStyle='#14171d';ctx.fillRect(tx-8,ty-8,tw+16,10);ctx.fillRect(tx-8,ty,10,th);ctx.fillRect(tx+tw-2,ty,10,th);
  for(let i=0;i<=26;i++){const bx=tx+tw*i/26,lit=t>i*1.2&&((i+Math.floor(t/6))%3)!==0;ctx.fillStyle=lit?(i%4?'#fff8e6':rgba(col,1)):'#2a2d34';ctx.beginPath();ctx.arc(bx,ty-3,3,0,7);ctx.fill();
    if(lit){const g=ctx.createRadialGradient(bx,ty-3,0,bx,ty-3,15);g.addColorStop(0,i%4?'rgba(255,248,230,.5)':rgba(col,.6));g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(bx-15,ty-18,30,30)}}
  /* moving beams from the truss */
  ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<4;i++){const bx=tx+tw*(.12+i*.25),a=Math.sin(t*.03+i*1.7)*.35;ctx.save();ctx.translate(bx,ty);ctx.rotate(a);const g=ctx.createLinearGradient(0,0,0,H0);g.addColorStop(0,i%2?rgba(col,.22):'rgba(255,240,210,.16)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(5,0);ctx.lineTo(60,H0);ctx.lineTo(-60,H0);ctx.fill();ctx.restore()}ctx.restore();
  /* LED walls: a big close-up of the fighter pounding the chest, nickname underneath */
  const sw=tw*.28,sh=th*.84,sy=ty+8;
  for(const sx of [tx+12,tx+tw-12-sw]){const fl=on(6)*(t<16&&t%4<2?.4:1);ctx.save();ctx.globalAlpha=fl;
    const g=ctx.createLinearGradient(sx,sy,sx,sy+sh);g.addColorStop(0,shade(col,.45));g.addColorStop(1,'#05070c');ctx.fillStyle=g;ctx.fillRect(sx,sy,sw,sh);
    ctx.save();ctx.beginPath();ctx.rect(sx,sy,sw,sh);ctx.clip();const sc=sh/120;ctx.translate(sx+sw/2,sy+sh*.5);ctx.scale(sc,sc);ctx.translate(-400,-218);
    const P={...F,x:400,f:sx<cx?1:-1,state:'perf',perfK:'chest',perfT:t,A:null,t:0,react:null,rocked:0,walkShirt:null};P._t=t;drawBody(P,poseStand(P,P,{frame:t,cl:null}));ctx.restore();
    const ng=ctx.createLinearGradient(0,sy+sh*.7,0,sy+sh);ng.addColorStop(0,'rgba(0,0,0,0)');ng.addColorStop(1,'rgba(0,0,0,.75)');ctx.fillStyle=ng;ctx.fillRect(sx,sy+sh*.7,sw,sh*.3);
    disp(`"${F.nick}"`,sx+sw/2,sy+sh-12,Math.min(18,sw*.13),'#fff','center');ctx.fillStyle=col;ctx.fillRect(sx,sy+sh-3,sw,3);
    ctx.fillStyle='rgba(0,0,0,.2)';for(let y=sy;y<sy+sh;y+=3)ctx.fillRect(sx,y,sw,1);ctx.restore()}
  /* logo */
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=on(10);ctx.font=`${Math.round(th*.15)}px "Black Han Sans",sans-serif`;
  const lg=ctx.createLinearGradient(0,ty+th*.2,0,ty+th*.38);lg.addColorStop(0,'#ffffff');lg.addColorStop(.5,'#9aa3b2');lg.addColorStop(1,'#e9edf3');ctx.fillStyle=lg;ctx.fillText('IRON CAGE',cx,ty+th*.26);
  ctx.font=`700 ${Math.round(th*.06)}px "IBM Plex Sans KR",sans-serif`;ctx.fillStyle='#e8b33a';ctx.fillText(AR.name||'',cx,ty+th*.38);ctx.globalAlpha=1;
  /* tunnel */
  const dw=tw*.26,dh=th*.44,dx=cx-dw/2,dy=horizon-dh;ctx.fillStyle='#000';ctx.fillRect(dx-6,dy-6,dw+12,dh+6);
  const tg=ctx.createRadialGradient(cx,dy+dh*.6,4,cx,dy+dh*.6,dw*.8);tg.addColorStop(0,rgba(col,.9));tg.addColorStop(.5,'rgba(140,130,180,.4)');tg.addColorStop(1,'rgba(10,10,20,.9)');ctx.fillStyle=tg;ctx.fillRect(dx,dy,dw,dh);
  for(let i=0;i<=8;i++){const bx=dx+dw*i/8;ctx.fillStyle=((i+Math.floor(t/4))%2)?'#fff':'#555';ctx.beginPath();ctx.arc(bx,dy-3,2,0,7);ctx.fill()}
  /* runway */
  ctx.beginPath();ctx.moveTo(cx-dw*.42,horizon);ctx.lineTo(cx+dw*.42,horizon);ctx.lineTo(cx+W0*.24,H0);ctx.lineTo(cx-W0*.24,H0);ctx.closePath();
  const rg=ctx.createLinearGradient(0,horizon,0,H0);rg.addColorStop(0,shade(col,.3));rg.addColorStop(1,shade(col,.55));ctx.fillStyle=rg;ctx.fill();
  const rs=ctx.createLinearGradient(0,horizon,0,H0);rs.addColorStop(0,'rgba(255,255,255,0)');rs.addColorStop(1,'rgba(255,255,255,.12)');ctx.fillStyle=rs;ctx.fill();
  for(let i=0;i<10;i++){const k=((i/10)+t*.014)%1,yy=lerp(horizon,H0,k*k),half=lerp(dw*.42,W0*.24,k*k)+8;ctx.fillStyle='rgba(255,250,235,.9)';ctx.fillRect(cx-half-3,yy,5*(.4+k),2*(.4+k));ctx.fillRect(cx+half-2,yy,5*(.4+k),2*(.4+k))}
  /* crowd: silhouettes with raised arms and phone lights */
  for(let i=0;i<80;i++){const side=i%2?1:-1,row=(i*7)%5,px=cx+side*(W0*.29+((i*37)%100)/100*W0*.24),jump=Math.max(0,Math.sin(t*.25+i))*3,py=horizon+18+row*13+((i*13)%7)-jump,r=6+row*1.3;
    ctx.fillStyle=`rgb(${14+row*3},${15+row*3},${21+row*3})`;ctx.beginPath();ctx.arc(px,py,r,0,7);ctx.fill();ctx.fillRect(px-r-2,py+r-1,r*2+4,22);
    if((i*11)%5===0){ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(px+side*-r,py+r);ctx.lineTo(px+side*-r*1.4,py-r*1.8);ctx.stroke();if(Math.sin(t*.05+i)>.2){ctx.fillStyle='rgba(225,238,255,.9)';ctx.fillRect(px+side*-r*1.4-1.5,py-r*2.4,3,4)}}
    ctx.strokeStyle=rgba(col,.25);ctx.lineWidth=1;ctx.beginPath();ctx.arc(px,py,r,Math.PI*1.1,Math.PI*1.9);ctx.stroke()}
  /* the fighter walks out of the tunnel down the runway toward the camera, then performs */
  const wk=clamp((t-12)/58,0,1),e2=1-Math.pow(1-wk,2),bodyH=GY-165,s0=dh*.8/bodyH,s1=H0*.5/bodyH,fs=lerp(s0,s1,e2),fy=lerp(horizon,H0*.97,e2);
  const sp=ctx.createRadialGradient(cx,fy-bodyH*fs*.5,4,cx,fy-bodyH*fs*.5,bodyH*fs*.8);sp.addColorStop(0,rgba(col,.35*on(14)));sp.addColorStop(1,rgba(col,0));ctx.fillStyle=sp;ctx.fillRect(cx-bodyH*fs,fy-bodyH*fs*1.4,bodyH*fs*2,bodyH*fs*1.5);
  ctx.save();ctx.translate(cx,fy);ctx.scale(fs,fs);
  const perf=F.state==='perf'?(F.perfK||'taunt'):null;
  const br=lerp(.35,1,e2);if(br<.98)ctx.filter=`brightness(${br.toFixed(2)})`;drawFront(F,t,{walk:wk<1?t*.16:0,perf,pt:F.perfT||0});ctx.filter='none';ctx.restore();
  /* haze */
  for(let i=0;i<10;i++){const hx=cx+Math.sin(t*.02+i)*W0*.3,hy=horizon+Math.sin(t*.017+i*2)*20,r=W0*.12;const g=ctx.createRadialGradient(hx,hy,0,hx,hy,r);g.addColorStop(0,'rgba(200,205,225,.07)');g.addColorStop(1,'rgba(200,205,225,0)');ctx.fillStyle=g;ctx.fillRect(hx-r,hy-r,r*2,r*2)}
  /* spark fountains by tier */
  {const hh=H0*(L>=3?.95:L>=2?.8:L>=1?.65:.5),xs=[W0*.03,W0*.17,W0*.83,W0*.97];for(const gx of xs)gerb(gx,H0+4,hh,t,L>=3?150:110);
   /* flame cannons along both sides of the runway, firing in waves as the fighter passes */
   const fh=H0*(L>=3?.62:L>=2?.52:.4);for(let r=0;r<3;r++){const k=(r+1)/4,yy=lerp(horizon,H0,k*k),half=lerp(dw*.42,W0*.24,k*k)+16,sc=.45+k*.7;for(const s of [-1,1])for(const t0 of [16+r*7,58+r*7])flameJet(cx+s*half,yy,fh*sc,t-t0-(s>0?3:0),20)}
   sparkFall(tx,tx+tw,ty,th*.9,t,L>=2?140:80);
   burstFW(W0*.2,H0*.16,t-30,col,80);burstFW(W0*.8,H0*.14,t-44,'#e8b33a',90);burstFW(W0*.5,H0*.08,t-62,'#ffffff',100);if(L>=2){burstFW(W0*.32,H0*.2,t-76,col,70);burstFW(W0*.68,H0*.22,t-84,'#ff6a3a',80)}}
  if(L>=3&&t%46<4){ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(0,0,W0,H0)}
  /* broadcast lower third */
  const lk=clamp((t-26)/14,0,1),le=1-Math.pow(1-lk,3);if(lk>0){const bw=Math.min(300,W0*.34),bh=58,bx=lerp(-bw-20,Math.max(14,W0*.04),le),by=H0-bh-16;
    ctx.save();ctx.globalAlpha=lk;frost(bx,by,bw,bh,12,.82);chrome(bx,by,bw,bh,12,col);ctx.fillStyle=col;ctx.fillRect(bx,by+8,4,bh-16);
    ctx.textBaseline='middle';disp(`"${F.nick}"`,bx+16,by+20,22,'#fff','left');const st=(IC.STYLES[d.style]||{}).name||'';
    txt(`${d.name||''} · ${d.from||''} · ${st}`,bx+16,by+42,10.5,'rgba(225,230,238,.85)','left','700');num((d.rec||[0,0,0]).join('-'),bx+bw-14,by+20,16,'#e8b33a','right');ctx.restore()}
}
/* cage-side pyro when a fighter steps into the octagon / is announced */
function cagePyro(S,P){if(!P)return;const AR=S.arena||{k:'main'},L=TIERL[AR.k]??2,t=P.t;if(t>130)return;
  const hh=HH*(L>=3?.9:L>=2?.75:L>=1?.6:.45),n=L>=3?150:L>=2?120:90;
  gerb(WH*.05,HH+4,hh,t,n);gerb(WH*.95,HH+4,hh,t,n);gerb(WH*.28,HH+4,hh*.85,t+9,n*.7);gerb(WH*.72,HH+4,hh*.85,t+9,n*.7);if(L>=2){gerb(WH*.5,HH+4,hh*.7,t+4,n*.6)}
  /* flame cannons fire in a left-right-left rhythm */
  const fh=HH*(L>=3?.75:L>=2?.6:.45);for(const [x,d] of [[WH*.14,0],[WH*.86,8],[WH*.38,16],[WH*.62,24],[WH*.14,40],[WH*.86,48]])flameJet(x,HH+2,fh,t-d,22);
  if(L>=1)sparkFall(WH*.08,WH*.92,-4,HH*.7,t,L>=3?160:90);
  if(P.at==='ann'||P.at==='cage'||P.at==='perf'){const c=S.walk&&/^blue/.test(S.walk.k)?S.a.corner:S.b.corner;burstFW(WH*.25,HH*.22,t-6,c,90);burstFW(WH*.75,HH*.18,t-18,'#e8b33a',110);burstFW(WH*.5,HH*.16,t-30,'#ff6a3a',100);burstFW(WH*.35,HH*.1,t-52,'#ffffff',90);burstFW(WH*.65,HH*.12,t-60,c,100);if(L>=3){burstFW(WH*.5,HH*.12,t-28,'#ffffff',130);burstFW(WH*.15,HH*.3,t-38,c,80);burstFW(WH*.85,HH*.28,t-44,c,80)}}
  if(t<6){ctx.fillStyle=`rgba(255,200,120,${.25*(1-t/6)})`;ctx.fillRect(0,0,WH,HH)}}
/* broadcast "tale of the tape" slide */
function koRate(d){const r=d.rec||[0,0,0],w=r[0]||0;return clamp(Math.round(25+((d.s&&d.s.pow)||70)*.5-20+(IC.hash?IC.hash(d.name||'')%15:0)),10,88)}
function tapeSlide(S,t){const A=S.a.d,B=S.b.d,p=clamp(t/18,0,1),e=1-Math.pow(1-p,3),w=Math.min(WH*.86,560),OD=S.odds,oh=OD?40:0,h=Math.min(HH*.88,300+oh),x=WH/2-w/2,y=Math.max(8,HH*.06)+(1-e)*30;
  ctx.save();ctx.globalAlpha=e*clamp((300-t)/14,0,1);frost(x,y,w,h,16,.82);chrome(x,y,w,h,16,'#e8b33a');
  ctx.textAlign='center';ctx.textBaseline='middle';num('TALE OF THE TAPE',WH/2,y+18,12,'#e8b33a','center');
  const hy=y+44;for(const [F,side] of [[S.a,-1],[S.b,1]]){const cxp=WH/2+side*w*.3;ctx.fillStyle=F.corner;ctx.fillRect(cxp-w*.16,hy-14,w*.32,3);disp(`"${F.nick}"`,cxp,hy+4,Math.min(20,w*.04),'#fff','center');txt(F.name,cxp,hy+22,10.5,'rgba(220,226,236,.8)','center','600')}
  disp('VS',WH/2,hy+8,22,'#e8b33a','center');
  /* betting line: decimal odds + implied win probability, the favourite's side glows */
  if(OD){const oy=hy+46,k=clamp((t-8)/16,0,1),ke=1-Math.pow(1-k,3),pa=OD.pa,bw=w*.36,favA=pa>=.5;ctx.globalAlpha=e*k;
    ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.roundRect(x+14,oy-17,w-28,36,10);ctx.fill();ctx.strokeStyle='rgba(232,179,58,.35)';ctx.lineWidth=1;ctx.stroke();
    for(const [side,o,pr,col,fav] of [[-1,OD.a,pa,S.a.corner,favA],[1,OD.b,1-pa,S.b.corner,!favA]]){const cx0=WH/2+side*w*.38;
      if(fav){const gg=ctx.createRadialGradient(cx0,oy,2,cx0,oy,48);gg.addColorStop(0,rgba(col,.35));gg.addColorStop(1,rgba(col,0));ctx.fillStyle=gg;ctx.fillRect(cx0-50,oy-18,100,36)}
      num((o*ke+1*(1-ke)).toFixed(2),cx0,oy-3,19,fav?'#fff':'#c9d1dc','center');txt(`${Math.round(pr*100)}% · ${fav?'우세':'언더독'}`,cx0,oy+11,8.5,fav?'#ffe08a':'rgba(214,220,230,.65)','center','700')}
    const bx=WH/2-bw/2,byy=oy+3;txt(OD.rv?'경기 전 배당률 · 라이벌전':'경기 전 배당률',WH/2,oy-9,8.5,'#e8b33a','center','800');
    ctx.fillStyle='rgba(255,255,255,.08)';ctx.beginPath();ctx.roundRect(bx,byy,bw,7,3.5);ctx.fill();
    const split=bw*(.5+(pa-.5)*ke);ctx.save();ctx.beginPath();ctx.roundRect(bx,byy,bw,7,3.5);ctx.clip();ctx.fillStyle=S.a.corner;ctx.fillRect(bx,byy,split,7);ctx.fillStyle=S.b.corner;ctx.fillRect(bx+split,byy,bw-split,7);
    ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(bx,byy,bw,2);ctx.restore();ctx.fillStyle='#fff';ctx.fillRect(bx+split-1,byy-2,2,11);ctx.globalAlpha=e}
  const rows=[['전적',(A.rec||[0,0,0]).join('-'),(B.rec||[0,0,0]).join('-')],['나이',`${A.age||'-'}세`,`${B.age||'-'}세`],['키',`${A.height||'-'}cm`,`${B.height||'-'}cm`],['리치',`${A.reach||'-'}cm`,`${B.reach||'-'}cm`],['KO율',`${koRate(A)}%`,`${koRate(B)}%`],['스타일',IC.STYLES[A.style].name,IC.STYLES[B.style].name]];
  rows.forEach((r,i)=>{const ry=hy+44+oh+i*17,k=clamp((t-14-i*5)/10,0,1);ctx.globalAlpha=e*k;if(i%2===0){ctx.fillStyle='rgba(255,255,255,.04)';ctx.fillRect(x+14,ry-8,w-28,16)}num(r[1],WH/2-w*.3,ry,13,'#f2f4f8','center');txt(r[0],WH/2,ry,10.5,'rgba(214,220,230,.7)','center','700');num(r[2],WH/2+w*.3,ry,13,'#f2f4f8','center')});
  const by=hy+44+oh+rows.length*17+8,G=[['타격',d=>(d.s.pow+d.s.spd+d.s.kick)/3],['레슬링',d=>(d.s.td+d.s.tdd)/2],['주짓수',d=>(d.s.subO+d.s.subD)/2],['체력',d=>d.s.car],['맷집',d=>d.s.chin]];
  G.forEach(([lab,f],i)=>{const ry=by+i*13,k=clamp((t-50-i*6)/24,0,1),va=f(A)/100*k,vb=f(B)/100*k,bw=w*.34;ctx.globalAlpha=e*clamp((t-46-i*6)/8,0,1);
    ctx.fillStyle='rgba(255,255,255,.07)';ctx.fillRect(WH/2-30-bw,ry-3,bw,6);ctx.fillRect(WH/2+30,ry-3,bw,6);ctx.fillStyle=S.a.corner;ctx.fillRect(WH/2-30-bw*va,ry-3,bw*va,6);ctx.fillStyle=S.b.corner;ctx.fillRect(WH/2+30,ry-3,bw*vb,6);
    txt(lab,WH/2,ry+.5,9.5,f(A)>f(B)?'#9fc4ff':f(B)>f(A)?'#ffaaa0':'#ddd','center','700')});
  ctx.restore()}
function liveBug(S){const AR=S.arena||{};const x=12,y=12;ctx.save();frost(x,y,0,0,0,0);ctx.restore();
  ctx.save();ctx.font=`700 10px ${'"Rajdhani"'},sans-serif`;const lab=(AR.name||'IRON CAGE');ctx.font='700 10px "IBM Plex Sans KR",sans-serif';const w=ctx.measureText(lab).width+58,x0=WH-12-w;frost(x0,y,w,20,10,.7);chrome(x0,y,w,20,10);
  ctx.fillStyle=Math.floor(S.frame/30)%2?'#ff3b2e':'#b0201a';ctx.beginPath();ctx.arc(x0+11,y+10,3.5,0,7);ctx.fill();ctx.textBaseline='middle';num('LIVE',x0+18,y+10.5,10,'#fff','left');txt(lab,x0+48,y+10.5,10,'#e9edf3','left','700');ctx.restore()}
/* ===== broadcast close-ups (UFC-style): blurred arena, a fighter from the chest up, lower-third graphics ===== */
const ezo=x=>{x=clamp(x,0,1);return 1-Math.pow(1-x,3)};
function closeBg(t,col){
  const g=ctx.createRadialGradient(WH*.5,HH*.35,10,WH*.5,HH*.5,Math.max(WH,HH)*.85);g.addColorStop(0,'#1d2333');g.addColorStop(1,'#04050a');ctx.fillStyle=g;ctx.fillRect(0,0,WH,HH);
  for(let i=0;i<48;i++){const x=((i*157.3)%(WH+60))-30,y=HH*(.04+((i*71)%58)/100),r=5+(i*13)%15,cl=['255,214,150','150,185,255','255,255,255','255,130,100'][i%4];
    ctx.fillStyle=`rgba(${cl},${(.06+.05*Math.sin(t*.03+i)).toFixed(3)})`;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill()}
  ctx.strokeStyle='rgba(120,132,152,.10)';ctx.lineWidth=2;ctx.beginPath();for(let x=-HH;x<WH+HH;x+=32){ctx.moveTo(x,0);ctx.lineTo(x+HH,HH);ctx.moveTo(x+HH,0);ctx.lineTo(x,HH)}ctx.stroke();
  if(col){ctx.fillStyle=rgba(col,.10);ctx.fillRect(0,0,WH,HH)}
  const s=ctx.createRadialGradient(WH*.5,-HH*.15,10,WH*.5,-HH*.15,HH*1.15);s.addColorStop(0,'rgba(255,240,210,.20)');s.addColorStop(1,'rgba(255,240,210,0)');ctx.fillStyle=s;ctx.fillRect(0,0,WH,HH)}
function closeVig(){const v=ctx.createRadialGradient(WH/2,HH*.45,HH*.3,WH/2,HH*.45,Math.max(WH,HH)*.75);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.6)');ctx.fillStyle=v;ctx.fillRect(0,0,WH,HH)}
/* fighter from the chest up: (x,y) is where the top of the head lands, sc = pixels per body unit */
function bust(F,x,y,sc,t,o={}){ctx.save();ctx.translate(x,y);ctx.scale(sc,sc);ctx.translate(0,252);
  drawFront(F,t,{walk:0,perf:o.perf||null,pt:o.pt??t,dmg:{head:F.head??100,cuts:F.cuts||0,mood:o.mood||null},t,sweat:o.sweat??.25,talk:o.talk||0});ctx.restore()}
function kgOf(d){const C=(IC.CLASSES||[]).find(c=>c.id===d.cls)||{};return C.lb?Math.round(C.lb*.4536):''}
function wrapText(s,w){const out=[];let cur='';for(const ch of s){if(ctx.measureText(cur+ch).width>w&&cur){out.push(cur);cur=ch.trim()?ch:''}else cur+=ch}if(cur)out.push(cur);return out}
/* UFC-like name strap: gold logo block, flag, name, nickname, then a row of stats */
function nameStrap(F,x,y,w,k,top){const d=F.d,rec=d.rec||[0,0,0],h=66;ctx.save();ctx.globalAlpha*=clamp(k*1.6,0,1);ctx.textBaseline='alphabetic';
  const ww=w*ezo(k);ctx.beginPath();ctx.rect(x,y-14,ww,h+14);ctx.clip();
  if(top){ctx.fillStyle=top[1];ctx.fillRect(x+56,y-14,ctx.measureText?Math.min(w-56,150):150,14);txt(top[0],x+64,y-3,9.5,'#0b0b0b','left','800')}
  ctx.fillStyle='rgba(10,12,16,.93)';ctx.fillRect(x,y,w,h);ctx.fillStyle='#e8b33a';ctx.fillRect(x,y,56,h);
  disp('IRON',x+28,y+30,15,'#111','center');disp('CAGE',x+28,y+48,15,'#111','center');
  drawFlagMini(x+66,y+9,24,16,d.from);
  disp(F.name,x+98,y+24,19,'#ffffff','left');ctx.font='19px "Black Han Sans",sans-serif';const nw=ctx.measureText(F.name).width;
  txt(`"${F.nick}"`,x+106+nw,y+23,12,'#e8b33a','left','800');
  const cells=[[rec.join('-'),'전적'],[`${d.height||'-'}cm`,'신장'],[`${kgOf(d)}kg`,'체중'],[`${d.reach||'-'}cm`,'리치'],[d.from||'','출신']],cw=(w-70)/cells.length;
  cells.forEach(([v,l],i)=>{const cx=x+66+i*cw;if(i){ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(cx-6,y+36,1,24)}num(String(v),cx,y+49,12.5,'#f2f4f8','left');txt(l,cx,y+61,8.5,'rgba(214,220,230,.6)','left','700')});
  ctx.fillStyle=F.corner;ctx.fillRect(x+56,y+h-3,w-56,3);ctx.restore()}
/* announcer intro, second half: close-up of the fighter with his name strap while the nickname slams in */
const ANN_CUT=150,WK_LEN={ann:420,tape:480};
function annClose(S,F,t){const k=t-ANN_CUT,len=(WK_LEN.ann||420)-ANN_CUT,e=ezo(k/16),out=clamp((len-k)/14,0,1);if(k<0)return;
  ctx.save();ctx.globalAlpha=Math.min(e,out);closeBg(S.frame,F.corner);
  const sc=HH/122*(1+.06*k/len),pk={shadow:'shadow',taunt:'taunt',chest:'chest',bow:'chest',waikru:'chest',kicks:'shadow'}[F.perfK||'taunt']||'taunt',cyc=k%240;
  bust(F,WH*.5,HH*.06,sc,S.frame,{perf:cyc<130?pk:null,pt:cyc,mood:cyc<130?'yell':null,sweat:.35});
  closeVig();
  const sw=Math.min(WH*.9,540);nameStrap(F,(WH-sw)/2,HH-66-Math.max(10,HH*.05),sw,(k-10)/22,[F.side==='a'?'블루 코너':'레드 코너',F.corner]);
  /* Bruce-Buffer slam of the nickname near the top */
  if(k<130){const l=clamp((k-14)/10,0,1),o2=clamp((130-k)/18,0,1);if(l>0){const sc2=1+.7*(1-l),sh=k<30?Math.sin(k*2.3)*(30-k)*.3:0;ctx.save();ctx.globalAlpha*=l*o2;ctx.translate(WH/2+sh,HH*.15);ctx.scale(sc2,sc2);ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`${Math.min(54,WH*.095)}px "Black Han Sans",sans-serif`;ctx.lineWidth=8;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText(`"${F.nick}"`,0,0);ctx.fillStyle='#fff';ctx.fillText(`"${F.nick}"`,0,0);ctx.restore()}}
  if(k<8){ctx.globalAlpha=(8-k)/8*.7;ctx.fillStyle='#fff';ctx.fillRect(0,0,WH,HH)}
  ctx.restore()}
/* tale of the tape, full screen: both fighters left and right, comparison column in the middle */
function tapeFull(S,t){const A=S.a,B=S.b,len=WK_LEN.tape||480,e=ezo(t/22),out=clamp((len-t)/14,0,1);
  ctx.save();ctx.globalAlpha=Math.min(1,t/8)*out;closeBg(S.frame,null);
  const cw=Math.min(WH*.32,240),sc=Math.min(HH/150,(WH-cw)/2/86),sl=(1-e)*WH*.3;
  for(const [F,x0,dir] of [[A,WH*.2,-1],[B,WH*.8,1]]){const x=x0+dir*sl;ctx.save();ctx.globalAlpha*=e;bust(F,x,HH*.1,sc,S.frame+(dir>0?40:0),{sweat:.2});ctx.restore();
    const ny=HH*.86,k=ezo((t-24)/16);ctx.save();ctx.globalAlpha*=k;ctx.textBaseline='alphabetic';
    const g=ctx.createLinearGradient(0,ny-40,0,HH);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.75)');ctx.fillStyle=g;ctx.fillRect(x-WH*.18,ny-40,WH*.36,HH-ny+40);
    disp(F.name,x,ny,Math.min(24,WH*.042),'#fff','center');txt(`"${F.nick}"`,x,ny+16,11,'#e8b33a','center','800');
    drawFlagMini(x-34,ny+24,18,12,F.d.from);num((F.d.rec||[0,0,0]).join('-'),x-10,ny+35,12,'#e9edf3','left');ctx.fillStyle=F.corner;ctx.fillRect(x-40,ny+41,80,3);ctx.restore()}
  /* centre column */
  const top=Math.max(8,HH*.05),cx=WH/2-cw/2,ch=HH-top-Math.max(8,HH*.05),k0=ezo((t-6)/16);ctx.save();ctx.globalAlpha*=k0;ctx.translate(0,(1-k0)*20);
  ctx.fillStyle='rgba(14,16,22,.94)';ctx.beginPath();ctx.roundRect(cx,top,cw,ch,8);ctx.fill();
  ctx.fillStyle='#f2c230';ctx.beginPath();ctx.roundRect(cx,top,cw,50,[8,8,0,0]);ctx.fill();ctx.textBaseline='alphabetic';
  disp('IRON CAGE',WH/2,top+22,15,'#111','center');txt(`${(IC.CLASSES.find(c=>c.id===A.d.cls)||{}).name||''} · ${S.title?'타이틀전':S.rounds+'라운드'}`,WH/2,top+40,11,'#111','center','800');
  const AD=A.d,BD=B.d,rows=[[`${AD.age||'-'}`,'나이',`${BD.age||'-'}`],[`${AD.height||'-'}cm`,'신장',`${BD.height||'-'}cm`],[`${kgOf(AD)}kg`,'체중',`${kgOf(BD)}kg`],[`${AD.reach||'-'}cm`,'리치',`${BD.reach||'-'}cm`],[(AD.rec||[0,0,0]).join('-'),'전적',(BD.rec||[0,0,0]).join('-')],[`${koRate(AD)}%`,'KO율',`${koRate(BD)}%`],[IC.STYLES[AD.style].name,'스타일',IC.STYLES[BD.style].name]];
  const OD=S.odds,oh=OD?44:0,rh=(ch-50-14-oh)/rows.length;
  rows.forEach((r,i)=>{const y=top+50+8+i*rh+rh/2,k=clamp((t-20-i*7)/10,0,1);ctx.save();ctx.globalAlpha*=k;if(i%2===0){ctx.fillStyle='rgba(255,255,255,.04)';ctx.fillRect(cx+6,y-rh/2,cw-12,rh)}
    ctx.textBaseline='middle';const fs=Math.min(15,rh*.5);num(r[0],cx+cw*.2,y,i===6?fs*.8:fs,'#f2f4f8','center');txt(r[1],WH/2,y,9.5,'rgba(214,220,230,.65)','center','700');num(r[2],cx+cw*.8,y,i===6?fs*.8:fs,'#f2f4f8','center');ctx.restore()});
  if(OD){const y=top+ch-oh+6,k=clamp((t-80)/16,0,1),pa=OD.pa,bw=cw-40,bx=WH/2-bw/2;ctx.save();ctx.globalAlpha*=k;ctx.textBaseline='middle';
    txt('경기 전 배당률',WH/2,y+4,8.5,'#e8b33a','center','800');num(OD.a.toFixed(2),cx+12,y+4,12,pa>=.5?'#fff':'#aab3c2','left');num(OD.b.toFixed(2),cx+cw-12,y+4,12,pa<.5?'#fff':'#aab3c2','right');
    ctx.fillStyle=A.corner;ctx.fillRect(bx,y+16,bw*pa*k+bw*.5*(1-k),6);ctx.fillStyle=B.corner;ctx.fillRect(bx+bw*pa*k+bw*.5*(1-k),y+16,bw-(bw*pa*k+bw*.5*(1-k)),6);ctx.restore()}
  ctx.restore();closeVig();ctx.restore()}
/* in-cage ring announcer: tuxedo, mic at the mouth, free arm swinging toward the fighter he's calling */
const ANNC={kind:'ref',logo:'',look:{skin:'#e3b08c',hair:'#c9c9c9',hairStyle:'short',beard:false},skinNow:'#e3b08c',shirt:'#101115',pants:true,corner:'#888',head:100,body:100,legs:100,cuts:0,sweat:0,t:0};
function drawAnnouncer(S){const W=S.walk,k=W.k,t=W.t,x=k==='redAnn'?430:390,f=k==='redAnn'?1:-1,b=Math.sin(S.frame*.06)*2;
  const lift=k==='officials'?.5+.5*Math.sin(S.frame*.05):clamp(t/30,0,1),sw=Math.sin(S.frame*.12)*6;
  const J={f,hip:{x,y:298},chest:{x:x+f*2,y:230+b*.3},tilt:0,nearHand:{x:x+f*14,y:208},farHand:{x:x+f*(26+lift*26),y:262-lift*104+sw*lift},nearFoot:{x:x+f*12,y:GY},farFoot:{x:x-f*12,y:GY},kneeN:'fwd',kneeF:'fwd',elbN:'down',elbF:lift>.5?'fwd':'down'};
  ctx.save();depth(x,-10);ctx.translate(x,GY);ctx.scale(.95,.95);ctx.translate(-x,-GY);shadowAt(x,40);drawBody(ANNC,J);
  ctx.fillStyle='#111';ctx.save();ctx.translate(x+f*16,203);ctx.rotate(-f*.6);ctx.beginPath();ctx.roundRect(-2.5,-12,5,16,2);ctx.fill();ctx.fillStyle='#555';ctx.beginPath();ctx.arc(0,-13,4.2,0,7);ctx.fill();ctx.restore();
  ctx.fillStyle='#f3f1ea';ctx.fillRect(x+f*1-3,226,6,10);ctx.fillStyle='#111';ctx.fillRect(x+f*1-4,227,8,3);ctx.restore()}
/* injury card: shield icon, what got hurt, what to do about it */
function injuryCard(x,y,w,k,mine,a){const T=IC.Fight.INJT&&IC.Fight.INJT[k];if(!T||a<=0)return 0;const name=IC.Fight.INJ[k],body=mine?T.def:T.atk,ac=mine?'#ff6b5e':'#7fe3ff';
  ctx.save();ctx.globalAlpha=a;ctx.font='700 11.5px "IBM Plex Sans KR",sans-serif';const L=wrapText(body,w-30),h=44+L.length*16;
  const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,'rgba(8,10,15,.92)');g.addColorStop(1,'rgba(18,34,58,.88)');ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(x,y,w,h,8);ctx.fill();
  ctx.fillStyle='rgba(127,227,255,.07)';for(let i=0;i<14;i++){const hx=x+w-12-(i%4)*14-((i/4|0)%2)*7,hy=y+h-10-(i/4|0)*12;ctx.beginPath();for(let j=0;j<6;j++){const an=j/6*Math.PI*2;ctx.lineTo(hx+Math.cos(an)*6,hy+Math.sin(an)*6)}ctx.fill()}
  ctx.fillStyle=ac;ctx.fillRect(x,y+8,3,h-16);
  ctx.save();ctx.translate(x+20,y+20);ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(8,-6);ctx.lineTo(7,3);ctx.quadraticCurveTo(4,8,0,10);ctx.quadraticCurveTo(-4,8,-7,3);ctx.lineTo(-8,-6);ctx.closePath();ctx.fillStyle=ac;ctx.fill();ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(-1.5,-5,3,8);ctx.restore();
  ctx.textBaseline='alphabetic';txt(`${mine?'내 ':'상대 '}${name}`,x+34,y+25,15,'#fff','left','800');txt(mine?'방어 팁':'공격 팁',x+w-12,y+24,9.5,ac,'right','800');
  L.forEach((l,i)=>txt(l,x+16,y+44+i*16,11.5,'#e6e9ef','left','700'));ctx.restore();return h}
function injuryHud(S){const C=S.injCard;if(!C||S.mode!=='fight'||S.demo)return;const me=S.p,mine=me&&me.side===C.side,a=Math.min(1,C.t/10)*clamp((330-C.t)/20,0,1),w=Math.min(300,WH*.44),sl=(1-ezo(C.t/14))*40;
  injuryCard(WH-w-12+sl,HH*.3,w,C.k,mine,a)}
/* after the result: the winner up close, arms up, with the result strap */
function outroClose(S){const W=S.winSide?(S.winSide==='a'?S.a:S.b):null,OUT=IC.Fight.OUT,t0=S.cer?OUT.close:OUT.dclose,end=S.cer?OUT.end:OUT.dend,k=(S.outT||0)-t0;if(k<0)return;
  const r=S.result||{},e=ezo(k/16),out=clamp((end-t0-k)/14,0,1);ctx.save();ctx.globalAlpha=Math.min(e,out);closeBg(S.frame,W?W.corner:'#e8b33a');
  if(W){const sc=HH/122*(1+.05*k/200);bust(W,WH*.5,HH*.07,sc,S.frame,{perf:'win',pt:k,mood:'yell',sweat:.6})}
  else{const sc=HH/150;bust(S.a,WH*.3,HH*.14,sc,S.frame,{});bust(S.b,WH*.7,HH*.14,sc,S.frame+30,{})}
  for(let i=0;i<40;i++){const x=(i*97.7+S.frame*(.4+i%3*.2))%WH,y=((i*53+S.frame*(1.2+i%4*.4))%(HH+20))-10;ctx.fillStyle=['#ffd75e','#ffffff','#e8b33a',W?W.corner:'#fff'][i%4];ctx.save();ctx.translate(x,y);ctx.rotate(S.frame*.05+i);ctx.fillRect(-3,-1.5,6,3);ctx.restore()}
  closeVig();
  const sw=Math.min(WH*.9,540);if(W)nameStrap(W,(WH-sw)/2,HH-66-Math.max(10,HH*.05),sw,(k-8)/22,['WINNER · '+[r.method,r.round?r.round+'R':'',r.time].filter(Boolean).join(' '),'#ffd75e']);
  else{ctx.textBaseline='alphabetic';disp('DRAW',WH/2,HH*.85,Math.min(40,WH*.07),'#fff','center')}
  if(k<8){ctx.globalAlpha=(8-k)/8*.7;ctx.fillStyle='#fff';ctx.fillRect(0,0,WH,HH)}
  ctx.restore()}
function walkOverlay(S){
  const W=S.walk,k=W.k||'',F=/^blue/.test(k)?S.a:/^red/.test(k)?S.b:null,t=W.t,isA=/Aisle$/.test(k),isAnn=/Ann$/.test(k);
  if(isA&&t<112){stageReveal(S,F,t);liveBug(S);return}
  if(F&&isAnn&&t>=ANN_CUT){annClose(S,F,t);liveBug(S);return}
  if(k==='tape'){tapeFull(S,t);liveBug(S);return}
  if(F&&!isA){
    // spotlight: dark everywhere except a soft pool on the walking fighter
    const g=ctx.createRadialGradient(WH/2,HH*.55,HH*.12,WH/2,HH*.55,HH*.85);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.72)');ctx.fillStyle=g;ctx.fillRect(0,0,WH,HH);
    // haze
    for(let i=0;i<14;i++){const ph=S.frame*.01+i*1.7,x=WH*((i*0.137+S.frame*.0006*(i%3+1))%1),y=HH*(.7+.25*Math.sin(ph)),r=60+30*Math.sin(ph*1.3);
      const hg=ctx.createRadialGradient(x,y,0,x,y,r);hg.addColorStop(0,'rgba(220,226,240,.07)');hg.addColorStop(1,'rgba(220,226,240,0)');ctx.fillStyle=hg;ctx.fillRect(x-r,y-r,r*2,r*2)}
    // corner color wash
    ctx.fillStyle=rgba(F.corner,.08);ctx.fillRect(0,0,WH,HH);
  }
  if(W.pyro&&W.pyro.at!=='tunnel')cagePyro(S,W.pyro);
  if(!isA)liveBug(S);
  // fight title (top)
  if(isA){const song=F===S.a?W.songA:W.songB,p=clamp(t/30,0,1),e=1-Math.pow(1-p,3),bw=Math.min(WH*.6,250),bx=lerp(-bw,12,e),by=HH-176;
    ctx.fillStyle='rgba(10,12,16,.85)';ctx.beginPath();ctx.roundRect(bx,by,bw,52,6);ctx.fill();ctx.fillStyle=F.corner;ctx.fillRect(bx,by,4,52);
    for(let i=0;i<5;i++){const h=6+Math.abs(Math.sin(S.frame*.22+i*1.3))*20;ctx.fillStyle=i%2?'#e8b33a':F.corner;ctx.fillRect(bx+14+i*6,by+40-h,4,h)}
    ctx.textBaseline='alphabetic';txt('입장곡',bx+52,by+19,10,'#e8b33a','left','700');disp(`♪ ${song.n}`,bx+52,by+40,Math.min(18,bw*.08),'#ffffff','left');txt(song.gn,bx+bw-10,by+19,10,'rgba(233,230,223,.7)','right','700')}
  if(k==='blueAisle'&&t<110){const p=clamp(t/20,0,1)*clamp((110-t)/20,0,1);ctx.globalAlpha=p;ctx.textBaseline='alphabetic';
    disp(S.title?'타이틀전':'메인 카드',WH/2,HH*.16+56,Math.min(26,WH*.05),'#e8b33a','center');
    txt(`${S.rounds}라운드 · ${(IC.CLASSES.find(c=>c.id===S.a.d.cls)||{}).name||''}`,WH/2,HH*.16+78,12,'rgba(233,230,223,.85)','center','700');ctx.globalAlpha=1}
  // lower-third name graphic
  if(isA)introPanel(S,F,t);
  if(isA&&W.cap){const cap=W.cap;ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 14px "IBM Plex Sans KR",sans-serif';
    const tw=ctx.measureText(cap).width+30,by=HH-58;ctx.fillStyle='rgba(8,9,12,.88)';ctx.fillRect(WH/2-tw/2,by,tw,32);ctx.fillStyle=F.corner;ctx.fillRect(WH/2-tw/2,by,4,32);ctx.fillStyle='#fff';ctx.fillText(cap,WH/2+2,by+16);ctx.restore()}
  // announcer caption
  const last=W.lines[W.lines.length-1];
  if(last&&last.t<(isA?80:320)&&k!=='tape'){
    const n=Math.min(last.text.length,Math.floor(last.t*.9)),shown=last.text.slice(0,n);
    const fw=Math.min(WH*.9,WH-340,520);ctx.font='700 13px "IBM Plex Sans KR",sans-serif';
    const lines=[];let cur='';for(const ch of shown){if(ctx.measureText(cur+ch).width>fw-28){lines.push(cur);cur=ch}else cur+=ch}lines.push(cur);
    const bh=lines.length*18+30,bx=WH/2-fw/2,by=k==='faceoff'||k==='touch'?HH-bh-16:8;
    ctx.fillStyle='rgba(10,12,16,.82)';ctx.beginPath();ctx.roundRect(bx,by,fw,bh,6);ctx.fill();
    txt(last.kind==='coach'?'코너 코치':'장내 아나운서',bx+14,by+16,10,last.kind==='coach'?'#5fbf72':'#e8b33a','left','700');
    lines.forEach((l,i)=>txt(l,bx+14,by+34+i*18,13,'#f3f1ea','left','700'));
  }
  if(k==='touch'){const p=clamp(t/20,0,1);ctx.globalAlpha=p;ctx.textBaseline='middle';disp('터치 글러브',WH/2,HH*.3,Math.min(30,WH*.06),'#ffffff','center');ctx.globalAlpha=1}
  // skip hint
  /* skip button lives in the DOM now */
}
function introOverlay(S){
  if(S.walk)return walkOverlay(S);
  const t=(S.introLen||0)-S.phaseT;if((S.introLen||0)<200||t>190)return;
  const fade=t>170?1-(t-170)/20:1;ctx.globalAlpha=fade;
  ctx.fillStyle='rgba(5,6,9,.45)';ctx.fillRect(0,0,WH,HH);
  const card=(F,side,t0)=>{const p=clamp((t-t0)/24,0,1),e=1-Math.pow(1-p,3),cw=Math.min(WH*.44,300),ch=104,y=HH/2-ch/2+(side==='a'?-18:18);
    const x=side==='a'?lerp(-cw,WH*.04,e):lerp(WH,WH*.96-cw,e);
    const g=ctx.createLinearGradient(x,0,x+cw,0);if(side==='a'){g.addColorStop(0,rgba(F.corner,.9));g.addColorStop(.45,'rgba(14,16,22,.95)');g.addColorStop(1,'rgba(14,16,22,.9)')}else{g.addColorStop(0,'rgba(14,16,22,.9)');g.addColorStop(.55,'rgba(14,16,22,.95)');g.addColorStop(1,rgba(F.corner,.9))}
    ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(x,y,cw,ch,6);ctx.fill();
    const al=side==='a'?'left':'right',tx=side==='a'?x+16:x+cw-16;ctx.textBaseline='alphabetic';
    txt(side==='a'?'블루 코너':'레드 코너',tx,y+20,10,'rgba(255,255,255,.7)',al,'700');
    disp(F.nick,tx,y+52,30,'#f6f3ec',al);
    txt(F.name,tx,y+70,12,'#e9e6df',al,'600');
    const d=F.d;txt(`${d.rec?d.rec.join('-'):''} · ${IC.STYLES[d.style].name} · ${d.from} · 종합 ${d.ovr}`,tx,y+90,10,'rgba(233,230,223,.7)',al,'600');
  };
  card(S.a,'a',8);card(S.b,'b',48);
  if(t>40){ctx.globalAlpha=fade*clamp((t-40)/15,0,1);disp('VS',WH/2,HH/2+12,40,'#e8b33a','center')}
  ctx.globalAlpha=1;
}
function decisionOverlay(S){
  const r=S.result,t=S.decT;if(!r||!r.cards)return;const D=IC.Fight.DECT,JN=['A','B','C'];
  const fade=(t0,len=14)=>clamp((t-t0)/len,0,1),ez=k=>1-Math.pow(1-k,3);
  ctx.save();ctx.textBaseline='alphabetic';
  /* 1) "we go to the scorecards" title card */
  if(t<D.judges[0]+10){const k=fade(8)*clamp((D.judges[0]+10-t)/12,0,1),y=HH*.24;ctx.globalAlpha=k;
    ctx.fillStyle='rgba(6,8,12,.78)';ctx.fillRect(0,y-38,WH,64);ctx.fillStyle='#e8b33a';ctx.fillRect(0,y-38,WH,2);ctx.fillRect(0,y+24,WH,2);
    txt('OFFICIAL DECISION',WH/2,y-14,11,'#e8b33a','center','800');disp('심판 채점 결과',WH/2,y+14,Math.min(30,WH*.055),'#ffffff','center');ctx.globalAlpha=1}
  /* 2) judges' cards fill a lower-third one by one */
  if(t>=D.judges[0]-6){const bw=Math.min(WH*.9,520),bh=74,bx=WH/2-bw/2,by=HH-bh-18,k=ez(fade(D.judges[0]-6,16));ctx.globalAlpha=k;
    frost(bx,by,bw,bh,10,.88);chrome(bx,by,bw,bh,10,'#e8b33a');
    txt('심판 채점',bx+14,by+16,10,'#e8b33a','left','800');txt(`${S.a.nick}  vs  ${S.b.nick}`,bx+bw-14,by+16,10,'rgba(233,230,223,.7)','right','700');
    const cw=(bw-28-16)/3;r.cards.forEach((c,i)=>{const cx=bx+14+i*(cw+8),cy=by+24,kk=ez(fade(D.judges[i],10));
      ctx.fillStyle='rgba(255,255,255,.06)';ctx.beginPath();ctx.roundRect(cx,cy,cw,42,6);ctx.fill();
      if(kk<=0){txt(`심판 ${JN[i]}`,cx+cw/2,cy+26,11,'rgba(233,230,223,.35)','center','700');return}
      const w=c[0]>c[1]?S.a:c[1]>c[0]?S.b:null;ctx.globalAlpha=k*kk;
      if(w){ctx.fillStyle=w.corner;ctx.fillRect(cx,cy,3,42)}
      txt(`심판 ${JN[i]}`,cx+10,cy+14,9.5,'rgba(233,230,223,.7)','left','700');
      num(`${Math.max(c[0],c[1])}-${Math.min(c[0],c[1])}`,cx+10,cy+35,19,'#ffffff','left');
      txt(w?w.nick:'무승부',cx+cw-8,cy+35,10.5,w?shade(w.corner,1.5):'#e9e6df','right','800');ctx.globalAlpha=k});
    ctx.globalAlpha=1}
  /* 3) "and the winner…" pause with a pulsing line */
  if(t>=D.pause&&t<D.reveal+6){const k=fade(D.pause,10)*clamp((D.reveal+6-t)/6,0,1),p=.6+.4*Math.sin(t*.25);ctx.globalAlpha=k;
    disp(r.winner?`${r.detail}로… 승자는`:'결과는',WH/2,HH*.28,Math.min(28,WH*.05),`rgba(255,255,255,${p})`,'center');ctx.globalAlpha=1}
  /* 4) winner reveal: big corner-colored name plate */
  if(t>=D.reveal){const w=r.winner?(r.winner==='a'?S.a:S.b):null,k=ez(fade(D.reveal,12)),pop=1+.18*Math.max(0,1-(t-D.reveal)/10),y=HH*.25;
    ctx.globalAlpha=k;const col=w?w.corner:'#e8b33a',bw=Math.min(WH*.8,460);
    const g=ctx.createLinearGradient(WH/2-bw/2,0,WH/2+bw/2,0);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.2,rgba(col,.85));g.addColorStop(.8,rgba(col,.85));g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.fillRect(WH/2-bw/2,y-40,bw,76);ctx.fillStyle='#ffd75e';ctx.fillRect(WH/2-bw*.35,y+36,bw*.7,2);
    txt(w?`${w.side==='a'?'블루':'레드'} 코너 · ${r.detail} 승`:r.detail,WH/2,y-20,11,'rgba(255,255,255,.9)','center','800');
    ctx.save();ctx.translate(WH/2,y+16);ctx.scale(pop,pop);disp(w?`"${w.nick}"`:'DRAW',0,0,Math.min(40,WH*.075),'#ffffff','center');ctx.restore();ctx.globalAlpha=1;
    if(t<D.reveal+60)for(let i=0;i<10;i++){const a=i/10*Math.PI*2+t*.05,rr=(t-D.reveal)*4;ctx.fillStyle=`rgba(255,215,94,${Math.max(0,1-(t-D.reveal)/60)})`;ctx.fillRect(WH/2+Math.cos(a)*rr,y+Math.sin(a)*rr*.5,3,3)}}
  ctx.restore()}
function replayOverlay(S){
  const bh=HH*.09;ctx.fillStyle='#000';ctx.fillRect(0,0,WH,bh);ctx.fillRect(0,HH-bh,WH,bh);
  ctx.fillStyle='#d23a2c';ctx.beginPath();ctx.roundRect(12,bh+10,64,20,3);ctx.fill();ctx.textBaseline='middle';txt('REPLAY',44,bh+20,11,'#fff','center','700');
  ctx.fillStyle='rgba(255,255,255,.2)';ctx.fillRect(12,HH-bh-12,WH-24,3);ctx.fillStyle='#e8b33a';ctx.fillRect(12,HH-bh-12,(WH-24)*(S.rpProg||0),3);
  if(S.rp&&S.rp.hl){ctx.textBaseline='middle';txt('하이라이트',86,bh+20,11,'#e8b33a','left','700');disp(S.rp.label||'',WH/2,HH-bh-34,Math.min(22,WH*.045),'#ffffff','center')}
}
/* stance switch callout: slides up under the fighters for ~1.3s */
function stanceCall(S){const C=S.stCall;if(!C)return;const k=S.frame-C.f;if(k<0||k>80)return;const a=Math.min(1,k/6)*Math.min(1,(80-k)/12),sl=1-Math.pow(1-Math.min(1,k/10),3);
  const sp=C.s==='south',col=sp?'#7fe3ff':'#ffd27a',w=Math.min(WH*.6,330),h=36,x=WH/2-w/2,y=92-(1-sl)*14;
  ctx.save();ctx.globalAlpha=a;frost(x,y,w,h,14,.78);chrome(x,y,w,h,14,col);
  ctx.textBaseline='middle';ctx.textAlign='center';num('⇄ '+(sp?'SOUTHPAW':'ORTHODOX'),WH/2,y+12,14,col,'center');
  txt((sp?'사우스포':'오소독스')+(C.open?' · 오픈 스탠스 — 뒷손 스트레이트·몸통킥 +12%':' · 클로즈드 스탠스 — 잽 +10%'),WH/2,y+27,9.5,'#e9edf3','center','700');
  /* footwork diagram: which foot leads */
  const fx=x+20,fy=y+h/2;for(const [dx,lead] of [[-5,!sp],[5,sp]]){ctx.fillStyle=lead?col:'rgba(255,255,255,.35)';ctx.beginPath();ctx.ellipse(fx+dx,fy+(lead?-5:5),3,5.5,0,0,7);ctx.fill()}
  ctx.restore()}
function bannerDraw(S){
  const b=S.banner;if(!b)return;
  if(S.mode==='intro'&&(S.introLen||0)>200&&S.introLen-S.phaseT<170)return;
  const k=1-b.t/b.max,pop=k<.1?lerp(1.35,1,(k/.1)**.6):1,fade=b.t<14?b.t/14:1,cy=HH*.5,fs=Math.min(76,WH*.115);
  const base=b.col&&b.col[0]==='#'?b.col:'#e9e6df',gold=b.col==='#ffd75e'||b.col==='#e8b33a';
  ctx.save();ctx.globalAlpha=fade;
  /* soft cinematic vignette strip + chrome rules */
  const bh=fs*(b.sub?1.9:1.45),bw=Math.min(WH*.92,Math.max(fs*7,WH*.62))*Math.min(1,k/.07+.15);
  const bg=ctx.createLinearGradient(WH/2-bw/2,0,WH/2+bw/2,0);bg.addColorStop(0,'rgba(4,5,8,0)');bg.addColorStop(.22,'rgba(4,5,8,.62)');bg.addColorStop(.78,'rgba(4,5,8,.62)');bg.addColorStop(1,'rgba(4,5,8,0)');
  ctx.fillStyle=bg;ctx.fillRect(WH/2-bw/2,cy-bh/2,bw,bh);
  for(const yy of [cy-bh/2,cy+bh/2-1]){const ln=ctx.createLinearGradient(WH/2-bw/2,0,WH/2+bw/2,0);ln.addColorStop(0,'rgba(220,226,236,0)');ln.addColorStop(.5,gold?'rgba(255,215,120,.95)':'rgba(220,226,236,.85)');ln.addColorStop(1,'rgba(220,226,236,0)');ctx.fillStyle=ln;ctx.fillRect(WH/2-bw/2,yy,bw,1)}
  ctx.translate(WH/2,cy-(b.sub?fs*.2:0));ctx.scale(pop,pop);
  ctx.font=`${fs}px "Black Han Sans",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  const tw=ctx.measureText(b.text).width;
  /* extrusion: stacked darker layers give the letters depth */
  const depth=Math.max(4,Math.round(fs*.09));
  for(let i=depth;i>=1;i--){ctx.fillStyle=i===depth?'rgba(0,0,0,.55)':shade(gold?'#8a5d0f':'#3a404b',.55+.45*(1-i/depth));ctx.fillText(b.text,i*.35,i)}
  ctx.lineWidth=Math.max(3,fs*.06);ctx.strokeStyle=gold?'#6b4508':'#1a1d23';ctx.strokeText(b.text,0,0);
  /* face: polished metal with a hard horizon line */
  const g=ctx.createLinearGradient(0,-fs*.5,0,fs*.5);
  if(gold){g.addColorStop(0,'#fff6d2');g.addColorStop(.38,'#ffd75e');g.addColorStop(.5,'#b07d18');g.addColorStop(.62,'#f3c95a');g.addColorStop(1,'#ffe9a8')}
  else{g.addColorStop(0,'#ffffff');g.addColorStop(.38,shade(base,1.08));g.addColorStop(.5,'#6d7584');g.addColorStop(.6,'#c9d1dc');g.addColorStop(1,'#f4f6fa')}
  ctx.fillStyle=g;ctx.fillText(b.text,0,0);
  /* bevel highlight on the top edge and a fine inner stroke */
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.lineWidth=1.2;ctx.strokeStyle='rgba(255,255,255,.55)';ctx.strokeText(b.text,0,-.8);ctx.restore();
  /* light sweep */
  {const sx=lerp(-tw*.75,tw*.75,(k*1.5)%1),sh=ctx.createLinearGradient(-tw/2,0,tw/2,0),p=clamp((sx+tw/2)/tw,.07,.93);sh.addColorStop(0,'rgba(255,255,255,0)');sh.addColorStop(p-.07,'rgba(255,255,255,0)');sh.addColorStop(p,'rgba(255,255,255,.6)');sh.addColorStop(p+.07,'rgba(255,255,255,0)');sh.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=sh;ctx.fillText(b.text,0,0)}
  if(b.sub){const fz=Math.round(fs*.24);ctx.font=`700 ${fz}px ${NUM},sans-serif`;ctx.letterSpacing='3px';ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillText(b.sub,1,fs*.78+1);ctx.fillStyle=gold?'#ffe3a0':'#e8b33a';ctx.fillText(b.sub,0,fs*.78)}
  ctx.restore();
}

/* ---------- main render ---------- */
/* overlay for the 3D view: effects projected from the 3D camera, then the broadcast HUD */
let GRAIN=null;
/* broadcast look, baked once per screen size into small offscreen layers (gradients are smooth, so quarter resolution is invisible) and
   stamped each frame with 4 drawImage calls instead of many full-screen gradient passes */
let GRADE=null;
function gradeBake(Wd,Hd){const sc=.25,cw=Math.max(8,Math.round(Wd*sc*2.4)),ch=Math.max(8,Math.round(Hd*sc*2.4)),k=cw/Wd;
  const mk=()=>{const c=document.createElement('canvas');c.width=cw;c.height=ch;const x=c.getContext('2d');x.setTransform(k,0,0,k,0,0);return[c,x]};const m={x:Wd/2,y:Hd*.68};
  /* darkening as a plain black vignette (same look as multiply/soft-light, but the cheapest blend there is) */
  const [cm,xm]=mk();
  {const g=xm.createRadialGradient(m.x,m.y-40,Wd*.12,m.x,m.y-40,Wd*.62);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.5,'rgba(0,0,6,.2)');g.addColorStop(1,'rgba(0,0,8,.78)');xm.fillStyle=g;xm.fillRect(0,0,Wd,Hd)}
  {const g=xm.createLinearGradient(0,0,0,Hd*.62);g.addColorStop(0,'rgba(0,0,6,.5)');g.addColorStop(1,'rgba(0,0,0,0)');xm.fillStyle=g;xm.fillRect(0,0,Wd,Hd*.62)}
  const cs=null;
  const [cg,xg]=mk();{xg.save();xg.translate(m.x,m.y+Hd*.12);xg.scale(1,.26);const g=xg.createRadialGradient(0,0,0,0,0,Wd*.42);g.addColorStop(0,'rgba(255,248,232,.16)');g.addColorStop(.6,'rgba(255,244,222,.05)');g.addColorStop(1,'rgba(255,244,222,0)');xg.fillStyle=g;xg.fillRect(-Wd*.5,-Wd*.5,Wd,Wd);xg.restore()}
  /* light rig: a dark box truss with hanging stage fixtures — warm lens glow, a faint flare, soft beams into the haze */
  const [cr,xr]=mk();const ty=Math.max(4,Hd*.03),th=Math.max(6,Hd*.026),n=7;
  const sv=ctx;ctx=xr;try{
    /* beams first (additive), so the hardware sits on top of them */
    xr.globalCompositeOperation='lighter';
    for(let i=0;i<n;i++){const x=Wd*(i+.5)/n,aim=m.x+(x-m.x)*.45;softBeam(x,ty+th+10,aim,Hd*.8,6,Wd*.07,i%3===1?'200,220,255':'255,240,214',.05,0,i+11,true)}
    xr.globalCompositeOperation='source-over';
    /* truss: top and bottom chords with a zig-zag web */
    const ch=(y)=>{const g=xr.createLinearGradient(0,y-1.5,0,y+1.5);g.addColorStop(0,'#5a606b');g.addColorStop(.5,'#2a2e35');g.addColorStop(1,'#14161a');xr.fillStyle=g;xr.fillRect(0,y-1.5,Wd,3)};
    xr.fillStyle='rgba(4,5,7,.92)';xr.fillRect(0,0,Wd,ty+th+2);
    ch(ty);ch(ty+th);xr.strokeStyle='rgba(70,76,86,.9)';xr.lineWidth=1.1;xr.beginPath();for(let x=0,k=0;x<Wd+th;x+=th*1.1,k++){xr.moveTo(x,k%2?ty:ty+th);xr.lineTo(x+th*1.1,k%2?ty+th:ty)}xr.stroke();
    /* fixtures: clamp, yoke and a can pointing down at the cage */
    for(let i=0;i<n;i++){const x=Wd*(i+.5)/n,y=ty+th+1,cw=Math.max(7,th*1.15),chh=Math.max(9,th*1.5),tilt=(m.x-x)/Wd*.5;
      xr.save();xr.translate(x,y);xr.fillStyle='#1b1e23';xr.fillRect(-2,-1,4,4);xr.rotate(tilt);
      const bg=xr.createLinearGradient(-cw/2,0,cw/2,0);bg.addColorStop(0,'#0c0d10');bg.addColorStop(.45,'#3a3f48');bg.addColorStop(1,'#0c0d10');xr.fillStyle=bg;
      xr.beginPath();xr.moveTo(-cw*.42,3);xr.lineTo(cw*.42,3);xr.lineTo(cw*.55,3+chh);xr.lineTo(-cw*.55,3+chh);xr.closePath();xr.fill();
      xr.fillStyle='#08090b';xr.beginPath();xr.ellipse(0,3+chh,cw*.55,cw*.18,0,0,7);xr.fill();
      xr.globalCompositeOperation='lighter';const lg=xr.createRadialGradient(0,3+chh,0,0,3+chh,cw*1.6);lg.addColorStop(0,i%3===1?'rgba(225,235,255,.85)':'rgba(255,238,205,.85)');lg.addColorStop(.25,'rgba(255,230,190,.25)');lg.addColorStop(1,'rgba(255,230,190,0)');xr.fillStyle=lg;xr.fillRect(-cw*1.6,3+chh-cw*1.6,cw*3.2,cw*3.2);
      const fl=xr.createLinearGradient(-cw*3,0,cw*3,0);fl.addColorStop(0,'rgba(255,240,215,0)');fl.addColorStop(.5,'rgba(255,240,215,.18)');fl.addColorStop(1,'rgba(255,240,215,0)');xr.fillStyle=fl;xr.fillRect(-cw*3,3+chh-.8,cw*6,1.6);
      xr.restore()}
  }finally{ctx=sv}
  return{key:Wd+'x'+Hd,cm,cs,cg,cr,ty}}
function broadcastGrade(S){const tf=ctx.getTransform(),cv=ctx.canvas,key=W+'x'+VH+'@'+cv.width+'x'+cv.height+'@'+tf.a.toFixed(4);
  if(!GRADE||GRADE.key!==key){const L=gradeBake(W,VH);const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const x=c.getContext('2d');x.setTransform(tf.a,0,0,tf.d,0,0);
    x.drawImage(L.cm,0,0,W,VH);x.drawImage(L.cg,0,0,W,VH);x.drawImage(L.cr,0,0,W,VH);
    GRADE={key,c}}
  /* one pixel-exact copy per frame: the cheapest way to lay the whole broadcast look over the scene */
  ctx.save();ctx.setTransform(1,0,0,1,Math.round(tf.e),Math.round(tf.f));ctx.drawImage(GRADE.c,0,0);ctx.restore()}
function venueFX(S){
  /* underground venues: dirty colour grade, a swinging bare bulb, haze and a hard vignette */
  if(S.arena&&S.arena.k==='under'){const tc=S.arena.tint||'#c88a3a',fl=Math.sin(S.frame*.9)>.92?.55:1,sw=Math.sin(S.frame*.03)*.18;
    ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle='rgba(205,175,140,.55)';ctx.fillRect(0,0,W,VH);ctx.restore();
    ctx.save();ctx.globalCompositeOperation='lighter';const bx=W/2+Math.sin(sw)*90,by=VH*.06+Math.cos(sw)*6;const lg=ctx.createRadialGradient(bx,by,2,bx,by,VH*.9);lg.addColorStop(0,rgba(tc,.32*fl));lg.addColorStop(.35,rgba(tc,.1*fl));lg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=lg;ctx.fillRect(0,0,W,VH);ctx.restore();
    ctx.strokeStyle='rgba(20,20,20,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(bx,by);ctx.stroke();ctx.fillStyle=`rgba(255,240,200,${fl})`;ctx.beginPath();ctx.arc(bx,by+4,6,0,7);ctx.fill();
    for(let i=0;i<6;i++){const hx=(i*173+S.frame*.3)%(W+200)-100,hy=VH*(.35+.1*Math.sin(i+S.frame*.01)),r=W*.18;const g=ctx.createRadialGradient(hx,hy,0,hx,hy,r);g.addColorStop(0,'rgba(180,170,160,.06)');g.addColorStop(1,'rgba(180,170,160,0)');ctx.fillStyle=g;ctx.fillRect(hx-r,hy-r,r*2,r*2)}
    const v2=ctx.createRadialGradient(W/2,VH*.55,Math.min(W,VH)*.3,W/2,VH*.55,Math.max(W,VH)*.6);v2.addColorStop(0,'rgba(0,0,0,0)');v2.addColorStop(1,'rgba(0,0,0,.55)');ctx.fillStyle=v2;ctx.fillRect(0,0,W,VH)}
  /* 항구 창고: rain through the broken roof */
  if(S.gim==='rain'){ctx.save();ctx.strokeStyle='rgba(180,210,255,.35)';ctx.lineWidth=1.2;ctx.beginPath();for(let i=0;i<140;i++){const x=((i*97.3+S.frame*3.2)%(W+80))-40,y=((i*53.7+S.frame*14)%(VH+40))-20;ctx.moveTo(x,y);ctx.lineTo(x-4,y+16)}ctx.stroke();
    for(let i=0;i<10;i++){const x=(i*173)%W,y=VH*.82+(i%3)*14,k=((S.frame+i*13)%30)/30;ctx.strokeStyle=`rgba(180,210,255,${.4*(1-k)})`;ctx.beginPath();ctx.ellipse(x,y,4+k*16,1+k*4,0,0,7);ctx.stroke()}ctx.restore()}
  /* 레드룸: blackout — pitch dark, only phone flashes and the fighters' eyes of light */
  if(S.dark>0){const a=S.dark>140?(150-S.dark)/10:S.dark<12?S.dark/12:1,fl=Math.random()<.03;ctx.save();ctx.fillStyle=`rgba(0,0,0,${.93*a*(fl?.4:1)})`;ctx.fillRect(0,0,W,VH);
    for(let i=0;i<5;i++){if(Math.sin(S.frame*.3+i*2.7)>.85){const x=(i*211+S.frame)%W,y=VH*(.25+.1*(i%3));const g=ctx.createRadialGradient(x,y,0,x,y,120);g.addColorStop(0,`rgba(255,255,255,${.25*a})`);g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(x-120,y-120,240,240)}}ctx.restore()}
  /* 폐공장: the closing cage */
  if(S.gim==='shrink'&&S.arenaR0){const k=1-S.arena.r/S.arenaR0;if(k>.02){ctx.save();ctx.strokeStyle=`rgba(255,120,40,${.25+.25*Math.sin(S.frame*.2)})`;ctx.lineWidth=6;ctx.strokeRect(3,3,W-6,VH-6);ctx.restore()}}
}
function renderOverlay(S0,c,cssW,cssH,o3d){
  VH=cssW&&cssH?clamp(W*cssH/cssW,300,1100):H;
  const S=S0.mode==='replay'&&S0.rp?IC.Fight.replayView():S0;
  ctx.clearRect(0,0,W,VH);
  const P=(x,y,z)=>o3d.project(x,y,z,VH);
  const zOf=x=>{const a=S.a,b=S.b;return Math.abs(x-a.x)<Math.abs(x-b.x)?(b.z||0):(a.z||0)};
  for(const r of S.rings){const p=P(r.x,r.y,zOf(r.x));ctx.strokeStyle=`rgba(255,255,255,${r.l/14*.7})`;ctx.lineWidth=r.big?3:2;ctx.beginPath();ctx.arc(p.x,p.y,r.r*1.3,0,7);ctx.stroke()}
  for(const p0 of S.sparks){const p=P(p0.x,p0.y,zOf(p0.x));ctx.globalAlpha=Math.min(1,p0.l/12);ctx.fillStyle=p0.col;ctx.beginPath();ctx.arc(p.x,p.y,p0.drop?2:p0.sw?1.6:1.8,0,7);ctx.fill()}
  ctx.globalAlpha=1;ctx.textAlign='center';ctx.textBaseline='middle';
  for(const t of S.texts){if(t.num&&!OPT.nums)continue;const p=P(t.x,t.y,zOf(t.x));ctx.globalAlpha=Math.min(1,t.l/20);ctx.font=`${t.num?22:19}px "Black Han Sans",sans-serif`;ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.65)';ctx.strokeText(t.t,p.x,p.y);ctx.fillStyle=t.col;ctx.fillText(t.t,p.x,p.y)}
  ctx.globalAlpha=1;
  const vg=ctx.createRadialGradient(W/2,VH/2,Math.min(W,VH)*.4,W/2,VH/2,Math.max(W,VH)*.65);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.18)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,VH);
  if(S0.flashScr>0){ctx.fillStyle=`rgba(255,255,255,${S0.flashScr/7*.2})`;ctx.fillRect(0,0,W,VH)}
  if(S.slow>0||S.replay){ctx.fillStyle='rgba(255,215,140,.06)';ctx.fillRect(0,0,W,VH)}
  if(!S.walk||!/Aisle$/.test(S.walk.k||''))venueFX(S);
  HS=clamp(600/(cssW||800),1,1.75);WH=W/HS;HH=VH/HS;
  ctx.save();ctx.scale(HS,HS);
  {const g=(OPT.topGap||0)*W/(cssW||800)/HS;if(g>0){ctx.fillStyle='#07080b';ctx.fillRect(0,0,WH,g);ctx.translate(0,g);HH-=g}}
  if(S.replay)replayOverlay(S);
  else{
    if(!S.demo&&!IC.__nohud&&S.mode!=='outro'&&S.mode!=='decision'&&!S.walk){hud(S);comboOverlay(S);injuryHud(S)}
    if(S.mode==='intro')introOverlay(S);
    if(S.mode==='decision')decisionOverlay(S);
    if(!S.demo&&!(IC.__nohud&&!S.walk)&&S.mode!=='outro'&&(!S.walk||/faceoff|touch|officials/.test(S.walk.k||'')))bannerDraw(S);stanceCall(S);
    if(S.mode==='outro'&&!S.demo)outroClose(S);
  }
  ctx.restore();
}
function render(S0,c,cssW,cssH,o3d){const __t0=performance.now();try{return render_(S0,c,cssW,cssH,o3d)}finally{const d=performance.now()-__t0;IC.__rt=(IC.__rt||0)*.95+d*.05}}
function render_(S0,c,cssW,cssH,o3d){
  ctx=c;if(o3d)return renderOverlay(S0,c,cssW,cssH,o3d);VH=cssW&&cssH?clamp(W*cssH/cssW,300,1100):H;
  const S=S0.mode==='replay'&&S0.rp?IC.Fight.replayView():S0;ADS=S0.arena&&S0.arena.k==='under'?ADSU:ADS0;
  const inAisle=S.walk&&/Aisle$/.test(S.walk.k||'');
  if(inAisle){aisleScene(S)}else{S._xf=S.walk&&/In$/.test(S.walk.k||'')&&S.walk.t<26?S.walk.t:-1;
  computeCam(S);VPX=cam.x;
  ctx.save();
  let sx=0,sy=0;if(S.shake>.5){sx=(Math.random()-.5)*S.shake*1.3;sy=(Math.random()-.5)*S.shake*1.3}
  if(S.kick){const k=S.kick.t/S.kick.max,ek=Math.sin(k*Math.PI)*k;sx+=S.kick.x*ek;sy+=S.kick.y*ek}
  ctx.translate(W/2+sx,VH/2+sy+(OPT.topGap||0)*W/(cssW||800)*.5);ctx.scale(cam.z,cam.z);ctx.translate(-cam.x,-cam.y);
  arena(S);
  const items=[{z:(S.ref&&S.ref.z)??-50,d:()=>drawRef(S)}];
  if(S.walk&&((S.walk.k==='officials'&&S.walk.t>30)||(/Ann$/.test(S.walk.k||'')&&S.walk.t<ANN_CUT)))items.push({z:-10,d:()=>drawAnnouncer(S)});
  if(S.gr)items.push({z:S.gr.cz||0,d:()=>drawGround(S)});
  else for(const F of [S.a,S.b])if(!F.hidden)items.push({z:(F.z||0)+(F.state==='attack'?.5:0),d:()=>drawStandingFighter(F,F===S.a?S.b:S.a,S)});
  items.sort((p,q)=>p.z-q.z).forEach(i=>i.d());
  arenaFront(S);
  impacts(S);
  if(S.walk&&S.walk.k==='faceoff'&&S.walk.bub){const mx=(S.a.x+S.b.x)/2;for(const B of S.walk.bub){const ya=PR(B.F.x,B.F.z||0,200).y,isA=B.F===S.a;bubble(mx+(isA?-118:118),ya-(isA?0:26),B.text,B.F.corner,B.t0,S.walk.t)}}
  for(const r of S.rings){ctx.strokeStyle=`rgba(255,255,255,${r.l/14*.7})`;ctx.lineWidth=r.big?3:2;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,7);ctx.stroke()}
  for(const p of S.sparks){ctx.globalAlpha=Math.min(1,p.l/12);ctx.fillStyle=p.col;if(p.sw||p.drop){ctx.beginPath();if(p.drop){ctx.ellipse(p.x,p.y,p.r||1.8,(p.r||1.8)*(1+Math.min(1.5,Math.abs(p.vy)*.15)),Math.atan2(p.vy,p.vx)+Math.PI/2,0,7)}else ctx.arc(p.x,p.y,1.5,0,7);ctx.fill()}else ctx.fillRect(p.x-1.5,p.y-1.5,3,3)}
  ctx.globalAlpha=1;
  if(!IC.__nobeam)beams(S);
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(const t of S.texts){if(t.num&&!OPT.nums)continue;ctx.globalAlpha=Math.min(1,t.l/20);ctx.font=`${t.num?20:18}px "Black Han Sans",sans-serif`;ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.65)';ctx.strokeText(t.t,t.x,t.y);ctx.fillStyle=t.col;ctx.fillText(t.t,t.x,t.y)}
  ctx.globalAlpha=1;ctx.restore();
  }
  /* no hard cut from the tunnel to the cage: the aisle shot dissolves into the cage shot */
  if(S._xf>=0&&S.walk){const W0=S.walk,k0=W0.k,ax0=W0.ax;W0.k=k0.replace(/In$/,'Aisle');W0.ax=Math.max(ax0,600);const a0=ctx.globalAlpha;
    try{ctx.save();ctx.globalAlpha=Math.pow(1-S._xf/26,1.4);aisleScene(S);ctx.restore()}catch(e){}finally{W0.k=k0;W0.ax=ax0;ctx.globalAlpha=a0}}
  // broadcast look: overhead light rig, a lit canvas under the lights, punchy grade and fine film grain
  if(!(S.arena&&S.arena.k==='under')&&!S.demo&&!(S.walk&&/Aisle$/.test(S.walk.k||''))&&!IC.__nograde)broadcastGrade(S);
  // screen fx
  const vg=ctx.createRadialGradient(W/2,VH/2,Math.min(W,VH)*.35,W/2,VH/2,Math.max(W,VH)*.62);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.3)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,VH);
  if(S.walk&&S.walk.tension>0){const hb=Math.max(0,Math.sin(S.frame*.137))**8,g=ctx.createRadialGradient(W/2,VH/2,VH*.25,W/2,VH/2,Math.max(W,VH)*.65);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(110,0,0,${S.walk.tension*(.18+hb*.22)})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,VH)}
  if(S0.flashScr>0){ctx.fillStyle=`rgba(255,255,255,${S0.flashScr/7*.22})`;ctx.fillRect(0,0,W,VH)}
  if(S.slow>0||S.replay){ctx.fillStyle='rgba(255,215,140,.07)';ctx.fillRect(0,0,W,VH)}
  if(!S.demo&&!S.replay&&S.p&&S.p.rocked>0&&S.mode==='fight'){const k=Math.min(1,S.p.rocked/120),off=6*k*Math.sin(S.frame*.09);
    try{ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=.22*k;ctx.drawImage(c.canvas,off*3,off*1.5);ctx.restore()}catch(e){}
    const vg2=ctx.createRadialGradient(W/2,VH/2,VH*.2,W/2,VH/2,Math.max(W,VH)*.6);vg2.addColorStop(0,'rgba(0,0,0,0)');vg2.addColorStop(1,`rgba(0,0,0,${.45*k*(.7+.3*Math.sin(S.frame*.14))})`);ctx.fillStyle=vg2;ctx.fillRect(0,0,W,VH)}
  if(S.mode==='doc'||S.mode==='foul'){ctx.fillStyle='rgba(120,10,10,.12)';ctx.fillRect(0,0,W,VH)}
  // HUD
  if(!S.walk||!/Aisle$/.test(S.walk.k||''))venueFX(S);
  HS=clamp(600/(cssW||800),1,1.75);WH=W/HS;HH=VH/HS;
  ctx.save();ctx.scale(HS,HS);
  {const g=(OPT.topGap||0)*W/(cssW||800)/HS;if(g>0){ctx.fillStyle='#07080b';ctx.fillRect(0,0,WH,g);ctx.translate(0,g);HH-=g}}
  if(S.replay)replayOverlay(S);
  else{
    if(!S.demo&&!IC.__nohud&&S.mode!=='outro'&&S.mode!=='decision'&&!S.walk){hud(S);comboOverlay(S);injuryHud(S)}
    if(S.mode==='intro')introOverlay(S);
    if(S.mode==='decision')decisionOverlay(S);
    if(!S.demo&&!(IC.__nohud&&!S.walk)&&S.mode!=='outro'&&(!S.walk||/faceoff|touch|officials/.test(S.walk.k||'')))bannerDraw(S);stanceCall(S);
    if(S.mode==='outro'&&!S.demo)outroClose(S);
  }
  ctx.restore();
}

/* ---------- weigh-in ceremony ---------- */
/* ---------- weigh-in ceremony: ballroom stage, commission table, fans with signs, staredown ---------- */
const WI={intro:[0,70],blueOn:[70,300],redOn:[300,530],face:[530,900],end:900,SEG:{walk:55,strip:68,step:80,read:[86,132],stamp:134,flex:[140,200]},
  FACE:{gather:50,stare:[80,300],bubA:100,bubB:165,event:225,sep:[232,290],end:370}};
const WTRASH=['내일 밤, 넌 바닥에서 천장을 보게 될 거야.','체중은 맞췄네. 이제 실력만 맞추면 되겠다.','눈 피하지 마. 내일도 똑바로 봐라.','네 코치한테 수건 준비하라고 해.','케이지 문 닫히면 아무도 못 도와줘.','난 준비됐어. 넌 아니야.','1라운드면 충분해.','그 웃음, 내일은 못 짓게 해 주지.'];
function wiFighter(d,side,x,f,pose,t,o={}){
  const corner=side==='b'?'#e04a3a':'#3d7ff0';
  const F={d,look:d.look,corner,head:100,body:100,legs:100,cuts:0,rocked:0,flash:0,state:'idle',st:100,side,_t:t,kind:'fighter',walkShirt:o.shirt?corner:null};
  const b=Math.sin(t*.08)*1.2,y0=pose==='walk'?0:(o.y0??-14),lean=o.lean||0;
  const hip={x:x+lean*.3,y:300+y0+b},chest={x:x+f*1+lean,y:232+y0+b};
  let near,far,elbN='down',elbF='down',nf={x:x+f*14,y:GY+y0},ff={x:x-f*14,y:GY+y0};
  if(pose==='walk'){const w=Math.sin(t*.22)*11;nf={x:x+f*12+w,y:GY-Math.max(0,Math.sin(t*.22))*5};ff={x:x-f*12-w,y:GY-Math.max(0,-Math.sin(t*.22))*5};near={x:x+f*10-w*.6,y:286};far={x:x-f*6+w*.6,y:288}}
  else if(pose==='flex'){near={x:chest.x+f*20,y:chest.y-44};far={x:chest.x-f*16,y:chest.y-46};elbN='fwd';elbF='back'}
  else if(pose==='double'){near={x:chest.x+f*34,y:chest.y-30};far={x:chest.x-f*30,y:chest.y-30};elbN='up';elbF='up'}
  else if(pose==='face'){near={x:x+f*30+lean,y:220+y0};far={x:x+f*16+lean,y:214+y0}}
  else if(pose==='push'){near={x:x+f*58+lean,y:226+y0};far={x:x+f*52+lean,y:236+y0};elbN='fwd';elbF='fwd'}
  else if(pose==='point'){near={x:x+f*50+lean,y:206+y0};far={x:x+f*10+lean,y:270+y0};elbN='fwd'}
  else if(pose==='hand'){near={x:chest.x+f*16,y:chest.y-50};far={x:x-f*5,y:292+y0};elbN='fwd'}
  else if(pose==='over'){near={x:chest.x+f*12,y:chest.y-50};far={x:chest.x-f*6,y:chest.y-50};elbN='up';elbF='up'}
  else if(pose==='sad'){near={x:x+f*6,y:296+y0};far={x:x-f*8,y:298+y0}}
  else if(pose==='shrug'){near={x:x+f*40,y:262+y0};far={x:x-f*36,y:262+y0};elbN='down';elbF='down'}
  else if(pose==='ear'){const w=Math.sin(t*.35)*6;near={x:chest.x+f*14,y:chest.y-40};far={x:chest.x-f*34,y:chest.y-48+w};elbN='up';elbF='up'}
  else if(pose==='strip'){const k=o.k||0;near={x:chest.x+f*8,y:lerp(280,150,k)};far={x:chest.x-f*6,y:lerp(282,152,k)};elbN='fwd';elbF='back'}
  else{near={x:x+f*9,y:290+y0};far={x:x-f*5,y:292+y0}}
  ctx.save();ctx.translate(x,GY);ctx.scale(1.3,1.3);ctx.translate(-x,-GY);
  drawBody(F,{f,hip,chest,tilt:pose==='face'||pose==='push'?.14:pose==='sad'?.32:pose==='ear'?-.12:pose==='walk'?0:-.02,mood:pose==='flex'||pose==='double'||pose==='point'||pose==='over'||pose==='hand'||pose==='ear'?'yell':null,nearHand:near,farHand:far,nearFoot:nf,farFoot:ff,kneeN:'fwd',kneeF:'fwd',elbN,elbF});
  ctx.restore();
}
function wiPerson(x,f,t,o){const B={kind:'ref',logo:o.logo||'',look:{skin:o.skin||'#d9a47e',hair:o.hair||'#2a1f1a',hairStyle:o.hs||'short',beard:!!o.beard},skinNow:o.skin||'#d9a47e',shirt:o.shirt||'#1d2028',pants:true,corner:'#888',head:100,body:100,legs:100,cuts:0,sweat:0,t};
  ctx.save();ctx.translate(x,GY);ctx.scale(1.22,1.22);ctx.translate(-x,-GY);drawBody(B,poseRef({x,f,moving:!!o.moving,walk:t*.2,state:o.state||'idle'},{frame:t}));ctx.restore()}
function bubble(x,y,text,col,t0,t){if(!text)return;const a=clamp((t-t0)/10,0,1)*clamp((t0+80-t)/12,0,1);if(a<=0)return;
  ctx.save();ctx.globalAlpha=a;ctx.font='700 13px "IBM Plex Sans KR",sans-serif';const lines=[];let cur='';for(const ch of text){if(ctx.measureText(cur+ch).width>170){lines.push(cur);cur=ch}else cur+=ch}lines.push(cur);
  const w=Math.max(...lines.map(l=>ctx.measureText(l).width))+22,h=lines.length*17+14,bx=clamp(x-w/2,8,792-w),by=y-h;
  ctx.fillStyle='rgba(255,255,255,.95)';ctx.beginPath();ctx.roundRect(bx,by,w,h,8);ctx.fill();ctx.beginPath();ctx.moveTo(x-6,by+h);ctx.lineTo(x+6,by+h);ctx.lineTo(x,by+h+10);ctx.fill();
  ctx.fillStyle=col;ctx.fillRect(bx,by+4,3,h-8);ctx.fillStyle='#111';ctx.textAlign='left';ctx.textBaseline='middle';lines.forEach((l,i)=>ctx.fillText(l,bx+12,by+15+i*17));ctx.restore()}
let WCROWD=null;
function weighin(c,cw,ch,st){
  ctx=c;const post=[];const VHw=800*ch/cw,t=st.t,A=st.a,B=st.b,S0=WI.SEG,FC=WI.FACE;
  if(!WCROWD){const r=IC.seeded(911);WCROWD=[];for(let i=0;i<46;i++)WCROWD.push({x:-10+i*18+r()*8,y:418+r()*22,s:.9+r()*.35,ph:r()*6.28,sign:r()<.16,phone:r()<.35,c:['#1a1d24','#22252d','#191b21','#262a33'][r()*4|0]})}
  ctx.save();ctx.clearRect(0,0,800,VHw);
  const bg=ctx.createLinearGradient(0,0,0,VHw);bg.addColorStop(0,'#0a0f1a');bg.addColorStop(1,'#04060a');ctx.fillStyle=bg;ctx.fillRect(0,0,800,VHw);
  const oy=(VHw-450)/2;ctx.translate(0,oy);
  // staredown camera push-in
  const fp=clamp((t-WI.face[0]-FC.gather)/60,0,1)*(t<WI.face[0]+FC.end-30?1:clamp((WI.face[0]+FC.end-t)/30,0,1)),zz=1+.28*fp*fp*(3-2*fp);
  ctx.translate(400,250);ctx.scale(zz,zz);ctx.translate(-400,-250);
  // step-and-repeat sponsor wall
  ctx.fillStyle='#0f1726';ctx.fillRect(-60,20,920,290);
  const logos=['IRON CAGE','VOLTA','NORTHPEAK','KORE','BLUELINE','HALCYON'];ctx.textAlign='center';ctx.textBaseline='middle';
  for(let r=0;r<5;r++)for(let k=-1;k<8;k++){const lx=60+k*110+(r%2)*55,ly=56+r*50;ctx.fillStyle=(r+k)%2?'rgba(232,179,58,.10)':'rgba(220,230,245,.07)';ctx.font='bold 15px sans-serif';ctx.fillText(logos[((r+k)%6+6)%6],lx,ly)}
  // LED header
  ctx.fillStyle='#07090e';ctx.fillRect(170,26,460,70);ctx.strokeStyle='rgba(232,179,58,.7)';ctx.lineWidth=2;ctx.strokeRect(170,26,460,70);
  const sh=ctx.createLinearGradient(170,0,630,0);sh.addColorStop(0,'rgba(232,179,58,0)');sh.addColorStop(Math.min(1,Math.max(0,(t*.006)%1)),'rgba(232,179,58,.12)');sh.addColorStop(1,'rgba(232,179,58,0)');ctx.fillStyle=sh;ctx.fillRect(172,28,456,66);
  ctx.font='30px "Black Han Sans",sans-serif';ctx.fillStyle='#e8b33a';ctx.fillText('공식 계체량',400,52);
  ctx.font='700 13px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='rgba(233,230,223,.85)';ctx.fillText(`${st.cls} · 한계 체중 ${st.limLb} lb (${st.limKg} kg)${st.title?' · 타이틀전':''}`,400,80);
  // title belt on a stand
  if(st.title){ctx.fillStyle='#1b1f27';ctx.fillRect(392,206,16,100);ctx.fillStyle='#14161b';ctx.beginPath();ctx.roundRect(330,176,140,34,10);ctx.fill();const bg2=ctx.createLinearGradient(0,170,0,215);bg2.addColorStop(0,'#ffe08a');bg2.addColorStop(1,'#b8861b');ctx.fillStyle=bg2;ctx.beginPath();ctx.ellipse(400,193,32,24,0,0,7);ctx.fill();ctx.fillStyle='#7a5a10';ctx.font='bold 9px sans-serif';ctx.fillText('CHAMPION',400,194);ctx.fillStyle='rgba(255,240,190,.5)';ctx.fillRect(338,186,22,14);ctx.fillRect(440,186,22,14)}
  // spotlights
  ctx.save();ctx.globalCompositeOperation='lighter';for(const lx of [140,400,660]){const g=ctx.createLinearGradient(lx,0,lx,GY);g.addColorStop(0,'rgba(255,244,220,.12)');g.addColorStop(1,'rgba(255,244,220,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(lx-8,0);ctx.lineTo(lx+8,0);ctx.lineTo(lx+140,GY);ctx.lineTo(lx-140,GY);ctx.closePath();ctx.fill()}ctx.restore();
  // stage platform with edge lights
  const sg=ctx.createLinearGradient(0,GY-6,0,450);sg.addColorStop(0,'#2a3242');sg.addColorStop(1,'#141922');ctx.fillStyle=sg;ctx.fillRect(-60,GY-6,920,60);
  for(let x=-40;x<860;x+=22){ctx.fillStyle=((x+t*2)%88<22)?'rgba(232,179,58,.9)':'rgba(232,179,58,.25)';ctx.fillRect(x,GY+44,12,3)}
  // commission table (left)
  ctx.fillStyle='#0b0d12';ctx.fillRect(18,GY-62,120,58);ctx.fillStyle='#e9e6df';ctx.font='bold 9px sans-serif';ctx.fillText('ATHLETIC COMMISSION',78,GY-40);ctx.fillStyle='#2a2f38';ctx.fillRect(18,GY-64,120,4);
  for(const hx of [52,104]){ctx.fillStyle='#1c1f26';ctx.beginPath();ctx.ellipse(hx,GY-70,13,10,0,0,7);ctx.fill();ctx.fillStyle='#c99a76';ctx.beginPath();ctx.arc(hx,GY-86,8,0,7);ctx.fill();ctx.fillStyle='#2a1f1a';ctx.beginPath();ctx.arc(hx,GY-89,8,Math.PI,0);ctx.fill()}
  ctx.fillStyle='#f3f1ea';ctx.fillRect(60,GY-66,14,4);
  // scale
  ctx.fillStyle='#1b1f27';ctx.fillRect(360,GY-16,80,16);ctx.fillStyle='#3a4150';ctx.fillRect(360,GY-16,80,3);
  ctx.fillStyle='#22262e';ctx.fillRect(531,GY-134,8,118);ctx.fillStyle='#1b1f27';ctx.fillRect(440,GY-20,100,6);
  const readout=(res,p)=>{const v=res.lb*Math.min(1,p)+(p<1?Math.sin(t*1.7)*.3:0);ctx.fillStyle='#07090c';ctx.beginPath();ctx.roundRect(470,GY-190,130,56,6);ctx.fill();ctx.strokeStyle=p>=1?(res.ok?'#3c9a52':'#a33a2c'):'#3a4352';ctx.lineWidth=2;ctx.stroke();
    ctx.font='32px "Black Han Sans",sans-serif';ctx.fillStyle=p>=1?(res.ok?'#7dff9a':'#ff6b5e'):'#ffd75e';ctx.fillText(Math.max(0,v).toFixed(1),535,GY-168);
    ctx.font='700 11px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#8e97a6';ctx.fillText(`lb · ${(Math.max(0,v)*0.4536).toFixed(1)} kg`,535,GY-145)};
  const seg=r=>clamp((t-r[0])/(r[1]-r[0]),0,1);
  // official near the scale
  const offX=290;
  let offState='idle';
  // ----- weigh segments -----
  if(t<WI.face[0]){
    const turnA=t<WI.redOn[0];const L=turnA?t-WI.blueOn[0]:t-WI.redOn[0];
    const cur=turnA?{F:A,res:st.res.a,side:'a',f:1,from:-40,rest:180}:{F:B,res:st.res.b,side:'b',f:-1,from:840,rest:620};
    const wait=turnA?{F:B,side:'b',x:700,f:-1}:{F:A,side:'a',x:120,f:1};
    // the other fighter waits at the side (blue waits off-stage until red's turn begins)
    if(!turnA)wiFighter(wait.F.d,wait.side,wait.x,wait.f,'stand',t);
    {const L0=turnA?t-WI.blueOn[0]:t-WI.redOn[0],res=turnA?st.res.a:st.res.b;wiPerson(offX,1,t,{shirt:'#20242c',skin:'#e2b48c',hair:'#3b2a1e',hs:'short',state:L0>=S0.stamp&&L0<S0.flex[1]?(res.ok?'raise':'stop'):'watch'})}
    if(L<0){/* intro */}
    else{
      let x,pose='stand',o={};
      if(L<S0.walk){x=lerp(cur.from,400,L/S0.walk);pose='walk';o.shirt=true}
      else if(L<S0.strip){x=400;pose='strip';o.k=(L-S0.walk)/(S0.strip-S0.walk);o.shirt=L<S0.strip-4}
      else if(L<S0.flex[1]){x=400;const k=L-S0.flex[0];pose=k<0?'stand':cur.res.ok?'flex':k<16?'sad':k<36?'shrug':'ear';
        if(!cur.res.ok&&k>=18){const line=cur.side==='a'?st.missA:st.missB;post.push(()=>bubble(290,GY-215,line,cur.side==='a'?'#3d7ff0':'#e04a3a',S0.flex[0]+18,L))}}
      else{x=lerp(400,cur.rest,(L-S0.flex[1])/30);pose='walk'}
      const dir=pose!=='walk'?cur.f:L<S0.walk?(cur.from<400?1:-1):(cur.rest>400?1:-1);
      wiFighter(cur.F.d,cur.side,x,dir,pose,t,o);
      if(L>=S0.step&&L<S0.flex[1]+10)readout(cur.res,clamp((L-S0.read[0])/(S0.read[1]-S0.read[0]),0,1));
      if(L>=S0.stamp&&L<S0.flex[1]+10){const res=cur.res,k=clamp((L-S0.stamp)/8,0,1);ctx.save();ctx.translate(535,GY-235);ctx.rotate(-.12);ctx.scale(1.6-.6*k,1.6-.6*k);ctx.globalAlpha=k;
        ctx.strokeStyle=res.ok?'#5fbf72':'#e2553f';ctx.lineWidth=4;ctx.strokeRect(-74,-22,148,44);ctx.font='26px "Black Han Sans",sans-serif';ctx.fillStyle=res.ok?'#7dff9a':'#ff6b5e';ctx.fillText(res.ok?'체중 통과':'체중 초과',0,2);ctx.restore();offState=res.ok?'raise':'stop'}
      // name card
      const F=cur.F,cc=F.side==='a'?'#3d7ff0':'#e04a3a',cx0=F.side==='a'?20:530;
      if(L<S0.flex[1]+20)post.push(()=>{ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(10,12,17,.9)';ctx.beginPath();ctx.roundRect(cx0,392-40,250,52,6);ctx.fill();ctx.fillStyle=cc;ctx.fillRect(cx0,352,4,52);
        ctx.textAlign='left';ctx.font='20px "Black Han Sans",sans-serif';ctx.fillStyle='#fff';ctx.fillText(`"${F.nick}"`,cx0+14,370);ctx.font='700 12px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#e9e6df';ctx.fillText(`${F.name} · ${F.d.from} · ${(F.d.rec||[0,0,0]).join('-')}`,cx0+14,392);ctx.textAlign='center'})
    }
  }else{
    // ----- staredown -----
    const L=t-WI.face[0],ev=st.ev||'stare';
    let sep=lerp(300,128,clamp(L/FC.gather,0,1));
    if(L>FC.stare[0])sep=lerp(128,96,clamp((L-FC.stare[0])/60,0,1))+Math.sin(L*.09)*2;
    let pa='face',pb='face',la=0,lb=0;
    if(L>FC.event&&L<FC.sep[1]){const k=(L-FC.event);
      if(ev==='push'){if(k<10){pb='push';lb=-10}sep=96+clamp(k/8,0,1)*70-clamp((k-30)/40,0,1)*20;if(k>=6)pa='point'}
      else if(ev==='shout'){pa='point';pb='point';la=6;lb=-6;sep=88}
      else{la=4;lb=-4;sep=90}}
    if(L>=FC.sep[1]){sep=lerp(sep,220,clamp((L-FC.sep[1])/30,0,1));const late=L>FC.sep[1]+30;pa=late?(st.res.a.ok?'flex':'sad'):'stand';pb=late?(st.res.b.ok?'flex':'sad'):'stand'}
    const ax=400-sep/2-2,bx=400+sep/2+2;
    wiFighter(A.d,'a',ax,1,L<FC.gather?'walk':pa,t,{lean:la});wiFighter(B.d,'b',bx,-1,L<FC.gather?'walk':pb,t,{lean:lb});
    // official stands between, steps back for the stare, jumps in to separate
    const between=L<FC.stare[0]-20||(L>FC.event+4&&L<FC.sep[1]+20);
    const ox=400,oz=between?0:-1;
    if(oz===0)wiPerson(ox,1,t,{shirt:'#20242c',skin:'#e2b48c',hair:'#3b2a1e',state:L>FC.event+4?'stop':'start'});
    // tension: heartbeat vignette and spark line between foreheads
    if(L>FC.stare[0]&&L<FC.sep[1]){const hb=Math.max(0,Math.sin(L*.16))**8;const g=ctx.createRadialGradient(400,220,40,400,220,420);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(120,0,0,${.15+hb*.25})`);ctx.fillStyle=g;ctx.fillRect(-60,0,920,460);
      if(sep<110){ctx.save();ctx.globalCompositeOperation='lighter';for(let k=0;k<3;k++){ctx.strokeStyle=`rgba(255,${180+k*25},120,${.35-k*.1})`;ctx.lineWidth=2-k*.5;ctx.beginPath();let y=150+Math.sin(t*.7+k)*4;ctx.moveTo(400-sep/2+30,y);for(let q=1;q<=6;q++)ctx.lineTo(400-sep/2+30+q*(sep-60)/6,150+(Math.random()-.5)*14);ctx.stroke()}ctx.restore()}}
    bubble(ax+8,120,st.trashA,'#3d7ff0',WI.face[0]+FC.bubA,t);bubble(bx-8,120,st.trashB,'#e04a3a',WI.face[0]+FC.bubB,t);
    if(L>FC.event&&L<FC.event+70){const k=L-FC.event,txt=ev==='push'?'밀치기! 장내 소란!':ev==='shout'?'고성이 오갑니다!':'눈을 피하지 않는다!';
      ctx.save();ctx.globalAlpha=clamp(k/6,0,1)*clamp((70-k)/12,0,1);ctx.translate(400,330);ctx.scale(1+Math.max(0,(8-k))*.05,1+Math.max(0,(8-k))*.05);ctx.font='28px "Black Han Sans",sans-serif';ctx.lineWidth=7;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText(txt,0,0);ctx.fillStyle=ev==='push'?'#ff6b5e':'#ffd75e';ctx.fillText(txt,0,0);ctx.restore()}
    if(L>FC.gather&&L<FC.event){ctx.font='34px "Black Han Sans",sans-serif';ctx.lineWidth=7;ctx.strokeStyle='rgba(0,0,0,.7)';ctx.globalAlpha=clamp((L-FC.gather)/15,0,1);ctx.strokeText('페이스오프',400,330);ctx.fillStyle='#ffffff';ctx.fillText('페이스오프',400,330);ctx.globalAlpha=1}
    if(L>FC.sep[1]+20&&t<WI.end){ctx.globalAlpha=clamp((L-FC.sep[1]-20)/20,0,1)*clamp((WI.end-t)/20,0,1);ctx.font='26px "Black Han Sans",sans-serif';ctx.fillStyle='#e8b33a';ctx.lineWidth=6;ctx.strokeStyle='rgba(0,0,0,.7)';ctx.strokeText('내일 밤, 케이지에서',400,330);ctx.fillText('내일 밤, 케이지에서',400,330);ctx.globalAlpha=1}
    post.push(()=>{ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 13px "IBM Plex Sans KR",sans-serif';
    [[A,st.res.a,110],[B,st.res.b,690]].forEach(([F,r,x])=>{ctx.fillStyle='rgba(10,12,17,.9)';ctx.beginPath();ctx.roundRect(x-90,352,180,46,6);ctx.fill();ctx.fillStyle=F.side==='a'?'#3d7ff0':'#e04a3a';ctx.fillRect(x-90,352,4,46);ctx.fillStyle='#fff';ctx.fillText(F.nick,x,368);ctx.fillStyle=r.ok?'#7dff9a':'#ff6b5e';ctx.fillText(`${r.lb.toFixed(1)} lb · ${r.ok?'통과':'초과'}`,x,387)})});
  }
  // fans in front: phones up, signs with fighter names, photographers flashing
  const hot=st.hot||0;
  {const okS=['a','b'].find(sd=>{const L=t-(sd==='a'?WI.blueOn[0]:WI.redOn[0]);return st.res[sd].ok&&L>=WI.SEG.stamp&&L<WI.SEG.flex[1]+12});
   if(okS){const nk=st[okS].nick;post.push(()=>{ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';for(let i=0;i<9;i++){const ph=(t*.011+i*.111)%1,x=60+((i*263)%700),y=415-ph*170;ctx.globalAlpha=Math.sin(ph*Math.PI)*.95;
     if(i%4===3){ctx.font='26px sans-serif';ctx.fillText(['👏','🔥','🙌'][i%3],x,y)}else{ctx.font='italic 21px "Black Han Sans",sans-serif';ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.6)';const w=i%3===0?nk+'!':i%3===1?'와아아!':'가자!';ctx.strokeText(w,x,y);ctx.fillStyle='#ffd75e';ctx.fillText(w,x,y)}}
     for(let i=0;i<5;i++){const k=(t*13+i*211)%90;if(k<6){const fx=(i*173+t*7)%800,fy=380+(i*37)%50;const g=ctx.createRadialGradient(fx,fy,0,fx,fy,40);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.globalAlpha=1-k/6;ctx.fillStyle=g;ctx.fillRect(fx-40,fy-40,80,80)}}ctx.restore()})}}
  {const boo=['a','b'].some(sd=>{const L=t-(sd==='a'?WI.blueOn[0]:WI.redOn[0]);return !st.res[sd].ok&&L>=WI.SEG.stamp&&L<WI.SEG.flex[1]+12});
   if(boo)post.push(()=>{ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';for(let i=0;i<14;i++){const ph=(t*.012+i*.137)%1,x=40+((i*97)%720),y=410-ph*150;ctx.globalAlpha=Math.sin(ph*Math.PI)*.9;
     if(i%3===2){ctx.font='26px sans-serif';ctx.fillText('👎',x,y)}else{ctx.font='italic 22px "Black Han Sans",sans-serif';ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.6)';const w=i%2?'BOO!':'우~';ctx.strokeText(w,x,y);ctx.fillStyle='#ff6b5e';ctx.fillText(w,x,y)}}ctx.restore()})}
  for(const p of WCROWD){const j=Math.max(0,Math.sin(t*(hot?.28:.06)+p.ph))*(hot?7:1.2),x=p.x,y=p.y-j,s=p.s;
    ctx.fillStyle=p.c;ctx.beginPath();ctx.ellipse(x,y+22*s,14*s,18*s,0,0,7);ctx.fill();ctx.fillStyle='#14161b';ctx.beginPath();ctx.arc(x,y,8*s,0,7);ctx.fill();
    ctx.strokeStyle='rgba(255,240,215,.12)';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(x,y,8*s,-2.6,-.6);ctx.stroke();
    if(p.sign){const nm=(p.ph>3?A:B),col=nm===A?'#3d7ff0':'#e04a3a';ctx.save();ctx.translate(x,y-34*s-j);ctx.rotate(Math.sin(t*.05+p.ph)*.08);ctx.fillStyle='#f3f1ea';ctx.fillRect(-30,-14,60,26);ctx.fillStyle=col;ctx.font='bold 10px "IBM Plex Sans KR",sans-serif';ctx.fillText(nm.nick.slice(0,6)+'!!',0,0);ctx.strokeStyle='#888';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,12);ctx.lineTo(0,30);ctx.stroke();ctx.restore()}
    else if(p.phone){ctx.fillStyle='#0b0c0f';ctx.fillRect(x+6*s,y-26*s-j,9,14);ctx.fillStyle=(t+p.ph*40)%90<4?'rgba(255,255,255,1)':'rgba(170,200,255,.7)';ctx.fillRect(x+7*s,y-25*s-j,7,10)}}
  {const burst=(t*7)%(hot?9:23)<2;if(burst){const x=40+((t*53)%720),y=330+((t*31)%50);const g=ctx.createRadialGradient(x,y,0,x,y,46);g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(x-46,y-46,92,92)}}
  for(const f of post)f();
  if(t>WI.end){const a=clamp((t-WI.end)/40,0,.72);ctx.fillStyle=`rgba(4,6,10,${a})`;ctx.fillRect(-60,0,920,460);ctx.globalAlpha=clamp((t-WI.end-20)/30,0,1);
    ctx.font='34px "Black Han Sans",sans-serif';ctx.fillStyle='#e8b33a';ctx.fillText('계체량 종료',400,200);ctx.font='700 15px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#e9e6df';
    ctx.fillText(`${A.nick} ${st.res.a.lb.toFixed(1)} lb  ·  ${B.nick} ${st.res.b.lb.toFixed(1)} lb`,400,236);ctx.fillStyle='rgba(233,230,223,.75)';ctx.font='700 13px "IBM Plex Sans KR",sans-serif';ctx.fillText('아래 버튼을 눌러 경기를 시작하세요',400,264);ctx.globalAlpha=1}
  // intro title card
  if(t<WI.intro[1]+20){const a=clamp(t/15,0,1)*clamp((WI.intro[1]+20-t)/20,0,1);ctx.globalAlpha=a;ctx.fillStyle='rgba(5,7,10,.75)';ctx.fillRect(-60,180,920,110);ctx.font='38px "Black Han Sans",sans-serif';ctx.fillStyle='#fff';ctx.fillText(`${A.nick}  VS  ${B.nick}`,400,222);ctx.font='700 13px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#e8b33a';ctx.fillText('공식 계체량 · 경기 하루 전',400,256);ctx.globalAlpha=1}
  ctx.restore();
  const vg=ctx.createRadialGradient(400,VHw/2,VHw*.3,400,VHw/2,700);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.45)');ctx.fillStyle=vg;ctx.fillRect(0,0,800,VHw);
}
/* ---------- belt ceremony ---------- */
const BELT={reveal:110,close:170,wrap:330,lift:540,end:900};
const BELTIMG=(()=>{try{const i=new Image();i.src='art/belt.webp';return i}catch(e){return null}})();
let CONF=null;
const ez=k=>{k=clamp(k,0,1);return k*k*(3-2*k)};
function drawBelt(x,y,s,o={}){
  const sx=o.sx==null?1:o.sx,kc=!!o.kc;ctx.save();ctx.translate(x,y);ctx.scale(s*sx,s);
  /* polished metal: many-stop gradients read as reflective gold (or platinum for the King of the Cage) */
  const metal=(x0,y0,x1,y1,dark)=>{const g=ctx.createLinearGradient(x0,y0,x1,y1);const C=kc?['#ffffff','#e6ebf2','#9aa4b3','#f4f7fb','#6c7686','#cfd6e0','#4a5260']:['#fff1bd','#e8b844','#8e5d10','#f7d77a','#6a4208','#c99228','#3e2604'];
    C.forEach((c,i)=>g.addColorStop(i/(C.length-1),dark?shade(c,.82):c));return g};
  const enamel=kc?['#1b2230','#05070b']:['#8e0c15','#2a0204'];
  /* leather strap: slightly curved, stitched, embossed */
  const strap=(r)=>{ctx.beginPath();ctx.moveTo(-112,-15);ctx.quadraticCurveTo(0,-19*r,112,-15);ctx.quadraticCurveTo(116,0,112,15);ctx.quadraticCurveTo(0,19*r,-112,15);ctx.quadraticCurveTo(-116,0,-112,-15);ctx.closePath()};
  ctx.save();ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;strap(1);const lg=ctx.createLinearGradient(0,-17,0,17);lg.addColorStop(0,'#3a3330');lg.addColorStop(.18,'#1d1917');lg.addColorStop(.55,'#0d0b0a');lg.addColorStop(1,'#020202');ctx.fillStyle=lg;ctx.fill();ctx.restore();
  ctx.save();strap(1);ctx.clip();ctx.strokeStyle='rgba(255,255,255,.035)';ctx.lineWidth=.5;for(let i=-120;i<120;i+=3){ctx.beginPath();ctx.moveTo(i,-18);ctx.lineTo(i+6,18);ctx.stroke()}ctx.restore();
  ctx.strokeStyle=kc?'rgba(220,232,245,.75)':'rgba(236,196,104,.8)';ctx.lineWidth=.7;ctx.setLineDash([2.4,1.6]);for(const yy of [-12.4,12.4]){ctx.beginPath();ctx.moveTo(-108,yy);ctx.quadraticCurveTo(0,yy*1.24,108,yy);ctx.stroke()}ctx.setLineDash([]);
  /* side plates: framed enamel panels with rivets and a gem */
  const side=(px,w,h,gem)=>{ctx.save();ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=4;ctx.shadowOffsetY=1.5;ctx.fillStyle=metal(px-w/2,-h/2,px+w/2,h/2);ctx.beginPath();ctx.roundRect(px-w/2,-h/2,w,h,5);ctx.fill();ctx.restore();
    ctx.strokeStyle='rgba(255,250,230,.7)';ctx.lineWidth=.6;ctx.beginPath();ctx.roundRect(px-w/2+.6,-h/2+.6,w-1.2,h-1.2,4.6);ctx.stroke();
    const ig=ctx.createLinearGradient(0,-h/2,0,h/2);ig.addColorStop(0,enamel[0]);ig.addColorStop(1,enamel[1]);ctx.fillStyle=ig;ctx.beginPath();ctx.roundRect(px-w/2+3.2,-h/2+3.2,w-6.4,h-6.4,3);ctx.fill();
    ctx.strokeStyle=metal(px-w/2,-h/2,px+w/2,h/2,true);ctx.lineWidth=.8;ctx.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4,rr=w*.26;ctx[i?'lineTo':'moveTo'](px+Math.cos(a)*rr,Math.sin(a)*rr)}ctx.closePath();ctx.stroke();
    const gg=ctx.createRadialGradient(px-1,-1.2,0,px,0,3.6);gg.addColorStop(0,'#ffffff');gg.addColorStop(.35,gem);gg.addColorStop(1,shade(gem,.35));ctx.fillStyle=gg;ctx.beginPath();ctx.arc(px,0,3.4,0,7);ctx.fill();
    for(const [rx,ry] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const cx=px+rx*(w/2-2.2),cy=ry*(h/2-2.2);ctx.fillStyle=metal(cx-1,cy-1,cx+1,cy+1);ctx.beginPath();ctx.arc(cx,cy,1.1,0,7);ctx.fill()}};
  side(-92,20,30,kc?'#cfefff':'#2f6fe0');side(-66,24,34,kc?'#ffffff':'#e8202e');side(66,24,34,kc?'#ffffff':'#e8202e');side(92,20,30,kc?'#cfefff':'#2f6fe0');
  /* centre plate: scalloped filigree rim → bevel rings → enamel field → raised octagon medallion */
  const scallop=(R,Ry,n,d)=>{ctx.beginPath();for(let i=0;i<=n*4;i++){const a=i/(n*4)*Math.PI*2,r=1+Math.sin(a*n)*d;ctx[i?'lineTo':'moveTo'](Math.cos(a)*R*r,Math.sin(a)*Ry*r)}ctx.closePath()};
  ctx.save();ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=10;ctx.shadowOffsetY=3;scallop(54,45,8,.018);ctx.fillStyle=metal(-50,-44,50,44);ctx.fill();ctx.restore();
  scallop(54,45,8,.018);ctx.strokeStyle='rgba(255,248,220,.8)';ctx.lineWidth=.8;ctx.stroke();
  /* engraved filigree on the rim */
  ctx.strokeStyle=kc?'rgba(60,70,85,.55)':'rgba(90,55,5,.55)';ctx.lineWidth=.55;for(let i=0;i<24;i++){const a=i/24*Math.PI*2,px=Math.cos(a)*49.5,py=Math.sin(a)*41;ctx.beginPath();ctx.ellipse(px,py,3.2,1.6,a+Math.PI/2,0,Math.PI*1.4);ctx.stroke()}
  /* rhinestone ring */
  for(let i=0;i<36;i++){const a=i/36*Math.PI*2,px=Math.cos(a)*46,py=Math.sin(a)*38.5;const g=ctx.createRadialGradient(px-.4,py-.4,0,px,py,1.6);g.addColorStop(0,'#ffffff');g.addColorStop(.6,kc?'#cfe3ff':'#fff1c8');g.addColorStop(1,'rgba(120,100,60,.8)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,1.05,0,7);ctx.fill()}
  ctx.beginPath();ctx.ellipse(0,0,42,35,0,0,7);ctx.fillStyle=metal(40,-35,-40,35,true);ctx.fill();
  ctx.beginPath();ctx.ellipse(0,0,39,32.5,0,0,7);const eg=ctx.createRadialGradient(-8,-10,2,0,0,40);eg.addColorStop(0,shade(enamel[0],1.02));eg.addColorStop(.55,enamel[0]);eg.addColorStop(1,enamel[1]);ctx.fillStyle=eg;ctx.fill();
  /* engraved rim lettering */
  ctx.save();ctx.fillStyle=kc?'#eef3f9':'#ffe3a0';ctx.font='bold 5.2px "Rajdhani",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  const arcText=(txt,r,ry,a0,dir)=>{const n=txt.length,span=n*.105;for(let i=0;i<n;i++){const a=a0+dir*(-span/2+i*(span/(n-1||1)));ctx.save();ctx.translate(Math.cos(a)*r,Math.sin(a)*ry);ctx.rotate(a+(dir>0?Math.PI/2:-Math.PI/2));ctx.fillText(txt[i],0,0);ctx.restore()}};
  arcText(kc?'KING OF THE CAGE':'IRON CAGE',35.5,29,-Math.PI/2,1);arcText(kc?'SUPERFIGHT':'WORLD CHAMPION',35.5,29,Math.PI/2,-1);ctx.restore();
  /* raised octagon medallion with cage mesh */
  const oct=(r)=>{ctx.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;ctx[i?'lineTo':'moveTo'](Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath()};
  ctx.save();ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=5;ctx.shadowOffsetY=2;oct(25);ctx.fillStyle=metal(-25,-25,25,25);ctx.fill();ctx.restore();
  oct(21);ctx.fillStyle=metal(21,-21,-21,21,true);ctx.fill();oct(18.5);ctx.save();ctx.clip();ctx.fillStyle=kc?'#0b0f16':'#160c05';ctx.fillRect(-20,-20,40,40);
  ctx.strokeStyle=kc?'rgba(210,225,245,.55)':'rgba(240,200,110,.55)';ctx.lineWidth=.55;for(let i=-24;i<24;i+=3.4){ctx.beginPath();ctx.moveTo(i,-20);ctx.lineTo(i+20,20);ctx.moveTo(i+20,-20);ctx.lineTo(i,20);ctx.stroke()}ctx.restore();
  oct(18.5);ctx.strokeStyle='rgba(255,245,210,.7)';ctx.lineWidth=.6;ctx.stroke();
  /* monogram */
  ctx.save();ctx.font='17px "Black Han Sans",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=2.2;ctx.strokeStyle='rgba(0,0,0,.65)';ctx.strokeText('IC',0,1);ctx.fillStyle=metal(-8,-9,8,9);ctx.fillText('IC',0,1);ctx.restore();
  /* crown on top of the medallion */
  ctx.save();ctx.translate(0,-46);ctx.scale(1.25,1.25);ctx.beginPath();ctx.moveTo(-9,3);ctx.lineTo(-10,-4);ctx.lineTo(-5,0);ctx.lineTo(0,-7);ctx.lineTo(5,0);ctx.lineTo(10,-4);ctx.lineTo(9,3);ctx.closePath();ctx.fillStyle=metal(-10,-7,10,3);ctx.fill();ctx.strokeStyle='rgba(80,50,5,.6)';ctx.lineWidth=.5;ctx.stroke();
  for(const [px,py] of [[-10,-4],[0,-7],[10,-4]]){ctx.fillStyle=kc?'#dff2ff':'#e8202e';ctx.beginPath();ctx.arc(px,py,1.3,0,7);ctx.fill()}ctx.restore();
  /* laurel branches */
  for(const sd of [-1,1])for(let i=0;i<7;i++){const a=Math.PI*(.58+i*.075),lx=sd*Math.cos(a)*-30,ly=Math.sin(a)*24-3;ctx.save();ctx.translate(lx,ly);ctx.rotate(sd*(a-Math.PI/2)*-1+sd*.7);ctx.fillStyle=metal(-3,-1.5,3,1.5);ctx.beginPath();ctx.ellipse(0,0,3.2,1.3,0,0,7);ctx.fill();ctx.restore()}
  /* class ribbon banner */
  if(o.cls){ctx.save();ctx.translate(0,17);ctx.fillStyle=metal(-22,-4,22,4,true);ctx.beginPath();ctx.moveTo(-24,-4);ctx.lineTo(24,-4);ctx.lineTo(21,0);ctx.lineTo(24,4);ctx.lineTo(-24,4);ctx.lineTo(-21,0);ctx.closePath();ctx.fill();ctx.fillStyle=kc?'#0b0f16':'#3e0306';ctx.font='bold 4.6px "Rajdhani",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(o.cls).toUpperCase(),0,.3);ctx.restore()}
  /* glint sweeping across */
  if(o.glint!=null){ctx.save();scallop(54,45,8,.018);ctx.clip();const gx=-110+o.glint*220,gl=ctx.createLinearGradient(gx-16,-46,gx+16,46);gl.addColorStop(0,'rgba(255,255,255,0)');gl.addColorStop(.5,'rgba(255,255,255,.65)');gl.addColorStop(1,'rgba(255,255,255,0)');ctx.globalCompositeOperation='lighter';ctx.fillStyle=gl;ctx.fillRect(-60,-50,120,100);ctx.restore()}
  ctx.restore();
}
function star(x,y,r,a){ctx.save();ctx.globalAlpha=a;ctx.translate(x,y);ctx.fillStyle='#fff';ctx.beginPath();for(let i=0;i<8;i++){const rr=i%2?r*.18:r,an=i*Math.PI/4;ctx.lineTo(Math.cos(an)*rr,Math.sin(an)*rr)}ctx.fill();ctx.restore()}
function pyro(x,t,t0){if(t<t0)return;ctx.save();ctx.globalCompositeOperation='lighter';
  const fl=ctx.createRadialGradient(x,GY,0,x,GY,70);fl.addColorStop(0,`rgba(255,200,90,${.55+Math.sin(t*.9)*.15})`);fl.addColorStop(1,'rgba(255,120,30,0)');ctx.fillStyle=fl;ctx.fillRect(x-70,GY-70,140,90);
  for(let i=0;i<90;i++){const h=((i*2654435761)>>>0)/4294967296,h2=((i*40503+17)%997)/997,age=((t-t0)*1.1+i*6.7)%62;const v=8+h*5,dx=(h2-.5)*34;
    const px=x+dx*age/22,py=GY-(v*age-.11*age*age);if(py>GY)continue;const a=1-age/62;ctx.fillStyle=`rgba(255,${170+(h*80|0)},${60+(h2*90|0)},${a})`;ctx.beginPath();ctx.arc(px,py,1.2+a*2.2,0,7);ctx.fill()}
  ctx.restore()}
/* ---------- post-win taunt: the winner performs in the octagon, the loser still on the canvas ---------- */
const TAUNTS={climb:'케이지 위로!',chest:'쓰러진 상대 앞 포효',flip:'백플립!',belt:'벨트는 내 거다',cut:'목 긋기 도발',respect:'존중의 포옹',ear:'더 크게!'};
function tauntScene(c,cw,ch,t,d,opp,kind,kt){
  ctx=c;const VHw=800*ch/cw;ctx.save();ctx.clearRect(0,0,800,VHw);const oy=(VHw-450)/2;
  const lift=kind&&kt>=0;ctx.save();beltArena(t,VHw,oy,{pre:true,zoom:1.2,flash:lift?3:1});ctx.translate(0,22);
  const ft=(dd,side,x,f)=>({d:dd,look:dd.look,corner:side==='b'?'#e04a3a':'#3d7ff0',head:100,body:100,legs:100,cuts:side==='b'?3:1,rocked:0,flash:0,state:'idle',st:70,side,x,f,z:0,_t:t,kind:'fighter',t:0,A:null,react:null,walk:0,stance:'orth'});
  const W=ft(d,'a',350,1),Lr=ft(opp,'b',505,-1),SS={frame:t,cl:null},k=kt||0;
  let wx=350,wy=0,rot=0,loserUp=0,ghostBelt=0,slash=-1;
  if(!kind){W.state='idle'}
  else if(kind==='climb'){const p1=clamp(k/30,0,1),p2=clamp((k-30)/30,0,1);wx=lerp(350,262,p1);W.f=-1;W.state=p1<1?'walk':p2<1?'clinch':'celebrate';W.walk=k*.25;wy=-(GY-300)*(p2*p2*(3-2*p2));if(p2>=1)W.f=1}
  else if(kind==='chest'){const p1=clamp(k/24,0,1);wx=lerp(350,405,p1);W.state=p1<1?'walk':'perf';W.perfK='chest';W.perfT=k-24;W.walk=k*.25}
  else if(kind==='flip'){const p=clamp((k-10)/34,0,1);W.state=k<10?'idle':p<1?'celebrate':'celebrate';wy=-Math.sin(p*Math.PI)*120;rot=-Math.PI*2*(p*p*(3-2*p))}
  else if(kind==='belt'){W.state='perf';W.perfK='taunt';W.perfT=k;ghostBelt=clamp((k-8)/20,0,1)}
  else if(kind==='cut'){W.state='perf';W.perfK='taunt';W.perfT=k;slash=clamp((k-14)/14,0,1)}
  else if(kind==='respect'){const p1=clamp(k/26,0,1);wx=lerp(350,448,p1);W.state=p1<1?'walk':'idle';W.walk=k*.25;loserUp=clamp((k-20)/24,0,1)}
  else if(kind==='ear'){W.state='perf';W.perfK='taunt';W.perfT=k*1.6}
  W.x=wx;
  /* the loser: flat on the canvas, or helped up for the respect hug */
  if(loserUp<1){ctx.save();Lr.koK='back';Lr.state='ko';Lr.koT=99;shadowAt(Lr.x+Lr.f*-30,70);const Jk=koPose(Lr,poseStand(Lr,W,SS),t);
    let JL=Jk;if(loserUp>0){const Js=poseStand({...Lr,state:'idle'},W,SS),q=loserUp;JL=blendJ(Jk,Js,q*q);JL.f=q>.5?Js.f:Jk.f;JL.mood='hurt'}drawBody(Lr,JL);ctx.restore()}
  else{Lr.x=lerp(505,490,clamp((k-44)/10,0,1));shadowAt(Lr.x,52);const J=poseStand(Lr,W,SS);J.nearHand={x:Lr.x-30,y:220};J.farHand={x:Lr.x-24,y:226};drawBody(Lr,J)}
  if(kind==='climb'){const top=300,x0=180,x1=345,p3=clamp((k-30)/30,0,1);ctx.save();
    /* a section of the octagon fence: padded post, chain-link diamonds clipped to the panel, a rounded top rail */
    ctx.beginPath();ctx.rect(x0,top,x1-x0,GY-top);ctx.clip();ctx.strokeStyle='rgba(150,160,175,.5)';ctx.lineWidth=1.1;ctx.beginPath();for(let xx=x0-200;xx<x1+200;xx+=11){ctx.moveTo(xx,top);ctx.lineTo(xx+GY-top,GY);ctx.moveTo(xx+GY-top,top);ctx.lineTo(xx,GY)}ctx.stroke();ctx.restore();
    ctx.fillStyle='#14171d';ctx.fillRect(x0-8,top-6,14,GY-top+6);ctx.fillStyle='#2b3039';ctx.fillRect(x0-8,top-6,4,GY-top+6);ctx.fillStyle='#e8b33a';ctx.font='bold 7px sans-serif';ctx.save();ctx.translate(x0-1,GY-34);ctx.rotate(-Math.PI/2);ctx.fillText('IRON CAGE',0,0);ctx.restore();
    const rg=ctx.createLinearGradient(0,top-10,0,top+2);rg.addColorStop(0,'#3a3f49');rg.addColorStop(1,'#0c0e12');ctx.fillStyle=rg;ctx.beginPath();ctx.roundRect(x0-10,top-10,x1-x0+12,12,6);ctx.fill();ctx.fillStyle='rgba(232,179,58,.8)';ctx.fillRect(x0-6,top-9,x1-x0+4,1.5)}
  /* the winner */
  shadowAt(wx,wy<-40?30:52);ctx.save();
  if(rot){ctx.translate(wx,GY-70+wy);ctx.rotate(rot);ctx.translate(-wx,-(GY-70))}else ctx.translate(0,wy);
  const J=poseStand(W,Lr,SS);if(kind==='chest'||kind==='climb'||kind==='ear'||kind==='belt'||kind==='cut')J.mood='yell';
  if(kind==='ear'&&k>6){const s=Math.sin(k*.2)*4;J.nearHand={x:wx+f2(W)*10,y:198+s};J.farHand={x:wx-12,y:200-s};J.elbN='up';J.elbF='up'}
  if(kind==='respect'&&loserUp>=1){J.nearHand={x:wx+34,y:222};J.farHand={x:wx+28,y:228};J.elbN='fwd';J.elbF='fwd'}
  if(slash>=0&&slash<1){J.nearHand={x:wx+lerp(-6,22,slash),y:206};J.elbN='up'}
  if(ghostBelt>0){J.nearHand={x:wx+8,y:268};J.farHand={x:wx-6,y:270}}
  const r=drawBody(W,J);
  if(ghostBelt>0){ctx.globalAlpha=ghostBelt;drawBelt(wx+4,GY-1.3*(GY-290),.33*ghostBelt+.05,{glint:(t%100)/100});ctx.globalAlpha=1}
  ctx.restore();ctx.restore();
  /* hype marks: crowd noise lines and a big caption */
  ctx.save();ctx.translate(0,oy);
  if(kind&&k>4){const q=clamp((k-4)/12,0,1),s=lerp(2.2,1,1-Math.pow(1-q,3));ctx.save();ctx.translate(400,74);ctx.scale(s*.7,s*.7);ctx.globalAlpha=q;ctx.font='58px "Black Han Sans",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=10;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText(TAUNTS[kind],0,0);
    const g=ctx.createLinearGradient(0,-30,0,24);g.addColorStop(0,'#fff6d0');g.addColorStop(.55,kind==='chest'||kind==='cut'?'#ff6b5e':'#f0b93a');g.addColorStop(1,kind==='chest'||kind==='cut'?'#a8201a':'#a8741a');ctx.fillStyle=g;ctx.fillText(TAUNTS[kind],0,0);ctx.restore()}
  if(!kind){ctx.globalAlpha=.6+.4*Math.sin(t*.12);ctx.font='700 15px "IBM Plex Sans KR",sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText('관중이 당신을 보고 있습니다 — 아래에서 세리머니를 고르세요',400,64);ctx.globalAlpha=1}
  ctx.restore();
  const vg=ctx.createRadialGradient(400,VHw/2,VHw*.35,400,VHw/2,720);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.5)');ctx.fillStyle=vg;ctx.fillRect(0,0,800,VHw);
  ctx.restore()}
function f2(F){return F.f||1}
/* ---------- portrait gate: a fighter head-kicks the phone sideways ---------- */
const GATE={loop:200,hit:79};
function gateScene(c,cw,ch,t,d){
  ctx=c;const T=t%GATE.loop,H=GATE.hit;ctx.save();ctx.clearRect(0,0,cw,ch);
  const k=Math.min(cw/300,ch/300);ctx.translate(cw/2,ch*.5);ctx.scale(k,k);
  const sh=T>=H&&T<H+12?(H+12-T)*.6:0;ctx.translate(Math.sin(T*7)*sh,Math.cos(T*5)*sh);
  /* spotlight floor */
  const fl=ctx.createRadialGradient(0,95,4,0,95,150);fl.addColorStop(0,'rgba(232,179,58,.22)');fl.addColorStop(1,'rgba(232,179,58,0)');ctx.fillStyle=fl;ctx.beginPath();ctx.ellipse(0,95,150,26,0,0,7);ctx.fill();
  const bm=ctx.createLinearGradient(0,-170,0,95);bm.addColorStop(0,'rgba(255,230,170,.0)');bm.addColorStop(1,'rgba(255,230,170,.10)');ctx.fillStyle=bm;ctx.beginPath();ctx.moveTo(-30,-170);ctx.lineTo(30,-170);ctx.lineTo(140,95);ctx.lineTo(-140,95);ctx.closePath();ctx.fill();
  /* fighter (world coords scaled into the card) */
  ctx.save();ctx.scale(.66,.66);ctx.translate(-462,-GY+150);
  const F={d,look:d.look,corner:'#3d7ff0',head:100,body:100,legs:100,cuts:0,rocked:0,flash:0,state:'idle',st:100,side:'a',x:400,f:1,z:0,_t:T,kind:'fighter',t:0,A:null,react:null,walk:0,stance:'orth'};
  const kt=T-70;if(kt>=0&&kt<26){F.state='attack';F.A={anim:'highkick',w:8,a:4,r:14,kick:true};F.t=kt}else if(T>112&&T<175)F.state='celebrate';
  shadowAt(F.x,52);const J=poseStand(F,F,{frame:T,cl:null});const r=drawBody(F,J);
  if(F.state==='attack'&&kt>4&&kt<14){const p=r.footF;ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<5;i++){ctx.globalAlpha=.14*(5-i);ctx.fillStyle='#fff6e0';ctx.beginPath();ctx.arc(p.x-i*9,p.y+i*7,10-i,0,7);ctx.fill()}ctx.restore()}
  ctx.restore();
  /* the phone */
  const ease=x=>{x=clamp(x,0,1);const c1=1.9,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)};
  const rk=T<H?0:T<175?ease((T-H)/24):1-clamp((T-175)/20,0,1),wob=T<H?Math.sin(T*.35)*.07*(T>40?1:.4):0;
  const px=32+(T>=H&&T<175?18*ease((T-H)/24):0),py=10+(T>=H&&T<H+24?-Math.sin((T-H)/24*Math.PI)*18:0);
  ctx.save();ctx.translate(px,py);ctx.rotate(wob-Math.PI/2*rk);
  const w=46,h=84;ctx.shadowColor='rgba(232,179,58,.55)';ctx.shadowBlur=rk>.9?24:10;ctx.fillStyle='rgba(10,12,16,.9)';ctx.strokeStyle='#e8b33a';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,9);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle='#e8b33a';ctx.beginPath();ctx.roundRect(-5,h/2-8,10,3,1.5);ctx.fill();
  if(rk>.85){/* landscape: the cage lights up inside the phone */ctx.save();ctx.rotate(Math.PI/2);ctx.globalAlpha=clamp((rk-.85)/.15,0,1);
    const g=ctx.createLinearGradient(0,-18,0,18);g.addColorStop(0,'#ffffff');g.addColorStop(.5,'#e8b33a');g.addColorStop(1,'#a8741a');ctx.fillStyle=g;ctx.font='11px "Black Han Sans",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('IRON CAGE',0,1);ctx.restore()}
  else if(T<H&&Math.floor(T/14)%2){ctx.fillStyle='#e8b33a';ctx.font='26px "Black Han Sans",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',0,0)}
  ctx.restore();
  /* impact star + speed arcs */
  if(T>=H&&T<H+16){const q=(T-H)/16,ix=px-22,iy=py+14;ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=`rgba(255,250,225,${1-q})`;ctx.beginPath();for(let i=0;i<16;i++){const a=i/16*Math.PI*2,rr=i%2?6:26*(1-q*.4);ctx.lineTo(ix+Math.cos(a)*rr,iy+Math.sin(a)*rr)}ctx.fill();
    ctx.strokeStyle=`rgba(255,240,200,${1-q})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(ix,iy,10+q*50,0,7);ctx.stroke();ctx.restore();
    ctx.font='22px "Black Han Sans",sans-serif';ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.7)';ctx.strokeText('팍!',ix-6,iy-34-q*10);ctx.fillStyle='#ffe08a';ctx.fillText('팍!',ix-6,iy-34-q*10)}
  if(T>=H+4&&T<H+30){ctx.save();ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2;ctx.lineCap='round';for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(px,py,52+i*8,-Math.PI*.9+i*.1,-Math.PI*.55+i*.1);ctx.stroke()}ctx.restore()}
  ctx.restore()}
/* ---------- between rounds: first-person view from the stool, the head coach right in your face ---------- */
/* ---------- between rounds: a broadcast "round in review" card before the corner ---------- */
function roundBreak(c,cw,ch,t,o){
  ctx=c;const VHw=800*ch/cw,oy=(VHw-450)/2;ctx.save();ctx.clearRect(0,0,800,VHw);
  const bg=ctx.createRadialGradient(400,VHw*.35,20,400,VHw*.4,700);bg.addColorStop(0,'#1d2230');bg.addColorStop(1,'#05060a');ctx.fillStyle=bg;ctx.fillRect(0,0,800,VHw);
  /* moving spotlights + cage mesh */
  ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<3;i++){const a=Math.sin(t*.02+i*2)*.35,x=150+i*250;const g=ctx.createLinearGradient(x,0,x+Math.sin(a)*300,VHw);g.addColorStop(0,'rgba(255,230,180,.16)');g.addColorStop(1,'rgba(255,230,180,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-10,0);ctx.lineTo(x+10,0);ctx.lineTo(x+Math.sin(a)*300+110,VHw);ctx.lineTo(x+Math.sin(a)*300-110,VHw);ctx.fill()}ctx.restore();
  ctx.strokeStyle='rgba(120,130,150,.12)';ctx.lineWidth=1.5;ctx.beginPath();for(let x=-400;x<1200;x+=34){ctx.moveTo(x,0);ctx.lineTo(x+VHw,VHw);ctx.moveTo(x+VHw,0);ctx.lineTo(x,VHw)}ctx.stroke();
  const fs=Math.min(1,VHw/450);if(fs<1){ctx.translate(400*(1-fs),0);ctx.scale(fs,fs)}else ctx.translate(0,oy);const oy2=fs<1?0:oy;
  const ez=x=>{x=clamp(x,0,1);return 1-Math.pow(1-x,3)},A=o.a,B=o.b,ra=o.ra,rb=o.rb;
  /* 1) slam: "ROUND N END" */
  {const k=ez(t/14),out=clamp((t-150)/14,0,1);ctx.save();ctx.globalAlpha=1-out;ctx.translate(400,60);ctx.scale(1.8-.8*k,1.8-.8*k);ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.font='16px "Black Han Sans",sans-serif';ctx.fillStyle='#e8b33a';ctx.globalAlpha=k*(1-out);ctx.fillText('IRON CAGE · ROUND IN REVIEW',0,-34);
   ctx.font='52px "Black Han Sans",sans-serif';ctx.lineWidth=8;ctx.strokeStyle='rgba(0,0,0,.6)';ctx.strokeText(`${o.round}라운드 종료`,0,6);ctx.fillStyle='#fff';ctx.fillText(`${o.round}라운드 종료`,0,6);ctx.restore()}
  /* 2) stat bars, one after another */
  const rows=[['유효타',ra.sigL,rb.sigL],['녹다운',ra.kd,rb.kd],['테이크다운',ra.td,rb.td],['컨트롤(초)',Math.round((ra.ctrl||0)/60),Math.round((rb.ctrl||0)/60)],['데미지',Math.round(ra.dH+ra.dB+ra.dL),Math.round(rb.dH+rb.dB+rb.dL)]];
  const top=142,colA=A.corner||'#3d7ff0',colB=B.corner||'#e04a3a';
  {const k=ez((t-10)/16);ctx.globalAlpha=k;ctx.fillStyle='rgba(8,10,14,.82)';ctx.beginPath();ctx.roundRect(150,top-34,500,rows.length*38+44,10);ctx.fill();
   ctx.textBaseline='middle';ctx.font='700 15px "IBM Plex Sans KR",sans-serif';ctx.textAlign='left';ctx.fillStyle=colA;ctx.fillText(A.nick,168,top-14);ctx.textAlign='right';ctx.fillStyle=colB;ctx.fillText(B.nick,632,top-14);ctx.globalAlpha=1}
  rows.forEach(([lab,va,vb],i)=>{const k=ez((t-22-i*12)/18);if(k<=0)return;const y=top+14+i*38,tot=Math.max(1,va+vb),wa=150*va/tot*k,wb=150*vb/tot*k;
    ctx.globalAlpha=k;ctx.textAlign='center';ctx.font='600 12px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#aab3c2';ctx.fillText(lab,400,y-11);
    ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(240,y,150,10);ctx.fillRect(410,y,150,10);
    ctx.fillStyle=colA;ctx.fillRect(390-wa,y,wa,10);ctx.fillStyle=colB;ctx.fillRect(410,y,wb,10);
    ctx.font='22px "Black Han Sans",sans-serif';ctx.fillStyle=va>vb?'#fff':'#8a93a2';ctx.textAlign='right';ctx.fillText(String(va),228,y+5);ctx.fillStyle=vb>va?'#fff':'#8a93a2';ctx.textAlign='left';ctx.fillText(String(vb),572,y+5);ctx.globalAlpha=1});
  /* 3) who took the round + next-round card flip */
  {const k=ez((t-96)/16);if(k>0){const w=o.lead,y=top+rows.length*38+40;ctx.globalAlpha=k;ctx.textAlign='center';ctx.font='700 14px "IBM Plex Sans KR",sans-serif';
    ctx.fillStyle=w==='a'?colA:w==='b'?colB:'#e8b33a';ctx.fillText(w==='a'?`이번 라운드 우세 · ${A.nick}`:w==='b'?`이번 라운드 우세 · ${B.nick}`:'이번 라운드 · 팽팽한 접전',400,y);ctx.globalAlpha=1}}
  {const k=ez((t-130)/18);if(k>0){ctx.save();ctx.translate(400,fs<1?225:VHw/2-oy2);ctx.scale(1,Math.max(.02,k));ctx.globalAlpha=Math.min(1,k*1.5);
    ctx.fillStyle='#0b0d12';ctx.strokeStyle='#e8b33a';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(-120,-70,240,140,10);ctx.fill();ctx.stroke();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#e8b33a';ctx.font='18px "Black Han Sans",sans-serif';ctx.fillText('ROUND',0,-36);ctx.fillStyle='#fff';ctx.font='84px "Black Han Sans",sans-serif';ctx.fillText(String(o.round+1),0,16);ctx.restore()}}
  ctx.textAlign='center';ctx.font='600 11px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='rgba(255,255,255,.45)';ctx.fillText('화면을 누르면 코너로',400,434);
  ctx.restore();
}
/* between rounds, broadcast view: you on the stool, the cutman icing your neck, the coach leaning in with his back to the camera,
   and an injury card telling you what to attack (their injuries) or protect (yours) */
function cornerUFC(c,cw,ch,t,o){
  ctx=c;const VHw=800*ch/cw,sWH=WH,sHH=HH;WH=800;HH=VHw;ctx.save();ctx.clearRect(0,0,800,VHw);
  try{
  const me=o.me||{},hurt=clamp(1-Math.min(me.head??100,me.body??100)/100,0,1),br=Math.sin(t*.09)*(2+hurt*3);
  closeBg(t,null);
  /* cage behind: padded top rail and a corner post */
  ctx.fillStyle='#07080b';ctx.fillRect(0,VHw*.6,800,14);ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(0,VHw*.6,800,3);
  {const px=690;const g=ctx.createLinearGradient(px-22,0,px+22,0);g.addColorStop(0,'#0b0c10');g.addColorStop(.5,'#1d2028');g.addColorStop(1,'#0b0c10');ctx.fillStyle=g;ctx.fillRect(px-22,0,44,VHw);
    ctx.save();ctx.translate(px,VHw*.3);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.textBaseline='middle';disp('IRON CAGE',0,0,16,'#e8b33a','center');ctx.restore()}
  /* the fighter on the stool */
  const sc=VHw/118,fx=470,hy=VHw*.1+br;
  bust(me,fx,hy,sc,t,{mood:hurt>.45?'hurt':null,sweat:.75});
  /* cutman: arm in from the right holding an ice pack on the back of the neck */
  {const px=fx+27*sc,py=hy+(66+Math.sin(t*.05)*1.5)*sc,sx=840,sy=VHw*.72;
    const cap=(a,b,w,col)=>{ctx.strokeStyle=col;ctx.lineWidth=w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()};
    const el={x:(sx+px)/2+20,y:Math.max(sy,py)+18};cap({x:sx,y:sy},el,30,'#111317');cap(el,{x:px+14,y:py+6},22,'#6e4a32');
    ctx.save();ctx.translate(px,py);ctx.rotate(-.25);const g=ctx.createLinearGradient(-26,0,26,0);g.addColorStop(0,'#c9d6e6');g.addColorStop(.5,'#f4f8fc');g.addColorStop(1,'#aebdd1');ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(-26,-20,52,40,12);ctx.fill();
    ctx.strokeStyle='rgba(120,140,170,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-18,-6);ctx.lineTo(18,-10);ctx.moveTo(-18,6);ctx.lineTo(18,2);ctx.stroke();ctx.restore();
    ctx.fillStyle='#6e4a32';ctx.beginPath();ctx.ellipse(px+16,py+4,12,9,-.3,0,7);ctx.fill()}
  /* water bottle now and then */
  {const bt=(t%300)/300;if(bt>.55&&bt<.8){const k=Math.sin((bt-.55)/.25*Math.PI);ctx.save();ctx.translate(fx-60+k*30,hy+150*sc*.5-k*40);ctx.rotate(-.9);ctx.fillStyle='rgba(200,225,255,.7)';ctx.beginPath();ctx.roundRect(-10,-40,20,70,6);ctx.fill();ctx.fillStyle='#e8b33a';ctx.fillRect(-10,-8,20,14);ctx.fillStyle='#222';ctx.fillRect(-5,-50,10,10);ctx.restore()}}
  /* the coach, back to the camera, leaning in and talking */
  {const talk=o.talking?Math.sin(t*.5)*2:0,cx=200,hy2=VHw*.46+talk,shirt=(o.coach&&o.coach.walkShirt)||'#1f2a3a',hair=(o.coach&&o.coach.look&&o.coach.look.hair)||'#1a1410';
    ctx.save();ctx.translate(cx,0);ctx.rotate(.04+talk*.004);
    const g=ctx.createLinearGradient(-200,0,220,0);g.addColorStop(0,shade(shirt,.45));g.addColorStop(.55,shade(shirt,.8));g.addColorStop(1,shade(shirt,.5));ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(-230,VHw+10);ctx.bezierCurveTo(-220,VHw*.74,-150,VHw*.66,-60,VHw*.64);ctx.lineTo(70,VHw*.64);ctx.bezierCurveTo(160,VHw*.66,230,VHw*.76,250,VHw+10);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=2;for(let i=-6;i<7;i++){ctx.beginPath();ctx.moveTo(i*32,VHw*.68);ctx.lineTo(i*36,VHw);ctx.stroke()}
    ctx.fillStyle=shade('#c08a63',.55);ctx.beginPath();ctx.roundRect(-28,hy2+40,56,56,14);ctx.fill();
    const hg=ctx.createRadialGradient(-14,hy2-10,6,0,hy2,70);hg.addColorStop(0,shade(hair,1.5));hg.addColorStop(1,shade(hair,.7));ctx.fillStyle=hg;ctx.beginPath();ctx.ellipse(0,hy2,56,64,0,0,7);ctx.fill();
    ctx.fillStyle=shade('#c08a63',.6);ctx.beginPath();ctx.ellipse(-55,hy2+8,9,15,0,0,7);ctx.ellipse(55,hy2+8,9,15,0,0,7);ctx.fill();ctx.restore()}
  /* edges darken (and redden when hurt) */
  {const v=ctx.createRadialGradient(470,VHw/2,VHw*.3,470,VHw/2,VHw*1.05);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,`rgba(${Math.round(20+hurt*80)},0,0,${.5+hurt*.2})`);ctx.fillStyle=v;ctx.fillRect(0,0,800,VHw)}
  /* top: break clock + your status + plan */
  const sec=Math.max(0,Math.ceil(o.left||0));frost(330,12,140,38,12,.72);chrome(330,12,140,38,12,'#e8b33a');ctx.textBaseline='middle';num(`${o.round}R 종료 · 휴식`,400,24,9,'rgba(214,220,230,.8)','center');num(`0:${String(sec).padStart(2,'0')}`,400,40,16,'#fff','center');
  txt('화면을 탭하면 바로 다음 라운드',400,62,9.5,'rgba(255,255,255,.5)','center','700');
  {const bx=16,by=14;frost(bx,by,170,58,12,.6);ctx.textBaseline='middle';txt('내 상태',bx+12,by+14,10,'#e8b33a','left','800');[['머리',me.head],['몸통',me.body],['다리',me.legs]].forEach(([l,v],i)=>{const yy=by+28+i*10;txt(l,bx+12,yy,9,'rgba(220,226,236,.8)','left','700');ctx.fillStyle='rgba(255,255,255,.1)';ctx.fillRect(bx+44,yy-3,112,5);const vv=clamp((v??100)/100,0,1);ctx.fillStyle=vv<.3?'#ff6b5e':vv<.55?'#ffd54a':'#4f8ff7';ctx.fillRect(bx+44,yy-3,112*vv,5)})}
  if(o.plan){const pn={press:'압박',wrestle:'레슬링',safe:'안전하게'}[o.plan];if(pn){frost(614,14,170,30,10,.7);ctx.textBaseline='middle';txt('작전',626,30,10,'#e8b33a','left','800');txt(pn,666,30,13,'#fff','left','800')}}
  /* bottom-left: the coach's words */
  const L=o.lines||[],ln=L[Math.min(o.li||0,L.length-1)]||'',tips=o.tips||[],w=tips.length?430:620,x=16,y=VHw-74;
  if(ln){frost(x,y,w,58,12,.8);ctx.fillStyle='#e8b33a';ctx.fillRect(x,y+10,4,38);ctx.textBaseline='alphabetic';txt('코치',x+16,y+18,11,'#e8b33a','left','800');
    ctx.font='700 14px "IBM Plex Sans KR",sans-serif';const ls=wrapText(ln.slice(0,o.typed??ln.length),w-32);ls.slice(0,2).forEach((l,i)=>txt(l,x+16,y+36+i*17,14,'#fff','left','700'))}
  /* bottom-right: injury card, cycling if there are several */
  if(tips.length){const i=Math.floor(t/240)%tips.length,lt=t%240,a=tips.length>1?Math.min(1,lt/12)*clamp((240-lt)/12,0,1):Math.min(1,t/12),cw2=330;
    ctx.font='700 11.5px "IBM Plex Sans KR",sans-serif';const T=IC.Fight.INJT[tips[i].k],h=44+wrapText(tips[i].mine?T.def:T.atk,cw2-30).length*16;injuryCard(800-cw2-14,VHw-h-16,cw2,tips[i].k,tips[i].mine,a)}
  }finally{ctx.restore();WH=sWH;HH=sHH}}
function cornerPOV(c,cw,ch,t,o){
  ctx=c;const VHw=800*ch/cw,cx=400;ctx.save();ctx.clearRect(0,0,800,VHw);
  const me=o.me||{},hurt=clamp(1-Math.min(me.head??100,me.body??100)/100,0,1),bob=Math.sin(t*.09)*(4+hurt*5),sway=Math.sin(t*.045)*3;
  ctx.translate(sway,bob);
  /* out-of-focus arena: lights, crowd bokeh, the cage right behind the coach */
  const bg=ctx.createLinearGradient(0,0,0,VHw);bg.addColorStop(0,'#14161d');bg.addColorStop(.6,'#0c0d12');bg.addColorStop(1,'#07080b');ctx.fillStyle=bg;ctx.fillRect(-20,-20,840,VHw+40);
  for(let i=0;i<60;i++){const x=((i*137)%860)-30,y=(i*71)%(VHw*.6),r=6+(i*13)%16,cl=['255,210,140','140,180,255','255,255,255','255,120,90'][i%4];const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${cl},${.10+.08*Math.sin(t*.03+i)})`);g.addColorStop(1,`rgba(${cl},0)`);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
  {const g=ctx.createRadialGradient(cx,-40,10,cx,-40,VHw);g.addColorStop(0,'rgba(255,236,200,.22)');g.addColorStop(1,'rgba(255,236,200,0)');ctx.fillStyle=g;ctx.fillRect(0,0,800,VHw)}
  ctx.save();ctx.strokeStyle='rgba(60,66,78,.55)';ctx.lineWidth=5;ctx.filter='blur(3px)';ctx.beginPath();for(let x=-200;x<1000;x+=46){ctx.moveTo(x,0);ctx.lineTo(x+VHw*.8,VHw);ctx.moveTo(x+VHw*.8,0);ctx.lineTo(x,VHw)}ctx.stroke();ctx.filter='none';ctx.restore();
  ctx.fillStyle='#0b0c10';ctx.fillRect(0,VHw*.18,800,10);
  /* across the cage: the other guy on his stool with his team around him, out of focus */
  {const ox=640,oy=VHw*.36,oc=(o.opp&&o.opp.corner)||'#e04a3a';ctx.save();ctx.globalAlpha=.55;
    ctx.fillStyle='rgba(20,22,28,.9)';ctx.fillRect(ox-70,oy+30,140,10);
    for(const [dx,dy,r,col] of [[-46,8,16,'#1b1d22'],[48,4,17,'#1b1d22'],[0,22,19,oc]]){ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(ox+dx,oy+dy+34,r*1.25,r*1.6,0,0,7);ctx.fill();ctx.fillStyle=col===oc?'#b98562':'#2a2420';ctx.beginPath();ctx.arc(ox+dx,oy+dy,r*.62,0,7);ctx.fill()}
    const tw=Math.sin(t*.4)*14;ctx.fillStyle='rgba(240,240,240,.85)';ctx.beginPath();ctx.ellipse(ox-30+tw,oy+10,12,6,tw*.03,0,7);ctx.fill();ctx.restore()}
  /* the coach: leaning in, talking, one hand pointing */
  const talk=o.talking?Math.abs(Math.sin(t*.55))*.8+.2:0,lean=Math.sin(t*.07)*4;
  ctx.save();const cs=Math.min(3.1,VHw/118);ctx.translate(cx+30+lean,VHw*.4+207*cs);ctx.scale(cs,cs);drawFront(o.coach,t,{perf:'coach',pt:t,talk,bare:true});ctx.restore();
  /* cutman's hand with the enswell when cut, the bottle coming in from the left */
  const bt=(t%260)/260;if(bt<.35){const k=Math.sin(bt/.35*Math.PI);ctx.save();ctx.translate(-30+k*170,VHw*.62-k*30);ctx.rotate(.5-k*.3);const g=ctx.createLinearGradient(-14,0,14,0);g.addColorStop(0,'rgba(120,180,255,.5)');g.addColorStop(.5,'rgba(220,240,255,.75)');g.addColorStop(1,'rgba(120,180,255,.45)');ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(-16,-60,32,110,10);ctx.fill();ctx.fillStyle='#1d2430';ctx.fillRect(-9,-74,18,16);ctx.fillStyle='#e8b33a';ctx.fillRect(-16,-10,32,20);ctx.restore()}
  /* cutman working on your face: his hand presses the cold enswell over the cut (seen from your eyes: big, out of focus, top-left) */
  if((me.cuts||0)>=2){const k=.5+.5*Math.sin(t*.06),x=150+k*26,y=150+k*14;ctx.save();ctx.translate(x,y);ctx.rotate(.55);ctx.scale(1.25,1.25);
    ctx.fillStyle='#6e4a32';ctx.beginPath();ctx.ellipse(-60,-40,70,46,.3,0,7);ctx.fill();
    const g=ctx.createLinearGradient(-30,0,60,0);g.addColorStop(0,'#5d636e');g.addColorStop(.5,'#d9dee6');g.addColorStop(1,'#7a808b');ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(-20,-24,120,48,18);ctx.fill();ctx.restore()}
  /* towel fanning you from below */
  {const f=Math.sin(t*.35),y=VHw-20+Math.abs(f)*-26;ctx.save();ctx.translate(400+f*90,y);ctx.rotate(f*.35);ctx.fillStyle='rgba(235,235,232,.92)';ctx.beginPath();ctx.moveTo(-110,10);ctx.quadraticCurveTo(0,-36-Math.abs(f)*14,110,10);ctx.lineTo(110,60);ctx.lineTo(-110,60);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(180,180,175,.6)';ctx.lineWidth=2;for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(i*28,0);ctx.lineTo(i*30,58);ctx.stroke()}ctx.restore()}
  /* your own gloves, resting low in the bottom corners, rising with your breathing */
  for(const s of [-1,1]){const gx=cx+s*290,gy=VHw-30+Math.sin(t*.09+s)*6;ctx.save();ctx.translate(gx,gy);ctx.rotate(s*-.45);const g=ctx.createRadialGradient(-10,-18,4,0,0,90);g.addColorStop(0,'#4b4f58');g.addColorStop(.6,'#1a1c21');g.addColorStop(1,'#08090b');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,78,96,0,0,7);ctx.fill();ctx.fillStyle=me.corner||'#3d7ff0';ctx.fillRect(-60,50,120,26);ctx.fillStyle='rgba(255,255,255,.12)';ctx.beginPath();ctx.ellipse(-20,-40,30,14,-.4,0,7);ctx.fill();ctx.restore()}
  ctx.restore();
  /* blurry / bloody edges when hurt, pulsing with the heartbeat */
  if(hurt>.3){const hb=Math.max(0,Math.sin(t*.22))**8*hurt*.25;ctx.fillStyle=`rgba(120,0,0,${hb})`;ctx.fillRect(0,0,800,VHw)}
  const v=ctx.createRadialGradient(400,VHw/2,VHw*.25,400,VHw/2,VHw*.95);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,`rgba(${Math.round(30+hurt*90)},0,0,${.55+hurt*.25})`);ctx.fillStyle=v;ctx.fillRect(0,0,800,VHw);
  /* top: round break clock */
  const sec=Math.max(0,Math.ceil(o.left||0));frost(330,12,140,38,12,.72);chrome(330,12,140,38,12,'#e8b33a');ctx.textBaseline='middle';num(`${o.round}R 종료 · 휴식`,400,24,9,'rgba(214,220,230,.8)','center');num(`0:${String(sec).padStart(2,'0')}`,400,40,16,'#fff','center');
  /* mini status: your body */
  {const bx=16,by=14;frost(bx,by,170,58,12,.6);txt('내 상태',bx+12,by+14,10,'#e8b33a','left','800');[['머리',me.head],['몸통',me.body],['다리',me.legs]].forEach(([l,v],i)=>{const yy=by+28+i*10;txt(l,bx+12,yy,9,'rgba(220,226,236,.8)','left','700');ctx.fillStyle='rgba(255,255,255,.1)';ctx.fillRect(bx+44,yy-3,112,5);const vv=clamp((v??100)/100,0,1);ctx.fillStyle=vv<.3?'#ff6b5e':vv<.55?'#ffd54a':'#4f8ff7';ctx.fillRect(bx+44,yy-3,112*vv,5)})}
  /* subtitle: the coach's words */
  /* last round in numbers */
  if(o.stats){const S2=o.stats,bx=614,by=o.plan?50:14,rows=[['유효타',S2.a.sigL||0,S2.b.sigL||0],['머리',S2.a.headL||0,S2.b.headL||0],['테이크다운',S2.a.td||0,S2.b.td||0]];frost(bx,by,170,18+rows.length*15,10,.68);ctx.textBaseline='middle';
    txt(`${o.round}R 기록`,bx+10,by+10,9.5,'#e8b33a','left','800');txt('나 · 상대',bx+160,by+10,8.5,'rgba(214,220,230,.6)','right','700');
    rows.forEach(([l,a,b],i)=>{const yy=by+24+i*15;txt(l,bx+10,yy,9.5,'rgba(220,226,236,.85)','left','700');num(String(a),bx+118,yy,11,a>b?'#8fb8ff':'#fff','right');num(String(b),bx+160,yy,11,b>a?'#ffaaa0':'#fff','right')})}
  const tips=o.tips||[];
  if(tips.length){const i=Math.floor(t/240)%tips.length,lt=t%240,a=tips.length>1?Math.min(1,lt/12)*clamp((240-lt)/12,0,1):Math.min(1,t/12),cw2=320,sWH=WH,sHH=HH;WH=800;HH=VHw;
    ctx.font='700 11.5px "IBM Plex Sans KR",sans-serif';const T=IC.Fight.INJT[tips[i].k],h=44+wrapText(tips[i].mine?T.def:T.atk,cw2-30).length*16;injuryCard(800-cw2-14,VHw-h-24,cw2,tips[i].k,tips[i].mine,a);WH=sWH;HH=sHH}
  const L=o.lines||[],ln=L[Math.min(o.li||0,L.length-1)]||'';if(ln){const w=tips.length?430:640,x=tips.length?16:400-w/2,y=VHw-92;frost(x,y,w,58,14,.78);ctx.fillStyle='#e8b33a';ctx.fillRect(x,y+10,4,38);
    txt('코치',x+18,y+18,11,'#e8b33a','left','800');ctx.font='700 15px "IBM Plex Sans KR",sans-serif';let s=ln.slice(0,o.typed??ln.length);ctx.fillStyle='#fff';ctx.textAlign='left';
    const words=[...s];let line1='',line2='';for(const ch2 of words){if(ctx.measureText(line1+ch2).width<w-40&&!line2)line1+=ch2;else line2+=ch2}ctx.fillText(line1,x+18,y+36);if(line2)ctx.fillText(line2,x+18,y+52)}
  if(o.plan){const pn={press:'압박',wrestle:'레슬링',safe:'안전하게'}[o.plan];if(pn){frost(614,14,170,30,10,.7);txt('작전',626,30,10,'#e8b33a','left','800');txt(pn,666,30,13,'#fff','left','800')}}
  txt('화면을 탭하면 바로 다음 라운드',400,VHw-14,10,'rgba(255,255,255,.45)','center','700');
  ctx.restore()}
/* ---------- intro prelude: the last 10 seconds of a title fight — the player taps to throw the finishing overhand ---------- */
const KOI={hit:9,end:170};
function koScene(c,cw,ch,p,d,opp,hit,o={}){
  ctx=c;const VHw=800*ch/cw;ctx.save();ctx.clearRect(0,0,800,VHw);const oy=(VHw-450)/2;
  const k=hit==null?-1:p-hit,H=KOI.hit,imp=k>=H;
  /* slow motion around the impact */
  const kk=k<H?k:k<H+34?H+(k-H)*.3:H+34*.3+(k-H-34);
  const zoom=1.05+(k>=0?.2*ez(k/(H+2)):0)-(k>H+30?.17*ez((k-H-30)/40):0);
  const sh=imp&&k<H+26?(H+26-k)*.7:0;
  ctx.save();ctx.translate(Math.sin(p*7.3)*sh,Math.cos(p*5.1)*sh);
  beltArena(p,VHw,oy,{pre:true,zoom,flash:imp&&k<80?3:1});
  const CX=400,ft=(dd,side,x,f)=>({look:dd.look,corner:side==='b'?'#e04a3a':'#3d7ff0',head:100,body:100,legs:100,cuts:side==='b'?3:1,rocked:0,flash:0,state:'idle',st:55,side,x,f,z:0,_t:p,kind:'fighter',t:0,A:null,react:null,walk:0,stance:'orth',d:dd});
  const A=ft(d,'a',CX-58,1),Bf=ft(opp,'b',CX+58,-1),SS={frame:p,cl:null};
  if(k<0){Bf.rocked=1;Bf.st=8;A.x+=Math.sin(p*.05)*6}
  else{
    if(kk<30){A.state='attack';A.A={anim:'overhand',w:7,a:4,r:18,kind:'punch'};A.t=kk}else A.state=k>H+60?'celebrate':'idle';
    if(imp){Bf.react={k:'big',t:Math.min(30,(kk-H)),up:true};Bf.state='hit';Bf.t=kk-H;Bf.flash=k<H+4?1:0}
    if(kk>=H+16){Bf.state='ko';Bf.koT=Math.min(40,(kk-H-16)*1.6)}
  }
  /* referee rushes in to wave it off */
  if(imp){const rk=ez((k-H-10)/34);wiPerson(lerp(860,CX+262,rk),-1,p,{shirt:'#111317',skin:'#c99472',hair:'#1f1814',hs:'short',moving:rk<1,state:rk>=1?'stop':'idle'})}
  for(const F of [Bf,A]){shadowAt(F.x,52);const J=poseStand(F,F===A?Bf:A,SS);ctx.save();
    const r=drawBody(F,F.state==='ko'?(F.koK=F.koK||'back',koPose(F,J,p)):J);ctx.restore();
    /* glove trail on the overhand */
    if(F===A&&A.state==='attack'&&kk>3&&kk<16){const h=r.handF;ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<6;i++){ctx.globalAlpha=.12*(6-i);ctx.fillStyle='#fff6e0';ctx.beginPath();ctx.arc(h.x-i*7,h.y-i*5,9-i,0,7);ctx.fill()}ctx.restore()}
    if(F===Bf)F._head=r.head}
  /* impact burst: star, rings, sweat spray */
  if(imp&&k<H+40){const hx=(Bf._head||{x:CX+50}).x,hy=(Bf._head||{y:190}).y,q=(k-H)/40;ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<3;i++){const rr=20+q*(120+i*60);ctx.strokeStyle=`rgba(255,240,200,${(1-q)*(.8-i*.2)})`;ctx.lineWidth=4*(1-q)+1;ctx.beginPath();ctx.arc(hx,hy,rr,0,7);ctx.stroke()}
    ctx.fillStyle=`rgba(255,250,230,${1-q})`;ctx.beginPath();for(let i=0;i<16;i++){const a=i/16*Math.PI*2,rr=i%2?14:46*(1-q*.5);ctx.lineTo(hx+Math.cos(a)*rr,hy+Math.sin(a)*rr)}ctx.fill();
    for(let i=0;i<34;i++){const a=-Math.PI*.15+((i*0.618)%1-.5)*1.9,v=3+((i*37)%10)*.6,dd=(k-H)*v*.9;ctx.fillStyle=`rgba(200,225,255,${(1-q)*.8})`;ctx.beginPath();ctx.arc(hx+Math.cos(a)*dd,hy+Math.sin(a)*dd+q*q*30,2.2,0,7);ctx.fill()}
    ctx.restore()}
  ctx.restore();
  /* speed lines toward the impact during the wind-up */
  if(k>=2&&k<H+10){const q=1-Math.abs(k-H)/10;ctx.save();ctx.globalAlpha=Math.max(0,q)*.5;ctx.strokeStyle='#fff';for(let i=0;i<40;i++){const a=i/40*Math.PI*2+i,r0=280+((i*53)%120);ctx.lineWidth=1+(i%3);ctx.beginPath();ctx.moveTo(400+Math.cos(a)*r0,VHw/2+Math.sin(a)*r0);ctx.lineTo(400+Math.cos(a)*(r0+260),VHw/2+Math.sin(a)*(r0+260));ctx.stroke()}ctx.restore()}
  /* letterbox during slow motion */
  const lb=imp?ez((k-H)/6)*ez((H+70-k)/12):0;if(lb>0){ctx.fillStyle='#000';ctx.fillRect(0,0,800,VHw*.11*lb);ctx.fillRect(0,VHw*(1-.11*lb),800,VHw*.11*lb)}
  if(imp&&k<H+8){ctx.fillStyle=`rgba(255,255,255,${.9*(1-(k-H)/8)})`;ctx.fillRect(0,0,800,VHw)}
  ctx.save();ctx.textBaseline='middle';const TOP=Math.max(8,VHw*.04),BOT=VHw;
  /* broadcast HUD before the finish: round clock and HP bars, opponent nearly out */
  const hudA=k<0?1:clamp(1-(k-H)/10,0,1);if(hudA>0){ctx.globalAlpha=hudA;
    const sec=Math.max(1,10-Math.floor(p/60*1.35));ctx.save();ctx.translate(0,TOP-14);frost(340,14,120,34,12,.72);chrome(340,14,120,34,12,'#e8b33a');num('R5',362,31,13,'#e8b33a','center');num(`0:${String(sec).padStart(2,'0')}`,420,31,19,sec<=3?'#ff6b5e':'#fff','center');
    const bar=(x,al,nm,v,col,blink)=>{frost(x,16,240,30,10,.7);txt(nm,al?x+12:x+228,25,10,'#fff',al?'left':'right','800');ctx.fillStyle='rgba(255,255,255,.1)';ctx.fillRect(x+12,34,216,6);const w=216*v;ctx.fillStyle=blink&&Math.floor(p/8)%2?'#ff3b2e':col;if(al)ctx.fillRect(x+12,34,w,6);else ctx.fillRect(x+228-w,34,w,6)};
    bar(90,true,`"${d.nick}"`,.62,'#3d7ff0');bar(470,false,`"${opp.nick}"`,.07,'#e04a3a',true);ctx.restore();ctx.globalAlpha=1}
  /* tap prompt */
  if(k<0){const pu=.5+.5*Math.sin(p*.18),y=BOT-62;ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<2;i++){const q=((p*.02+i*.5)%1);ctx.strokeStyle=`rgba(232,179,58,${(1-q)*.8})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(400,y,26+q*60,0,7);ctx.stroke()}ctx.restore();
    ctx.save();ctx.translate(400,y);ctx.scale(1+pu*.08,1+pu*.08);ctx.font='44px "Black Han Sans",sans-serif';ctx.textAlign='center';ctx.lineWidth=8;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText('TAP!',0,-4);
    const g=ctx.createLinearGradient(0,-26,0,18);g.addColorStop(0,'#fff6d0');g.addColorStop(.5,'#f0b93a');g.addColorStop(1,'#a8741a');ctx.fillStyle=g;ctx.fillText('TAP!',0,-4);ctx.restore();
    txt('화면을 터치해 마지막 한 방을 꽂아라',400,y+34,13,'#fff','center','800');
    if(p<70){ctx.globalAlpha=ez(1-(p-40)/30);txt('챔피언십 5라운드 · 마지막 10초',400,TOP+58,15,'#e8b33a','center','800');ctx.globalAlpha=1}}
  /* K.O. slam */
  if(k>=H+6){const q=ez((k-H-6)/10),s=lerp(3.2,1,q),wob=k<H+22?Math.sin(k*2.3)*(H+22-k)*.4:0;ctx.save();ctx.translate(400+wob,VHw*.2);ctx.scale(s*.78,s*.78);ctx.globalAlpha=Math.min(1,q*1.5)*clamp((KOI.end-k)/12,0,1);
    ctx.font='120px "Black Han Sans",sans-serif';ctx.textAlign='center';ctx.lineWidth=14;ctx.strokeStyle='rgba(0,0,0,.8)';ctx.strokeText('K.O.',0,0);
    const g=ctx.createLinearGradient(0,-60,0,40);g.addColorStop(0,'#ffffff');g.addColorStop(.38,'#ffe08a');g.addColorStop(.55,'#c8861a');g.addColorStop(1,'#ffe9a8');ctx.fillStyle=g;ctx.fillText('K.O.',0,0);
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha*=.35+.3*Math.sin(k*.3);ctx.fillStyle='#fff';ctx.fillText('K.O.',0,0);ctx.restore();
    if(k>H+30){ctx.globalAlpha=ez((k-H-30)/16)*clamp((KOI.end-k)/12,0,1);txt(`5라운드 0:0${Math.max(1,10-Math.floor(hit/60*1.35))} · 오버핸드 라이트`,400,VHw*.2+58,15,'#fff','center','800');txt('새 챔피언이 탄생하는 순간!',400,VHw*.2+80,13,'#e8b33a','center','800');ctx.globalAlpha=1}}
  ctx.restore();
  /* fade to white into the belt ceremony */
  if(k>KOI.end-14){ctx.fillStyle=`rgba(255,255,255,${ez((k-KOI.end+14)/14)})`;ctx.fillRect(0,0,800,VHw)}
  const vg=ctx.createRadialGradient(400,VHw/2,VHw*.35,400,VHw/2,720);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.55)');ctx.fillStyle=vg;ctx.fillRect(0,0,800,VHw);
  ctx.restore()}
function beltArena(t,VHw,oy,q={}){
  // ---- arena wide shot ----
  const bg=ctx.createRadialGradient(400,VHw*.4,40,400,VHw*.5,700);bg.addColorStop(0,'#2a2416');bg.addColorStop(1,'#07080b');ctx.fillStyle=bg;ctx.fillRect(0,0,800,VHw);
  ctx.translate(0,oy);
  const B=BELT,lift=!q.pre&&t>=B.lift,lk=ez((t-B.lift)/50);
  // slow camera push
  const zz=q.zoom!=null?q.zoom:t<B.close?1+.06*ez(t/B.close):lift?1.03+.03*ez((t-B.lift)/260):1.03;ctx.translate(400,300);ctx.scale(zz,zz);ctx.translate(-400,-300);
  // crowd bowl
  for(let r=0;r<4;r++)for(let i=0;i<46;i++){const x=(i*19+r*9)%830-15,y=150+r*26+((i*13)%9),j=Math.max(0,Math.sin(t*(lift?.35:.2)+i+r))*(lift?9:4);ctx.fillStyle=['#0e1014','#121419','#15171d','#191b21'][r];ctx.beginPath();ctx.arc(x,y-j,7+r,0,7);ctx.fill();ctx.fillRect(x-8-r,y+5-j,16+r*2,24)
    if(lift&&(i+r)%7===0&&Math.sin(t*.3+i)>0){ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-6,y+4-j);ctx.lineTo(x-10,y-14-j);ctx.moveTo(x+6,y+4-j);ctx.lineTo(x+10,y-14-j);ctx.stroke()}}
  // phone lights / flashes
  for(let i=0;i<26;i++){const x=(i*61)%800,y=158+(i*37)%90;if(Math.sin(t*.07+i*2.3)>.4){ctx.fillStyle='rgba(220,235,255,.65)';ctx.fillRect(x,y,2,3)}}
  const fl=q.pre?(q.flash||1):lift?3:t>B.reveal?2:1;for(let n=0;n<fl;n++)if(((t*7+n*29)%23)<2){const x=60+((t*53+n*211)%680),y=170+((t*31+n*97)%80);const g=ctx.createRadialGradient(x,y,0,x,y,44);g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(x-44,y-44,88,88)}
  // cage fence behind
  ctx.save();ctx.strokeStyle='rgba(30,34,42,.75)';ctx.lineWidth=1;ctx.beginPath();for(let x=-20;x<840;x+=14){ctx.moveTo(x,236);ctx.lineTo(x+60,GY-34);ctx.moveTo(x+60,236);ctx.lineTo(x,GY-34)}ctx.stroke();
  ctx.fillStyle='#0b0d11';ctx.fillRect(-20,228,840,9);for(const px of [40,250,550,760]){ctx.fillStyle='#14171c';ctx.fillRect(px-5,228,10,GY-34-228);ctx.fillStyle='#2a2f38';ctx.fillRect(px-5,228,3,GY-34-228)}
  ctx.fillStyle='#10131a';ctx.fillRect(-20,GY-40,840,10);ctx.restore();
  // canvas floor + logo
  ctx.fillStyle='#4a5160';ctx.beginPath();ctx.ellipse(400,GY+12,440,64,0,0,7);ctx.fill();ctx.strokeStyle='rgba(232,179,58,.35)';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(400,GY+12,190,26,0,0,7);ctx.stroke();
  ctx.fillStyle='rgba(232,179,58,.22)';ctx.font='bold 26px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.save();ctx.translate(400,GY+16);ctx.scale(1,.28);ctx.fillText('IRON CAGE',0,0);ctx.restore();
  // spotlights
  ctx.save();ctx.globalCompositeOperation='lighter';
  const beam=(x0,ang,col)=>{ctx.save();ctx.translate(x0,-40);ctx.rotate(ang);const g=ctx.createLinearGradient(0,0,0,480);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(8,0);ctx.lineTo(90,480);ctx.lineTo(-90,480);ctx.fill();ctx.restore()};
  beam(380,0,'rgba(255,220,140,.26)');
  if(q.pre||t>B.reveal){const sw=lift?.9:.45;beam(60,-.55+Math.sin(t*.02)*.22*sw,'rgba(120,170,255,.14)');beam(740,.55-Math.sin(t*.023)*.22*sw,'rgba(255,120,100,.13)')}
  ctx.restore();
}
function beltScene(c,cw,ch,t,d,cls,o={}){
  ctx=c;const VHw=800*ch/cw,B=BELT;ctx.save();ctx.clearRect(0,0,800,VHw);
  const oy=(VHw-450)/2;
  // ---- stage 2: belt close-up ----
  if(t>=B.close&&t<B.wrap){const k=(t-B.close)/(B.wrap-B.close);
    const bg=ctx.createRadialGradient(400,VHw/2,30,400,VHw/2,620);bg.addColorStop(0,o.kc?'#1c2230':'#3a0d10');bg.addColorStop(.6,o.kc?'#090b10':'#160406');bg.addColorStop(1,'#020203');ctx.fillStyle=bg;ctx.fillRect(0,0,800,VHw);
    ctx.translate(0,oy);
    // light rays behind
    ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<14;i++){const a=i/14*Math.PI*2+t*.004;ctx.fillStyle=`rgba(255,210,120,${.035+.02*Math.sin(t*.05+i)})`;ctx.beginPath();ctx.moveTo(400,225);ctx.lineTo(400+Math.cos(a)*700,225+Math.sin(a)*700);ctx.lineTo(400+Math.cos(a+.12)*700,225+Math.sin(a+.12)*700);ctx.fill()}ctx.restore();
    const z=1+.14*ez(k);ctx.save();ctx.translate(400,232);ctx.scale(z,z);
    if(!o.kc&&BELTIMG&&BELTIMG.complete&&BELTIMG.naturalWidth){const sx=.86+.14*Math.cos(k*Math.PI*1.2-.6),bw=660,bh=bw*BELTIMG.naturalHeight/BELTIMG.naturalWidth;ctx.save();ctx.scale(sx,1);ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=30;ctx.shadowOffsetY=14;ctx.drawImage(BELTIMG,-bw/2,-6-bh/2,bw,bh);ctx.restore();
      const g=((t-B.close)%90)/90,gx=-bw/2+g*bw*1.4-bw*.2;ctx.save();ctx.globalCompositeOperation='lighter';const lg=ctx.createLinearGradient(gx-60,0,gx+60,0);lg.addColorStop(0,'rgba(255,240,200,0)');lg.addColorStop(.5,'rgba(255,240,200,.22)');lg.addColorStop(1,'rgba(255,240,200,0)');ctx.fillStyle=lg;ctx.beginPath();ctx.ellipse(0,-6,bw*.2*sx,bh*.45,0,0,Math.PI*2);ctx.fill();ctx.restore();ctx.restore()}
    else{drawBelt(0,-6,2.55,{sx:.86+.14*Math.cos(k*Math.PI*1.2-.6),glint:((t-B.close)%90)/90,cls:o.clsEn,kc:o.kc});ctx.restore()}
    for(let i=0;i<14;i++){const sx=150+((i*173)%500),sy=120+((i*97)%220),tw=Math.sin(t*.12+i*1.7);if(tw>.55)star(sx,sy,6+tw*6,(tw-.55)*2.2)}
    ctx.textAlign='center';ctx.textBaseline='middle';
    const ta=ez((t-B.close-25)/30)*ez((B.wrap-t)/20);ctx.globalAlpha=ta;ctx.font='700 14px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#e8b33a';ctx.fillText(o.kc?'IRON CAGE 슈퍼파이트':'IRON CAGE 월드 챔피언십',400,70);
    ctx.font='34px "Black Han Sans",sans-serif';ctx.fillStyle='#fff';ctx.fillText(o.kc?'킹 오브 케이지 벨트':`${cls} 챔피언 벨트`,400,385);
    ctx.font='600 12px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='rgba(255,255,255,.7)';ctx.fillText(o.kc?'블랙 다이아몬드 · 체급을 넘어선 단 한 명':'24K 도금 · 수제 가죽 · 루비 센터 스톤',400,414);ctx.globalAlpha=1;
    const fa=clamp(1-(t-B.close)/14,0,1);if(fa>0){ctx.fillStyle=`rgba(255,255,255,${fa})`;ctx.fillRect(-10,-oy,820,VHw)}
    ctx.restore();return}
  beltArena(t,VHw,oy,{});
  const lift=t>=B.lift,lk=ez((t-B.lift)/50);
  // ---- people ----
  const CX=350;
  // stage 1: announcement — ref between champ and opponent, raises hand on reveal
  if(t<B.close){
    const rv=t>=B.reveal;
    if(o.opp)ctx.save(),ctx.globalAlpha=1,wiFighter(o.opp,'b',500,-1,rv?'sad':'stand',t),ctx.restore();
    wiFighter(d,'a',CX,1,rv?'hand':'stand',t);
    wiPerson(424,-1,t,{shirt:'#111317',skin:'#c99472',hair:'#1f1814',hs:'short',state:rv?'raise':'idle'});
  }else{
    // stage 3/4: president with belt, team rushes in
    const wk=ez((t-B.wrap)/90),px=lerp(820,CX+64,wk),wrapped=t>=B.wrap+120;
    const teamK=ez((t-B.wrap-110)/70);
    if(teamK>0){wiPerson(lerp(-60,CX-140,teamK),1,t,{shirt:'#1f3a6e',skin:'#e0b08a',hair:'#2a1f1a',hs:'buzz',logo:'TEAM',moving:teamK<1,state:teamK>=1?'stop':'idle'});
      wiPerson(lerp(-120,CX-74,teamK),1,t+30,{shirt:'#1f3a6e',skin:'#a87250',hair:'#111',hs:'short',beard:true,logo:'TEAM',moving:teamK<1,state:teamK>=1?(lift?'stop':'raise'):'idle'})}
    const pose=lift?(lk<1?'hand':'over'):wrapped?'flex':'stand';
    if(!lift||lk<1)wiPerson(lift?lerp(px,px+80,lk):px,-1,t,{shirt:'#2a2d36',skin:'#ecc29c',hair:'#9a9a9a',hs:'short',logo:'IC',moving:wk<1||(lift&&lk<1),state:wrapped&&!lift?'watch':'raise'});
    wiFighter(d,'a',CX,1,lift&&lk>=1?'over':pose,t);
    if(!wrapped)drawBelt(px-8,GY-1.22*(GY-150)+4,.34,{cls:o.clsEn,kc:o.kc});
    else if(!lift)drawBelt(CX+2,GY-1.3*(GY-290),.33,{glint:((t)%120)/120,cls:o.clsEn,kc:o.kc});
    else{const yy=lerp(GY-1.3*(GY-290),GY-1.3*(GY-172),lk);drawBelt(CX+4,yy-Math.sin(t*.1)*2*lk,lerp(.33,.42,lk),{glint:((t)%100)/100,cls:o.clsEn,kc:o.kc})}
  }
  // pyro + confetti on lift
  if(lift){pyro(90,t,B.lift);pyro(710,t,B.lift+6);if(t-B.lift<16){ctx.fillStyle=`rgba(255,240,200,${.6*(1-(t-B.lift)/16)})`;ctx.fillRect(-60,-60,920,VHw+120)}}
  if(!CONF){CONF=[];for(let i=0;i<160;i++)CONF.push({x:Math.random()*840-20,y:-Math.random()*500,v:1+Math.random()*2,c:['#ffd75e','#ffffff','#e04a3a','#3d7ff0','#ffd75e'][i%5],a:Math.random()*6})}
  if(t>B.wrap+120){const n=lift?160:60;for(let i=0;i<n;i++){const p=CONF[i],y=((p.y+t*p.v*1.6)%540)-40;ctx.save();ctx.translate(p.x+Math.sin(t*.05+p.a)*12,y);ctx.rotate(t*.1+p.a);ctx.scale(1,Math.cos(t*.15+p.a));ctx.fillStyle=p.c;ctx.fillRect(-3,-1.5,6,3);ctx.restore()}}
  /* captions: on wide phones (screen shorter than the 450 stage) shrink the caption layer to fit instead of cutting its bottom off */
  ctx.restore();ctx.save();{const fs=Math.min(1,VHw/450);if(fs<1){ctx.translate(400*(1-fs),0);ctx.scale(fs,fs)}else ctx.translate(0,oy)}
  // ---- captions ----
  ctx.textAlign='center';ctx.textBaseline='middle';
  if(t<B.close){
    const lines=['레이디스 앤 젠틀맨…',o.kc?'IRON CAGE 슈퍼파이트의 승자는…':`IRON CAGE ${cls} 타이틀전의 승자는…`];const li=t<50?0:1;const a=ez(t/14);
    ctx.globalAlpha=a*(t<B.reveal?1:clamp(1-(t-B.reveal)/10,0,1));ctx.fillStyle='rgba(5,7,10,.78)';ctx.fillRect(140,382,520,44);ctx.fillStyle='#e8b33a';ctx.fillRect(140,382,4,44);
    ctx.font='700 16px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#fff';const s=lines[li],n=Math.min(s.length,Math.floor((t-(li?50:0))*.9));ctx.fillText(s.slice(0,n),400,404);ctx.globalAlpha=1;
    if(t>=B.reveal){const k=ez((t-B.reveal)/16),big=o.kc?(o.def?'STILL THE KING!':'KING OF THE CAGE!'):o.def?'AND STILL!':'AND NEW!';ctx.save();ctx.translate(400,82);ctx.scale(1.6-.6*k,1.6-.6*k);ctx.globalAlpha=k;ctx.font='54px "Black Han Sans",sans-serif';ctx.lineWidth=9;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText(big,0,0);ctx.fillStyle='#ffd75e';ctx.fillText(big,0,0);ctx.restore();
      ctx.globalAlpha=k;ctx.font='700 17px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#fff';ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.6)';const tx=`${o.def?'여전히 ':''}${o.kc?'킹 오브 케이지':cls+' 챔피언'} · "${d.nick}" ${d.name}`;ctx.strokeText(tx,400,124);ctx.fillText(tx,400,124);ctx.globalAlpha=1;
      if(t-B.reveal<10){ctx.fillStyle=`rgba(255,255,255,${.7*(1-(t-B.reveal)/10)})`;ctx.fillRect(-400,-300,1600,VHw+600)}}
  }else if(t<B.lift){const a=ez((t-B.wrap)/20);ctx.globalAlpha=a;ctx.fillStyle='rgba(5,7,10,.78)';ctx.fillRect(140,382,520,44);ctx.fillStyle='#e8b33a';ctx.fillRect(140,382,4,44);
    ctx.font='700 15px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#fff';ctx.fillText(t<B.wrap+120?'IRON CAGE 대표가 벨트를 들고 옥타곤에 오릅니다':'챔피언의 허리에 벨트가 감깁니다',400,404);ctx.globalAlpha=1;
    const fa=clamp(1-(t-B.wrap)/14,0,1);if(fa>0){ctx.fillStyle=`rgba(255,255,255,${fa})`;ctx.fillRect(-400,-300,1600,VHw+600)}}
  else{const k=ez((t-B.lift-40)/30);ctx.globalAlpha=k;
    ctx.textAlign='left';ctx.font='38px "Black Han Sans",sans-serif';ctx.lineWidth=8;ctx.strokeStyle='rgba(0,0,0,.7)';const big=o.def?`${o.def}차 방어 성공`:o.kc?'킹 오브 케이지 등극':'새 챔피언 탄생',bx=lerp(820,o.kc?400:470,k);ctx.strokeText(big,bx,150);ctx.fillStyle='#ffd75e';ctx.fillText(big,bx,150);ctx.font='700 13px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#fff';ctx.fillText(o.kc?'체급을 넘어선 최강자':`${cls} · IRON CAGE`,bx+2,182);
    const lx=lerp(-420,140,k);ctx.fillStyle='rgba(5,7,10,.85)';ctx.fillRect(lx,368,520,62);ctx.fillStyle='#e8b33a';ctx.fillRect(lx,368,520,4);
    ctx.textAlign='left';ctx.font='20px "Black Han Sans",sans-serif';ctx.fillStyle='#fff';ctx.fillText(`제${o.no||1}대 ${o.kc?'킹 오브 케이지':cls+' 챔피언'}  ${d.name}`,lx+16,392);
    ctx.font='600 12px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='rgba(255,255,255,.75)';ctx.fillText([o.rec,o.ev,o.how].filter(Boolean).join('  ·  '),lx+16,414);ctx.globalAlpha=1}
  ctx.restore();
  const vg=ctx.createRadialGradient(400,VHw/2,VHw*.35,400,VHw/2,720);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.5)');ctx.fillStyle=vg;ctx.fillRect(0,0,800,VHw);
}
/* 선수 초상 */
/* career hub: your fighter standing in the gym, breathing (UFC-career style home screen) */
let HUBBG=null;
function hubScene(canvas,d,t){
  const dpr=Math.min(2,window.devicePixelRatio||1),cw=canvas.clientWidth||300,ch=canvas.clientHeight||400;
  if(canvas.width!==Math.round(cw*dpr)||canvas.height!==Math.round(ch*dpr)){canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);HUBBG=null}
  ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  /* the gym is static: paint it once into a buffer */
  const key=cw+'x'+ch;if(!HUBBG||HUBBG.key!==key){const b=document.createElement('canvas');b.width=canvas.width;b.height=canvas.height;const s=ctx;ctx=b.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const wall=ctx.createLinearGradient(0,0,0,ch);wall.addColorStop(0,'#45484e');wall.addColorStop(.62,'#2c2e33');wall.addColorStop(1,'#1b1c20');ctx.fillStyle=wall;ctx.fillRect(0,0,cw,ch);
    ctx.fillStyle='#d4a032';ctx.fillRect(cw*.52,ch*.12,cw*.48,ch*.5);ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(cw*.52,ch*.12,cw*.48,ch*.03);
    /* windows with daylight */
    for(let i=0;i<3;i++){const x=cw*(.58+i*.13),w=cw*.1,y=ch*.04,h=ch*.12;ctx.fillStyle='#e9eef5';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#2a2c30';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);ctx.beginPath();ctx.moveTo(x+w/2,y);ctx.lineTo(x+w/2,y+h);ctx.moveTo(x,y+h/2);ctx.lineTo(x+w,y+h/2);ctx.stroke()}
    /* fight posters on the left wall */
    for(let i=0;i<3;i++){const x=cw*(.04+i*.15),y=ch*.1;ctx.fillStyle='#14161a';ctx.fillRect(x,y,cw*.12,ch*.13);ctx.fillStyle=['#7a1e1e','#1e3a7a','#4a4a4a'][i];ctx.fillRect(x+4,y+4,cw*.12-8,ch*.07);ctx.fillStyle='#e8b33a';ctx.fillRect(x+4,y+ch*.09,cw*.07,3)}
    /* ceiling light */
    ctx.fillStyle='#f5f6f8';ctx.fillRect(cw*.3,ch*.02,cw*.16,5);{const g=ctx.createRadialGradient(cw*.38,ch*.03,2,cw*.38,ch*.03,ch*.5);g.addColorStop(0,'rgba(255,250,235,.25)');g.addColorStop(1,'rgba(255,250,235,0)');ctx.fillStyle=g;ctx.fillRect(0,0,cw,ch)}
    /* practice cage behind: top rail, posts, chain-link */
    const cy0=ch*.36,cy1=ch*.8;ctx.save();ctx.beginPath();ctx.rect(0,cy0,cw,cy1-cy0);ctx.clip();ctx.strokeStyle='rgba(150,156,166,.38)';ctx.lineWidth=1.2;ctx.beginPath();
    for(let x=-ch;x<cw+ch;x+=11){ctx.moveTo(x,cy0);ctx.lineTo(x+(cy1-cy0),cy1);ctx.moveTo(x+(cy1-cy0),cy0);ctx.lineTo(x,cy1)}ctx.stroke();ctx.restore();
    ctx.fillStyle='#16171b';ctx.fillRect(0,cy0-8,cw,10);
    for(const px of [cw*.12,cw*.62]){ctx.fillStyle='#101114';ctx.fillRect(px-7,cy0-8,14,cy1-cy0+20);ctx.fillStyle='#1d1f24';ctx.fillRect(px-11,cy0+10,22,cy1-cy0-30);
      ctx.save();ctx.translate(px,(cy0+cy1)/2);ctx.rotate(-Math.PI/2);ctx.fillStyle='#e9e6df';ctx.font=`800 ${Math.max(9,cw*.028)}px "Black Han Sans",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('IRON CAGE',0,0);ctx.restore()}
    /* yellow padded pillar + plyo boxes */
    ctx.fillStyle='#e0b43a';ctx.beginPath();ctx.roundRect(cw*.3,ch*.42,cw*.05,ch*.36,6);ctx.fill();ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(cw*.33,ch*.42,cw*.02,ch*.36);
    for(let i=0;i<2;i++){ctx.fillStyle=i?'#24262b':'#2c2f35';ctx.fillRect(cw*.8,ch*(.66-i*.09),cw*.18,ch*.09);ctx.fillStyle='rgba(255,255,255,.55)';ctx.font=`700 ${Math.max(8,cw*.022)}px sans-serif`;ctx.textAlign='left';ctx.fillText('SOFT BOX',cw*.82,ch*(.715-i*.09))}
    /* mat with yellow stripes in perspective */
    const fy=ch*.8;const fl=ctx.createLinearGradient(0,fy,0,ch);fl.addColorStop(0,'#2a2c31');fl.addColorStop(1,'#141518');ctx.fillStyle=fl;ctx.fillRect(0,fy,cw,ch-fy);
    ctx.fillStyle='#d9a93a';ctx.beginPath();ctx.moveTo(cw*.05,ch);ctx.lineTo(cw*.42,fy+4);ctx.lineTo(cw*.47,fy+4);ctx.lineTo(cw*.2,ch);ctx.fill();
    ctx.beginPath();ctx.moveTo(cw*.55,fy+ (ch-fy)*.55);ctx.lineTo(cw,fy+(ch-fy)*.4);ctx.lineTo(cw,fy+(ch-fy)*.5);ctx.lineTo(cw*.6,fy+(ch-fy)*.66);ctx.fill();
    const v=ctx.createRadialGradient(cw*.6,ch*.55,ch*.2,cw*.6,ch*.55,Math.max(cw,ch)*.85);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.55)');ctx.fillStyle=v;ctx.fillRect(0,0,cw,ch);
    HUBBG={key,b};ctx=s}
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(HUBBG.b,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
  /* the fighter: rash guard on, breathing, weight shifting */
  const F={d,look:d.look,corner:'#3d7ff0',head:100,body:100,legs:100,cuts:0,rocked:0,flash:0,state:'idle',st:100,side:'a',_t:t,walkShirt:'#5a5f69'};
  const k=Math.min(ch*.9/252,cw*.75/120),x=cw*.4+Math.sin(t*.012)*2;
  ctx.save();ctx.translate(x,ch*.97);ctx.scale(k,k);
  const sh=ctx.createRadialGradient(0,0,2,0,0,70);sh.addColorStop(0,'rgba(0,0,0,.55)');sh.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=sh;ctx.save();ctx.scale(1,.16);ctx.beginPath();ctx.arc(0,0,70,0,7);ctx.fill();ctx.restore();
  ctx.scale(1,1+Math.sin(t*.05)*.006);drawFront(F,t,{dmg:{head:100,cuts:0},t,sweat:.15});ctx.restore()}
function portrait(canvas,d,side,mode){
  const dpr=Math.min(2,window.devicePixelRatio||1),cw=canvas.clientWidth||150,ch=canvas.clientHeight||Math.round(cw*190/150);
  canvas.width=cw*dpr;canvas.height=ch*dpr;
  ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);
  const corner=side==='b'?'#e04a3a':'#3d7ff0';
  const bg=ctx.createRadialGradient(cw*.5,ch*.35,4,cw*.5,ch*.4,cw*.9);bg.addColorStop(0,rgba(corner,.28));bg.addColorStop(1,rgba(corner,0));ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);
  const F={d,noBuild:mode==='bust',look:d.look,corner,head:100,body:100,legs:100,cuts:0,rocked:0,flash:0,state:'idle',st:100,side,_t:0};
  const f=side==='b'?-1:1,x=0;
  const bu=mode==='bust',J={f,hip:{x,y:300},chest:{x:x+f*2,y:234},tilt:.05,nearHand:bu?{x:x+f*24,y:262}:{x:x+f*30,y:221},farHand:bu?{x:x+f*12,y:264}:{x:x+f*15,y:216},nearFoot:{x:x+f*26,y:GY},farFoot:{x:x-f*24,y:GY},kneeN:'fwd',kneeF:'fwd'};
  if(mode==='front'){const k=Math.min(ch/252,cw/120);ctx.save();ctx.translate(cw/2,ch-4);ctx.scale(k,k);
    const sh=ctx.createRadialGradient(0,0,2,0,0,60);sh.addColorStop(0,'rgba(0,0,0,.55)');sh.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=sh;ctx.save();ctx.scale(1,.18);ctx.beginPath();ctx.arc(0,0,60,0,Math.PI*2);ctx.fill();ctx.restore();
    drawFront(F,0,{dmg:{head:100,cuts:0},t:0});ctx.restore();return}
  ctx.save();
  if(mode==='bust'){const k=cw/62;ctx.translate(cw/2,0);ctx.scale(k,k);ctx.translate(-2,-182)}
  else{const k=ch/215;ctx.translate(cw/2,0);ctx.scale(k,k);ctx.translate(0,-178)}
  drawBody(F,J);
  ctx.restore();
}

function solve(J){
  const f=J.f,sp=vsub(J.chest,J.hip),sd=vn(sp),fwd=vmul({x:-sd.y,y:sd.x},f);
  const shB=vadd(J.chest,vmul(sd,-5));
  const head=J.head||vadd(vadd(vadd(J.chest,vmul(sd,21)),vmul(fwd,3)),J._hd?{x:J._hd.x*.5,y:J._hd.y*.5}:{x:0,y:0});
  const shN=vadd(shB,vmul(fwd,4)),shF=vadd(shB,vmul(fwd,-5)),hipN=vadd(J.hip,vmul(fwd,3)),hipF=vadd(J.hip,vmul(fwd,-3));
  const legF=ik(hipF,J.farFoot,46,44,J.kneeF||'fwd',f),legN=ik(hipN,J.nearFoot,46,44,J.kneeN||'fwd',f);
  const armF=ik(shF,J.farHand,27,26,J.elbF||'down',f),armN=ik(shN,J.nearHand,27,26,J.elbN||'down',f);
  return{f,hip:J.hip,chest:J.chest,head,hAng:Math.atan2(sd.y,sd.x)+Math.PI/2+(J.tilt||0)*f,shN,shF,hipN,hipF,kneeN:legN.j,kneeF:legF.j,footN:legN.end,footF:legF.end,elbN:armN.j,elbF:armF.j,handN:armN.end,handF:armF.end,footDirN:J.footN||f,footDirF:J.footF||f,mood:J.mood};
}
IC.Draw={_body:(c,F,J)=>{ctx=c;drawBody(F,J)},_ko:(c,F)=>{ctx=c;ctx.strokeStyle="#888";ctx.beginPath();ctx.moveTo(200,GY);ctx.lineTo(600,GY);ctx.stroke();drawBody(F,koPose(F,poseStand(F,F,{frame:0,cl:null}),0))},_cmp:(c,F,mood)=>{ctx=c;ctx.save();ctx.translate(60,60);ctx.scale(2.6,2.6);const o=fighterLook(F,{mood});drawHead(F,{x:0,y:0},0,1,o);ctx.restore();ctx.save();ctx.translate(170,62);ctx.scale(2.1,2.1);ctx.translate(0,212);drawFront(F,0,{noBuild:true,dmg:{head:F.head,cuts:F.cuts,mood},t:0,sweat:o.sweat});ctx.restore()},cornerPOV,cornerUFC,roundBreak,_ground:(c,S)=>{ctx=c;drawGround(S)},render,portrait,hubScene,weighin,beltScene,koScene,KOI,gateScene,GATE,tauntScene,BELT,WI,WTRASH,cam,rig:{solve,poseStand,poseRef,groundJ,ext}};
})(window.IC);

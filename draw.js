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
  switch(pref){case 'up':j=j1.y<j2.y?j1:j2;break;case 'fwd':j=j1.x*f>j2.x*f?j1:j2;break;case 'back':j=j1.x*f<j2.x*f?j1:j2;break;default:j=j1.y>j2.y?j1:j2}
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
function limb(p0,p1,p2,P,k,base,o={}){
  const {L,R,C}=limbPts(p0,p1,p2,P,k);
  ctx.beginPath();smoothPath(L,true);const e=C[C.length-1],st=C[0];
  ctx.arc(e.pt.x,e.pt.y,e.w,Math.atan2(e.n.y,e.n.x),Math.atan2(e.n.y,e.n.x)-Math.PI,true);
  smoothPath(R.slice().reverse(),false);
  ctx.arc(st.pt.x,st.pt.y,st.w,Math.atan2(-st.n.y,-st.n.x),Math.atan2(-st.n.y,-st.n.x)-Math.PI,true);ctx.closePath();
  // light from above: pick the upward-facing side of the upper bone as lit
  const n0=C[4].n,up=n0.y<0?1:-1,mx=(p0.x+p2.x)/2,my=(p0.y+p2.y)/2,r=16*k;
  const g=ctx.createLinearGradient(mx+n0.x*r*up,my+n0.y*r*up,mx-n0.x*r*up,my-n0.y*r*up);
  g.addColorStop(0,shade(base,1.14));g.addColorStop(.35,base);g.addColorStop(.78,shade(base,.8));g.addColorStop(1,shade(base,.64));
  ctx.fillStyle=g;ctx.fill();
  ctx.strokeStyle='rgba(40,18,10,.16)';ctx.lineWidth=.7;ctx.stroke();
  if(!o.flat){
    ctx.save();ctx.clip();
    // muscle highlights: biceps/quad belly and forearm/calf belly
    for(const [s,a] of o.bellies||[]){const i=Math.round(s/2*16),c=C[i];const hx=c.pt.x+c.n.x*c.w*.35*up,hy=c.pt.y+c.n.y*c.w*.35*up;const rg=ctx.createRadialGradient(hx,hy,0,hx,hy,c.w*1.3);rg.addColorStop(0,`rgba(255,240,225,${a})`);rg.addColorStop(1,'rgba(255,240,225,0)');ctx.fillStyle=rg;ctx.fillRect(hx-c.w*1.4,hy-c.w*1.4,c.w*2.8,c.w*2.8)}
    // occlusion in the crease of the joint
    const cj=C[8],og=ctx.createRadialGradient(cj.pt.x-cj.n.x*cj.w*up,cj.pt.y-cj.n.y*cj.w*up,0,cj.pt.x,cj.pt.y,cj.w*1.6);og.addColorStop(0,'rgba(60,25,15,.28)');og.addColorStop(1,'rgba(60,25,15,0)');ctx.fillStyle=og;ctx.fillRect(cj.pt.x-20,cj.pt.y-20,40,40);
    if(o.sheen>0){ctx.strokeStyle=`rgba(255,255,255,${o.sheen})`;ctx.lineWidth=1.4;ctx.beginPath();smoothPath(C.slice(2,14).map(c=>({x:c.pt.x+c.n.x*c.w*.55*up,y:c.pt.y+c.n.y*c.w*.55*up})),true);ctx.stroke()}
    ctx.restore();
  }
  return{L,R,C};
}
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
  const g=ctx.createLinearGradient(17,0,-17,0);g.addColorStop(0,shade(base,1.08));g.addColorStop(.42,base);g.addColorStop(1,shade(base,.62));
  ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='rgba(20,10,8,.3)';ctx.lineWidth=.9;ctx.stroke();
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
  ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='bold 4.5px sans-serif';ctx.textAlign='center';ctx.save();ctx.scale(f,1);ctx.fillText(f>0?'IC':'IC',f*-6,5);ctx.restore();
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
}
function sleeve(sh,el,wr,col){const {L,R,C}=limbPts(sh,el,wr,PROF.arm,1,0,.55,1.4);ctx.beginPath();smoothPath(L,true);smoothPath(R.slice().reverse(),false);const st=C[0];ctx.arc(st.pt.x,st.pt.y,st.w,Math.atan2(-st.n.y,-st.n.x),Math.atan2(-st.n.y,-st.n.x)-Math.PI,true);ctx.closePath();ctx.fillStyle=col;ctx.fill();ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=.8;ctx.stroke()}
function glove(p,ang,o,dark){
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(ang);
  if(o.kind==='ref'){ell(2,0,5.2,4.6,dark?'#16171a':'#24262b');ctx.restore();return}
  const g=ctx.createLinearGradient(0,-8,0,8);g.addColorStop(0,dark?'#3a3d44':'#4b4f58');g.addColorStop(.5,dark?'#16171a':'#1d1f24');g.addColorStop(1,'#0b0c0e');
  ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(-2,-7.2,13.5,14.4,6.5);ctx.fill();
  ctx.fillStyle=dark?shade(o.corner,.7):o.corner;ctx.beginPath();ctx.roundRect(-7,-6.4,6.5,12.8,2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.18)';ctx.beginPath();ctx.roundRect(1,-6,9,3,2);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.6)';ctx.lineWidth=.8;for(const yy of [-2.6,0,2.6]){ctx.beginPath();ctx.moveTo(8,yy);ctx.lineTo(11.2,yy);ctx.stroke()}
  ctx.restore();
}
function foot(ankle,f,col,o){
  const toe={x:ankle.x+f*14,y:ankle.y+3};
  if(o.kind==='ref'){capsule(ankle,{x:ankle.x+f*15,y:ankle.y+3},5.6,4.4,'#121214',0);return}
  capsule(ankle,toe,5,3.4,col,0);
  ell(ankle.x-f*1.5,ankle.y+2,4.6,3.6,col);
}
function drawHead(F,c,ang,f,o){
  const L=o.look,skin=o.skinNow;
  ctx.save();ctx.translate(c.x,c.y);ctx.rotate(ang);ctx.scale(f,1);
  // skull & face
  const g=ctx.createRadialGradient(5,-7,2,0,0,17);g.addColorStop(0,shade(skin,1.18));g.addColorStop(.6,skin);g.addColorStop(1,shade(skin,.72));
  ctx.fillStyle=g;
  ctx.beginPath();ctx.ellipse(0,-1,12.5,14.2,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.moveTo(11,-6);ctx.quadraticCurveTo(13.5,-3,16,0.5);ctx.lineTo(13.2,2.4);ctx.quadraticCurveTo(13.8,4.2,13.4,6.2);ctx.quadraticCurveTo(13.6,9,11.6,10.5);ctx.quadraticCurveTo(8,14.2,1,12.4);ctx.lineTo(-4,8);ctx.closePath();ctx.fill();
  // ear
  ell(-2.5,1.5,3.1,4.6,shade(skin,.86));ctx.strokeStyle=shade(skin,.6);ctx.lineWidth=.8;ctx.beginPath();ctx.arc(-2.3,1.5,1.8,-1.2,1.6);ctx.stroke();
  // swelling
  if(o.head<55){const a=clamp((55-o.head)/80,0,.55);ell(8.6,-1.2,5.2,4.4,`rgba(110,40,80,${a})`);if(o.head<35)ell(4,4,4,3,`rgba(120,40,70,${a*.7})`)}
  // eye
  const shut=o.mood==='ko'||o.mood==='hurt'||(o.blink);
  if(shut){ctx.strokeStyle='#2a1b14';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(6.8,-2);ctx.quadraticCurveTo(9,-1.2,11,-2.2);ctx.stroke()}
  else{ell(9,-2.6,2.7,1.6,'#f2ece4');ell(9.9,-2.6,1.35,1.4,'#2a1b14');ell(10.2,-3,.4,.4,'#fff')}
  // brow
  ctx.strokeStyle=shade(L.hair==='#000000'?'#1a1310':L.hair,.9);ctx.lineWidth=2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(5,-6.4);ctx.quadraticCurveTo(8.5,-7.6,12,-6);ctx.stroke();
  // nose & mouth
  ctx.strokeStyle=shade(skin,.6);ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(14.6,1);ctx.quadraticCurveTo(13,2.6,12,2);ctx.stroke();
  if(o.mood==='hurt'||o.mood==='yell'){ell(12.2,7,2.2,1.5,'#3a1414');ctx.fillStyle=o.corner;ctx.fillRect(11,6,2.6,1.2)}
  else{ctx.strokeStyle='#5a2e24';ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(10.6,6.8);ctx.lineTo(13.1,6.6);ctx.stroke()}
  // hair
  ctx.fillStyle=L.hair;
  const hs=L.hairStyle;
  if(hs!=='bald'){
    ctx.globalAlpha=hs==='buzz'?.6:1;
    ctx.beginPath();ctx.moveTo(-12.4,4);ctx.quadraticCurveTo(-14.5,-12,-2,-15.6);ctx.quadraticCurveTo(8,-16,11.2,-8.4);
    ctx.quadraticCurveTo(7,-10.6,3,-9.6);ctx.quadraticCurveTo(-4,-8,-6,-1);ctx.quadraticCurveTo(-8,3,-12.4,4);ctx.fill();
    ctx.globalAlpha=1;
    if(hs==='long'){ctx.beginPath();ctx.moveTo(-12,-4);ctx.quadraticCurveTo(-17,6,-13,16);ctx.lineTo(-7,14);ctx.quadraticCurveTo(-9,4,-6,-2);ctx.fill()}
    if(hs==='bun'){ell(-10,-13.5,5,4.6,L.hair)}
    if(hs==='mohawk'){ctx.beginPath();ctx.moveTo(-9,-11);ctx.quadraticCurveTo(-2,-25,8,-14);ctx.lineTo(6,-11);ctx.quadraticCurveTo(-1,-19,-7,-9);ctx.fill()}
    ctx.fillStyle='rgba(255,255,255,.12)';ctx.beginPath();ctx.ellipse(1,-12.5,5,1.6,-.2,0,7);ctx.fill();
  }else{ctx.fillStyle='rgba(255,255,255,.2)';ctx.beginPath();ctx.ellipse(2,-11,5,2.4,-.3,0,7);ctx.fill()}
  if(L.beard){ctx.fillStyle=L.hair;ctx.globalAlpha=.92;ctx.beginPath();ctx.moveTo(-1,5);ctx.quadraticCurveTo(2,10.5,6,12.6);ctx.quadraticCurveTo(10.4,13,12.2,9.4);ctx.lineTo(13,7.6);ctx.lineTo(10.4,8.6);ctx.quadraticCurveTo(6,8,1,3);ctx.closePath();ctx.fill();ctx.globalAlpha=1}
  // cuts & blood
  const cuts=Math.min(5,o.cuts|0);
  if(o.head<85&&cuts>0){ctx.strokeStyle='#a0101a';ctx.lineWidth=1.4;
    for(let i=0;i<cuts;i++){const bx=5+i*2.6,by=-8+i*1.5;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+3.2,by+1);ctx.stroke();
      const len=clamp((75-o.head)/3,2,18)*(1-i*.25);ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(bx+1.5,by+1);ctx.quadraticCurveTo(bx+2.4,by+len*.5,bx+1.2,by+len);ctx.stroke()}}
  const bl=clamp((o.cuts||0)*.5+(100-o.head)/30,0,6);
  if(bl>.8){ctx.strokeStyle='rgba(150,10,20,.85)';ctx.lineWidth=1.3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(13.6,2.5);ctx.quadraticCurveTo(13.8,5,12.8,8.5);ctx.stroke()}
  if(bl>2){ctx.fillStyle='rgba(140,8,18,.55)';ctx.beginPath();ctx.ellipse(11.8,8.2,2.6,1.4,0,0,7);ctx.fill();ctx.strokeStyle='rgba(140,8,18,.8)';ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(10.5,9.5);ctx.quadraticCurveTo(10,12,10.8,14.5);ctx.stroke()}
  if(bl>3){ctx.fillStyle='rgba(130,6,16,.35)';ctx.beginPath();ctx.ellipse(8,-2,6,7,0,0,7);ctx.fill();ctx.strokeStyle='rgba(150,10,20,.75)';ctx.lineWidth=1.6;for(const [x0,y0,l] of [[7,-6,14],[9.5,-5,17],[5,-4,10]]){ctx.beginPath();ctx.moveTo(x0,y0);ctx.quadraticCurveTo(x0+1,y0+l*.5,x0-.5,y0+l);ctx.stroke()}}
  if(o.sweat>.3){ell(6,-10,1.2,.7,`rgba(255,255,255,${o.sweat*.6})`);ell(2,-8,1,.6,`rgba(255,255,255,${o.sweat*.5})`)}
  ctx.restore();
  if(o.rocked){for(let i=0;i<3;i++){const a=o.t*.12+i*2.1;ell(c.x+Math.cos(a)*21,c.y-23+Math.sin(a)*5,2.6,2.6,'#ffd75e')}}
}

/* draw a full figure from joints */
function drawBody(F,J){
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
  const head=J.head||vadd(vadd(J.chest,vmul(sd,21)),vmul(fwd,3));
  const hAng=Math.atan2(sd.y,sd.x)+Math.PI/2+(J.tilt||0)*f;
  const legF=ik(hipF,J.farFoot,46,44,J.kneeF||'fwd',f),legN=ik(hipN,J.nearFoot,46,44,J.kneeN||'fwd',f);
  const armF=ik(shF,J.farHand,27,26,J.elbF||'down',f),armN=ik(shN,J.nearHand,27,26,J.elbN||'down',f);
  const pants=o.pants,legCol=pants?'#3b3f47':null;
  // far leg
  limb(hipF,legF.j,legF.end,PROF.leg,.94,legCol?shade(legCol,.8):skinD,{flat:!!legCol,bellies:[[.45,.12],[1.3,.1]]});foot(legF.end,J.footF||f,skinD,o);
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
function fighterLook(F,J){
  const L=F.look;
  return{look:L,kind:'fighter',logo:'IC',shirt:F.walkShirt?shade(F.walkShirt,.55):null,skinNow:F.flash?shade(L.skin,1.3):L.skin,trunk:L.trunk,corner:F.corner,tattoo:L.tattoo,
    head:F.head??100,body:F.body??100,legs:F.legs??100,cuts:F.cuts||0,sweat:clamp(1-(F.st??100)/100,0,1)*.8+.15,
    rocked:F.rocked>0&&F.state!=='ko',t:F._t||0,mood:J.mood};
}
const REF={kind:'ref',look:{skin:'#e1b28e',hair:'#2b2b2b',hairStyle:'buzz',beard:false},skinNow:'#e1b28e',shirt:'#15161a',pants:true,corner:'#888',head:100,body:100,legs:100,cuts:0,sweat:0,t:0};

/* ---------- poses ---------- */
function ext(F){
  if(F.state!=='attack'||!F.A)return 0;const A=F.A;
  if(F.t<A.w){const p=F.t/A.w;return -.24*p*p*(3-2*p)}
  if(F.t<A.w+A.a){const p=(F.t-A.w)/Math.max(1,A.a);return 1+.09*Math.sin(Math.min(1,p*1.6)*Math.PI)}
  const p=Math.min(1,(F.t-A.w-A.a)/A.r);return Math.max(0,1-p*p*(3-2*p));
}
function poseStand(F,O,S){
  const x=F.x,f=F.f,E=ext(F),e=Math.max(E,0),A=F.A,an=A&&A.anim,t=S.frame,st=F.state;
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
      case 'jab':lean+=f*9*e;drop=3*e;break;case 'cross':lean+=f*17*e;drop=5*e;break;case 'hook':lean+=f*11*e;tilt=.16*e;drop=4*e;break;
      case 'upper':lean+=f*5*e;drop=8*Math.max(0,-E*4)+4*e;break;case 'bodyshot':lean+=f*7*e;drop=20*e;tilt=.2*e;break;
      case 'lowkick':lean-=f*5*e;break;case 'midkick':lean-=f*8*e;break;case 'highkick':case 'qmark':lean-=f*11*e;break;
      case 'superman':lift=24*e;lean+=f*16*e;break;case 'spinfist':lean+=f*8*e;break;case 'spinkick':lean-=f*11*e;break;
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
    if(an==='lowkick')back={x:x+f*(-24+e*108),y:GY-12-e*22};
    if(an==='midkick')back={x:x+f*(-24+e*112),y:GY-e*92};
    if(an==='highkick')back={x:x+f*(-24+e*112),y:GY-e*136};
    if(an==='spinkick'){back={x:x+f*(-24+e*120),y:GY-e*96};kneeF='back'}
    if(an==='qmark')back={x:x+f*(-24+e*116),y:GY-(F.t<A.w?40:e*142)};
    if(an==='flyknee'){front={x:x+f*(6+e*24),y:GY-lift-e*58};kneeN='up'}
    if(['lowkick','midkick','highkick','qmark'].includes(an)&&e>.2)kneeF='up';
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
      case 'hook':near={x:x+f*(28+e*60)+lean,y:206-e*8};far={x:x+f*14+lean*.5,y:198};if(e>.2)elbN='up';break;
      case 'upper':far={x:x+f*(22+e*44)+lean,y:E<0?250:246-e*40};break;
      case 'bodyshot':far={x:x+f*(16+e*66)+lean,y:214+drop+e*22};break;
      case 'lowkick':case 'midkick':case 'highkick':case 'spinkick':case 'qmark':near={x:x+f*24,y:214};far={x:x-f*24,y:252};break;
      case 'superman':far={x:x+f*(14+e*94)+lean,y:204-lift};near={x:x-f*2,y:226-lift};break;
      case 'spinfist':far={x:x+f*(E<0?-30:10+e*72)+lean,y:206};elbF='up';break;
      case 'overhand':far={x:x+f*(10+e*74)+lean,y:E<=0?176:178+E*30};elbF='up';break;
      case 'flyknee':near={x:x+f*42,y:198-lift};far={x:x+f*36,y:202-lift};break;
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
  if(PK==='bow'){near={x:chest.x+f*8,y:chest.y+18};far={x:chest.x+f*4,y:chest.y+22};elbN='down';elbF='down'}
  if(st==='stroll'){near={x:hip.x+f*8+Math.sin(wk)*12,y:hip.y-4};far={x:hip.x-f*6-Math.sin(wk)*12,y:hip.y-2};elbN='fwd';elbF='fwd'}
  if(st==='dejected'){near={x:hip.x+f*13,y:hip.y-10};far={x:hip.x-f*13,y:hip.y-10};elbN='fwd';elbF='back'}
  if(st==='ko'){near={x:x+f*22,y:276};far={x:x-f*8,y:282}}
  /* stamina_exhaustion_idle: hunched over, hands on the thighs, chest heaving */
  if(F.exh&&(st==='idle'||st==='walk'||st==='block')){const br=Math.sin(t*.17+(F.side==='a'?0:1))*3.4;chest.x+=f*9;chest.y+=16+br;hip.y+=3;tilt+=.38;
    near={x:x+f*20,y:266+br};far={x:x+f*12,y:272+br};elbN='down';elbF='down';mood=mood||'hurt'}
  /* athletic stance: sink the hips so the knees bend */
  const cr=(st==='ko'||an==='shoot'||st==='sprawl'||st==='stuffed')?0:st==='celebrate'?4:9;
  hip.y+=cr;chest.y+=cr;near.y+=cr;far.y+=cr;
  if(['lowkick','midkick','highkick','spinkick','qmark'].includes(an)){back.y+=cr*.4}
  /* living stance: breathing, weight shifting, hands feinting and the head never still */
  const ph=F.side==='a'?0:2.1;
  if(st==='idle'||st==='walk'||st==='block'||st==='stroll'){
    const br=Math.sin(t*.055+ph),sh=Math.sin(t*.031+ph);
    chest.y+=br*1.4;chest.x+=sh*2.2*f;hip.x+=sh*1.4*f;
    if(st!=='stroll'){near.x+=Math.sin(t*.083+ph)*2.6;near.y+=Math.cos(t*.11+ph)*1.8+br;far.x+=Math.sin(t*.067+ph+1)*1.6;far.y+=Math.cos(t*.09+ph)*1.4+br}
    tilt+=Math.sin(t*.045+ph)*.05;
  }
  /* hit reactions: the strike's target decides how the body gives */
  const RX=F.react;if(RX&&st!=='ko'){const k=Math.max(0,1-RX.t/(RX.k==='big'?26:RX.k==='body'?28:18)),e2=k*k*(3-2*k);
    if(RX.k==='head'||RX.k==='big'){const b=RX.k==='big'?1.6:1;chest.x-=f*9*b*e2;chest.y+=(RX.up?-6:3)*e2;tilt-=(RX.up?.7:.45)*b*e2;if(RX.k==='big'){near={x:near.x-f*16*e2,y:near.y+18*e2};far={x:far.x-f*20*e2,y:far.y+24*e2}}}
    else if(RX.k==='body'){chest.x+=f*7*e2;chest.y+=16*e2;hip.y+=5*e2;tilt+=.45*e2;near={x:lerp(near.x,hip.x+f*16,e2),y:lerp(near.y,hip.y-26,e2)};far={x:lerp(far.x,hip.x+f*10,e2),y:lerp(far.y,hip.y-20,e2)};mood='hurt'}
    else if(RX.k==='leg'){front={x:front.x-f*8*e2,y:front.y-10*e2};hip.y+=12*e2;chest.y+=9*e2;chest.x-=f*3*e2;kneeN='fwd'}
    else if(RX.k==='check'){front={x:front.x+f*6*e2,y:front.y-38*e2};kneeN='up'}}
  /* worn-out legs: weight shifts off the damaged lead leg */
  const lg=F.legs??100;if(lg<50&&st!=='ko'&&st!=='attack'){const k=(50-lg)/50;front={x:front.x-f*6*k,y:front.y-5*k*(1+Math.sin(t*.07))};hip.y+=4*k;hip.x-=f*3*k}
  /* body mechanics: shoulders turn into punches, hips open on kicks, rear heel lifts on power shots */
  let twist=0,hipTwist=0;
  if(st==='attack'){
    const tw={jab:-.35,cross:1,hook:-.9,upper:.7,bodyshot:.9,overhand:1.15,superman:1,spinfist:1.2,lowkick:.2,midkick:.4,highkick:.5,spinkick:.6,qmark:.5,flyknee:.3}[an]||0;
    twist=tw*Math.max(E,-.6);
    hipTwist={lowkick:1,midkick:1,highkick:1,spinkick:1.2,qmark:1,cross:.45,overhand:.5,hook:-.3}[an]*Math.max(0,E)||0;
    if(['cross','overhand','upper','bodyshot','superman'].includes(an))back={x:back.x+f*4*e,y:back.y-5*e};
    if(['lowkick','midkick','highkick','spinkick','qmark'].includes(an)){front={x:front.x-f*2*e,y:front.y-2*e};chest.x-=f*3*e}
  }
  if(st==='hit'){const k=F.t!=null?Math.max(0,1-F.t/18):1;tilt-=.25*k;chest.x-=f*4*k}
  /* stance switch: a quick hop where the feet scissor through each other */
  if(F.swT>0&&st!=='ko'){const k=Math.sin((1-F.swT/16)*Math.PI);hip.y-=7*k;chest.y-=7*k;near.y-=6*k;far.y-=6*k;front={x:lerp(front.x,x,k*.8),y:front.y-12*k};back={x:lerp(back.x,x,k*.8),y:back.y-9*k}}
  return{f,hip,chest,tilt,mood,nearHand:near,farHand:far,nearFoot:front,farFoot:back,kneeN,kneeF,elbN,elbF,twist,hipTwist};
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
  if(st==='cover'){const b=Math.sin(t*.5)*3;hip.y=318;chest.x=x+f*24;chest.y=262;near={x:x+f*58,y:268+b};far={x:x+f*50,y:276-b};elbN='fwd';elbF='fwd'}
  if(st==='push'){chest.x=x+f*12;near={x:x+f*52,y:222};far={x:x+f*48,y:232};elbN='fwd';elbF='fwd'}
  return{f,hip,chest,tilt:st==='crouch'?.35:st==='cover'?.5:0,nearHand:near,farHand:far,nearFoot:{x:x+f*(cr>20||st==='cover'?30:20)+w,y:GY},farFoot:{x:x-f*(cr>20||st==='cover'?24:18)-w,y:GY},kneeN:'fwd',kneeF:st==='cover'?'up':'fwd',elbN,elbF};
}
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
  if(sub&&sub.prog>80){const D=sub.att===top?B:T,tap=Math.abs(Math.sin(t*.55));const base=sub.att===top?vadd(B.chest,{x:hd*10,y:6}):vadd(T.chest,{x:hd*20,y:10});D.farHand={x:base.x,y:base.y-14*tap};D.elbF='up'}
  if(bot.state==='ko'||(S.mode==='ko'&&S.camFocus===bot.side)){B.nearHand=vadd(B.chest,{x:-hd*4,y:20});B.farHand=vadd(B.chest,{x:hd*10,y:18});B.mood='ko'}
  return{T,B};
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
const ADS=['IRON CAGE','NORTHPEAK','VOLTA ENERGY','KORE FIGHTWEAR','BLUELINE','IRON CAGE','HALCYON','VOLTA ENERGY'];
function panel(i,a,b,front){
  const p1=PR(a.x,a.z),p2=PR(b.x,b.z),t1=PR(a.x,a.z,232),t2=PR(b.x,b.z,232),q1=PR(a.x,a.z,34),q2=PR(b.x,b.z,34);
  ctx.save();ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(t2.x,t2.y);ctx.lineTo(t1.x,t1.y);ctx.closePath();
  ctx.fillStyle=front?'rgba(18,22,28,.05)':'rgba(16,20,26,.42)';ctx.fill();ctx.clip();
  const minx=Math.min(p1.x,p2.x,t1.x,t2.x),maxx=Math.max(p1.x,p2.x,t1.x,t2.x),miny=Math.min(t1.y,t2.y),maxy=Math.max(p1.y,p2.y),sp=11*(p1.s+p2.s)/2,hgt=maxy-miny;
  ctx.strokeStyle=front?'rgba(190,200,215,.09)':'rgba(175,190,210,.17)';ctx.lineWidth=Math.max(.6,(p1.s+p2.s)/2*.9);ctx.beginPath();
  for(let x=minx-hgt;x<maxx+hgt;x+=sp){ctx.moveTo(x,miny);ctx.lineTo(x+hgt,maxy);ctx.moveTo(x+hgt,miny);ctx.lineTo(x,maxy)}ctx.stroke();
  ctx.restore();
  if(!front){
    ctx.fillStyle='#0d0f13';ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(q2.x,q2.y);ctx.lineTo(q1.x,q1.y);ctx.closePath();ctx.fill();
    const mx=(q1.x+q2.x+p1.x+p2.x)/4,my=(q1.y+q2.y+p1.y+p2.y)/4,sc=(p1.s+p2.s)/2,w=Math.abs(p2.x-p1.x);
    if(w>40*sc){ctx.save();ctx.translate(mx,my);const ang=Math.atan2(p2.y-p1.y,p2.x-p1.x);ctx.rotate(Math.abs(ang)>Math.PI/2?ang+Math.PI:ang);ctx.scale(sc,sc);
      ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=i%2?'rgba(232,179,58,.6)':'rgba(220,226,235,.45)';ctx.fillText(ADS[i],0,1);ctx.restore()}
  }
  ctx.strokeStyle=front?'rgba(30,34,42,.35)':'#16191f';ctx.lineWidth=7*(t1.s+t2.s)/2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(t1.x,t1.y);ctx.lineTo(t2.x,t2.y);ctx.stroke();
}
function post(v,front){
  const f=PR(v.x,v.z),t=PR(v.x,v.z,240),w=9*f.s;
  ctx.globalAlpha=front?.3:1;
  const g=ctx.createLinearGradient(f.x-w,0,f.x+w,0);g.addColorStop(0,'#0b0c0f');g.addColorStop(.5,'#2c3038');g.addColorStop(1,'#0b0c0f');
  ctx.fillStyle=g;ctx.fillRect(f.x-w,t.y,w*2,f.y-t.y);
  const pad=PR(v.x,v.z,170),pb=PR(v.x,v.z,70);ctx.fillStyle='#101116';ctx.fillRect(f.x-w*1.35,pad.y,w*2.7,pb.y-pad.y);
  if(!front&&f.s>.45){ctx.save();ctx.translate(f.x,(pad.y+pb.y)/2);ctx.rotate(-Math.PI/2);ctx.scale(f.s,f.s);ctx.fillStyle='rgba(232,179,58,.65)';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('IRON CAGE',0,0);ctx.restore()}
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
  ctx.fillStyle='rgba(10,12,16,.32)';ctx.font='bold 46px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(S.title?'TITLE FIGHT':'IRON CAGE',0,4);
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
function beams(S){
  const AR=S.arena||{beams:3,beamA:.1,k:'main'},n=AR.beams,xs=n===1?[400]:Array.from({length:n},(_,i)=>lerp(120,680,i/(n-1)));
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const lx of xs){const g=ctx.createLinearGradient(lx,0,lx,GY);g.addColorStop(0,`rgba(255,244,220,${AR.beamA})`);g.addColorStop(1,'rgba(255,244,220,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(lx-10,0);ctx.lineTo(lx+10,0);ctx.lineTo(lx+170,GY);ctx.lineTo(lx-170,GY);ctx.closePath();ctx.fill();
    ell(lx,4,9,5,'rgba(255,250,235,.85)')}
  /* title fights: corner-coloured sweeping beams over the crowd */
  if(AR.k==='title'){for(const [c,ph] of [['rgba(61,127,240,',0],['rgba(224,74,58,',2.1],['rgba(232,179,58,',4.2]]){const a=Math.sin(S.frame*.012+ph)*.55,x0=400+Math.sin(S.frame*.009+ph)*260;
      ctx.save();ctx.translate(x0,-40);ctx.rotate(a);const g=ctx.createLinearGradient(0,0,0,420);g.addColorStop(0,c+'.22)');g.addColorStop(1,c+'0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(6,0);ctx.lineTo(70,420);ctx.lineTo(-70,420);ctx.closePath();ctx.fill();ctx.restore()}}
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
function smoothPose(F,J){
  const A=F.A,live=F.state==='attack'&&A&&F.t>=A.w-1&&F.t<=A.w+A.a+1;
  const k=F.state==='ko'?.5:live?.72:F.state==='attack'?.42:F.state==='hit'?.5:F.state==='slip'?.45:.26;
  const P=F._pj,keys=['hip','chest','nearHand','farHand','nearFoot','farFoot'];
  if(P&&Math.abs(P.hip.x-J.hip.x)<90&&P.f===J.f){for(const q of keys){J[q]={x:P[q].x+(J[q].x-P[q].x)*k,y:P[q].y+(J[q].y-P[q].y)*k}}
    J.tilt=P.tilt+(J.tilt-P.tilt)*Math.max(k,.3);J.twist=P.twist+((J.twist||0)-P.twist)*Math.max(k,.4);J.hipTwist=P.hipTwist+((J.hipTwist||0)-P.hipTwist)*Math.max(k,.4)}
  F._pj={f:J.f,tilt:J.tilt||0,twist:J.twist||0,hipTwist:J.hipTwist||0};for(const q of keys)F._pj[q]={x:J[q].x,y:J[q].y};
  return J;
}
function drawStandingFighter(F,O,S){
  F._t=S.frame;
  ctx.save();depth(F.x,F.z||0);
  shadowAt(F.x,52);
  const J=smoothPose(F,poseStand(F,O,S));
  if(F.stance)J.swapD=(F.f===1)===(F.stance==='south');
  if(F.swT>0){const k=1-F.swT/16;ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=`rgba(127,227,255,${(1-k)*.8})`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(F.x,GY+2,30+k*46,7+k*9,0,0,7);ctx.stroke();ctx.restore()}
  ctx.save();
  if(F.state==='ko'){const a=Math.min(1,F.koT/22)*Math.PI/2*.94;ctx.translate(F.x-F.f*22,GY-4);ctx.rotate(-F.f*a);ctx.translate(-(F.x-F.f*22),-(GY-4));J.mood='ko'}
  if(F.heart>0){const g=ctx.createRadialGradient(J.chest.x,J.chest.y,10,J.chest.x,J.chest.y,90);g.addColorStop(0,`rgba(255,60,40,${.18+.1*Math.sin(S.frame*.2)})`);g.addColorStop(1,'rgba(255,60,40,0)');ctx.fillStyle=g;ctx.fillRect(J.chest.x-90,J.chest.y-90,180,180)}
  const r=drawBody(F,J);
  if(F.state==='attack'&&F.A&&F.A.kind!=='shoot'&&F.t>=F.A.w-3&&F.t<=F.A.w+F.A.a+4){
    const an=F.A.anim,tip=['lowkick','midkick','highkick','spinkick','qmark'].includes(an)?r.footF:an==='flyknee'?J.nearFoot:['jab','hook'].includes(an)?r.handN:r.handF;
    F._trail=(F._trail&&F._trail.k===F.A?F._trail:{k:F.A,p:[]});F._trail.p.push({x:tip.x,y:tip.y});if(F._trail.p.length>8)F._trail.p.shift();
    const P=F._trail.p;ctx.lineCap='round';for(let i=1;i<P.length;i++){ctx.strokeStyle=`rgba(255,250,240,${i/P.length*.62})`;ctx.lineWidth=3+i*2.6;ctx.beginPath();ctx.moveTo(P[i-1].x,P[i-1].y);ctx.lineTo(P[i].x,P[i].y);ctx.stroke()}
  }else F._trail=null;
  if(F.A&&F.A.special&&F.t>=F.A.w-2&&F.t<=F.A.w+F.A.a+3){
    const tip=['spinkick','qmark'].includes(F.A.anim)?r.footF:F.A.anim==='flyknee'?J.nearFoot:r.handF;
    ctx.strokeStyle='rgba(255,215,94,.6)';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.arc(tip.x-F.f*32,tip.y+10,36,F.f>0?-1.2:Math.PI-.6,F.f>0?.6:Math.PI+1.2);ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}
function blendJ(A,B,k){const o={...B};for(const q of ['hip','chest','nearHand','farHand','nearFoot','farFoot']){if(A[q]&&B[q])o[q]={x:A[q].x+(B[q].x-A[q].x)*k,y:A[q].y+(B[q].y-A[q].y)*k}}o.tilt=(A.tilt||0)+((B.tilt||0)-(A.tilt||0))*k;return o}
function drawGround(S){
  const gr=S.gr;let {T,B}=groundJ(S);
  if(gr.trans>0&&gr.prevPos!=null&&gr.prevPos!==gr.pos){const cur=gr.pos;gr.pos=gr.prevPos;const P0=groundJ(S);gr.pos=cur;const k=1-gr.trans/16,e=k*k*(3-2*k);T=blendJ(P0.T,T,e);B=blendJ(P0.B,B,e);
    if(e<.5){T.chest={x:T.chest.x,y:T.chest.y-14*Math.sin(e*Math.PI)}}}
  gr.top._t=gr.bot._t=S.frame;
  ctx.save();depth(gr.cx,gr.cz||0);
  shadowAt(gr.cx,120);
  if(gr.pos===4){drawBody(gr.top,T);drawBody(gr.bot,B)}else{drawBody(gr.bot,B);drawBody(gr.top,T)}
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
    if(S.walk){const k=S.walk.k||'';const F=/^blue/.test(k)?a:/^red/.test(k)?b:null,an=/Ann$/.test(k);if(F){fx=F.x;z=an?1.4:1.3;fy=an?215:225}else{fx=400;z=k==='faceoff'||k==='touch'?1.32:1.3;fy=k==='faceoff'?236:250}}}
  if(S.mode==='ko'||S.replay){const L=S.camFocus==='a'?a:b;fx=S.gr?S.gr.cx:L.x;z=S.replay?1.85:1.62;fy=S.gr?320:300}
  if(S.mode==='outro'){const Wn=S.winSide==='a'?a:S.winSide==='b'?b:null;fx=Wn?Wn.x:400;z=1.38;fy=250}
  if(S.mode==='decision'){fx=400;z=1.2;fy=255}
  if(S.mode==='between'||S.mode==='pause'){z=1.05}
  if(VH>470)z*=Math.min(1.35,Math.sqrt(VH/450)*.95);
  z*=1+(S.zoomKick||0);
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
function plate(F,side,S){
  const left=side==='a',pw=Math.min(312,WH/2-62),ph=64,x=left?10:WH-10-pw,y=8,cc=F.corner,R0=14;
  frost(x,y,pw,ph,R0,.55);
  /* corner colour wash, faint, from the outer edge */
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,pw,ph,R0);ctx.clip();const cw=ctx.createLinearGradient(left?x:x+pw,0,left?x+pw*.6:x+pw*.4,0);cw.addColorStop(0,rgba(cc,.32));cw.addColorStop(1,rgba(cc,0));ctx.fillStyle=cw;ctx.fillRect(x,y,pw,ph);ctx.restore();
  chrome(x,y,pw,ph,R0,cc);
  const P=12,ix=x+P,iw=pw-P*2,al=left?'left':'right',ar=left?'right':'left',L=left?ix:ix+iw,Rr=left?ix+iw:ix;
  /* row 1: corner dot · name · stance chip ........ HP% */
  ctx.textBaseline='alphabetic';
  ctx.fillStyle=cc;ctx.shadowColor=cc;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(left?L+4:L-4,y+16,3.5,0,7);ctx.fill();ctx.shadowBlur=0;
  ctx.font='16px "Black Han Sans",sans-serif';let nm=F.nick;while(ctx.measureText(nm).width>iw*.5&&nm.length>2)nm=nm.slice(0,-1);
  ctx.save();ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=3;disp(nm,left?L+13:L-13,y+22,16,'#ffffff',al);ctx.restore();
  ctx.font='16px "Black Han Sans",sans-serif';const nw=ctx.measureText(nm).width;
  {const t=F.stance==='south'?'SOUTHPAW':'ORTHODOX';ctx.font=`700 8px ${NUM},sans-serif`;const tw=ctx.measureText(t).width+10,cx0=left?L+13+nw+8:L-13-nw-8-tw;
    ctx.beginPath();ctx.roundRect(cx0,y+12,tw,12,6);ctx.fillStyle='rgba(255,255,255,.08)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1;ctx.stroke();ctx.textBaseline='middle';num(t,cx0+tw/2,y+18.5,8,F.stance==='south'?'#7fe3ff':'#b9c3d3','center')}
  const hp=Math.max(0,Math.round(Math.min(F.head,F.body,F.legs)));ctx.textBaseline='alphabetic';if(left){num(String(hp),Rr-9,y+23,19,hp<30?'#ffb02e':'#f2f4f8','right');num('%',Rr,y+23,10,'rgba(214,220,230,.6)','right')}else{num(String(hp),Rr,y+23,19,hp<30?'#ffb02e':'#f2f4f8','left');ctx.font=`700 19px ${NUM},sans-serif`;num('%',Rr+ctx.measureText(String(hp)).width+2,y+23,10,'rgba(214,220,230,.6)','left')}
  /* row 2: health with damage ghost */
  F._gh=F._gh==null?F.head:Math.max(F.head,F._gh-.25);
  const hc=F.head<30?'#ffb02e':F.head<55?'#ffd54a':(left?'#4f8ff7':'#f05545');
  lux(ix,y+29,iw,11,F.head/100,F._gh/100,hc,shade(hc,.78),!left,10);
  /* row 3: stamina | left leg | right leg — one baseline, equal gaps */
  const sw=iw*.46,gw=(iw-sw-16)/2,sc=F.exh?'#8e97a6':F.st<25?'#c0c6d0':'#f2c043';
  const cols=left?[[ix,sw,'STA',F.st/100,sc],[ix+sw+8,gw,'L',null],[ix+sw+16+gw,gw,'R',null]]:[[ix,gw,'L',null],[ix+gw+8,gw,'R',null],[ix+2*gw+16,sw,'STA',F.st/100,sc]];
  for(const [cx0,w,lab,v,c] of cols){if(lab==='STA'){miniBar(cx0,y+45,w,lab,v,c,!left);continue}
    const lv=clamp((F['lg'+lab]??F.legs)/100,0,1),lc=lv<.3?'#ff5a4a':lv<.6?'#e8b33a':'#4cc38a';miniBar(cx0,y+45,w,lab,lv,lc,!left);
    if(lv<.3&&Math.floor(S.frame/10)%2){ctx.strokeStyle='rgba(255,90,74,.9)';ctx.lineWidth=1;ctx.strokeRect(cx0-1.5,y+43.5,w+3,9)}}
  /* row 4 (outside the plate, tucked under): special diamonds + status tags */
  const ry=y+ph+9;for(let i=0;i<5;i++){const fill=clamp(F.meter/20-i,0,1),px=left?x+16+i*13:x+pw-16-i*13;
    ctx.save();ctx.translate(px,ry);ctx.rotate(Math.PI/4);ctx.fillStyle='rgba(10,13,19,.7)';ctx.fillRect(-4,-4,8,8);ctx.strokeStyle='rgba(220,226,236,.35)';ctx.lineWidth=.8;ctx.strokeRect(-4,-4,8,8);
      if(fill>0){ctx.globalAlpha=fill;ctx.fillStyle=F.meter>=100?'#ffd75e':'#b98cff';if(F.meter>=100){ctx.shadowColor='#ffd75e';ctx.shadowBlur=10}ctx.fillRect(-2.8,-2.8,5.6,5.6)}ctx.restore()}
  const tags=[];if(F.meter>=100)tags.push(['필살기 READY','#ffd75e']);if(F.heart>0)tags.push(['투혼','#ff6a55']);if(F.exh)tags.push(['탈진','#c0c6d0']);
  if(F.inj){const t=Object.keys(F.inj).map(k=>({hand:'손',knee:'무릎',rib:'갈비',eye:'눈'})[k]).join('·');if(t)tags.push(['부상 '+t,'#ff8b7f'])}
  let tx=left?x+16+5*13+4:x+pw-16-5*13-4;ctx.textBaseline='middle';
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
  {const f=S.feed[S.feed.length-1];if(f&&f.t>40){const wideV=VH/W<.56,a=Math.min(1,(f.t-40)/20,f.t/30);
    const fw=Math.min(WH*(wideV?.44:.86),420),fx=WH/2-fw/2,fy=wideV?100:HH-34,h=22;
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
const STYLE_LINE={kickboxer:'긴 다리로 거리를 지배하는 킥 스페셜리스트',boxer:'날카로운 손기술과 카운터의 장인',muaythai:'팔꿈치와 니킥, 클린치에서 가장 위험한 남자',karate:'번개 같은 출입과 예측 불가한 킥',wrestler:'한 번 잡으면 놓지 않는 레슬링 머신',bjj:'바닥으로 가는 순간 끝나는 서브미션 사냥꾼',sambo:'던지고 누르고 꺾는 삼보의 압박',brawler:'모든 주먹에 KO를 담는 난타전의 왕',allround:'어디서 싸워도 약점이 없는 완성형'};
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
const TIERL={practice:0,regional:0,prelim:1,main:2,title:3};
/* deterministic spark fountain (gerb): sparks shoot up from (x,y) and fall back */
function gerb(x,y,h,t,n,col){ctx.save();ctx.globalCompositeOperation='lighter';
  const g=ctx.createRadialGradient(x,y,0,x,y,h*.45);g.addColorStop(0,'rgba(255,190,90,.55)');g.addColorStop(1,'rgba(255,120,30,0)');ctx.fillStyle=g;ctx.fillRect(x-h*.45,y-h*.45,h*.9,h*.9);
  for(let i=0;i<n;i++){const s=(i*97.13)%1,life=34+(i*13%20),age=(t+i*7)%life,k=age/life,vx=(Math.sin(i*12.9)*.55)*h*.012,vy=-(h/life)*(1.6+s*.6);
    const px=x+vx*age,py=y+vy*age+.5*(h*.0045)*age*age;ctx.globalAlpha=(1-k)*.9;ctx.fillStyle=k<.3?'#fff4c8':k<.6?'#ffb347':col||'#ff6a1a';ctx.fillRect(px,py,1.6,3+4*(1-k))}
  ctx.restore()}
/* firework shell bursting at (x,y) */
function burstFW(x,y,t,col,r){if(t<0||t>70)return;const k=t/70;ctx.save();ctx.globalCompositeOperation='lighter';
  for(let i=0;i<28;i++){const a=i/28*Math.PI*2,d=r*Math.sqrt(k)*(1+((i*7)%3)*.08),px=x+Math.cos(a)*d,py=y+Math.sin(a)*d+k*k*40;ctx.globalAlpha=(1-k);ctx.fillStyle=i%3?col:'#fff6d8';ctx.beginPath();ctx.arc(px,py,2.2*(1-k*.5),0,7);ctx.fill()}
  ctx.restore()}
/* front-facing stage reveal: truss, LED walls, smoking tunnel, runway and spark fountains */
function stageReveal(S,F,t){
  const W0=WH,H0=HH,cx=W0/2,AR=S.arena||{k:'main'},L=TIERL[AR.k]??2,col=F.corner,horizon=H0*.6;
  const bg=ctx.createLinearGradient(0,0,0,H0);bg.addColorStop(0,'#030407');bg.addColorStop(1,'#0b0d13');ctx.fillStyle=bg;ctx.fillRect(0,0,W0,H0);
  /* crowd silhouettes left and right */
  for(let i=0;i<70;i++){const side=i%2?1:-1,row=(i*7)%5,px=cx+side*(W0*.28+((i*37)%100)/100*W0*.25),py=horizon+12+row*10+((i*13)%7);ctx.fillStyle=`rgba(20,22,30,${.9})`;ctx.beginPath();ctx.arc(px,py,5+row,0,7);ctx.fill();ctx.fillRect(px-6-row,py+3,12+row*2,14)}
  /* truss + blinking bulbs */
  const tw=W0*.66,tx=cx-tw/2,ty=H0*.1,th=horizon-ty;ctx.fillStyle='#14171d';ctx.fillRect(tx-8,ty-8,tw+16,10);ctx.fillRect(tx-8,ty,10,th);ctx.fillRect(tx+tw-2,ty,10,th);
  for(let i=0;i<=24;i++){const bx=tx+tw*i/24,on=((i+Math.floor(t/6))%3)!==0;ctx.fillStyle=on?(i%4?'#fff8e6':rgba(col,1)):'#3a3d44';ctx.beginPath();ctx.arc(bx,ty-3,3,0,7);ctx.fill();if(on){const g=ctx.createRadialGradient(bx,ty-3,0,bx,ty-3,14);g.addColorStop(0,i%4?'rgba(255,248,230,.5)':rgba(col,.6));g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(bx-14,ty-17,28,28)}}
  for(let j=1;j<=6;j++){for(const sx of [tx-3,tx+tw+3]){const by=ty+th*j/7,on=((j+Math.floor(t/5))%2)===0;ctx.fillStyle=on?rgba(col,1):'#2c3038';ctx.beginPath();ctx.arc(sx,by,2.6,0,7);ctx.fill()}}
  /* LED walls with the fighter flexing, and the event logo in the middle */
  const sw=tw*.27,sh=th*.86,sy=ty+8;
  for(const sx of [tx+10,tx+tw-10-sw]){ctx.fillStyle='#070a12';ctx.fillRect(sx,sy,sw,sh);const g=ctx.createLinearGradient(sx,sy,sx,sy+sh);g.addColorStop(0,rgba(col,.35));g.addColorStop(1,'rgba(8,10,16,.9)');ctx.fillStyle=g;ctx.fillRect(sx,sy,sw,sh);
    ctx.save();ctx.beginPath();ctx.rect(sx,sy,sw,sh);ctx.clip();const sc=sh/300;ctx.translate(sx+sw/2,sy+sh+20*sc);ctx.scale(sc,sc);ctx.translate(-400,-GY);
    const P={...F,x:400,f:sx<cx?1:-1,state:'celebrate',A:null,t:0,react:null,rocked:0};P._t=t;drawBody(P,poseStand(P,P,{frame:t,cl:null}));ctx.restore();
    ctx.fillStyle='rgba(0,0,0,.18)';for(let y=sy;y<sy+sh;y+=3)ctx.fillRect(sx,y,sw,1)}
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.round(th*.15)}px "Black Han Sans",sans-serif`;
  const lg=ctx.createLinearGradient(0,ty+th*.2,0,ty+th*.38);lg.addColorStop(0,'#ffffff');lg.addColorStop(.5,'#9aa3b2');lg.addColorStop(1,'#e9edf3');ctx.fillStyle=lg;ctx.fillText('IRON CAGE',cx,ty+th*.28);
  ctx.font=`700 ${Math.round(th*.06)}px "Rajdhani",sans-serif`;ctx.fillStyle='#e8b33a';ctx.fillText((AR.name||'').toUpperCase?AR.name:'',cx,ty+th*.4);
  /* tunnel door: backlit haze, the fighter walking out of it */
  const dw=tw*.26,dh=th*.42,dx=cx-dw/2,dy=horizon-dh;ctx.fillStyle='#000';ctx.fillRect(dx-6,dy-6,dw+12,dh+6);
  const tg=ctx.createRadialGradient(cx,dy+dh*.6,4,cx,dy+dh*.6,dw*.8);tg.addColorStop(0,rgba(col,.75));tg.addColorStop(.5,'rgba(120,110,160,.35)');tg.addColorStop(1,'rgba(10,10,20,.9)');ctx.fillStyle=tg;ctx.fillRect(dx,dy,dw,dh);
  for(let i=0;i<=8;i++){const bx=dx+dw*i/8;ctx.fillStyle=((i+Math.floor(t/4))%2)?'#fff':'#555';ctx.beginPath();ctx.arc(bx,dy-3,2,0,7);ctx.fill()}
  const walk=clamp((t-12)/60,0,1),fs=lerp(.42,.9,walk),fy=lerp(horizon,horizon+H0*.1,walk);
  ctx.save();ctx.translate(cx,fy);ctx.scale(fs*dh/300,fs*dh/300);ctx.translate(-400,-GY);const P={...F,x:400,f:1,state:walk<1?'walk':'idle',walk:t*.2,A:null,react:null,rocked:0};P._t=t;
  ctx.filter='brightness(.35)';drawBody(P,poseStand(P,P,{frame:t,cl:null}));ctx.filter='none';ctx.restore();
  /* runway in corner colour with LED edge lights, receding to the door */
  ctx.beginPath();ctx.moveTo(cx-dw*.42,horizon);ctx.lineTo(cx+dw*.42,horizon);ctx.lineTo(cx+W0*.2,H0);ctx.lineTo(cx-W0*.2,H0);ctx.closePath();
  const rg=ctx.createLinearGradient(0,horizon,0,H0);rg.addColorStop(0,shade(col,.35));rg.addColorStop(1,shade(col,.6));ctx.fillStyle=rg;ctx.fill();
  for(let i=0;i<9;i++){const k=((i/9)+t*.012)%1,yy=lerp(horizon,H0,k*k),half=lerp(dw*.42,W0*.2,k*k)+8;ctx.fillStyle='rgba(255,250,235,.9)';ctx.fillRect(cx-half-3,yy,5*(.4+k),2*(.4+k));ctx.fillRect(cx+half-2,yy,5*(.4+k),2*(.4+k))}
  /* haze */
  for(let i=0;i<10;i++){const hx=cx+Math.sin(t*.02+i)*W0*.3,hy=horizon+Math.sin(t*.017+i*2)*20,r=W0*.12;const g=ctx.createRadialGradient(hx,hy,0,hx,hy,r);g.addColorStop(0,'rgba(200,205,225,.08)');g.addColorStop(1,'rgba(200,205,225,0)');ctx.fillStyle=g;ctx.fillRect(hx-r,hy-r,r*2,r*2)}
  /* spark fountains: more and taller the bigger the event */
  if(L>=1){const n=L>=3?4:L>=2?2:2,hh=H0*(L>=3?.9:L>=2?.7:.45);const xs=n===4?[W0*.04,W0*.24,W0*.76,W0*.96]:[W0*.1,W0*.9];for(const gx of xs)gerb(gx,H0+4,hh,t,L>=3?140:90)}
  if(L>=3&&t%46<4){ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(0,0,W0,H0)}
  ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.globalAlpha=clamp((t-20)/15,0,1);disp(`"${F.nick}"`,cx,H0-22,Math.min(30,W0*.05),'#ffffff','center');ctx.globalAlpha=1}
/* cage-side pyro when a fighter steps into the octagon / is announced */
function cagePyro(S,P){if(!P)return;const AR=S.arena||{k:'main'},L=TIERL[AR.k]??2,t=P.t;if(L<1||t>110)return;
  const hh=HH*(L>=3?.8:L>=2?.6:.38);gerb(WH*.06,HH+4,hh,t,L>=3?120:70);gerb(WH*.94,HH+4,hh,t,L>=3?120:70);if(L>=3){gerb(WH*.3,HH+4,hh*.8,t+9,80);gerb(WH*.7,HH+4,hh*.8,t+9,80)}
  if(L>=2&&(P.at==='ann'||P.at==='cage')){const c=S.walk&&/^blue/.test(S.walk.k)?S.a.corner:S.b.corner;burstFW(WH*.25,HH*.22,t-6,c,90);burstFW(WH*.75,HH*.18,t-18,'#e8b33a',110);if(L>=3){burstFW(WH*.5,HH*.12,t-28,'#ffffff',130);burstFW(WH*.15,HH*.3,t-38,c,80);burstFW(WH*.85,HH*.28,t-44,c,80)}}
  if(t<6){ctx.fillStyle=`rgba(255,200,120,${.25*(1-t/6)})`;ctx.fillRect(0,0,WH,HH)}}
/* broadcast "tale of the tape" slide */
function koRate(d){const r=d.rec||[0,0,0],w=r[0]||0;return clamp(Math.round(25+((d.s&&d.s.pow)||70)*.5-20+(IC.hash?IC.hash(d.name||'')%15:0)),10,88)}
function tapeSlide(S,t){const A=S.a.d,B=S.b.d,p=clamp(t/18,0,1),e=1-Math.pow(1-p,3),w=Math.min(WH*.86,560),OD=S.odds,oh=OD?40:0,h=Math.min(HH*.88,300+oh),x=WH/2-w/2,y=Math.max(8,HH*.06)+(1-e)*30;
  ctx.save();ctx.globalAlpha=e*clamp((230-t)/14,0,1);frost(x,y,w,h,16,.82);chrome(x,y,w,h,16,'#e8b33a');
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
function walkOverlay(S){
  const W=S.walk,k=W.k||'',F=/^blue/.test(k)?S.a:/^red/.test(k)?S.b:null,t=W.t,isA=/Aisle$/.test(k),isAnn=/Ann$/.test(k);
  if(isA&&t<80){stageReveal(S,F,t);liveBug(S);return}
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
  if(k==='tape')tapeSlide(S,t);
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
  if(F&&isAnn){
    const p=clamp((t+170)/26,0,1),e=1-Math.pow(1-p,3),cw=Math.min(WH*.86,440),ch=92,x=lerp(-cw,WH/2-cw/2,e),y=HH-ch-16;
    const grd=ctx.createLinearGradient(x,0,x+cw,0);grd.addColorStop(0,rgba(F.corner,.95));grd.addColorStop(.32,'rgba(12,14,19,.95)');grd.addColorStop(1,'rgba(12,14,19,.88)');
    ctx.fillStyle=grd;ctx.beginPath();ctx.roundRect(x,y,cw,ch,6);ctx.fill();ctx.fillStyle='#e8b33a';ctx.fillRect(x,y+ch-3,cw*e,3);
    ctx.textBaseline='alphabetic';const d=F.d,rec=d.rec||[0,0,0];
    txt(F.side==='a'?'블루 코너':'레드 코너',x+16,y+20,11,'rgba(255,255,255,.85)','left','700');
    disp(`"${F.nick}"`,x+16,y+48,Math.min(26,cw*.06),'#ffffff','left');
    txt(F.name,x+16,y+68,13,'#e9e6df','left','700');
    txt(`${rec[0]}-${rec[1]}-${rec[2]} · ${IC.STYLES[d.style].name} · ${d.from} · ${d.height||''}cm · 종합 ${d.ovr}`,x+16,y+85,10.5,'rgba(233,230,223,.75)','left','600');
  }
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
  const r=S.result,t=S.decT;if(!r||!r.cards)return;
  const bw=Math.min(WH*.8,380),bx=WH/2-bw/2,by=HH*.2;
  ctx.fillStyle='rgba(10,12,16,.9)';ctx.beginPath();ctx.roundRect(bx,by,bw,170,8);ctx.fill();
  ctx.textBaseline='alphabetic';
  disp('심판 판정',WH/2,by+30,20,'#e8b33a','center');
  r.cards.forEach((c,i)=>{if(t<50+i*40)return;const y=by+62+i*26;txt(`심판 ${i+1}`,bx+20,y,12,'#8e97a6','left','700');
    disp(`${c[0]} - ${c[1]}`,WH/2,y,17,'#f2efe8','center');const w=c[0]>c[1]?S.a:c[1]>c[0]?S.b:null;txt(w?w.nick:'무승부',bx+bw-20,y,12,w?shade(w.corner,1.4):'#e9e6df','right','700')});
  if(t>180){const w=r.winner?(r.winner==='a'?S.a:S.b):null;disp(w?`${r.detail} · ${w.nick}`:r.detail,WH/2,by+150,16,'#ffd75e','center')}
}
function replayOverlay(S){
  const bh=HH*.09;ctx.fillStyle='#000';ctx.fillRect(0,0,WH,bh);ctx.fillRect(0,HH-bh,WH,bh);
  ctx.fillStyle='#d23a2c';ctx.beginPath();ctx.roundRect(12,bh+10,64,20,3);ctx.fill();ctx.textBaseline='middle';txt('REPLAY',44,bh+20,11,'#fff','center','700');
  ctx.fillStyle='rgba(255,255,255,.2)';ctx.fillRect(12,HH-bh-12,WH-24,3);ctx.fillStyle='#e8b33a';ctx.fillRect(12,HH-bh-12,(WH-24)*(S.rpProg||0),3);
  if(S.rp&&S.rp.hl){ctx.textBaseline='middle';txt('하이라이트',86,bh+20,11,'#e8b33a','left','700');disp(S.rp.label||'',WH/2,HH-bh-34,Math.min(22,WH*.045),'#ffffff','center')}
}
/* stance switch callout: slides up under the fighters for ~1.3s */
function stanceCall(S){const C=S.stCall;if(!C)return;const k=S.frame-C.f;if(k<0||k>80)return;const a=Math.min(1,k/6)*Math.min(1,(80-k)/12),sl=1-Math.pow(1-Math.min(1,k/10),3);
  const sp=C.s==='south',col=sp?'#7fe3ff':'#ffd27a',w=Math.min(WH*.62,340),h=50,x=WH/2-w/2,y=HH*.62+(1-sl)*24;
  ctx.save();ctx.globalAlpha=a;frost(x,y,w,h,14,.78);chrome(x,y,w,h,14,col);
  ctx.textBaseline='middle';ctx.textAlign='center';num('⇄ '+(sp?'SOUTHPAW':'ORTHODOX'),WH/2,y+17,19,col,'center');
  txt((sp?'사우스포':'오소독스')+(C.open?' · 오픈 스탠스 — 뒷손 스트레이트·몸통킥 +12%':' · 클로즈드 스탠스 — 잽 +10%'),WH/2,y+36,10.5,'#e9edf3','center','700');
  /* footwork diagram: which foot leads */
  const fx=x+22,fy=y+h/2;for(const [dx,lead] of [[-6,!sp],[6,sp]]){ctx.fillStyle=lead?col:'rgba(255,255,255,.35)';ctx.beginPath();ctx.ellipse(fx+dx,fy+(lead?-7:7),4,7,0,0,7);ctx.fill()}
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
  HS=clamp(600/(cssW||800),1,1.75);WH=W/HS;HH=VH/HS;
  ctx.save();ctx.scale(HS,HS);
  {const g=(OPT.topGap||0)*W/(cssW||800)/HS;if(g>0){ctx.fillStyle='#07080b';ctx.fillRect(0,0,WH,g);ctx.translate(0,g);HH-=g}}
  if(S.replay)replayOverlay(S);
  else{
    if(!S.demo&&S.mode!=='outro'&&S.mode!=='decision'&&!S.walk){hud(S);comboOverlay(S)}
    if(S.mode==='intro')introOverlay(S);
    if(S.mode==='decision')decisionOverlay(S);
    if(!S.demo&&(!S.walk||/faceoff|touch/.test(S.walk.k||'')))bannerDraw(S);stanceCall(S);
    if(S.mode==='outro'&&S.winSide){ctx.textBaseline='alphabetic';txt('승자',WH/2,HH*.42-46,12,'rgba(233,230,223,.8)','center','700')}
  }
  ctx.restore();
}
function render(S0,c,cssW,cssH,o3d){
  ctx=c;if(o3d)return renderOverlay(S0,c,cssW,cssH,o3d);VH=cssW&&cssH?clamp(W*cssH/cssW,300,1100):H;
  const S=S0.mode==='replay'&&S0.rp?IC.Fight.replayView():S0;
  const inAisle=S.walk&&/Aisle$/.test(S.walk.k||'');
  if(inAisle){aisleScene(S)}else{
  computeCam(S);VPX=cam.x;
  ctx.save();
  let sx=0,sy=0;if(S.shake>.5){sx=(Math.random()-.5)*S.shake*1.3;sy=(Math.random()-.5)*S.shake*1.3}
  if(S.kick){const k=S.kick.t/S.kick.max,ek=Math.sin(k*Math.PI)*k;sx+=S.kick.x*ek;sy+=S.kick.y*ek}
  ctx.translate(W/2+sx,VH/2+sy+(OPT.topGap||0)*W/(cssW||800)*.5);ctx.scale(cam.z,cam.z);ctx.translate(-cam.x,-cam.y);
  arena(S);
  const items=[{z:(S.ref&&S.ref.z)??-50,d:()=>drawRef(S)}];
  if(S.gr)items.push({z:S.gr.cz||0,d:()=>drawGround(S)});
  else for(const F of [S.a,S.b])if(!F.hidden)items.push({z:(F.z||0)+(F.state==='attack'?.5:0),d:()=>drawStandingFighter(F,F===S.a?S.b:S.a,S)});
  items.sort((p,q)=>p.z-q.z).forEach(i=>i.d());
  arenaFront(S);
  impacts(S);
  if(S.walk&&S.walk.k==='faceoff'&&S.walk.bub){const mx=(S.a.x+S.b.x)/2;for(const B of S.walk.bub){const ya=PR(B.F.x,B.F.z||0,200).y,isA=B.F===S.a;bubble(mx+(isA?-118:118),ya-(isA?0:26),B.text,B.F.corner,B.t0,S.walk.t)}}
  for(const r of S.rings){ctx.strokeStyle=`rgba(255,255,255,${r.l/14*.7})`;ctx.lineWidth=r.big?3:2;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,7);ctx.stroke()}
  for(const p of S.sparks){ctx.globalAlpha=Math.min(1,p.l/12);ctx.fillStyle=p.col;if(p.sw||p.drop){ctx.beginPath();if(p.drop){ctx.ellipse(p.x,p.y,p.r||1.8,(p.r||1.8)*(1+Math.min(1.5,Math.abs(p.vy)*.15)),Math.atan2(p.vy,p.vx)+Math.PI/2,0,7)}else ctx.arc(p.x,p.y,1.5,0,7);ctx.fill()}else ctx.fillRect(p.x-1.5,p.y-1.5,3,3)}
  ctx.globalAlpha=1;
  beams(S);
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(const t of S.texts){if(t.num&&!OPT.nums)continue;ctx.globalAlpha=Math.min(1,t.l/20);ctx.font=`${t.num?20:18}px "Black Han Sans",sans-serif`;ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.65)';ctx.strokeText(t.t,t.x,t.y);ctx.fillStyle=t.col;ctx.fillText(t.t,t.x,t.y)}
  ctx.globalAlpha=1;ctx.restore();
  }
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
  HS=clamp(600/(cssW||800),1,1.75);WH=W/HS;HH=VH/HS;
  ctx.save();ctx.scale(HS,HS);
  {const g=(OPT.topGap||0)*W/(cssW||800)/HS;if(g>0){ctx.fillStyle='#07080b';ctx.fillRect(0,0,WH,g);ctx.translate(0,g);HH-=g}}
  if(S.replay)replayOverlay(S);
  else{
    if(!S.demo&&S.mode!=='outro'&&S.mode!=='decision'&&!S.walk){hud(S);comboOverlay(S)}
    if(S.mode==='intro')introOverlay(S);
    if(S.mode==='decision')decisionOverlay(S);
    if(!S.demo&&(!S.walk||/faceoff|touch/.test(S.walk.k||'')))bannerDraw(S);
    if(S.mode==='outro'&&S.winSide){const Wn=S.winSide==='a'?S.a:S.b;ctx.textBaseline='alphabetic';txt('승자',WH/2,HH*.42-46,12,'rgba(233,230,223,.8)','center','700')}
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
  const F={look:d.look,corner,head:100,body:100,legs:100,cuts:0,rocked:0,flash:0,state:'idle',st:100,side,_t:t,kind:'fighter',walkShirt:o.shirt?corner:null};
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
  else if(pose==='strip'){const k=o.k||0;near={x:chest.x+f*8,y:lerp(280,150,k)};far={x:chest.x-f*6,y:lerp(282,152,k)};elbN='fwd';elbF='back'}
  else{near={x:x+f*9,y:290+y0};far={x:x-f*5,y:292+y0}}
  ctx.save();ctx.translate(x,GY);ctx.scale(1.3,1.3);ctx.translate(-x,-GY);
  drawBody(F,{f,hip,chest,tilt:pose==='face'||pose==='push'?.14:pose==='sad'?.32:pose==='walk'?0:-.02,mood:pose==='flex'||pose==='double'||pose==='point'||pose==='over'||pose==='hand'?'yell':null,nearHand:near,farHand:far,nearFoot:nf,farFoot:ff,kneeN:'fwd',kneeF:'fwd',elbN,elbF});
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
  const sh=ctx.createLinearGradient(170,0,630,0);sh.addColorStop(0,'rgba(232,179,58,0)');sh.addColorStop((t*.006)%1,'rgba(232,179,58,.12)');sh.addColorStop(1,'rgba(232,179,58,0)');ctx.fillStyle=sh;ctx.fillRect(172,28,456,66);
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
      else if(L<S0.flex[1]){x=400;pose=L>=S0.flex[0]?(cur.res.ok?'flex':'sad'):'stand'}
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
let CONF=null;
const ez=k=>{k=clamp(k,0,1);return k*k*(3-2*k)};
function drawBelt(x,y,s,o={}){
  const sx=o.sx==null?1:o.sx;ctx.save();ctx.translate(x,y);ctx.scale(s*sx,s);
  const kc=!!o.kc,gold=(a,b)=>{const g=ctx.createLinearGradient(0,a,0,b);if(kc){g.addColorStop(0,'#ffffff');g.addColorStop(.35,'#d6dde6');g.addColorStop(.7,'#8a94a3');g.addColorStop(1,'#454c57')}else{g.addColorStop(0,'#fff0b0');g.addColorStop(.35,'#f0c050');g.addColorStop(.7,'#b07f1c');g.addColorStop(1,'#6e4c0c')}return g};
  // leather strap
  const lg=ctx.createLinearGradient(0,-12,0,12);lg.addColorStop(0,kc?'#1a1a1f':'#2b2320');lg.addColorStop(.5,kc?'#08080a':'#151110');lg.addColorStop(1,'#030304');
  ctx.fillStyle=lg;ctx.beginPath();ctx.roundRect(-104,-12,208,24,9);ctx.fill();
  ctx.strokeStyle=kc?'rgba(220,232,245,.8)':'rgba(232,190,90,.75)';ctx.lineWidth=.8;ctx.setLineDash([2.2,1.8]);ctx.beginPath();ctx.moveTo(-100,-9);ctx.lineTo(100,-9);ctx.moveTo(-100,9);ctx.lineTo(100,9);ctx.stroke();ctx.setLineDash([]);
  // side plates
  for(const px of [-84,-58,58,84]){const w=px*px>4000?18:22;ctx.fillStyle=gold(-14,14);ctx.beginPath();ctx.roundRect(px-w/2,-14,w,28,4);ctx.fill();ctx.strokeStyle='#fff3c4';ctx.lineWidth=.7;ctx.stroke();
    ctx.strokeStyle='rgba(110,76,12,.8)';ctx.lineWidth=.6;ctx.strokeRect(px-w/2+2.5,-11.5,w-5,23);
    ctx.fillStyle=kc?'#cfefff':Math.abs(px)>70?'#3d7ff0':'#e04a3a';ctx.beginPath();ctx.arc(px,0,3.2,0,7);ctx.fill();ctx.fillStyle='rgba(255,255,255,.8)';ctx.beginPath();ctx.arc(px-1,-1.1,1,0,7);ctx.fill()}
  // centre plate: octagon with rim, laurels, gem
  const oct=(r,ry)=>{ctx.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;ctx[i?'lineTo':'moveTo'](Math.cos(a)*r,Math.sin(a)*ry)}ctx.closePath()};
  ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=6;ctx.fillStyle=gold(-34,34);oct(46,36);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='#fff6d0';ctx.lineWidth=1.2;ctx.stroke();
  ctx.fillStyle=gold(30,-30);oct(38,29);ctx.fill();ctx.strokeStyle='rgba(110,76,12,.9)';ctx.lineWidth=.8;ctx.stroke();
  ctx.fillStyle=kc?'#050507':'#14100a';oct(29,22);ctx.fill();if(kc){for(let i=0;i<16;i++){const a=i/16*Math.PI*2;ctx.fillStyle='#f4fbff';ctx.beginPath();ctx.arc(Math.cos(a)*42,Math.sin(a)*32.5,1.3,0,7);ctx.fill()}}ctx.strokeStyle=gold(-22,22);ctx.lineWidth=1.4;ctx.stroke();
  // laurels
  ctx.fillStyle=kc?'#c9d3df':'#e6b544';if(!kc)for(const sd of [-1,1])for(let i=0;i<6;i++){const a=Math.PI*.62+i*.2,lx=sd*Math.cos(a)*-19,ly=Math.sin(a)*15-1;ctx.save();ctx.translate(lx,ly);ctx.rotate(sd*(a-Math.PI/2)*-1+sd*.6);ctx.beginPath();ctx.ellipse(0,0,3.2,1.3,0,0,7);ctx.fill();ctx.restore()}
  // gem
  const gg=ctx.createRadialGradient(-2,-2,0,0,0,7);if(kc){gg.addColorStop(0,'#ffffff');gg.addColorStop(.45,'#bfe6ff');gg.addColorStop(1,'#2b4f78')}else{gg.addColorStop(0,'#ffd0d0');gg.addColorStop(.4,'#e02a2a');gg.addColorStop(1,'#5a0606')}ctx.fillStyle=gg;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx[i?'lineTo':'moveTo'](Math.cos(a)*7,Math.sin(a)*7+2)}ctx.fill();ctx.strokeStyle='#fff3c4';ctx.lineWidth=.6;ctx.stroke();
  ctx.fillStyle=kc?'#eef6ff':'#f3cf6a';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 6px sans-serif';ctx.fillText(kc?'KING OF':'IRON CAGE',0,-12);if(kc){ctx.font='bold 5px sans-serif';ctx.fillText('THE CAGE',0,13)}
  ctx.fillStyle=kc?'#3a414c':'#7a5a10';ctx.font='bold 5px sans-serif';ctx.fillText(kc?'IRON CAGE':'WORLD',0,-31);ctx.fillText(kc?'SUPERFIGHT':'CHAMPION',0,31);
  // moving glint
  if(o.glint!=null){ctx.save();oct(46,36);ctx.clip();const gx=-90+o.glint*180,gl=ctx.createLinearGradient(gx-14,-40,gx+14,40);gl.addColorStop(0,'rgba(255,255,255,0)');gl.addColorStop(.5,'rgba(255,255,255,.75)');gl.addColorStop(1,'rgba(255,255,255,0)');ctx.globalCompositeOperation='lighter';ctx.fillStyle=gl;ctx.fillRect(-60,-40,120,80);ctx.restore()}
  ctx.restore();
}
function star(x,y,r,a){ctx.save();ctx.globalAlpha=a;ctx.translate(x,y);ctx.fillStyle='#fff';ctx.beginPath();for(let i=0;i<8;i++){const rr=i%2?r*.18:r,an=i*Math.PI/4;ctx.lineTo(Math.cos(an)*rr,Math.sin(an)*rr)}ctx.fill();ctx.restore()}
function pyro(x,t,t0){if(t<t0)return;ctx.save();ctx.globalCompositeOperation='lighter';
  const fl=ctx.createRadialGradient(x,GY,0,x,GY,70);fl.addColorStop(0,`rgba(255,200,90,${.55+Math.sin(t*.9)*.15})`);fl.addColorStop(1,'rgba(255,120,30,0)');ctx.fillStyle=fl;ctx.fillRect(x-70,GY-70,140,90);
  for(let i=0;i<90;i++){const h=((i*2654435761)>>>0)/4294967296,h2=((i*40503+17)%997)/997,age=((t-t0)*1.1+i*6.7)%62;const v=8+h*5,dx=(h2-.5)*34;
    const px=x+dx*age/22,py=GY-(v*age-.11*age*age);if(py>GY)continue;const a=1-age/62;ctx.fillStyle=`rgba(255,${170+(h*80|0)},${60+(h2*90|0)},${a})`;ctx.beginPath();ctx.arc(px,py,1.2+a*2.2,0,7);ctx.fill()}
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
    if(F.state==='ko'){const a=Math.min(1,F.koT/22)*Math.PI/2*.94;ctx.translate(F.x-F.f*22,GY-4);ctx.rotate(-F.f*a);ctx.translate(-(F.x-F.f*22),-(GY-4));J.mood='ko'}
    const r=drawBody(F,J);ctx.restore();
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
    drawBelt(0,0,3.2,{sx:.86+.14*Math.cos(k*Math.PI*1.2-.6),glint:((t-B.close)%90)/90,cls:o.clsEn,kc:o.kc});ctx.restore();
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
  ctx.restore();ctx.save();ctx.translate(0,oy);
  // ---- captions ----
  ctx.textAlign='center';ctx.textBaseline='middle';
  if(t<B.close){
    const lines=['레이디스 앤 젠틀맨…',o.kc?'IRON CAGE 슈퍼파이트의 승자는…':`IRON CAGE ${cls} 타이틀전의 승자는…`];const li=t<50?0:1;const a=ez(t/14);
    ctx.globalAlpha=a*(t<B.reveal?1:clamp(1-(t-B.reveal)/10,0,1));ctx.fillStyle='rgba(5,7,10,.78)';ctx.fillRect(140,382,520,44);ctx.fillStyle='#e8b33a';ctx.fillRect(140,382,4,44);
    ctx.font='700 16px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#fff';const s=lines[li],n=Math.min(s.length,Math.floor((t-(li?50:0))*.9));ctx.fillText(s.slice(0,n),400,404);ctx.globalAlpha=1;
    if(t>=B.reveal){const k=ez((t-B.reveal)/16),big=o.kc?(o.def?'STILL THE KING!':'KING OF THE CAGE!'):o.def?'AND STILL!':'AND NEW!';ctx.save();ctx.translate(400,82);ctx.scale(1.6-.6*k,1.6-.6*k);ctx.globalAlpha=k;ctx.font='54px "Black Han Sans",sans-serif';ctx.lineWidth=9;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText(big,0,0);ctx.fillStyle='#ffd75e';ctx.fillText(big,0,0);ctx.restore();
      ctx.globalAlpha=k;ctx.font='700 17px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#fff';ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.6)';const tx=`${o.def?'여전히 ':''}${o.kc?'킹 오브 케이지':cls+' 챔피언'} · "${d.nick}" ${d.name}`;ctx.strokeText(tx,400,124);ctx.fillText(tx,400,124);ctx.globalAlpha=1;
      if(t-B.reveal<10){ctx.fillStyle=`rgba(255,255,255,${.7*(1-(t-B.reveal)/10)})`;ctx.fillRect(0,-oy,800,VHw)}}
  }else if(t<B.lift){const a=ez((t-B.wrap)/20);ctx.globalAlpha=a;ctx.fillStyle='rgba(5,7,10,.78)';ctx.fillRect(140,382,520,44);ctx.fillStyle='#e8b33a';ctx.fillRect(140,382,4,44);
    ctx.font='700 15px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#fff';ctx.fillText(t<B.wrap+120?'IRON CAGE 대표가 벨트를 들고 옥타곤에 오릅니다':'챔피언의 허리에 벨트가 감깁니다',400,404);ctx.globalAlpha=1;
    const fa=clamp(1-(t-B.wrap)/14,0,1);if(fa>0){ctx.fillStyle=`rgba(255,255,255,${fa})`;ctx.fillRect(0,-oy,800,VHw)}}
  else{const k=ez((t-B.lift-40)/30);ctx.globalAlpha=k;
    ctx.textAlign='left';ctx.font='38px "Black Han Sans",sans-serif';ctx.lineWidth=8;ctx.strokeStyle='rgba(0,0,0,.7)';const big=o.def?`${o.def}차 방어 성공`:o.kc?'킹 오브 케이지 등극':'새 챔피언 탄생',bx=lerp(820,o.kc?400:470,k);ctx.strokeText(big,bx,150);ctx.fillStyle='#ffd75e';ctx.fillText(big,bx,150);ctx.font='700 13px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='#fff';ctx.fillText(o.kc?'체급을 넘어선 최강자':`${cls} · IRON CAGE`,bx+2,182);
    const lx=lerp(-420,140,k);ctx.fillStyle='rgba(5,7,10,.85)';ctx.fillRect(lx,368,520,62);ctx.fillStyle='#e8b33a';ctx.fillRect(lx,368,520,4);
    ctx.textAlign='left';ctx.font='20px "Black Han Sans",sans-serif';ctx.fillStyle='#fff';ctx.fillText(`제${o.no||1}대 ${o.kc?'킹 오브 케이지':cls+' 챔피언'}  ${d.name}`,lx+16,392);
    ctx.font='600 12px "IBM Plex Sans KR",sans-serif';ctx.fillStyle='rgba(255,255,255,.75)';ctx.fillText([o.rec,o.ev,o.how].filter(Boolean).join('  ·  '),lx+16,414);ctx.globalAlpha=1}
  ctx.restore();
  const vg=ctx.createRadialGradient(400,VHw/2,VHw*.35,400,VHw/2,720);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.5)');ctx.fillStyle=vg;ctx.fillRect(0,0,800,VHw);
}
/* 선수 초상 */
function portrait(canvas,d,side,mode){
  const dpr=Math.min(2,window.devicePixelRatio||1),cw=canvas.clientWidth||150,ch=canvas.clientHeight||Math.round(cw*190/150);
  canvas.width=cw*dpr;canvas.height=ch*dpr;
  ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);
  const corner=side==='b'?'#e04a3a':'#3d7ff0';
  const bg=ctx.createRadialGradient(cw*.5,ch*.35,4,cw*.5,ch*.4,cw*.9);bg.addColorStop(0,rgba(corner,.28));bg.addColorStop(1,rgba(corner,0));ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);
  const F={look:d.look,corner,head:100,body:100,legs:100,cuts:0,rocked:0,flash:0,state:'idle',st:100,side,_t:0};
  const f=side==='b'?-1:1,x=0;
  const J={f,hip:{x,y:300},chest:{x:x+f*2,y:234},tilt:.05,nearHand:{x:x+f*30,y:221},farHand:{x:x+f*15,y:216},nearFoot:{x:x+f*26,y:GY},farFoot:{x:x-f*24,y:GY},kneeN:'fwd',kneeF:'fwd'};
  ctx.save();
  if(mode==='bust'){const k=cw/62;ctx.translate(cw/2,0);ctx.scale(k,k);ctx.translate(-2,-182)}
  else{const k=ch/215;ctx.translate(cw/2,0);ctx.scale(k,k);ctx.translate(0,-178)}
  drawBody(F,J);
  ctx.restore();
}

function solve(J){
  const f=J.f,sp=vsub(J.chest,J.hip),sd=vn(sp),fwd=vmul({x:-sd.y,y:sd.x},f);
  const shB=vadd(J.chest,vmul(sd,-5));
  const head=J.head||vadd(vadd(J.chest,vmul(sd,21)),vmul(fwd,3));
  const shN=vadd(shB,vmul(fwd,4)),shF=vadd(shB,vmul(fwd,-5)),hipN=vadd(J.hip,vmul(fwd,3)),hipF=vadd(J.hip,vmul(fwd,-3));
  const legF=ik(hipF,J.farFoot,46,44,J.kneeF||'fwd',f),legN=ik(hipN,J.nearFoot,46,44,J.kneeN||'fwd',f);
  const armF=ik(shF,J.farHand,27,26,J.elbF||'down',f),armN=ik(shN,J.nearHand,27,26,J.elbN||'down',f);
  return{f,hip:J.hip,chest:J.chest,head,hAng:Math.atan2(sd.y,sd.x)+Math.PI/2+(J.tilt||0)*f,shN,shF,hipN,hipF,kneeN:legN.j,kneeF:legF.j,footN:legN.end,footF:legF.end,elbN:armN.j,elbF:armF.j,handN:armN.end,handF:armF.end,footDirN:J.footN||f,footDirF:J.footF||f,mood:J.mood};
}
IC.Draw={render,portrait,weighin,beltScene,koScene,KOI,BELT,WI,WTRASH,cam,rig:{solve,poseStand,poseRef,groundJ,ext}};
})(window.IC);

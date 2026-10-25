/* 아이언 케이지 — KO 명장면 픽셀 GIF 녹화기 + 앨범 저장소 (외부 라이브러리 없이 직접 구현)
   경기 중 마지막 3초를 저해상도 링 버퍼에 담아 두었다가, 피니시가 나오면 64색 레트로 팔레트 GIF로 굽고
   IndexedDB에 상위 5개 장면만 보관한다. */
(function(IC){
const W=176,H=99,FPS=12,KEEP=3.0,SLOTS=5;
/* ---------- GIF89a encoder: fixed 64-colour palette (2 bits per channel) + LZW ---------- */
function encodeGif(frames,w,h,delayCs){
  const out=[];const b=v=>out.push(v&255),w16=v=>{b(v);b(v>>8)},str=s=>{for(const c of s)b(c.charCodeAt(0))};
  str('GIF89a');w16(w);w16(h);b(0xF5);b(0);b(0); // global colour table, 64 entries (2^(5+1))
  for(let i=0;i<64;i++){b(((i>>4)&3)*85);b(((i>>2)&3)*85);b((i&3)*85)}
  b(0x21);b(0xFF);b(11);str('NETSCAPE2.0');b(3);b(1);w16(0);b(0); // loop forever
  for(const px of frames){
    b(0x21);b(0xF9);b(4);b(0);w16(delayCs);b(0);b(0);
    b(0x2C);w16(0);w16(0);w16(w);w16(h);b(0);
    lzw(px,6,out)}
  b(0x3B);return new Uint8Array(out)}
function lzw(idx,minSize,out){
  out.push(minSize);const clear=1<<minSize,eoi=clear+1;let size=minSize+1,next=eoi+1,dict=new Map(),cur=0,bits=0;const buf=[];
  const emit=c=>{cur|=c<<bits;bits+=size;while(bits>=8){buf.push(cur&255);cur>>=8;bits-=8}};
  emit(clear);let prefix=idx[0];
  for(let i=1;i<idx.length;i++){const k=idx[i],key=prefix*256+k,hit=dict.get(key);
    if(hit!==undefined){prefix=hit;continue}
    emit(prefix);
    if(next<4096){dict.set(key,next++);if(next>(1<<size)&&size<12)size++}
    else{emit(clear);dict=new Map();size=minSize+1;next=eoi+1}
    prefix=k}
  emit(prefix);emit(eoi);if(bits>0)buf.push(cur&255);
  for(let i=0;i<buf.length;i+=255){const n=Math.min(255,buf.length-i);out.push(n);for(let j=0;j<n;j++)out.push(buf[i+j])}
  out.push(0)}
/* posterise to the retro palette with a light ordered dither so gradients stay pixel-art */
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function quantize(img){const d=img.data,n=W*H,o=new Uint8Array(n);
  for(let i=0;i<n;i++){const x=i%W,y=(i/W)|0,t=(BAYER[(y&3)*4+(x&3)]-7.5)*4.5,p=i*4;
    const r=Math.max(0,Math.min(255,d[p]+t)),g=Math.max(0,Math.min(255,d[p+1]+t)),bl=Math.max(0,Math.min(255,d[p+2]+t));
    o[i]=(Math.round(r/85)<<4)|(Math.round(g/85)<<2)|Math.round(bl/85)}return o}
/* ---------- ring buffer of the last few seconds ---------- */
const cap=document.createElement('canvas');cap.width=W;cap.height=H;const cx=cap.getContext('2d',{willReadFrequently:true});
let ring=[],last=0,pending=null;const pool=[];
/* keep each frame as a tiny canvas (stays on the GPU); pixels are read back only when a finish is baked,
   so the fight never pays for a GPU→CPU readback while it is being played */
function capture(srcs,S){
  const now=performance.now();if(now-last<1000/FPS)return;last=now;
  try{const keep=Math.ceil((KEEP+1.2)*FPS);let c=ring.length>=keep?ring.shift().c:(pool.pop()||null);
    if(!c){c=document.createElement('canvas');c.width=W;c.height=H}
    const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,W,H);for(const s of srcs)if(s&&s.width&&!s.hidden)x.drawImage(s,0,0,W,H);
    ring.push({c,t:now})}catch(e){}
  if(pending&&now-pending.at>650){const p=pending;pending=null;const fr=ring.filter(f=>f.t>=p.at-KEEP*1000&&f.t<=p.at+650);
    const imgs=[];for(const f of fr){try{cx.clearRect(0,0,W,H);cx.drawImage(f.c,0,0);imgs.push({img:cx.getImageData(0,0,W,H)})}catch(e){}}
    bake(imgs,p.meta)}}
function finishSeen(meta){if(pending)return;pending={at:performance.now(),meta}}
function reset(){for(const f of ring)pool.push(f.c);ring=[];pending=null}
function bake(fr,meta){if(fr.length<6)return;
  const frames=[];let i=0;const step=()=>{const t0=performance.now();while(i<fr.length&&performance.now()-t0<8){frames.push(quantize(fr[i].img));i++}
    if(i<fr.length){setTimeout(step,0);return}
    setTimeout(()=>{try{const bytes=encodeGif(frames,W,H,Math.round(100/FPS));const blob=new Blob([bytes],{type:'image/gif'});
      Album.add({...meta,blob,date:Date.now()}).then(r=>{if(Album.onSaved)Album.onSaved(r)})}catch(e){console.error(e)}},0)};
  setTimeout(step,0)}
/* ---------- IndexedDB album: top 5 finishes ---------- */
const Album={onSaved:null,
  db(){if(this._db)return this._db;this._db=new Promise((res,rej)=>{try{const q=indexedDB.open('ironcage-ko',1);q.onupgradeneeded=()=>q.result.createObjectStore('clips',{keyPath:'id',autoIncrement:true});q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}catch(e){rej(e)}});return this._db},
  async list(){try{const db=await this.db();return await new Promise(res=>{const r=db.transaction('clips').objectStore('clips').getAll();r.onsuccess=()=>res((r.result||[]).sort((a,b)=>b.score-a.score||b.date-a.date));r.onerror=()=>res([])})}catch(e){return[]}},
  async add(clip){const db=await this.db();const all=await this.list();
    if(all.length>=SLOTS&&all[all.length-1].score>=clip.score)return{saved:false};
    await new Promise(res=>{const tx=db.transaction('clips','readwrite'),st=tx.objectStore('clips');st.add(clip);if(all.length>=SLOTS)st.delete(all[all.length-1].id);tx.oncomplete=res;tx.onerror=res});
    return{saved:true,clip}},
  async remove(id){const db=await this.db();await new Promise(res=>{const tx=db.transaction('clips','readwrite');tx.objectStore('clips').delete(id);tx.oncomplete=res;tx.onerror=res})}
};
IC.KO={capture,finishSeen,reset,Album,SLOTS,encodeGif};
})(window.IC);

/* 아이언 케이지 — 화면, 모드, 저장 */
(function(IC){
const $=s=>document.querySelector(s);
const scr=$('#scr'),game=$('#game'),cv=$('#cv'),gl=$('#gl'),padL=$('#padL'),padR=$('#padR'),hintEl=$('#hint'),between=$('#between'),pad=$('#pad');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
const money=n=>'$'+Math.round(n).toLocaleString('en-US');
const {STYLES,SPM,STATN,STATS,CLASSES,ROSTER}=IC;
const clsName=id=>(CLASSES.find(c=>c.id===((IC.CLSMAP||{})[id]||id))||{}).name||'';
const DIFFS=IC.Fight.DIFF;

/* ---------- sound ---------- */
const Sound={ac:null,nb:null,on:true,
  init(){if(this.ac||!this.on)return;try{const ac=new (window.AudioContext||window.webkitAudioContext)();const b=ac.createBuffer(1,ac.sampleRate*.5,ac.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.ac=ac;this.nb=b;const b2=ac.createBuffer(2,ac.sampleRate*4,ac.sampleRate);for(let c=0;c<2;c++){const e=b2.getChannelData(c);let l=0;for(let i=0;i<e.length;i++){l=l*.6+(Math.random()*2-1)*.4;e[i]=l*1.6}}this.nb2=b2}catch(e){}},
  noise(dur,type,freq,vol){const ac=this.ac,s=ac.createBufferSource();s.buffer=this.nb;const f=ac.createBiquadFilter();f.type=type;f.frequency.value=freq;const g=ac.createGain(),t=ac.currentTime;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f).connect(g).connect(ac.destination);s.start(t);s.stop(t+dur)},
  tone(fr,dur,vol,type='sine',to){const ac=this.ac,o=ac.createOscillator();o.type=type;const g=ac.createGain(),t=ac.currentTime;o.frequency.setValueAtTime(fr,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+dur)},
  play(k){if(!this.ac||!this.on)return;try{
    if(k==='hit'){this.noise(.14,'lowpass',900,.6);this.tone(110,.12,.5,'sine',50)}
    else if(k==='big'){this.noise(.24,'lowpass',650,.85);this.tone(85,.22,.7,'sine',38)}
    else if(k==='block'){this.noise(.07,'highpass',1800,.25)}
    else if(k==='reveal'){this.tone(55,1.4,.9,'sine',38);this.noise(.6,'lowpass',180,.9);this.noise(2.4,'bandpass',900,.32);this.tone(220,1.2,.08,'sawtooth',110)}
    else if(k==='whoosh'){const ac=this.ac,t=ac.currentTime,sN=ac.createBufferSource();sN.buffer=this.nb;const fl=ac.createBiquadFilter();fl.type='bandpass';fl.Q.value=1.5;fl.frequency.setValueAtTime(700,t);fl.frequency.exponentialRampToValueAtTime(2600,t+.12);const a=ac.createGain();a.gain.setValueAtTime(.0001,t);a.gain.linearRampToValueAtTime(.22,t+.05);a.gain.exponentialRampToValueAtTime(.001,t+.16);sN.connect(fl).connect(a).connect(ac.destination);sN.start(t,Math.random()*.3);sN.stop(t+.18)}
    else if(k==='slam'){this.noise(.35,'lowpass',300,1);this.tone(60,.3,.8,'sine',30)}
    else if(k==='tick'){this.tone(520,.04,.05,'square')}
    else if(k==='coach'){this.tone(740,.07,.07,'square');setTimeout(()=>{try{this.tone(988,.09,.06,'square')}catch(e){}},80)}
    else if(k==='coachok'){this.tone(880,.18,.12,'triangle');setTimeout(()=>{try{this.tone(1320,.25,.1,'triangle')}catch(e){}},90)}
    else if(k==='bell'){this.tone(880,1.2,.25,'triangle');this.tone(1320,1,.12,'sine')}
    else if(k==='crowd'){this.roar(.35)}
    else if(k==='heart'){this.heart()}else if(k==='boo'){this.boo()}else if(k==='applause'){this.applause()}
    else if(k==='ko'){[0,220,440].forEach(d=>setTimeout(()=>{try{this.tone(880,1.6,.3,'triangle')}catch(e){}},d));this.noise(1.8,'bandpass',800,.25)}
  }catch(e){}}
};
/* walkout music: a heavy synth loop with crowd bed, scheduled ahead with WebAudio */
Sound.music=function(on,song){const genre=song&&song.g||'rock',K=song&&song.key||1;
  if(!on){if(this._mus){clearInterval(this._mus.timer);const m=this._mus,g=m.g;try{g.gain.setTargetAtTime(0,this.ac.currentTime,.35)}catch(e){}setTimeout(()=>{try{m.crowd.stop();g.disconnect()}catch(e){}},1600);this._mus=null}return}
  if(!this.ac||!this.on||this._mus)return;
  const ac=this.ac,g=ac.createGain();g.gain.value=0;g.gain.setTargetAtTime(song&&song.vol||.5,ac.currentTime,.5);const comp=ac.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=10;comp.ratio.value=5;comp.attack.value=.003;comp.release.value=.2;g.connect(comp).connect(ac.destination);
  // arena crowd bed: low roar + mid chatter, slowly swelling, through a long non-repeating noise buffer
  const crowd=ac.createBufferSource();crowd.buffer=this.nb2||this.nb;crowd.loop=true;const cmix=ac.createGain();cmix.gain.value=song&&song.crowd||1;cmix.connect(g);
  for(const [f,q,v] of [[420,.7,.34],[1150,1,.16],[2600,1.4,.05]]){const fl=ac.createBiquadFilter();fl.type='bandpass';fl.frequency.value=f;fl.Q.value=q;const cg=ac.createGain();cg.gain.value=v;crowd.connect(fl).connect(cg).connect(cmix);
    const lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=.07+Math.random()*.05;lg.gain.value=v*.45;lfo.connect(lg).connect(cg.gain);lfo.start()}
  crowd.start();
  // arena reverb: generated impulse, everything musical goes through it
  const bus=ac.createGain();bus.connect(g);const conv=ac.createConvolver();{const L=ac.sampleRate*2.6,ir=ac.createBuffer(2,L,ac.sampleRate);for(let c=0;c<2;c++){const e=ir.getChannelData(c);for(let i=0;i<L;i++)e[i]=(Math.random()*2-1)*Math.pow(1-i/L,3.2)}conv.buffer=ir}
  const send=ac.createGain();send.gain.value=song&&song.verb||.28;bus.connect(send).connect(conv).connect(g);
  const dist=ac.createWaveShaper();{const n=1024,c=new Float32Array(n);for(let k=0;k<n;k++){const x=k/n*2-1;c[k]=Math.tanh(x*6)}dist.curve=c}const dg=ac.createGain();dg.gain.value=.16;dist.connect(dg).connect(bus);
  const cheer=()=>{const t=ac.currentTime+Math.random()*.3;this.whoo(t,.05+Math.random()*.07,cmix);if(Math.random()<.25){const o=ac.createOscillator(),a=ac.createGain();o.type='sine';o.frequency.setValueAtTime(2100,t);o.frequency.linearRampToValueAtTime(2700,t+.12);o.frequency.linearRampToValueAtTime(2300,t+.35);a.gain.setValueAtTime(.0001,t);a.gain.linearRampToValueAtTime(.025,t+.04);a.gain.exponentialRampToValueAtTime(.001,t+.4);o.connect(a).connect(cmix);o.start(t);o.stop(t+.42)}};
  const claps=t=>{for(let k=0;k<14;k++){const s=ac.createBufferSource();s.buffer=this.nb;const fl=ac.createBiquadFilter();fl.type='bandpass';fl.frequency.value=1300+Math.random()*900;fl.Q.value=1.2;const a=ac.createGain(),tt=t+Math.random()*.035;a.gain.setValueAtTime(.05,tt);a.gain.exponentialRampToValueAtTime(.001,tt+.07);s.connect(fl).connect(a).connect(cmix);s.start(tt,Math.random()*.4);s.stop(tt+.08)}};
  const hit=(t,f,d,v,type='sine',to,dst)=>{const o=ac.createOscillator(),a=ac.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+d);a.gain.setValueAtTime(v,t);a.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(a).connect(dst||syn);o.start(t);o.stop(t+d+.02)};
  const pad=(t,f,d,v,type='sawtooth',cut=1200)=>{const o=ac.createOscillator(),o2=ac.createOscillator(),fl=ac.createBiquadFilter(),a=ac.createGain();o.type=o2.type=type;o.frequency.value=f;o2.frequency.value=f*1.006;fl.type='lowpass';fl.frequency.value=cut;
    a.gain.setValueAtTime(.0001,t);a.gain.linearRampToValueAtTime(v,t+d*.35);a.gain.linearRampToValueAtTime(.0001,t+d);o.connect(fl);o2.connect(fl);fl.connect(a).connect(syn);o.start(t);o2.start(t);o.stop(t+d+.05);o2.stop(t+d+.05)};
  const nz=(t,d,v,type,f)=>{const s=ac.createBufferSource();s.buffer=this.nb;const fl=ac.createBiquadFilter();fl.type=type;fl.frequency.value=f;const a=ac.createGain();a.gain.setValueAtTime(v,t);a.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(fl).connect(a).connect(bus);s.start(t);s.stop(t+d+.02)};
  const BPM=song&&song.bpm||({rock:150,hiphop:88,epic:76,edm:128})[genre]||150,beat=60/BPM;
  // sidechain bus: synths duck under every kick (the "pumping" that makes a drop feel alive)
  const duck=ac.createGain();duck.connect(bus);const syn=duck;
  // tempo-synced echo for leads
  const dl=ac.createDelay(1.5);dl.delayTime.value=beat*.75;const fb=ac.createGain();fb.gain.value=.34;const dlf=ac.createBiquadFilter();dlf.type='lowpass';dlf.frequency.value=2800;dl.connect(dlf).connect(fb).connect(dl);const wet=ac.createGain();wet.gain.value=.3;dlf.connect(wet).connect(bus);
  // master sweep filter: opens through intro/build, slams open on the drop
  const sweep=ac.createBiquadFilter();sweep.type='lowpass';sweep.frequency.value=900;sweep.Q.value=.9;
  try{bus.disconnect();bus.connect(sweep);sweep.connect(g);sweep.connect(send)}catch(e){}
  const pump=(t,d)=>{duck.gain.cancelScheduledValues(t);duck.gain.setValueAtTime(.28,t);duck.gain.linearRampToValueAtTime(1,t+d)};
  const kick=(t,v=1)=>{hit(t,150,.34,v,'sine',42,bus);hit(t,2400,.012,v*.25,'square',null,bus);pump(t,beat*.7)},
    snare=(t,v=.5)=>{nz(t,.2,v,'bandpass',1900);nz(t,.09,v*.6,'highpass',5000);hit(t,200,.1,v*.5,'triangle',130,bus)},
    hat=(t,v=.1,d=.04)=>nz(t,d,v,'highpass',7500),
    crash=(t,v=.3)=>{nz(t,1.8,v,'highpass',5200);nz(t,1.1,v*.5,'bandpass',3200)},
    boom=t=>{hit(t,62,2.2,1,'sine',30,bus);nz(t,.8,.5,'lowpass',240);crash(t,.34)};
  const semi=(r,s)=>r*Math.pow(2,s/12);
  const lead=(t,f,d,v,type='sawtooth',cut=3600,toDelay=true)=>{const fl=ac.createBiquadFilter(),a=ac.createGain();fl.type='lowpass';fl.Q.value=3;fl.frequency.setValueAtTime(cut*1.8,t);fl.frequency.exponentialRampToValueAtTime(cut*.55,t+d);
    for(const [m,tp,lv] of [[1,type,1],[1.0045,type,.8],[.5,'square',.35]]){const o=ac.createOscillator(),og=ac.createGain();o.type=tp;o.frequency.setValueAtTime(f*m,t);og.gain.value=lv;o.connect(og).connect(fl);o.start(t);o.stop(t+d+.08)}
    a.gain.setValueAtTime(.0001,t);a.gain.linearRampToValueAtTime(v,t+.008);a.gain.setValueAtTime(v*.8,t+d*.7);a.gain.exponentialRampToValueAtTime(.001,t+d+.06);fl.connect(a);a.connect(syn);if(toDelay)a.connect(dl)};
  const hey=(t,v=.2)=>{for(const [f,q,k] of [[700,7,1],[1150,8,.7],[2500,9,.3]]){const s=ac.createBufferSource();s.buffer=this.nb2||this.nb;const fl=ac.createBiquadFilter();fl.type='bandpass';fl.frequency.value=f;fl.Q.value=q;const a=ac.createGain();a.gain.setValueAtTime(.0001,t);a.gain.linearRampToValueAtTime(v*k*2.2,t+.03);a.gain.exponentialRampToValueAtTime(.001,t+.24);s.connect(fl).connect(a).connect(cmix);s.start(t,Math.random()*3);s.stop(t+.26)}};
  const riser=(t,d,v=.22)=>{const s=ac.createBufferSource();s.buffer=this.nb2||this.nb;const fl=ac.createBiquadFilter();fl.type='bandpass';fl.Q.value=2;fl.frequency.setValueAtTime(300,t);fl.frequency.exponentialRampToValueAtTime(7000,t+d);const a=ac.createGain();a.gain.setValueAtTime(.005,t);a.gain.exponentialRampToValueAtTime(v,t+d);s.connect(fl).connect(a).connect(bus);s.start(t,Math.random());s.stop(t+d+.02);
    const o=ac.createOscillator(),og=ac.createGain();o.type='sawtooth';o.frequency.setValueAtTime(110*K,t);o.frequency.exponentialRampToValueAtTime(880*K,t+d);og.gain.setValueAtTime(.001,t);og.gain.exponentialRampToValueAtTime(v*.35,t+d);o.connect(og).connect(bus);o.start(t);o.stop(t+d+.02)};
  // arrangement: intro -> build -> DROP (x4 bars) -> DROP B (x2) -> build -> ...
  const IB=BPM<100?1:2;
  const phase=bar=>{if(bar<IB)return 0;if(bar<IB*2)return 1;const c=(bar-IB*2)%8;return c<4?2:c<6?3:1};
  let prev=-1;
  const sect=(i,bar,t,b)=>{const p=phase(bar),bd=b*4;
    if(i===0){if(p!==prev){
        if(p===0){sweep.frequency.setValueAtTime(700,t);sweep.frequency.exponentialRampToValueAtTime(2600,t+bd*IB)}
        if(p===1){sweep.frequency.setValueAtTime(1800,t);sweep.frequency.exponentialRampToValueAtTime(9000,t+bd*IB*.98)}
        if(p>=2&&prev<2){sweep.frequency.cancelScheduledValues(t);sweep.frequency.setValueAtTime(18000,t);boom(t);for(let k=0;k<3;k++)hey(t+k*.09,.12);this.roar&&setTimeout(()=>{try{this.roar(.22)}catch(e){}},Math.max(0,(t-ac.currentTime)*1000))}
        prev=p}
      if(p===1)riser(t,bd,.12+.1*((bar-IB)%IB+1)/IB)}
    if(p===1){const last=phase(bar+1)>=2;const roll=last?(i>=8?1:2):(i%2===0?2:0);if(roll&&(i%roll===0))snare(t,.18+.3*i/16);if(last&&i===15){hit(t,90,.2,.5,'sine',40,bus)}}
    if(p>=2&&(i===4||i===12))claps(t);
    if(p===3&&(i===12||i===14)&&bar%2)hey(t,.16);
    if(p>=2&&i===0&&bar%4===0)crash(t,.22);
    return p};
  const G={
    rock:{f(i,st,t,b){const bar=st>>4,p=sect(i,bar,t,b),rs=[0,0,3,5][bar%4],root=semi(82.4*K,rs);
      if(p===0){if(i===0||i===8)kick(t);if(i%4===2)hat(t,.06)}
      else if(p===1){if(i%4===0)kick(t);if(i%2===0)hat(t,.07)}
      else{if(i%2===0||i===7||i===15)kick(t,.9);if(i===4||i===12)snare(t,.65);hat(t,i%2?.05:.09);if(i===0)nz(t,.6,.12,'highpass',6000)}
      const chug=p>=2?[1,1,0,1,1,0,1,0,1,1,0,1,1,1,0,1][i]:p===1?i%2===0:i%4===0;
      if(chug){hit(t,root,b*.22,.5,'sawtooth',null,dist);hit(t,root*1.5,b*.22,.4,'sawtooth',null,dist)}
      if(p===0&&i===0){hit(t,root*2,b*7,.3,'sawtooth',null,dist);hit(t,root*3,b*7,.22,'sawtooth',null,dist)}
      if(p>=2){const HK=p===2?[12,null,12,15,null,17,null,19,17,null,15,null,12,null,10,12]:[24,null,22,19,null,17,19,null,22,null,24,null,27,24,22,19],n=HK[i];
        if(n!=null)lead(t,semi(82.4*K,n+rs*(p===2?0:0)),b*(HK[i+1]===null?.48:.24),.085,'sawtooth',3000)}}},
    hiphop:{swing:.1,f(i,st,t,b){const bar=st>>4,p=sect(i,bar,t,b),root=[55,55,49,58.3][bar%4]*K;
      if(p===0){if(i===0||i===10)kick(t);if(i%4===0)hat(t,.07)}
      else{if(i===0||i===7||i===10||(p>=2&&i===13))kick(t,1);if(i===4||i===12){snare(t,.55);nz(t,.08,.25,'bandpass',1200)}
        // trap hats: 16ths with rolls into the next bar
        if(p>=2){hat(t,i%4===2?.12:.06,.03);if(i===14||(p===3&&i===6))for(let k=1;k<3;k++)hat(t+k*b/12,.07,.02)}else if(i%2===0)hat(t,.08)}
      if(i===0)hit(t,root,b*3.6,.6,'sine',root*.94);if(i===10){hit(t,root*1.19,b*1.4,.45,'sine');if(p>=2)hit(t+b*1.2,root*1.19,b*.6,.3,'sine',root*.8)}
      if(i===0||i===6){for(const r of [4,4.76,6])hit(t,root*r,b*.9,.06,'triangle')}
      if(p>=2){const HK=p===2?[12,null,null,15,null,null,19,null,17,null,15,null,null,12,10,null]:[24,null,24,null,22,null,19,null,22,null,19,null,17,null,15,null],n=HK[i];
        if(n!=null)lead(t,semi(55*K,n),b*.5,.07,p===2?'square':'sawtooth',2400);
        if(i===0)for(const r of [1,1.189,1.498])pad(t,root*4*r,b*4.1,.045,'sawtooth',1500)}
      if(song&&song.big&&p>=2){if(i===0){hit(t,58,1.6,.7,'sine',32,bus);nz(t,.5,.3,'lowpass',260)}if(i===0||i===3||i===10){for(const f of [1,1.189].map(x=>root*2*x)){hit(t,f,b*.55,.12,'sawtooth');hit(t,f*1.002,b*.55,.09,'sawtooth')}}}}},
    epic:{f(i,st,t,b){const bar=st>>4,p=sect(i,bar,t,b),ch=[[110,130.8,164.8],[87.3,110,130.8],[98,123.5,146.8],[82.4,103.8,123.5]][bar%4].map(x=>x*K);
      const tk=p===0?[0,6]:p===1?[0,4,8,12]:[0,3,6,8,10,12,14];if(tk.includes(i)){hit(t,72,.9,p>=2?1:.8,'sine',38,bus);nz(t,.3,.3,'lowpass',400);if(p>=2)pump(t,b*.6)}
      if(p===1&&i>=8&&i%2===0)snare(t,.2+i*.02);if(p>=2&&(i===4||i===12))snare(t,.45);if(p>=2&&i%2===1)nz(t,.05,.06,'bandpass',3000);
      if(i===0){for(const f of ch)pad(t,f*2,b*4.1,p>=2?.06:.07);pad(t,ch[0]/2,b*4.1,.12,'sawtooth',500)}
      // driving string ostinato (16ths) — the engine of every trailer cue
      if(p>=1){const os=[0,0,12,0,7,0,12,0,0,0,12,0,7,12,7,0][i];hit(t,semi(ch[0],os),b*.2,p>=2?.1:.06,'sawtooth')}
      if(p>=2){const HK=p===2?[24,null,null,null,27,null,26,null,24,null,null,null,22,null,19,null]:[31,null,null,null,29,null,27,null,26,null,27,null,29,null,31,null],n=HK[i];
        if(n!=null)lead(t,semi(55*K,n),b*(i%8===0?1.9:.9),.075,'sawtooth',2200)}
      if(i===0&&bar%4===0)nz(t,2.2,.18,'bandpass',600)}},
    edm:{f(i,st,t,b){const bar=st>>4,p=sect(i,bar,t,b),root=[110,87.3,130.8,98][bar%4]*K,arp=[1,1.5,2,2.4,2,1.5,3,2.4];
      if(p===0){if(i%4===0)kick(t,.9)}else if(p===1){if(i%4===0&&!(phase(bar+1)>=2&&i>=8))kick(t,.9)}else{if(i%4===0)kick(t,1.15)}
      if(p>=2){if(i%4===2)nz(t,.12,.18,'highpass',6000);if(i===4||i===12){nz(t,.15,.4,'bandpass',1500);nz(t,.12,.3,'bandpass',1100)}hat(t,.05,.03)}
      const f=root*2*arp[i%8];hit(t,f,b*.22,p>=2?.08:.1,'sawtooth');hit(t,f*1.008,b*.22,.06,'sawtooth');
      if(p>=2&&i%4===2)hit(t,root/2,b*.4,.5,'sawtooth',root/2*.99,dist);
      if(p>=2&&(i===0||i===3||i===6||i===10||i===12)){for(const r of [2,2.378,2.997])for(const d of [1,1.006,.994])hit(t,root*r*d,b*.5,.03,'sawtooth')}
      if(p>=2){const HK=p===2?[24,null,24,27,null,24,31,null,29,null,27,null,24,null,22,null]:[36,34,31,null,29,31,null,27,29,null,31,34,null,31,29,27],n=HK[i];if(n!=null)lead(t,semi(55*K,n),b*.3,.07,'square',4200)}}}
  };
  const T=G[genre]||G.rock;let step=0,next=ac.currentTime+.1;
  const sched=()=>{while(next<ac.currentTime+.4){const i=step%16,sw=T.swing&&i%2?beat/4*T.swing:0;try{T.f(i,step,next+sw,beat)}catch(e){if(!Sound._merr){Sound._merr=String(e);console.warn('music',e)}}next+=beat/4;step++}if(Math.random()<.22)cheer()};
  sched();this._mus={g,crowd,timer:setInterval(sched,100)};
};
Sound.roar=function(v=.4){if(!this.ac||!this.on)return;try{const ac=this.ac,t=ac.currentTime;
  for(const [f,q,k] of [[450,.8,1],[1100,1.2,.6],[2400,1.5,.25]]){const s=ac.createBufferSource();s.buffer=this.nb2||this.nb;const fl=ac.createBiquadFilter();fl.type='bandpass';fl.frequency.value=f;fl.Q.value=q;const g=ac.createGain();
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v*k,t+.35);g.gain.exponentialRampToValueAtTime(.001,t+2.8);s.connect(fl).connect(g).connect(ac.destination);s.start(t,Math.random()*2);s.stop(t+2.9)}
  for(let i=0;i<6;i++)this.whoo(t+Math.random()*.9,v*.35)}catch(e){}};
Sound.whoo=function(t,v,dest){const ac=this.ac,s=ac.createBufferSource();s.buffer=this.nb2||this.nb;const fl=ac.createBiquadFilter();fl.type='bandpass';fl.Q.value=6;const f0=700+Math.random()*500;
  fl.frequency.setValueAtTime(f0,t);fl.frequency.linearRampToValueAtTime(f0*1.9,t+.25);fl.frequency.linearRampToValueAtTime(f0*1.4,t+.7);const g=ac.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+.08);g.gain.exponentialRampToValueAtTime(.001,t+.75);
  s.connect(fl).connect(g).connect(dest||ac.destination);s.start(t,Math.random()*3);s.stop(t+.8)};
Sound.applause=function(dur=3.2,v=.06){if(!this.ac||!this.on)return;try{const ac=this.ac,t0=ac.currentTime;
  for(let k=0;k<Math.round(dur*90);k++){const tt=t0+Math.random()*dur,s=ac.createBufferSource();s.buffer=this.nb;const fl=ac.createBiquadFilter();fl.type='bandpass';fl.frequency.value=1000+Math.random()*1400;fl.Q.value=1.1;const a=ac.createGain(),fade=1-Math.max(0,(tt-t0)-dur*.6)/(dur*.4);
    a.gain.setValueAtTime(v*fade,tt);a.gain.exponentialRampToValueAtTime(.001,tt+.06);s.connect(fl).connect(a).connect(ac.destination);s.start(tt,Math.random()*.4);s.stop(tt+.07)}
  this.roar(.22);for(let i=0;i<5;i++)this.whoo(t0+Math.random()*1.5,.07)}catch(e){}};
Sound.boo=function(){if(!this.ac||!this.on)return;try{const ac=this.ac,t=ac.currentTime;for(const [f,v] of [[260,.35],[390,.18]]){const s=ac.createBufferSource();s.buffer=this.nb2||this.nb;const fl=ac.createBiquadFilter();fl.type='bandpass';fl.Q.value=4;fl.frequency.setValueAtTime(f*1.15,t);fl.frequency.linearRampToValueAtTime(f*.85,t+2.2);
  const lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=5;lg.gain.value=f*.04;lfo.connect(lg).connect(fl.frequency);lfo.start(t);lfo.stop(t+2.6);const a=ac.createGain();a.gain.setValueAtTime(.0001,t);a.gain.linearRampToValueAtTime(v,t+.3);a.gain.exponentialRampToValueAtTime(.001,t+2.5);s.connect(fl).connect(a).connect(ac.destination);s.start(t,Math.random()*2);s.stop(t+2.6)}}catch(e){}};
Sound.sting=function(ok=true){if(!this.ac||!this.on)return;try{const ac=this.ac,t=ac.currentTime;this.tone(55,1.3,.7,'sine',36);this.noise(1.4,'highpass',4000,.18);
  for(const f of (ok?[220,277.2,329.6,440]:[207.7,246.9,311.1])){const o=ac.createOscillator(),fl=ac.createBiquadFilter(),a=ac.createGain();o.type='sawtooth';o.frequency.value=f;fl.type='lowpass';fl.frequency.setValueAtTime(3000,t);fl.frequency.exponentialRampToValueAtTime(500,t+1.2);a.gain.setValueAtTime(.06,t);a.gain.exponentialRampToValueAtTime(.001,t+1.4);o.connect(fl).connect(a).connect(ac.destination);o.start(t);o.stop(t+1.5)}}catch(e){}};
Sound.heart=function(){if(!this.ac||!this.on)return;try{this.tone(62,.18,.6,'sine',40);const ac=this.ac,t=ac.currentTime+.2,o=ac.createOscillator(),a=ac.createGain();o.frequency.setValueAtTime(56,t);o.frequency.exponentialRampToValueAtTime(36,t+.2);a.gain.setValueAtTime(.45,t);a.gain.exponentialRampToValueAtTime(.001,t+.22);o.connect(a).connect(ac.destination);o.start(t);o.stop(t+.25)}catch(e){}};
/* layered impact sounds: every landed or blocked strike gets its own thud, slap and crack */
Sound.impact=function(kind,dmg){if(!this.ac||!this.on)return;try{const ac=this.ac;if(!this._fx||this._fx.context!==ac){const g=ac.createGain();g.gain.value=1.8;const c=ac.createDynamicsCompressor();c.threshold.value=-6;c.ratio.value=4;c.knee.value=6;c.attack.value=.002;c.release.value=.15;g.connect(c).connect(ac.destination);this._fx=g}const out=this._fx,t=ac.currentTime,v=Math.min(1.25,.55+dmg*.07),pr=.9+Math.random()*.2;
  const thump=(f0,f1,d,g)=>{const o=ac.createOscillator(),a=ac.createGain();o.type='sine';o.frequency.setValueAtTime(f0*pr,t);o.frequency.exponentialRampToValueAtTime(f1*pr,t+d);a.gain.setValueAtTime(g*v,t);a.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(a).connect(out);o.start(t);o.stop(t+d+.02)};
  const nz=(type,f,q,d,g,dl=0)=>{const s=ac.createBufferSource();s.buffer=this.nb;const fl=ac.createBiquadFilter();fl.type=type;fl.frequency.value=f*pr;fl.Q.value=q;const a=ac.createGain();a.gain.setValueAtTime(g*v,t+dl);a.gain.exponentialRampToValueAtTime(.001,t+dl+d);s.connect(fl).connect(a).connect(out);s.start(t+dl,Math.random()*.3);s.stop(t+dl+d+.02)};
  if(kind==='block'){nz('bandpass',900,1.2,.07,.5);thump(180,90,.07,.35);nz('highpass',3000,.7,.03,.12);return}
  if(kind==='punch'){nz('highpass',1800,.8,.045,.55);nz('bandpass',650,1,.09,.5);thump(150,55,.13,.75)}
  else if(kind==='kick'){nz('bandpass',2200,.9,.07,.7);nz('lowpass',700,.7,.14,.5);thump(110,40,.2,.95)}
  else if(kind==='body'){thump(95,38,.22,1);nz('lowpass',450,.8,.16,.55);nz('bandpass',1200,1,.05,.25)}
  else if(kind==='knee'){thump(85,35,.24,1.05);nz('lowpass',600,.7,.15,.6)}
  else if(kind==='ground'){thump(120,45,.15,.8);nz('bandpass',800,1,.1,.5);nz('lowpass',300,.6,.12,.4)}
  if(dmg>7){nz('highpass',3200,.6,.035,.5);thump(70,30,.3,.8);
    // crowd "ooh" on the big ones
    const s=ac.createBufferSource();s.buffer=this.nb2||this.nb;const fl=ac.createBiquadFilter();fl.type='bandpass';fl.Q.value=3;fl.frequency.setValueAtTime(650,t+.08);fl.frequency.linearRampToValueAtTime(420,t+1);const a=ac.createGain();a.gain.setValueAtTime(.0001,t+.08);a.gain.linearRampToValueAtTime(.32,t+.25);a.gain.exponentialRampToValueAtTime(.001,t+1.2);s.connect(fl).connect(a).connect(out);s.start(t+.08,Math.random()*2);s.stop(t+1.25)}
}catch(e){}};
IC.Sound=Sound;
/* dynamic crowd: V_crowd = base + k · I_combat^1.2, where I_combat rises with strike rate, knockdowns, rocked fighters and deep submissions */
const Crowd={g:null,src:null,lv:-1,
  start(){if(!Sound.ac||!Sound.on||this.g)return;try{const ac=Sound.ac,src=ac.createBufferSource();src.buffer=Sound.nb2||Sound.nb;src.loop=true;const g=ac.createGain();g.gain.value=0;
    for(const [f,q,v] of [[380,.7,.5],[1100,1,.22],[2500,1.3,.07]]){const fl=ac.createBiquadFilter();fl.type='bandpass';fl.frequency.value=f;fl.Q.value=q;const cg=ac.createGain();cg.gain.value=v;src.connect(fl);fl.connect(cg);cg.connect(g)}
    g.connect(ac.destination);src.start();this.g=g;this.src=src;this.lv=-1}catch(e){}},
  set(I,muted,roar=1){if(!this.g)return;const v=muted?0:Math.min(1.6,(.05+.55*Math.pow(Math.max(0,I),1.2))*roar);if(Math.abs(v-this.lv)<.01)return;this.lv=v;try{this.g.gain.setTargetAtTime(v,Sound.ac.currentTime,I>this.lv?.12:.6)}catch(e){}},
  stop(){if(!this.g)return;const g=this.g,s=this.src;this.g=null;this.src=null;try{g.gain.setTargetAtTime(0,Sound.ac.currentTime,.3);setTimeout(()=>{try{s.stop();g.disconnect()}catch(e){}},1200)}catch(e){}}};
/* ring announcer: browser speech synthesis, Korean voice, slow and dramatic */
const Announcer={voice:null,
  pick(){try{const vs=speechSynthesis.getVoices();this.voice=vs.find(v=>/ko/i.test(v.lang)&&/male|남|Minsu|InJoon|Yuna/i.test(v.name))||vs.find(v=>/ko/i.test(v.lang))||null}catch(e){}},
  say(text){return;try{if(!window.speechSynthesis)return;if(!this.voice)this.pick();
    const parts=text.replace(/["…]/g,' ').split(/(?<=[!?])\s+/).filter(Boolean);
    parts.forEach((p,i)=>{const u=new SpeechSynthesisUtterance(p);u.lang='ko-KR';if(this.voice)u.voice=this.voice;
      const last=i===parts.length-1;u.rate=last?.78:.95;u.pitch=last?.75:.85;u.volume=1;speechSynthesis.speak(u)})}catch(e){}},
  stop(){try{window.speechSynthesis&&speechSynthesis.cancel()}catch(e){}}
};
try{window.speechSynthesis&&speechSynthesis.addEventListener&&speechSynthesis.addEventListener('voiceschanged',()=>Announcer.pick())}catch(e){}
IC.Announcer=Announcer;

/* ---------- storage: per-person db when available, browser storage as fallback ---------- */
const KEY='ironcage.v3';
const Store={db:null,uid:null,ready:Promise.resolve(),
  init(){this.ready=(async()=>{try{if(window.claude&&typeof window.claude.use==='function'){const [db,user]=await Promise.all([window.claude.use('db'),window.claude.use('user')]);if(db&&user){const id=await user.id();if(id){this.db=db;this.uid=id}}}}catch(e){}})()},
  local(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}},
  async load(){let a=this.local();await this.ready;
    if(this.db){try{const s=await this.db.collection('data/users/'+this.uid).doc('save').get();if(s.exists){const b=JSON.parse(s.data().json);if(!a||(b.at||0)>=(a.at||0))a=b}}catch(e){}}
    return a},
  save(d){d.at=Date.now();const json=JSON.stringify(d);try{localStorage.setItem(KEY,json)}catch(e){}
    clearTimeout(this._t);this._t=setTimeout(()=>{if(this.db)this.db.collection('data/users/'+this.uid).doc('save').set({json,at:d.at}).catch(()=>{})},700)}
};
const D0=()=>({custom:[],v:3,settings:{diff:'normal',roundSec:120,sound:true,voiceOn:false,walkout:true,nums:false,replay:true,gfx:'3d'},records:{quick:{w:0,l:0,d:0},tour:{played:0,won:0},fin:{KO:0,TKO:0,'서브미션':0,'판정':0}},career:null,archive:[],hof:[],songs:{},tour:null});
let DATA=D0();
function save(){Store.save(DATA);topinfo();try{lbPush()}catch(e){}}
function topinfo(){const c=DATA.career;$('#topinfo').innerHTML=c?`<strong>${esc(c.nick||c.name)}</strong> · ${c.rec.join('-')} · ${cRank(c)}`:''}

/* ---------- fighter lookup ---------- */
function meData(c){const s={};for(const k of STATS)s[k]=Math.round(clamp(c.s[k],20,99));
  return{id:'me',name:c.name,nick:c.nick||c.name,from:c.from,style:c.style,cls:c.cls,s,special:c.special,look:c.look,reach:c.reach,height:c.height,age:Math.floor(c.age),rec:c.rec,ovr:IC.ovrOf(s,c.style),me:true}}
function getF(id,c){c=c||DATA.career;if(id==='me')return meData(c);return IC.fighter(id)||(c&&c.fillers.find(f=>f.id===id))||(c&&c.locals&&c.locals.find(f=>f.id===id))||null}
const cRank=c=>c.tier==='regional'?'지역 단체':rankLabel(c.order.indexOf('me'));
const rankLabel=i=>i===0?'챔피언':i>0&&i<=15?'#'+i:'랭킹 외';

const FIRST=['알렉스','마르코','이고르','다비드','조엘','세르게이','라파엘','토마스','니코','하산','에릭','빅토르','레오','파블로','칼렙','유리','안톤','마일스','가브리엘','오마르','정우','민석','타쿠야','하오','루이스','에밀','바실','케일럽'];
const LAST=['페트렌코','오카포','바르가스','린드버그','케슬러','무라타','도노반','실베이라','하킴','크로스비','벨루치','스미르노프','타나베','오브라이언','카라칼','레예스','뮐러','아자르','콘라드','에스코바','한','진','류','나카타','보로딘','칼다스','에른스트','팔코네'];
const NICKS=['블리츠','스틸','라이노','팬텀','코브라','바이퍼','타이탄','스콜피온','마스티프','썬더','라이온','팔콘','데빌','몬스터','섀도','레이저','버팔로','스파르탄','아이스맨','드래곤','하운드','더 웰','헌터','록키'];
const FROMS=['미국','브라질','러시아','멕시코','영국','캐나다','호주','일본','대한민국','폴란드','네덜란드','프랑스','태국','중국'];
function genFillers(cls,seed){
  const r=IC.seeded(seed+IC.hash(cls)),C=CLASSES.find(c=>c.id===cls),styles=Object.keys(STYLES),out=[];
  for(let i=0;i<20;i++){
    const style=styles[Math.floor(r()*styles.length)],ovr=56+Math.floor(r()*16),from=FROMS[Math.floor(r()*FROMS.length)];
    const s=IC.makeStats(style,ovr,r),sp=STYLES[style].sp;
    out.push({id:`f_${cls}_${i}`,cls,name:`${FIRST[Math.floor(r()*FIRST.length)]} ${LAST[Math.floor(r()*LAST.length)]}`,nick:NICKS[Math.floor(r()*NICKS.length)],from,style,s,ovr:IC.ovrOf(s,style),
      special:sp[Math.floor(r()*sp.length)],look:IC.makeLook('f'+i,from,r),height:Math.round(C.h[0]+r()*(C.h[1]-C.h[0])),reach:Math.round(C.reach[0]+r()*(C.reach[1]-C.reach[0])),age:23+Math.floor(r()*12),
      rec:[6+Math.floor(r()*12),1+Math.floor(r()*6),0]});
  }
  return out;
}

/* ---------- router ---------- */
let SCREEN='home',P={};
const V={},A={};
function go(s,p){if(!(CINE&&CINE.o.keep))releaseGl();if(typeof Crowd!=='undefined')Crowd.stop();if(s==='quick'||s==='legend'||s==='legsel')s='home';if(typeof Net!=='undefined'&&Net.mr&&!['oroom','oresult','online','opick'].includes(s))Net.leaveMatch();if(s!=='oresult'&&typeof removeOverlay==='function')removeOverlay();stopLoop();Announcer.stop();if(!(s==='home'&&SCREEN==='home'))Sound.music(false);if(immersive)setImmersive(false);document.querySelector('.app').classList.remove('wide');if(s!=='home')stopDemo();SCREEN=s;P=p||{};game.hidden=true;scr.hidden=false;render();window.scrollTo(0,0);if(s==='home'){startDemo();homeMusic()}}
function render(){if(!(CINE&&CINE.o.keep))releaseGl();scr.innerHTML=V[SCREEN](P);after()}
function after(){if(SCREEN==='weigh')requestAnimationFrame(runWeigh);if(SCREEN==='chub')requestAnimationFrame(runPress);if(SCREEN==='cpost')requestAnimationFrame(runBelt);scr.querySelectorAll('canvas[data-pid]').forEach(el=>{const id=el.dataset.pid,d=id==='__tmp'?P._tmp:id.startsWith('hof:')?((DATA.hof||[])[+id.slice(4)]||{}).f:id.startsWith('leg:')?LEG[+id.slice(4)]:id.startsWith('net:')?NETF[id.slice(4)]:getF(id);if(d)IC.Draw.portrait(el,d,el.dataset.side||'a',el.dataset.mode||'full')})}
scr.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el||el.disabled)return;Sound.init();const f=A[el.dataset.act];if(f)f(el.dataset,el)});
scr.addEventListener('input',e=>{const el=e.target.closest('[data-bind]');if(el&&A.bind)A.bind(el.dataset,el)});
scr.addEventListener('change',e=>{const el=e.target.closest('[data-change]');if(el&&A[el.dataset.change])A[el.dataset.change](el.dataset,el)});
$('#home').addEventListener('click',()=>{const S=IC.Fight.S;if(S&&S.rp&&S.rp.hl){S.hlDone=null;S.hlQ=[];S.rp=null;S.mode='over';stopLoop();go('home');return}if(!game.hidden&&S&&S.mode!=='over'){openPause();return}go('home')});
cv.addEventListener('click',()=>{const S=IC.Fight.S;if(S&&S.rp&&S.rp.hl&&S.rp.frames)S.rp.i=S.rp.frames.length});
A.nav=d=>go(d.to);

/* ---------- components ---------- */
const back=(to,label='← 메인 메뉴')=>`<button class="back" data-act="nav" data-to="${to}">${label}</button>`;
function seg(act,opts,cur,lab){return `<div class="seg">${opts.map(o=>`<button data-act="${act}" data-v="${o}" aria-pressed="${String(o)===String(cur)}">${lab?lab(o):o}</button>`).join('')}</div>`}
/* ---------- home-screen music ---------- */
const HOME_THEME={n:'IRON CAGE 메인 테마',g:'epic',gn:'오케스트럴 에픽',bpm:96,key:1,crowd:.45,verb:.4,big:true};
const homeSongs=()=>[HOME_THEME,...IC.SONGS];
function homeMusic(force){if(DATA.settings.homeMusic===false||!DATA.settings.sound)return;if(SCREEN!=='home')return;if(!Sound.ac){return}
  if(Sound._mus&&!force)return;Sound.music(false);const L=homeSongs(),i=(DATA.settings.homeSong|0)%L.length;setTimeout(()=>{if(SCREEN==='home'&&!Sound._mus)Sound.music(true,Object.assign({},L[i],{vol:.32}))},force?650:0)}
A.hmNext=()=>{Sound.init();const L=homeSongs();DATA.settings.homeSong=((DATA.settings.homeSong|0)+1)%L.length;DATA.settings.homeMusic=true;save();homeMusic(true);render()};
A.hmToggle=()=>{Sound.init();DATA.settings.homeMusic=DATA.settings.homeMusic===false;save();if(DATA.settings.homeMusic)homeMusic(true);else Sound.music(false);render()};
A.hm=d=>{DATA.settings.homeMusic=d.v==='on';save();render()};
const hmChip=()=>{const on=DATA.settings.homeMusic!==false&&DATA.settings.sound,L=homeSongs(),g=L[(DATA.settings.homeSong|0)%L.length];
  return `<div class="hmchip"><span class="eq${on?' on':''}"><i></i><i></i><i></i></span><span class="hmn">${on?'♪ '+esc(g.n):'음악 꺼짐'}</span><button data-act="hmNext" aria-label="다음 곡">⏭</button><button data-act="hmToggle" aria-label="음악 켜기/끄기">${on?'🔊':'🔇'}</button></div>`};
addEventListener('keydown',()=>{if(SCREEN==='home'&&!Sound._mus&&DATA.settings.homeMusic!==false&&DATA.settings.sound){Sound.init();setTimeout(()=>homeMusic(),30)}},true);
addEventListener('pointerdown',e=>{if(e.target.closest&&e.target.closest('[data-act],.tile'))return;if(SCREEN==='home'&&!Sound._mus&&DATA.settings.homeMusic!==false&&DATA.settings.sound){Sound.on=true;Sound.init();setTimeout(()=>homeMusic(),30)}},true);
const diffSeg=()=>seg('setDiff',Object.keys(DIFFS).filter(k=>k!=='hof'),DATA.settings.diff,k=>DIFFS[k].label);
const secSeg=()=>seg('setSec',[60,120,180],DATA.settings.roundSec,v=>v/60+'분');
A.setDiff=d=>{DATA.settings.diff=d.v;save();render()};
A.setSec=d=>{DATA.settings.roundSec=+d.v;save();render()};
function classTabs(cur,act){return `<div class="tabs" role="tablist">${CLASSES.map(c=>`<button data-act="${act}" data-v="${c.id}" aria-pressed="${c.id===cur}">${c.name}<span class="kbd-only" style="font-family:var(--body);font-size:11px;color:var(--muted)"> ${c.kg}kg</span></button>`).join('')}</div>`}
function frow(f,o={}){
  const tags=(o.sel==='a'?'<span class="tag a">나</span>':o.sel==='b'?'<span class="tag b">상대</span>':'')+(f.me?'<span class="tag g">YOU</span>':'');
  return `<button class="frow ${o.sel==='a'?'sa':o.sel==='b'?'sb2':''} ${f.me?'me':''}" data-act="${o.act||''}" data-id="${f.id}" ${o.dis?'disabled':''}>
  <span class="rk ${o.rank===0?'c':''}">${o.rank===undefined?'':o.rank===0?'C':o.rank<=15?o.rank:'–'}</span><canvas class="pt" data-pid="${f.id}" data-side="${o.sel==='b'?'b':'a'}" data-mode="bust" aria-hidden="true"></canvas>
  <span style="min-width:0"><span class="nm" style="display:block">${esc(f.name)}${tags}</span><span class="sb" style="display:block">"${esc(f.nick)}" · ${STYLES[f.style].name} · ${esc(f.from)} · ${f.rec.join('-')}</span></span>
  <span class="ovr ${f.ovr>=88?'hi':''}">${f.ovr}</span></button>`;
}
function sbars(s,keys){return `<div class="sbars">${(keys||STATS).map(k=>{const v=Math.round(s[k]);return `<span class="n">${STATN[k]}</span><span class="track"><i class="${v>=88?'hi':v>=75?'mid':''}" style="width:${v}%"></i></span><span class="v">${v}</span>`}).join('')}</div>`}
function cmpBars(a,b){return `<div class="cmp">${STATS.map(k=>{const x=a.s[k],y=b.s[k];return `<span class="track ta"><i class="a" style="width:${x}%;opacity:${x>=y?1:.45}"></i></span><span style="text-align:center;color:var(--muted);white-space:nowrap">${STATN[k]} <b style="color:var(--fg)">${x}</b>:<b style="color:var(--fg)">${y}</b></span><span class="track"><i class="b" style="width:${y}%;opacity:${y>=x?1:.45}"></i></span>`}).join('')}</div>`}
const ctlT=f=>{const s=Math.round(f/60);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};
function statsTable(x,y,nx,ny,ttl='경기 기록'){
  const pc=(l,a)=>a?Math.round(l/a*100)+'%':'–';
  const rows=[['유효타',`${x.sigL} / ${x.sigA}`,`${y.sigL} / ${y.sigA}`],['적중률',pc(x.sigL,x.sigA),pc(y.sigL,y.sigA)],['머리 · 몸통 · 다리',`${x.headL} · ${x.bodyL} · ${x.legL}`,`${y.headL} · ${y.bodyL} · ${y.legL}`],
    ['테이크다운',`${x.td} / ${x.tdA}`,`${y.td} / ${y.tdA}`],['녹다운',x.kd,y.kd],['컨트롤 타임',ctlT(x.ctrl),ctlT(y.ctrl)],['서브미션 시도',x.subA,y.subA],['총 데미지',Math.round(x.dH+x.dB+x.dL),Math.round(y.dH+y.dB+y.dL)]];
  return `<div class="tw"><table><thead><tr><th>${ttl}</th><th>${esc(nx)}</th><th>${esc(ny)}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div>`;
}
function cardsTable(rounds){
  let h='<div class="tw"><table><thead><tr><th>라운드</th><th>심판 1</th><th>심판 2</th><th>심판 3</th></tr></thead><tbody>';
  const tot=[[0,0],[0,0],[0,0]];
  rounds.forEach((r,i)=>{h+=`<tr><td>${i+1}R</td>${r.cards.map((c,j)=>{tot[j][0]+=c[0];tot[j][1]+=c[1];return `<td><span class="${c[0]>c[1]?'a':''}" style="${c[0]>c[1]?'color:var(--blue-t);font-weight:700':''}">${c[0]}</span>-<span style="${c[1]>c[0]?'color:var(--red-t);font-weight:700':''}">${c[1]}</span></td>`}).join('')}</tr>`});
  h+=`<tr class="tot"><td>합계</td>${tot.map(t=>`<td>${t[0]}-${t[1]}</td>`).join('')}</tr></tbody></table></div>`;return h;
}

/* ---------- home ---------- */
/* ---------- home: game-style main menu ---------- */
const ICO={
  wild:'<path d="M12 3c1 3 4 4.5 4 8.5A4 4 0 0 1 8 12c0-1.5.7-2.6 1.6-3.4C9.8 10 10.6 11 12 11c-1.2-2.6-.6-5.6 0-8z"/><path d="M7 15.5A5 5 0 0 0 17 15.5"/>',
  tour:'<path d="M3 5h5v4H3zM3 15h5v4H3zM8 7h3v10H8M11 12h4M15 10h6v4h-6z"/>',
  practice:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  gp:'<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>',
  gym:'<path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/>',
  online:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  lb:'<path d="M5 20V11M12 20V5M19 20v-6"/>',
  album:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M3 15h18M7 5v4M11 5v4M15 5v4M7 15v4M11 15v4M15 15v4"/>',
  hof:'<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  roster:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .2 5.5 2.4 5.5 5.8"/>'};
const ico=k=>`<svg class="mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;
function champsOf(){const c=DATA.career;return CLASSES.map(C=>{let id=null;
  if(c&&((IC.CLSMAP||{})[c.cls]||c.cls)===C.id&&c.order&&c.order.length)id=c.order[0];
  if(!id){const l=ROSTER.filter(f=>((IC.CLSMAP||{})[f.cls]||f.cls)===C.id).sort((x,y)=>y.ovr-x.ovr);id=l[0]&&l[0].id}
  const d=id&&getF(id);return d?{C,id,d}:null}).filter(Boolean)}
function tickerItems(){const c=DATA.career,R=DATA.records,ch=champsOf(),out=[];
  ch.forEach(x=>out.push(`👑 ${x.C.name} 챔피언 <b>"${esc(x.d.nick)}" ${esc(x.d.name)}</b> ${(x.d.rec||[0,0,0]).slice(0,2).join('-')}`));
  const day=Math.floor(Date.now()/864e5),C=CLASSES[day%CLASSES.length],l=ROSTER.filter(f=>((IC.CLSMAP||{})[f.cls]||f.cls)===C.id).sort((x,y)=>y.ovr-x.ovr);
  if(l[1]&&l[2])out.splice(2,0,`🔥 오늘의 빅매치 · ${C.name} <b>${esc(l[1].nick)} vs ${esc(l[2].nick)}</b> 승자가 타이틀 도전권`);
  if(c&&c.news)c.news.slice(0,2).forEach(n=>out.splice(1,0,`📰 ${esc(n)}`));
  const fin=(R.fin.KO||0)+(R.fin.TKO||0)+(R.fin['서브미션']||0);out.push(`💥 내 피니시 승 <b>${fin}회</b>`);
  out.push('🥊 6개 체급 · '+ROSTER.length+'명의 파이터가 기다립니다');return out}
V.home=()=>{
  const c=DATA.career,R=DATA.records;
  const cs=c?`${esc(c.name)} · ${c.rec.join('-')} · ${clsName(c.cls)} ${rankLabel(c.order.indexOf('me'))}`:'무명에서 챔피언까지 · 내 선수를 만들어 보세요';
  const tk=tickerItems().map(s=>`<span>${s}</span>`).join('<i>◆</i>');
  const ch=champsOf();
  const T=(act,to,k,name,line,stat,cls='',tag='')=>`<button class="mt ${cls}${tag?' hasrib':''}" data-act="${act}"${to?` data-to="${to}"`:''}>${tag?`<em class="rib">${tag}</em>`:''}<span class="mic">${ico(k)}</span><span class="mtn">${name}</span><span class="mtd">${line}</span><span class="mts">${stat}</span></button>`;
  return `<section class="hero2"><canvas id="demo" aria-label="데모 경기"></canvas><div class="h2fx"></div>${hmChip()}
    <div class="livepill"><i></i>LIVE <span id="demoTag">데모 경기</span></div>
    <div class="h2main"><div class="lgo"><span class="l1">IRON</span><span class="l2">CAGE</span></div><div class="lgk">아이언 케이지 · 종합격투기 액션</div>
      <button class="cta" data-act="career"><span class="ctaT">${c?'커리어 이어하기':'커리어 시작'} <b>▶</b></span><span class="ctaS">${cs}</span></button>
      <div class="qk"><button data-act="nav" data-to="wild">🔥 야생 매치</button><button data-act="tour">🏆 토너먼트</button><button data-act="nav" data-to="practice">🎯 연습</button></div></div>
    <div class="ticker"><div class="tkr">${tk}<i>◆</i>${tk}<i>◆</i></div></div></section>
  <div class="sech"><h3>현 챔피언</h3><span>6개 체급의 왕좌 · 벨트를 빼앗아 오세요</span></div>
  <div class="chrow">${ch.map(x=>`<button class="chc${x.id==='me'?' me':''}" data-act="nav" data-to="roster"><canvas data-pid="${esc(x.id)}" data-mode="bust"></canvas><span class="chbelt"></span><span class="chk">${x.C.name}</span><span class="chn">"${esc(x.d.nick)}"</span><span class="chr">${(x.d.rec||[0,0,0]).join('-')}</span></button>`).join('')}</div>
  <div class="sech"><h3>게임 모드</h3><span>오늘은 어떤 싸움을?</span></div>
  <div class="modes2">
    ${T('nav','wild','wild','야생 매치','로블로·헤드버트·사커킥 OK',`${(R.wild||{w:0}).w}승 ${(R.wild||{l:0}).l}패`,'wildt','HOT')}
    ${T('tour','','tour','토너먼트','8인 녹아웃 · 3연승이면 우승',`우승 ${R.tour.won}회`)}
    ${T('gp','','gp','그랑프리','하룻밤 16인 · 데미지 누적',`우승 ${DATA.records.gpWon||0}회`,'gpt')}
    ${T('nav','practice','practice','연습','과제 체크리스트로 기술 익히기','처음이라면 여기부터','prt')}
    ${T('nav','gymm','gym','체육관 모드','유망주 영입 · 라이벌 대항전',DATA.gymm?esc(DATA.gymm.name)+' · '+DATA.gymm.pts+'점':'새 체육관 열기','gymt')}
    ${T('album','','album','KO 명장면','피니시 3초 픽셀 GIF 자동 녹화','📼 5슬롯','albt','NEW')}
    ${T('nav','hof','hof','명예의 전당','레전드 도전 · 헌액 명판',`헌액 ${(DATA.hof||[]).length}명`,'hoft')}
    ${T('nav','roster','roster','선수 명단','체급별 능력치와 스타일',`${ROSTER.length}명`)}
    ${T('nav','online','online','온라인 아레나','실시간 1:1 · 관전 채팅',window.claude?`${(DATA.records.online||{w:0}).w}승`:'준비 중',window.claude?'':'locked')}
    ${T('lbOpen','','lb','리더보드','커리어·벨트 점수 비교',window.claude?'온라인':'준비 중',window.claude?'':'locked')}
  </div>
  <div class="between-row"><p>난이도 ${DIFFS[DATA.settings.diff].label} · 라운드 ${DATA.settings.roundSec/60}분 · v${(IC.VER||'')}</p><div class="row"><button class="btn" data-act="nav" data-to="records">기록 · 설정</button><button class="btn" data-act="nav" data-to="wipe">게임 초기화</button></div></div>`;
};

/* ---------- roster ---------- */
let RC='lw';
V.roster=()=>{const list=IC.byClass(RC).slice().sort((a,b)=>b.ovr-a.ovr);
  return `${back('home')}<div class="panel"><div class="between-row"><div class="eyebrow">선수 명단</div><button class="btn sm" data-act="cfNew">+ 선수 추가</button></div>${classTabs(RC,'rcls')}
  <div class="flist">${list.map((f,i)=>frow(f,{act:'rview',rank:i})).join('')}</div>
  <p>원하는 선수를 직접 추가할 수 있어요. 추가한 선수는 토너먼트·연습·그랑프리에서 바로 고를 수 있습니다.</p></div>`};
A.rcls=d=>{RC=d.v;render()};
A.rview=d=>go('fdetail',{id:d.id,back:'roster'});
/* ---------- custom fighters ---------- */
/* saves from the 8-class era: move bantam → feather and light-heavy → heavy */
function migrateClasses(){const M=IC.CLSMAP||{},m=x=>M[x]||x;
  for(const c of DATA.custom||[])c.cls=m(c.cls);
  const C=DATA.career;if(C){C.cls=m(C.cls);if(C.belts)C.belts=[...new Set(C.belts.map(m))];for(const h of C.history||[])h.cls=m(h.cls);for(const l of C.locals||[])l.cls=m(l.cls)}
  if(DATA.tour)DATA.tour.cls=m(DATA.tour.cls);if(DATA.gp&&DATA.gp.cls)DATA.gp.cls=m(DATA.gp.cls);
  if(DATA.gymm)for(const p of [...(DATA.gymm.roster||[]),...(DATA.gymm.pool||[])])p.cls=m(p.cls)}
function loadCustom(){try{migrateClasses()}catch(e){console.error(e)}IC.CUSTOM.length=0;for(const c of DATA.custom||[])IC.CUSTOM.push(buildCustom(c));try{loadLegends()}catch(e){}}
function buildCustom(c){const C=CLASSES.find(x=>x.id===c.cls)||CLASSES[0];const s=IC.makeStats(c.style,c.ovr,IC.seeded(IC.hash(c.id)));
  return{id:c.id,cls:c.cls,name:c.name,nick:c.nick||c.name,from:c.from,style:c.style,s,special:c.special||STYLES[c.style].sp[0],look:c.look,
    height:Math.round((C.h[0]+C.h[1])/2),reach:Math.round((C.reach[0]+C.reach[1])/2),age:c.age||29,rec:c.rec||[0,0,0],ovr:IC.ovrOf(s,c.style),custom:true}}
const CF={};
function cfReset(o){Object.assign(CF,{id:null,name:'',nick:'',from:'대한민국',cls:RC,style:'allround',ovr:85,special:null,rec:'0-0-0',skin:IC.SKIN_OPTIONS[1],hair:IC.HAIR[0],hairStyle:'short',beard:false,trunk:IC.TRUNKS[6]},o||{})}
A.cfNew=()=>{cfReset();go('cfedit')};
A.cfEdit=d=>{const c=(DATA.custom||[]).find(x=>x.id===d.id);if(!c)return;cfReset({id:c.id,name:c.name,nick:c.nick,from:c.from,cls:c.cls,style:c.style,ovr:c.ovr,special:c.special,rec:(c.rec||[0,0,0]).join('-'),skin:c.look.skin,hair:c.look.hair,hairStyle:c.look.hairStyle,beard:c.look.beard,trunk:c.look.trunk});go('cfedit')};
function cfKeep(){for(const k of ['name','nick','rec']){const el=$('#cf_'+k);if(el)CF[k]=el.value}}
V.cfedit=()=>{const s=IC.makeStats(CF.style,CF.ovr,IC.seeded(7));P._tmp={id:'__tmp',name:CF.name,nick:CF.nick,from:CF.from,style:CF.style,s,look:{skin:CF.skin,hair:CF.hair,hairStyle:CF.hairStyle,beard:CF.beard,trunk:CF.trunk},special:CF.special||STYLES[CF.style].sp[0]};
  const sw=(act,arr,cur)=>`<div class="swatches">${arr.map(c=>`<button data-act="${act}" data-v="${c}" aria-pressed="${c===cur}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>`;
  return `${back('roster','← 명단')}<div class="panel"><div class="eyebrow">${CF.id?'선수 수정':'선수 추가'}</div>
  <div class="chead"><canvas data-pid="__tmp"></canvas><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><b style="font-family:var(--display);font-size:24px;font-weight:400">${esc(CF.name||'이름을 입력하세요')}</b><span style="color:var(--muted);font-size:13px">${STYLES[CF.style].name} · ${clsName(CF.cls)} · 종합 ${IC.ovrOf(s,CF.style)}</span></div></div>
  <div class="grid2"><label class="field"><span class="lbl">이름</span><input type="text" id="cf_name" maxlength="20" value="${esc(CF.name)}"></label>
  <label class="field"><span class="lbl">닉네임</span><input type="text" id="cf_nick" maxlength="14" value="${esc(CF.nick)}"></label>
  <label class="field"><span class="lbl">전적 (승-패-무)</span><input type="text" id="cf_rec" maxlength="10" value="${esc(CF.rec)}"></label>
  <label class="field"><span class="lbl">국적</span><select id="cf_from" data-change="cfSel" data-k="from">${IC.COUNTRIES.map(c=>`<option ${c===CF.from?'selected':''}>${c}</option>`).join('')}</select></label>
  <label class="field"><span class="lbl">체급</span><select id="cf_cls" data-change="cfSel" data-k="cls">${CLASSES.map(c=>`<option value="${c.id}" ${c.id===CF.cls?'selected':''}>${c.name}</option>`).join('')}</select></label>
  <label class="field"><span class="lbl">필살기</span><select id="cf_sp" data-change="cfSel" data-k="special">${Object.values(SPM).map(x=>`<option value="${x.id}" ${x.id===(CF.special||STYLES[CF.style].sp[0])?'selected':''}>${x.name}</option>`).join('')}</select></label></div>
  <div class="field"><span class="lbl">스타일</span>${seg('cfStyle',Object.keys(STYLES),CF.style,k=>STYLES[k].name)}</div>
  <div class="field"><span class="lbl">실력 ${CF.ovr}</span><input type="range" id="cf_ovr" min="60" max="97" value="${CF.ovr}" data-change="cfOvr" style="width:100%"></div>
  ${sbars(s)}
  <div class="grid2"><div class="field"><span class="lbl">피부</span>${sw('cfSkin',IC.SKIN_OPTIONS,CF.skin)}</div><div class="field"><span class="lbl">머리색</span>${sw('cfHair',IC.HAIR,CF.hair)}</div>
  <div class="field"><span class="lbl">트렁크</span>${sw('cfTrunk',IC.TRUNKS,CF.trunk)}</div>
  <div class="field"><span class="lbl">헤어 · 수염</span>${seg('cfHs',['short','buzz','bald','long','bun','mohawk'],CF.hairStyle,v=>({short:'짧은',buzz:'버즈',bald:'삭발',long:'장발',bun:'묶음',mohawk:'모히칸'})[v])}${seg('cfBeard',['no','yes'],CF.beard?'yes':'no',v=>v==='yes'?'수염 있음':'수염 없음')}</div></div>
  <div class="row"><button class="btn-go" data-act="cfSave">저장</button>${CF.id?`<button class="btn" data-act="cfDel">${cfDelArm?'한 번 더 누르면 삭제':'삭제'}</button>`:''}</div></div>`};
let cfDelArm=false;
A.cfSel=(d,el)=>{cfKeep();CF[d.k]=el.value;render()};
A.cfOvr=(d,el)=>{cfKeep();CF.ovr=+el.value;render()};
A.cfStyle=d=>{cfKeep();CF.style=d.v;CF.special=null;render()};A.cfSkin=d=>{cfKeep();CF.skin=d.v;render()};A.cfHair=d=>{cfKeep();CF.hair=d.v;render()};
A.cfTrunk=d=>{cfKeep();CF.trunk=d.v;render()};A.cfHs=d=>{cfKeep();CF.hairStyle=d.v;render()};A.cfBeard=d=>{cfKeep();CF.beard=d.v==='yes';render()};
A.cfSave=()=>{cfKeep();const name=CF.name.trim();if(!name){const n=$('#cf_name');n.focus();n.placeholder='이름을 입력하세요';return}
  const rec=(CF.rec.match(/\d+/g)||[0,0,0]).slice(0,3).map(Number);while(rec.length<3)rec.push(0);
  const c={id:CF.id||('c_'+Date.now().toString(36)),name,nick:CF.nick.trim()||name,from:CF.from,cls:CF.cls,style:CF.style,ovr:CF.ovr,special:CF.special||STYLES[CF.style].sp[0],rec,
    look:{skin:CF.skin,hair:CF.hair,hairStyle:CF.hairStyle,beard:CF.beard,trunk:CF.trunk,tattoo:false}};
  DATA.custom=DATA.custom||[];const i=DATA.custom.findIndex(x=>x.id===c.id);if(i>=0)DATA.custom[i]=c;else DATA.custom.push(c);
  loadCustom();save();RC=c.cls;go('roster')};
A.cfDel=()=>{if(!cfDelArm){cfDelArm=true;render();return}cfDelArm=false;DATA.custom=(DATA.custom||[]).filter(x=>x.id!==CF.id);loadCustom();save();go('roster')};
V.fdetail=p=>{const f=getF(p.id);const st=STYLES[f.style];
  return `${back(p.back,'← 명단')}<div class="panel"><div class="chead"><canvas data-pid="${f.id}"></canvas><div style="display:flex;flex-direction:column;gap:4px;min-width:0">
  <div class="eyebrow">${clsName(f.cls)} · ${st.name}</div><h2 class="big" style="font-size:clamp(26px,6vw,40px)">${esc(f.name)}</h2><p>"${esc(f.nick)}" · ${esc(f.from)} · ${f.rec.join('-')} · ${f.age}세 · ${f.height}cm · 리치 ${f.reach}cm</p></div></div>
  <div class="kv"><div><span>종합</span><b>${f.ovr}</b></div><div><span>필살기</span><b style="font-size:16px">${SPM[f.special].name}</b></div><div><span>스타일</span><b style="font-size:16px">${st.name}</b></div></div>
  ${sbars(f.s)}${f.custom?`<button class="btn" data-act="cfEdit" data-id="${f.id}">선수 수정</button>`:''}</div>`};

/* ---------- wild match: special retro rules, every foul allowed ---------- */
const Q={cls:'lw',a:null,b:null,rounds:3};
V.wild=()=>{const list=IC.byClass(Q.cls).slice().sort((a,b)=>b.ovr-a.ovr),fa=Q.a&&getF(Q.a),fb=Q.b&&getF(Q.b),R=DATA.records.wild||{w:0,l:0,d:0};
  return `${back('home')}<div class="panel wildp"><div class="eyebrow" style="color:#ff8b7f">야생 매치 · 스페셜 레트로 룰</div>
  <h2 class="big">${fa?`<span class="b">${esc(fa.nick)}</span>`:'<span class="g">?</span>'} 대 ${fb?`<span class="r">${esc(fb.nick)}</span>`:'<span class="g">?</span>'}</h2>
  <div class="advice"><b>반칙 전면 허용</b> · 로블로, 헤드버트, 사커킥, 눈 찌르기 모두 반칙패·감점 없음. 가드를 누른 채 잽 = 눈 찌르기, 킥 = 로블로, 클린치 니킥 = 헤드버트, 그라운드 엘보 = 사커킥.</div>
  <p>${!fa?'파란 코너, 내가 조작할 선수를 고르세요.':!fb?'빨간 코너 상대를 고르세요.':'대진 완성!'} · 전적 ${R.w}승 ${R.l}패 ${R.d}무</p>
  ${classTabs(Q.cls,'qcls')}<div class="flist">${list.map((f,i)=>frow(f,{act:'qpick',rank:i,sel:f.id===Q.a?'a':f.id===Q.b?'b':''})).join('')}</div>
  <div class="grid2"><div class="field"><span class="lbl">라운드</span>${seg('qr',[3,5],Q.rounds,v=>v+'라운드')}</div><div class="field"><span class="lbl">난이도</span>${diffSeg()}</div></div>
  <div class="row"><button class="btn-go" data-act="qgo" ${fa&&fb?'':'disabled'}>테일 오브 더 테이프</button><button class="btn" data-act="qrand">무작위 대진</button></div></div>`};
A.qcls=d=>{Q.cls=d.v;render()};
A.qr=d=>{Q.rounds=+d.v;render()};
A.qpick=d=>{const id=d.id;if(!Q.a)Q.a=id;else if(id===Q.a){Q.a=null;Q.b=null}else if(id===Q.b)Q.b=null;else Q.b=id;render()};
A.qrand=()=>{const l=IC.byClass(Q.cls);const x=pick(l);let y=pick(l);while(y===x)y=pick(l);Q.a=x.id;Q.b=y.id;render()};
A.qgo=()=>{const a=getF(Q.a),b=getF(Q.b);
  go('tale',{a,b,rounds:Q.rounds,label:'야생 매치 · 반칙 허용',backTo:'wild',
    run:(o={})=>startFight({a,b,rounds:Q.rounds,wild:true,label:`야생 매치 · ${Q.rounds}라운드`,weigh:o.weigh,onResult:res=>{
      const R=DATA.records;R.wild=R.wild||{w:0,l:0,d:0};if(res.winner==='a'){R.wild.w++;R.fin[res.method]=(R.fin[res.method]||0)+1}else if(res.winner==='b')R.wild.l++;else R.wild.d++;save();
      go('result',{res,cont:[['다시 하기','qgo'],['대진 바꾸기','nav:wild'],['메인 메뉴','nav:home']]})}})})};

/* ================= highlights, post-fight interview, belt, legend challenges, gym, grand prix, leaderboard ================= */
/* ---------- highlights ---------- */
A.hlPlay=()=>{const r=P.res;if(!r||!r.highlights||!r.highlights.length||!IC.Fight.S)return;
  scr.hidden=true;game.hidden=false;pad.hidden=true;hintEl.hidden=true;between.hidden=true;$('#glabel').textContent='하이라이트';Sound.init();sfx('crowd');
  requestAnimationFrame(fit);startLoop();IC.Fight.playHL(r.highlights,()=>{stopLoop();game.hidden=true;scr.hidden=false;render();window.scrollTo(0,0)})};
const hlBtn=r=>r&&r.highlights&&r.highlights.length?`<button class="btn" data-act="hlPlay">🎬 하이라이트 ${r.highlights.length}장면</button>`:'';
const sfx=k=>Sound.play(k);

/* ---------- belt ceremony + octagon interview (career wins) ---------- */
let beltRaf=0;
function runBelt(){const el=document.getElementById('beltcv');if(!el)return;const c=el.getContext('2d'),t0=performance.now(),d=P.me,B=IC.Draw.BELT,cer=P.cer||{},fired={};
  const once=(k,f)=>{if(!fired[k]){fired[k]=1;try{f()}catch(e){}}};const stg=[['발표',0],['벨트 공개',B.close],['착용',B.wrap],['포효',B.lift]];
  Sound.init();Sound.music(false);
  const fr=now=>{if(SCREEN!=='cpost'||!document.getElementById('beltcv'))return;const dpr=Math.min(2.5,devicePixelRatio||1),w=el.clientWidth,h=el.clientHeight;if(el.width!==Math.round(w*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr)}
    const t=(now-t0)/1000*60;
    once('a',()=>{Sound.roar(.25)});
    if(t>=B.reveal)once('rv',()=>{Sound.sting(true);Sound.roar(.6);Sound.applause(4);Announcer.say(cer.def?`앤드 스틸! ${d.nick} ${d.name}!`:`앤드 뉴! ${P.clsName} 챔피언, ${d.nick} ${d.name}!`)});
    if(t>=B.close)once('cl',()=>{Sound.play('reveal')});
    if(t>=B.wrap)once('wr',()=>{Sound.applause(5,.07)});
    if(t>=B.wrap+120)once('bk',()=>{Sound.play('slam');Sound.roar(.45)});
    if(t>=B.lift)once('lf',()=>{Sound.noise(.9,'lowpass',220,1);Sound.noise(1.6,'highpass',3000,.25);Sound.roar(.7);Sound.applause(6,.08);const si=songIdx(Object.assign({id:'me'},d));setTimeout(()=>{if(SCREEN==='cpost')Sound.music(true,Object.assign({},IC.SONGS[si],{crowd:1.6}))},700)});
    const se=document.getElementById('beltstg');if(se){const cur=stg.reduce((m,x,i)=>t>=x[1]?i:m,0);if(se.dataset.c!=cur){se.dataset.c=cur;se.querySelectorAll('span').forEach((x,i)=>x.className=i<cur?'done':i===cur?'on':'')}}
    c.setTransform(el.width/800,0,0,el.width/800,0,0);IC.Draw.beltScene(c,w,h,t,d,P.clsName,cer);beltRaf=requestAnimationFrame(fr)};
  cancelAnimationFrame(beltRaf);beltRaf=requestAnimationFrame(fr)}
A.beltAgain=()=>{cancelAnimationFrame(beltRaf);Sound.music(false);runBelt()};
V.cpost=p=>{const c=DATA.career;
  if(p.belt&&!p.beltDone)return `<div class="panel"><div class="eyebrow">${p.cer&&p.cer.kc?'킹 오브 케이지 슈퍼파이트':esc(p.clsName)+' 타이틀전'}</div><h2 class="big"><span class="g">${p.cer&&p.cer.kc?'👑 킹 오브 케이지 수여식':p.cer&&p.cer.def?'타이틀 방어전':'챔피언 벨트 수여식'}</span></h2>
    <div class="stage" style="aspect-ratio:16/9;max-height:none"><canvas id="beltcv" aria-label="벨트 수여식"></canvas></div>
    <div class="beltstg" id="beltstg"><span class="on">발표</span><span>벨트 공개</span><span>착용</span><span>포효</span></div>
    ${(()=>{const r=p.cer||{};return `<div class="champcard"><div class="cc-no">제${r.no||1}대</div><div><b>${r.kc?'킹 오브 케이지':esc(p.clsName)+' 챔피언'} · ${esc(c.name)}</b><span>${r.def?`${r.def}차 방어 성공`:r.kc?'체급을 넘어선 최강자':'새 챔피언 등극'} · 상대 ${esc(p.oppName)} · ${esc(r.how||'')}</span><span>${esc(r.ev||'')} · 전적 ${esc(r.rec||c.rec.join('-'))} · 커리어 벨트 ${(c.beltLog||[]).length}개</span></div></div>`})()}
    <div class="row"><button class="btn" data-act="beltAgain">↺ 다시 보기</button><button class="btn-go" data-act="postNext">옥타곤 인터뷰로</button></div></div>`;
  if(!p.said){const qs=interviewQs(c,p);return `<div class="panel"><div class="eyebrow">옥타곤 인터뷰</div><h2 class="big">${p.belt?'챔피언 인터뷰':'승리 인터뷰'}</h2>
    <div class="chat" style="padding:0"><div class="bub them"><b>인터뷰어</b><br>${esc(p.q||qs.q)}</div></div>
    <p>마이크가 넘어왔습니다. 관중이 숨죽이고 기다립니다.</p><div class="acts">${qs.a.map((x,i)=>`<button class="act" data-act="postSay" data-i="${i}"><b>${esc(x.t)}</b><span>${esc(x.h)}</span></button>`).join('')}</div></div>`}
  return `<div class="panel"><div class="eyebrow">옥타곤 인터뷰</div><div class="chat" style="padding:0"><div class="bub them"><b>인터뷰어</b><br>${esc(p.q)}</div><div class="bub me">${esc(p.said)}</div><div class="sysm">${esc(p.out||'')}</div></div>
    <div class="row"><button class="btn-go" data-act="postDone">결과 보기</button></div></div>`};
function interviewQs(c,p){const R=c.rival,ord=c.order,me=ord.indexOf('me'),champ=c.tier!=='regional'&&ord[0]!=='me'?getF(ord[0],c):null,a=[];
  const q=p.cer&&p.cer.kc?`${c.nick}, 두 체급의 챔피언을 꺾은 유일한 파이터, 킹 오브 케이지입니다! 이 벨트의 의미는요?`:p.belt?`${c.nick}, 챔피언이 됐습니다! 지금 기분이 어떻습니까? 그리고 첫 방어전 상대는요?`:pick([`오늘 ${p.res.method==='판정'?'15분 내내 대단했습니다':'멋진 피니시였습니다'}! 다음은 누굴 원합니까?`,`${c.nick}, 관중이 당신 이름을 외치고 있습니다. 하고 싶은 말이 있나요?`]);
  if(champ&&me<=5&&!c.isChamp)a.push({k:'champ',t:`${champ.name}, 벨트 들고 기다려라!`,h:'챔피언 지목 · 인지도 +6 · 다음 제안에 타이틀전'});
  if(R&&R.inMain)a.push({k:'rival',t:`${R.name}, 이제 네 차례다.`,h:'라이벌 지목 · 열기 +20 · 라이벌전 제안'});
  if(c.isChamp)a.push({k:'any',t:'누구든 덤벼라. 이 벨트는 내 거다.',h:'인지도 +5'});
  a.push({k:'fans',t:'와 주신 팬 여러분, 정말 감사합니다!',h:'인지도 +3 · 팬 반응 좋음'});
  a.push({k:'respect',t:`${p.oppName}, 정말 강한 선수였다. 존중한다.`,h:'인지도 +1 · 상대 팬도 박수'});
  p.q=p.q||q;return{q:p.q,a:p.qa=a}}
A.postNext=()=>{cancelAnimationFrame(beltRaf);P.beltDone=true;render()};
A.postSay=d=>{const c=DATA.career,x=P.qa[+d.i];if(!x)return;P.said=x.t;
  if(x.k==='champ'){c.hype=clamp(c.hype+6,0,100);c.flags=c.flags||{};c.flags.callout=1;P.out='관중이 폭발합니다! 매니저: "다음 제안에 타이틀전 넣어 볼게요!"';post(c,'press',`${c.nick}, 승리 후 챔피언 공개 지목`)}
  if(x.k==='rival'){c.rival.heat=clamp(c.rival.heat+20,0,100);P.out=`${c.rival.name}가 관중석에서 일어나 손가락질합니다!`;post(c,'rival','기다렸다. 날짜만 잡아.')}
  if(x.k==='any'){c.hype=clamp(c.hype+5,0,100);P.out='챔피언의 자신감에 관중이 환호합니다.'}
  if(x.k==='fans'){c.hype=clamp(c.hype+3,0,100);P.out='팬들의 함성이 쏟아집니다.';post(c,'fan',`${c.nick} 인터뷰 개멋있다 진짜`)}
  if(x.k==='respect'){c.hype=clamp(c.hype+1,0,100);P.out='상대 진영도 박수를 보냅니다.';post(c,'fan','스포츠맨십 최고')}
  post(c,'me',x.t);Sound.roar&&Sound.roar(.4);save();render()};
A.postDone=()=>{const r=P.after;go('result',r)};

/* ---------- legend challenges ---------- */
const LEGC=[
 {o:'피니시로 승리 (판정 X)',b:'2라운드 안에 끝내기',ok:r=>r.method!=='판정',bo:r=>r.method!=='판정'&&r.round<=2},
 {o:'유효타 수에서 앞서며 승리',b:'녹다운 1회 이상',ok:r=>r.stats.a.sigL>r.stats.b.sigL,bo:r=>r.stats.a.kd>=1},
 {o:'로킥(다리 타격) 10회 이상 적중 후 승리',b:'TKO로 승리',ok:r=>r.stats.a.legL>=10,bo:r=>r.method==='TKO'},
 {o:'테이크다운을 한 번도 허용하지 않고 승리',b:'서브미션으로 승리',ok:r=>r.stats.b.td===0,bo:r=>r.method==='서브미션'},
 {o:'테이크다운 3회 이상 성공 후 승리',b:'그라운드에서 피니시',ok:r=>r.stats.a.td>=3,bo:r=>r.method==='서브미션'||/그라운드/.test(r.detail||'')},
 {o:'KO로 승리',b:'1라운드 KO',ok:r=>r.method==='KO',bo:r=>r.method==='KO'&&r.round===1},
 {o:'5라운드 판정까지 가서 승리',b:'만장일치 판정',ok:r=>r.method==='판정',bo:r=>r.detail==='만장일치 판정',rounds:5},
 {o:'녹다운 한 번도 안 당하고 승리',b:'피니시로 승리',ok:r=>r.stats.b.kd===0,bo:r=>r.method!=='판정'}
];
function legendFighter(i){const l=LEG[i],C=CLASSES.find(x=>x.id===l.cls),r=IC.seeded(IC.hash('legf'+i)),s=IC.makeStats(l.style,91,r);
  return{id:'legf_'+i,name:l.name,nick:l.nick,from:l.from,style:l.style,cls:l.cls,s,ovr:IC.ovrOf(s,l.style),special:STYLES[l.style].sp[0],look:l.look,
    height:Math.round((C.h[0]+C.h[1])/2+3),reach:Math.round((C.reach[0]+C.reach[1])/2+4),age:33,rec:l.rec.slice(),legend:true}}
function loadLegends(){for(const [i] of LEG.entries()){const st=(DATA.leg||{})[i];if(st&&st.stars>0&&!IC.CUSTOM.find(f=>f.id==='legf_'+i))IC.CUSTOM.push(legendFighter(i))}}
V.legend=()=>{const L=DATA.leg||{},tot=Object.values(L).reduce((a,x)=>a+(x.stars||0),0);
  return `${back('home')}<div class="hofhead"><div class="eyebrow">명예의 전당</div><h2>레전드 도전</h2><p>전설의 명경기를 재현하세요 · 별 ${tot} / ${LEG.length*3}</p></div>
  <div class="panel"><div class="plaques">${LEG.map((l,i)=>{const g=LEGC[i],st=(L[i]||{}).stars||0;return `<div class="plaque${st?' gold':''}"><canvas data-pid="leg:${i}" data-mode="bust"></canvas><div class="pq">
    <div class="eyebrow">${clsName(l.cls)} · ${STYLES[l.style].name} · ${'★'.repeat(st)}${'☆'.repeat(3-st)}</div><b class="pn">${esc(l.name)}</b><span class="pk">"${esc(l.nick)}" · 종합 ${legendFighter(i).ovr}</span>
    <p class="pl">★ 승리 &nbsp;★ ${esc(g.o)} &nbsp;★ ${esc(g.b)}</p><div class="row"><button class="btn-go sm" data-act="legPick" data-i="${i}">도전</button></div></div></div>`}).join('')}</div>
  <p>별 1개 이상을 따면 그 레전드를 빠른 대결·토너먼트에서 쓸 수 있습니다.</p></div>`};
let LGI=0;
A.legPick=d=>{LGI=+d.i;go('legsel')};
V.legsel=()=>{const l=LEG[LGI],g=LEGC[LGI],list=IC.byClass(l.cls).filter(f=>!f.legend).slice().sort((a,b)=>b.ovr-a.ovr);
  return `${back('legend','← 레전드 도전')}<div class="panel"><div class="eyebrow">${esc(l.name)} 도전 · ${clsName(l.cls)}</div><h2 class="big" style="font-size:clamp(24px,6vw,36px)">내 선수 고르기</h2>
  <p>목표: <b>${esc(g.o)}</b> · 보너스: ${esc(g.b)} · ${g.rounds||3}라운드</p>
  ${DATA.career&&DATA.career.cls===l.cls?`<button class="frow" data-act="legGo" data-id="me"><span class="rk"></span><canvas class="pt" data-pid="me" data-mode="bust"></canvas><span><span class="nm" style="display:block">${esc(DATA.career.name)} <span class="tag g">커리어</span></span></span><span class="ovr">${meData(DATA.career).ovr}</span></button>`:''}
  <div class="flist">${list.map(f=>frow(f,{act:'legGo'})).join('')}</div></div>`};
A.legGo=d=>{const i=LGI,a=d.id==='me'?meData(DATA.career):getF(d.id),b=legendFighter(i),g=LEGC[i],rounds=g.rounds||3;
  go('tale',{a,b,rounds,label:`레전드 도전 · ${LEG[i].name}`,backTo:'legsel',run:(o={})=>startFight({weigh:o.weigh,a,b,rounds,label:`레전드 도전 · ${LEG[i].name}`,diff:'hard',onResult:res=>{
    const won=res.winner==='a',stars=won?1+(g.ok(res)?1:0)+(g.bo(res)&&g.ok(res)?1:0):0;DATA.leg=DATA.leg||{};const prev=(DATA.leg[i]||{}).stars||0;
    const first=stars>0&&!prev;if(stars>prev)DATA.leg[i]={stars};if(first){loadLegends()}save();lbPush();
    const extra=`<div class="hofbar" style="margin:10px 0"><div class="kv"><div><span>획득 별</span><b style="color:var(--gold)">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</b></div><div><span>목표</span><b style="font-size:14px">${won&&g.ok(res)?'✓ ':'✗ '}${esc(g.o)}</b></div><div><span>보너스</span><b style="font-size:14px">${won&&g.ok(res)&&g.bo(res)?'✓ ':'✗ '}${esc(g.b)}</b></div></div>${first?`<p style="color:var(--gold)">${esc(LEG[i].name)} 잠금 해제! 빠른 대결에서 쓸 수 있어요.</p>`:''}</div>`;
    go('result',{res,label:`레전드 도전 · ${LEG[i].name}`,extra,cont:[['다시 도전','legRetry'],['레전드 목록','nav:legend']]})}})})};
A.legRetry=()=>{go('legsel')};

/* ---------- gym mode ---------- */
const GSTY=Object.keys(STYLES);
function gymProspect(lv){const r=Math.random,cls=pick(CLASSES).id,C=CLASSES.find(x=>x.id===cls),style=pick(GSTY),from=pick(FROMS),id='GP_'+Date.now().toString(36)+Math.floor(r()*1e5),ovr=Math.round(50+r()*10+lv*1.5),pot=Math.round(Math.min(95,ovr+12+r()*22));
  return{id,cls,name:`${pick(FIRST)} ${pick(LAST)}`,nick:pick(NICKS),from,style,ovr,pot,rec:[0,0,0],focus:'all',look:IC.makeLook(id,from,r),height:Math.round(C.h[0]+r()*(C.h[1]-C.h[0])),reach:Math.round(C.reach[0]+r()*(C.reach[1]-C.reach[0])),age:19+Math.floor(r()*5),fee:Math.round((ovr*300+(pot-ovr)*600)/1000)*1000}}
function gymFighter(p){const s=IC.makeStats(p.style,p.ovr,IC.seeded(IC.hash(p.id+p.ovr)));if(p.focus==='strike'){s.pow+=3;s.spd+=3;s.kick+=3}if(p.focus==='grap'){s.td+=3;s.subO+=3;s.tdd+=3}if(p.focus==='cond'){s.car+=4;s.chin+=3}for(const k in s)s[k]=Math.min(99,s[k]);
  return{...p,s,ovr:IC.ovrOf(s,p.style),special:STYLES[p.style].sp[0]}}
function gymInit(){return{name:'아이언 독스 MMA',lvl:1,pts:0,week:1,roster:[gymProspect(1),gymProspect(1)],pool:[gymProspect(1),gymProspect(1),gymProspect(1)],rivals:[{name:'블랙 마운틴 짐',pts:20},{name:'리버사이드 파이트 클럽',pts:12},{name:'썬더 돔 아카데미',pts:6}],log:['체육관을 열었습니다. 유망주 둘과 함께 시작합니다.']}}
V.gymm=()=>{const G=DATA.gymm||(DATA.gymm=gymInit()),up=G.lvl*40000;const tbl=[{name:G.name,pts:G.pts,me:1},...G.rivals].sort((a,b)=>b.pts-a.pts);
  return `${back('home')}<div class="panel"><div class="eyebrow">체육관 모드 · ${G.week}주차</div><h2 class="big" style="font-size:clamp(26px,6vw,40px)">${esc(G.name)}</h2>
  <div class="kv"><div><span>시설 레벨</span><b>${G.lvl}</b></div><div><span>체육관 포인트</span><b>${G.pts}</b></div><div><span>선수</span><b>${G.roster.length}/6</b></div></div>
  <div class="row"><button class="btn-go" data-act="gymWeek">다음 주 진행</button><button class="btn" data-act="gymUp" ${G.pts<up?'disabled':''}>시설 업그레이드 (${up}점)</button></div></div>
  <div class="panel"><div class="eyebrow">소속 선수</div>${G.roster.map(p=>{const f=gymFighter(p);return `<div class="offer"><div style="min-width:0;display:flex;flex-direction:column;gap:3px"><b>${esc(p.name)} <span style="color:var(--muted);font-weight:400">"${esc(p.nick)}"</span></b>
    <span style="font-size:13px;color:var(--muted)">${clsName(p.cls)} · ${STYLES[p.style].name} · 종합 ${f.ovr} / 잠재력 ${p.pot} · ${p.rec.join('-')}</span>
    <span class="seg sm">${[['all','균형'],['strike','타격'],['grap','그래플'],['cond','체력']].map(([k,l])=>`<button data-act="gymFocus" data-id="${p.id}" data-v="${k}" aria-pressed="${p.focus===k}">${l}</button>`).join('')}</span></div>
    <div style="display:flex;flex-direction:column;gap:6px"><button class="btn-go sm" data-act="gymFight" data-id="${p.id}">출전</button><button class="btn sm" data-act="gymCut" data-id="${p.id}">방출</button></div></div>`}).join('')||'<p>소속 선수가 없습니다.</p>'}</div>
  <div class="panel"><div class="eyebrow">스카우트 리포트</div>${G.pool.map(p=>`<div class="offer"><div style="display:flex;flex-direction:column;gap:3px"><b>${esc(p.name)} "${esc(p.nick)}"</b><span style="font-size:13px;color:var(--muted)">${clsName(p.cls)} · ${STYLES[p.style].name} · ${p.age}세 · 종합 ${p.ovr} / 잠재력 ${p.pot}</span></div><button class="btn sm" data-act="gymSign" data-id="${p.id}" ${G.roster.length>=6?'disabled':''}>영입</button></div>`).join('')}</div>
  <div class="panel"><div class="eyebrow">체육관 순위</div><div class="tw"><table><tbody>${tbl.map((g,i)=>`<tr${g.me?' style="color:var(--gold);font-weight:700"':''}><td>${i+1}</td><td style="text-align:left">${esc(g.name)}</td><td>${g.pts}점</td></tr>`).join('')}</tbody></table></div>
  <div class="log">${G.log.slice(0,8).map(l=>`<div>${esc(l)}</div>`).join('')}</div></div>`};
A.gymFocus=d=>{const p=DATA.gymm.roster.find(x=>x.id===d.id);if(p){p.focus=d.v;save();render()}};
A.gymCut=d=>{const G=DATA.gymm;G.roster=G.roster.filter(x=>x.id!==d.id);save();render()};
A.gymSign=d=>{const G=DATA.gymm,p=G.pool.find(x=>x.id===d.id);if(!p||G.roster.length>=6)return;G.roster.push(p);G.pool=G.pool.filter(x=>x!==p);G.log.unshift(`${p.name} 영입`);save();render()};
A.gymUp=()=>{const G=DATA.gymm,up=G.lvl*30;if(G.pts<up)return;G.pts-=up;G.lvl++;G.log.unshift(`시설 업그레이드! 레벨 ${G.lvl} — 훈련 효율 상승`);save();render()};
A.gymWeek=()=>{const G=DATA.gymm;G.week++;
  for(const p of G.roster){const g=Math.max(0,(p.pot-p.ovr)*.07*(1+(G.lvl-1)*.2)*rnd(.6,1.4));p.ovr=Math.min(p.pot,Math.round((p.ovr+g)*10)/10)}
  for(const r of G.rivals)r.pts+=Math.round(rnd(0,9));
  G.pool=[gymProspect(G.lvl),gymProspect(G.lvl),gymProspect(G.lvl)];
  G.log.unshift(`${G.week}주차 — 훈련 완료`);save();render()};
A.gymFight=d=>{const G=DATA.gymm,p=G.roster.find(x=>x.id===d.id);if(!p)return;const a=gymFighter(p);
  const rv=pick(G.rivals),opp=gymFighter({...gymProspect(G.lvl),cls:p.cls,ovr:Math.round(a.ovr+rnd(-4,4))});opp.nick=opp.nick;
  const done=res=>{const won=res.winner==='a',fin=res.method!=='판정';if(won){p.rec[0]++;const pts=10+(fin?5:0);G.pts+=pts;G.log.unshift(`${p.name}, ${rv.name}의 ${opp.name}에게 ${res.method} 승 (+${pts}점)`);p.ovr=Math.min(p.pot,p.ovr+1)}
    else{p.rec[1]++;rv.pts+=8;G.log.unshift(`${p.name}, ${rv.name}의 ${opp.name}에게 ${res.method} 패`)}save();lbPush();return won};
  go('gymbout',{gf:{a,opp,rv,done}})};
V.gymbout=()=>{const g=P.gf;return `${back('gymm','← 체육관')}<div class="panel"><div class="eyebrow">체육관 대항전 · ${esc(g.rv.name)}</div><h2 class="big" style="font-size:clamp(24px,6vw,36px)">${esc(g.a.name)} vs ${esc(g.opp.name)}</h2>
  <p>${clsName(g.a.cls)} · 종합 ${g.a.ovr} vs ${g.opp.ovr}</p><div class="row"><button class="btn-go" data-act="gymPlay">직접 싸우기</button><button class="btn" data-act="gymSim">시뮬레이션</button></div></div>`};
A.gymSim=()=>{const g=P.gf,r=IC.Fight.sim(g.a,g.opp,3);const won=g.done(r);go('gymm')};
A.gymPlay=()=>{const g=P.gf;startFight({a:g.a,b:g.opp,rounds:3,label:`체육관 대항전 · ${g.rv.name}`,onResult:res=>{g.done(res);go('result',{res,label:'체육관 대항전',cont:[['체육관으로','nav:gymm']]})}})};

/* ---------- grand prix: 16 fighters, one night, damage carries ---------- */
const GPS=['16강','8강','4강','결승'],GPR=[1,1,2,3];let GPC='lw',GPME=null;
V.gpset=()=>{const list=IC.byClass(GPC).slice().sort((a,b)=>b.ovr-a.ovr);
  return `${back('home')}<div class="panel"><div class="eyebrow">그랑프리</div><h2 class="big">하룻밤 16인 토너먼트</h2>
  <p>16강·8강은 1라운드, 4강 2라운드, 결승 3라운드. <b>입은 데미지가 다음 경기로 이어집니다</b> — 이겨도 깔끔하게 이겨야 결승까지 버팁니다.</p>
  ${classTabs(GPC,'gpcls')}<div class="flist">${list.map((f,i)=>frow(f,{act:'gppick',rank:i,sel:f.id===GPME?'a':''})).join('')}</div>
  <button class="btn-go" data-act="gpstart" ${GPME?'':'disabled'}>대진 추첨</button></div>`};
A.gpcls=d=>{GPC=d.v;GPME=null;render()};A.gppick=d=>{GPME=GPME===d.id?null:d.id;render()};
A.gpstart=()=>{let ids=IC.byClass(GPC).map(f=>f.id).filter(x=>x!==GPME).sort(()=>Math.random()-.5).slice(0,15);ids.splice(Math.floor(Math.random()*16),0,GPME);
  const br=[[]];for(let i=0;i<16;i+=2)br[0].push([ids[i],ids[i+1]]);DATA.gp={cls:GPC,me:GPME,stage:0,br,win:[[],[],[],[]],out:false,champ:null,hp:{h:100,b:100,l:100},log:[]};save();go('gpb')};
A.gp=()=>{if(DATA.gp&&DATA.gp.stage!=='done')go('gpb');else go('gpset')};
function gpAdvance(){const G=DATA.gp,s=G.stage;
  G.br[s].forEach((m,i)=>{if(G.win[s][i])return;const r=IC.Fight.sim(getF(m[0]),getF(m[1]),GPR[s]);G.win[s][i]=r.winner==='a'?m[0]:m[1];G.log.unshift(`${GPS[s]} · ${getF(G.win[s][i]).name} ${r.method} 승`)});
  if(s<3){G.br[s+1]=[];for(let i=0;i<G.win[s].length;i+=2)G.br[s+1].push([G.win[s][i],G.win[s][i+1]]);G.stage=s+1}
  else{G.champ=G.win[3][0];G.stage='done';if(G.champ===G.me){DATA.records.gpWon=(DATA.records.gpWon||0)+1;lbPush()}}}
V.gpb=()=>{const G=DATA.gp,nm=id=>{const f=getF(id);return f?esc(f.name):''};
  const col=s=>{let h='';const n=[8,4,2,1][s];for(let i=0;i<n;i++){const m=G.br[s]&&G.br[s][i],w=G.win[s][i];h+=`<div class="match">${[0,1].map(k=>{const id=m&&m[k];return `<div class="${!id?'':w?(w===id?'w':'l'):''} ${id===G.me?'me':''}"><span>${id?nm(id):'—'}</span></div>`}).join('')}</div>`}return `<div class="bcol"><div class="lbl">${GPS[s]}</div>${h}</div>`};
  const done=G.stage==='done',mi=!done?G.br[G.stage].findIndex(m=>m.includes(G.me)):-1,can=!done&&!G.out&&mi>=0&&!G.win[G.stage][mi];
  return `${back('home')}<div class="panel"><div class="eyebrow">그랑프리 · ${clsName(G.cls)}</div><h2 class="big">${done?(G.champ===G.me?'<span class="g">그랑프리 우승!</span>':`우승: ${nm(G.champ)}`):GPS[G.stage]}</h2>
  ${!done&&!G.out?`<div class="kv"><div><span>남은 머리 체력</span><b>${Math.round(G.hp.h)}%</b></div><div><span>몸통</span><b>${Math.round(G.hp.b)}%</b></div><div><span>다리</span><b>${Math.round(G.hp.l)}%</b></div></div>`:''}
  <div class="bracket gp16">${[0,1,2,3].map(col).join('')}</div>
  <div class="row">${can?`<button class="btn-go" data-act="gpfight">${GPS[G.stage]} 내 경기 (${GPR[G.stage]}R)</button>`:''}${!done&&(!can)?'<button class="btn" data-act="gpsim">다음 라운드 진행</button>':''}${done?'<button class="btn-go" data-act="gpnew">새 그랑프리</button>':''}</div>
  <div class="log">${G.log.slice(0,10).map(l=>`<div>${esc(l)}</div>`).join('')}</div></div>`};
A.gpsim=()=>{gpAdvance();save();render()};A.gpnew=()=>{DATA.gp=null;save();go('gpset')};
A.gpfight=()=>{const G=DATA.gp,s=G.stage,i=G.br[s].findIndex(m=>m.includes(G.me)),m=G.br[s][i],a=getF(G.me),b=getF(m[0]===G.me?m[1]:m[0]);
  startFight({a,b,rounds:GPR[s],startHp:{...G.hp},label:`그랑프리 ${GPS[s]} · ${clsName(G.cls)}`,onResult:res=>{
    const won=res.winner==='a';G.win[s][i]=won?G.me:b.id;G.log.unshift(`${GPS[s]} · ${won?a.name:b.name} ${res.method} 승 (내 경기)`);
    if(won){G.hp={h:Math.min(100,res.hp.a.h+30),b:Math.min(100,res.hp.a.b+22),l:Math.min(100,res.hp.a.l+18)}}else G.out=true;
    gpAdvance();if(G.out)while(G.stage!=='done')gpAdvance();save();
    go('result',{res,label:`그랑프리 ${GPS[s]}`,extra:won&&G.stage!=='done'?`<p>다음 경기 시작 체력: 머리 ${Math.round(G.hp.h)}% · 몸통 ${Math.round(G.hp.b)}% · 다리 ${Math.round(G.hp.l)}%</p>`:G.champ===G.me?'<p style="color:var(--gold)">그랑프리 우승! 상금 $250,000</p>':'',cont:[['대진표','nav:gpb']]})}})};

/* ---------- online leaderboard (shared db) ---------- */
function lbScore(){const c=DATA.career,R=DATA.records,leg=Object.values(DATA.leg||{}).reduce((a,x)=>a+(x.stars||0),0);
  const cw=c?c.rec[0]:0,belts=c?(c.belts||[]).length:0,hof=(DATA.hof||[]).length;
  return{career:c?{name:c.name,nick:c.nick,rec:c.rec,cls:c.cls,rank:c.tier==='regional'?'지역':rankLabel(c.order.indexOf('me'))}:null,belts,hof,leg,gp:R.gpWon||0,tour:R.tour.won,gym:DATA.gymm?{name:DATA.gymm.name,pts:DATA.gymm.pts}:null,
    online:R.online||null,ghost:R.ghost||null,weekly:R.weekly||0,kc:c&&c.kc?1:0,
    score:cw*10+belts*100+hof*150+leg*20+(R.gpWon||0)*60+R.tour.won*30+(DATA.gymm?DATA.gymm.pts:0)+((R.online||{}).w||0)*15+((R.ghost||{}).w||0)*5+(R.weekly||0)*80+(c&&c.kc?150:0)}}
let lbT=0;function lbPush(){clearTimeout(lbT);lbT=setTimeout(async()=>{try{await Store.ready;if(!Store.db||!Store.uid)return;await Store.db.collection('leaderboard').doc(Store.uid).set({...lbScore(),at:Date.now()})}catch(e){}},800)}
let LBROWS=null,LBERR='';
V.lb=()=>{if(typeof STANDALONE!=='undefined'&&STANDALONE)return offNote('리더보드');const me=lbScore();
  return `${back('home')}<div class="hofhead"><div class="eyebrow">온라인</div><h2>리더보드</h2><p>이 게임 링크로 들어온 사람들의 기록</p></div>
  <div class="panel"><div class="kv"><div><span>내 점수</span><b style="color:var(--gold)">${me.score}</b></div><div><span>커리어 승</span><b>${me.career?me.career.rec[0]:0}</b></div><div><span>벨트</span><b>${me.belts}</b></div><div><span>레전드 별</span><b>${me.leg}</b></div></div>
  <p style="font-size:12px;color:var(--muted)">점수 = 커리어 승×10 + 벨트×100 + 킹 오브 케이지×150 + 명예의 전당×150 + 레전드 별×20 + 그랑프리 우승×60 + 토너먼트 우승×30 + 온라인 승×15 + 고스트 사냥×5 + 주간 우승×80 + 체육관 포인트</p>
  <div class="row"><button class="btn" data-act="lbLoad">새로고침</button></div>
  ${LBROWS?`<div class="tw"><table><thead><tr><th>#</th><th style="text-align:left">플레이어</th><th style="text-align:left">대표 선수</th><th>점수</th></tr></thead><tbody>${LBROWS.map((r,i)=>`<tr${r.me?' style="color:var(--gold);font-weight:700"':''}><td>${i+1}</td><td style="text-align:left">${esc(r.who)}</td><td style="text-align:left">${r.career?esc(r.career.name)+' '+r.career.rec.join('-')+(r.belts?' 🏆'.repeat(Math.min(3,r.belts)):''):r.gym?esc(r.gym.name):'—'}</td><td>${r.score}</td></tr>`).join('')}</tbody></table></div>`:`<p>${LBERR||'불러오는 중…'}</p>`}</div>`};
A.lbOpen=()=>{go('lb');if(typeof STANDALONE==='undefined'||!STANDALONE)A.lbLoad()};
A.lbLoad=async()=>{LBROWS=null;LBERR='';render();try{await Store.ready;if(!Store.db){LBERR='로그인한 상태에서만 리더보드를 볼 수 있어요.';render();return}
  lbPush();const snap=await Store.db.collection('leaderboard').orderBy('score','desc').limit(50).get();const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
  let prof={};try{const u=await window.claude.use('user');if(u&&u.profiles)prof=await u.profiles(rows.map(r=>r.id))}catch(e){}
  LBROWS=rows.map(r=>({...r,me:r.id===Store.uid,who:r.id===Store.uid?'나':((prof[r.id]&&prof[r.id].name)||'플레이어')}));if(!rows.length)LBERR='아직 기록이 없습니다.'}catch(e){LBERR='리더보드를 불러오지 못했어요.'}if(SCREEN==='lb')render()};

/* ---------- walkout song picker ---------- */
IC.songPick=d=>{if(!d)return null;if(d.id==='me')return DATA.career&&DATA.career.song!=null?DATA.career.song:null;const v=(DATA.songs||{})[d.id];return v==null?null:v};
const songIdx=d=>{const k=IC.songPick(d);return k!=null&&IC.SONGS[k]?k:IC.hash((d.id||'')+d.name)%IC.SONGS.length};
let prevT=0,prevI=-1;
function stopPreview(){clearTimeout(prevT);prevI=-1;Sound.music(false)}
V.song=p=>{const d=getF(p.id)||p.d,cur=songIdx(d),picked=IC.songPick(d)!=null,G={rock:'#c0392b',hiphop:'#8e44ad',epic:'#c9a227',edm:'#1abc9c'};
  return `<button class="back" data-act="songBack">← 뒤로</button><div class="panel"><div class="eyebrow">입장곡 선택</div><h2 class="big" style="font-size:clamp(24px,6vw,38px)">${esc(d.name)}</h2>
  <p>"${esc(d.nick)}"이 관중 사이를 걸어 나올 때 흐르는 곡입니다. ▶ 버튼으로 미리 들어 보세요.${picked?'':' 지금은 자동으로 정해진 곡입니다.'}</p>
  <div class="songs">${IC.SONGS.map((g,i)=>`<div class="song${i===cur?' on':''}" style="--gc:${G[g.g]}"><button class="play${prevI===i?' playing':''}" data-act="songPrev" data-i="${i}" aria-label="미리듣기">${prevI===i?'■':'▶'}</button>
    <div class="si"><b>${esc(g.n)}</b><span>${g.gn} · ${g.bpm} BPM</span><small>${esc(g.d)}</small></div>
    <button class="${i===cur?'btn-go':'btn'} sm" data-act="songSet" data-i="${i}">${i===cur?'선택됨':'선택'}</button></div>`).join('')}</div>
  ${picked?'<div class="row"><button class="btn sm" data-act="songSet" data-i="-1">자동으로 되돌리기</button></div>':''}</div>`};
A.songPrev=d=>{Sound.init();const i=+d.i;if(prevI===i){stopPreview();render();return}stopPreview();prevI=i;Sound.music(true,IC.SONGS[i]);prevT=setTimeout(()=>{stopPreview();if(SCREEN==='song')render()},9000);render()};
A.songSet=d=>{const i=+d.i,id=P.id;if(id==='me'){if(DATA.career)DATA.career.song=i<0?null:i}else{DATA.songs=DATA.songs||{};if(i<0)delete DATA.songs[id];else DATA.songs[id]=i}save();render()};
A.songBack=()=>{stopPreview();const r=P.ret;if(r)go(r.s,r.p);else go('home')};
A.songOpen=d=>{const id=d.id==='__a'?P.a.id:d.id;go('song',{id,d:d.id==='__a'?P.a:null,ret:{s:SCREEN,p:P}})};
/* ---------- tale of the tape ---------- */
V.tale=p=>{const a=p.a,b=p.b,st=x=>STYLES[x.style].name;
  const row=(lab,x,y,hi)=>`<span class="pa num ${hi===1?'w':hi===-1?'l':''}">${x}</span><span class="mid">${lab}</span><span class="num ${hi===-1?'w':hi===1?'l':''}">${y}</span>`;
  const cmp=(x,y)=>x>y?1:x<y?-1:0;
  return `<button class="back" data-act="taleBack">← 뒤로</button><div class="panel"><div class="eyebrow">${esc(p.label||'테일 오브 더 테이프')}</div>
  <div class="vsrow"><div class="va"><canvas data-pid="${a.id}" data-side="a"></canvas><span class="nm" style="color:var(--blue-t)">${esc(a.name)}</span><span class="sb" style="color:var(--muted);font-size:13px">"${esc(a.nick)}"</span></div>
  <span class="vs">VS</span><div class="vb"><canvas data-pid="${b.id}" data-side="b"></canvas><span class="nm" style="color:var(--red-t)">${esc(b.name)}</span><span class="sb" style="color:var(--muted);font-size:13px">"${esc(b.nick)}"</span></div></div>
  <div class="tape">${row('전적',a.rec.join('-'),b.rec.join('-'))}${row('종합',a.ovr,b.ovr,cmp(a.ovr,b.ovr))}${row('스타일',st(a),st(b))}${row('국적',esc(a.from),esc(b.from))}${row('나이',a.age,b.age)}${row('키',a.height+'cm',b.height+'cm')}${row('리치',a.reach+'cm',b.reach+'cm',cmp(a.reach,b.reach))}${row('필살기',SPM[a.special].name,SPM[b.special].name)}</div>
  ${oddsHtml(a,b)}
  ${cmpBars(a,b)}
  ${p.scout?`<div class="advice"><b>상대 분석</b> · ${scoutNote(b)}</div>`:''}${p.rivalRead?`<div class="advice" style="border-color:rgba(255,107,94,.5)"><b>🔥 라이벌의 분석</b> · ${esc(p.rivalRead)}</div>`:''}
  <div class="songrow"><span>♪ 입장곡 · <b>${esc(IC.SONGS[songIdx(a)].n)}</b> <small>${IC.SONGS[songIdx(a)].gn}</small></span><button class="btn sm" data-act="songOpen" data-id="__a">바꾸기</button></div>
  <div class="row"><button class="btn-go" data-act="taleWeigh" style="flex:1">계체량 →</button>${p.mustWeigh?'':`<button class="btn" data-act="taleGo">바로 경기 시작</button>`}</div></div>`};
/* pre-fight odds: record, recent form and the rivalry decide the line (decimal odds with a 6% book margin) */
function oddsOf(a,b){
  const c=DATA.career,wr=f=>{const r=f.rec||[0,0,0];return (r[0]+1)/(r[0]+r[1]+2)};
  const form=f=>{if(c&&(f.id==='me'||f.me)){const h=(c.history||[]).slice(0,3);return h.reduce((s,x)=>s+(x.res==='승'?1:x.res==='패'?-1:0),0)}return 0};
  let z=(a.ovr-b.ovr)*.11+(wr(a)-wr(b))*1.8+(form(a)-form(b))*.18;
  const rv=c&&c.rival&&(b.id===c.rival.id||a.id===c.rival.id)?c.rival:null;
  if(rv&&rv.fights){const d=(rv.losses||0)-(rv.wins||0);z+=(b.id===rv.id?1:-1)*d*.12}
  const pa=1/(1+Math.exp(-z)),o=x=>Math.max(1.04,1/(x*1.06));
  return{pa,a:o(pa),b:o(1-pa),rv:!!rv}}
function oddsHtml(a,b){const O=oddsOf(a,b),fav=O.pa>=.5?a:b;
  return `<div class="odds"><div class="oa"><b>${O.a.toFixed(2)}</b><span>${Math.round(O.pa*100)}%</span></div><div class="om"><span>경기 전 배당률</span><em>${esc(fav.nick)} 우세${O.rv?' · 라이벌전':''}</em></div><div class="ob"><b>${O.b.toFixed(2)}</b><span>${Math.round((1-O.pa)*100)}%</span></div></div>`}
const TALK={weigh:['내일 밤, 넌 바닥에서 천장을 보게 될 거야.','체중은 맞췄네. 이제 실력만 맞추면 되겠다.','눈 피하지 마. 내일도 똑바로 봐라.','네 코치한테 수건 준비하라고 해.','케이지 문 닫히면 아무도 못 도와줘.','난 준비됐어. 넌 아니야.','1라운드면 충분해.','그 웃음, 내일은 못 짓게 해 주지.',
  '감량하느라 힘 다 뺐지? 티 난다.','네 하이라이트 영상, 내일 내가 망쳐 줄게.','가족들한테 미리 인사해 둬.','내일 심판이 널 구해 줄 거야. 운 좋으면.','네 턱, 내일 시험해 볼게.','숨 고르는 법은 연습했냐?','이 무대는 너한텐 너무 커.','도망가는 연습만 했다며?',
  '난 네 영상 다 봤어. 약점 세 개 찾았지.','오늘 웃어 둬. 내일은 못 웃어.','지난 경기 운이 좋았던 거야.','네 펀치? 간지러울 것 같은데.'],
 press:['{me}? 들어본 적도 없는 이름이네. 1라운드면 충분해.','{me}는 아직 이 무대에 올 준비가 안 됐어.','내가 {me}를 은퇴시켜 주지.','{me}, 케이지 문 닫히면 아무도 못 도와줘.','{me}의 레슬링? 고등학생 수준이야.','{me}는 맞아 본 적이 없어서 저렇게 자신만만한 거야.',
  '{me}, 너 같은 상대는 스파링에서 매일 만난다.','{me}가 나한테 이기면 내가 은퇴한다.','{me}의 팬들, 표 환불 준비해라.','{me}는 판정 가면 이긴다고 생각하겠지. 판정까지 못 가.','{me}, 체급 올려 온 건 실수였어.','{me}의 하이라이트는 남이 만들어 준 거야.',
  '내 다음 상대 명단에 {me} 이름은 없었어. 쉬어 가는 경기지.','{me}, 기자회견은 잘하네. 싸움도 그만큼 하나 보자.','{me}한테 한 가지 조언하지. 턱 숙여.','{me}, 링 위에서 울지만 마라.']};
function talk(kind,repl={}){const L=TALK[kind],seen=(DATA.talkSeen=DATA.talkSeen||{})[kind]||[];let pool=L.filter(x=>!seen.includes(x));if(!pool.length)pool=L;
  const t=pick(pool);DATA.talkSeen[kind]=[t,...seen].slice(0,Math.min(10,L.length-2));let s=t;for(const k in repl)s=s.split('{'+k+'}').join(repl[k]);return s}
IC.talk=talk;IC._startFight=c=>startFight(c);
function scoutNote(b){const t=STYLES[b.style].ai,n=[];
  if(t.td>.25)n.push('테이크다운을 자주 노립니다. 가드로 스프롤 준비.');if(t.kick>.4)n.push('킥 비중이 높아요. 킥에 테이크다운으로 반격.');
  if(t.sub>.5)n.push('그라운드에서 서브미션이 위험합니다. 하위 포지션을 피하세요.');if(t.counter>.4)n.push('카운터 성향. 무리한 큰 공격은 읽힙니다.');
  if(b.s.chin<75)n.push('맷집이 약한 편. 머리를 노리세요.');if(b.s.car<75)n.push('체력이 약점. 바디와 압박으로 지치게.');
  return (n.length?n:['약점이 뚜렷하지 않은 상대입니다.']).slice(0,3).join(' ')+' (상대 데미지 5% 감소 효과)'}
A.taleBack=()=>{const p=P;if(p.backTo)go(p.backTo,p.backP)};
A.taleGo=()=>{P.run&&P.run()};
/* ---------- weigh-in ---------- */
function weighResult(d,cls,risk){const C=CLASSES.find(c=>c.id===cls)||CLASSES[0];const miss=Math.random()<(risk||0);
  const lb=miss?C.lb+0.4+Math.random()*1.4:C.lb-Math.random()*0.8-(cls==='hw'?Math.random()*20:0);return{lb:Math.round(lb*10)/10,ok:!miss}}
A.taleWeigh=()=>{const p=P;const cls=p.a.cls;
  const res=p.weigh||{a:weighResult(p.a,cls,p.risk||0),b:weighResult(p.b,cls,.03)};
  go('weigh',{...p,weigh:res,t0:performance.now()})};
let wRaf=0;
V.weigh=p=>{const C=CLASSES.find(c=>c.id===p.a.cls)||CLASSES[0],r=p.weigh;
  const line=(F,x)=>`<b>${esc(F.nick)}</b> ${x.lb.toFixed(1)} lb (${(x.lb*.4536).toFixed(1)} kg) · <span style="color:${x.ok?'#7dff9a':'#ff8b7f'}">${x.ok?'통과':'체중 초과'}</span>`;
  const pen=!r.a.ok&&p.mustWeigh?'<div class="advice">체중 초과! 인지도가 깎이고, 감량 실패로 시작 체력이 줄어듭니다.</div>':!r.b.ok?'<div class="advice">상대가 체중을 넘겼습니다. 상대의 시작 체력이 줄어듭니다.</div>':'';
  return `<button class="back" data-act="weighBack">← 테일 오브 더 테이프</button><div class="panel"><div class="eyebrow">공식 계체량 · ${C.name} ${C.lb} lb</div>
  <div class="stage" id="wStage" style="aspect-ratio:16/9;max-height:none"><canvas id="wcv" aria-label="계체량 장면"></canvas><div class="wcap" id="wcap"></div></div>
  <p>${line(p.a,r.a)}<br>${line(p.b,r.b)}</p>${pen}
  <div class="row"><button class="btn-go" data-act="weighGo" style="flex:1">${p.rounds}라운드 · 경기 시작</button><button class="btn" data-act="weighReplay">다시 보기</button></div></div>`};
A.weighBack=()=>{cancelAnimationFrame(wRaf);W3=null;Sound.music(false);go('tale',P)};
A.weighReplay=()=>{P.t0=performance.now()};
A.weighBack0=0;
A.weighGo=()=>{cancelAnimationFrame(wRaf);if(W3){W3=null;homeGl()}Sound.music(false);const r=P.weigh;P.run&&P.run({weigh:r})};
function runWeigh(){
  const el=document.getElementById('wcv');if(!el)return;const c=el.getContext('2d');
  const C=CLASSES.find(x=>x.id===P.a.cls)||CLASSES[0],WI=IC.Draw.WI,TR=IC.Draw.WTRASH;
  const mkF=(d,side)=>({d,name:d.name,nick:d.nick,side});
  const h=IC.hash(P.a.name+'|'+P.b.name),evs=['push','stare','shout'];
  const st={a:mkF(P.a,'a'),b:mkF(P.b,'b'),res:P.weigh,cls:C.name,limLb:C.lb,limKg:(C.lb*.4536).toFixed(1),title:P.title,t:0,ev:(P._ev=P._ev||pick(evs)),trashA:(P._ta=P._ta||talk('weigh')),trashB:(P._tb=P._tb||talk('weigh')),hot:0};
  let fired={},lastT=-1;
  Sound.init();Sound.music(false);Sound.music(true,{g:'hiphop',bpm:84,key:.94,crowd:.7,verb:.3});
  const once=(k,f)=>{if(!fired[k]){fired[k]=1;f()}};
  const fr=now=>{if(SCREEN!=='weigh'){Sound.music(false);return}const dpr=Math.min(2.5,window.devicePixelRatio||1),w=el.clientWidth,hh=el.clientHeight;
    if(el.width!==Math.round(w*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(hh*dpr)}c.setTransform(el.width/800,0,0,el.width/800,0,0);
    const t=st.t=(now-P.t0)/1000*60;
    if(t<lastT){fired={};Sound.music(false);Sound.music(true,{g:'hiphop',bpm:84,key:.94,crowd:.7,verb:.3})}lastT=t;
    const S0=WI.SEG,FC=WI.FACE;st.hot=0;
    for(const [side,base] of [['a',WI.blueOn[0]],['b',WI.redOn[0]]]){const L=t-base,r=P.weigh[side],F=st[side];
      if(L>=0)once(side+'in',()=>{Sound.roar(.25);Announcer.say(`${F.nick} ${F.name}!`)});
      if(L>=S0.read[0]&&L<S0.read[1]&&Math.floor(L)%6===0)once(side+'tk'+Math.floor(L),()=>Sound.play('tick'));
      if(L>=S0.stamp)once(side+'st',()=>{if(r.ok){Sound.sting(true);Sound.applause(3.4)}else{Sound.sting(false);Sound.boo()}Announcer.say(`${r.lb.toFixed(1)}파운드! ${r.ok?'통과!':'체중 초과!'}`)});
      if(L>=S0.stamp&&L<S0.flex[1])st.hot=r.ok?1:0}
    const L=t-WI.face[0];
    if(L>=0)once('fg',()=>{Sound.roar(.3);Announcer.say('두 선수, 페이스오프!')});
    if(L>FC.stare[0]&&L<FC.event&&Math.floor(L)%48===0)once('hb'+Math.floor(L),()=>Sound.heart());
    if(L>=FC.stare[0])once('mute',()=>{if(Sound._mus)try{Sound._mus.g.gain.setTargetAtTime(.18,Sound.ac.currentTime,.4)}catch(e){}});
    if(L>=FC.event)once('ev',()=>{if(st.ev==='push'){Sound.play('slam');Sound.roar(.55);Sound.boo()}else if(st.ev==='shout'){Sound.roar(.45)}else Sound.roar(.3)});
    if(L>=FC.event&&L<FC.sep[1])st.hot=1;
    if(L>=FC.sep[1])once('end',()=>{if(Sound._mus)try{Sound._mus.g.gain.setTargetAtTime(.5,Sound.ac.currentTime,.3)}catch(e){}Sound.applause(4);Sound.sting(true)});
    if(L>=FC.sep[1]&&t<WI.end)st.hot=1;
    if(t>=WI.end+30)once('fade',()=>{if(Sound._mus)try{Sound._mus.g.gain.setTargetAtTime(.12,Sound.ac.currentTime,1.2)}catch(e){}});
    if(W3){const C=W3,ph=t<WI.redOn[0]?'a':t<WI.face[0]?'b':'face',base=ph==='a'?WI.blueOn[0]:ph==='b'?WI.redOn[0]:WI.face[0],L=t-base;
      C.phase=ph;C.t=Math.max(0,L);C.ev=st.ev;const r=ph==='a'?P.weigh.a:ph==='b'?P.weigh.b:null;
      if(r){C.kg=L<S0.read[0]?'--':L<S0.stamp?(r.lb*.4536+Math.sin(L*.7)*3).toFixed(1):(r.lb*.4536).toFixed(1);C.miss=L>=S0.stamp&&!r.ok}
      const cap=$('#wcap');if(cap){const F=ph==='a'?P.a:ph==='b'?P.b:null;cap.innerHTML=F?`<b style="color:${ph==='a'?'var(--blue-t)':'var(--red-t)'}">${esc(F.nick)}</b> ${L>=S0.stamp?`${(r.lb).toFixed(1)} lb · <em class="${r.ok?'ok':'no'}">${r.ok?'통과!':'체중 초과!'}</em>`:'체중계에 오릅니다…'}`
        :L<FC.bubA?'페이스오프':L<FC.bubB?`<b style="color:var(--red-t)">${esc(P.b.nick)}</b> “${esc(st.trashB)}”`:L<FC.event?`<b style="color:var(--blue-t)">${esc(P.a.nick)}</b> “${esc(st.trashA)}”`:st.ev==='push'?'밀치기! 경호원이 떼어 놓습니다':st.ev==='shout'?'고성이 오갑니다!':'끝까지 눈을 피하지 않습니다'}
      const w2=$('#wStage');if(w2)IC.R3D.renderCine(C,w2.clientWidth,w2.clientHeight)}
    else IC.Draw.weighin(c,w,hh,st);wRaf=requestAnimationFrame(fr)};
  W3=null;const host=$('#wStage');if(host&&IC.R3D&&IC.R3D.init(gl)){host.appendChild(gl);gl.hidden=false;gl.classList.add('cinegl');W3={set:'weigh',a:P.a,b:P.b,t:0}}
  cancelAnimationFrame(wRaf);wRaf=requestAnimationFrame(fr);
}
let W3=null;
V.weigh=p=>{const C=CLASSES.find(c=>c.id===p.a.cls)||CLASSES[0],r=p.weigh;
  const line=(F,x)=>`<b>${esc(F.nick)}</b> ${x.lb.toFixed(1)} lb (${(x.lb*.4536).toFixed(1)} kg) · <span style="color:${x.ok?'#7dff9a':'#ff8b7f'}">${x.ok?'통과':'체중 초과'}</span>`;
  const pen=!r.a.ok&&p.mustWeigh?'<div class="advice">체중 초과! 인지도가 깎이고, 감량 실패로 시작 체력이 줄어듭니다.</div>':!r.b.ok?'<div class="advice">상대가 체중을 넘겼습니다. 상대의 시작 체력이 줄어듭니다.</div>':'';
  return `<button class="back" data-act="weighBack">← 테일 오브 더 테이프</button><div class="panel"><div class="eyebrow">공식 계체량 · ${C.name} ${C.lb} lb</div>
  <div class="stage" id="wStage" style="aspect-ratio:16/9;max-height:none"><canvas id="wcv" aria-label="계체량 장면"></canvas><div class="wcap" id="wcap"></div></div>
  <p>${line(p.a,r.a)}<br>${line(p.b,r.b)}</p>${pen}
  <div class="row"><button class="btn-go" data-act="weighGo" style="flex:1">${p.rounds}라운드 · 경기 시작</button><button class="btn" data-act="weighReplay">다시 보기</button></div></div>`};
A.weighBack=()=>{cancelAnimationFrame(wRaf);Sound.music(false);go('tale',P)};
A.weighReplay=()=>{P.t0=performance.now()};
A.weighGo=()=>{cancelAnimationFrame(wRaf);Sound.music(false);const r=P.weigh;P.run&&P.run({weigh:r})};

/* ---------- fight runner ---------- */
const ctx=cv.getContext('2d');
/* render at the screen's real pixel size (logical width stays 800) so text and lines stay sharp when stretched to fullscreen */
function fit(){const dpr=Math.min(2.5,window.devicePixelRatio||1),w=cv.clientWidth||800,h=cv.clientHeight||450;
  const pw=Math.round(Math.min(w*dpr,2600)),ph=Math.round(pw*h/w);
  IC.opts.topGap=0;IC.opts.hudBottom=false;
  if(cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph}const k=pw/800;ctx.setTransform(k,0,0,k,0,0);ctx.imageSmoothingQuality='high';
  /* HUD unit in CSS px (the canvas HUD is drawn in 800-wide units scaled by HS); lets the DOM exit/pause buttons sit beside the clock,
     and tells the renderer where the free strip between the two control clusters is for the commentary line */
  const hs=clamp(600/w,1,1.75),u=w/800*hs;game.style.setProperty('--hu',u+'px');
  requestAnimationFrame(()=>{const cr=cv.getBoundingClientRect(),Lc=document.querySelector('.game .cl.l'),Rc=document.querySelector('.game .cl.r');
    if(Lc&&Rc&&Lc.offsetParent&&Rc.offsetParent){const a=Lc.getBoundingClientRect(),b=Rc.getBoundingClientRect();IC.opts.tickBand={l:(a.right-cr.left)/u+6,r:(b.left-cr.left)/u-6}}else IC.opts.tickBand=null})}
fit();addEventListener('resize',()=>{autoImmersive();fit()});
try{new ResizeObserver(()=>fit()).observe(cv)}catch(e){}
/* immersive (full-viewport) mode; real fullscreen and landscape lock are attempted but optional */
let immersive=false,fsByUs=false;
const landscapePhone=()=>window.matchMedia('(orientation: landscape) and (max-height: 540px)').matches;
function setImmersive(on,auto){
  immersive=on;game.classList.toggle('immersive',on);document.body.classList.toggle('noscroll',on);
  $('#fsBtn').textContent=on?'나가기':'전체화면';
  if(on&&!auto){const el=document.documentElement;try{const p=el.requestFullscreen&&el.requestFullscreen({navigationUI:'hide'});if(p&&p.then)p.then(()=>{fsByUs=true;try{const o=screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape');if(o&&o.catch)o.catch(()=>{})}catch(e){}}).catch(()=>{})}catch(e){}}
  if(!on&&fsByUs&&document.fullscreenElement){try{document.exitFullscreen()}catch(e){}fsByUs=false}
  requestAnimationFrame(fit);
}
function autoImmersive(){if(game.hidden)return;if(landscapePhone()&&!immersive)setImmersive(true,true)}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&fsByUs){fsByUs=false;if(immersive&&!landscapePhone())setImmersive(false)}});
$('#fsBtn').addEventListener('click',()=>{Sound.init();setImmersive(!immersive)});
let raf=0,last=0,acc=0,CUR=null,lastKey='',heldKeys={};
function startLoop(){cancelAnimationFrame(raf);last=performance.now();acc=0;raf=requestAnimationFrame(loop)}
function stopLoop(){cancelAnimationFrame(raf);raf=0}
function loop(now){
  acc+=Math.min(100,now-last);last=now;let n=0;while(acc>=1000/60){acc-=1000/60;n++}
  const S=IC.Fight.S;if(!S)return;
  if(n)IC.Fight.tick(n);
  if(CFG&&CFG.online)Net.frame();
  const w=cv.clientWidth,h=cv.clientHeight;
  if(USE3D){try{IC.R3D.render(S,w,h);IC.Draw.render(S,ctx,w,h,{project:IC.R3D.project})}catch(e){console.error(e);USE3D=false;gl.hidden=true}}
  else IC.Draw.render(S,ctx,w,h);
  game.classList.toggle('walking',!!S.walk);game.classList.toggle('replaying',S.mode==='replay');game.classList.toggle('tutorial',!!(S.practice&&S.tasks));
  Crowd.set(IC.Fight.intensity(),!!S.walk||S.mode==='between',(S.arena&&S.arena.roar)||1);
  if(IC.KO&&!S.demo&&!S.practice&&!(CFG&&CFG.online==='spec')&&['fight','ko','intro'].includes(S.mode)&&!S.walk){IC.KO.capture(USE3D?[gl,cv]:[cv],S);
    if(S.mode==='ko'&&S.result&&!S.koSeen){S.koSeen=1;const r=S.result,W=r.winner==='a'?S.a:S.b,L=W===S.a?S.b:S.a;
      const score=(r.method==='KO'?100:r.method==='TKO'?82:76)+Math.max(0,(S.rounds-r.round))*8+(W===S.p?10:0)+(S.title?12:0);
      IC.KO.finishSeen({score,method:r.method,detail:r.detail,round:r.round,time:r.time,win:W.nick,lose:L.nick,label:CFG&&CFG.label||''})}}
  updatePad();
  raf=requestAnimationFrame(loop);
}
let CFG=null,USE3D=false;
function startFight(cfg){
  CFG=cfg;Sound.on=DATA.settings.sound;Sound.init();Crowd.start();if(IC.KO)IC.KO.reset();
  scr.hidden=true;game.hidden=false;between.hidden=true;pad.hidden=false;hintEl.hidden=false;
  $('#glabel').textContent=cfg.label||'';
  stopDemo();IC.opts.nums=!!DATA.settings.nums;IC.opts.haptic=DATA.settings.haptic!==false;IC.Fight.start({walkout:!cfg.online&&DATA.settings.walkout!==false,replay:!cfg.online&&DATA.settings.replay!==false,remote:cfg.online==='host',coach:DATA.settings.coach!==false,a:cfg.a,b:cfg.b,rounds:cfg.rounds||3,roundSec:cfg.roundSec||DATA.settings.roundSec,diff:cfg.diff||DATA.settings.diff,title:cfg.title,practice:cfg.practice,condition:cfg.condition,wild:!!cfg.wild,pat:cfg.pat||null,arena:cfg.arena!=null?cfg.arena:cfg.practice?0:cfg.title?3:cfg.online?2:cfg.wild?1:2,
    onRound:showBetween,onEnd:res=>{stopLoop();res.ach=checkFightAch(res,cfg);setTimeout(()=>cfg.onResult(res),30)}});
  const S=IC.Fight.S;
  try{if(!cfg.practice){const ov=f=>f.ovr!=null?f:Object.assign({},f,{ovr:IC.ovrOf(f.s,f.style)});S.odds=oddsOf(ov(cfg.a),ov(cfg.b))}}catch(e){S.odds=null}
  USE3D=!!(IC.R3D&&IC.R3D.init(gl));gl.hidden=!USE3D;if(USE3D)IC.R3D.reset();
  if(cfg.scoutMul)S.b.mul*=cfg.scoutMul;
  if(cfg.oppMul)S.b.mul*=cfg.oppMul;
  if(cfg.myMul)S.a.mul*=cfg.myMul;
  if(cfg.startHp){S.a.head=cfg.startHp.h;S.a.body=cfg.startHp.b;S.a.legs=S.a.lgL=S.a.lgR=cfg.startHp.l;S.a.st=Math.min(S.a.st,100-(100-S.a.body)*.4)}
  if(cfg.weigh){if(!cfg.weigh.a.ok)S.a.st=S.a.st*.85;if(!cfg.weigh.b.ok)S.b.st=S.b.st*.85}
  if(cfg.practice)S.tasks=TASKS;
  lastKey='';buildPad();document.querySelector('.app').classList.add('wide');autoImmersive();requestAnimationFrame(fit);startLoop();window.scrollTo(0,0);
}
function buildPad(){
  padL.innerHTML='<div class="joy" id="joy"><div class="joyBase"><span class="jl">◀</span><span class="jr">▶</span><span class="ju">▲</span><span class="jdn">▼</span><div class="joyKnob" id="joyKnob"></div></div></div>';
  const row=document.createElement('div');row.className='lrow';padL.appendChild(row);
  const g=mkBtn('l',1);g.id='guardBtn';row.appendChild(g);
  const sb=document.createElement('button');sb.className='pb ts';sb.id='stanceBtn';sb.type='button';sb.innerHTML='⇄ 스탠스<small>X</small>';
  sb.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();IC.Fight.stance()});sb.addEventListener('contextmenu',e=>e.preventDefault());row.appendChild(sb);
  padR.innerHTML='';
  for(let i=0;i<6;i++)padR.appendChild(mkBtn('r',i));
  bindJoy();
}
/* virtual joystick: 8-way analog movement. Left/right = forward/back, up/down = step in and out of the cage (circling) */
let JOY=null;
function bindJoy(){
  const zone=$('#joy'),knob=$('#joyKnob');let id=null,cx=0,cy=0,R=50;
  let lx=0,ly=0;const set=(dx,dy)=>{lx=dx;ly=dy;
    const d=Math.hypot(dx,dy),k=d>R?R/d:1;dx*=k;dy*=k;
    knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
    let ax=dx/R,az=dy/R;const m=Math.hypot(ax,az);if(m<.2){ax=0;az=0}
    const it=CUR&&CUR.left[0];const can=it&&!it.dim&&!(CUR&&CUR.dim);
    IC.Fight.axis(can?ax:0,can?az:0);
  };
  const base=zone.querySelector('.joyBase');
  const release=()=>{id=null;zone.classList.remove('on');knob.style.transform='translate(-50%,-50%)';base.style.transform='';IC.Fight.axis(0,0)};
  zone.addEventListener('pointerdown',e=>{e.preventDefault();Sound.init();
    /* dynamic thumbstick: the base jumps to wherever the thumb lands inside the left zone.
       a new finger always takes over, so a lost pointerup can never lock the stick */
    id=e.pointerId;base.style.transform='';const r=base.getBoundingClientRect(),zr=zone.getBoundingClientRect();
    const hx=r.width/2,hy=r.height/2,tx=clamp(e.clientX,zr.left+hx*.6,zr.right-hx*.6),ty=clamp(e.clientY,zr.top+hy*.6,zr.bottom-hy*.6);
    base.style.transform=`translate(${tx-(r.left+hx)}px,${ty-(r.top+hy)}px)`;cx=tx;cy=ty;R=r.width*.36;
    try{zone.setPointerCapture(id)}catch(_){}zone.classList.add('on');set(e.clientX-cx,e.clientY-cy)});
  zone.addEventListener('contextmenu',e=>e.preventDefault());
  JOY={move:e=>{if(e.pointerId===id&&zone.isConnected){set(e.clientX-cx,e.clientY-cy)}},
    up:e=>{if(e.pointerId===id)release()},
    reset:()=>{if(id!==null)release()},
    refresh:()=>{if(id!==null)set(lx,ly)},
    get active(){return id!==null}};
}
/* document-level tracking: works even when pointer capture fails (iOS) or the finger slides off the stick */
addEventListener('pointermove',e=>{if(JOY)JOY.move(e)},{passive:true});
const relHolds=pid=>{document.querySelectorAll('#pad .pb').forEach(b=>{if(b._hold&&(pid==null||b._pid===pid)){IC.Fight.hold(b._hold,false);b._hold=null;b.classList.remove('on')}})};
addEventListener('pointerup',e=>{if(JOY)JOY.up(e);relHolds(e.pointerId)},true);
addEventListener('pointercancel',e=>{if(JOY)JOY.up(e);relHolds(e.pointerId)},true);
addEventListener('touchend',e=>{if(e.touches.length===0){if(JOY)JOY.reset();relHolds()}},true);
addEventListener('touchcancel',e=>{if(e.touches.length===0){if(JOY)JOY.reset();relHolds()}},true);
addEventListener('blur',()=>{if(JOY)JOY.reset();relHolds()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&JOY)JOY.reset()});
const KR=['J','U','H','K','I','O']; // J 펀치 · K 킥 · I 클린치/테이크다운 · U/H/O 보조 타격·필살기
function itemAt(side,i){return CUR?(side==='l'?CUR.left[i]:CUR.grid[i]):null}
function mkBtn(side,i){
  const b=document.createElement('button');b.className='pb';b.type='button';
  b.addEventListener('pointerdown',e=>{e.preventDefault();Sound.init();const it=itemAt(side,i);if(!it||(it.dim&&!it.mash))return;b.classList.add('on');if(IC.opts.haptic!==false&&IC.Haptic&&!navigator.vibrate)IC.Haptic.tap();
    if(it.hold){IC.Fight.hold(it.id,true);b._hold=it.id;b._pid=e.pointerId;try{b.setPointerCapture(e.pointerId)}catch(_){}}else IC.Fight.press(it.id)});
  const up=()=>{b.classList.remove('on');if(b._hold){IC.Fight.hold(b._hold,false);b._hold=null}};
  b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
  b.addEventListener('pointerleave',()=>{if(!b._hold)b.classList.remove('on')});
  b.addEventListener('contextmenu',e=>e.preventDefault());
  return b;
}
function updatePad(){
  const c=IC.Fight.context();if(!c)return;CUR=c;
  {const sb=$('#stanceBtn'),P=IC.Fight.S&&IC.Fight.S.p;if(sb&&P&&sb.dataset.s!==P.stance){sb.dataset.s=P.stance;sb.innerHTML=(P.stance==='south'?'사우스포':'오소독스')+'<small>X 전환</small>'}}
  if(c.key===lastKey)return;
  if(!lastKey.startsWith(c.key[0])){IC.Fight.hold('left',false);IC.Fight.hold('right',false)}
  lastKey=c.key;if(JOY)JOY.refresh();
  const paint=(el,it,k)=>{el.className='pb'+(!it.id&&!it.mash?' empty':'')+((it.dim||c.dim)&&!it.mash?' dim':'')+(it.ready?' ready':'')+(it.mash?' mash':'')+(it.tone==='g'?' tg':it.tone==='s'?' ts':'');
    el.innerHTML=`${esc(it.label)}<small>${it.mash?'':k}</small>`};
  [...padR.children].forEach((el,i)=>paint(el,c.grid[i],KR[i]));
  const gb=$('#guardBtn');if(gb)paint(gb,c.left[1],'L');const jy=$('#joy');if(jy)jy.classList.toggle('noMove',!!(c.left[0].dim||c.dim))
  hintEl.textContent=c.hint;
  {const sb=$('#stanceBtn'),P=IC.Fight.S&&IC.Fight.S.p;if(sb&&P){sb.innerHTML=(P.stance==='south'?'사우스포':'오소독스')+'<small>X 전환</small>';sb.classList.toggle('dim',!!(c.dim||IC.Fight.S.gr||IC.Fight.S.cl))}}
}
cv.addEventListener('pointerdown',()=>{const S=IC.Fight.S;if(!S)return;if(S.walk)return;if(S.sub)IC.Fight.mash()});
{const sr=document.createElement('button');sr.className='skipr';sr.textContent='리플레이 스킵 ⏭';sr.addEventListener('click',e=>{e.stopPropagation();IC.Fight.skipReplay()});$('#stage').appendChild(sr);
 const stt=document.createElement('button');stt.className='skipt';stt.textContent='튜토리얼 건너뛰기 ⏭';stt.addEventListener('click',e=>{e.stopPropagation();const S=IC.Fight.S;if(S)S.tasks=null;game.classList.remove('tutorial')});$('#stage').appendChild(stt)}
{const sk=document.createElement('button');sk.className='skipw';sk.textContent='건너뛰기 ⏭';sk.addEventListener('click',e=>{e.stopPropagation();IC.Fight.skipIntro()});$('#stage').appendChild(sk)}
const MOVEK={a:'left',arrowleft:'left',d:'right',arrowright:'right',w:'up',arrowup:'up',s:'dn',arrowdown:'dn'};
addEventListener('keydown',e=>{
  if(game.hidden||!CUR||!between.hidden)return;
  if(IC.Fight.S&&IC.Fight.S.walk&&(e.key==='Enter'||e.key===' '||e.key==='Escape')){e.preventDefault();IC.Fight.skipIntro();return}
  if(e.target&&e.target.tagName==='INPUT')return;
  const lk=e.key.toLowerCase(),mk=MOVEK[lk];if(mk){e.preventDefault();if(!e.repeat&&CUR.left[0]&&!CUR.left[0].dim)IC.Fight.hold(mk,true);return}
  if(lk==='x'&&!e.repeat){e.preventDefault();if(IC.Fight.stance)IC.Fight.stance();return}
  if((lk==='l'||lk===' ')&&!(IC.Fight.S&&IC.Fight.S.sub)){e.preventDefault();const g=CUR.left[1];if(!e.repeat&&g&&!g.dim){IC.Fight.hold('block',true);heldKeys.S='block'}return}
  let k=lk.toUpperCase();
  const S=IC.Fight.S;if(!S)return;
  if(S.sub&&!e.repeat&&(KR.includes(k)||k===' ')){IC.Fight.mash();e.preventDefault();return}
  const ri=KR.indexOf(k);if(ri<0)return;
  e.preventDefault();
  const it=CUR.grid[ri];if(!it||it.dim)return;
  if(it.hold){if(!e.repeat){IC.Fight.hold(it.id,true);heldKeys[k]=it.id}}else if(!e.repeat)IC.Fight.press(it.id);
});
addEventListener('keyup',e=>{const lk=e.key.toLowerCase(),mk=MOVEK[lk];if(mk){IC.Fight.hold(mk,false);return}const k=(lk==='l'||lk===' ')?'S':lk.toUpperCase();if(heldKeys[k]){IC.Fight.hold(heldKeys[k],false);delete heldKeys[k]}});
addEventListener('blur',()=>{IC.Fight.releaseAll();heldKeys={}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!game.hidden&&IC.Fight.S&&IC.Fight.S.mode==='fight'&&between.hidden)openPause()});

function showBetween(info){
  IC.Fight.releaseAll();
  const a=info.a,b=info.b,r=info.last;
  const hp=F=>`머리 ${Math.round(F.head)} · 몸통 ${Math.round(F.body)} · 다리 ${Math.round(F.legs)}`;
  between.innerHTML=`<div class="eyebrow">${info.round}라운드 종료 · 코너</div>
  ${cardsTable(info.all)}
  ${statsTable(r.ra,r.rb,a.nick,b.nick,`${info.round}R 기록`)}
  <p>내 상태: ${hp(a)} · 상대: ${hp(b)}</p>
  <div class="advice" style="border-color:#7fb2ff"><b>해설</b> · ${(r.talk||[]).map(esc).join(' ')}${r.ded?` <b style="color:#ff8b7f">감점: ${r.ded.a?a.nick+' −'+r.ded.a:''}${r.ded.b?' '+b.nick+' −'+r.ded.b:''}</b>`:''}</div>
  ${a.inj&&Object.keys(a.inj).length?`<p style="color:#ff8b7f">부상: ${Object.keys(a.inj).map(k=>IC.Fight.INJ[k]).join(', ')} — 작전을 바꿔 보세요.</p>`:''}
  <div class="advice"><b>코치</b> · ${info.advice.map(esc).join(' ')}</div>
  ${a.cuts>=2?`<p style="color:#ff8b7f">컷맨이 지혈 중입니다. 출혈이 심하면 닥터 스톱이 나올 수 있어요.</p>`:''}
  <h3>다음 라운드 작전</h3><div class="acts plans">
   <button class="act${a.plan==='press'?' on':''}" data-plan="press"><b>압박</b><span>데미지 +6% · 스태미나 소모 +12%</span></button>
   <button class="act${a.plan==='wrestle'?' on':''}" data-plan="wrestle"><b>레슬링</b><span>테이크다운 성공률 +12%</span></button>
   <button class="act${a.plan==='safe'?' on':''}" data-plan="safe"><b>안전하게</b><span>받는 데미지 −8% · 스태미나 소모 −10%</span></button>
   <button class="act${!a.plan?' on':''}" data-plan=""><b>지금처럼</b><span>효과 없음</span></button></div>
  <button class="btn-go blue" id="nextRound">${info.round+1}라운드 시작</button>`;
  between.hidden=false;between.classList.toggle('corner3d',USE3D);pad.hidden=true;hintEl.hidden=true;
  between.querySelectorAll('[data-plan]').forEach(el=>el.onclick=()=>{IC.Fight.setPlan(el.dataset.plan||null);between.querySelectorAll('[data-plan]').forEach(x=>x.classList.toggle('on',x===el))});
  $('#nextRound').onclick=()=>{between.hidden=true;pad.hidden=false;hintEl.hidden=false;lastKey='';IC.Fight.next();startLoop()};
  between.scrollIntoView({block:'nearest'});
  if(CFG&&CFG.online){let n=12;const b=$('#nextRound'),lab=`${info.round+1}라운드 시작`;b.textContent=`${lab} (${n})`;const iv=setInterval(()=>{if(between.hidden||!b.isConnected){clearInterval(iv);return}if(--n<=0){clearInterval(iv);b.click()}else b.textContent=`${lab} (${n})`},1000)}
}
function openPause(){if(CFG&&CFG.online==='spec'){A.oLeave();return}
  const S=IC.Fight.S;if(!S||!between.hidden)return;
  IC.Fight.pause(true);IC.Fight.releaseAll();
  between.innerHTML=`<div class="eyebrow">${CFG&&CFG.online?'온라인 경기 · 멈추지 않아요':'일시정지'}</div><h3>${esc(S.a.name)} vs ${esc(S.b.name)}</h3>
  <div class="tw"><table><thead><tr><th>상황</th><th>조작</th></tr></thead><tbody>
  <tr><td>스탠딩</td><td style="white-space:normal;text-align:left">잽·크로스·훅·킥·그래플·필살기 6개. 가드를 누른 채 누르면 바디샷·회피·어퍼컷·로킥으로 바뀝니다. 킥은 거리에 따라 로·미들·하이킥, 그래플은 멀면 태클·가까우면 클린치.</td></tr>
  <tr><td>방어</td><td style="white-space:normal;text-align:left">가드는 머리·몸통을 막지만 로킥은 못 막아요. 상대 태클에 가드 = 스프롤. 태클 중 클린치 = 길로틴.</td></tr>
  <tr><td>클린치</td><td style="white-space:normal;text-align:left">니킥·엘보·숏펀치, 케이지 압박, 클린치 TD, 역전, 브레이크. 가드 = 프레임.</td></tr>
  <tr><td>그라운드</td><td style="white-space:normal;text-align:left">상위: 파운딩·패스·백 테이크·서브미션 (가드 = 포스처). 하위: 커버·스윕·리가드·일어나기·서브미션.</td></tr>
  <tr><td>서브미션</td><td style="white-space:normal;text-align:left">버튼·화면·키 연타. 체력이 떨어지면 힘이 약해집니다.</td></tr>
  </tbody></table></div>
  <p>모바일: 왼쪽 조이스틱으로 8방향 이동. 좌우는 전진·후진, 위아래는 옆으로 빠지는 사이드 스텝입니다. 조이스틱 아래 가드 버튼을 누르고 있으면 가드(그라운드에선 커버·포스처, 클린치에선 프레임).</p><p class="kbd-only">키보드: W·A·S·D 이동, J 펀치, K 킥, L 가드, I 클린치·테이크다운, X 스탠스 전환 (보조: U 크로스, H 훅, O 필살기). 방향키도 가능.</p>
  <div class="row"><button class="btn-go blue" id="resume">계속</button>${S.practice?'<button class="btn" id="quitP">연습 종료</button>':'<button class="btn" id="forfeit">기권</button>'}</div>`;
  between.hidden=false;between.classList.remove('corner3d');pad.hidden=true;hintEl.hidden=true;
  $('#resume').onclick=()=>{between.hidden=true;pad.hidden=false;hintEl.hidden=false;IC.Fight.pause(false);last=performance.now()};
  const q=$('#quitP');if(q)q.onclick=()=>{IC.Fight.stop();go('practice')};
  const f=$('#forfeit');if(f)f.onclick=()=>{f.disabled=true;f.textContent='기권 확정 — 한 번 더 누르세요';f.disabled=false;f.onclick=()=>{between.hidden=true;pad.hidden=false;IC.Fight.pause(false);IC.Fight.forfeit()}};
}
$('#pauseBtn').addEventListener('click',()=>{if(between.hidden)openPause()});

/* ---------- result ---------- */
/* ---------- achievements ---------- */
const ACH=[
  {id:'first',n:'첫 승리',d:'어떤 모드든 첫 승리'},
  {id:'ko',n:'K.O. 아티스트',d:'KO로 승리'},
  {id:'flash',n:'번개',d:'1라운드 30초 안에 피니시'},
  {id:'sub',n:'탭 아웃',d:'서브미션으로 승리'},
  {id:'subs3',n:'관절 수집가',d:'서로 다른 서브미션 3종으로 승리'},
  {id:'special',n:'하이라이트 필름',d:'필살기로 KO'},
  {id:'hof',n:'명예의 전당',d:'커리어 선수를 명예의 전당에 헌액'},
  {id:'parry3',n:'철벽',d:'한 경기에서 퍼펙트 가드 3번'},
  {id:'heart',n:'불굴의 투혼',d:'투혼 발동 후 역전승'},
  {id:'dec',n:'5라운드 혈투',d:'5라운드 판정까지 가서 승리'},
  {id:'legend',n:'레전드 격파',d:'레전드 난이도에서 승리'},
  {id:'sign',n:'메이저 입성',d:'커리어에서 IRON CAGE 계약'},
  {id:'ranked',n:'랭커',d:'커리어에서 랭킹 15위 진입'},
  {id:'champ',n:'챔피언',d:'커리어에서 타이틀 획득'},
  {id:'double',n:'2체급 챔피언',d:'두 체급에서 벨트 획득'},
  {id:'streak10',n:'무패 행진',d:'커리어 10연승'},
  {id:'tour',n:'토너먼트 우승',d:'8인 토너먼트 우승'}
];
function unlock(ids){DATA.ach=DATA.ach||{};const got=[];for(const id of ids){if(!DATA.ach[id]){DATA.ach[id]=Date.now();const a=ACH.find(x=>x.id===id);if(a)got.push(a)}}if(got.length)save();return got}
function checkFightAch(r,cfg){
  if(cfg&&cfg.practice)return[];const ids=[],won=r.winner==='a';
  if(won){ids.push('first');if(r.method==='KO')ids.push('ko');if(r.method==='서브미션'){ids.push('sub');DATA.subsWon=DATA.subsWon||{};DATA.subsWon[r.detail]=1;if(Object.keys(DATA.subsWon).length>=3)ids.push('subs3')}
    if(r.method!=='판정'&&r.round===1&&/^0:[0-2]\d$/.test(r.time))ids.push('flash');
    if(r.method==='KO'&&Object.values(SPM).some(x=>x.name===r.detail))ids.push('special');
    if(r.heartA)ids.push('heart');if(r.method==='판정'&&r.rounds&&r.rounds.length>=5)ids.push('dec');if((cfg&&cfg.diff||DATA.settings.diff)==='legend')ids.push('legend')}
  if((r.perfects||0)>=3)ids.push('parry3');
  return unlock(ids);
}
const achHtml=got=>got&&got.length?`<div class="achbar">${got.map(a=>`<div><b>업적 달성 · ${esc(a.n)}</b><span>${esc(a.d)}</span></div>`).join('')}</div>`:'';
V.result=p=>{const r=p.res,a=r.a,b=r.b,me=r.winner==='a';
  const head=r.winner?(me?`<span class="b">${r.method==='판정'?'판정승':r.method+' 승리'}</span>`:`<span class="r">${r.method==='판정'?'판정패':r.method+' 패배'}</span>`):'<span class="g">무승부</span>';
  const wn=r.winner?(r.winner==='a'?a:b):null;
  return `<div class="panel"><div class="eyebrow">${esc(p.label||'경기 결과')} · ${r.round}라운드 ${r.time}</div>
  <h2 class="big">${head}</h2>
  <p>${wn?`${esc(wn.name)}, ${esc(r.detail)}${r.method==='판정'?'':' '+(r.method==='서브미션'?'서브미션':r.method)}`:esc(r.detail)}${r.perf&&me?' · 퍼포먼스 보너스 획득':''}${r.fotn?' · 오늘의 명승부':''}</p>
  ${achHtml(r.ach)}${p.extra||''}
  ${(r.perfects||0)>0||r.heartA?`<p>퍼펙트 가드 ${r.perfects||0}회${r.heartA?' · 투혼 발동':''}</p>`:''}
  ${r.rounds&&r.rounds.length?cardsTable(r.rounds):''}
  ${statsTable(r.stats.a,r.stats.b,a.nick,b.nick)}
  <div class="row">${hlBtn(r)}${p.cont.map(([l,act],i)=>`<button class="${i===0?'btn-go':'btn'}" data-act="${act.startsWith('nav:')?'nav':act}" ${act.startsWith('nav:')?`data-to="${act.slice(4)}"`:''}>${l}</button>`).join('')}</div></div>`};

/* ---------- practice ---------- */
const TASKS=[{ev:'land:jab',label:'잽 맞히기'},{ev:'land:bodyshot',label:'바디샷 맞히기'},{ev:'land:lowkick',label:'로킥 맞히기'},{ev:'slip',label:'회피로 피하기'},{ev:'clinch',label:'클린치 잡기'},{ev:'land:c_knee',label:'클린치 바디 니킥'},{ev:'td',label:'테이크다운 성공'},{ev:'pass',label:'가드 패스'},{ev:'sub',label:'서브미션 걸기'},{ev:'kd',label:'녹다운 뺏기'}];
const PR={cls:'lw',a:null,b:null,ai:'defend',inf:true};
V.practice=()=>{const list=IC.byClass(PR.cls).slice().sort((a,b)=>b.ovr-a.ovr);
  return `${back('home')}<div class="panel"><div class="eyebrow">연습</div><h2 class="big">기술 익히기</h2>
  <p>시간 제한이 없고, 무한 체력을 켜면 쓰러지지 않습니다. 화면 왼쪽 과제를 하나씩 해보며 조작을 익히세요. ${PR.a?'':'먼저 내 선수를 고르세요.'}</p>
  ${classTabs(PR.cls,'pcls')}<div class="flist">${list.map((f,i)=>frow(f,{act:'ppick',rank:i,sel:f.id===PR.a?'a':f.id===PR.b?'b':''})).join('')}</div>
  <div class="grid2"><div class="field"><span class="lbl">상대 행동</span>${seg('pai',['idle','defend','normal'],PR.ai,v=>({idle:'가만히',defend:'방어만',normal:'실전처럼'})[v])}</div>
  <div class="field"><span class="lbl">무한 체력</span>${seg('pinf',['on','off'],PR.inf?'on':'off',v=>v==='on'?'켜기':'끄기')}</div></div>
  <button class="btn-go" data-act="pgo" ${PR.a?'':'disabled'}>연습 시작</button></div>`};
A.pcls=d=>{PR.cls=d.v;render()};
A.ppick=d=>{const id=d.id;if(!PR.a)PR.a=id;else if(id===PR.a){PR.a=null;PR.b=null}else if(id===PR.b)PR.b=null;else PR.b=id;render()};
A.pai=d=>{PR.ai=d.v;render()};A.pinf=d=>{PR.inf=d.v==='on';render()};
A.pgo=()=>{const a=getF(PR.a);let b=PR.b?getF(PR.b):IC.byClass(a.cls).find(f=>f.id!==a.id);
  startFight({a,b,rounds:1,label:'연습 · 일시정지에서 종료',practice:{ai:PR.ai,inf:PR.inf},onResult:res=>go('result',{res,label:'연습 경기',cont:[['연습으로','nav:practice'],['메인 메뉴','nav:home']]})})};

/* ---------- records & settings ---------- */
V.wipe=()=>{const c=DATA.career,R=DATA.records;
  return `${back('home')}<div class="panel"><div class="eyebrow">게임 초기화</div><h2 class="big">처음부터 다시 시작할까요?</h2>
  <p>아래 항목이 모두 지워지고 되돌릴 수 없습니다.</p>
  <div class="kv"><div><span>커리어</span><b style="font-size:16px">${c?esc(c.name)+' '+c.rec.join('-'):'없음'}</b></div><div><span>토너먼트 우승</span><b>${R.tour.won}회</b></div>
  <div><span>토너먼트</span><b>${R.tour.won}/${R.tour.played}</b></div><div><span>추가한 선수</span><b>${(DATA.custom||[]).length}명</b></div><div><span>은퇴 선수</span><b>${DATA.archive.length}명</b></div></div>
  <div class="row"><button class="btn-go" data-act="wipeDo">전부 지우고 초기화</button><button class="btn" data-act="nav" data-to="home">취소</button></div></div>`};
A.wipeDo=()=>{DATA=D0();loadCustom();Sound.on=true;save();go('home')};
let resetArm=false;
V.records=()=>{const R=DATA.records,s=DATA.settings;
  return `${back('home')}<div class="panel"><div class="eyebrow">기록</div><h3>통산</h3>
  <div class="kv"><div><span>그랑프리 우승</span><b>${DATA.records.gpWon||0}</b></div><div><span>토너먼트 우승</span><b>${R.tour.won} / ${R.tour.played}</b></div>
  <div><span>KO 승</span><b>${R.fin.KO||0}</b></div><div><span>TKO 승</span><b>${R.fin.TKO||0}</b></div><div><span>서브미션 승</span><b>${R.fin['서브미션']||0}</b></div><div><span>판정승</span><b>${R.fin['판정']||0}</b></div></div>
  <h3>업적 ${Object.keys(DATA.ach||{}).length} / ${ACH.length}</h3><div class="achgrid">${ACH.map(a=>`<div class="${(DATA.ach||{})[a.id]?'on':''}"><b>${esc(a.n)}</b><span>${esc(a.d)}</span></div>`).join('')}</div>
  <h3>은퇴한 선수</h3>${DATA.archive.length?`<div class="tw"><table><thead><tr><th>선수</th><th>체급</th><th>전적</th><th>타이틀</th><th>최고 순위</th></tr></thead><tbody>${DATA.archive.map(x=>`<tr><td>${esc(x.name)}</td><td>${clsName(x.cls)}</td><td>${x.rec.join('-')}</td><td>${x.titles}</td><td>${rankLabel(x.peak)}</td></tr>`).join('')}</tbody></table></div>`:'<p>아직 은퇴한 커리어 선수가 없습니다.</p>'}</div>
  <div class="panel"><div class="eyebrow">설정</div>
  <div class="field"><span class="lbl">기본 난이도</span>${diffSeg()}</div>
  <div class="field"><span class="lbl">라운드 시간</span>${secSeg()}</div>
  <div class="field"><span class="lbl">선수 입장·소개</span>${seg('walk',['on','off'],s.walkout!==false?'on':'off',v=>v==='on'?'켜기':'끄기')}</div>
  <div class="field"><span class="lbl">경기 중 코치 지시</span>${seg('coachS',['on','off'],s.coach!==false?'on':'off',v=>v==='on'?'켜기':'끄기')}</div>
  <div class="field"><span class="lbl">타격 진동</span>${seg('hap',['on','off'],s.haptic!==false?'on':'off',v=>v==='on'?'켜기':'끄기')}</div>
  <div class="field"><span class="lbl">데미지 숫자</span>${seg('nums',['on','off'],s.nums?'on':'off',v=>v==='on'?'표시':'숨김')}</div>
  <div class="field"><span class="lbl">피니시 리플레이</span>${seg('rpl',['on','off'],s.replay!==false?'on':'off',v=>v==='on'?'켜기':'끄기')}</div>
  <p>${Store.db?'진행 상황은 내 계정에 저장되어 다른 기기에서도 이어집니다.':'진행 상황은 이 브라우저에 저장됩니다.'}</p>
  <button class="btn" data-act="reset">${resetArm?'정말 모든 기록을 지울까요? 한 번 더 누르면 삭제':'모든 기록 초기화'}</button></div>`};
A.walk=d=>{DATA.settings.walkout=d.v==='on';save();render()};A.coachS=d=>{DATA.settings.coach=d.v==='on';save();render()};A.voice=d=>{DATA.settings.voiceOn=d.v==='on';save();render()};A.gfx=d=>{DATA.settings.gfx=d.v;save();render()};A.nums=d=>{DATA.settings.nums=d.v==='on';save();render()};A.hap=d=>{DATA.settings.haptic=d.v==='on';IC.opts.haptic=DATA.settings.haptic;save();if(DATA.settings.haptic&&IC.Haptic)IC.Haptic.play([20,30,40]);render()};A.rpl=d=>{DATA.settings.replay=d.v==='on';save();render()};A.hpos=d=>{DATA.settings.hudPos=d.v;save();render()};
A.snd=d=>{DATA.settings.sound=d.v==='on';Sound.on=DATA.settings.sound;save();render()};
A.reset=()=>{if(!resetArm){resetArm=true;render();return}resetArm=false;DATA=D0();loadCustom();save();go('home')};

/* ---------- tournament ---------- */
const TS={cls:'lw',me:null};
A.tour=()=>{if(DATA.tour&&DATA.tour.stage!=='done')go('bracket');else go('tsetup')};
V.tsetup=()=>{const list=IC.byClass(TS.cls).slice().sort((a,b)=>b.ovr-a.ovr);
  return `${back('home')}<div class="panel"><div class="eyebrow">토너먼트</div><h2 class="big">8인 녹아웃</h2><p>한 체급 8명이 8강, 4강, 결승을 치릅니다. 내 경기는 직접, 나머지는 시뮬레이션으로 진행됩니다. 결승은 5라운드.</p>
  ${classTabs(TS.cls,'tcls')}<div class="flist">${list.map((f,i)=>frow(f,{act:'tpick',rank:i,sel:f.id===TS.me?'a':''})).join('')}</div>
  <div class="field"><span class="lbl">난이도</span>${diffSeg()}</div>
  <button class="btn-go" data-act="tstart" ${TS.me?'':'disabled'}>대진 추첨</button></div>`};
A.tcls=d=>{TS.cls=d.v;TS.me=null;render()};
A.tpick=d=>{TS.me=TS.me===d.id?null:d.id;render()};
A.tstart=()=>{const ids=IC.byClass(TS.cls).map(f=>f.id).sort(()=>Math.random()-.5);
  DATA.tour={cls:TS.cls,me:TS.me,stage:0,br:[[[ids[0],ids[1]],[ids[2],ids[3]],[ids[4],ids[5]],[ids[6],ids[7]]],[],[]],win:[[],[],[]],out:false,champ:null,log:[]};
  save();go('bracket')};
const STG=['8강','4강','결승'];
function tAdvance(){
  const T=DATA.tour,s=T.stage;
  T.br[s].forEach((m,i)=>{if(T.win[s][i])return;const r=IC.Fight.sim(getF(m[0]),getF(m[1]),s===2?5:3);T.win[s][i]=r.winner==='a'?m[0]:m[1];
    T.log.unshift(`${STG[s]} · ${getF(T.win[s][i]).name} ${r.method} 승 (${r.round}R)`)});
  if(s<2){T.br[s+1]=[];for(let i=0;i<T.win[s].length;i+=2)T.br[s+1].push([T.win[s][i],T.win[s][i+1]]);T.stage=s+1}
  else{T.champ=T.win[2][0];T.stage='done';DATA.records.tour.played++;if(T.champ===T.me){DATA.records.tour.won++;unlock(['tour'])}}
}
V.bracket=()=>{const T=DATA.tour;
  const nm=id=>{const f=getF(id);return f?esc(f.name):''};
  const col=s=>{const n=[4,2,1][s];let h='';for(let i=0;i<n;i++){const m=T.br[s][i];const w=T.win[s][i];
    h+=`<div class="match">${[0,1].map(k=>{const id=m&&m[k];const cls=!id?'':w?(w===id?'w':'l'):'';return `<div class="${cls} ${id===T.me?'me':''}"><span>${id?nm(id):'—'}</span><span>${id?getF(id).ovr:''}</span></div>`}).join('')}</div>`}return `<div class="bcol"><div class="lbl">${STG[s]}</div>${h}</div>`};
  const done=T.stage==='done';
  const myM=!done&&T.br[T.stage].findIndex(m=>m.includes(T.me));
  const canFight=!done&&!T.out&&myM>=0&&!T.win[T.stage][myM];
  return `${back('home')}<div class="panel"><div class="eyebrow">토너먼트 · ${clsName(T.cls)}</div>
  <h2 class="big">${done?(T.champ===T.me?'<span class="g">우승!</span>':`우승: <span class="r">${nm(T.champ)}</span>`):T.out?'<span class="r">탈락</span>':`<span class="b">${STG[T.stage]}</span> 진행 중`}</h2>
  <div class="bracket">${col(0)}${col(1)}${col(2)}</div>
  <div class="row">${canFight?`<button class="btn-go" data-act="tfight">내 ${STG[T.stage]} 경기</button>`:''}${!done&&T.out?'<button class="btn-go" data-act="tsimall">남은 경기 시뮬레이션</button>':''}${done?'<button class="btn-go" data-act="tnew">새 토너먼트</button>':''}<button class="btn" data-act="nav" data-to="home">메인 메뉴</button></div>
  ${T.log.length?`<div class="log">${T.log.slice(0,8).map(l=>`<div>${esc(l)}</div>`).join('')}</div>`:''}</div>`};
A.tnew=()=>{DATA.tour=null;save();go('tsetup')};
A.tsimall=()=>{while(DATA.tour.stage!=='done')tAdvance();save();render()};
A.tfight=()=>{const T=DATA.tour,s=T.stage,i=T.br[s].findIndex(m=>m.includes(T.me)),m=T.br[s][i];
  const a=getF(T.me),b=getF(m[0]===T.me?m[1]:m[0]),rounds=s===2?5:3;
  go('tale',{a,b,rounds,title:s===2,label:`토너먼트 ${STG[s]}`,backTo:'bracket',run:(o={})=>startFight({weigh:o.weigh,a,b,rounds,title:s===2,label:`토너먼트 ${STG[s]} · ${clsName(T.cls)}`,onResult:res=>{
    const R=DATA.records;
    if(res.winner==='a'){T.win[s][i]=T.me;R.fin[res.method]=(R.fin[res.method]||0)+1;T.log.unshift(`${STG[s]} · ${a.name} ${res.method} 승 (${res.round}R)`)}
    else{T.win[s][i]=b.id;T.out=true;T.log.unshift(`${STG[s]} · ${b.name} ${res.method||'판정'} 승`)}
    tAdvance();save();
    go('result',{res,label:`토너먼트 ${STG[s]}`,cont:[['대진표 보기','nav:bracket'],['메인 메뉴','nav:home']]})}})})};

/* ---------- career ---------- */
const GYMS=[
  {id:'local',name:'동네 체육관',cost:0,mul:{strike:1,wrestle:1,bjj:1,cond:1},desc:'무료. 무난한 기본기 훈련.'},
  {id:'strike',name:'킥복싱 아카데미',cost:15000,mul:{strike:1.45,wrestle:.9,bjj:.9,cond:1.1},desc:'타격 훈련 효율 대폭 상승.'},
  {id:'wrestle',name:'레슬링 클럽',cost:15000,mul:{strike:.9,wrestle:1.45,bjj:1.05,cond:1.15},desc:'테이크다운·클린치·그라운드 타격 강화.'},
  {id:'bjj',name:'주짓수 아카데미',cost:15000,mul:{strike:.9,wrestle:1,bjj:1.5,cond:1},desc:'서브미션 공수 집중 훈련.'},
  {id:'elite',name:'엘리트 MMA 팀',cost:45000,mul:{strike:1.35,wrestle:1.35,bjj:1.35,cond:1.3},desc:'모든 훈련 효율 상승. 인지도 40 이상.',minHype:40}
];
const ACTS={
  spar:{name:'타격 스파링',grp:'strike',stats:['pow','spd','kick','sdef'],en:-22,inj:.05,d:'펀치·킥·타격 방어'},
  wrestle:{name:'레슬링 훈련',grp:'wrestle',stats:['td','tdd','clinch','gnp'],en:-24,inj:.05,d:'테이크다운·클린치·파운딩'},
  bjj:{name:'주짓수 롤링',grp:'bjj',stats:['subO','subD','gnp'],en:-20,inj:.04,d:'서브미션 공격·방어'},
  cond:{name:'컨디셔닝',grp:'cond',stats:['car','chin'],en:-18,inj:.02,d:'체력·맷집'},
  film:{name:'상대 분석',grp:null,stats:[],en:-4,inj:0,d:'경기 전 상대 성향 파악, 받는 데미지 5% 감소'},
  rest:{name:'휴식',grp:null,stats:[],en:35,inj:0,d:'에너지 회복. 경기 당일 컨디션에 영향'}
};
const CR={name:'',nick:'',from:'대한민국',cls:'lw',style:'kickboxer',skin:IC.SKIN_OPTIONS[1],hair:IC.HAIR[0],hairStyle:'short',beard:false,trunk:IC.TRUNKS[0]};
A.career=()=>{if(DATA.career)go('chub');else go('ccreate')};
function previewData(){const s=IC.makeStats(CR.style,56,IC.seeded(7));return{id:'__tmp',name:CR.name||'이름 없음',nick:CR.nick||'',from:CR.from,style:CR.style,s,look:{skin:CR.skin,hair:CR.hair,hairStyle:CR.hairStyle,beard:CR.beard,trunk:CR.trunk},special:STYLES[CR.style].sp[0]}}
V.ccreate=()=>{P._tmp=previewData();const pv=P._tmp;
  const sw=(act,arr,cur)=>`<div class="swatches">${arr.map(c=>`<button data-act="${act}" data-v="${c}" aria-pressed="${c===cur}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>`;
  return `${back('home')}<div class="panel"><div class="eyebrow">커리어 · 선수 생성</div><h2 class="big">나만의 파이터</h2>
  <div class="chead"><canvas data-pid="__tmp"></canvas><div style="display:flex;flex-direction:column;gap:6px;min-width:0"><b style="font-family:var(--display);font-size:24px;font-weight:400">${esc(CR.name||'이름을 입력하세요')}</b><span style="color:var(--muted);font-size:13px">${CR.nick?`"${esc(CR.nick)}" · `:''}${STYLES[CR.style].name} · ${clsName(CR.cls)} · 시작 종합 ${IC.ovrOf(pv.s,CR.style)}</span></div></div>
  <div class="grid2"><label class="field"><span class="lbl">이름</span><input type="text" id="crName" maxlength="16" data-bind="name" value="${esc(CR.name)}" placeholder="예: 강도윤"></label>
  <label class="field"><span class="lbl">닉네임</span><input type="text" id="crNick" maxlength="12" data-bind="nick" value="${esc(CR.nick)}" placeholder="예: 썬더볼트"></label>
  <label class="field"><span class="lbl">국적</span><select id="crFrom" data-change="crSel" data-k="from">${IC.COUNTRIES.map(c=>`<option ${c===CR.from?'selected':''}>${c}</option>`).join('')}</select></label>
  <label class="field"><span class="lbl">체급</span><select id="crCls" data-change="crSel" data-k="cls">${CLASSES.map(c=>`<option value="${c.id}" ${c.id===CR.cls?'selected':''}>${c.name} (${c.kg}kg)</option>`).join('')}</select></label></div>
  <div class="field"><span class="lbl">파이팅 스타일</span>${seg('crStyle',Object.keys(STYLES),CR.style,k=>STYLES[k].name)}</div>
  ${sbars(pv.s)}
  <div class="grid2"><div class="field"><span class="lbl">피부</span>${sw('crSkin',IC.SKIN_OPTIONS,CR.skin)}</div><div class="field"><span class="lbl">머리색</span>${sw('crHair',IC.HAIR,CR.hair)}</div>
  <div class="field"><span class="lbl">트렁크</span>${sw('crTrunk',IC.TRUNKS,CR.trunk)}</div>
  <div class="field"><span class="lbl">헤어 · 수염</span>${seg('crHs',['short','buzz','bald','long','bun','mohawk'],CR.hairStyle,v=>({short:'짧은',buzz:'버즈',bald:'삭발',long:'장발',bun:'묶음',mohawk:'모히칸'})[v])}${seg('crBeard',['no','yes'],CR.beard?'yes':'no',v=>v==='yes'?'수염 있음':'수염 없음')}</div></div>
  <p>시작 시 랭킹 외 무명 선수입니다. 경기마다 3개의 대전 제안 중 하나를 고르고, 4주 트레이닝 캠프를 거쳐 파이트 나이트에 나섭니다.</p>
  <button class="btn-go" data-act="crGo">커리어 시작</button></div>`};
A.bind=(d,el)=>{CR[d.bind]=el.value};
A.crSel=(d,el)=>{CR[d.k]=el.value;keepInputs();render()};
function keepInputs(){const n=$('#crName'),k=$('#crNick');if(n)CR.name=n.value;if(k)CR.nick=k.value}
A.crStyle=d=>{keepInputs();CR.style=d.v;render()};A.crSkin=d=>{keepInputs();CR.skin=d.v;render()};A.crHair=d=>{keepInputs();CR.hair=d.v;render()};
A.crTrunk=d=>{keepInputs();CR.trunk=d.v;render()};A.crHs=d=>{keepInputs();CR.hairStyle=d.v;render()};A.crBeard=d=>{keepInputs();CR.beard=d.v==='yes';render()};
A.crGo=()=>{keepInputs();const name=CR.name.trim();if(!name){const n=$('#crName');n.focus();n.placeholder='이름을 입력해야 시작할 수 있어요';return}
  const C=CLASSES.find(c=>c.id===CR.cls),seed=Math.floor(Math.random()*1e9);
  const s=IC.makeStats(CR.style,56,Math.random);
  const c={v:1,seed,name,nick:CR.nick.trim()||name,from:CR.from,cls:CR.cls,style:CR.style,look:{skin:CR.skin,hair:CR.hair,hairStyle:CR.hairStyle,beard:CR.beard,trunk:CR.trunk,tattoo:false},
    s,special:STYLES[CR.style].sp[0],unlocked:[...STYLES[CR.style].sp],age:22,rec:[0,0,0],hype:5,gym:'local',energy:100,phase:'offers',offers:[],fight:null,camp:null,
    pts:3,streak:0,isChamp:false,titleDef:0,titles:0,peak:99,history:[],news:['지역 단체에서 프로 커리어를 시작합니다. 3승을 거두면 IRON CAGE 입성 테스트 기회가 옵니다.'],tier:'regional',reg:{w:0,l:0},locals:[],belts:[],cutRisk:0,height:Math.round((C.h[0]+C.h[1])/2),reach:Math.round((C.reach[0]+C.reach[1])/2),fillers:genFillers(CR.cls,seed),order:[]};
  const ids=[...IC.byClass(CR.cls).map(f=>f.id),...c.fillers.map(f=>f.id)];
  c.order=ids.sort((x,y)=>getF(y,c).ovr-getF(x,c).ovr);c.order.push('me');
  c.offers=makeOffers(c);DATA.career=c;save();go('chub')};

function makeOffers(c){const o=makeOffers0(c);try{const k=kcOffer(c);if(k)o.unshift(k)}catch(e){console.error(e)}try{if(c.flags&&c.flags.callout&&c.tier!=='regional'&&!c.isChamp&&c.order.indexOf('me')<=5&&!o.some(x=>x.title)){o.unshift({opp:c.order[0],title:true,rounds:5,purse:Math.round(120000+c.hype*1500),callout:true});c.flags.callout=0}}catch(e){}try{const r=rivalOffer(ensureC(c));if(r&&!o.some(x=>x.opp===r.opp))o.unshift(r)}catch(e){console.error(e)}return o}
function kcOffer(c){if(c.tier==='regional'||!c.isChamp||(!(c.titleDef>=1)&&!c.kc))return null;if(Math.random()<(c.kc?.5:.4))return null;
  const ci=CLASSES.findIndex(x=>x.id===c.cls),adj=[CLASSES[ci-1],CLASSES[ci+1]].filter(Boolean),cl=adj[Math.floor(Math.random()*adj.length)];if(!cl)return null;
  const top=IC.byClass(cl.id).filter(f=>!f.legend).sort((a,b)=>b.ovr-a.ovr)[0];if(!top)return null;
  return{opp:top.id,kc:true,rounds:5,purse:Math.round(250000+c.hype*3000)}}
function makeOffers0(c){
  if(c.tier==='regional')return regionalOffers(c);
  const ord=c.order,me=ord.indexOf('me'),offers=[];
  const purse=idx=>12000+(20-Math.min(idx,20))*2500+c.hype*300;
  const mk=(id,title)=>{const idx=ord.indexOf(id);return{opp:id,title,rounds:title?5:3,purse:Math.round(title?120000+c.hype*1500:purse(idx))}};
  const rec=c.recent||[];
  if(c.isChamp){const top=ord.slice(1,9).filter(x=>x!=='me'&&!rec.includes(x));top.slice(0,2).forEach(id=>offers.push(mk(id,true)));const rest=top.slice(2).sort(()=>Math.random()-.5);if(rest[0])offers.push(mk(rest[0],true));return offers}
  if(me>=1&&me<=3&&(c.streak>=2||me===1))offers.push(mk(ord[0],true));
  let pool;
  if(me<=16)pool=ord.slice(Math.max(1,me-6),me+6).filter(x=>x!=='me'&&!rec.includes(x));
  else pool=ord.slice(Math.max(17,me-9),me+6).filter(x=>x!=='me'&&!rec.includes(x));
  if(pool.length<3)pool=ord.slice(Math.max(1,me-10),me+10).filter(x=>x!=='me'&&!rec.includes(x));
  pool.sort(()=>Math.random()-.5);
  for(const id of pool){if(offers.length>=3)break;if(!offers.some(o=>o.opp===id))offers.push(mk(id,false))}
  return offers;
}
function simWorld(c){
  const ord=c.order,news=[];
  for(let k=0;k<3;k++){
    const i=1+Math.floor(Math.random()*Math.min(18,ord.length-3)),j=i+1+Math.floor(Math.random()*3);
    if(j>=ord.length||ord[i]==='me'||ord[j]==='me')continue;
    const fa=getF(ord[i],c),fb=getF(ord[j],c),r=IC.Fight.sim(fa,fb,3);
    if(r.winner==='b'){ord[i]=fb.id;ord[j]=fa.id}
    const w=r.winner==='a'?fa:fb,l=r.winner==='a'?fb:fa;
    news.push(`${w.name}, ${l.name}에게 ${r.method} 승 (${r.round}R)`);
  }
  if(ord[0]!=='me'&&ord[1]!=='me'&&Math.random()<.25){
    const ch=getF(ord[0],c),cn=getF(ord[1],c),r=IC.Fight.sim(ch,cn,5);
    if(r.winner==='b'){ord[0]=cn.id;ord[1]=ch.id;news.push(`새 챔피언 탄생! ${cn.name}, ${ch.name}를 ${r.method}로 꺾었습니다`)}
    else news.push(`챔피언 ${ch.name}, ${cn.name} 상대로 타이틀 방어 (${r.method})`);
  }
  c.news=[...news,...c.news].slice(0,8);
}
function genLocal(c,k){const r=Math.random,C=CLASSES.find(x=>x.id===c.cls),styles=Object.keys(STYLES),style=styles[Math.floor(r()*styles.length)],from=pick(FROMS);
  const ovr=Math.round(46+c.reg.w*3+r()*6+(k==='contender'?6:0)),s=IC.makeStats(style,ovr,r),sp=STYLES[style].sp,id='L_'+Date.now().toString(36)+Math.floor(r()*1e4);
  return{id,cls:c.cls,name:`${pick(FIRST)} ${pick(LAST)}`,nick:pick(NICKS),from,style,s,ovr:IC.ovrOf(s,style),special:sp[0],look:IC.makeLook(id,from,r),
    height:Math.round(C.h[0]+r()*(C.h[1]-C.h[0])),reach:Math.round(C.reach[0]+r()*(C.reach[1]-C.reach[0])),age:20+Math.floor(r()*8),rec:[Math.floor(r()*6)+c.reg.w,Math.floor(r()*4),0],local:true}}
function regionalOffers(c){
  c.locals=[];const offers=[];
  if(c.reg.w>=3){const f=genLocal(c,'contender');c.locals.push(f);offers.push({opp:f.id,title:false,rounds:3,purse:8000+c.hype*200,contender:true})}
  const n=c.reg.w>=3?1:3;
  for(let i=0;i<n;i++){const f=genLocal(c);c.locals.push(f);offers.push({opp:f.id,title:false,rounds:3,purse:Math.round(1500+c.reg.w*600+Math.random()*1500),local:true})}
  return offers;
}
function moveMe(c,to){const o=c.order;o.splice(o.indexOf('me'),1);o.splice(clamp(to,0,o.length),0,'me')}

function hubPanel(c){const R=c.rival,rf=rivalF(c),[fl,fc]=fitLab(c.fit),un=unread(c),ri=R&&R.inMain?c.order.indexOf(R.id):-1;
  return `<div class="hub">
  <button class="hcell" data-act="nav" data-to="cphone"><span>휴대폰</span><b>${un?`<em class="badge">${un}</em> 새 메시지`:'메시지 없음'}</b><small>${un?esc(whoName(c,c.msgs.find(m=>!m.done||!m.read).from)[0]):'코치·매니저·라이벌'}</small></button>
  <div class="hcell"><span>피트니스 · ${c.day}일차</span><b style="color:${fc}">${Math.round(c.fit)} ${fl}</b><div class="meter"><i style="width:${c.fit}%;background:${fc}"></i></div></div>
  ${R?`<div class="hcell rival"><span>라이벌 · 같은 체육관</span><b>${esc(R.name)} "${esc(R.nick)}"</b><small>${rf?`종합 ${rf.ovr} · ${rf.rec.join('-')}`:''} · ${R.inMain?(ri>=0?rankLabel(ri):'랭킹 외'):'지역 단체'}${R.fights?` · 맞대결 ${R.losses}승 ${R.wins}패`:''}</small><div class="meter heat"><i style="width:${R.heat}%"></i></div><small>열기 ${Math.round(R.heat)}${R.heat>=45&&R.inMain?' · 라이벌전 가능':''}</small></div>`:''}
  </div>
  <div class="panel"><div class="between-row"><div class="eyebrow">SNS</div><button class="btn sm" data-act="nav" data-to="csns">전체 보기</button></div><div class="feed">${c.feed.slice(0,3).map(postHtml).join('')||'<p>조용합니다.</p>'}</div></div>`}
V.chub=()=>{const c=ensureC(DATA.career),me=meData(c),idx=c.order.indexOf('me'),gym=GYMS.find(g=>g.id===c.gym);
  let main='';
  if(c.phase==='offers'){
    main=`${c.tier==='regional'?`<div class="advice"><b>지역 단체</b> · ${c.reg.w}승 ${c.reg.l}패. ${c.reg.w>=3?'IRON CAGE 입성 테스트 기회가 왔습니다!':`${3-c.reg.w}승을 더 하면 IRON CAGE 입성 테스트 기회가 옵니다.`}</div>`:''}<div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">대전 제안</h3><button class="btn sm" data-act="cReroll">🔄 다른 상대 요청</button></div><p>매니저가 가져온 제안입니다. 하나를 수락하면 10일 파이트 캠프가 시작됩니다. 하루에 할 일을 하나씩 고르면 돼요.</p>
    ${c.offers.map((o,i)=>{const f=getF(o.opp,c),oi=c.order.indexOf(o.opp);return `<div class="offer ${o.title||o.kc?'title':''}${o.kc?' kc':''}"><div style="min-width:0;display:flex;flex-direction:column;gap:3px"><b style="font-size:16px">${o.kc?'👑 슈퍼파이트 · ':''}${o.title?'🏆 ':''}${o.rival?'🔥 라이벌전 · ':''}${o.contender?'입성 테스트 · ':''}${esc(f.name)} <span style="color:var(--muted);font-weight:400">"${esc(f.nick)}"</span></b>
      <span style="font-size:13px;color:var(--muted)">${o.local||o.contender?'지역 단체':o.kc?clsName(f.cls)+' 챔피언':o.superfight?'체급 데뷔':rankLabel(oi)} · ${STYLES[f.style].name} · 종합 ${f.ovr} · ${f.rec.join('-')} · ${o.rounds}라운드${o.title?' · 타이틀전':''}${o.kc?' · 킹 오브 케이지 벨트':''}</span></div>
      <button class="btn${o.title?'-go':''}" data-act="cAccept" data-i="${i}" >수락</button></div>`}).join('')}
    `;
  }else if(c.phase==='camp'){
    const f=getF(c.fight.opp,c);main=`${c.fight.card?`<div class="evmini"><span>${c.fight.card.reg?'지역 대회':'넘버링 이벤트'}</span><b>${esc(c.fight.card.name)}</b><em>${esc(c.fight.card.city)} · ${(c.fight.card.bouts.find(b=>b.me)||{}).slot||''}</em><button class="btn sm" data-act="nav" data-to="ccard">대진표</button></div>`:''}<h3>파이트 캠프 · D-${Math.max(0,(c.camp.len||CAMP_LEN)-(c.camp.day||0))}</h3><p>상대: ${esc(f.name)} (${STYLES[f.style].name}, 종합 ${f.ovr})</p><button class="btn-go blue" data-act="nav" data-to="camp">캠프로 가기</button>`;
  }else if(c.phase==='fight'){
    const f=getF(c.fight.opp,c),o=c.fight;const evm=o.card?`<div class="evmini"><span>${o.card.reg?'지역 대회':'넘버링 이벤트'} · 오늘 밤</span><b>${esc(o.card.name)}</b><em>${esc(o.card.city)} · ${(o.card.bouts.find(b=>b.me)||{}).slot||''}</em><button class="btn sm" data-act="nav" data-to="ccard">대진표</button></div>`:'';
    if(!o.press){o.trash=o.trash||talk('press',{me:c.nick,op:f.nick});
      main=`${evm}<div class="cine3d" id="pressHost"><span class="cTag">기자회견 · LIVE</span></div><h3>기자회견</h3><div class="advice"><b>${esc(f.nick)}</b> · “${esc(o.trash)}”</div><p>어떻게 받아칠까요? 선택에 따라 인지도와 상대의 독기가 달라집니다.</p>
      <div class="acts"><button class="act" data-act="cPress" data-v="respect"><b>존중</b><span>“좋은 선수다. 케이지에서 보여 주겠다.”</span><span>인지도 +2 · 상대 평정심 유지</span></button>
      <button class="act" data-act="cPress" data-v="taunt"><b>도발</b><span>“넌 내 연습 상대 수준이야.”</span><span>인지도 +8 · 상대가 독기를 품음 (데미지 +5%)</span></button>
      <button class="act" data-act="cPress" data-v="callout"><b>KO 예고</b><span>“2라운드 안에 재운다.”</span><span>인지도 +12 · (T)KO로 이기면 인지도 +10 추가, 못 하면 인지도 −10</span></button></div>`}
    else main=`${evm}<h3>파이트 나이트</h3><p>${esc(f.name)}와 ${o.rounds}라운드${o.title?' 타이틀전':''}. 컨디션 ${Math.round(c.energy)}%. 기자회견: ${({respect:'존중',taunt:'도발',callout:'KO 예고'})[o.press]}</p><button class="btn-go" data-act="cFight">입장</button>`;
  }
  return `${back('home')}<div class="panel"><div class="chead"><canvas data-pid="me"></canvas><div style="display:flex;flex-direction:column;gap:4px;min-width:0">
  <div class="eyebrow">${clsName(c.cls)} · ${cRank(c)}${c.isChamp?' · 방어 '+c.titleDef+'회':''}${c.kc?' · 👑 킹 오브 케이지':''}${c.league==='super'?' · ⭐ 슈퍼리그'+(hofScore(c).total>=HOF_NEED?' (명예의 전당 난이도)':''):''}${(c.belts||[]).length>1?' · '+c.belts.length+'체급 챔피언':''}</div><h2 class="big" style="font-size:clamp(26px,6vw,42px)">${esc(c.name)}</h2>
  <p>"${esc(c.nick)}" · ${STYLES[c.style].name} · ${esc(c.from)} · ${Math.floor(c.age)}세</p></div></div>
  <div class="kv"><div><span>전적</span><b>${c.rec.join('-')}</b></div><div><span>종합</span><b>${me.ovr}</b></div><div><span>인지도</span><b>${Math.round(c.hype)}</b></div><div><span>연승</span><b>${c.streak}</b></div><div data-act="nav" data-to="hof" style="cursor:pointer"><span>명예의 전당</span><b style="color:${hofScore(c).total>=HOF_NEED?'var(--gold)':'inherit'}">${hofScore(c).total}<small style="font-size:12px;color:var(--muted)"> / ${HOF_NEED}</small></b></div><div><span>체육관</span><b style="font-size:15px">${gym.name}</b></div></div></div>
  <div class="panel">${main}</div>
  ${hubPanel(c)}
  <div class="panel"><div class="row">
    <button class="btn" data-act="nav" data-to="cstats">능력치${c.pts>0?` · 포인트 ${c.pts}`:''}</button><button class="btn" data-act="nav" data-to="cgym">체육관</button><button class="btn" data-act="nav" data-to="cspec">필살기</button><button class="btn" data-act="songOpen" data-id="me">입장곡</button>
    <button class="btn" data-act="nav" data-to="crank">랭킹</button><button class="btn" data-act="nav" data-to="cclass" ${c.phase==='fight'?'disabled':''}>체급 변경</button><button class="btn" data-act="nav" data-to="chist">전적</button><button class="btn" data-act="nav" data-to="cevents">지난 이벤트</button><button class="btn" data-act="nav" data-to="csns">SNS</button><button class="btn" data-act="nav" data-to="cphone">휴대폰${unread(c)?` <em class="badge">${unread(c)}</em>`:''}</button><button class="btn" data-act="nav" data-to="cretire">은퇴</button></div>
  ${c.news.length?`<h3>${clsName(c.cls)} 소식</h3><div class="log">${c.news.slice(0,5).map(n=>`<div>${esc(n)}</div>`).join('')}</div>`:''}</div>`};
A.cReroll=()=>{const c=DATA.career;if(c.phase!=='offers')return;c.rerolled=(c.rerolled||0)+1;const old=c.offers.map(o=>o.opp);c.recent=[...(c.recent||[]),...old];c.offers=makeOffers(c);c.recent=c.recent.slice(0,4);save();render()};
A.cAccept=d=>{{const c0=DATA.career;if(c0)c0.rerolled=0}const c=DATA.career,o=c.offers[+d.i],gym=GYMS.find(g=>g.id===c.gym);
  c.fight=o;try{o.card=buildCard(c,o)}catch(e){console.error(e)}c.phase='camp';ensureC(c);c.camp={day:0,len:CAMP_LEN,cal:[],log:[],scout:false,injured:false};c.energy=Math.max(c.energy,70);
  {const f=getF(o.opp,c);const sl=o.card&&(o.card.bouts.find(b=>b.me)||{}).slot;post(c,'press',`[공식] ${c.name} vs ${f.name}${o.card?' — '+o.card.name+(sl?' '+sl:''):''} 확정${o.title?' (타이틀전)':o.rival?' (라이벌전)':''}`);
   post(c,'opp',pick([`${c.nick}? 좋다. 준비됐다.`,`${c.nick}, 열흘 뒤에 보자.`,`이번 경기 끝나면 다들 내 이름 기억할 거다.`]),{f});post(c,'fan',pick([`${c.nick} vs ${f.nick} 이거 꿀매치`,`${f.nick} 상대로 ${c.nick} 괜찮을까`,`예매 성공!!`]));
   msg(c,'manager',[`${f.name} 경기 확정됐어요! 경기까지 10일이에요.`,`캠프 일정은 제가 다 맞춰 둘게요.`],[{t:'좋아요!',eff:{},res:'파이팅!'},{t:'상대 경기 영상 좀 구해 줄 수 있어요?',p:.6,ok:{msg:'영상 확보!',eff:{scout:true},res:'구했어요! 캠프에서 분석해 봐요.'},bad:{msg:'영상 확보 실패',eff:{},res:'이번엔 못 구했어요… 다음엔 꼭!'}}])}
  save();go('camp')};
A.cInjury=()=>{const c=DATA.career;c.hype=Math.max(0,c.hype-4);c.phase='offers';c.fight=null;c.camp=null;c.energy=80;simWorld(c);c.offers=makeOffers(c);save();go('chub')};
/* ================= career rebuild: calendar camp, fitness, SNS, phone, narrative events, rival ================= */
const CAMP_LEN=10; /* days */
function ensureC(c){
  if(!c)return c;
  if(c.fit==null)c.fit=55;
  c.feed=c.feed||[];c.msgs=c.msgs||[];c.flags=c.flags||{};c.day=c.day||0;
  if(!c.rival)c.rival=makeRival(c);
  if(c.camp&&c.camp.week!=null&&c.camp.day==null){c.camp.day=Math.min(CAMP_LEN,c.camp.week);c.camp.len=CAMP_LEN;c.camp.cal=[];delete c.camp.week}
  if(c.camp&&c.camp.len!==CAMP_LEN){c.camp.day=Math.min(CAMP_LEN,Math.round(c.camp.day*CAMP_LEN/c.camp.len));c.camp.len=CAMP_LEN;c.camp.cal=[]}
  if(!c.flags.welcome){c.flags.welcome=1;
    msg(c,'coach',[`${c.nick}, 우리 체육관에 온 걸 환영한다. 지역 무대부터 차근차근 밟아 올라가자.`,`그리고 하나만 기억해. 같은 체육관의 ${c.rival.name}, 저 녀석도 너만큼 IRON CAGE를 노린다.`],
      [{t:'제가 먼저 올라갈게요.',eff:{heat:6,hype:1},res:'좋아, 그 독기 그대로 케이지까지 가져가.'},{t:'같이 성장하면 좋죠.',eff:{heat:-4},res:'성숙하구나. 그래도 링 위에선 봐주지 마라.'}]);
    post(c,'rival',`새 얼굴이 왔네. ${c.nick}? 체육관 막내 신고식은 내가 해 줄게.`);
  }
  return c;
}
/* ---------- rival ---------- */
function makeRival(c){
  const r=Math.random,C=CLASSES.find(x=>x.id===c.cls),styles=Object.keys(STYLES),style=styles.filter(x=>x!==c.style)[Math.floor(r()*(styles.length-1))],from=pick(FROMS);
  const ovr=60,s=IC.makeStats(style,ovr,r),id='RIV_'+Date.now().toString(36);
  const f={id,cls:c.cls,name:`${pick(FIRST)} ${pick(LAST)}`,nick:pick(['데스윙','블랙맘바','헬하운드','킹슬레이어','아이스콜드','더 프레데터']),from,style,s,ovr:IC.ovrOf(s,style),special:STYLES[style].sp[0],look:IC.makeLook(id,from,r),
    height:Math.round(C.h[0]+r()*(C.h[1]-C.h[0])),reach:Math.round(C.reach[0]+r()*(C.reach[1]-C.reach[0])),age:23,rec:[3,0,0],rival:true};
  return{id,name:f.name,nick:f.nick,f,heat:15,fights:0,wins:0,losses:0,inMain:false};
}
function rivalGrow(c,amt){const R=c.rival;if(!R)return;for(const k of STATS)R.f.s[k]=Math.min(97,R.f.s[k]+amt*rnd(.6,1.4));R.f.ovr=IC.ovrOf(R.f.s,R.f.style);
  if(Math.random()<.75)R.f.rec[0]++;else R.f.rec[1]++}
function rivalToMain(c){const R=c.rival;if(!R||R.inMain||c.tier==='regional')return;R.inMain=true;R.f.cls=c.cls;
  c.fillers=c.fillers||[];if(!c.fillers.find(f=>f.id===R.id))c.fillers.push(R.f);
  const me=c.order.indexOf('me');c.order=c.order.filter(x=>x!==R.id);c.order.splice(Math.max(14,me-5),0,R.id);
  post(c,'rival',`나도 IRON CAGE 계약 완료. ${c.nick}, 이제 진짜 무대에서 보자.`);
  msg(c,'rival',[`축하는 안 할게. 너보다 먼저 랭킹에 들어갈 거니까.`],[{t:'랭킹에서 만나자.',eff:{heat:8},res:'그때 도망치지나 마.'},{t:'…(읽고 무시)',eff:{heat:3},res:''}])}
const rivalF=c=>c.rival&&(c.rival.inMain?getF(c.rival.id,c):c.rival.f);
/* ---------- SNS ---------- */
const HANDLE={coach:['코치 하워드','@coach_howard','#5fbf72'],manager:['매니저 민지','@mj_mgmt','#b98cff'],press:['MMA 인사이더','@mma_insider','#e8b33a'],press2:['케이지사이드 뉴스','@cagesidenews','#e8b33a'],rival:null,opp:null,fan:null,me:null};
const FANS=['격투기덕후92','새벽 3시 관전러','KO모음집','주짓수하는직장인','링사이드석','펀치드렁크','그래플링러버','파이트위크'];
function post(c,who,text,extra={}){
  let name,handle,col;
  if(who==='rival'){const R=c.rival;name=R.name;handle='@'+R.nick.replace(/\s/g,'').toLowerCase();col='#e04a3a'}
  else if(who==='me'){name=c.name;handle='@'+(c.nick||c.name).replace(/\s/g,'').toLowerCase();col='#3d7ff0'}
  else if(who==='opp'){const f=extra.f;name=f.name;handle='@'+f.nick.replace(/\s/g,'').toLowerCase();col='#c96b3a'}
  else if(who==='fan'){name=pick(FANS);handle='@'+Math.random().toString(36).slice(2,8);col='#6b7a90'}
  else{[name,handle,col]=HANDLE[who]}
  const base=who==='me'||who==='rival'?(c.hype+5)*40:who==='fan'?20:(c.hype+10)*15;
  c.feed.unshift({name,handle,col,text,day:c.day,likes:Math.round(base*rnd(.5,2.2)),rt:Math.round(base*rnd(.05,.4)),who});
  if(c.feed.length>60)c.feed.length=60;
}
const postHtml=p=>`<div class="twt"><div class="av" style="background:${p.col}">${esc(p.name[0])}</div><div class="tb"><div class="th"><b>${esc(p.name)}</b><span>${esc(p.handle)} · ${p.day}일차</span></div><p>${esc(p.text)}</p><div class="tf"><span>♥ ${p.likes.toLocaleString()}</span><span>⟲ ${p.rt.toLocaleString()}</span></div></div></div>`;
V.csns=()=>{const c=ensureC(DATA.career),can=!c.flags.postDay||c.day-c.flags.postDay>=7;
  return `${back('chub','← 커리어')}<div class="panel"><div class="eyebrow">SNS · 인지도 ${Math.round(c.hype)}</div>
  <div class="compose"><b>게시물 올리기</b>${can?`<div class="acts">
    <button class="act" data-act="cPost" data-v="humble"><b>각오 한마디</b><span>“매일 성장 중. 다음 경기에서 증명할게요.”</span><span>인지도 +2 · 안전</span></button>
    <button class="act" data-act="cPost" data-v="train"><b>훈련 영상</b><span>스파링 하이라이트 업로드</span><span>인지도 +4 · 상대가 영상을 볼 수도(20%)</span></button>
    <button class="act" data-act="cPost" data-v="callout"><b>${esc(c.rival.name)} 저격</b><span>“체육관에서 말만 제일 많은 사람.”</span><span>인지도 +7 · 라이벌 열기 +12 · 역풍 35%</span></button></div>`:`<p>게시물은 일주일에 한 번 올릴 수 있어요. (${7-(c.day-c.flags.postDay)}일 후)</p>`}</div>
  <div class="feed">${c.feed.map(postHtml).join('')||'<p>아직 게시물이 없습니다.</p>'}</div></div>`};
A.cPost=d=>{const c=ensureC(DATA.career);if(c.flags.postDay&&c.day-c.flags.postDay<7)return;c.flags.postDay=c.day||1;
  if(d.v==='humble'){post(c,'me','매일 조금씩 성장 중. 다음 경기에서 증명할게요. 🙏');c.hype=clamp(c.hype+2,0,100);post(c,'fan','이런 겸손함 좋다 진짜 응원함')}
  if(d.v==='train'){post(c,'me','오늘 스파링 🔥 (영상)');c.hype=clamp(c.hype+4,0,100);post(c,'fan','저 콤비네이션 미쳤다…');if(Math.random()<.2&&c.fight){c.fight.oppMul=(c.fight.oppMul||1)*1.03;post(c,'press','상대 진영, 공개된 스파링 영상 분석 중이라는 후문')}}
  if(d.v==='callout'){post(c,'me',`${c.rival.name}? 체육관에서 말만 제일 많은 사람.`);c.rival.heat=clamp(c.rival.heat+12,0,100);
    if(Math.random()<.35){c.hype=clamp(c.hype-3,0,100);post(c,'fan','이건 좀 선 넘었다… 실망');post(c,'rival','키보드로는 누구나 챔피언이지.')}else{c.hype=clamp(c.hype+7,0,100);post(c,'rival','말은 쉽지. 케이지에서 증명해.');post(c,'press2',`${c.nick} vs ${c.rival.nick}, 같은 체육관 출신 라이벌의 설전 점화`)}}
  save();render()};
/* ---------- phone ---------- */
const WHO={coach:['코치 하워드','#5fbf72'],manager:['매니저 민지','#b98cff'],mom:['엄마','#e88aa8'],sponsor:['볼타 에너지 마케팅팀','#3fc1c9'],rival:null,legend:['한도윤 (명예의 전당)','#e8b33a']};
function msg(c,from,lines,replies){c.msgs=c.msgs||[];c.msgs.unshift({id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),from,lines,replies:replies||[],day:c.day,read:false,done:!(replies&&replies.length),chosen:null});if(c.msgs.length>40)c.msgs.length=40}
const whoName=(c,f)=>f==='rival'?[c.rival.name,'#e04a3a']:WHO[f]||[f,'#888'];
const unread=c=>(c.msgs||[]).filter(m=>!m.read||!m.done).length;
V.cphone=()=>{const c=ensureC(DATA.career);
  return `${back('chub','← 커리어')}<div class="phone"><div class="pbar"><span>${c.day}일차</span><b>메시지</b><span>●●●</span></div>
  ${c.msgs.map(m=>{const [n,col]=whoName(c,m.from);return `<button class="thr${!m.read||!m.done?' new':''}" data-act="cOpen" data-id="${m.id}"><div class="av" style="background:${col}">${esc(n[0])}</div><div><b>${esc(n)}</b><span>${esc(m.lines[m.lines.length-1])}</span></div>${!m.done?'<em>답장 필요</em>':''}</button>`}).join('')||'<p style="padding:16px">메시지가 없습니다.</p>'}</div>`};
V.cthread=p=>{const c=ensureC(DATA.career),m=c.msgs.find(x=>x.id===(p.id||P.id));if(!m)return V.cphone();m.read=true;const [n,col]=whoName(c,m.from);
  return `${back('cphone','← 메시지')}<div class="phone"><div class="pbar"><span></span><b>${esc(n)}</b><span></span></div><div class="chat">
  ${m.lines.map(l=>`<div class="bub them">${esc(l)}</div>`).join('')}
  ${m.chosen!=null?`<div class="bub me">${esc(m.replies[m.chosen].t)}</div>${m.replies[m.chosen].res?`<div class="bub them">${esc(m.replies[m.chosen].res)}</div>`:''}${m.outcome?`<div class="sysm">${esc(m.outcome)}</div>`:''}`:''}
  </div>${!m.done?`<div class="reps">${m.replies.map((r,i)=>`<button class="btn" data-act="cReply" data-id="${m.id}" data-i="${i}">${esc(r.t)}</button>`).join('')}</div>`:''}</div>`};
A.cOpen=d=>go('cthread',{id:d.id});
A.cReply=d=>{const c=ensureC(DATA.career),m=c.msgs.find(x=>x.id===d.id);if(!m||m.done)return;const r=m.replies[+d.i];m.chosen=+d.i;m.done=true;m.outcome=applyEff(c,r.eff||{});
  if(r.p!=null){const ok=Math.random()<r.p;const e=ok?r.ok:r.bad;m.outcome=(e.msg||'')+' '+applyEff(c,e.eff||{});if(e.res)r.res=e.res}
  save();go('cthread',{id:m.id})};
/* ---------- effects ---------- */
function applyEff(c,e){const out=[];const add=(k,v,lab,fmt)=>{if(!v)return;out.push(`${lab} ${v>0?'+':''}${fmt?fmt(v):Math.round(v*10)/10}`)};
  if(e.hype){c.hype=clamp(c.hype+e.hype,0,100);add('hype',e.hype,'인지도')}
  
  if(e.energy){c.energy=clamp(c.energy+e.energy,0,100);add('en',e.energy,'에너지')}
  if(e.fit){c.fit=clamp(c.fit+e.fit,0,100);add('fit',e.fit,'피트니스')}
  if(e.heat&&c.rival){c.rival.heat=clamp(c.rival.heat+e.heat,0,100);add('heat',e.heat,'라이벌 열기')}
  if(e.pts){c.pts+=e.pts;add('pts',e.pts,'능력치 포인트')}
  if(e.cut){c.cutRisk=clamp((c.cutRisk||0)+e.cut,0,.5);out.push(e.cut>0?'감량 위험 증가':'감량 위험 감소')}
  if(e.stat){for(const [k,v] of Object.entries(e.stat)){const kk=k==='rand'?pick(STATS):k;c.s[kk]=clamp(c.s[kk]+v,20,99);out.push(`${STATN[kk]} +${v}`)}}
  if(e.scout&&c.camp){c.camp.scout=true;out.push('상대 분석 완료')}
  if(e.injury&&c.camp){c.camp.injured=true;out.push('부상! 경기 취소')}
  
  if(e.buff&&c.camp){c.camp.buff=(c.camp.buff||1)*e.buff;out.push(e.buff>1?'경기력 상승 효과':'경기력 하락 효과')}
  if(e.spec){const not=Object.keys(SPM).filter(k=>!c.unlocked.includes(k));if(not.length){const k=pick(not);c.unlocked.push(k);out.push(`필살기 습득: ${SPM[k].name}`)}}
  if(e.gym){c.camp&&(c.camp.gymBoost=e.gym);out.push('이번 캠프 훈련 효율 상승')}
  if(e.post)post(c,e.post[0],e.post[1].replace('{me}',c.nick).replace('{rival}',c.rival.name));
  return out.join(' · ');
}
/* ---------- narrative events (risk vs reward) ---------- */
const EVS=[
 {id:'fanmeet',t:'팬 미팅 요청',x:'지역 팬클럽이 주말 팬 미팅을 열어 달라고 합니다.',ch:[{t:'참석한다',h:'인지도↑ 에너지↓',eff:{hype:4,energy:-8,post:['fan','{me} 팬미팅 다녀옴! 사인 받았다 ㅠㅠ']}},{t:'훈련에 집중',h:'에너지 회복',eff:{energy:5,hype:-1}}]},
 {id:'sponsor',t:'에너지 드링크 스폰서',x:'볼타 에너지가 SNS 홍보 계약을 제안했습니다.',ch:[{t:'계약한다',h:'성공 70% · 논란 위험',p:.7,ok:{msg:'계약 성사!',eff:{hype:2}},bad:{msg:'광고 문구가 조롱거리가 됐습니다.',eff:{hype:-5,post:['fan','{me} 광고 보고 웃참 실패함 ㅋㅋ']}}},{t:'거절한다',h:'변화 없음',eff:{}}]},
 {id:'hardspar',t:'불붙은 스파링',x:'스파링 파트너가 작정하고 들어옵니다. 오늘은 거의 실전입니다.',ch:[{t:'정면으로 맞붙는다',h:'타격↑ · 부상 20%',p:.8,ok:{msg:'한 단계 성장한 느낌!',eff:{stat:{pow:1.5,sdef:1.5},energy:-12}},bad:{msg:'갈비뼈를 다쳤습니다.',eff:{injury:true}}},{t:'템포를 낮춘다',h:'안전',eff:{energy:-4,stat:{sdef:.5}}}]},
 {id:'cut',t:'감량이 힘들다',x:'경기 체중까지 아직 몇 파운드가 남았습니다.',ch:[{t:'사우나로 급하게',h:'계체 위험↑',eff:{cut:.08,energy:-6}},{t:'영양사 고용',h:'계체 위험↓',eff:{cut:-.06,fit:2}}]},
 {id:'docu',t:'다큐멘터리 촬영',x:'스트리밍 채널이 캠프를 밀착 취재하고 싶어 합니다.',ch:[{t:'허락한다',h:'인지도↑↑ 에너지↓',eff:{hype:6,energy:-10,post:['press','{me}의 파이트 캠프 다큐, 다음 주 공개']}},{t:'거절한다',h:'',eff:{energy:3}}]},
 {id:'lesson',t:'원포인트 레슨',x:'은퇴한 명코치가 하루 개인 레슨을 해 주겠다고 합니다.',ch:[{t:'받는다',h:'능력치 상승',eff:{stat:{rand:2.5}}},{t:'괜찮다',h:'',eff:{}}]},
 {id:'rivaltaunt',t:'라이벌의 도발',x:'{rival}이 인터뷰에서 당신을 "체육관 들러리"라고 불렀습니다.',ch:[{t:'맞도발',h:'인지도↑ 라이벌 열기↑↑',eff:{hype:5,heat:15,post:['me','{rival}, 들러리가 누군지 케이지에서 알려줄게.']}},{t:'무시한다',h:'라이벌 열기 소폭↑',eff:{heat:3}},{t:'존중으로 답한다',h:'라이벌 열기↓',eff:{heat:-10,hype:1}}]},
 {id:'hometown',t:'고향 행사 초대',x:'고향 시청에서 자랑스러운 시민 행사에 초대했습니다.',ch:[{t:'참석',h:'인지도↑ 피트니스↓',eff:{hype:3,fit:-2}},{t:'캠프 집중',h:'피트니스↑',eff:{fit:2}}]},
 {id:'party',t:'파티 초대',x:'동료가 밤새 놀자고 합니다. 경기까지는 아직 시간이 있긴 한데…',ch:[{t:'간다',h:'위험 60%',p:.4,ok:{msg:'기분 전환 완료!',eff:{hype:2,energy:5}},bad:{msg:'다음 날 완전히 뻗었습니다.',eff:{energy:-30,fit:-4}}},{t:'일찍 잔다',h:'에너지↑',eff:{energy:8}}]},
 {id:'knee',t:'무릎이 시큰거린다',x:'훈련 후 무릎에서 이상한 소리가 났습니다.',ch:[{t:'병원에 간다',h:'안전',eff:{energy:6}},{t:'참고 훈련한다',h:'부상 45%',p:.55,ok:{msg:'다행히 별일 없었습니다.',eff:{fit:2}},bad:{msg:'인대가 늘어났습니다.',eff:{injury:true}}}]},
 {id:'gameplan',t:'코치와 전술 회의',x:'코치가 이번 상대를 어떻게 공략할지 묻습니다.',ch:[{t:'타격으로 압박',h:'경기력 +3%',eff:{buff:1.03,stat:{pow:.5}}},{t:'레슬링으로 지치게',h:'경기력 +3%',eff:{buff:1.03,stat:{td:.5}}},{t:'카운터로 기다린다',h:'받는 데미지↓',eff:{buff:1.02,scout:true}}]},
 {id:'leak',t:'상대 훈련 영상 유출',x:'상대 진영의 비공개 훈련 영상이 커뮤니티에 돌고 있습니다.',ch:[{t:'본다',h:'상대 분석 · 논란 20%',p:.8,ok:{msg:'상대 습관을 파악했습니다.',eff:{scout:true}},bad:{msg:'"유출 영상 본 선수" 논란',eff:{scout:true,hype:-4}}},{t:'정정당당하게',h:'인지도↑',eff:{hype:2,post:['fan','{me} 유출 영상 안 본다고 함. 멋있다']}}]},
 {id:'trapq',t:'인터뷰 함정 질문',x:'기자가 "지난 경기 판정 운이 좋았던 것 아니냐"고 묻습니다.',ch:[{t:'정면 반박',h:'인지도↑ · 역풍 30%',p:.7,ok:{msg:'카리스마 있는 답변이 화제가 됐습니다.',eff:{hype:4}},bad:{msg:'발끈한 장면만 편집돼 퍼졌습니다.',eff:{hype:-4}}},{t:'웃어넘긴다',h:'안전',eff:{hype:1}}]},
 {id:'mentor',t:'후배 지도',x:'체육관 막내가 기술을 봐 달라고 합니다.',ch:[{t:'가르쳐 준다',h:'능력치 포인트 +1 · 에너지↓',eff:{pts:1,energy:-6}},{t:'다음에',h:'',eff:{}}]},
 {id:'altitude',t:'고지대 훈련 캠프',x:'산악 지대 고지대 훈련에 합류할 수 있습니다.',ch:[{t:'합류',h:'피트니스↑↑ 에너지↓',eff:{fit:10,energy:-14}},{t:'패스',h:'',eff:{}}]},
 {id:'cold',t:'감기 기운',x:'목이 칼칼하고 몸이 무겁습니다.',ch:[{t:'하루 푹 쉰다',h:'에너지↑ 피트니스↓',eff:{energy:12,fit:-3}},{t:'강행한다',h:'위험 50%',p:.5,ok:{msg:'땀 빼고 나니 개운합니다.',eff:{fit:2}},bad:{msg:'몸살이 났습니다.',eff:{energy:-22,fit:-3}}}]},
 {id:'legend',t:'레전드의 연락',x:'명예의 전당 레전드 한도윤이 조언을 해 주겠다며 연락해 왔습니다.',ch:[{t:'조언을 듣는다',h:'맷집·체력 상승',eff:{stat:{chin:1.5,car:1.5},hype:2}},{t:'정중히 사양',h:'',eff:{}}]},
 {id:'ad',t:'게임 광고 출연',x:'격투 게임 광고 모델 제안이 왔습니다.',ch:[{t:'출연한다',h:'인지도↑ 에너지↓',eff:{hype:3,energy:-8}},{t:'거절',h:'',eff:{}}]},
 {id:'rumor',t:'상대 부상 루머',x:'상대가 발목을 다쳤다는 소문이 돌고 있습니다.',ch:[{t:'로킥 집중 연습',h:'소문이 사실이면 효과 큼(50%)',p:.5,ok:{msg:'소문은 사실이었습니다!',eff:{buff:1.05,stat:{kick:.5}}},bad:{msg:'가짜 뉴스였습니다. 시간만 날렸네요.',eff:{energy:-6}}},{t:'신경 쓰지 않는다',h:'',eff:{fit:1}}]},
  {id:'newmove',t:'코치의 새 기술 제안',x:'코치가 비장의 기술을 가르쳐 주겠다고 합니다.',ch:[{t:'집중 연습',h:'습득 45% · 에너지↓↓',p:.45,ok:{msg:'완벽하게 익혔습니다!',eff:{spec:true,energy:-15}},bad:{msg:'아직 몸에 익지 않았습니다.',eff:{energy:-15,pts:1}}},{t:'기본기에 집중',h:'',eff:{stat:{rand:1}}}]},
 {id:'signing',t:'팬 사인회',x:'대형 스포츠용품점에서 사인회를 열자고 합니다.',ch:[{t:'연다',h:'인지도↑',eff:{hype:3,energy:-5}},{t:'거절',h:'',eff:{}}]},
 {id:'insomnia',t:'잠 못 드는 밤',x:'경기 생각에 며칠째 잠을 설치고 있습니다.',ch:[{t:'명상과 루틴 정비',h:'에너지↑',eff:{energy:10}},{t:'야간 러닝',h:'피트니스↑ 에너지↓',eff:{fit:3,energy:-8}}]},
 {id:'elite',t:'엘리트 팀 초청',x:'엘리트 MMA 팀이 이번 캠프에 게스트로 합류하라고 합니다.',cond:c=>c.hype>=20,ch:[{t:'합류한다',h:'이번 캠프 훈련 효율 ×1.3',eff:{gym:1.3,hype:2}},{t:'우리 체육관이 최고',h:'코치 신뢰',eff:{stat:{rand:1}}}]},
 {id:'meetrival',t:'라이벌과 마주침',x:'체육관 복도에서 {rival}과 정면으로 마주쳤습니다.',ch:[{t:'악수를 청한다',h:'라이벌 열기↓',eff:{heat:-8}},{t:'눈싸움',h:'라이벌 열기↑ 인지도↑',eff:{heat:10,hype:3,post:['fan','체육관 앞에서 {me}랑 {rival} 눈싸움하는 거 목격함 ㄷㄷ']}}]},
 {id:'charity',t:'자선 이벤트',x:'소아병동 자선 행사에 초청받았습니다.',ch:[{t:'참여 ',h:'인지도↑',eff:{hype:5,post:['press','{me}, 소아병동 자선 행사에서 아이들과 시간 보내']}},{t:'일정상 불참',h:'',eff:{}}]},
 {id:'film',t:'분석 전문가 섭외',x:'경기 분석 전문가가 상대 분석 리포트를 팔겠다고 합니다.',ch:[{t:'구매',h:'상대 분석',eff:{scout:true}},{t:'직접 본다',h:'',eff:{energy:-3}}]},
 {id:'mom',t:'엄마의 전화',x:'엄마가 걱정된다며 전화를 했습니다.',ch:[{t:'안심시켜 드린다',h:'에너지↑',eff:{energy:6}},{t:'훈련 중이라 짧게',h:'',eff:{fit:1}}]},
 {id:'overtrain',t:'몸이 무겁다',x:'코치가 오버트레이닝 같다며 걱정합니다.',cond:c=>c.energy<45,ch:[{t:'이틀 쉰다',h:'에너지↑↑',eff:{energy:25,fit:-2}},{t:'밀어붙인다',h:'부상 35%',p:.65,ok:{msg:'고비를 넘겼습니다.',eff:{fit:4,stat:{car:1}}},bad:{msg:'햄스트링이 올라왔습니다.',eff:{injury:true}}}]},
 {id:'viral',t:'훈련 영상 대박',x:'훈련 영상 하나가 갑자기 조회수 수백만을 찍었습니다.',ch:[{t:'라이브 방송으로 이어간다',h:'인지도↑↑ 에너지↓',eff:{hype:7,energy:-8}},{t:'조용히 훈련',h:'',eff:{hype:2}}]}
];
function rollEvent(c){
  const pool=EVS.filter(e=>(!e.cond||e.cond(c))&&!(c.camp.seen||[]).includes(e.id));if(!pool.length)return;
  const e=pick(pool);c.camp.seen=(c.camp.seen||[]).concat(e.id);c.camp.pend=e.id;
}
const evText=(c,s)=>s.replace(/\{rival\}/g,c.rival?c.rival.name:'라이벌').replace(/\{me\}/g,c.nick).replace(/\{op\}/g,c.fight?getF(c.fight.opp,c).name:'상대');
A.cEv=d=>{const c=ensureC(DATA.career),e=EVS.find(x=>x.id===c.camp.pend);if(!e)return;const ch=e.ch[+d.i];let txt='';
  if(ch.p!=null){const ok=Math.random()<ch.p,r=ok?ch.ok:ch.bad;txt=(ok?'✓ ':'✗ ')+r.msg+' '+applyEff(c,r.eff||{})}else txt=applyEff(c,ch.eff||{})||'변화 없음';
  c.camp.log.unshift(`<b>${c.camp.day}일차 · ${e.t}</b> — ${esc(ch.t)} → ${txt}`);c.camp.pend=null;save();render()};
/* ---------- calendar camp ---------- */
const CACTS={
  spar:{name:'타격',grp:'strike',stats:['pow','spd','kick','sdef'],en:-10,fit:1.8,inj:.02,col:'#e04a3a'},
  wrestle:{name:'레슬링',grp:'wrestle',stats:['td','tdd','clinch','gnp'],en:-11,fit:2.2,inj:.02,col:'#3d7ff0'},
  bjj:{name:'주짓수',grp:'bjj',stats:['subO','subD','gnp'],en:-9,fit:1.6,inj:.015,col:'#b98cff'},
  cond:{name:'컨디셔닝',grp:'cond',stats:['car','chin'],en:-7,fit:3,inj:.01,col:'#5fbf72'},
  tape:{name:'영상 분석',grp:null,stats:[],en:-2,fit:0,inj:0,col:'#3fc1c9'},
  media:{name:'미디어',grp:null,stats:[],en:-4,fit:-.4,inj:0,col:'#e88aa8'},
  rest:{name:'휴식',grp:null,stats:[],en:16,fit:-.6,inj:0,col:'#6b7a90'}
};
const fitLab=f=>f>=85?['최상','#7dff9a']:f>=65?['좋음','#b7e07a']:f>=45?['보통','#e8b33a']:['부족','#ff8b7f'];
function tapeReport(f){const t=STYLES[f.style].ai,top=Object.entries(f.s).sort((a,b)=>b[1]-a[1]).slice(0,3),low=Object.entries(f.s).sort((a,b)=>a[1]-b[1]).slice(0,2),n=[];
  if(t.td>.25)n.push('초반부터 테이크다운을 노린다');if(t.kick>.4)n.push('킥 비중이 높다 — 킥 캐치 후 테이크다운');if(t.sub>.5)n.push('하위 포지션에서도 서브미션이 위험');if(t.counter>.4)n.push('카운터 성향 — 무리한 큰 공격 금지');if(t.agg>.6)n.push('전진 압박형 — 체력 소모를 유도');if(!n.length)n.push('뚜렷한 패턴이 없는 올라운더');
  return{top,low,n}}
V.camp=()=>{const c=ensureC(DATA.career),f=getF(c.fight.opp,c),gym=GYMS.find(g=>g.id===c.gym),cp=c.camp,len=cp.len||CAMP_LEN,left=len-cp.day,done=left<=0||cp.injured,[fl,fc]=fitLab(c.fit);
  const ev=cp.pend&&EVS.find(x=>x.id===cp.pend);
  const weeks=[];for(let i=0;i<len;i++){const a=(cp.cal||[])[i],A0=a&&CACTS[a];weeks.push(`<div class="wk${i===cp.day&&!done?' now':''}" style="${A0?`--ac:${A0.col}`:''}"><span>${i+1}일차</span><b>${A0?A0.name:i===cp.day?'오늘':'—'}</b></div>`)}
  weeks.push(`<div class="wk fight"><span>경기</span><b>⚖ · 🥊</b></div>`);
  return `${back('chub','← 커리어')}<div class="panel"><div class="eyebrow">파이트 캠프 · ${gym.name}${cp.gymBoost?' · 엘리트 게스트':''}</div>
  <h2 class="big">${done?(cp.injured?'<span class="r">부상</span>':'파이트 위크'):`D-${len-cp.day} <small style="font-size:.45em;color:var(--muted)">${cp.day+1}일차 / ${len}일</small>`}</h2>
  <p>vs ${esc(f.name)} "${esc(f.nick)}" · ${STYLES[f.style].name} · 종합 ${f.ovr}${c.fight.card?` · ${esc(c.fight.card.name)}`:''}</p>
  <div class="weeks">${weeks.join('')}</div>
  <div class="kv"><div><span>피트니스</span><b style="color:${fc}">${Math.round(c.fit)} · ${fl}</b></div><div><span>에너지</span><b style="color:${c.energy<35?'var(--red-t)':'inherit'}">${Math.round(c.energy)}%</b></div></div>
  ${ev?`<div class="evcard"><span>이벤트</span><h3>${esc(ev.t)}</h3><p>${esc(evText(c,ev.x))}</p><div class="acts">${ev.ch.map((ch,i)=>`<button class="act" data-act="cEv" data-i="${i}"><b>${esc(ch.t)}</b><span>${esc(ch.h||'')}</span></button>`).join('')}</div></div>`:
  done?(cp.injured?`<p>부상으로 이번 경기는 취소됐습니다.</p><button class="btn-go" data-act="cInjury">다시 제안 받기</button>`:`<button class="btn-go" data-act="cToFight">파이트 위크 시작</button>`):
  `<h3>오늘 할 일</h3><div class="acts">${Object.entries(CACTS).map(([k,a])=>{const m=a.grp?gym.mul[a.grp]*(cp.gymBoost||1):1;const dis=k==='tape'&&cp.scout;
    return `<button class="act" data-act="cDo" data-k="${k}" ${dis?'disabled':''}><b>${a.name}</b><span>${k==='tape'?'상대 약점 파악 · 받는 데미지 −7%':k==='media'?'인지도↑':k==='rest'?'에너지 회복':a.stats.map(s=>STATN[s]).join('·')}</span><span>에너지 ${a.en>0?'+':''}${a.en}${a.fit?` · 피트니스 ${a.fit>0?'+':''}${a.fit}`:''}</span></button>`}).join('')}</div>
  <div class="row"><button class="btn" data-act="cSkip">남은 날 자동 진행</button></div>`}
  ${cp.tape?`<div class="tapebox"><b>📼 영상 분석 · ${esc(f.nick)}</b><div>강점: ${cp.tape.top.map(([k,v])=>`${STATN[k]} ${Math.round(v)}`).join(', ')}</div><div>약점: ${cp.tape.low.map(([k,v])=>`${STATN[k]} ${Math.round(v)}`).join(', ')}</div><ul>${cp.tape.n.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
  ${cp.log.length?`<div class="log">${cp.log.map(l=>`<div>${l}</div>`).join('')}</div>`:''}</div>`};
A.cDo=d=>{const c=ensureC(DATA.career),cp=c.camp,a=CACTS[d.k],gym=GYMS.find(g=>g.id===c.gym),len=cp.len||CAMP_LEN;if(cp.pend||cp.day>=len||!a)return;
  const en=c.energy;let m=`<b>${cp.day+1}일차 · ${a.name}</b> — `;
  if(d.k==='rest'){m+='푹 쉬었습니다.'}
  else if(d.k==='tape'){cp.scout=true;cp.tape=tapeReport(getF(c.fight.opp,c));m+='상대 영상을 분석했습니다.'}
  else if(d.k==='media'){const r=pick([['팟캐스트 출연',2,1500],['방송 인터뷰',1,2000],['유튜브 콜라보',2,1200]]);c.hype=clamp(c.hype+r[1],0,100);m+=`${r[0]} — 인지도 +${r[1]}`;if(Math.random()<.5)post(c,'press',`${c.nick}: "이번 경기, 확실한 결과로 보여드리겠다" (${r[0]})`)}
  else{const mul=gym.mul[a.grp]*(cp.gymBoost||1)*(.45+.55*en/100),gains=[];
    for(const k of a.stats){const cur=c.s[k];let g=.75*mul*Math.max(.15,1-(cur-55)/50)*rnd(.7,1.3);if(k==='chin')g*=.4;c.s[k]=Math.min(99,cur+g);gains.push(`${STATN[k]} +${g.toFixed(1)}`)}
    m+=gains.join(', ');
    if(Math.random()<a.inj+(en<30?.12:0)){cp.injured=true;m+=' · <b style="color:var(--red-t)">부상!</b>'}}
  c.energy=clamp(c.energy+a.en,0,100);c.fit=clamp(c.fit+a.fit*(en<30?.5:1),0,100);
  cp.cal=cp.cal||[];cp.cal[cp.day]=d.k;cp.day++;c.day++;
  if(!cp.injured&&cp.day<len&&Math.random()<.2)rollEvent(c);
  cp.log.unshift(m);campHooks(c);save();render()};
function campHooks(c){const cp=c.camp,len=cp.len||CAMP_LEN,f=getF(c.fight.opp,c);
  if(cp.day>=3&&!cp.h1){cp.h1=1;msg(c,'coach',[`사흘 지났다. 지금 피트니스 ${Math.round(c.fit)}. ${c.fit<55?'솔직히 부족해. 컨디셔닝 더 넣자.':'좋은 흐름이야.'}`,'남은 기간 어디에 집중할래?'],
    [{t:'타격 마무리',eff:{stat:{spd:1}},res:'좋아. 패드 미트 시간 늘린다.'},{t:'그래플링 보강',eff:{stat:{tdd:1}},res:'레슬링 코치 불러 놓을게.'},{t:'체력부터',eff:{fit:4},res:'산 타러 가자. 내일 새벽 5시.'}])}
  if(cp.day>=6&&!cp.h2){cp.h2=1;post(c,'opp',pick([`${c.nick}? 영상 봤는데 별거 없더라.`,`이번 캠프 최고 컨디션. ${c.nick}에게는 미안하게 됐네.`,`존중은 한다. 하지만 이긴다.`]),{f});post(c,'fan',pick([`${c.nick} vs ${f.nick} 예상: ${c.nick} 2R TKO`,`솔직히 ${f.nick}가 이길 듯`,`이번 카드 꿀잼 예약`]))}
  if(cp.day>=8&&!cp.h3){cp.h3=1;msg(c,'manager',[`파이트 위크 일정 나왔어요. 미디어 데이, 계체, 경기 순서예요.`,`${c.fight.card?c.fight.card.name+' 티켓 매진됐대요!':'티켓 반응 좋아요!'}`],[{t:'좋아요, 준비 끝',eff:{hype:1},res:'파이팅! 🙌'},{t:'인터뷰 줄여 주세요',eff:{energy:6},res:'알겠어요, 최소한으로 잡을게요.'}])}
}
A.cSkip=()=>{const c=ensureC(DATA.career),cp=c.camp,len=cp.len||CAMP_LEN;if(cp.pend)return;
  while(cp.day<len){const k=c.energy<45?'rest':'cond',a=CACTS[k];c.energy=clamp(c.energy+(k==='rest'?a.en:a.en*.5),0,100);c.fit=clamp(c.fit+a.fit*.6,0,100);cp.cal=cp.cal||[];cp.cal[cp.day]=k;cp.day++;c.day++}
  cp.log.unshift('<b>자동 진행</b> — 남은 기간을 가볍게 소화했습니다. (능력치 성장 없음)');campHooks(c);save();render()};
/* fight-night multiplier from fitness and camp choices */
function campMul(c){let m=c.camp&&c.camp.buff||1;if(c.fit>=85)m*=1.05;else if(c.fit<45)m*=.93;return m}
/* ---------- after each fight: the world reacts ---------- */
function afterFight(c,res,o,won,opp){
  ensureC(c);const R=c.rival,isRival=o.opp===(R&&R.id),fin=res.method!=='판정';
  c.day+=7;c.fit=clamp(c.fit-12,20,100);
  post(c,'press',`${c.fight&&o.card?o.card.name+' | ':''}${won?c.name:opp.name}, ${won?opp.name:c.name}에게 ${res.method}${res.method==='판정'?'':' '+res.round+'R'} 승리`);
  if(won){post(c,'fan',pick([fin?`${c.nick} 피니시 미쳤다 다시 봐도 소름`:`${c.nick} 판정이지만 완벽한 경기 운영`,`${c.nick} 다음 경기 언제냐`,`이제 ${c.nick} 랭킹 올라가야지`]));post(c,'opp',pick(['오늘은 졌다. 더 강해져서 돌아온다.','축하한다. 다음엔 다를 거다.','변명은 없다.']),{f:opp})}
  else{post(c,'fan',pick([`${c.nick} 오늘은 아니었다… 그래도 응원함`,`${c.nick} 거품이었네`,`${c.nick} 다시 일어설 거라 믿는다`]));post(c,'opp',pick([`${c.nick}, 좋은 경기였다.`,'말했지? 내 무대라고.','다음 상대 누구냐.']),{f:opp})}
  if(R){
    if(isRival){R.fights++;R.lastAt=c.history.length;if(won){R.losses++;c.hype=clamp(c.hype+12,0,100);R.heat=clamp(R.heat-25,0,100);post(c,'rival',pick(['인정한다. 오늘은 네가 더 강했다.','이걸로 끝난 거 아니다. 리매치다.']));post(c,'press2',`라이벌전 결착! ${c.nick}, ${R.nick}를 꺾다`)}
      else{R.wins++;R.heat=clamp(R.heat+15,0,100);post(c,'rival','체육관 서열 정리 끝.')}}
    else{rivalGrow(c,.5);if(Math.random()<.5)post(c,'rival',won?pick([`${c.nick} 이겼네. 운 좋았지.`,'다음 상대가 약했을 뿐.']):pick([`${c.nick} 졌다며? 역시.`,'그러니까 내가 먼저 올라간다고 했잖아.']))}
    rivalToMain(c);
  }
  // phone reactions
  if(won)msg(c,'coach',[pick(['오늘 정말 잘했다.','계획대로 됐어. 자랑스럽다.']),`이틀 쉬고 다시 시작하자.`],[{t:'감사합니다, 코치님',eff:{energy:5},res:'푹 쉬어라.'},{t:'바로 다음 캠프 가죠',eff:{fit:4,energy:-5},res:'그 열정 좋다. 대신 무리는 하지 마.'}]);
  else msg(c,'coach',['오늘 결과는 잊어. 테이프 다시 보고 뭐가 문제였는지 같이 보자.'],[{t:'제가 부족했어요',eff:{pts:1},res:'인정하는 게 시작이다. 다시 올라가자.'},{t:'판정이 이상했어요',eff:{hype:1,heat:2},res:'…그 마음 알지만, 판정에 맡기지 않는 경기를 하자.'}]);
  if(won&&c.hype>=25&&Math.random()<.45)msg(c,'sponsor',[`${c.name} 선수님, 볼타 에너지입니다. 다음 경기 트렁크 스폰서 제안드립니다.`],[{t:'수락',eff:{hype:2},res:'감사합니다! 계약서 보내드릴게요.'},{t:'고민해 볼게요',eff:{},res:'언제든 연락 주세요.'}]);
  if(!won&&Math.random()<.5)msg(c,'mom',['밥은 먹었니? 다친 데는 없고?'],[{t:'괜찮아요 엄마',eff:{energy:4},res:'다음엔 꼭 이길 거야. 엄마가 응원해.'}]);
  if(R&&R.inMain&&R.heat>=45&&!isRival&&Math.random()<.6)msg(c,'manager',[`${R.name} 측에서 라이벌전 얘기가 나오고 있어요. 팬들 반응이 뜨거워요.`],[{t:'붙여 주세요',eff:{heat:8,hype:3},res:'오케이! 다음 제안에 넣어 볼게요.'},{t:'아직은 때가 아니에요',eff:{heat:-3},res:'알겠어요.'}]);
}
/* rival grudge match joins the offers when the heat is high */
function rivalOffer(c){const R=c.rival;if(!R||!R.inMain||R.heat<45||c.tier==='regional')return null;if(c.history.length-(R.lastAt??-9)<3)return null;const idx=c.order.indexOf(R.id);if(idx<0)return null;
  return{opp:R.id,title:false,rounds:3,purse:Math.round((15000+c.hype*500)*1.6),rival:true}}

const TRASH=['{me}? 들어본 적도 없는 이름이네. 1라운드면 충분해.','{me}는 아직 이 무대에 올 준비가 안 됐어.','내가 {me}를 은퇴시켜 주지.','{me}, 케이지 문 닫히는 순간 후회할 거다.','솔직히 {me} 경기 영상 보다가 졸았어.','{me}는 좋은 선수야. 그래도 이번엔 내가 이긴다.','이번 경기는 {op} 시대의 시작이다.','{me} 턱이 얼마나 단단한지 확인해 보겠어.'];
A.cPress=d=>{const c=DATA.career,o=c.fight;if(!o||o.press)return;o.press=d.v;
  if(d.v==='respect')c.hype=clamp(c.hype+2,0,100);
  if(d.v==='taunt'){c.hype=clamp(c.hype+8,0,100);o.purse=Math.round(o.purse*1.15);o.oppMul=1.05}
  if(d.v==='callout')c.hype=clamp(c.hype+12,0,100);
  save();render()};
A.cToFight=()=>{DATA.career.phase='fight';save();go('chub')};
A.cFight=()=>{const c=DATA.career,o=c.fight,a=meData(c),b=getF(o.opp,c),oi=c.order.indexOf(o.opp);
  const mb=o.card&&o.card.bouts.find(x=>x.me);if(mb)o.rounds=mb.rounds;
  const label=`${o.card?o.card.name+' · '+(mb?mb.slot+' · ':''):''}${o.local?'지역 단체':o.contender?'IRON CAGE 입성 테스트':(o.kc?'킹 오브 케이지 슈퍼파이트':clsName(c.cls)+' '+(o.title?'타이틀전':rankLabel(oi)+' 상대'))} · ${o.rounds}라운드`;
  const risk=(c.energy<35?.35:c.energy<55?.12:.02)+(c.cutRisk||0);
  /* rival: always the same fighter for this save, and he fights you with what he has learned about your habits */
  const isRival=!!(c.rival&&b.id===c.rival.id),pat=isRival&&c.pat?Object.fromEntries(Object.entries(c.pat).map(([k,v])=>[k,Math.min(6,v*1.4)])):null;
  const diff=c.league==='super'?(hofScore(c).total>=HOF_NEED?'hof':'legend'):undefined;
  const lab2=(c.league==='super'?'슈퍼리그 · ':'')+label+(diff==='hof'?' · 명예의 전당 난이도':'');
  go('tale',{a,b,rounds:o.rounds,label:lab2,rivalRead:isRival?patNote(c.pat):null,title:o.title,mustWeigh:true,risk,scout:c.camp&&c.camp.scout,backTo:'chub',run:(w={})=>{if(w.weigh&&!w.weigh.a.ok){o.penalty=.2;save()}startFight({arena:o.title||o.kc?3:(c.tier==='regional'||o.local||o.contender)?1:(c.order.indexOf('me')>15&&(oi<0||oi>15))?4:2,weigh:w.weigh,oppMul:(o.oppMul||1)*(c.league==='super'?1.1:1),diff,pat,a,b,rounds:o.rounds,title:o.title,label:lab2,condition:.8+.2*c.energy/100,myMul:campMul(c),scoutMul:c.camp&&c.camp.scout?.93:1,onResult:res=>careerResult(res)})}})};
function patNote(p){if(!p)return '아직 분석된 패턴이 없습니다.';const L={kick:'킥',shoot:'태클',head:'안면 펀치'},top=Object.entries(p).filter(([k])=>L[k]).sort((a,b)=>b[1]-a[1])[0];
  return top&&top[1]>1.5?`라이벌이 당신의 ${L[top[0]]} 습관을 분석했습니다. 그 공격엔 대비가 되어 있어요.`:'라이벌이 당신을 연구했지만 뚜렷한 습관은 못 찾았습니다.'}
/* ---------- fight night: numbered events with a full card ---------- */
const CITIES=['서울 · 고척 아레나','라스베이거스 · 아이언 돔','도쿄 · 사이타마 홀','리우 · 마라카낭 아레나','런던 · O 아레나','시드니 · 하버 돔','뉴욕 · 가든 아레나','두바이 · 에티하드 아레나','파리 · 아코르 홀','멕시코시티 · 아레나 CDMX'];
const REG_PROMO='블레이드 FC';
const lite=(f,rank)=>({id:f.id,name:f.name,nick:f.nick,ovr:f.ovr,style:f.style,from:f.from,rank});
function classRanking(c,cls){if(cls===c.cls)return c.order.slice();return IC.byClass(cls).slice().sort((a,b)=>b.ovr-a.ovr).map(f=>f.id)}
function buildCard(c,o){
  const reg=c.tier==='regional'||o.contender||o.local,me=meData(c),opp=getF(o.opp,c);
  if(!c.evFix){const E=c.events||[];c.eventNo=E.filter(e=>!e.reg).length;c.regNo=E.filter(e=>e.reg).length;c.evFix=1}
  const no=reg?(c.regNo=(c.regNo||0)+1):(c.eventNo=(c.eventNo||0)+1);
  const ev={no,name:reg?`${REG_PROMO} ${no}`:`IRON CAGE ${no}`,city:reg?pick(['서울 · 장충 체육관','부산 · 사직 체육관','대구 · 엑스코','인천 · 송도 컨벤시아']):pick(CITIES),reg,bouts:[],done:false};
  const used=new Set(['me',o.opp]);
  const myBout={me:true,cls:c.cls,rounds:o.rounds,title:!!o.title,a:lite(me,cRank(c)),b:lite(opp,reg?'지역':o.kc?clsName(opp.cls)+' 챔피언':o.superfight?'체급 데뷔':rankLabel(c.order.indexOf(o.opp)))};
  const others=[];
  if(reg){for(let i=0;i<7;i++){const f1=genLocal(c),f2=genLocal(c);f1.cls=f2.cls=pick(CLASSES).id;others.push({cls:f1.cls,rounds:3,a:lite(f1,'지역'),b:lite(f2,'지역')})}}
  else{
    const pickBout=(lo,hi,title)=>{for(let tries=0;tries<30;tries++){const C=pick(CLASSES),ord=classRanking(c,C.id);const i=title?0:lo+Math.floor(Math.random()*(hi-lo)),j=title?1:i+1+Math.floor(Math.random()*3);
        if(j>=ord.length||used.has(ord[i])||used.has(ord[j]))continue;const fa=getF(ord[i],c),fb=getF(ord[j],c);if(!fa||!fb)continue;used.add(ord[i]);used.add(ord[j]);
        return{cls:C.id,rounds:title?5:3,title:!!title,a:lite(fa,rankLabel(i)),b:lite(fb,rankLabel(j))}}return null};
    const wantTitle=!o.title&&Math.random()<.6;
    if(wantTitle)others.push(pickBout(0,1,true));
    for(let k=0;k<3;k++)others.push(pickBout(1,10));
    for(let k=0;k<4;k++)others.push(pickBout(6,20));
    for(let k=0;k<3;k++)others.push(pickBout(14,31));
  }
  const list=others.filter(Boolean);
  // place my bout by its stakes
  const myIdx=o.title?0:reg?Math.min(list.length,o.contender?0:2+Math.floor(Math.random()*3)):(c.order.indexOf('me')<=5?1:c.order.indexOf('me')<=15?2+Math.floor(Math.random()*2):5+Math.floor(Math.random()*4));
  list.splice(Math.min(myIdx,list.length),0,myBout);
  list.forEach((b,i)=>{b.slot=i===0?'메인 이벤트':i===1?'코메인 이벤트':i<5?'메인 카드':i<9?'프렐림':'얼리 프렐림';if(i===0&&!b.title)b.rounds=5});
  myBout.rounds=Math.max(myBout.rounds,myBout.slot==='메인 이벤트'?5:3);
  ev.bouts=list;return ev;
}
function runCard(c,ev,res){
  const bon=[];
  for(const b of ev.bouts){
    if(b.me){b.res={winner:res.winner,method:res.method,detail:res.detail,round:res.round,time:res.time};continue}
    const r=IC.Fight.sim(b.a,b.b,b.rounds);
    if(r.method==='판정'){r.round=b.rounds;r.time='5:00'}else r.time=`${Math.floor(Math.random()*4)}:${String(Math.floor(Math.random()*60)).padStart(2,'0')}`;
    b.res=r;
    // rankings move inside the player's division
    if(!ev.reg&&b.cls===c.cls&&r.winner==='b'){const o=c.order,i=o.indexOf(b.a.id),j=o.indexOf(b.b.id);if(i>=0&&j>=0&&j>i){o[i]=b.b.id;o[j]=b.a.id}}
  }
  // bonuses: best finishes get performance bonuses, the closest war gets fight of the night
  const fin=ev.bouts.filter(b=>b.res&&b.res.method!=='판정'&&!(b.me&&res.winner!=='a')).sort((x,y)=>(x.res.round-y.res.round)||(x.res.time>y.res.time?1:-1));
  const winnerOf=b=>b.res.winner==='a'?b.a:b.b;
  for(const b of fin.slice(0,2))bon.push({k:'퍼포먼스 오브 더 나이트',name:winnerOf(b).name,me:b.me&&res.winner==='a'});
  const fotn=ev.bouts.find(b=>b.me&&res.fotn)||pick(ev.bouts.filter(b=>b.res&&b.res.method==='판정'))||ev.bouts[ev.bouts.length-1];
  if(fotn)bon.push({k:'파이트 오브 더 나이트',name:`${fotn.a.name} vs ${fotn.b.name}`,me:!!fotn.me});
  ev.bonus=bon;ev.done=true;
  c.events=c.events||[];c.events.unshift(ev);if(c.events.length>12)c.events.length=12;
  // headline news
  const main=ev.bouts[0];if(main&&main.res&&!main.me){const w=winnerOf(main),l=main.res.winner==='a'?main.b:main.a;c.news.unshift(`${ev.name} 메인 이벤트: ${w.name}, ${l.name}에게 ${main.res.method} 승${main.title?' (타이틀전)':''}`)}
  return ev;
}
function cardHtml(ev,compact){
  const secs=['메인 이벤트','코메인 이벤트','메인 카드','프렐림','얼리 프렐림'];let h='',last='';
  ev.bouts.forEach(b=>{const sec=b.slot==='메인 이벤트'||b.slot==='코메인 이벤트'?'메인 카드':b.slot;if(sec!==last){h+=`<div class="evsec">${sec}</div>`;last=sec}
    const r=b.res,wa=r&&r.winner==='a',wb=r&&r.winner==='b';
    h+=`<div class="bout${b.me?' me':''}${b.slot==='메인 이벤트'?' main':''}">
      <div class="bs ${wa?'w':wb?'l':''}"><b>${esc(b.a.name)}</b><span>${esc(b.a.rank||'')} · ${b.a.ovr}</span></div>
      <div class="bm">${b.slot==='메인 이벤트'||b.slot==='코메인 이벤트'?`<em>${b.slot}</em>`:''}<span>${clsName(b.cls)}${b.title?' 🏆':''}</span>${r?`<strong>${r.method==='판정'?esc(r.detail||'판정'):esc(r.method)}</strong><small>${r.round}R ${r.time||''}</small>`:`<strong>VS</strong><small>${b.rounds}R</small>`}</div>
      <div class="bs r ${wb?'w':wa?'l':''}"><b>${esc(b.b.name)}</b><span>${esc(b.b.rank||'')} · ${b.b.ovr}</span></div></div>`});
  const bon=ev.bonus&&ev.bonus.length?`<div class="evbon">${ev.bonus.map(x=>`<div class="${x.me?'me':''}"><span>${x.k}</span><b>${esc(x.name)}</b></div>`).join('')}</div>`:'';
  return `<div class="evhead${ev.reg?' reg':''}"><span>${ev.done?'경기 결과':'파이트 카드'}</span><h3>${esc(ev.name)}</h3><p>${esc(ev.city)}</p></div>${bon}<div class="card${compact?' compact':''}">${h}</div>`;
}
V.ccard=()=>{const c=DATA.career,ev=c.fight&&c.fight.card;return `${back('chub','← 커리어')}<div class="panel">${ev?cardHtml(ev):'<p>예정된 이벤트가 없습니다.</p>'}</div>`};
V.cevents=()=>{const c=DATA.career,E=c.events||[];return `${back('chub','← 커리어')}<div class="panel"><div class="eyebrow">지난 이벤트</div>${E.length?E.map(ev=>`<details class="evd"><summary><b>${esc(ev.name)}</b> <span>${esc(ev.city)}</span></summary>${cardHtml(ev,true)}</details>`).join(''):'<p>아직 치른 이벤트가 없습니다.</p>'}</div>`};
function careerResult(res){
  const c=DATA.career,o=c.fight,opp=getF(o.opp,c),won=res.winner==='a',draw=!res.winner;
  const before=c.order.indexOf('me');const lines=[];
  const wasMain=c.tier!=='regional';
  if(won){c.rec[0]++;c.streak++;if(wasMain)c.mstreak=(c.mstreak||0)+1}else if(draw)c.rec[2]++;else{c.rec[1]++;c.streak=0;c.mstreak=0}
  let pay=(o.purse+(won?o.purse:0))*(1-(o.penalty||0));if(o.penalty){c.hype=clamp(c.hype-3,0,100);lines.push('체중 초과 · 인지도 −3')}
  if(won&&res.perf){pay+=50000;lines.push('퍼포먼스 오브 더 나이트!')}
  if(res.fotn){pay+=50000;lines.push('오늘의 명승부 선정!')}
  c.hype=clamp(c.hype+(won?(res.perf?10:6)+(o.title?15:0):draw?1:-8),0,100);
  const oi=c.order.indexOf(o.opp);
  if(c.tier==='regional'){
    if(won)c.reg.w++;else if(!draw)c.reg.l++;
    if(won&&o.contender){(res.ach=res.ach||[]).push(...unlock(['sign']));c.tier='main';c.order=c.order.filter(x=>x!=='me');c.order.push('me');c.hype=clamp(c.hype+12,0,100);lines.push('IRON CAGE 계약 성공! 이제 메이저 무대입니다');c.news.unshift(`${c.name}, 입성 테스트 승리로 IRON CAGE와 계약`)}
    else if(won&&c.reg.w===3)lines.push('지역 3승! 다음 경기는 IRON CAGE 입성 테스트입니다');
  }else if(won){
    if(o.kc){c.kc=(c.kc||0)+1;c.hype=clamp(c.hype+12,0,100);lines.push(c.kc>1?`킹 오브 케이지 ${c.kc-1}차 방어!`:'킹 오브 케이지 벨트 획득!');c.news.unshift(`${c.name}, ${clsName(opp.cls)} 챔피언 ${opp.name} 꺾고 킹 오브 케이지 ${c.kc>1?'방어':'등극'}`)}
    else if(o.title){if(!c.isChamp)c.titles++;else c.titleDef++;c.isChamp=true;c.belts=c.belts||[];if(!c.belts.includes(c.cls)){c.belts.push(c.cls);if(c.belts.length>1)lines.push(`${c.belts.length}체급 챔피언 달성!`)}c.order.splice(c.order.indexOf('me'),1);c.order.unshift('me');lines.push(c.titleDef?'타이틀 방어 성공!':'새 챔피언 등극!')}
    else if(oi<=15&&oi<before)moveMe(c,oi);
    else if(before>15){const to=before-3;if((c.mstreak||0)>=3&&to>15){moveMe(c,15);lines.push('IRON CAGE 3연승으로 랭킹 진입!')}else moveMe(c,Math.max(16,to))}
    else if(oi<before)moveMe(c,oi);
    else if(before>1)moveMe(c,before-1);
  }else if(!draw){
    if(o.kc){if(c.kc){lines.push('킹 오브 케이지 벨트를 잃었습니다');c.kc=0}c.hype=clamp(c.hype+3,0,100)}
    else if(c.isChamp&&o.title){c.isChamp=false;const o2=c.order;o2.splice(o2.indexOf(o.opp),1);o2.unshift(o.opp);moveMe(c,1);lines.push('타이틀을 잃었습니다')}
    else moveMe(c,before+3);
    if(res.method==='KO'||res.method==='TKO')c.s.chin=Math.max(30,c.s.chin-1.5);
  }
  c.pts+=won?(res.perf?4:3):1;
  c.age+=.4;
  if(c.age>32)for(const k of ['spd','car','chin','pow'])c.s[k]=Math.max(30,c.s[k]-rnd(0,.8));
  const after=c.order.indexOf('me');if(c.tier!=='regional')c.peak=Math.min(c.peak,after);
  {const ids=[];if(c.tier!=='regional'&&after<=15)ids.push('ranked');if(c.isChamp)ids.push('champ');if((c.belts||[]).length>=2)ids.push('double');if(c.streak>=10)ids.push('streak10');(res.ach=res.ach||[]).push(...unlock(ids))}
  /* press-conference promise */
  if(o.press==='callout'){if(won&&(res.method==='KO'||res.method==='TKO')){c.hype=clamp(c.hype+10,0,100);lines.push('KO 예고 적중! 인지도 +10')}else{c.hype=clamp(c.hype-10,0,100);lines.push('KO 예고 실패… 인지도 하락')}}
  c.recent=[o.opp,...(c.recent||[]).filter(x=>x!==o.opp)].slice(0,4);
  /* habits the rival keeps a file on */
  {const P=c.pat||{};for(const k in P)P[k]*=.6;for(const [k,v] of Object.entries(res.pat||{}))P[k]=(P[k]||0)+v;c.pat=P}
  /* super league: opens after a successful title defence (or a second belt) */
  if(won&&c.league!=='super'&&c.isChamp&&(c.titleDef>=1||(c.belts||[]).length>=2)){c.league='super';lines.push('슈퍼리그 승격! 이제 최정상 엘리트 무대입니다');c.news.unshift(`${c.name}, 엘리트 슈퍼리그 승격`);post(c,'press',`[공식] ${c.name}, IRON CAGE 슈퍼리그 승격 — 최강자들만 모이는 무대`)}
  c.history.unshift({opp:opp.name,res:won?'승':draw?'무':'패',method:res.method,detail:res.detail,round:res.round,time:res.time,title:o.title,kc:!!o.kc,rank:cRank(c),cls:c.cls});
  if(won)DATA.records.fin[res.method]=(DATA.records.fin[res.method]||0)+1;
  try{afterFight(c,res,o,won,opp)}catch(e){console.error(e)}
  let evDone=null;if(o.card){try{evDone=runCard(c,o.card,res);c.history[0].ev=evDone.name;if(evDone.bonus.some(x=>x.me&&x.k.startsWith('퍼포먼스'))&&!res.perf){lines.push('이벤트 퍼포먼스 보너스 선정!')}}catch(e){console.error(e)}}
  simWorld(c);
  c.phase='offers';c.fight=null;c.camp=null;c.energy=100;c.offers=makeOffers(c);
  const forced=c.age>=40;
  save();
  const extra=`<div class="kv"><div><span>랭킹</span><b>${c.tier==='regional'||o.contender?(o.contender&&won?'IRON CAGE 입성':'지역 단체'):rankLabel(before)+' → '+rankLabel(after)}</b></div><div><span>인지도</span><b>${Math.round(c.hype)}</b></div><div><span>능력치 포인트</span><b>+${won?(res.perf?4:3):1}</b></div></div>${lines.length?`<div class="advice">${lines.map(esc).join(' · ')}</div>`:''}${forced?'<div class="advice">나이 40세. 이번 경기를 끝으로 은퇴를 준비할 때입니다.</div>':''}`;
  const afterP={res,label:evDone?`${evDone.name} · ${clsName(c.cls)}`:`커리어 · ${clsName(c.cls)}`,extra:extra+(evDone?`<details class="evd" open><summary><b>${esc(evDone.name)} 전체 결과</b></summary>${cardHtml(evDone,true)}</details>`:''),cont:forced?[['은퇴식','nav:cretire']]:[['커리어로','nav:chub'],['능력치','nav:cstats']]};
  let cer=null;if(won&&(o.title||o.kc)){const def=o.kc?c.kc-1:lines.includes('타이틀 방어 성공!')?c.titleDef:0,no=o.kc?1+(IC.hash('kc'+c.name)%3):6+(IC.hash(c.cls+c.name)%7)+Math.max(0,c.titles-1);
    cer={kc:!!o.kc,def,no,rec:`${c.rec.join('-')}`,ev:evDone?evDone.name:'IRON CAGE',how:`${res.method}${res.round?' · '+res.round+'R':''}${res.time?' '+res.time:''}`,opp};
    (c.beltLog=c.beltLog||[]).unshift({cls:o.kc?'kc':c.cls,no,def,ev:cer.ev,opp:opp.name,how:cer.how});save()}
  if(won&&!forced)go('cpost',{res,after:afterP,belt:!!(o.title||o.kc),cer,me:meData(c),clsName:clsName(c.cls),oppName:opp.name});else go('result',afterP);
}
/* ---------- 월장 / 감량 (weight class change) ---------- */
V.cclass=()=>{const c=DATA.career,ci=CLASSES.findIndex(x=>x.id===c.cls);
  return `${back('chub','← 커리어')}<div class="panel"><div class="eyebrow">체급 변경</div><h2 class="big">${clsName(c.cls)}에서 어디로?</h2>${c.phase==='camp'?'<div class="advice" style="border-color:#ff8b7f"><b>캠프 중입니다</b> · 체급을 바꾸면 지금 잡힌 경기와 캠프가 취소되고 인지도가 조금 떨어집니다.</div>':c.phase==='fight'?'<p style="color:#ff8b7f">경기 당일에는 체급을 바꿀 수 없어요. 경기를 마친 뒤 바꿔 주세요.</p>':''}
  <p>한 체급 올라가면(월장) 상대가 커져서 파워·맷집이 조금 줄고 체력은 오릅니다. 내려가면(감량) 파워가 조금 오르지만 체력이 줄고 계체 실패 위험이 커집니다. ${c.isChamp?'<b>챔피언이 체급을 옮기면 지금 벨트는 반납하지만, 새 체급에서 바로 타이틀 도전권을 받습니다.</b>':c.tier==='regional'?'지역 단체에서는 순위 변동 없이 체급만 바뀝니다.':'랭킹은 새 체급에서 비슷하거나 조금 낮은 위치로 옮겨집니다.'}</p>
  <div class="acts">${CLASSES.map((C,i)=>{const d=i-ci,cur=d===0;return `<button class="act" data-act="cClass" data-id="${C.id}" ${cur||Math.abs(d)>2?'disabled':''} style="${cur?'border-color:var(--gold)':''}"><b>${C.name}${cur?' · 현재':''}</b><span>${C.lb} lb · ${C.kg} kg</span><span>${cur?'':Math.abs(d)>2?'두 체급 넘게는 못 옮겨요':d>0?`월장 ${d}체급 · 파워 −${(1.5*d).toFixed(1)} 맷집 −${(1.5*d).toFixed(1)} 체력 +${(1.5*d).toFixed(1)}`:`감량 ${-d}체급 · 파워 +${-d} 체력 −${(2.5*-d).toFixed(1)} 계체 위험↑`}</span></button>`}).join('')}</div></div>`};
A.cClass=d=>{const c=DATA.career;if(c.phase==='fight'||d.id===c.cls)return;
  if(c.phase==='camp'){const f=c.fight&&getF(c.fight.opp,c);c.hype=Math.max(0,c.hype-4);if(f)c.news.unshift(`${c.name}, 체급 변경으로 ${f.name}전 취소`);c.fight=null;c.camp=null;c.phase='offers'}
  const ci=CLASSES.findIndex(x=>x.id===c.cls),ni=CLASSES.findIndex(x=>x.id===d.id),diff=ni-ci;if(Math.abs(diff)>2)return;
  const old=c.cls,oldIdx=c.order.indexOf('me'),wasChamp=c.isChamp,C=CLASSES[ni];
  if(diff>0){c.s.pow=Math.max(30,c.s.pow-1.5*diff);c.s.chin=Math.max(30,c.s.chin-1.5*diff);c.s.car=Math.min(99,c.s.car+1.5*diff);c.cutRisk=Math.max(0,(c.cutRisk||0)-.06*diff)}
  else{c.s.pow=Math.min(99,c.s.pow-diff);c.s.car=Math.max(30,c.s.car+2.5*diff);c.cutRisk=(c.cutRisk||0)+.08*-diff}
  c.cls=C.id;c.height=Math.round((C.h[0]+C.h[1])/2+(c.height-(CLASSES[ci].h[0]+CLASSES[ci].h[1])/2)*.3);c.reach=Math.round((C.reach[0]+C.reach[1])/2);
  if(!c.fillers.some(f=>f.cls===C.id))c.fillers=c.fillers.concat(genFillers(C.id,c.seed));
  const ids=[...IC.byClass(C.id).map(f=>f.id),...c.fillers.filter(f=>f.cls===C.id).map(f=>f.id)];
  c.order=ids.sort((x,y)=>getF(y,c).ovr-getF(x,c).ovr);
  let to=c.order.length;
  if(c.tier!=='regional'){if(wasChamp)to=4;else if(oldIdx<=15)to=Math.min(15,oldIdx+3);else to=Math.max(16,Math.min(c.order.length,oldIdx))}
  c.order.splice(to,0,'me');
  if(wasChamp){c.isChamp=false;c.news.unshift(`${clsName(old)} 챔피언 ${c.name}, 벨트 반납하고 ${C.name}으로 ${diff>0?'월장':'감량'}`)}
  else c.news.unshift(`${c.name}, ${C.name}으로 ${diff>0?'월장':'감량'}`);
  c.history.unshift({opp:'—',res:'체급 변경',method:`${clsName(old)} → ${C.name}`,detail:'',round:'',time:'',rank:cRank(c),cls:C.id});
  c.offers=makeOffers(c);
  if(wasChamp&&c.tier!=='regional'){const champ=c.order[0];if(champ!=='me')c.offers.unshift({opp:champ,title:true,rounds:5,purse:Math.round(150000+c.hype*2000),superfight:true})}
  save();go('chub')};
V.cstats=()=>{const c=DATA.career,me=meData(c);
  const cost=v=>v<70?1:v<85?2:3;
  return `${back('chub','← 커리어')}<div class="panel"><div class="eyebrow">능력치 · 종합 ${me.ovr}</div><h2 class="big">포인트 <span class="g">${c.pts}</span></h2>
  <p>경기에서 얻은 포인트를 원하는 능력치에 투자하세요. 높은 능력치일수록 비용이 큽니다 (70 미만 1, 85 미만 2, 그 이상 3).</p>
  ${Object.entries(IC.STAT_GROUP).map(([g,ks])=>`<h3>${g}</h3><div class="sbars" style="grid-template-columns:auto 1fr auto auto">${ks.map(k=>{const v=me.s[k];return `<span class="n">${STATN[k]}</span><span class="track"><i class="${v>=88?'hi':v>=75?'mid':''}" style="width:${v}%"></i></span><span class="v">${v}</span><button class="plus" data-act="cPlus" data-k="${k}" ${c.pts<cost(v)||v>=99?'disabled':''} aria-label="${STATN[k]} 올리기">+</button>`}).join('')}</div>`).join('')}</div>`};
A.cPlus=d=>{const c=DATA.career,v=Math.round(c.s[d.k]),cost=v<70?1:v<85?2:3;if(c.pts<cost||v>=99)return;c.pts-=cost;c.s[d.k]=Math.min(99,Math.round(c.s[d.k])+1);save();render()};
V.cgym=()=>{const c=DATA.career;
  return `${back('chub','← 커리어')}<div class="panel"><div class="eyebrow">체육관</div><h2 class="big">어디서 캠프를 차릴까</h2><p>체육관마다 훈련 효율이 다릅니다. 일부는 인지도가 있어야 들어갈 수 있어요.</p>
  <div class="acts">${GYMS.map(g=>`<button class="act" data-act="cGym" data-id="${g.id}" ${g.minHype&&c.hype<g.minHype?'disabled':''} style="${g.id===c.gym?'border-color:var(--gold)':''}"><b>${g.name}${g.id===c.gym?' · 현재':''}</b><span>${g.desc}</span><span>타격 ×${g.mul.strike} · 레슬링 ×${g.mul.wrestle} · 주짓수 ×${g.mul.bjj}</span></button>`).join('')}</div></div>`};
A.cGym=d=>{DATA.career.gym=d.id;save();render()};
V.cspec=()=>{const c=DATA.career;
  return `${back('chub','← 커리어')}<div class="panel"><div class="eyebrow">필살기</div><h2 class="big">${SPM[c.special].name}</h2><p>게이지가 가득 차면 쓸 수 있는 기술입니다. 새 기술은 $20,000에 배울 수 있어요 (인지도 15 이상).</p>
  <div class="acts">${Object.values(SPM).map(s=>{const has=c.unlocked.includes(s.id);return `<button class="act" data-act="cSpec" data-id="${s.id}" ${!has&&c.hype<15?'disabled':''} style="${s.id===c.special?'border-color:var(--gold)':''}"><b>${s.name}${s.id===c.special?' · 장착':''}</b><span>${s.kind==='shoot'?'확정 테이크다운계':s.target==='head'?'머리 타격':'몸통 타격'}${s.dmg?' · 위력 '+s.dmg:''}</span><span>${has?'보유':'배우기 (인지도 15 이상)'}</span></button>`}).join('')}</div></div>`};
A.cSpec=d=>{const c=DATA.career;if(!c.unlocked.includes(d.id)){if(c.hype<15)return;c.unlocked.push(d.id)}c.special=d.id;save();render()};
V.crank=()=>{const c=DATA.career;
  if(c.tier==='regional')return `${back('chub','← 커리어')}<div class="panel"><div class="eyebrow">${clsName(c.cls)} 랭킹</div><p>아직 지역 단체 소속이라 IRON CAGE 랭킹에 없습니다. 지역에서 3승 후 입성 테스트를 통과하면 랭킹 외 선수로 계약하고, 3연승하거나 랭커를 꺾어야 15위 안에 들어갑니다.</p><div class="flist">${c.order.slice(0,16).map((id,i)=>frow(getF(id,c),{rank:i})).join('')}</div></div>`;
  return `${back('chub','← 커리어')}<div class="panel"><div class="eyebrow">${clsName(c.cls)} 랭킹</div><div class="flist">${c.order.slice(0,16).map((id,i)=>frow(getF(id,c),{rank:i})).join('')}</div>
  ${c.order.indexOf('me')>15?`<p>나는 아직 랭킹 외입니다 (체급 ${c.order.length}명 중 ${c.order.indexOf('me')+1}번째). 랭킹 외 선수끼리 이기면 3계단씩 오르고, 3연승하면 15위로 진입합니다.</p>`:''}</div>`};
V.chist=()=>{const c=DATA.career;
  return `${back('chub','← 커리어')}<div class="panel"><div class="eyebrow">전적</div><h2 class="big">${c.rec.join('-')}</h2>
  ${c.history.length?`<div class="tw"><table><thead><tr><th>상대</th><th>결과</th><th>방식</th><th>라운드</th><th>이후 순위</th></tr></thead><tbody>${c.history.map(h=>`<tr><td>${esc(h.opp)}${h.title?' 🏆':''}</td><td class="${h.res==='승'?'a':h.res==='패'?'b':''}">${h.res}</td><td>${esc(h.method)} · ${esc(h.detail)}</td><td>${h.round}R ${h.time}</td><td>${h.rank}</td></tr>`).join('')}</tbody></table></div>`:'<p>아직 경기 기록이 없습니다.</p>'}</div>`};
let retireArm=false;
/* ---------- hall of fame ---------- */
const HOF_NEED=40,HOF_FIRST=80;
function hofScore(c){const h=c.history||[],w=h.filter(x=>x.res==='승'),fin=w.filter(x=>x.method!=='판정').length,tw=w.filter(x=>x.title).length,b=(c.belts||[]).length;
  const rows=[['승리',c.rec[0],c.rec[0]*1.5],['피니시 승',fin,fin],['타이틀 획득',c.titles,c.titles*12],['타이틀 방어',c.titleDef,c.titleDef*6],['킹 오브 케이지',c.kc||0,(c.kc||0)*15]];
  if(b>1)rows.push(['다체급 챔피언',b+'체급',(b-1)*15]);
  if(c.tier!=='regional'&&c.peak<=5)rows.push(['최고 순위',rankLabel(c.peak),c.peak===0?10:5]);
  if(c.rec[1])rows.push(['패배',c.rec[1],-c.rec[1]*.5]);
  const total=Math.max(0,Math.round(rows.reduce((a,r)=>a+r[2],0)));return{rows,total,tw}}
const LEGD=[
 ['fly','마사키 레이토','번개손','일본','karate',[24,3,0],0,9,'7년간 9차 방어, 한 번도 판정 위기에 몰리지 않은 플라이급의 시계'],
 ['bw','크루즈 바렐라','작은 폭풍','멕시코','boxer',[26,4,0],0,6,'5라운드 막판 역전 KO로 벨트를 지킨 전설의 밤'],
 ['fw','티아구 벨로주','바이아의 칼날','브라질','muaythai',[29,5,1],0,7,'로킥만으로 도전자 셋을 무너뜨린 페더급의 왕'],
 ['lw','아슬란 무르타자예프','산맥','다게스탄','sambo',[27,1,0],0,5,'통산 테이크다운 성공률 61%, 누구도 그를 일으키지 못했다'],
 ['ww','리암 오카포','철의 장막','나이지리아','wrestler',[25,3,0],0,8,'8차 방어 동안 허용한 녹다운 0회'],
 ['mw','한도윤','무쇠주먹','대한민국','brawler',[22,4,0],0,6,'세 번 다운당하고 일어나 3라운드 KO, 역대 최고의 명승부'],
 ['lhw','빅토르 셀린','북극곰','러시아','kickboxer',[23,5,0],1,5,'미들급과 라이트헤비급 벨트를 동시에 허리에 감은 사나이'],
 ['hw','파누 툴라가','섬의 왕','사모아','brawler',[20,4,0],0,4,'통산 18 KO, 헤비급 역사상 가장 무거운 주먹'],
 ['fw','문태호','회오리','대한민국','taekwondo',[21,2,0],0,6,'뒤후려차기로만 네 번의 KO, 케이지에 태권도를 새긴 페더급의 발']];
const LEG=LEGD.map(([cls,name,nick,from,style,rec,extra,def,line],i)=>{const id='leg_'+i;cls=(IC.CLSMAP||{})[cls]||cls;return{id,name,nick,from,style,cls,rec,def,belts:1+extra,line,look:IC.makeLook(id,from,IC.seeded(IC.hash(id+name)))}});
function plaque(o){return `<div class="plaque${o.gold?' gold':''}"><canvas data-pid="${o.pid}" data-mode="bust"></canvas><div class="pq">
  <div class="eyebrow">${esc(o.tag)}</div><b class="pn">${esc(o.name)}</b><span class="pk">"${esc(o.nick)}" · ${esc(o.from)} · ${clsName(o.cls)} · ${STYLES[o.style]?STYLES[o.style].name:''}</span>
  <div class="pst"><div><b>${o.rec.join('-')}</b><span>전적</span></div><div><b>${o.belts}</b><span>벨트</span></div><div><b>${o.def}</b><span>방어</span></div>${o.score!=null?`<div><b>${o.score}</b><span>점수</span></div>`:''}</div>
  ${o.line?`<p class="pl">${esc(o.line)}</p>`:''}${o.quote?`<p class="pquote">“${esc(o.quote)}”</p>`:''}</div></div>`}
function hofPlaque(x,i){return plaque({pid:'hof:'+i,gold:x.first,tag:`제${x.no}기 헌액${x.first?' · 퍼스트 밸럿':''}`,name:x.name,nick:x.nick,from:x.from,cls:x.cls,style:x.style,rec:x.rec,belts:x.belts,def:x.titleDef,score:x.score,line:x.high,quote:x.quote})}
function hofBar(c){const h=hofScore(c),pct=Math.min(100,h.total/HOF_FIRST*100);
  return `<div class="hofbar"><div class="hb"><i style="width:${pct}%"></i><em style="left:${HOF_NEED/HOF_FIRST*100}%"></em></div><div class="between-row"><span>${h.total}점</span><span>헌액 ${HOF_NEED} · 퍼스트 밸럿 ${HOF_FIRST}</span></div></div>
  <div class="tw"><table><tbody>${h.rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td style="text-align:right;color:${r[2]<0?'var(--red-t)':'var(--gold)'}">${r[2]>0?'+':''}${Math.round(r[2]*10)/10}</td></tr>`).join('')}</tbody></table></div>`}
V.hof=()=>{const c=DATA.career,H=DATA.hof||[];
  return `${back('home')}<div class="hofhead"><div class="eyebrow">IRON CAGE</div><h2>명예의 전당</h2><p>케이지 위에서 시대를 지배한 이들의 이름이 새겨지는 곳</p></div>
  ${c?`<div class="panel"><div class="eyebrow">현역 · ${esc(c.name)}</div><h3>헌액 진척도</h3>${hofBar(c)}<p>${hofScore(c).total>=HOF_NEED?'지금 은퇴해도 명예의 전당에 들어갑니다.':`은퇴할 때 ${HOF_NEED}점을 넘기면 헌액됩니다. 타이틀(+12)과 방어(+6)가 가장 큰 점수입니다.`}</p></div>`:''}
  <div class="panel"><div class="eyebrow">커리어 윙</div><h3>나의 헌액자 ${H.length}명</h3>${H.length?`<div class="plaques">${H.map(hofPlaque).join('')}</div>`:'<p>아직 헌액된 커리어 선수가 없습니다. 커리어에서 챔피언이 된 뒤 은퇴하면 이곳에 명판이 걸립니다.</p>'}</div>
  <div class="panel"><div class="eyebrow">레전드 윙</div><h3>창립 헌액자</h3><div class="plaques">${LEG.map((l,i)=>plaque({pid:'leg:'+i,gold:true,tag:'창립 헌액 · '+clsName(l.cls)+' 레전드',name:l.name,nick:l.nick,from:l.from,cls:l.cls,style:l.style,rec:l.rec,belts:l.belts,def:l.def,line:l.line})).join('')}</div></div>`};
V.cretire=()=>{const c=DATA.career,h=hofScore(c),ok=h.total>=HOF_NEED;
  return `${back('chub','← 커리어')}<div class="panel"><div class="eyebrow">은퇴</div><h2 class="big">${esc(c.name)}</h2>
  <p>${c.rec.join('-')} · 타이틀 ${c.titles}회 · 방어 ${c.titleDef}회 · 최고 순위 ${c.tier==='regional'?'지역 단체':rankLabel(c.peak)}.</p>
  <h3>명예의 전당 심사</h3>${hofBar(c)}
  <div class="advice"><b>${ok?(h.total>=HOF_FIRST?'퍼스트 밸럿 헌액 예상':'헌액 예상'):'헌액 기준 미달'}</b> · ${ok?'은퇴하면 헌액식이 열리고 명판이 걸립니다.':`${HOF_NEED-h.total}점이 모자랍니다. 은퇴하면 기록실에만 남습니다.`}</div>
  <button class="btn-go" data-act="cRetire">${retireArm?'한 번 더 누르면 은퇴합니다':'글러브 내려놓기'}</button></div>`};
A.cRetire=()=>{if(!retireArm){retireArm=true;render();return}retireArm=false;const c=DATA.career,h=hofScore(c);
  DATA.archive.unshift({name:c.name,cls:c.cls,rec:c.rec,titles:c.titles,peak:c.peak,score:h.total});
  DATA.hof=DATA.hof||[];let idx=-1;
  if(h.total>=HOF_NEED){const tw=(c.history||[]).filter(x=>x.res==='승'&&x.title),last=tw[tw.length-1];
    const high=tw.length?`${tw.length}번의 타이틀전 승리 · 첫 벨트는 ${last.opp}를 ${last.method==='판정'?'판정으로':last.round+'라운드 '+last.method+'로'} 꺾고 획득`:`${(c.history||[]).filter(x=>x.res==='승'&&x.method!=='판정').length}번의 피니시 승리`;
    DATA.hof.unshift({no:DATA.hof.length+1,first:h.total>=HOF_FIRST,score:h.total,f:meData(c),name:c.name,nick:c.nick,from:c.from,cls:c.cls,style:c.style,rec:c.rec.slice(),belts:(c.belts||[]).length,titleDef:c.titleDef,high,quote:''});idx=0;unlock(['hof'])}
  const name=c.name;DATA.career=null;save();go('hofc',{idx,name,score:h.total});if(idx>=0)Sound.play('reveal')};
const SPEECH=['체육관 동료들, 그리고 나를 믿어 준 모든 팬에게 이 명판을 바칩니다.','나는 재능이 없었다. 그냥 아무도 나보다 오래 버티지 못했을 뿐이다.','케이지는 나에게 모든 것을 줬다. 이제 다음 세대 차례다.','내 이름 옆에 붙은 패배들까지, 전부 자랑스럽다.'];
V.hofc=p=>{if(p.idx<0)return `<div class="panel"><div class="eyebrow">은퇴</div><h2 class="big">${esc(p.name)}, 글러브를 내려놓다</h2>
  <p>명예의 전당 점수 ${p.score}점. 헌액 기준(${HOF_NEED}점)에는 닿지 못했지만 기록실에 이름이 남았습니다. 다음 선수는 벨트를 노려 보세요.</p>
  <div class="row"><button class="btn-go" data-act="career">새 커리어</button><button class="btn" data-act="nav" data-to="hof">명예의 전당 보기</button><button class="btn" data-act="nav" data-to="records">기록실</button></div></div>`;
  const x=DATA.hof[p.idx];
  return `<div class="hofhead"><div class="eyebrow">헌액식 · 제${x.no}기</div><h2>${x.first?'퍼스트 밸럿 헌액':'명예의 전당 헌액'}</h2><p>${esc(x.name)}, 영원히 케이지의 전설로 남다</p></div>
  <div class="panel"><div class="plaques one">${hofPlaque(x,p.idx)}</div>
  ${x.quote?`<div class="row"><button class="btn-go" data-act="nav" data-to="hof">명예의 전당으로</button><button class="btn" data-act="career">새 커리어</button></div>`:`<h3>헌액 연설</h3><p>마이크 앞에 섰습니다. 명판에 새길 한마디를 고르세요.</p><div class="acts">${SPEECH.map((t,i)=>`<button class="act" data-act="hofSpeech" data-i="${i}"><span>“${esc(t)}”</span></button>`).join('')}</div>`}</div>`};
A.hofSpeech=d=>{const x=DATA.hof[P.idx];if(!x)return;x.quote=SPEECH[+d.i];save();Sound.play('reveal');render()};

/* ---------- attract-mode demo on the home screen ---------- */
let demoRaf=0,demoLast=0,demoAcc=0,demoOn=false;
function startDemo(){
  const el=document.getElementById('demo');if(!el)return;
  stopDemo();demoOn=true;
  const cls=pick(CLASSES).id,l=IC.byClass(cls);const a=pick(l);let b=pick(l);while(b===a)b=pick(l);
  IC.opts.nums=false;{const tg=document.getElementById('demoTag');if(tg)tg.textContent=`${a.nick} vs ${b.nick} · ${clsName(cls)}`}
  IC.Fight.start({a,b,rounds:1,roundSec:90,diff:'hard',demo:true,replay:false,onRound:()=>{},onEnd:()=>{setTimeout(()=>{if(demoOn&&SCREEN==='home')startDemo()},600)}});
  const dc=el.getContext('2d');
  const fitD=()=>{const d=Math.min(2,window.devicePixelRatio||1);el.width=800*d;el.height=450*d;dc.setTransform(d,0,0,d,0,0)};fitD();
  demoLast=performance.now();demoAcc=0;
  const fr=now=>{if(!demoOn)return;demoAcc+=Math.min(100,now-demoLast);demoLast=now;let n=0;while(demoAcc>=1000/60){demoAcc-=1000/60;n++}
    const S=IC.Fight.S;if(!S||!S.demo)return;if(n)IC.Fight.tick(n);IC.Draw.render(S,dc,el.clientWidth);demoRaf=requestAnimationFrame(fr)};
  demoRaf=requestAnimationFrame(fr);
}
function stopDemo(){if(!demoOn)return;demoOn=false;cancelAnimationFrame(demoRaf);const S=IC.Fight.S;if(S&&S.demo)IC.Fight.stop()}

/* ---------- PWA copy: online features need the Claude artifact runtime ---------- */
const STANDALONE=!(window.claude&&typeof window.claude.use==='function');
const offNote=(what,j='는')=>`${back('home')}<div class="hofhead"><div class="eyebrow">오프라인 앱 버전</div><h2>${what}</h2><p>이 기능은 아직 사용할 수 없어요</p></div>
  <div class="panel offbox"><div class="offic">🔒</div><div><b>${what}${j} Claude 아티팩트 버전에서만 작동해요.</b>
  <p>실시간 대전·관전·응원 채팅, 고스트 대전, 주간 토너먼트, 리더보드는 Claude가 제공하던 온라인 서버를 사용했어요. 이 독립 실행 앱에는 아직 온라인 서버가 연결되어 있지 않아서 꺼져 있습니다.</p>
  <p>커리어·토너먼트·연습·그랑프리·체육관 모드·명예의 전당·선수 명단은 모두 그대로 플레이할 수 있어요. 진행 상황은 이 기기에 저장됩니다.</p></div></div>`;
/* ================= ONLINE: lobby · real-time 1:1 · spectating & cheering · ghosts · weekly tournament ================= */
const NETF={};
const ONS=['online','opick','oroom','oresult','ghost','wtour'];
let srT=0;const softRender=()=>{clearTimeout(srT);srT=setTimeout(()=>{const ae=document.activeElement;if(ONS.includes(SCREEN)&&game.hidden&&!(ae&&ae.tagName==='INPUT'))render()},150)};
const miniF=f=>({id:f.id,name:f.name,nick:f.nick||f.name,from:f.from||'',style:f.style,cls:f.cls,s:f.s,special:f.special,look:f.look,reach:f.reach,height:f.height,age:f.age,rec:f.rec,ovr:f.ovr});
const fSum=f=>f?{n:f.name,nk:f.nick,c:f.cls,o:f.ovr}:null;
function netF(f,key){if(!f)return null;const d={...f,id:'net_'+key,me:false};NETF[key]=d;return d}
function myNetF(){const k=DATA.netF;if((k==='me'||!k)&&DATA.career)return meData(DATA.career);const f=k&&k!=='me'?getF(k):null;if(f)return f;const L=ROSTER.filter(x=>!x.legend).sort((a,b)=>b.ovr-a.ovr);return L[IC.hash(String(Store.uid||Net.uid||'guest'))%Math.min(24,L.length)]}
const ORec=()=>DATA.records.online=DATA.records.online||{w:0,l:0,d:0};
const Net={room:null,user:null,uid:null,ok:false,names:{},peers:[],mr:null,role:null,code:null,lastS:null,lastInp:null,inp:{ax:0,az:0,blk:0,q:[]},seq:0,chat:[],gone:0,ended:false,unsub:[],sendT:0,
  init(){if(this._i)return this._i;this._i=(async()=>{try{if(!window.claude||typeof window.claude.use!=='function')return;const [room,user]=await Promise.all([window.claude.use('room'),window.claude.use('user')]);this.room=room;this.user=user;
      if(user){try{this.uid=await user.id()}catch(e){}}
      if(room){this.ok=true;room.onPeers(ch=>{this.peers=ch.peers;this.names4(ch.peers.map(p=>p.by));if(SCREEN==='online')softRender()},()=>{this.ok=false});this.lobby('idle')}}catch(e){}})();return this._i},
  async names4(ids){ids=[...new Set(ids.filter(x=>x&&!(x in this.names)))];if(!ids.length||!this.user)return;ids.forEach(i=>this.names[i]='');try{const p=await this.user.profiles(ids);for(const i of ids)this.names[i]=(p&&p[i]&&p[i].name)||''}catch(e){}softRender()},
  nm(by){return by&&by===this.uid?'나':(this.names[by]||'플레이어')},
  lobby(st,extra={}){if(!this.room)return;this.room.presence({st,code:extra.code||null,a:extra.a||null,b:extra.b||null}).catch(()=>{})},
  mpeers(){try{return this.mr?this.mr.peers():[]}catch(e){return[]}},
  peerRole(r){return this.mpeers().find(p=>p.presence&&p.presence.role===r&&!(r!=='spec'&&p.sameTab&&this.role!==r))||null},
  async joinMatch(code,role){await this.init();if(!this.room)throw new Error('room');await this.leaveMatch();
    const mr=await this.room.join('m-'+code);this.mr=mr;this.code=code;this.role=role;this.chat=[];this.lastS=null;this.lastInp=null;this.inp={ax:0,az:0,blk:0,q:[]};this.ended=false;this.gone=0;
    this.unsub=[mr.onPeers(ch=>{this.names4(ch.peers.map(p=>p.by));if(SCREEN==='oroom'){if(this.role!=='host'){const h=this.peerRole('host');if(h&&h.presence.st==='live'&&h.presence.s&&game.hidden&&!this.ended)startMirror(this.role)}softRender()}},()=>{}),
      mr.on('chat',m=>{const t=m.data&&typeof m.data.t==='string'?m.data.t.slice(0,120):'';if(!t)return;this.chat.push({by:m.by,t,ts:Date.now(),me:m.isMe});if(this.chat.length>40)this.chat.shift();this.names4([m.by]);drawChat()}),
      mr.on('cheer',m=>{const e=m.data&&typeof m.data.e==='string'?m.data.e:'';if(CHEERS.includes(e))floatEmoji(e)})];
    this.names4([this.uid]);return mr},
  async leaveMatch(){const mr=this.mr;this.mr=null;this.role=null;this.code=null;this.unsub.forEach(u=>{try{u()}catch(e){}});this.unsub=[];if(mr){try{await mr.leave()}catch(e){}}this.lobby('idle')},
  out(k,id,g){const S=IC.Fight.S;if(!S||!this.mr||this.role!=='guest')return;const H=S.held,i=this.inp;
    i.ax=Math.round((H.ax||((H.right?1:0)-(H.left?1:0)))*100)/100;i.az=Math.round((H.az||((H.dn?1:0)-(H.up?1:0)))*100)/100;i.blk=H.block?1:0;
    if(k==='p'){i.q.push([++this.seq,id,g?1:0]);if(i.q.length>8)i.q.shift()}
    this.mr.presence({inp:{ax:i.ax,az:i.az,blk:i.blk,q:i.q.slice()}}).catch(()=>{})},
  frame(){const S=IC.Fight.S;if(!S||!this.mr)return;const now=performance.now();
    if(this.role==='host'){
      if(now-this.sendT>40){this.sendT=now;const s=IC.Fight.netSnap();if(s)this.mr.presence({s}).catch(()=>{})}
      const g=this.peerRole('guest');
      if(g){this.gone=0;const inp=g.presence.inp;if(inp&&inp!==this.lastInp){this.lastInp=inp;IC.Fight.netInput(inp)}}
      else if(S.mode==='fight'||S.mode==='intro'){if(!this.gone)this.gone=now;else if(now-this.gone>7000){this.gone=0;IC.Fight.oppLeft()}}
    }else{
      const h=this.peerRole('host');
      if(h){this.gone=0;const s=h.presence.s;if(s&&s!==this.lastS){this.lastS=s;const m=IC.Fight.applyNet(s);if(m)netMode(m)}}
      else if(!this.ended){if(!this.gone)this.gone=now;else if(now-this.gone>7000){this.ended=true;stopLoop();between.innerHTML=`<div class="eyebrow">온라인</div><h3>호스트 연결이 끊겼습니다</h3><p>상대가 나갔거나 인터넷이 끊겼어요.</p><button class="btn-go" id="netBack">온라인 로비로</button>`;between.hidden=false;pad.hidden=true;$('#netBack').onclick=()=>{A.oLeave()}}}
      if(this.role==='spec'&&S.frame%20===0)drawVote()}}
};
const CHEERS=['🔥','👏','😱','💪','👊','🥊','😂','🏆'];
function netMode(m){const S=IC.Fight.S;if(!S)return;
  if(m==='between'){between.innerHTML=`<div class="eyebrow">${S.round}라운드 종료</div><h3>라운드 휴식</h3><p>${esc(S.a.nick)} 머리 ${Math.round(S.a.head)} · 몸통 ${Math.round(S.a.body)} · 다리 ${Math.round(S.a.legs)}<br>${esc(S.b.nick)} 머리 ${Math.round(S.b.head)} · 몸통 ${Math.round(S.b.body)} · 다리 ${Math.round(S.b.legs)}</p><p>호스트가 다음 라운드를 시작하면 바로 이어집니다 (최대 12초).</p>`;between.hidden=false;pad.hidden=true;hintEl.hidden=true}
  else if(m==='fight'||m==='intro'){if(!between.hidden&&!Net.ended){between.hidden=true;pad.hidden=Net.role==='spec';hintEl.hidden=Net.role==='spec'}}
  else if(m==='over'&&!Net.ended){Net.ended=true;const r=S.result||{};setTimeout(()=>netEnd(r),1200)}}
function netEnd(res){stopLoop();const role=Net.role,R=ORec(),side=role==='host'?'a':role==='guest'?'b':null;
  if(side){if(!res.winner)R.d++;else if(res.winner===side)R.w++;else R.l++;save()}
  const S=IC.Fight.S;const a=S?S.a.d:null,b=S?S.b.d:null;
  if(role==='host'&&Net.mr){const s=IC.Fight.netSnap();Net.mr.presence({s,st:'done'}).catch(()=>{});Net.lobby('open',{code:Net.code,a:fSum(myNetF())})}
  removeOverlay();go('oresult',{res:{winner:res.winner,method:res.method,detail:res.detail,round:res.round,time:res.time},side,a,b})}
function removeOverlay(){const o=document.getElementById('netov');if(o)o.remove();const sb=document.getElementById('specbar');if(sb)sb.remove()}
function netOverlay(role){removeOverlay();const st=$('#stage');const o=document.createElement('div');o.id='netov';o.innerHTML='<div class="nchat" id="nchat"></div><div class="nfloat" id="nfloat"></div>'+(role==='spec'?'<div class="nvote" id="nvote"></div>':'');st.appendChild(o);
  if(role==='spec'){const sb=document.createElement('div');sb.id='specbar';sb.className='specbar';
    sb.innerHTML=`<div class="cheers">${CHEERS.map(e=>`<button data-ch="${e}">${e}</button>`).join('')}</div><div class="vrow"><span>승부 예측</span><button data-v="a" class="va">${esc(IC.Fight.S.a.nick)} 승</button><button data-v="b" class="vb">${esc(IC.Fight.S.b.nick)} 승</button></div>
    <form class="crow" id="specform"><input id="specin" maxlength="120" placeholder="응원 메시지…" autocomplete="off"><button class="btn sm">보내기</button></form><button class="btn sm" id="specleave">관전 종료</button>`;
    st.after(sb);
    sb.querySelectorAll('[data-ch]').forEach(b=>b.onclick=()=>netCheer(b.dataset.ch));
    sb.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{Net.myVote=b.dataset.v;Net.mr&&Net.mr.presence({vote:b.dataset.v}).catch(()=>{});sb.querySelectorAll('[data-v]').forEach(x=>x.classList.toggle('on',x===b));drawVote()});
    $('#specform').onsubmit=e=>{e.preventDefault();const i=$('#specin');netSay(i.value);i.value=''};$('#specleave').onclick=()=>A.oLeave()}
  else{const cb=document.createElement('div');cb.className='ncheer';cb.innerHTML=CHEERS.slice(0,5).map(e=>`<button data-ch="${e}">${e}</button>`).join('');o.appendChild(cb);cb.querySelectorAll('[data-ch]').forEach(b=>b.onclick=e=>{e.stopPropagation();netCheer(b.dataset.ch)})}
  drawChat();drawVote()}
function drawChat(){const el=document.getElementById('nchat');const now=Date.now();
  if(el)el.innerHTML=Net.chat.filter(c=>now-c.ts<12000).slice(-5).map(c=>`<div><b>${esc(Net.nm(c.by))}</b> ${esc(c.t)}</div>`).join('');
  const rl=document.getElementById('rchat');if(rl){rl.innerHTML=Net.chat.slice(-30).map(c=>`<div class="${c.me?'me':''}"><b>${esc(Net.nm(c.by))}</b><span>${esc(c.t)}</span></div>`).join('')||'<p class="mut">아직 메시지가 없어요.</p>';rl.scrollTop=rl.scrollHeight}}
setInterval(()=>{if(document.getElementById('nchat'))drawChat()},2000);
function drawVote(){const el=document.getElementById('nvote');if(!el)return;let a=0,b=0;for(const p of Net.mpeers()){const v=p.presence&&p.presence.vote;if(v==='a')a++;else if(v==='b')b++}
  const t=a+b,pa=t?Math.round(a/t*100):50;el.innerHTML=t?`<div class="vb"><i style="width:${pa}%"></i></div><span>${pa}% · ${100-pa}% <small>(${t}명 예측)</small></span>`:''}
function floatEmoji(e){const f=document.getElementById('nfloat');if(!f)return;const s=document.createElement('span');s.textContent=e;s.style.left=(10+Math.random()*80)+'%';f.appendChild(s);setTimeout(()=>s.remove(),2600)}
async function netCheer(e){if(!Net.mr)return;try{await Net.mr.emit('cheer',{e})}catch(err){floatEmoji(e)}}
async function netSay(t){t=String(t||'').trim().slice(0,120);if(!t||!Net.mr)return;try{await Net.mr.emit('chat',{t})}catch(err){Net.chat.push({by:Net.uid,t:'(채팅 권한이 없어요 — 게임을 공유한 사람에게 참여 권한을 받아야 해요)',ts:Date.now()});drawChat()}}
function startMirror(role){const h=Net.peerRole('host'),g=Net.peerRole('guest');if(!h||!g||!h.presence.f||!g.presence.f)return;
  const a=netF(h.presence.f,'h'),b=netF(g.presence.f,'g'),cfg=h.presence.cfg||{};
  CFG={online:role,label:role==='spec'?'관전':'온라인 대전'};Sound.on=DATA.settings.sound;Sound.init();Sound.music(false);
  scr.hidden=true;game.hidden=false;between.hidden=true;pad.hidden=role==='spec';hintEl.hidden=role==='spec';
  $('#glabel').textContent=role==='spec'?`관전 · ${a.nick} vs ${b.nick}`:`온라인 대전 · ${Net.nm(h.by)}`;
  stopDemo();IC.opts.nums=!!DATA.settings.nums;
  IC.Fight.start({a,b,mirror:true,spec:role==='spec',walkout:false,replay:false,rounds:cfg.rounds||3,roundSec:cfg.sec||120,onRound(){},onEnd(){}});
  const S=IC.Fight.S;S.netOut=(k,id,gg)=>Net.out(k,id,gg);Net.lastS=null;Net.ended=false;Net.gone=0;USE3D=!!(IC.R3D&&IC.R3D.init(gl));gl.hidden=!USE3D;if(USE3D)IC.R3D.reset();
  if(role==='spec')Net.lobby('spec',{code:Net.code});
  lastKey='';if(role!=='spec'){buildPad();autoImmersive()}document.querySelector('.app').classList.add('wide');requestAnimationFrame(fit);startLoop();netOverlay(role);window.scrollTo(0,0)}
const roomCode=()=>{const c='abcdefghjkmnpqrstuvwxyz23456789';let s='';for(let i=0;i<4;i++)s+=c[Math.random()*c.length|0];return s};
/* ---------- screens ---------- */
const fRowNet=(f,key,right='')=>{NETF[key]=f;return `<div class="frow nf"><canvas class="pt" data-pid="net:${key}" data-mode="bust"></canvas><span><span class="nm" style="display:block">${esc(f.name)} <small style="opacity:.6">"${esc(f.nick||'')}"</small></span><small class="mut">${clsName(f.cls)} · ${esc((STYLES[f.style]||{}).name||'')} · ${(f.rec||[0,0,0]).join('-')}</small></span><span class="ovr">${f.ovr||''}</span>${right}</div>`};
V.online=()=>{if(STANDALONE)return offNote('온라인 아레나');const me=myNetF(),R=ORec(),RG=DATA.records.ghost||{w:0,l:0};
  const ps=Net.peers.filter(p=>p.kind==='viewer'),open=ps.filter(p=>p.presence&&p.presence.st==='open'&&p.presence.code&&!p.isMe),live=ps.filter(p=>p.presence&&p.presence.st==='live'&&p.presence.code);
  const st={idle:'로비',open:'상대 기다리는 중',live:'대전 중',spec:'관전 중'};
  return `${back('home')}<div class="hofhead"><div class="eyebrow">온라인</div><h2>온라인 아레나</h2><p>${Net.ok?`지금 접속 ${ps.length}명`:'접속 정보를 불러오는 중…'}</p></div>
  ${Net.ok?`<div class="panel"><div class="eyebrow">접속 중</div><div class="who">${ps.map(p=>`<span class="${p.isMe?'me':''}"><i class="dot ${p.presence&&p.presence.st||'idle'}"></i>${esc(p.isMe?'나':Net.nm(p.by))}<small>${st[p.presence&&p.presence.st]||'로비'}</small></span>`).join('')||'<span>나 혼자예요</span>'}</div></div>`:
    `<div class="panel"><p>실시간 대전과 관전은 claude.ai에서 이 게임을 연 사람들끼리 연결됩니다. 친구가 함께하려면 공유 메뉴에서 이 게임을 친구에게 공유해 주세요 (대전·채팅은 '참여' 권한 이상).</p></div>`}
  <div class="panel"><div class="eyebrow">내 온라인 선수</div>${fRowNet(me,'mine',`<button class="btn sm" data-act="nav" data-to="opick">바꾸기</button>`)}
   <div class="kv"><div><span>실시간 대전</span><b>${R.w}-${R.l}-${R.d}</b></div><div><span>고스트 대전</span><b>${RG.w}-${RG.l}</b></div><div><span>주간 우승</span><b>${DATA.records.weekly||0}</b></div></div></div>
  <div class="panel"><div class="eyebrow">실시간 1:1 대전</div><h3>대전 방</h3>
   ${open.length?open.map(p=>`<div class="oroomrow"><b>${esc(Net.nm(p.by))}</b><span>${p.presence.a?esc(p.presence.a.n)+' · '+clsName(p.presence.a.c)+' · '+p.presence.a.o:''}</span><button class="btn-go sm" data-act="oJoin" data-code="${esc(p.presence.code)}">도전하기</button></div>`).join(''):'<p class="mut">열린 방이 없어요. 방을 만들고 친구를 기다려 보세요.</p>'}
   <div class="row"><button class="btn-go" data-act="oHost" ${Net.ok?'':'disabled'}>방 만들기</button></div>
   <h3>지금 진행 중인 경기</h3>${live.length?live.map(p=>`<div class="oroomrow live"><b>🔴 LIVE</b><span>${p.presence.a?esc(p.presence.a.n):''} vs ${p.presence.b?esc(p.presence.b.n):''}</span><button class="btn sm" data-act="oSpec" data-code="${esc(p.presence.code)}">관전</button></div>`).join(''):'<p class="mut">진행 중인 경기가 없어요.</p>'}</div>
  <div class="modes">
   <button class="tile" data-act="ghOpen"><span class="tn">고스트 대전</span><span class="td">친구들이 올린 선수(고스트)와 언제든 대전. 내 선수도 올려두면 친구들이 내 고스트에게 도전합니다.</span><span class="tx">비동기 대전</span></button>
   <button class="tile" data-act="wtOpen"><span class="tn">주간 토너먼트</span><span class="td">매주 선수를 등록하면 월요일 0시에 대진이 열리고 결과가 공개됩니다.</span><span class="tx">${wkLabel(wkKey())}</span></button>
  </div>`};
V.opick=()=>{const cls=P.cls||(DATA.career?DATA.career.cls:'lw'),list=IC.byClass(cls).slice().sort((a,b)=>b.ovr-a.ovr);
  return `${back('online','← 온라인')}<div class="panel"><div class="eyebrow">온라인 선수 고르기</div><h2 class="big" style="font-size:clamp(24px,6vw,36px)">누구로 싸울까요?</h2>
  ${DATA.career?`<button class="frow" data-act="opickSet" data-id="me"><span class="rk"></span><canvas class="pt" data-pid="me" data-mode="bust"></canvas><span><span class="nm" style="display:block">${esc(DATA.career.name)} <span class="tag g">커리어</span></span></span><span class="ovr">${meData(DATA.career).ovr}</span></button>`:''}
  ${seg('opickCls',CLASSES.map(c=>c.id),cls,v=>clsName(v))}
  <div class="flist">${list.map(f=>frow(f,{act:'opickSet'})).join('')}</div></div>`};
A.opickCls=d=>{P.cls=d.v;render()};
A.opickSet=d=>{DATA.netF=d.id;save();go(P.back||'online')};
A.oHost=async()=>{try{const code=roomCode();const mr=await Net.joinMatch(code,'host');const f=miniF(myNetF());await mr.presence({role:'host',f,st:'wait',cfg:{rounds:3,sec:DATA.settings.roundSec}});Net.lobby('open',{code,a:fSum(f)});go('oroom')}catch(e){alertNet()}};
A.oJoin=async d=>{try{const mr=await Net.joinMatch(d.code,'guest');await new Promise(r=>setTimeout(r,500));const taken=Net.mpeers().some(p=>!p.isMe&&p.presence&&p.presence.role==='guest');
  if(taken){Net.role='spec';await mr.presence({role:'spec'})}else await mr.presence({role:'guest',f:miniF(myNetF())});go('oroom')}catch(e){alertNet()}};
A.oSpec=async d=>{try{const mr=await Net.joinMatch(d.code,'spec');await mr.presence({role:'spec'});go('oroom')}catch(e){alertNet()}};
A.oLeave=async()=>{removeOverlay();if(IC.Fight.S&&IC.Fight.S.mirror)IC.Fight.stop();stopLoop();between.hidden=true;await Net.leaveMatch();go('online')};
function alertNet(){Net.chat=[];go('online');setTimeout(()=>{const p=document.querySelector('.hofhead p');if(p)p.textContent='방에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'},50)}
V.oroom=()=>{if(!Net.mr)return `${back('online','← 온라인')}<div class="panel"><p>방에서 나왔어요.</p></div>`;
  const h=Net.peerRole('host')||(Net.role==='host'?{presence:{f:miniF(myNetF())},by:Net.uid,isMe:true}:null),g=Net.peerRole('guest'),specs=Net.mpeers().filter(p=>p.presence&&p.presence.role==='spec');
  const cfg=(h&&h.presence.cfg)||{rounds:3},live=h&&h.presence.st==='live';
  const card=(p,k,lab)=>p&&p.presence.f?`<div class="vsc ${k}"><canvas data-pid="net:${k}" data-mode="full" data-side="${k==='h'?'a':'b'}"></canvas><b>${esc(p.presence.f.name)}</b><small>${esc(Net.nm(p.by))} · ${clsName(p.presence.f.cls)} · OVR ${p.presence.f.ovr}</small><span class="tag">${lab}</span></div>`:`<div class="vsc wait"><div class="spin"></div><b>상대를 기다리는 중</b><small>방 코드 ${esc(Net.code)}</small></div>`;
  if(h&&h.presence.f)NETF.h=netF(h.presence.f,'h');if(g&&g.presence.f)NETF.g=netF(g.presence.f,'g');
  const host=Net.role==='host';
  return `<button class="back" data-act="oLeave">← 방 나가기</button><div class="panel"><div class="eyebrow">온라인 대전 방 · 코드 ${esc(Net.code)}${Net.role==='spec'?' · 관전 중':''}</div>
  <div class="vsbox">${card(h,'h','블루 코너 · 호스트')}<div class="vsx">VS</div>${card(g,'g','레드 코너 · 도전자')}</div>
  <p class="mut">관전 ${specs.length}명 · ${cfg.rounds}라운드${live?' · 경기 진행 중':''}</p>
  ${host?`<div class="field"><span class="lbl">라운드</span>${seg('oRounds',[3,5],cfg.rounds||3,v=>v+'라운드')}</div>
   <div class="row"><button class="btn-go" data-act="oStart" ${g?'':'disabled'}>${g?'경기 시작!':'도전자를 기다리는 중…'}</button></div>`
  :Net.role==='guest'?`<p>${live?'경기에 연결하는 중…':'호스트가 경기를 시작하면 바로 케이지로 들어갑니다.'}</p>`:`<div class="row">${live?'<button class="btn-go" data-act="oWatch">관전하기</button>':'<p>경기가 시작되면 관전 화면으로 넘어갑니다.</p>'}</div>`}
  </div><div class="panel"><div class="eyebrow">대기실 채팅</div><div class="rchat" id="rchat"></div><form class="crow" onsubmit="return false"><input id="roomin" maxlength="120" placeholder="메시지…" autocomplete="off"><button class="btn sm" data-act="oSay">보내기</button></form>
  <div class="cheers">${CHEERS.map(e=>`<button data-act="oCheer" data-e="${e}">${e}</button>`).join('')}</div><div class="nfloat static" id="nfloat"></div></div>`};
A.oSay=()=>{const i=$('#roomin');if(!i)return;netSay(i.value);i.value='';i.focus()};
A.oCheer=d=>netCheer(d.e);
A.oWatch=()=>{const h=Net.peerRole('host');if(h&&h.presence.s)startMirror(Net.role)};
A.oRounds=d=>{if(Net.mr&&Net.role==='host'){Net.mr.presence({cfg:{rounds:+d.v,sec:DATA.settings.roundSec}}).catch(()=>{});setTimeout(render,120)}};
A.oStart=()=>{const g=Net.peerRole('guest'),h=Net.peerRole('host');if(!g||!g.presence.f)return;const cfg=(h&&h.presence.cfg)||{rounds:3,sec:DATA.settings.roundSec};
  const a=myNetF(),b=netF(g.presence.f,'g');Net.ended=false;Net.lastInp=null;Net.gone=0;
  Net.mr.presence({st:'live'}).catch(()=>{});Net.lobby('live',{code:Net.code,a:fSum(a),b:fSum(b)});
  startFight({a,b,rounds:cfg.rounds,roundSec:cfg.sec||DATA.settings.roundSec,diff:'normal',online:'host',label:`온라인 대전 · ${Net.nm(g.by)}`,onResult:res=>netEnd(res)});
  netOverlay('host')};
V.oresult=p=>{const r=p.res||{},side=p.side,R=ORec(),win=side&&r.winner===side,lose=side&&r.winner&&r.winner!==side;
  const wn=r.winner==='a'?p.a:r.winner==='b'?p.b:null;if(p.a)NETF.ra=p.a;if(p.b)NETF.rb=p.b;
  return `<div class="panel"><div class="eyebrow">온라인 대전 결과</div><h2 class="big"><span class="${win?'g':''}">${side?win?'승리!':lose?'패배':'무승부':wn?esc(wn.nick)+' 승리':'무승부'}</span></h2>
  <div class="vsbox">${p.a?`<div class="vsc ${r.winner==='a'?'win':''}"><canvas data-pid="net:ra" data-mode="full" data-side="a"></canvas><b>${esc(p.a.name)}</b></div>`:''}<div class="vsx">${esc(r.method||'')}</div>${p.b?`<div class="vsc ${r.winner==='b'?'win':''}"><canvas data-pid="net:rb" data-mode="full" data-side="b"></canvas><b>${esc(p.b.name)}</b></div>`:''}</div>
  <p>${esc(r.detail||'')} · ${r.round||''}R ${esc(r.time||'')}</p>${side?`<div class="kv"><div><span>내 온라인 전적</span><b>${R.w}-${R.l}-${R.d}</b></div></div>`:''}
  <div class="row">${Net.mr?`<button class="btn-go" data-act="oBack">방으로 (재대결)</button>`:''}<button class="btn" data-act="oLeave">로비로</button></div></div>`};
A.oBack=()=>{IC.Fight.stop();Net.ended=false;if(Net.role==='host'&&Net.mr)Net.mr.presence({st:'wait',s:null}).catch(()=>{});go('oroom')};
/* ---------- ghosts ---------- */
let GH=null,GHERR='';
async function ghLoad(){GH=null;GHERR='';render();try{await Store.ready;if(!Store.db){GHERR='로그인한 상태에서만 고스트 대전을 할 수 있어요.';render();return}await Net.init();
  const [gs,rs]=await Promise.all([Store.db.collection('ghosts').get(),Store.db.collection('gres').get()]);
  const list=gs.docs.map(d=>({uid:d.id,...d.data()})).filter(x=>x.f);const res=[];rs.docs.forEach(d=>{const L=(d.data().L||[]);L.forEach(e=>res.push({...e,by:d.id}))});
  for(const g of list){const vs=res.filter(e=>e.o===g.uid);g.w=vs.filter(e=>!e.w).length;g.l=vs.filter(e=>e.w).length;g.vs=vs.sort((a,b)=>b.at-a.at)}
  Net.names4(list.map(x=>x.uid).concat(res.map(e=>e.by)));GH={list,res}}catch(e){GHERR='고스트 목록을 불러오지 못했어요.'}if(SCREEN==='ghost')render()}
A.ghOpen=()=>{go('ghost');if(!STANDALONE)ghLoad()};
V.ghost=()=>{if(STANDALONE)return offNote('고스트 대전','은');const me=myNetF();if(!GH)return `${back('online','← 온라인')}<div class="panel"><p>${GHERR||'고스트를 불러오는 중…'}</p></div>`;
  const mine=GH.list.find(g=>g.uid===Store.uid),others=GH.list.filter(g=>g.uid!==Store.uid).sort((a,b)=>(b.w-b.l)-(a.w-a.l));
  return `${back('online','← 온라인')}<div class="hofhead"><div class="eyebrow">온라인 · 비동기</div><h2>고스트 대전</h2><p>친구가 올려둔 선수와 AI 대전 · 이기면 고스트 사냥 점수</p></div>
  <div class="panel"><div class="eyebrow">내 고스트</div>${mine?fRowNet(mine.f,'gm',`<span class="tag ${mine.w>=mine.l?'g':''}">방어 ${mine.w}승 ${mine.l}패</span>`):'<p>아직 고스트를 올리지 않았어요.</p>'}
   <p class="mut">올릴 선수: ${esc(me.name)} (OVR ${me.ovr}) <button class="btn sm" data-act="nav" data-to="opick">바꾸기</button></p>
   <div class="row"><button class="btn-go" data-act="ghUp">${mine?'내 고스트 갱신':'내 고스트 올리기'}</button></div>
   ${mine&&mine.vs.length?`<h3>내 고스트에 도전한 사람</h3><div class="glog">${mine.vs.slice(0,8).map(e=>`<div><b>${esc(Net.nm(e.by))}</b> <span>${esc(e.f||'')}</span> ${e.w?'<span class="lose">고스트 패</span>':'<span class="win">고스트 승</span>'} <small>${esc(e.m||'')}</small></div>`).join('')}</div>`:''}</div>
  <div class="panel"><div class="eyebrow">도전할 고스트 ${others.length}</div>${others.length?others.map(g=>fRowNet(g.f,'g_'+g.uid,`<span class="gown">${esc(Net.nm(g.uid))}<small>${g.w}승 ${g.l}패</small></span><button class="btn-go sm" data-act="ghGo" data-u="${esc(g.uid)}">도전</button>`)).join(''):'<p class="mut">아직 다른 사람의 고스트가 없어요. 게임을 친구에게 공유하면 친구 고스트가 여기에 나타납니다.</p>'}
  <div class="row"><button class="btn" data-act="ghLoad">새로고침</button></div></div>`};
A.ghLoad=()=>ghLoad();
A.ghUp=async()=>{try{await Store.ready;if(!Store.db)return;await Store.db.collection('ghosts').doc(Store.uid).set({f:miniF(myNetF()),at:Date.now()});ghLoad()}catch(e){GHERR='고스트를 올리지 못했어요.';render()}};
A.ghGo=d=>{const g=GH&&GH.list.find(x=>x.uid===d.u);if(!g)return;const a=myNetF(),b={...netF(g.f,'gx'),id:'gh_'+d.u.slice(0,10)},who=Net.nm(d.u),label=`고스트 대전 · ${who}의 ${g.f.name}`;
  startFight({a,b,rounds:3,diff:'hard',label,onResult:async res=>{const won=res.winner==='a',RG=DATA.records.ghost=DATA.records.ghost||{w:0,l:0};if(won)RG.w++;else if(res.winner)RG.l++;save();
    try{const ref=Store.db.collection('gres').doc(Store.uid),cur=await ref.get(),L=((cur.exists&&cur.data().L)||[]).slice(0,39);L.unshift({o:d.u,w:won,m:`${res.method} ${res.round}R`,f:a.name,at:Date.now()});await ref.set({L})}catch(e){}
    go('result',{res,label,extra:`<div class="advice">${won?`👻 ${esc(who)}의 고스트를 잡았습니다! 고스트 사냥 ${RG.w}승`:`${esc(who)}의 고스트가 방어에 성공했습니다.`}</div>`,cont:[['고스트 목록','ghOpen'],['온라인 로비','nav:online']]})}})};
/* ---------- weekly tournament ---------- */
const DAY=86400000;
function wkKey(t=Date.now()){const k=new Date(t+9*3600000),dn=(k.getUTCDay()+6)%7,m=new Date(Date.UTC(k.getUTCFullYear(),k.getUTCMonth(),k.getUTCDate()-dn));return m.toISOString().slice(0,10)}
const wkPrev=(k,n=1)=>new Date(Date.parse(k)-7*DAY*n).toISOString().slice(0,10);
const wkLabel=k=>{const d=new Date(Date.parse(k));return `${d.getUTCMonth()+1}월 ${d.getUTCDate()}일 주`};
const wkEnd=k=>Date.parse(k)+7*DAY-9*3600000;
const mulberry=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
function wtBracket(wk,entries){const rng=mulberry(IC.hash('wt'+wk));const E=entries.slice().sort((a,b)=>a.uid<b.uid?-1:1).slice(0,16);const size=E.length>8?16:8;
  const pool=ROSTER.filter(f=>!f.legend&&f.ovr>=70).slice().sort((a,b)=>a.id<b.id?-1:1),slots=E.map(e=>({f:e.f,uid:e.uid}));
  while(slots.length<size){const f=pool[Math.floor(rng()*pool.length)];if(!slots.some(s=>s.f.id===f.id))slots.push({f,cpu:true})}
  for(let i=slots.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]]}
  const rounds=[];let cur=slots,mi=0;const mr=Math.random;
  try{while(cur.length>1){const ms=[],nx=[];for(let i=0;i<cur.length;i+=2){const A0=cur[i],B0=cur[i+1];Math.random=mulberry(IC.hash(wk+':'+(mi++)));const r=IC.Fight.sim(A0.f,B0.f,cur.length===2?5:3);Math.random=mr;const w=r.winner==='a'?A0:B0;ms.push({a:A0,b:B0,w,r});nx.push(w)}rounds.push(ms);cur=nx}}finally{Math.random=mr}
  return{rounds,champ:cur[0],size}}
let WT=null,WTERR='';
async function wtLoad(){WT=null;WTERR='';render();try{await Store.ready;if(!Store.db){WTERR='로그인한 상태에서만 주간 토너먼트에 참가할 수 있어요.';render();return}await Net.init();
  const s=await Store.db.collection('wtour').get();const docs=s.docs.map(d=>({uid:d.id,...d.data()}));const now=wkKey(),p1=wkPrev(now),p2=wkPrev(now,2);
  const ent=k=>docs.filter(d=>d.e&&d.e[k]&&d.e[k].f).map(d=>({uid:d.uid,f:d.e[k].f,at:d.e[k].at}));
  WT={now,p1,p2,cur:ent(now),b1:ent(p1).length?wtBracket(p1,ent(p1)):null,b2:ent(p2).length?wtBracket(p2,ent(p2)):null,mine:docs.find(d=>d.uid===Store.uid)};
  Net.names4(docs.map(d=>d.uid));
  for(const [k,b] of [[p1,WT.b1],[p2,WT.b2]])if(b&&b.champ.uid===Store.uid&&!(DATA.wtClaim||{})[k]){DATA.wtClaim=DATA.wtClaim||{};DATA.wtClaim[k]=1;DATA.records.weekly=(DATA.records.weekly||0)+1;DATA.records.money=(DATA.records.money||0);save();WT.claimed=k}}
  catch(e){WTERR='주간 토너먼트를 불러오지 못했어요.'}if(SCREEN==='wtour')render()}
A.wtOpen=()=>{go('wtour');if(!STANDALONE)wtLoad()};A.wtLoad=()=>wtLoad();
A.wtJoin=async()=>{try{await Store.ready;if(!Store.db)return;const ref=Store.db.collection('wtour').doc(Store.uid),cur=await ref.get(),e={...((cur.exists&&cur.data().e)||{})},keep=[wkKey(),wkPrev(wkKey()),wkPrev(wkKey(),2)];
  for(const k of Object.keys(e))if(!keep.includes(k))delete e[k];e[wkKey()]={f:miniF(myNetF()),at:Date.now()};await ref.set({e});wtLoad()}catch(e){WTERR='등록하지 못했어요.';render()}};
const wtName=s=>s.cpu?`${esc(s.f.name)} <small class="mut">CPU</small>`:`${esc(s.f.name)} <small class="mut">${esc(Net.nm(s.uid))}</small>`;
function wtBracketHtml(b,k){const RN=b.size===16?['16강','8강','준결승','결승']:['8강','준결승','결승'];NETF['wc'+k]=b.champ.f;
  return `<div class="wtchamp"><canvas data-pid="net:wc${k}" data-mode="bust"></canvas><div><div class="eyebrow">${wkLabel(k)} 우승</div><b>${b.champ.cpu?esc(b.champ.f.name):esc(b.champ.f.name)}</b><small>${b.champ.cpu?'CPU 선수':esc(Net.nm(b.champ.uid))}${b.champ.uid===Store.uid?' · 🏆 나!':''}</small></div></div>
  <div class="wtb">${b.rounds.map((ms,i)=>`<div class="wtr"><div class="eyebrow">${RN[i]}</div>${ms.map(m=>`<div class="wtm"><div class="${m.w===m.a?'w':''}${m.a.uid===Store.uid?' me':''}">${wtName(m.a)}</div><div class="${m.w===m.b?'w':''}${m.b.uid===Store.uid?' me':''}">${wtName(m.b)}</div><small>${esc(m.r.method)} · ${m.r.round}R</small></div>`).join('')}</div>`).join('')}</div>`}
V.wtour=()=>{if(STANDALONE)return offNote('주간 토너먼트','는');if(!WT)return `${back('online','← 온라인')}<div class="panel"><p>${WTERR||'불러오는 중…'}</p></div>`;
  const left=wkEnd(WT.now)-Date.now(),dd=Math.floor(left/DAY),hh=Math.floor(left%DAY/3600000),me=myNetF(),reg=WT.cur.find(e=>e.uid===Store.uid);
  return `${back('online','← 온라인')}<div class="hofhead"><div class="eyebrow">온라인 · 매주 월요일 0시 마감</div><h2>주간 토너먼트</h2><p>${wkLabel(WT.now)} · 마감까지 ${dd}일 ${hh}시간</p></div>
  ${WT.claimed?`<div class="panel champcard"><div class="cc-no">🏆</div><div><b>${wkLabel(WT.claimed)} 주간 토너먼트 우승!</b><span>리더보드 점수 +80 · 통산 주간 우승 ${DATA.records.weekly}회</span></div></div>`:''}
  <div class="panel"><div class="eyebrow">이번 주 참가자 ${WT.cur.length}명</div>
   ${WT.cur.length?WT.cur.map(e=>fRowNet(e.f,'wn_'+e.uid,`<span class="gown">${esc(Net.nm(e.uid))}</span>`)).join(''):'<p class="mut">아직 등록한 사람이 없어요. 첫 번째로 등록해 보세요.</p>'}
   <p class="mut">${reg?`등록 완료: ${esc(reg.f.name)}. 마감 전까지 선수를 바꿀 수 있어요.`:`등록할 선수: ${esc(me.name)} (OVR ${me.ovr})`} <button class="btn sm" data-act="nav" data-to="opick">선수 바꾸기</button></p>
   <div class="row"><button class="btn-go" data-act="wtJoin">${reg?'선수 다시 등록':'이번 주 토너먼트 등록'}</button><button class="btn" data-act="wtLoad">새로고침</button></div>
   <p class="mut" style="font-size:12px">마감되면 참가자와 CPU 강자들로 8강(9명 이상이면 16강) 대진이 짜이고, 모든 사람에게 같은 결과가 공개됩니다.</p></div>
  ${WT.b1?`<div class="panel"><div class="eyebrow">지난주 결과</div>${wtBracketHtml(WT.b1,WT.p1)}</div>`:''}
  ${WT.b2?`<div class="panel"><div class="eyebrow">2주 전 결과</div>${wtBracketHtml(WT.b2,WT.p2)}</div>`:''}`};

IC._career={careerResult:r=>careerResult(r),makeOffers:c=>makeOffers(c),get:()=>DATA.career};
/* ---------- KO 명장면 앨범 (픽셀 GIF 5슬롯) ---------- */
function toast(t){const el=document.createElement('div');el.className='toast';el.textContent=t;document.body.appendChild(el);setTimeout(()=>el.classList.add('on'),20);setTimeout(()=>{el.classList.remove('on');setTimeout(()=>el.remove(),400)},2600)}
if(IC.KO)IC.KO.Album.onSaved=r=>{if(r&&r.saved)toast('📼 KO 명장면이 앨범에 저장됐어요')};
let ALB=null,ALBURL=[];
V.album=()=>{const L=ALB||[];ALBURL.forEach(u=>URL.revokeObjectURL(u));ALBURL=[];
  const slot=(c,i)=>{if(!c)return `<div class="aslot empty"><span>${i+1}</span><p>빈 슬롯</p></div>`;const u=URL.createObjectURL(c.blob);ALBURL.push(u);const d=new Date(c.date);
    return `<div class="aslot"><img src="${u}" alt="${esc(c.win)}의 ${esc(c.method)} 장면"><div class="ai"><b>${i+1}. ${esc(c.win)} · ${esc(c.method)}</b><span>${esc(c.detail||'')} · ${c.round}R ${esc(c.time||'')}</span><span>vs ${esc(c.lose)} · ${d.getMonth()+1}/${d.getDate()}</span></div><button class="btn sm" data-act="albDel" data-id="${c.id}">삭제</button></div>`};
  return `${back('home')}<div class="panel"><div class="eyebrow">KO 명장면 앨범</div><h2 class="big">픽셀 하이라이트</h2>
  <p>KO·TKO·서브미션 피니시 직전 3초가 자동으로 녹화돼 레트로 픽셀 GIF로 저장됩니다. 점수가 높은 상위 5개 장면만 남아요. (이 기기에 저장)</p>
  <div class="album">${Array.from({length:IC.KO?IC.KO.SLOTS:5},(_,i)=>slot(L[i],i)).join('')}</div></div>`};
A.albDel=async d=>{if(!IC.KO)return;await IC.KO.Album.remove(+d.id);ALB=await IC.KO.Album.list();render()};
async function openAlbum(){ALB=IC.KO?await IC.KO.Album.list():[];go('album')}
A.album=()=>openAlbum();
/* ---------- 3D 시네마틱: 경기 화면의 WebGL 캔버스를 빌려 메뉴 안에서 3D 장면을 그린다 ---------- */
let CINE=null;
function startCine(host,C,o={}){stopCine();if(!host||!IC.R3D||!IC.R3D.init(gl))return false;
  host.appendChild(gl);gl.hidden=false;gl.classList.add('cinegl');C.t=0;const t0=performance.now();
  CINE={host,C,o,raf:0};const fr=now=>{if(!CINE||CINE.C!==C)return;C.t=(now-t0)/1000*60;if(o.tick)o.tick(C);
    const w=host.clientWidth,h=host.clientHeight;if(w&&h)try{IC.R3D.renderCine(C,w,h)}catch(e){console.error(e);stopCine();return}
    if(o.dur&&C.t>=o.dur){const f=o.onEnd;stopCine();f&&f();return}CINE.raf=requestAnimationFrame(fr)};
  CINE.raf=requestAnimationFrame(fr);return true}
function stopCine(){if(!CINE)return;cancelAnimationFrame(CINE.raf);CINE=null;homeGl()}
function homeGl(){gl.classList.remove('cinegl');if(gl.parentElement!==$('#stage'))$('#stage').insertBefore(gl,cv);gl.hidden=true}
function releaseGl(){stopCine();if(W3){W3=null;cancelAnimationFrame(wRaf)}homeGl()}
function runPress(){const h=$('#pressHost'),c=DATA.career;if(!h||!c||!c.fight)return;const f=getF(c.fight.opp,c);if(!startCine(h,{set:'press',a:meData(c),b:f,speaker:'b'},{tick:C=>{C.speaker=Math.floor(C.t/260)%2?'a':'b'}}))h.remove()}
function heroFighter(){const c=DATA.career;if(c)try{return meData(c)}catch(e){}return IC.byClass('lw').slice().sort((a,b)=>b.ovr-a.ovr)[0]}
/* ---------- 타이틀 인트로: 전광판·스포트라이트 아레나 + 스틸 로고 + TAP TO START → 3D 벨트 세레머니 ---------- */
function showTitle(){
  const el=document.createElement('div');el.id='titleScr';el.innerHTML='<div class="tHost" id="tHost"></div><div class="tShade"></div><div class="tLogo"><span>IRON</span><span>CAGE</span></div><div class="tTap">TAP TO START</div><div class="tSub">아이언 케이지</div><button class="tSkip" hidden>건너뛰기 ⏭</button>';
  document.body.appendChild(el);document.body.classList.add('titling');
  const C={set:'title',a:heroFighter(),hype:false};const has3d=startCine($('#tHost'),C,{keep:true});
  if(!has3d)el.classList.add('flat');
  let phase='title';
  const finish=()=>{if(phase==='done')return;phase='done';stopCine();el.classList.add('out');document.body.classList.remove('titling');setTimeout(()=>el.remove(),450);const keep=!!Sound._mus;go('home');if(!keep)homeMusic(true)};
  el.querySelector('.tSkip').addEventListener('click',e=>{e.stopPropagation();finish()});
  el.addEventListener('pointerdown',()=>{if(phase!=='title')return;phase='belt';Sound.on=true;Sound.init();
    el.classList.add('belt');el.querySelector('.tSkip').hidden=false;
    if(!has3d){/* 2D: TAP TO START → the last 10 seconds of a title fight (tap to land the finisher) → championship belt ceremony */
      const host=$('#tHost'),cvb=document.createElement('canvas');cvb.style.cssText='position:absolute;inset:0;width:100%;height:100%';host.appendChild(cvb);el.classList.remove('flat');el.classList.add('beltflat');
      const c2=cvb.getContext('2d'),B=IC.Draw.BELT,KI=IC.Draw.KOI,d=C.a,cls=clsName(d.cls),fired={},once=(k,f)=>{if(!fired[k]){fired[k]=1;try{f()}catch(e){}}},END=B.lift+170,SPD=1.55;
      const cm=x=>(IC.CLSMAP||{})[x]||x,opp=ROSTER.filter(f=>cm(f.cls)===cm(d.cls)&&f.id!==d.id).sort((x,y)=>y.ovr-x.ovr)[0]||ROSTER[1];
      let mode='ko',p0=performance.now(),t0=0,hitAt=null,pNow=0,lastBeat=-1;
      try{Sound.music(false);Sound.roar(.45)}catch(e){}
      const doHit=()=>{if(hitAt!=null||mode!=='ko')return;hitAt=pNow;try{Sound.play('whoosh');if(IC.Haptic)IC.Haptic.tap()}catch(e){}
        setTimeout(()=>{try{Sound.play('big');Sound.play('slam');Sound.roar(1);Sound.applause(6,.09);if(IC.Haptic)IC.Haptic.play([45,30,110,40,70])}catch(e){}},KI.hit/(60*1.35)*1000);
        setTimeout(()=>{try{Sound.play('ko')}catch(e){}},700)};
      el.addEventListener('pointerdown',()=>{if(phase==='belt')doHit()});
      const fr=now=>{if(phase!=='belt')return;
        const dpr=Math.min(2.5,devicePixelRatio||1),w=cvb.clientWidth,h=cvb.clientHeight;if(cvb.width!==Math.round(w*dpr)){cvb.width=Math.round(w*dpr);cvb.height=Math.round(h*dpr)}
        c2.setTransform(cvb.width/800,0,0,cvb.width/800,0,0);
        if(mode==='ko'){pNow=(now-p0)/1000*60*1.35;
          if(hitAt==null){const bt=Math.floor(pNow/34);if(bt!==lastBeat){lastBeat=bt;try{Sound.play('heart')}catch(e){}}if(pNow>420)doHit()}
          try{IC.Draw.koScene(c2,w,h,pNow,d,opp,hitAt)}catch(e){console.error(e);mode='belt';t0=now}
          if(hitAt!=null&&pNow-hitAt>=KI.end){mode='belt';t0=now}
          requestAnimationFrame(fr);return}
        const t=(now-t0)/1000*60*SPD;
        once('a',()=>Sound.roar(.3));if(t>=B.reveal)once('rv',()=>{Sound.sting(true);Sound.roar(.7);Sound.applause(4);Sound.music(true,Object.assign({},HOME_THEME,{vol:.42}))});if(t>=B.close)once('cl',()=>Sound.play('reveal'));
        if(t>=B.wrap)once('wr',()=>Sound.applause(5,.07));if(t>=B.lift)once('lf',()=>{Sound.noise(.9,'lowpass',220,1);Sound.roar(.8);Sound.applause(6,.08);if(IC.Haptic)IC.Haptic.play([30,30,60])});
        try{IC.Draw.beltScene(c2,w,h,Math.min(t,END),d,cls,{opp})}catch(e){console.error(e);finish();return}
        if(t>=END){finish();return}requestAnimationFrame(fr)};
      requestAnimationFrame(fr);return}
    try{Sound.play('reveal');setTimeout(()=>{try{Sound.roar(.7);Sound.applause(5,.08)}catch(e){}},900)}catch(e){}
    const B={set:'belt',a:C.a,hype:true};startCine($('#tHost'),B,{keep:true,dur:330,onEnd:finish,tick:c=>{if(c.t>60&&!c.cap){c.cap=1;el.querySelector('.tTap').textContent=(DATA.career?'챔피언 ':'')+(c.a.nick||'')}}})});
}
/* ---------- 가로 화면 안내 · 첫 터치 전체화면 ---------- */
const gate=$('#rotateGate');
/* animated gate: a fighter kicks the phone into landscape; tap to replay the kick; tips rotate underneath */
let gateRaf=0,gateT=0,gateLast=0,gateF=null,gateTipI=0,gateTipT=0;
const GTIPS=['휴대폰을 옆으로 돌리면 경기가 시작됩니다','넓은 화면에서 거리 싸움이 보입니다','양손으로 잡으면 조이스틱과 버튼이 딱 맞습니다','세로는 기자회견용, 경기는 가로로','상대가 기다리고 있습니다. 돌려 주세요'];
function gateLoop(now){if(gate.hidden){gateRaf=0;return}const cv=$('#gateCv');if(!cv){gateRaf=0;return}
  const dt=gateLast?Math.min(50,now-gateLast):16;gateLast=now;gateT+=dt/16.67;
  const dpr=Math.min(2.5,devicePixelRatio||1),w=cv.clientWidth,h=cv.clientHeight;if(cv.width!==Math.round(w*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
  const T=gateT%IC.Draw.GATE.loop,prevT=(gateT-dt/16.67)%IC.Draw.GATE.loop;if(prevT<IC.Draw.GATE.hit&&T>=IC.Draw.GATE.hit){try{if(Sound.ac)Sound.play('hit')}catch(e){}}
  try{IC.Draw.gateScene(c,w,h,gateT,gateF||(gateF=heroFighter()))}catch(e){console.error(e);gateRaf=0;return}
  gateTipT+=dt;if(gateTipT>3200){gateTipT=0;const s=$('#gateTip');if(s){s.style.opacity=0;setTimeout(()=>{gateTipI=(gateTipI+1)%GTIPS.length;s.textContent=GTIPS[gateTipI];s.style.opacity=1},350)}}
  gateRaf=requestAnimationFrame(gateLoop)}
gate&&gate.addEventListener('pointerdown',()=>{const T=gateT%IC.Draw.GATE.loop;gateT=gateT-T+62;try{Sound.init();if(IC.Haptic)IC.Haptic.tap()}catch(e){}});
function gateStart(){if(!gateRaf&&gate&&!gate.hidden){gateLast=0;gateT=20;gateF=null;gateRaf=requestAnimationFrame(gateLoop)}}
function checkOrient(){const portrait=window.innerHeight>window.innerWidth;if(!gate)return;const was=!gate.hidden;gate.hidden=!portrait;if(portrait)gateStart();
  if(portrait&&!was){if(JOY)JOY.reset();heldKeys={};
    const S=IC.Fight.S;if(!game.hidden&&S&&between.hidden&&!(CFG&&CFG.online)&&['fight','intro'].includes(S.mode))openPause()}}
addEventListener('resize',checkOrient);addEventListener('orientationchange',()=>setTimeout(checkOrient,120));checkOrient();
{let fsTried=false;const firstTouch=()=>{if(fsTried)return;fsTried=true;removeEventListener('pointerdown',firstTouch,true);
  const el=document.documentElement;if(document.fullscreenElement||!el.requestFullscreen)return;try{const p=el.requestFullscreen({navigationUI:'hide'});if(p&&p.catch)p.catch(()=>{})}catch(e){}};
  addEventListener('pointerdown',firstTouch,true)}
/* ---------- boot ---------- */
Store.init();Net.init();
const loc=Store.local();if(loc&&loc.v===3)DATA=Object.assign(D0(),loc);
if(!DATA.settings.wk2){DATA.settings.wk2=1;DATA.settings.walkout=true}
DATA.settings.sound=true;DATA.settings.voiceOn=false;Sound.on=true;loadCustom();
topinfo();go('home');try{showTitle()}catch(e){console.error(e)}
Store.load().then(d=>{if(d&&d.v===3&&(d.at||0)>(DATA.at||0)){DATA=Object.assign(D0(),d);DATA.settings.sound=true;DATA.settings.voiceOn=false;if(!DATA.settings.wk2){DATA.settings.wk2=1;DATA.settings.walkout=true}loadCustom();topinfo();if(SCREEN==='home'&&game.hidden)render()}});
})(window.IC);

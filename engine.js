/* 아이언 케이지 — 전투 엔진 */
(function(IC){
const W=800,H=450,GY=384;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
const wpick=opts=>{const t=opts.reduce((s,o)=>s+Math.max(0,o[1]),0);if(t<=0)return null;let r=Math.random()*t;for(const [k,w] of opts){if((r-=Math.max(0,w))<=0)return k}return opts[opts.length-1][0]};
const {MV,SPM,TD,SUBS,STYLES}=IC;

const DMG=.5,GDMG=.3;
/* wild match only: hold guard + jab = eye poke, hold guard + kick = low blow */
const XM={calf:{id:'calf',name:'카프킥',anim:'lowkick',target:'leg',kick:true,w:8,a:5,r:13,range:98,dmg:6,st:7,kb:2}};
const WILDM={eyepoke:{...MV.jab,id:'eyepoke',name:'눈 찌르기',anim:'jab',dmg:1.5,st:5,foulK:'poke'},lowblow:{...MV.lowkick,id:'lowblow',name:'로블로',anim:'lowkick',target:'body',dmg:3,st:9,foulK:'groin'}};
const DIFF={
  easy:{label:'루키',think:22,react:.16,mash:.058,mul:.9},
  normal:{label:'프로',think:15,react:.36,mash:.085,mul:1.06},
  hard:{label:'챔피언',think:9,react:.56,mash:.11,mul:1.13},
  legend:{label:'레전드',think:6,react:.74,mash:.135,mul:1.2},
  hof:{label:'명예의 전당',think:3,react:.93,mash:.165,mul:1.26,sprawl:.62,parry:.5}
};
const POSN=['풀 가드','하프 가드','사이드 컨트롤','마운트','백 마운트','프론트 헤드락'];
const GNP=[.8,1,1.15,1.5,1.35,1.05];
const GA={
  g_pound:{name:'파운딩',w:7,r:9,st:3,dmg:5,target:'head'},
  g_elbow:{name:'엘보',w:12,r:15,st:6,dmg:8,target:'head'},
  g_bodyp:{name:'바디 파운딩',w:8,r:10,st:4,dmg:6,target:'body'},
  g_hammer:{name:'해머피스트',w:9,r:11,st:4,dmg:6.5,target:'head'},
  g_pass:{name:'패스',w:14,r:10,st:8},
  g_back:{name:'백 테이크',w:16,r:12,st:9},
  g_sub:{name:'서브미션',w:12,r:10,st:10},
  g_stand:{name:'일어서기',w:16,r:6,st:4},
  g_power:{name:'파워 파운딩',w:14,r:16,st:0,dmg:15,target:'head',special:true},
  g_soccer:{name:'사커킥',w:15,r:16,st:9,dmg:12,target:'head',wild:true},
  b_punch:{name:'펀치',w:6,r:10,st:2,dmg:2.6,target:'head'},
  b_elbow:{name:'엘보',w:9,r:12,st:4,dmg:4,target:'head'},
  b_sweep:{name:'스윕',w:14,r:14,st:9},
  b_regard:{name:'리가드',w:12,r:10,st:7},
  b_getup:{name:'일어나기',w:20,r:8,st:10},
  b_sub:{name:'서브미션',w:12,r:10,st:10}
};
const CA={
  c_short:{name:'숏 펀치',w:5,r:8,st:3,dmg:4.5,target:'head'},
  c_elbow:{name:'엘보',w:9,r:13,st:7,dmg:8.5,target:'head'},
  c_knee:{name:'바디 니킥',w:9,r:12,st:7,dmg:8,target:'body',kick:true},
  c_kneeH:{name:'헤드 니킥',w:12,r:14,st:9,dmg:10.5,target:'head',kick:true},
  c_thigh:{name:'허벅지 니킥',w:7,r:10,st:5,dmg:6,target:'leg',kick:true},
  c_cage:{name:'케이지 압박',w:14,r:10,st:6},
  c_rev:{name:'포지션 역전',w:14,r:12,st:8},
  c_trip:{name:'클린치 TD',w:14,r:12,st:10},
  c_brk:{name:'브레이크',w:10,r:8,st:4},
  c_hbutt:{name:'헤드버트',w:9,r:13,st:7,dmg:10,target:'head',wild:true}
};
const TOP_SUBS=[['아킬레스 홀드','힐 훅'],['기무라','다스 초크','아나콘다 초크'],['아메리카나','암 트라이앵글','기무라','본 플루 초크'],['암바','암 트라이앵글','에제키엘 초크','아메리카나'],['리어 네이키드 초크','숏 초크','넥 크랭크'],['길로틴 초크','다스 초크','아나콘다 초크']];
const BOT_SUBS=[['트라이앵글 초크','암바','길로틴 초크','오모플라타','기무라'],['니바','힐 훅','카프 슬라이서'],[],[],[],[]];
/* which family each hold belongs to: drives the pose and which styles favour it */
const SUBK={'리어 네이키드 초크':'back','숏 초크':'back','넥 크랭크':'back','암바':'arm','기무라':'arm','아메리카나':'arm','오모플라타':'arm','암 트라이앵글':'front','다스 초크':'front','아나콘다 초크':'front','길로틴 초크':'front','본 플루 초크':'front','에제키엘 초크':'neck','트라이앵글 초크':'tri','힐 훅':'leg','니바':'leg','카프 슬라이서':'leg','아킬레스 홀드':'leg'};
function subPick(F,list){const st=F.d.style;return wpick(list.map(n=>{const k=SUBK[n];let w=1;if(st==='sambo'&&k==='leg')w=3;if(st==='bjj'&&(k==='back'||k==='tri'||k==='arm'))w=2;if(st==='wrestler'&&(k==='front'||k==='neck'))w=2;if(k==='leg'&&st!=='sambo'&&st!=='bjj')w=.5;return[n,w]}))}

let S=null;
const newR=()=>({sigA:0,sigL:0,headL:0,bodyL:0,legL:0,dH:0,dB:0,dL:0,td:0,tdA:0,kd:0,ctrl:0,subA:0});
const add=(F,k,v)=>{F.r[k]+=v;F.tot[k]+=v};
const sv=(F,k)=>F.s[k];
const stMax=F=>100-(100-F.body)*.4;
const legF=F=>.5+.5*F.legs/100;
/* weight-class physics: light classes are quick and cheap on gas but hit softer; heavy classes are slower but every shot can end it */
const CPHYS={fly:{spd:1.25,pow:.84,st:.8,ko:.82},fw:{spd:1.25,pow:.88,st:.82,ko:.86},lw:{spd:1,pow:1,st:1,ko:1},ww:{spd:1,pow:1.03,st:1,ko:1.05},mw:{spd:.8,pow:1.2,st:1.06,ko:1.25},hw:{spd:.8,pow:1.28,st:1.1,ko:1.38}};
const CLSMAP={bw:'fw',lhw:'hw'};
const cpOf=d=>CPHYS[CLSMAP[d.cls]||d.cls]||CPHYS.lw;
/* separate left/right leg health: legs (the old single value) always mirrors the worse leg */
const leadLeg=F=>F.stance==='south'?'R':'L',rearLeg=F=>F.stance==='south'?'L':'R';
function syncLegs(F){F.legs=Math.min(F.lgL,F.lgR)}
function setLegs(F,v){F.lgL=F.lgR=v;F.legs=v}
const weakLeg=F=>Math.min(F.lgL??100,F.lgR??100)<30;
/* haptics: only for the person holding the phone (navigator.vibrate is not available on iPhone Safari; Android vibrates) */
function buzz(p){if(!S||S.demo||S.spec)return;try{if(navigator.vibrate)navigator.vibrate(p)}catch(e){}}
const STRONG=new Set([/* escapes (get up, re-guard) stay allowed when exhausted */'cross','hook','upper','midkick','highkick','special','td','clinch','overhand','superman','spinfist','spinkick','flyknee','qmark','lowblow','c_elbow','c_kneeH','c_trip','c_cage','c_rev','c_hbutt','g_elbow','g_power','g_pass','g_back','g_sub','g_soccer','b_sweep','b_sub']);
function exhausted(F,id){if(!F.exh||!STRONG.has(id))return false;if(F===S.p)floatText(F.x,166,'탈진! 강공격·그랩 불가','#8e97a6');return true}
function upExh(F){if(!F.exh&&F.st<=1&&S.mode==='fight'){F.exh=true;floatText(F.x,150+zy(F),'탈진','#c0c6d0');if(Math.random()<.6)say(`${F.nick}, 완전히 지쳤습니다! 숨을 헐떡입니다`);sweat(F.x,200,10)}
  else if(F.exh&&F.st>=15){F.exh=false;if(F===S.p)floatText(F.x,150+zy(F),'호흡 회복','#9fe0a8')}}
const ZY=.35,LANE=28,zy=F=>(F.z||0)*ZY;
/* dynamic arena scaling: the higher the stakes, the bigger the octagon, the denser the crowd and the louder the roar */
const ARENAS=[
  {k:'practice',name:'체육관 연습장',r:250,crowd:.1,rows:3,beams:1,beamA:.05,roar:.18,flash:0,att:'관중 없음'},
  {k:'regional',name:'지역 대회장',r:286,crowd:.16,rows:5,beams:2,beamA:.07,roar:.4,flash:0,att:'관중 300명'},
  {k:'main',name:'IRON CAGE 넘버링 이벤트',r:318,crowd:.82,rows:9,beams:3,beamA:.1,roar:1,flash:2,att:'관중 9,500명'},
  {k:'title',name:'타이틀전 메인이벤트',r:356,crowd:1,rows:12,beams:5,beamA:.15,roar:1.7,flash:5,att:'관중 19,800명 · 매진'},
  {k:'prelim',name:'IRON CAGE 언더카드',r:306,crowd:.42,rows:7,beams:2,beamA:.09,roar:.7,flash:1,att:'관중 3,500명'}];
const cageR=()=>(S&&S.arena?S.arena.r:318)-36;
/* keep fighters inside the octagon's flat walls (apothem 294) with room for the body, not inside a circle that pokes past the fence */
const cageApo=()=>(S&&S.arena?S.arena.r:318)*Math.cos(Math.PI/8)-30;
function inCage(F){const C=S.cage;for(let k=0;k<8;k++){const a=C.ang+k*Math.PI/4,nx=Math.cos(a),nz=Math.sin(a),dx=F.x-C.x,dz=(F.z||0)-C.z,p=dx*nx+dz*nz,AP=cageApo();if(p>AP){F.x-=nx*(p-AP);F.z=(F.z||0)-nz*(p-AP)}}}
/* orbit camera: the engine works in camera space. While nobody is mid-strike the frame turns so the fighters stay side-on
   to the camera and recentres on their midpoint; the cage, referee and stains are carried along. */
function camFrame(){
  const a=S.a,b=S.b,C=S.cage;
  /* the arena only turns while someone is actually circling; forward/back steps and collisions leave it still */
  const busy=[a,b].some(F=>F.state==='attack'||F.state==='hit'||F.state==='slip');
  const circling=Math.abs(a.moveZ||0)>.15||Math.abs(b.moveZ||0)>.15;
  const dx=b.x-a.x,dz=(b.z||0)-(a.z||0);
  let al=0;if(!busy&&circling&&Math.abs(dx)>18&&Math.abs(dz)>3)al=clamp(Math.atan(dz/dx)*.12,-.02,.02);
  const mx=(a.x+b.x)/2,mz=((a.z||0)+(b.z||0))/2;
  if(!al)return;
  /* keep the pair on the camera's depth line, but only drift there slowly */
  const tx=0,tz=al?(0-mz)*.08:(0-mz)*.03,co=Math.cos(-al),si=Math.sin(-al);
  const tf=P=>{const x=P.x-mx,z=(P.z||0)-mz;P.x=mx+tx+x*co-z*si;P.z=mz+tz+x*si+z*co};
  tf(a);tf(b);tf(C);if(S.ref)tf(S.ref);
  C.ang-=al;S.camTheta+=al;
}
const other=F=>F===S.a?S.b:S.a;

function mkRun(d,side){
  return{d,s:d.s,name:d.name,nick:d.nick,side,look:d.look,ai:STYLES[d.style].ai,corner:side==='a'?'#3d7ff0':'#e04a3a',
    x:side==='a'?250:550,z:0,moveZ:0,f:side==='a'?1:-1,head:100,body:100,legs:100,lgL:100,lgR:100,stance:d.stance||(IC.hash&&IC.hash(String(d.id||d.name))%6===0?'south':'orth'),swT:0,exh:false,cp:cpOf(d),st:100,meter:0,
    state:'idle',t:0,A:null,hitDone:false,stun:0,vx:0,walk:0,blockHeld:false,moveDir:0,slot:null,bufT:0,stMul:1,
    koT:0,flash:0,rocked:0,ctrW:0,think:30,blockT:0,queue:[],g:{act:null,t:0,A:null},mul:1,
    reach:d.reach||185,r:newR(),tot:newR(),cuts:0}
}

/* ---------- effects ---------- */
function NL(...e){if(S&&S.net){S.nseq=(S.nseq||0)+1;S.nl.push([S.nseq,...e]);if(S.nl.length>24)S.nl.shift()}}
function burst(x,y,n,col){NL('u',x|0,y|0,n,col);for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=2+Math.random()*5;S.sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,l:14+Math.random()*10,col})}}
function blood(x,y,n,dir=0){NL('b',x|0,y|0,n,dir);for(let i=0;i<n;i++){S.sparks.push({x,y,vx:rnd(-2.5,2.5)+dir*rnd(.5,3),vy:rnd(-3.5,0),l:24+Math.random()*16,col:Math.random()<.3?'#7a0a10':'#b3141c',drop:1,r:rnd(1.4,3)})}}
/* a spray arc thrown the way the punch travelled */
function bloodArc(x,y,dir,n){NL('a',x|0,y|0,dir,n);for(let i=0;i<n;i++){const a=rnd(-1.1,.2),sp=rnd(3,7);S.sparks.push({x,y,vx:Math.cos(a)*sp*dir,vy:Math.sin(a)*sp,l:28+Math.random()*16,col:'#a8101a',drop:1,r:rnd(1.2,2.6)})}}
function floatText(x,y,t,col,num){NL('t',x|0,y|0,t,col,num?1:0);S.texts.push({x,y,t,col,l:55,num:!!num})}
function sweat(x,y,n){NL('w',x|0,y|0,n);for(let i=0;i<n;i++){const a=rnd(-2.6,-.5),sp=rnd(2,6);S.sparks.push({x,y,vx:Math.cos(a)*sp*(Math.random()<.5?-1:1),vy:Math.sin(a)*sp,l:16+Math.random()*10,col:'rgba(210,230,255,.85)',sw:1})}}
function banner(text,col,t,sub){S.banner={text,col,t,max:t,sub}}
function say(text,who='pbp'){S.feed.push({text,t:300,who});if(S.feed.length>2)S.feed.shift()}
/* colour commentator: analysis lines on top of the play-by-play, throttled so they land between the action */
const COLOR={
  big:['{F}의 저 한 방, 체중이 완벽하게 실렸어요.','{O} 지금 다리가 안 따라옵니다. 위험해요.','저런 펀치는 맞아 보기 전엔 몰라요. 턱에 그대로 꽂혔습니다.'],
  td:['{F}의 레슬링 기반이 확실히 드러나네요.','{O}, 등이 매트에 닿으면 안 되는 선수인데요.','타이밍 태클이었어요. 타격을 기다렸다가 들어갔습니다.'],
  leg:['{O} 다리가 붉게 부어오르고 있어요. 로킥이 쌓이면 무섭습니다.','{O} 체크를 안 하네요. 계속 차라고 코너가 외칠 겁니다.'],
  body:['바디에 투자하면 후반에 돌려받는 법이죠.','{O} 숨이 가빠지는 게 보여요. 바디샷 효과가 나옵니다.'],
  tired:['{F} 입이 벌어졌어요. 체력이 바닥나고 있습니다.','지금 페이스를 끝까지 유지할 수 있을지 의문이에요.'],
  sub:['그립이 깊어요. {O}, 이건 정말 위험합니다!','{F}의 주짓수, 이 위치에서 제일 무서운 선수예요.'],
  cut:['출혈이 시야를 가리고 있어요. 닥터가 볼 수도 있습니다.','{O} 눈두덩 컷이 깊어 보이네요.'],
  even:['박빙입니다. 채점하기 정말 어려운 라운드예요.','양쪽 다 쉽게 물러서지 않네요. 이게 명승부죠.']
};
function color(kind,F,O){if(!S||S.demo||S.frame-(S.lastColor||-999)<260)return;const L=COLOR[kind];if(!L)return;S.lastColor=S.frame;
  const t=pick(L).replace(/\{F\}/g,F?F.nick:'').replace(/\{O\}/g,O?O.nick:'');setTimeout(()=>{if(S&&S.mode==='fight')say(t,'color')},700)}
function sfx(k){NL('s',k);if(S&&S.demo)return;IC.Sound&&IC.Sound.play(k)}
function sfxHit(kind,dmg){NL('i',kind,Math.round(dmg*10)/10);if(S&&S.demo)return;IC.Sound&&IC.Sound.impact&&IC.Sound.impact(kind,dmg)}
function ev(F,name){if(F===S.p&&S.practice){S.events[name]=(S.events[name]||0)+1}}

/* ---------- damage ---------- */
function deal(F,O,dmg,target,o){
  dmg=Math.max(0,dmg);if(F===S.p&&S.coach)coachHit(o,target);
  if(target==='head'){O.head-=dmg;add(F,'dH',dmg);O.lastHit=S.frame;if(dmg>5&&Math.random()<.35){O.cuts++;if(O.cuts===3&&!o.blocked)say(`${O.nick}, 눈두덩이 찢어졌습니다! 출혈이 심해요`);if(O.cuts>=5&&!O.docChecked&&S.mode==='fight'&&!S.practice&&!S.demo&&O.head>0){O.docChecked=true;S.docF=O;S.docT=170;S.mode='doc';if(S.gr)exitGround();if(S.cl)exitClinch();S.sub=null;banner('닥터 체크','#ff8b7f',90,`${O.nick}의 컷 상태를 확인합니다`);sfx('bell');say('레퍼리가 경기를 멈추고 닥터를 부릅니다!')}}}
  else if(target==='body'){O.body-=dmg;O.st-=dmg*.6;add(F,'dB',dmg)}
  else{const k='lg'+(o.leg||leadLeg(O));O[k]=Math.max(0,O[k]-dmg);syncLegs(O);add(F,'dL',dmg)}
  O.st=clamp(O.st,0,stMax(O));
  if(!o.blocked){add(F,'sigL',1);add(F,target==='head'?'headL':target==='body'?'bodyL':'legL',1)}
  F.meter=Math.min(100,F.meter+dmg*(o.blocked?1:3.2));O.meter=Math.min(100,O.meter+dmg*1.3);
  O.flash=5;S.heat=Math.min(2,(S.heat||0)+(o.blocked?dmg*.012:dmg*.045+(dmg>7?.2:0)));
  const hx=o.x,hy=o.y;
  if(o.blocked){S.kick={x:F.f*4,y:0,t:6,max:6};if(F===S.p||O===S.p)buzz(10);burst(hx,hy,5,'#c9d1dc');floatText(hx,hy-40,'막음','#c9d1dc');sfxHit('block',dmg);S.shake=Math.max(S.shake,2)}
  else{burst(hx,hy,7+Math.round(dmg*1.4),o.counter?'#ffd75e':'#fff2d8');
    if(target==='head'){const bl=(O.head<75?dmg>3:dmg>6)?Math.round(dmg*.8+O.cuts*2+(100-O.head)/12):0;if(bl)blood(hx,hy,bl,-F.f);if(dmg>8&&O.head<70)bloodArc(hx,hy-6,F.f,10+O.cuts*3)}
    if(target==='body'&&dmg>7&&O.body<50)blood(hx,hy,3,-F.f);
    if(o.counter)floatText(hx,hy-64,'카운터!','#ffd75e');
    floatText(hx,hy-40,String(Math.round(dmg)),target==='leg'?'#ffcf99':target==='body'?'#ffe0b0':'#fff',true);
    S.rings.push({x:hx,y:hy,r:4,l:14,big:dmg>6});NL('r',hx|0,hy|0,dmg>6?1:0);if(target==='head')sweat(hx,hy,4+Math.round(dmg));
    S.hitstop=Math.max(S.hitstop,dmg>8?9:dmg>5?6:3);if(dmg>7)S.flashScr=8;
    S.shake=Math.max(S.shake,dmg*1.9+2);S.kick={x:F.f*Math.min(26,4+dmg*2.2),y:target==='head'?-3:4,t:10,max:10};(S.impacts=S.impacts||[]).push({x:hx,y:hy,t:12,max:12,big:dmg>6,f:F.f,col:o.counter?'#ffd75e':'#fff6e0'});if(S.impacts.length>8)S.impacts.shift();sfxHit(o.src==='ground'?'ground':o.knee?'knee':target==='body'?'body':o.kick?'kick':'punch',dmg)}
  if(!o.blocked&&(F===S.p||O===S.p))buzz(dmg>8?45:dmg>4?25:12);
  if(S.practice&&S.practice.inf){for(const k of ['head','body'])if(O[k]<15)O[k]=100;if(O.legs<15)setLegs(O,100);if(F.st<10)F.st=100;return false}
  if(!O.heartUsed&&O.head>0&&O.head<26&&O.body>0&&O.legs>0&&S.mode==='fight'){O.heartUsed=true;O.heart=480;O.meter=100;O.st=Math.min(stMax(O),O.st+40);O.rocked=0;
    banner('투혼!','#ff5a4a',70,`${O.nick} 마지막 힘을 끌어올립니다`);sfx('crowd');say(`${O.nick}, 쓰러지지 않습니다! 투혼 발동!`)}
  if(O.head<=0){O.head=0;finish(F,o.src==='ground'?'TKO':'KO',o.src==='ground'?'그라운드 앤 파운드':o.name);return true}
  if(O.body<=0){O.body=0;finish(F,'TKO','바디 '+o.name);return true}
  if(O.legs<=0){O.legs=0;finish(F,'TKO','레그킥');return true}
  return false;
}
const INJ={hand:'손 골절',knee:'무릎 부상',rib:'갈비뼈 부상',eye:'눈 부어 감김'};
function injure(F,k){F.inj=F.inj||{};if(F.inj[k]||S.practice||S.demo&&Math.random()<.5)return;F.inj[k]=1;
  floatText(F.x,130+zy(F),INJ[k]+'!','#ff8b7f');banner(INJ[k],'#ff8b7f',60,`${F.nick}에게 부상이 생겼습니다`);sfx('crowd');
  say(k==='hand'?`${F.nick}, 손을 털어 봅니다… 손에 문제가 생긴 것 같아요!`:k==='knee'?`${F.nick} 무릎이 꺾였어요! 다리를 절뚝입니다!`:k==='rib'?`${F.nick}, 옆구리를 감싸 쥡니다! 갈비뼈 같아요!`:`${F.nick}의 눈이 완전히 부어서 감겼습니다!`);
  setTimeout(()=>{if(S&&S.mode==='fight')say(k==='hand'?'손을 다치면 펀치에 힘을 못 싣죠. 킥과 레슬링으로 풀어야 해요.':k==='knee'?'저 무릎으로는 킥도, 스프롤도 힘듭니다.':k==='rib'?'숨쉬기도 힘들 거예요. 체력 회복이 확 떨어집니다.':'한쪽 시야가 없으면 그쪽에서 오는 훅을 못 봐요.','color')},1200)}
function rockCheck(F,O,dmg,counter){
  if(dmg<5||S.mode!=='fight')return;
  const chin=sv(O,'chin');
  if(O.rocked>0){
    const kd=(.12+(dmg-5)*.05+(100-chin)*.004+(O.head<35?.15:0)+(counter?.08:0))*F.cp.ko;
    if(Math.random()<kd)knockdown(F,O);
  }else{
    const r=((dmg-4)*.04*(1.6-chin/100)+(O.head<45?.1:0)+(counter?.08:0))*F.cp.ko;
    if(Math.random()<r){O.rocked=240;floatText(O.x,150,'휘청!','#ffd75e');say(pick([`${O.nick} 다리가 흔들립니다!`,`${O.nick}, 크게 흔들렸어요!`,`${F.nick}, 기회를 잡았습니다!`]));sfx('crowd')}
  }
}
const FOUL={groin:['낭심 킥','#ff6b5e'],poke:['아이 포크','#ff6b5e'],fence:['케이지 잡기','#ffb02e']};
function foul(F,O,k){if(S.mode!=='fight'||S.practice||S.demo)return;
  if(S.wild){wildHit(F,O,k);return}F.fouls=(F.fouls||0)+1;const ded=F.fouls>=2;if(ded){S.ded=S.ded||{a:0,b:0};S.ded[F.side]++}
  S.mode='foul';S.foulT=k==='fence'?90:200;S.foulV=O;S.foulK=k;S.foulDed=ded;if(S.gr)exitGround();if(S.cl)exitClinch();S.sub=null;
  if(k!=='fence'){O.state='hit';O.stun=0}
  banner(FOUL[k][0]+'!','#ff6b5e',90,ded?`${F.nick} 감점 1점!`:`${F.nick}에게 경고`);sfx('bell');
  say(k==='groin'?`아, 로킥이 낭심에 들어갔습니다! 경기 중단!`:k==='poke'?`손가락이 ${O.nick}의 눈을 찔렀어요! 레퍼리가 경기를 멈춥니다!`:`${F.nick}, 케이지를 잡고 테이크다운을 버팁니다! 반칙이에요!`);
  setTimeout(()=>{if(S)say(ded?`두 번째 반칙이라 감점입니다. 채점에 큰 영향을 줄 수 있어요.`:`이번엔 경고로 끝났네요. 다음엔 감점입니다.`,'color')},1500)}
/* wild match: no stoppage, no warning, no point deduction */
function wildHit(F,O,k){
  const W={groin:['로블로!',60,6,'body'],poke:['눈 찌르기!',46,2,'head'],head:['헤드버트!',30,0,'head'],soccer:['사커킥!',36,0,'head'],fence:['케이지 잡기',0,0,null]}[k]||['반칙!',30,2,'body'];
  floatText(O.x,150+zy(O),W[0],'#ff6b5e');if(W[1]){O.stun=Math.max(O.stun||0,W[1]);if(!S.gr&&!S.cl){O.state='hit';O.A=null;O.queue=[]}}
  if(W[2])deal(F,O,W[2],W[3],{name:W[0],src:'stand',blocked:false,x:O.x,y:W[3]==='head'?212:300});
  if(k==='poke'&&Math.random()<.35)injure(O,'eye');
  S.wildN=(S.wildN||0)+1;sfx('crowd');
  say(pick([`${F.nick}, ${W[0].replace('!','')}! 야생 매치에선 레퍼리가 말리지 않습니다!`,`관중석이 들끓습니다! ${W[0]}`,`${O.nick}, 고통스러워합니다! 반칙이 허용된 경기예요`]))}
function knockdown(F,O){
  add(F,'kd',1);ev(F,'kd');
  if(O.head<25&&Math.random()<.5&&!(S.practice&&S.practice.inf)){O.head=0;finish(F,'KO',F.A?F.A.name:'타격');return}
  hlMark(60,`${F.nick}의 녹다운`);
  S.heat=(S.heat||0)+.8;banner('녹다운!','#ffd75e',60);O.rocked=360;blood(O.x,190+zy(O),10+O.cuts*2,F.f);S.slow=24;sfx('crowd');
  say(`${O.nick} 다운! ${F.nick}가 덮칩니다!`);
  if(S.cl)S.cl=null;
  enterGround(F,O,1);
}
function hlMark(score,label){if(!S||S.demo||S.practice)return;S.hlPend=S.hlPend||[];S.hlPend.push({score,label,frames:S.rec.slice(-55),until:S.frame+(label.endsWith('피니시')?60:28)})}
function finish(Wn,method,detail){
  if(S.mode!=='fight')return;
  hlMark(100,`${Wn.nick} · ${method} 피니시`);
  const L=other(Wn);
  S.mode='ko';S.phaseT=200;S.sub=null;S.koRefIn=0;
  const el=S.roundFrames-S.timer;
  S.result={winner:Wn.side,method,detail,round:S.round,time:fmt(el)};if(Wn===S.p||L===S.p)buzz(method==='서브미션'?[60,40,60]:[90,60,180,60,90]);
  if(!S.gr){L.state='ko';L.koT=0;S.slow=90;S.cl=null}
  S.camFocus=L.side;S.winSide=Wn.side;
  banner(method==='서브미션'?'탭 아웃!':method==='TKO'?'TKO!':'K.O.!','#ffd75e',170);sfx('ko');
  say(method==='서브미션'?`${L.nick} 탭! ${Wn.nick}의 ${detail} 승리!`:method==='TKO'?`레퍼리가 막아섭니다! ${Wn.nick} TKO 승!`:`${Wn.nick}의 ${detail}! ${L.nick} 그대로 쓰러집니다!`);
}
const fmt=f=>{const s=Math.floor(f/60);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};

/* ---------- standing ---------- */
function startStrike(F,A0){
  const sm=(1.15-sv(F,'spd')*.003)*(F.st<25?1.2:1)*(F.rocked?1.15:1)*(F.exh?1.3:1)/F.cp.spd;
  const cost=(A0.st||0)*(1.3-sv(F,'car')*.005)*(F.plan==='press'?1.12:F.plan==='safe'?.9:1)*F.cp.st;
  if(F.st<cost*.35&&!F.exh){if(F===S.p)floatText(F.x,166,'지침','#8e97a6');return false}
  if(F.swT>0)return false;
  F.A={...A0,w:Math.max(3,Math.round(A0.w*sm)),r:Math.round(A0.r*sm),range:A0.range+(F.reach-185)*.5};
  F.stMul=.55+.45*F.st/100;F.st=Math.max(0,F.st-cost);
  F.state='attack';F.t=0;F.hitDone=false;
  if(A0.kind!=='shoot')add(F,'sigA',1);
  if(A0.special){F.meter=0;banner(A0.name,'#ffd75e',40);say(`${F.nick}의 필살기, ${A0.name}!`)}
  sfx('whoosh');if(F===S.p&&!A0.kick&&A0.kind!=='shoot')buzz(6);return true;
}
function doStand(F,O,id){
  if(exhausted(F,id))return false;
  if(id==='feint'){if(F.st<3)return false;F.st-=2;F.A={...MV.cross,id:'feint',name:'페인트',feint:true,w:Math.max(5,Math.round(MV.cross.w*.9)),r:6};F.state='attack';F.t=0;F.hitDone=true;return true}
  if(F===S.p&&!S.demo){const k=MV[id]&&MV[id].kick?'kick':id==='td'?'shoot':MV[id]&&MV[id].target==='head'?'head':null;if(k){for(const q in S.pat)S.pat[q]*=.9;S.pat[k]=(S.pat[k]||0)+1}}
  if(MV[id])return startStrike(F,MV[id]);
  if(id==='special'){
    if(F.meter<100){if(F===S.p)floatText(F.x,166,'게이지 부족','#8e97a6');return false}
    return startStrike(F,SPM[F.d.special]);
  }
  if(id==='td')return startStrike(F,TD);
  if(XM[id])return startStrike(F,XM[id]);
  if(WILDM[id])return S.wild?startStrike(F,WILDM[id]):false;
  if(id==='slip'){if(F.st<5)return false;F.st-=5;F.state='slip';F.t=0;return true}
  if(id==='clinch'){
    const dist=Math.abs(O.x-F.x);
    if(O.state==='attack'&&O.A&&O.A.kind==='shoot'&&O.t<=O.A.w+O.A.a&&dist<=120){
      F.st=Math.max(0,F.st-8);
      const ch=.28+(sv(F,'subO')-sv(O,'subD'))*.008+(sv(F,'clinch')-sv(O,'td'))*.004;
      if(Math.random()<ch){O.state='idle';O.A=null;enterGround(O,F,0);say(`${F.nick}, 들어오는 목을 낚아챕니다!`);startSub(F,O,'길로틴 초크',42);return true}
      O.A.bonus=.25;F.stun=10;F.state='hit';floatText(F.x,166,'길로틴 실패','#8e97a6');return true;
    }
    if(dist>90||Math.abs((O.z||0)-(F.z||0))>LANE+4){if(F===S.p)floatText(F.x,166,'너무 멀어요','#8e97a6');return false}
    if(F.st<6)return false;F.st-=6;
    const ch=.5+(sv(F,'clinch')-sv(O,'clinch'))*.01+(O.rocked?.2:0)+(O.state==='attack'?.15:0)+(O.state==='hit'?.15:0);
    if(Math.random()<ch){enterClinch(F,O);return true}
    F.stun=20;F.state='hit';floatText(O.x,166,'클린치 차단','#c9d1dc');return true;
  }
  return false;
}
function tryHit(F,O){
  const A=F.A,dist=Math.abs(O.x-F.x),dz=Math.abs((O.z||0)-(F.z||0)),lane=A.kick?LANE+8:LANE;
  if(dist>A.range)return;
  if(A.id==='lowkick'&&dist<64&&Math.random()<.035&&!S.wild){F.hitDone=true;foul(F,O,'groin');return}
  if(A.id==='jab'&&O.state==='attack'&&Math.random()<.012&&!S.wild){F.hitDone=true;foul(F,O,'poke');return}
  if(dz>lane){if(F.t===A.w+A.a){F.hitDone=true;floatText(O.x,150+zy(O),'사이드 스텝','#9fe0a8');ev(O,'sidestep');if(O===S.e&&Math.random()<.4)say(`${O.nick}, 옆으로 빠지며 피합니다`)}return}
  F.hitDone=true;
  const hy=(A.target==='head'?212:A.target==='body'?262:352)+zy(O),hx=O.x-F.f*14;
  if(A.target==='head'&&O.state==='slip'&&O.t>=2&&O.t<=13){O.ctrW=26;F.st=Math.max(0,F.st-3);floatText(O.x,160,'회피','#9fe0a8');ev(O,'slip');if(O===S.e&&Math.random()<.5)say(`${O.nick}, 고개만 살짝 빼서 피합니다`);return}
  if(A.target==='head'&&!A.special&&O.state!=='attack'&&O.state!=='hit'&&!O.rocked&&!(O.inj&&O.inj.eye)&&Math.random()<Math.max(0,sv(O,'sdef')-62)*.004){floatText(O.x,160,'헤드 무브','#9fe0a8');return}
  /* perfect guard: guard raised just before impact parries and staggers the attacker */
  if(O.state==='block'&&A.target!=='leg'&&S.frame-(O.blockStart||-99)<=9&&!A.special&&(O===S.p&&!S.demo||Math.random()<(S.D.parry||S.D.react*.25))){
    F.stun=34;F.state='hit';F.vx=-F.f*2.5;F.A=null;F.queue=[];O.meter=Math.min(100,O.meter+18);O.ctrW=45;O.perfects=(O.perfects||0)+1;
    floatText(O.x,150+zy(O),'퍼펙트 가드!','#7fe3ff');S.rings.push({x:hx,y:hy,r:6,l:16,big:true});S.hitstop=Math.max(S.hitstop,6);sfx('block');
    if(O===S.p)S.comboFx={n:0,t:50,txt:'퍼펙트 가드! 지금 반격!',col:'#7fe3ff'};
    if(Math.random()<.5)say(`${O.nick}, 타이밍 완벽한 블로킹! ${F.nick} 중심이 무너집니다`);return}
  let mul=1,blocked=false;
  if(A.target==='leg'&&O!==S.p&&O.state!=='attack'&&O.state!=='hit'&&Math.random()<S.D.react*(.25+(S.pat.kick||0)*.08)){
    O.react={k:'check',t:0};{const k='lg'+rearLeg(F);F[k]=Math.max(1,F[k]-3.5);syncLegs(F)}floatText(O.x,320+zy(O),'체크!','#9fe0a8');sfx('block');if(Math.random()<.5)say(`${O.nick}, 정강이로 로킥을 체크합니다`);return}
  if(O.state==='block'&&A.target!=='leg'){blocked=true;mul=A.target==='head'?(O.rocked?.35:.15):.4;if(A.special)mul=Math.max(mul,.45);O.st=Math.max(0,O.st-A.st*.6)}
  const counter=O.state==='attack'&&O.A&&O.t<=O.A.w;
  const pw=A.kick?sv(F,'kick'):sv(F,'pow');
  const inj=F.inj||{},oinj=O.inj||{};
  const dmg=DMG*A.dmg*(.55+pw*.0075)*F.stMul*(A.kick?legF(F)*(inj.knee?.7:1):(inj.hand?.68:1))*(A.target==='body'&&oinj.rib?1.15:1)*(A.target==='head'&&oinj.eye?1.12:1)*(counter?1.35:1)*(F.ctrW>0?1.3:1)*F.mul*(F.heart>0?1.18:1)*(F.plan==='press'?1.06:1)*(O.plan==='safe'?.92:1)*F.cp.pow*(A.kick&&A.target==='body'&&F.stance!==O.stance?1.1:1)*(F.exh?.7:1)*rnd(.88,1.12)*mul;
  if(F.ctrW>0&&!blocked){floatText(F.x,140,'슬립 카운터','#ffd75e');F.ctrW=0}
  if(!blocked){O.stun=4+Math.round(dmg*1.6);O.state='hit';O.vx=F.f*A.kb*.7;O.A=null;O.queue=[];O.react={k:A.target==='head'?(dmg>7?'big':'head'):A.target,t:0,d:dmg,up:A.anim==='upper'};
    if(counter&&dmg>6&&!S.demo){S.slow=Math.max(S.slow,20);S.zoomKick=.07}else if(dmg>8)S.zoomKick=.045}else O.x+=F.f*A.kb*.6;
  ev(F,'land:'+A.id);
  const legHit=A.target==='leg'?(Math.random()<(A.id==='calf'?.85:.7)?leadLeg(O):rearLeg(O)):null;
  if(A.foulK&&!blocked){wildHit(F,O,A.foulK);if(S.mode!=='fight')return}
  if(deal(F,O,dmg,A.target,{name:A.name,src:'stand',blocked,counter,kick:!!A.kick,knee:A.anim==='flyknee',x:hx,y:hy,leg:legHit}))return;
  if(A.id==='highkick'&&!blocked&&(F===S.p||O===S.p))buzz([30,25,70]);
  if(!blocked&&weakLeg(O)&&S.mode==='fight'&&!S.gr&&Math.random()<.16){O.stun=Math.max(O.stun,30);floatText(O.x,320+zy(O),'중심 흔들림','#ffcf99')}
  if(blocked)return;
  if(dmg>=8&&!blocked)hlMark(dmg*4+(counter?15:0),`${F.nick}의 ${A.name}${counter?' 카운터':''}`);
  if(dmg>=7.5)color('big',F,O);else if(A.target==='leg'&&O.legs<60)color('leg',F,O);else if(A.target==='body'&&O.body<65)color('body',F,O);
  if(dmg>=6.5)say(pick([`${F.nick}, 묵직한 ${A.name} 적중!`,`${A.name}에 ${O.nick} 고개가 돌아갑니다!`,`${F.nick}의 ${A.name}, 정확히 들어갑니다!`]));
  else if(counter)say(`${F.nick}, 타이밍 완벽한 카운터!`);
  if(A.target==='head')rockCheck(F,O,dmg,counter);
  if(S.mode==='fight'){if(!A.kick&&dmg>6.5&&Math.random()<.012)injure(F,'hand');
    if(A.target==='leg'&&O.legs<40&&Math.random()<.12)injure(O,'knee');
    if(A.target==='body'&&O.body<38&&Math.random()<.1)injure(O,'rib');
    if(A.target==='head'&&O.head<45&&O.cuts>=3&&Math.random()<.08)injure(O,'eye')}
  if(S.mode!=='fight'||S.gr)return;
  if(A.target==='body'&&O.body<32&&dmg>=4.5&&Math.random()<.28){O.stun=60;O.rocked=Math.max(O.rocked,120);floatText(O.x,150,'바디에 무너짐','#ffd75e');say(`${O.nick}, 바디샷에 몸이 접힙니다!`)}
  if(A.target==='leg'&&O.legs<38&&Math.random()<.25){O.stun=40;floatText(O.x,330,(legHit==='L'?'왼':'오른')+'다리 풀림','#ffcf99');say(`${O.nick} ${legHit==='L'?'왼':'오른'}다리가 무너집니다! 로킥이 쌓였어요`)}
}
function resolveShoot(F,O){
  const A=F.A;F.hitDone=true;
  if(Math.abs(O.x-F.x)>A.range||Math.abs((O.z||0)-(F.z||0))>LANE+8){say(`${F.nick}의 태클이 허공을 가릅니다`);return}
  add(F,'tdA',1);
  const dist0=Math.abs(O.x-F.x),kickCatch=O.state==='attack'&&O.A&&O.A.kick;
  const type=kickCatch?'single':dist0<=92?'high':sv(F,'td')>=78||F.st>60?'double':'single';
  const TDN={single:'싱글렉',double:'더블렉',high:'하이크로치'};
  let ch=.4+(sv(F,'td')-sv(O,'tdd')*.85)*.014+(type==='single'?.06:type==='high'?.03:0);
  /* timed sprawl: guard + down held as the shot comes in (player), or a sharp read (AI, best on Hall of Fame) */
  const sprawlTimed=O===S.p&&!S.demo?(O.blockHeld&&(O.moveZ||0)>.4&&S.frame-(O.sprawlAt||-99)<=14):(O.state==='block'&&Math.random()<(S.D.sprawl||S.D.react*.28));
  if(sprawlTimed)ch-=.55;
  if(O.state==='attack'){ch+=.3;if(O.A&&O.A.kick)ch+=.15}
  if(O.state==='block')ch-=.3+sv(O,'tdd')*.002;
  if(O.state==='hit')ch+=.2;
  if(O.st<25)ch+=.12;
  ch+=(1-legF(O))*.3+(O.inj&&O.inj.knee?.12:0)+(O.rocked?.2:0)+(A.bonus||0)+(F.plan==='wrestle'?.12:0)-(O===S.e&&(S.pat.shoot||0)>2?.12:0);
  ch=clamp(ch,.05,.94);
  if(A.sure||Math.random()<ch){
    add(F,'td',1);ev(F,'td');
    if(A.id==='pull'){enterGround(O,F,0);say(`${F.nick}, 날아올라 트라이앵글!`);startSub(F,O,'트라이앵글 초크',52);return}
    if(A.id==='slam'||(sv(F,'td')>=85&&Math.random()<.25)){
      sfx('slam');S.shake=14;say(`${F.nick}, ${O.nick}를 들어서 매트에 꽂습니다!`);
      const d=7*(.6+sv(F,'pow')*.006);O.body=Math.max(1,O.body-d);O.head=Math.max(1,O.head-d*.4);add(F,'dB',d);floatText(O.x,180,String(Math.round(d)),'#fff',true);
      enterGround(F,O,A.id==='slam'?2:1);return;
    }
    floatText(O.x,170+zy(O),TDN[type]+'!','#9fe0a8');
    say(kickCatch?`${F.nick}, 킥을 잡아 싱글렉으로 넘깁니다!`:type==='high'?`${F.nick}, 하이크로치로 들어 올려 눕힙니다!`:type==='double'?`${F.nick}의 더블렉 테이크다운 성공!`:`${F.nick}, 싱글렉으로 넘깁니다!`);
    if(F===S.p||O===S.p)buzz([50,40,50]);
    enterGround(F,O,type==='high'||sv(F,'td')>=88?1:0);color('td',F,O);
  }else{
    F.stun=34;F.state='hit';F.vx=-F.f*1.5;F.A=null;
    {const C=S.cage,dO=Math.hypot(O.x-C.x,(O.z||0)-C.z);if(dO>220&&Math.random()<.18){foul(O,F,'fence');return}}
    O.state='sprawl';O.t=0;O.A=null;O.slot=null;O.queue=[];O.stun=0;O.vx=-O.f*3.2;O.sprawlTo=sprawlTimed?F:null;F.stun=sprawlTimed?40:34;F.state='stuffed';F.t=0;F.react={k:'body',t:0,d:6};
    S.shake=Math.max(S.shake,9);S.kick={x:-O.f*8,y:6,t:10,max:10};if(F===S.p||O===S.p)buzz(sprawlTimed?[30,30,60]:[25]);sfx('slam');ev(O,'sprawl');
    if(sprawlTimed){floatText(O.x,150+zy(O),'스프롤!','#9fe0a8');say(`${O.nick}, 다리를 뒤로 빼며 엉덩이로 눌러 뭉갭니다!`);return}
    floatText(O.x,166,'스프롤!','#9fe0a8');say(`${O.nick}, 깔끔한 스프롤로 막아냅니다`);
  }
}
function upStand(F,O){
  if(F.react){F.react.t++;if(F.react.t>30)F.react=null}
  if(F.flash>0)F.flash--;if(F.rocked>0)F.rocked--;if(F.ctrW>0)F.ctrW--;
  if(F.state==='ko'){F.koT++;return}
  if(F.swT>0)F.swT--;upExh(F);
  if(F.state!=='attack'&&F.state!=='slip'&&Math.abs(O.x-F.x)>6)F.f=O.x>F.x?1:-1;
  if(F.state==='sprawl'){F.t++;F.x+=F.vx;F.vx*=.86;F.st=Math.min(stMax(F),F.st+.05);
    if(F.sprawlTo&&F.t===18&&S.mode==='fight'&&!S.gr&&!S.cl){const B=F.sprawlTo;F.sprawlTo=null;floatText(F.x,150+zy(F),'프론트 헤드락!','#9fe0a8');say(`프론트 헤드락! ${B.nick}는 터틀로 웅크립니다!`);B.stun=0;B.state='idle';enterGround(F,B,5);return}
    if(F.t>=26){F.state='idle';F.sprawlTo=null}return}
  if(F.stun>0){F.stun--;F.state=F.state==='stuffed'?'stuffed':'hit';F.t=(F.t||0)+1;F.x+=F.vx;F.vx*=.82;F.st=Math.min(stMax(F),F.st+.1);if(F.stun===0)F.state='idle';return}
  if(F.state==='slip'){F.t++;F.x-=F.f*.6;if(F.t>=16)F.state='idle';return}
  if(F.state==='attack'){
    const A=F.A;F.t++;
    if(F.t<=A.w+A.a)F.x+=F.f*(A.lunge&&F.t>A.w*.5?A.lunge:.5);
    if(F.t>A.w&&F.t<=A.w+A.a&&!F.hitDone){A.kind==='shoot'?resolveShoot(F,O):tryHit(F,O);if(S.gr||S.cl||S.mode!=='fight')return}
    if(A.feint&&F.t>=Math.round(A.w*.7)){F.state='idle';F.A=null;return}
    if(F.t>=A.w+A.a+A.r){F.state='idle';F.A=null}
    return;
  }
  if(!F.slot&&F.queue.length&&F!==S.p)F.slot=F.queue.shift();
  if(F.slot){const id=F.slot;F.slot=null;if(doStand(F,O,id)&&(F.state!=='idle'))return;if(S.gr||S.cl)return}
  const blocking=F.blockHeld;if(blocking&&!F.wasBlock)F.blockStart=S.frame;F.wasBlock=blocking;
  if(blocking&&(F.moveZ||0)>.4&&!F.sprawlArm){F.sprawlArm=true;F.sprawlAt=S.frame}else if(!(blocking&&(F.moveZ||0)>.4))F.sprawlArm=false;
  const mz=F.moveZ||0;F.state=blocking?'block':(F.moveDir||mz?'walk':'idle');
  const spd=(2.1+sv(F,'spd')*.012)*legF(F)*(F.rocked?.6:1)*(blocking?.5:1)*(F.inj&&F.inj.knee?.8:1)*(weakLeg(F)?.65:1)*(F.exh?.6:1)*F.cp.spd;
  F.x+=F.moveDir*spd;
  if(mz){/* lateral input circles around the opponent at the current distance */
    const O=other(F);let vx=F.x-O.x,vz=(F.z||0)-(O.z||0);const d0=Math.hypot(vx,vz)||1;let tx=-vz/d0,tz=vx/d0;if(tz*mz<0){tx=-tx;tz=-tz}
    const st=Math.abs(mz)*spd*.85;F.x+=tx*st;F.z=(F.z||0)+tz*st;vx=F.x-O.x;vz=F.z-(O.z||0);const d1=Math.hypot(vx,vz)||1;F.x=O.x+vx*d0/d1;F.z=(O.z||0)+vz*d0/d1}
  if(F.moveDir||mz)F.walk+=.24;
  F.st=Math.min(stMax(F),F.st+(blocking?.035:F.moveDir?.06:.085)*(.55+sv(F,'car')*.006)*(F.body<40?.7:1)*(F.inj&&F.inj.rib?.7:1));
  if(F.st<18&&F.st>16.5&&F===S.e)color('tired',F,other(F));
  if(S.frame-(F.lastHit||0)>180&&F.head<100)F.head=Math.min(100,F.head+.008);
}
function separate(){
  const a=S.a,b=S.b;
  const dx=b.x-a.x,dz=(b.z-a.z)*1.3,d=Math.hypot(dx,dz),min=68;
  if(d<min){const ux=d>.01?dx/d:(a.f>0?1:-1),uz=d>.01?dz/d:0,push=(min-d)/2;a.x-=ux*push;b.x+=ux*push;a.z-=uz*push/1.3;b.z+=uz*push/1.3}
  for(const F of [a,b])inCage(F);
}
const CLOSE_COMBOS=[['jab','cross'],['cross','hook'],['hook','upper'],['bodyshot','hook'],['jab','cross','hook'],['upper','hook']];
function aiStand(E,P){
  const D=S.D,T=E.ai,dist=Math.abs(P.x-E.x),toward=P.x>E.x?1:-1,pr=S.practice;
  if(pr&&pr.ai==='idle'){E.moveDir=0;E.blockHeld=false;return}
  if(E.blockT>0){E.blockT--;E.blockHeld=true}else E.blockHeld=!!(pr&&pr.ai==='defend');
  if(P.state==='attack'&&P.t===1&&E.state!=='attack'&&E.stun===0&&dist<=P.A.range+24&&!E.slot){
    const r=Math.random();
    if(P.A.kind==='shoot'){
      if(sv(E,'subO')>=78&&r<D.react*.3*T.sub)E.slot='clinch';
      else if(r<D.react+sv(E,'tdd')*.003+((S.pat&&S.pat.shoot)||0)*.05){E.blockT=P.A.w+P.A.a+8;E.blockHeld=true;E.moveDir=0}
    }else{
      const rr=D.react*(.7+sv(E,'sdef')*.006);
      if(P.A.kick&&r<T.td*D.react*1.4&&dist<=108)E.slot='td';
      else if(r<rr*T.counter*.5&&P.A.w>=8&&dist<=90)E.slot='jab';
      else if(r<rr*.45&&P.A.target==='head')E.slot='slip';
      else if(r<rr*.62&&P.A.w>=9){E.sideT=P.A.w+P.A.a+4;E.sideDir=(E.z||0)>0?1:-1;if(Math.abs(E.z||0)>55)E.sideDir=-E.sideDir}
      else if(r<rr&&P.A.target!=='leg'){E.blockT=P.A.w+P.A.a+6;E.blockHeld=true;E.moveDir=0}
    }
  }
  const dzA=(P.z||0)-(E.z||0);
  if(E.sideT>0){E.sideT--;E.moveZ=E.sideDir}else E.moveZ=Math.abs(dzA)>14?Math.sign(dzA)*(Math.abs(dzA)>30?1:.6):0;
  if(E.slot)return;
  if(--E.think>0)return;
  E.think=Math.round((D.think*1.7+Math.random()*14)*(1.25-T.agg*.4));
  if(Math.random()<.012&&E.swT<=0&&E.state==='idle'){E.stance=E.stance==='south'?'orth':'south';E.swT=16}
  if(Math.random()<.12*T.counter&&Math.abs(dzA)<20){E.sideT=16+Math.floor(Math.random()*14);E.sideDir=(E.z||0)>20?-1:(E.z||0)<-20?1:(Math.random()<.5?-1:1)}
  if(E.blockT>0)return;
  if(pr&&pr.ai==='defend'){E.moveDir=dist>110?toward:0;return}
  const sp=SPM[E.d.special];
  if(E.meter>=100&&dist<=sp.range-6&&Math.random()<.45){E.slot='special';E.moveDir=0;return}
  if(P.state==='hit'&&dist<100&&Math.random()<.2+T.agg*.3){E.queue=[...pick(CLOSE_COMBOS)];E.slot=E.queue.shift();E.moveDir=0;return}
  if(P.rocked>0&&Math.random()<.6){E.moveDir=toward;if(dist<95)E.slot=pick(['hook','cross','upper']);else if(dist<108&&Math.random()<T.td)E.slot='td';return}
  if(E.st<20){E.moveDir=-toward;if(Math.random()<.5)E.blockT=24;return}
  const pb=S.pbf||0,pat=S.pat||{},sty=E.d.style;
  /* desperate late in the fight when behind on the cards */
  const late=S.round===S.rounds&&S.timer<S.roundFrames*.4&&(S.cardLead||0)<0,agg=clamp(T.agg*(E.st<35?.55:1)+(late?.3:0),0,.95);
  /* preferred range by style */
  const pref={kickboxer:116,karate:120,muaythai:96,boxer:84,wrestler:100,sambo:96,bjj:96,brawler:80,allround:100}[sty]||100;
  if(Math.random()<.08*agg&&dist<120){E.slot='feint';E.moveDir=0;return}
  if((pat.head||0)>3&&dist<96&&Math.random()<.25*T.counter){E.slot=pick(['slip','jab']);return}
  if((pat.kick||0)>3&&dist<=110&&Math.random()<.18+T.td*.4){E.slot='td';E.moveDir=0;return}
  if(dist<=106&&Math.random()<T.td*.3*(1+pb*1.5)){E.slot='td';E.moveDir=0;return}
  if(dist<=86&&Math.random()<T.clinch*.25){E.slot='clinch';return}
  if(dist>Math.max(128,pref+18)){E.moveDir=toward;return}
  if(dist<pref-26&&Math.random()<.45&&E.st>25&&sty!=='brawler'){E.moveDir=-toward;if(Math.random()<.4){E.sideT=14;E.sideDir=Math.random()<.5?-1:1}return}
  if(E.st<35&&Math.random()<.35){E.moveDir=-toward;E.sideT=18;E.sideDir=(E.z||0)>0?-1:1;return}
  const r=Math.random();
  if(r<agg){
    const o=[];
    if(dist<=80)o.push(['hook',2],['upper',1.4],['bodyshot',1.5],['cross',1]);
    if(dist<=90)o.push(['jab',3],['cross',2],['bodyshot',.8]);
    if(dist<=106)o.push(['lowkick',2*T.kick*(1+pb)]);
    if(dist<=98)o.push(['calf',1.1*T.kick*(1+pb)]);
    if(dist<=114)o.push(['midkick',1.6*T.kick]);
    if(dist<=122)o.push(['highkick',1.1*T.kick]);
    const m=o.length?wpick(o):null;
    if(!m){E.moveDir=toward;return}
    if(Math.random()<T.combo&&(m==='jab'||m==='cross'))E.queue=[...pick([['cross'],['cross','hook'],['lowkick'],['bodyshot'],['cross','lowkick'],['cross','highkick']])];
    E.slot=m;E.moveDir=0;
  }else if(r<agg+.18)E.moveDir=-toward;
  else if(r<agg+.3){E.blockT=16;E.moveDir=0}
  else E.moveDir=dist>100?toward:(Math.random()<.5?0:-toward);
}

/* ---------- clinch ---------- */
function enterClinch(ctrl,oth){
  const dir=oth.x>ctrl.x?1:-1;
  S.cl={ctrl,other:oth,cage:false,idle:0,cx:clamp((ctrl.x+oth.x)/2,S.cage.x-250,S.cage.x+250),dir,cz:((ctrl.z||0)+(oth.z||0))/2};
  for(const F of [ctrl,oth]){F.state='clinch';F.A=null;F.stun=0;F.vx=0;F.g={act:null,t:0,A:null};F.slot=null;F.queue=[];F.think=24}
  ev(ctrl,'clinch');say(`${ctrl.nick}, 클린치로 붙잡습니다`);sfx('block');
}
function exitClinch(msg){
  const c=S.cl;if(!c)return;
  c.ctrl.x=c.cx-c.dir*42;c.other.x=c.cx+c.dir*42;
  for(const F of [c.ctrl,c.other]){F.state='idle';F.g={act:null,t:0,A:null};F.slot=null}
  S.cl=null;separate();if(msg)say(msg);
}
function clinchPos(){const c=S.cl;c.ctrl.z=c.other.z=c.cz||0;c.ctrl.x=c.cx-c.dir*22;c.other.x=c.cx+c.dir*22;c.ctrl.f=c.dir;c.other.f=-c.dir}
function upClinch(F){
  const c=S.cl,O=F===c.ctrl?c.other:c.ctrl,isCtrl=F===c.ctrl;
  if(F.flash>0)F.flash--;if(F.rocked>0)F.rocked--;
  F.st=clamp(F.st+.06*(.55+sv(F,'car')*.006)-(c.cage&&!isCtrl?.06:0),0,stMax(F));upExh(F);
  if(isCtrl)add(F,'ctrl',.5);
  if(F.g.act){F.g.t++;if(F.g.t===F.g.A.w){resolveC(F,O,F.g.act);if(!S.cl||S.mode!=='fight')return}
    if(F.g.t>=F.g.A.w+F.g.A.r)F.g={act:null,t:0,A:null};return}
  if(F.slot){const id=F.slot;F.slot=null;
    const A=CA[id];if(!A)return;if(exhausted(F,id))return;if(A.wild&&!S.wild)return;
    if(id==='c_cage'&&(!isCtrl||c.cage))return;
    if(id==='c_rev'&&isCtrl)return;
    const cost=A.st*(1.3-sv(F,'car')*.005);if(F.st<cost*.4){if(F===S.p)floatText(F.x,166,'지침','#8e97a6');return}
    F.stMul=.55+.45*F.st/100;F.st-=cost;F.g={act:id,t:0,A};
    if(A.dmg)add(F,'sigA',1);
  }
}
function resolveC(F,O,id){
  const c=S.cl,A=CA[id],isCtrl=F===c.ctrl;c.idle=0;
  if(A.dmg){
    const pw=A.kick?sv(F,'kick'):sv(F,'pow');
    const blocked=O.blockHeld;
    const dmg=DMG*A.dmg*(.55+pw*.0075)*F.stMul*F.mul*F.cp.pow*(isCtrl?1:.75)*(blocked?.5:1)*(1+sv(F,'clinch')*.002)*rnd(.88,1.12);
    if(id==='c_hbutt'&&!blocked)wildHit(F,O,'head');
    ev(F,'land:'+id);
    if(deal(F,O,dmg,A.target,{name:A.name,src:'clinch',blocked:false,knee:!!A.kick,x:O.x-O.f*-10,y:(A.target==='head'?212:262)+zy(O)}))return;
    if(dmg>=6)say(`${F.nick}, 클린치에서 ${A.name}!`);
    if(A.target==='head')rockCheck(F,O,dmg,false);
    return;
  }
  const d=sv(F,'clinch')-sv(O,'clinch');
  if(id==='c_trip'){
    add(F,'tdA',1);
    const ch=.33+((sv(F,'td')+sv(F,'clinch'))-(sv(O,'tdd')+sv(O,'clinch')))*.004+(c.cage&&isCtrl?.1:0)+(O.st<25?.1:0)-(isCtrl?0:.12);
    if(Math.random()<ch){add(F,'td',1);ev(F,'td');const throwIt=sv(F,'clinch')>=72||c.cage&&isCtrl&&Math.random()<.4;
      if(throwIt){floatText(O.x,170,'유도 메치기!','#9fe0a8');say(`${F.nick}, 허리를 넣어 유도식 메치기! ${O.nick}가 매트에 꽂힙니다!`);const d=5*(.6+sv(F,'pow')*.006)*F.cp.pow;O.body=Math.max(1,O.body-d);add(F,'dB',d);S.shake=12;sfx('slam')}
      else{floatText(O.x,170,'다리 걸기','#9fe0a8');say(`${F.nick}, 클린치에서 다리를 걸어 넘깁니다!`)}
      if(F===S.p||O===S.p)buzz([50,40,50]);S.cl=null;enterGround(F,O,throwIt?2:sv(F,'td')>=85?1:0)}
    else say(`${O.nick}, 중심을 잡고 버팁니다`);
  }else if(id==='c_cage'){
    if(Math.random()<.5+d*.01){c.cage=true;say(`${F.nick}, ${O.nick}를 케이지로 밀어붙입니다`)}
  }else if(id==='c_rev'){
    if(Math.random()<(c.cage?.36:.28)+d*.01){const wall=c.cage;c.ctrl=F;c.other=O;c.dir=-c.dir;c.cage=false;say(wall?`${F.nick}, 케이지를 등지고 돌아 나옵니다!`:`${F.nick}, 언더훅으로 포지션 역전!`)}
    else say(`${O.nick}가 클린치를 유지합니다`);
  }else if(id==='c_brk'){
    const ch=isCtrl?.8:.32+d*.01-(c.cage?.12:0);
    if(Math.random()<ch)exitClinch(`${F.nick}, 클린치를 풀고 거리를 벌립니다`);
    else say(`${O.nick}가 놓아주지 않습니다`);
  }
}
function aiClinch(E,P){
  const D=S.D,c=S.cl,T=E.ai,isCtrl=E===c.ctrl;
  if(S.practice&&S.practice.ai!=='normal'){E.blockHeld=S.practice.ai==='defend';if(--E.think<=0){E.think=60;if(Math.random()<.5)E.slot='c_brk'}return}
  if(E.blockT>0){E.blockT--;E.blockHeld=true}else E.blockHeld=false;
  if(P.g.act&&CA[P.g.act].dmg&&P.g.t===1&&Math.random()<D.react*.7)E.blockT=P.g.A.w+4;
  if(--E.think>0)return;E.think=Math.round(D.think*1.6)+Math.floor(Math.random()*14);
  if(E.g.act)return;
  const muay=E.d.style==='muaythai'?1.8:1;
  const o=isCtrl?[['c_thigh',1.4*muay+(c.cage?1:0)],['c_knee',3*muay],['c_kneeH',1.5*muay],['c_elbow',1.6*muay],['c_short',2],['c_cage',c.cage?0:1.2],['c_trip',T.td*5],['c_brk',T.kick*1.4+(E.st<25?1:0)]]
    :[['c_short',2],['c_elbow',1.4],['c_knee',1],['c_rev',1+T.clinch*3],['c_brk',1.5+(1-T.td)*1.5],['c_trip',T.td*2]];
  E.slot=wpick(o);
}

/* ---------- ground ---------- */
function enterGround(top,bot,pos){
  S.cl=null;
  S.gr={top,bot,pos,cx:clamp((top.x+bot.x)/2,S.cage.x-185,S.cage.x+185),hd:bot.x>=top.x?1:-1,idle:0,cz:clamp(((top.z||0)+(bot.z||0))/2,S.cage.z-150,S.cage.z+150)};
  for(const F of [top,bot]){F.state='ground';F.A=null;F.stun=0;F.vx=0;F.g={act:null,t:0,A:null};F.slot=null;F.queue=[];F.blockT=0;F.blockHeld=false;F.think=30}
  sfx('slam');S.shake=Math.max(S.shake,8);
}
function exitGround(msg){
  const {top,bot,cx,hd}=S.gr;
  bot.x=cx+hd*42;top.x=cx-hd*42;top.z=bot.z=S.gr.cz||0;
  for(const F of [top,bot]){F.state='idle';F.g={act:null,t:0,A:null};F.slot=null;F.stun=0}
  top.f=hd;bot.f=-hd;
  S.gr=null;S.sub=null;separate();if(msg)say(msg);
}
function gHead(F){
  const gr=S.gr,{cx,hd,pos}=gr;
  if(F===gr.bot)return pos===4?{x:cx+hd*40,y:GY-104}:pos===5?{x:cx+hd*6,y:GY-50}:{x:cx+hd*78,y:GY-14};
  return [{x:cx-hd*4,y:GY-112},{x:cx+hd*24,y:GY-110},{x:cx+hd*66,y:GY-58},{x:cx+hd*38,y:GY-128},{x:cx+hd*14,y:GY-112},{x:cx-hd*22,y:GY-118}][pos];
}
function startG(F,id){
  const gr=S.gr,A=GA[id];if(!A)return;
  const top=F===gr.top;
  if(top!==id.startsWith('g_'))return;
  const msg=t=>{if(F===S.p)floatText(gr.cx,170,t,'#8e97a6')};
  if(exhausted(F,id))return;
  if(A.wild&&!S.wild)return;
  if(id==='g_pass'&&gr.pos>=3)return msg(gr.pos===5?'백 테이크로 돌아가세요':'더 갈 곳이 없어요');
  if(id==='g_back'&&gr.pos!==2&&gr.pos!==3&&gr.pos!==5)return msg('사이드·마운트·프론트 헤드락에서');
  if(id==='g_sub'&&!TOP_SUBS[gr.pos].length)return msg('여기선 서브미션 불가');
  if(id==='b_sub'&&!BOT_SUBS[gr.pos].length)return msg('가드·하프 가드에서만');
  if(id==='b_sweep'&&gr.pos===4)return msg('백에서는 스윕 불가');
  if(id==='b_regard'&&gr.pos===0)return msg('이미 풀 가드');
  if(A.special&&F.meter<100)return msg('게이지 부족');
  const cost=A.st*(1.3-sv(F,'car')*.005);
  if(F.st<cost*.4)return msg('지침');
  F.stMul=.55+.45*F.st/100;F.st=Math.max(0,F.st-cost);
  if(A.special){F.meter=0;banner(A.name,'#ffd75e',36)}
  if(A.dmg)add(F,'sigA',1);
  F.g={act:id,t:0,A};
}
function gStrike(F,O,A,top){
  const gr=S.gr;
  const blocked=O.blockHeld;
  if(A.wild&&!blocked)wildHit(F,O,'soccer');
  const dmg=GDMG*A.dmg*(top?GNP[gr.pos]:1)*(.55+sv(F,top?'gnp':'pow')*.0075)*F.mul*F.cp.pow*(blocked?(top?.4:.5):1)*(O.rocked?1.4:1)*(.6+.4*F.stMul)*rnd(.88,1.12);
  gr.idle=0;
  const h=gHead(O);h.y+=(gr.cz||0)*ZY;ev(F,'land:'+F.g.act);
  if(deal(F,O,dmg,A.target,{name:A.name,src:'ground',blocked:false,x:h.x,y:A.target==='body'?GY-30:h.y}))return;
  if(A.target==='head'&&!blocked&&O.head<80)blood(h.x,h.y,3+Math.round(dmg*.6+O.cuts),0);
  if(blocked)floatText(h.x,h.y-60,top?'커버':'포스처','#c9d1dc');
  if(dmg>8)say(`${F.nick}, 위에서 무자비한 ${A.name}!`);
  if(top&&O.head<30&&!blocked&&Math.random()<.12){say(`레퍼리가 유심히 지켜봅니다. ${O.nick} 방어해야 해요!`)}
}
function resolveG(F,O){
  const gr=S.gr,id=F.g.act,A=F.g.A,top=F===gr.top;
  const post=top?0:(O.blockHeld?.35:0);
  switch(id){
    case 'g_pound':case 'g_elbow':case 'g_bodyp':case 'g_hammer':case 'g_power':gStrike(F,O,A,true);break;
    case 'b_punch':case 'b_elbow':gStrike(F,O,A,false);break;
    case 'g_pass':{
      const ch=.36+((sv(F,'gnp')+sv(F,'subO'))/2-sv(O,'subD'))*.008+(O.st<25?.15:0)+(O.rocked?.15:0)-(O.blockHeld?.12:0);
      if(Math.random()<ch){gr.prevPos=gr.pos;gr.trans=16;gr.pos++;gr.idle=0;ev(F,'pass');floatText(gr.cx,190,POSN[gr.pos],'#9fe0a8');say(`${F.nick}, ${POSN[gr.pos]}로 패스!`)}
      else say(`${O.nick}, 패스를 막고 버팁니다`);break}
    case 'g_back':{
      const ch=(gr.pos===3?.35:gr.pos===5?.3:.22)+(sv(F,'subO')-sv(O,'subD'))*.008+(O.st<25?.12:0);
      if(Math.random()<ch){gr.prevPos=gr.pos;gr.trans=16;gr.pos=4;gr.idle=0;floatText(gr.cx,190,'백 마운트','#9fe0a8');say(`${F.nick}, 등을 잡습니다! 훅까지 걸었어요`)}
      else say(`${O.nick}, 등을 내주지 않습니다`);break}
    case 'g_sub':{
      const name=subPick(F,TOP_SUBS[gr.pos]);
      const ch=.32+(sv(F,'subO')-sv(O,'subD'))*.009+(O.head<40?.08:0)+(O.st<25?.1:0);
      add(F,'subA',1);
      if(Math.random()<ch)startSub(F,O,name,24+(sv(F,'subO')-sv(O,'subD'))*.3);
      else{gr.prevPos=gr.pos;gr.trans=16;gr.pos=Math.max(0,gr.pos-1);say(`${F.nick}의 ${name} 시도, 놓치면서 ${POSN[gr.pos]}를 내줍니다`)}
      break}
    case 'g_stand':exitGround(`${F.nick}가 일어서며 스탠딩을 택합니다`);break;
    case 'b_sweep':{
      const ch=([.32,.24,.1,.07,0,.18][gr.pos]+(sv(F,'subO')-sv(O,'gnp'))*.005)*(1-post);
      if(Math.random()<ch){gr.top=F;gr.bot=O;gr.pos=0;gr.hd=-gr.hd;gr.idle=0;floatText(gr.cx,190,'스윕!','#9fe0a8');say(`${F.nick}, 스윕으로 포지션 역전!`);sfx('slam');ev(F,'sweep')}
      else say(`${F.nick}의 스윕 시도, ${O.nick}가 중심을 지킵니다`);break}
    case 'b_regard':{
      const ch=([0,.32,.32,.2,.2,.3][gr.pos]+(sv(F,'subD')-sv(O,'gnp'))*.006)*(1-post*.5);
      if(Math.random()<ch){gr.prevPos=gr.pos;gr.trans=16;gr.pos=gr.pos===5?0:gr.pos===4?2:gr.pos===3?1:gr.pos-1;gr.idle=0;floatText(gr.cx,190,POSN[gr.pos],'#9fe0a8');say(`${F.nick}, ${POSN[gr.pos]}로 회복합니다`)}
      else say(`${O.nick}가 포지션을 지킵니다`);break}
    case 'b_getup':{
      const ch=[.4,.3,.18,.07,.1,.34][gr.pos]+(sv(F,'tdd')-sv(O,'td'))*.006+(F.st>50?.05:-.1)-(F.rocked?.2:0)+(legF(F)-1)*.3;
      if(Math.random()<ch)exitGround(`${F.nick}, 케이지를 짚고 일어납니다`);
      else say(`${O.nick}가 다시 눌러 둡니다`);break}
    case 'b_sub':{
      const name=subPick(F,BOT_SUBS[gr.pos]);
      const ch=(.27+(sv(F,'subO')-sv(O,'subD'))*.009)*(1-post);
      add(F,'subA',1);
      if(Math.random()<ch)startSub(F,O,name,24+(sv(F,'subO')-sv(O,'subD'))*.3);
      else say(`${F.nick}의 ${name} 시도가 풀립니다`);break}
  }
}
function upGround(F){
  const gr=S.gr,top=F===gr.top,O=top?gr.bot:gr.top;
  if(top&&gr.trans>0)gr.trans--;
  if(F.flash>0)F.flash--;if(F.rocked>0)F.rocked--;
  F.st=clamp(F.st+.07*(.55+sv(F,'car')*.006)*(top&&(gr.pos===3||gr.pos===4)?1.3:1)-(!top&&gr.pos>=3?.018:0)+(F.exh?.025:0),0,stMax(F));upExh(F);
  if(top)add(F,'ctrl',1);
  if(F.g.act){F.g.t++;if(F.g.t===F.g.A.w){resolveG(F,O);if(!S.gr||S.sub||S.mode!=='fight')return}
    if(F.g.t>=F.g.A.w+F.g.A.r)F.g={act:null,t:0,A:null};return}
  if(F.slot){const id=F.slot;F.slot=null;startG(F,id)}
}
function aiGround(E,P){
  const D=S.D,gr=S.gr,top=E===gr.top,T=E.ai,pr=S.practice;
  if(pr&&pr.ai!=='normal'){E.blockHeld=pr.ai==='defend';if(--E.think<=0){E.think=90;if(!top&&Math.random()<.5)E.slot='b_getup'}return}
  if(E.blockT>0){E.blockT--;E.blockHeld=true}else E.blockHeld=false;
  if(!top&&P.g.act&&GA[P.g.act].dmg&&P.g.t===1&&Math.random()<D.react)E.blockT=P.g.A.w+4;
  if(top&&P.g.act&&['b_sweep','b_sub'].includes(P.g.act)&&P.g.t===1&&Math.random()<D.react*.8)E.blockT=P.g.A.w+4;
  if(--E.think>0)return;E.think=Math.round(D.think*1.8)+Math.floor(Math.random()*16);
  if(E.g.act)return;
  const s=k=>sv(E,k)/100;
  let o;
  if(top)o=[['g_pound',3+s('gnp')*2+(P.head<40?2.5:0)],['g_elbow',E.st>20?1.5+s('gnp'):0],['g_hammer',1+s('gnp')],['g_bodyp',1],['g_pass',gr.pos<3?.8+s('subO')*2.2:0],['g_back',gr.pos===2||gr.pos===3?T.sub*2:gr.pos===5?1.6:0],['g_sub',TOP_SUBS[gr.pos].length?(gr.pos===0?.3:1)*T.sub*1.7+(P.head<40?.8:0):0],['g_stand',T.td<.1&&T.kick>.3?1.4:.1],['g_power',E.meter>=100?4:0]];
  else o=[['b_punch',1.2],['b_elbow',.8],['b_sweep',gr.pos<4||gr.pos===5?T.sub*1.5+.3:0],['b_regard',gr.pos>0?1.3:0],['b_getup',1+s('tdd')*1.8],['b_sub',BOT_SUBS[gr.pos].length?T.sub*1.3:0],['cover',1+(E.head<40?2:0)+(E.st<25?1:0)]];
  const k=wpick(o);
  if(k==='cover')E.blockT=24;else E.slot=k;
}

/* ---------- submission ---------- */
function startSub(att,def,name,prog){
  S.sub={att,def,name,prog:clamp(prog,15,70),t:0,pow:SUBS[name]||1};
  att.g={act:null,t:0,A:null};def.g={act:null,t:0,A:null};
  ev(att,'sub');
  banner(name+'!','#ffd75e',50);say(`${att.nick}, ${name} 들어갑니다!`);sfx('crowd');color('sub',att,def);
}
const tapAmt=(F,role)=>3.6*(.6+sv(F,role==='att'?'subO':'subD')*.005)*(F.st<10?.6:1);
function mash(){
  if(S&&S.mirror){if(!S.spec&&S.netOut)S.netOut('p','mash');return}
  const s=S.sub;if(!s)return;const p=S.p;
  if(s.att===p)s.prog+=tapAmt(p,'att');else if(s.def===p)s.prog-=tapAmt(p,'def');
  p.st=Math.max(0,p.st-.35);sfx('tick');
}
function upSub(){
  const s=S.sub,D=S.D,e=S.e;s.t++;
  s.prog+=((sv(s.att,'subO')-sv(s.def,'subD'))/100)*.35*s.pow+(s.def.st<20?.06:0)-(s.att.st<15?.05:0)+(s.def.head<30?.04:0);
  if(!S.remote&&(!(S.practice&&S.practice.ai!=='normal')||s.att===e)){
    const role=s.att===e?'att':'def';
    if(Math.random()<D.mash*(.7+sv(e,role==='att'?'subO':'subD')*.004)){s.prog+=role==='att'?tapAmt(e,'att'):-tapAmt(e,'def');e.st=Math.max(0,e.st-.35)}
  }
  if(s.prog>=100){s.prog=100;
    if(S.practice&&S.practice.inf){say(`${s.def.nick} 탭! (연습 모드)`);floatText(S.gr?S.gr.cx:400,170,'탭!','#ffd75e');S.sub=null;if(S.gr)exitGround();return}
    finish(s.att,'서브미션',s.name);return}
  if(s.prog<=0||s.t>=420){
    const gr=S.gr;say(`${s.def.nick}, ${s.name}에서 빠져나옵니다!`);
    if(gr&&gr.top===s.att)gr.pos=gr.pos===5?0:Math.max(0,gr.pos-2);
    s.att.st=Math.max(0,s.att.st-14);S.sub=null;if(gr)gr.idle=0;
  }
}

function mashFor(p){const s=S.sub;if(!s)return;if(s.att===p)s.prog+=tapAmt(p,'att');else if(s.def===p)s.prog-=tapAmt(p,'def');p.st=Math.max(0,p.st-.35);sfx('tick')}
/* ---------- online: the remote fighter (b) is driven by the guest's inputs ---------- */
function remoteCtl(E,P){const R=S.rin||{};E.blockHeld=!!R.blk;if(!S.gr&&!S.cl){E.moveDir=R.ax||0;E.moveZ=R.az||0}}
function netInput(R){if(!S||!S.remote||!R)return;S.rin=R;const E=S.b,P=S.a;
  for(const q of R.q||[]){if(!(q[0]>(S.rq||0)))continue;S.rq=q[0];
    if(q[1]==='ff'){if(S.mode==='fight'||S.mode==='intro'){S.mode='fight';finish(P,'TKO','기권')}continue}
    if(S.mode!=='fight')continue;
    if(S.sub){mashFor(E);continue}if(q[1]==='mash')continue;E.slot=resolveFor(E,P,!!q[2],q[1]);E.bufT=10}}
const r1=v=>Math.round(v*10)/10;
const NK=['x','z','f','t','walk','koT','head','body','legs','lgL','lgR','cuts','st','stun','moveDir','meter','heart','rocked','flash'];
function nF(F){const o={s:F.state,b:F.blockHeld?1:0};for(const k of NK){const v=F[k];if(v)o[k]=typeof v==='number'?r1(v):v}
  if(F.A)o.A=[F.A.anim,F.A.w,F.A.a,F.A.r,F.A.special?1:0,F.A.kind||'',F.A.id||'',F.A.target||''];
  if(F.g&&(F.g.act||F.g.t))o.g=[F.g.act,F.g.t,F.g.A?F.g.A.w:0,F.g.A?F.g.A.r:0,F.g.A?F.g.A.dmg||0:0,F.g.A?F.g.A.target||'':''];
  if(F.react)o.re=[F.react.k,F.react.t,r1(F.react.d||0),F.react.up?1:0];if(F.inj)o.inj=Object.keys(F.inj);if(F.fouls)o.fo=F.fouls;return o}
function netSnap(){if(!S)return null;const o={fr:S.frame,m:S.mode,rd:S.round,rs:S.rounds,tm:S.timer,a:nF(S.a),b:nF(S.b),rf:[r1(S.ref.x),r1(S.ref.z||0),S.ref.f,S.ref.state,r1(S.ref.walk||0),S.ref.moving?1:0],cg:[r1(S.cage.x),r1(S.cage.z),r1(S.cage.ang)],th:r1(S.camTheta||0),ln:r1(S.lean||0)};
  if(S.gr)o.gr=[S.gr.top.side,S.gr.pos,r1(S.gr.cx),S.gr.hd,r1(S.gr.cz||0)];
  if(S.cl)o.cl=[S.cl.ctrl.side,S.cl.cage?1:0,r1(S.cl.cx),S.cl.dir,r1(S.cl.cz||0)];
  if(S.sub)o.sb=[S.sub.att.side,S.sub.name,r1(S.sub.prog),S.sub.t];
  if(S.banner)o.bn=[S.banner.text,S.banner.col,S.banner.t,S.banner.max,S.banner.sub||''];
  if(S.feed.length)o.fd=S.feed.map(f=>[f.text,f.t,f.who]);
  if(S.shake>.5)o.sh=r1(S.shake);if(S.flashScr)o.fs=S.flashScr;if(S.zoomKick>.01)o.zk=r1(S.zoomKick);if(S.camFocus)o.cf=S.camFocus;if(S.winSide)o.ws=S.winSide;
  if(S.ded)o.dd=[S.ded.a,S.ded.b];if(S.nl.length)o.nl=S.nl.slice(-14);
  if(S.result){const r=S.result;o.res={winner:r.winner,method:r.method,detail:r.detail,round:r.round,time:r.time,cards:r.cards}}
  return o}
function applyF(F,o){F.state=o.s;F.blockHeld=!!o.b;for(const k of NK){const v=o[k]??0;if(k==='x'||k==='z'){F['_t'+k]=v;if(F['_t'+k+'0']==null||Math.abs(F[k]-v)>60)F[k]=v;F['_t'+k+'0']=1}else F[k]=v}
  F.A=o.A?{anim:o.A[0],w:o.A[1],a:o.A[2],r:o.A[3],special:!!o.A[4],kind:o.A[5]||undefined,id:o.A[6],target:o.A[7]}:null;
  F.g=o.g?{act:o.g[0],t:o.g[1],A:o.g[0]?{w:o.g[2],r:o.g[3],dmg:o.g[4],target:o.g[5]}:null}:{act:null,t:0,A:null};
  F.react=o.re?{k:o.re[0],t:o.re[1],d:o.re[2],up:!!o.re[3]}:null;F.inj=o.inj?Object.fromEntries(o.inj.map(k=>[k,1])):null;F.fouls=o.fo||0}
function applyNet(o){if(!S||!S.mirror||!o)return;const by=x=>x==='a'?S.a:S.b,ot=x=>x==='a'?S.b:S.a,prevM=S.mode;
  S.mode=o.m==='replay'?'fight':o.m;S.round=o.rd;S.rounds=o.rs;S.timer=o.tm;applyF(S.a,o.a);applyF(S.b,o.b);
  const rf=o.rf;Object.assign(S.ref,{x:rf[0],z:rf[1],f:rf[2],state:rf[3],walk:rf[4],moving:!!rf[5]});S.cage={x:o.cg[0],z:o.cg[1],ang:o.cg[2]};S.camTheta=o.th;S.lean=o.ln;
  S.gr=o.gr?{top:by(o.gr[0]),bot:ot(o.gr[0]),pos:o.gr[1],cx:o.gr[2],hd:o.gr[3],cz:o.gr[4],idle:0}:null;
  S.cl=o.cl?{ctrl:by(o.cl[0]),other:ot(o.cl[0]),cage:!!o.cl[1],cx:o.cl[2],dir:o.cl[3],cz:o.cl[4],idle:0}:null;
  S.sub=o.sb?{att:by(o.sb[0]),def:ot(o.sb[0]),name:o.sb[1],prog:o.sb[2],t:o.sb[3]}:null;
  S.banner=o.bn?{text:o.bn[0],col:o.bn[1],t:o.bn[2],max:o.bn[3],sub:o.bn[4]||null}:null;
  S.feed=(o.fd||[]).map(f=>({text:f[0],t:f[1],who:f[2]}));S.shake=Math.max(S.shake,o.sh||0);S.flashScr=o.fs||0;S.zoomKick=o.zk||0;S.camFocus=o.cf||null;S.winSide=o.ws||null;
  if(o.dd)S.ded={a:o.dd[0],b:o.dd[1]};
  if(o.res)S.result=o.res;
  for(const e of o.nl||[]){if(e[0]<=(S.nlast||0))continue;S.nlast=e[0];const k=e[1];
    try{if(k==='b')blood(e[2],e[3],e[4],e[5]);else if(k==='a')bloodArc(e[2],e[3],e[4],e[5]);else if(k==='u')burst(e[2],e[3],e[4],e[5]);else if(k==='t')floatText(e[2],e[3],e[4],e[5],e[6]);else if(k==='w')sweat(e[2],e[3],e[4]);
      else if(k==='r')S.rings.push({x:e[2],y:e[3],r:4,l:14,big:!!e[4]});else if(k==='s')sfx(e[2]);else if(k==='i')sfxHit(e[2],e[3])}catch(_){}}
  S.netAt=performance.now();return prevM!==S.mode?S.mode:null}
function mirrorStep(){S.frame++;
  for(const F of [S.a,S.b]){if(F._tx!=null)F.x+=(F._tx-F.x)*.45;if(F._tz!=null)F.z=(F.z||0)+(F._tz-(F.z||0))*.45;if(F.react&&F.react.t<30)F.react.t+=.5}
  for(const r of S.rings){r.r+=r.big?3.2:2.2;r.l--}S.rings=S.rings.filter(r=>r.l>0);if(S.flashScr>0)S.flashScr--;
  for(const s of S.sparks){s.x+=s.vx;s.y+=s.vy;s.vy+=s.drop?.35:.25;s.l--;if(s.drop&&s.y>GY+2&&!s.st){s.st=1;s.l=0;if(S.stains.length<220){const C=S.cage,px=s.x-C.x,pz=rnd(-10,24)-C.z,co=Math.cos(-C.ang),si=Math.sin(-C.ang);S.stains.push({lx:px*co-pz*si,lz:px*si+pz*co,r:rnd(1.5,4)*(s.r?s.r/1.8:1)})}}}
  S.sparks=S.sparks.filter(s=>s.l>0);for(const t of S.texts){t.y-=.8;t.l--}S.texts=S.texts.filter(t=>t.l>0);
  S.shake*=.85;if(S.zoomKick)S.zoomKick*=.9}
/* ---------- corner coach: shouts a call every so often; doing what he says pays off ---------- */
function coachLine(P,E){const st=E.d.style,late=S.timer<60*20;
  if(S.gr&&S.gr.bot===P)return[pick(['일어나! 벽 짚고 일어나!','엉덩이 빼고 일어나!','바닥에 있으면 진다! 일어나!']),'getup',1];
  if(S.gr&&S.gr.top===P)return S.gr.pos<2?[pick(['패스해! 사이드로 넘어가!','가드 넘어가! 포지션 올려!']),'pass',1]:[pick(['파운딩! 레퍼리가 말릴 때까지!','위에서 눌러! 계속 때려!']),'gnp',3];
  if(S.cl)return S.cl.ctrl===P?[pick(['니킥 올려! 니킥!','붙었을 때 니킥 꽂아!']),'knee',2]:['프레임 만들고 빠져나와!','escape',1];
  if(E.rocked>0)return[pick(['지금이야!! 몰아붙여!!','흔들렸다! 끝내! 끝내!']),'any',2];
  if(late)return['마지막 20초! 다 쏟아부어!','any',3];
  if(P.st<28)return[pick(['숨 골라! 거리 벌리고 쉬어!','호흡! 호흡! 무리하지 마!']),null,0];
  if(P.head<45)return[pick(['턱 당기고 가드 올려!','머리 맞고 있어! 가드!']),null,0];
  if(E.legs<60)return[pick(['다리 흔들린다! 로킥 계속!','저 다리 끝났어! 로킥!']),'leg',2];
  if(E.body<62)return[pick(['몸통! 몸통 더 때려!','바디 아파한다! 계속!']),'body',2];
  if(S.lean<-8)return[pick(['라운드 뺏긴다! 손 더 내!','점수 밀려! 더 많이 때려!']),'any',3];
  if(st==='wrestler'&&Math.random()<.35)return['태클 들어온다! 가드 내리지 마!',null,0];
  if(st==='boxer'&&Math.random()<.35)return['복서야! 킥으로 거리 둬!','leg',1];
  return pick([['잽! 잽으로 거리 재!','jab',2],['머리 흔들고 들어가서 때려!','head',2],['테이크다운 한번 노려봐!','td',1],['바디 때리고 위로 올려!','body',1],['로킥 섞어! 다리 묶어!','leg',1],['원투! 원투!','head',2]])}
function coachTick(){if(S.demo||S.practice||S.mirror||S.remote||S.mode!=='fight'||S.o.coach===false)return;const P=S.p,C=S.coach;
  if(C){C.t++;if(C.want&&!C.done&&!C.fail){if(C.want==='getup'&&!S.gr&&!S.cl)coachWin();else if(C.want==='pass'&&S.gr&&S.gr.top===P&&S.gr.pos>C.p0)coachWin();else if(C.want==='td'&&S.gr&&S.gr.top===P)coachWin();else if(C.want==='escape'&&!S.cl)coachWin();
      if(!C.done&&C.t>C.dur)C.fail=true}
    if(C.t>C.dur+70){S.coach=null;S.coachCd=Math.max(300,1800-C.dur-70)}return}
  if((S.coachCd=(S.coachCd??600)-1)>0)return;
  let L=coachLine(P,S.e);if(!L[1]&&S.coachPrevNull)L=pick([['잽! 잽으로 거리 재!','jab',2],['머리 흔들고 들어가서 때려!','head',2],['로킥 섞어! 다리 묶어!','leg',1],['원투! 원투!','head',2]]);S.coachPrevNull=!L[1];S.coach={text:L[0],want:L[1],need:L[2]||0,n:0,dur:L[1]?330:140,t:0,p0:S.gr?S.gr.pos:0};sfx('coach');if(IC.Announcer&&IC.Announcer.say)IC.Announcer.say(L[0])}
function coachWin(){const C=S.coach,P=S.p;C.done=true;C.dur=C.t;P.meter=Math.min(100,(P.meter||0)+18);P.st=Math.min(stMax(P),P.st+10);floatText(P.x,140+zy(P),'코치 지시 성공!','#9fe0a8');sfx('coachok');S.coachWins=(S.coachWins||0)+1}
function coachHit(o,target){const C=S.coach;if(!C||C.done||C.fail||!C.want||o.blocked)return;const w=C.want,src=o.src;
  const ok=w==='any'||(w==='leg'&&target==='leg'&&src==='stand')||(w==='body'&&target==='body'&&src!=='ground')||(w==='head'&&target==='head'&&src==='stand')||(w==='knee'&&src==='clinch')||(w==='gnp'&&src==='ground'&&S.gr&&S.gr.top===S.p)||(w==='jab'&&/잽/.test(o.name||''));
  if(ok&&++C.n>=C.need)coachWin()}
/* ---------- judging ---------- */
function rpts(r){return r.dH*1+r.dB*.8+r.dL*.6+r.kd*15+r.td*5+r.ctrl/60*.5+r.subA*3+r.sigL*.3}
function judgeRound(){
  const a=rpts(S.a.r),b=rpts(S.b.r);
  const cards=[0,1,2].map(j=>{
    const na=a*(1+rnd(-.15,.15)),nb=b*(1+rnd(-.15,.15));
    const hi=Math.max(na,nb),lo=Math.min(na,nb);
    if(hi-lo<Math.max(2,hi*.04))return[10,10];
    const big=(hi>lo*1.8&&hi-lo>30)||Math.abs(S.a.r.kd-S.b.r.kd)>=2;
    return na>nb?[10,big?8:9]:[big?8:9,10];
  });
  const dd=S.ded||{a:0,b:0};if(dd.a||dd.b){for(const c of cards){c[0]-=dd.a;c[1]-=dd.b}S.ded={a:0,b:0}}
  return{a:Math.round(a),b:Math.round(b),cards,ded:dd.a||dd.b?{...dd}:null};
}
function decision(){
  const tot=[0,1,2].map(j=>S.rounds_.reduce((s,r)=>[s[0]+r.cards[j][0],s[1]+r.cards[j][1]],[0,0]));
  const votes=tot.map(t=>t[0]>t[1]?'a':t[1]>t[0]?'b':'d');
  const ca=votes.filter(v=>v==='a').length,cb=votes.filter(v=>v==='b').length,cd=votes.filter(v=>v==='d').length;
  let winner=null,detail='무승부';
  if(ca>cb){winner='a'}else if(cb>ca){winner='b'}
  if(winner){const w=winner==='a'?ca:cb;detail=w===3?'만장일치 판정':cd>0&&w===2?'다수 판정':'스플릿 판정'}
  else detail=cd===3?'만장일치 무승부':'스플릿 무승부';
  S.result={winner,method:winner?'판정':'무승부',detail,round:S.rounds,time:fmt(S.roundFrames),cards:tot};
  S.winSide=winner;S.mode='decision';S.phaseT=260;S.decT=0;
  for(const F of [S.a,S.b]){if(S.gr)exitGround();if(S.cl)exitClinch();F.state='idle'}
  {const C=S.cage;S.a.x=C.x-70;S.b.x=C.x+70;S.a.z=S.b.z=C.z;S.ref.x=C.x;S.ref.z=C.z-60}S.a.f=1;S.b.f=-1;sfx('bell');
}

/* ---------- flow ---------- */
function start(o){
  const D=DIFF[o.diff||'normal'];
  S={o,D,diffKey:o.diff||'normal',rounds:o.rounds||3,roundFrames:Math.round((o.roundSec||120)*60),round:1,timer:0,
    mode:'intro',phaseT:110,frame:0,sparks:[],texts:[],feed:[],banner:null,shake:0,slow:0,gr:null,cl:null,sub:null,
    held:{left:false,right:false,block:false},rounds_:[],paused:false,practice:o.practice||null,events:{},pbf:0,title:!!o.title,label:o.label||'',
    arena:ARENAS[o.arena!=null?o.arena:o.practice?0:o.title?3:2],pat:{...(o.pat||{})},wild:!!o.wild,lean:0,cardLead:0,zoomKick:0,
    demo:!!o.demo,rings:[],stains:[],cage:{x:400,z:0,ang:0},camTheta:0,hitstop:0,flashScr:0,rec:[],ref:{x:400,f:1,state:'start',walk:0},camFocus:null,winSide:null,replayOn:o.replay!==false};
  S.a=mkRun(o.a,'a');S.b=mkRun(o.b,'b');S.p=S.a;S.e=S.b;S.b.mul=D.mul;
  S.remote=!!o.remote;S.mirror=!!o.mirror;S.spec=!!o.spec;S.net=S.remote;S.nl=[];S.nseq=0;S.rin={};if(S.remote){S.b.mul=1;S.replayOn=false}
  if(S.mirror){S.replayOn=false;if(!S.spec){S.p=S.b;S.e=S.a}}
  if(o.condition){S.a.st=Math.min(100,S.a.st*o.condition);}
  S.inf=!!(S.practice);
  startRound();
  return S;
}
function startRound(){
  if(S.gr)exitGround();if(S.cl)exitClinch();S.sub=null;S.coach=null;S.coachCd=600;
  const a=S.a,b=S.b;a.x=250;b.x=550;a.z=b.z=0;a.f=1;b.f=-1;S.cage.x=400;S.cage.z=0;S.ref.z=-150;
  for(const F of [a,b]){F.state='idle';F.stun=0;F.vx=0;F.A=null;F.slot=null;F.queue=[];F.blockHeld=false;F.moveDir=0;F.moveZ=0;F.blockT=0;F.r=newR();F.rocked=0;F.g={act:null,t:0,A:null}}
  S.timer=S.roundFrames;S.mode='intro';S.ref.x=400;S.ref.state='start';
  if(S.round===1&&!S.practice&&!S.demo&&S.o.walkout!==false){startWalkout();return}
  S.phaseT=110;S.introLen=110;S.walk=null;
  banner(S.practice?'연습':`${S.round}라운드`,'#e9e6df',100,S.practice?S.arena.name:S.round===1?`${S.arena.name} · ${S.arena.att}`:S.round===S.rounds?(S.title?'챔피언십 라운드':'마지막 라운드'):null);
  sfx('bell');
  say(S.practice?'연습 모드: 시간 제한 없이 기술을 익혀 보세요':S.round===1?`${a.nick} 대 ${b.nick}, 경기 시작합니다!`:`${S.round}라운드, 다시 맞붙습니다`);
}
/* ---------- walkout & announcer ---------- */
const WK=[{k:'blueAisle',d:175},{k:'blueIn',d:55},{k:'blueAnn',d:130},{k:'redAisle',d:175},{k:'redIn',d:55},{k:'redAnn',d:130},{k:'tape',d:230},{k:'faceoff',d:175},{k:'touch',d:40},{k:'back',d:40},{k:'coach',d:130}];
/* signature entrance performance per fighting style */
const PERF={boxer:'shadow',kickboxer:'kicks',karate:'kicks',muaythai:'waikru',wrestler:'chest',sambo:'chest',bjj:'bow',brawler:'taunt',allround:'taunt'};
const PERFN={shadow:'섀도복싱',kicks:'허공에 하이킥',waikru:'와이크루 의식',chest:'가슴을 두드리며 포효',bow:'옥타곤에 절',taunt:'관중 도발'};
const songOf=F=>{const S0=IC.SONGS,k=IC.songPick?IC.songPick(F.d):null;return S0[k!=null&&S0[k]?k:IC.hash((F.d.id||'')+F.name)%S0.length]};
const AISLE0=-300,AISLE1=600;
function startWalkout(){
  const a=S.a,b=S.b;
  S.walk={i:0,t:0,k:'blueAisle',lines:[],ax:AISLE0,songA:songOf(a),songB:songOf(b),hype:0};S.introLen=1;S.phaseT=1;
  a.x=110;a.z=-30;a.f=1;b.x=760;b.z=-30;b.f=-1;a.state='idle';b.state='idle';b.hidden=true;
  S.ref.x=400;S.ref.z=-150;S.ref.state='idle';
  const cls=(IC.CLASSES.find(c=>c.id===a.d.cls)||{}).name||'';
  ann('main',S.title?`오늘 밤의 메인 이벤트! ${cls} 타이틀전, ${S.rounds}라운드 경기입니다!`:`다음 경기는 ${cls} ${S.rounds}라운드 경기입니다!`);
  sfx('crowd');
}
function annText(F,corner){
  const d=F.d,rec=d.rec||[0,0,0],st=STYLES[d.style].name;
  const title=S.title&&F.side==='b'?'디펜딩 챔피언, ':'';
  return `${corner} 코너! ${d.from} 출신! 전적 ${rec[0]}승 ${rec[1]}패${rec[2]?' '+rec[2]+'무':''}! ${st} 파이터! ${title}"${F.nick}"… ${F.name}!`;
}
function ann(kind,text){S.walk.lines.push({kind,text,t:0});if(S.walk.lines.length>3)S.walk.lines.shift();if(!S.demo&&IC.Announcer)IC.Announcer.say(text)}
function stepWalkout(){
  const W=S.walk,st=WK[W.i],a=S.a,b=S.b;W.t++;W.k=st.k;for(const l of W.lines)l.t++;if(W.pyro)W.pyro.t++;
  const walkTo=(F,x,z,sp=1.6)=>{const dx=x-F.x,dz=z-(F.z||0),d=Math.hypot(dx,dz);if(d>2){F.x+=dx/d*Math.min(sp,d);F.z+=dz/d*Math.min(sp,d);F.state='walk';F.walk+=.2;F.f=dx>1?1:dx<-1?-1:F.f}else F.state='idle'};
  const aisle=(F,song,corner)=>{
    if(W.t===1){W.ax=AISLE0;F.walkShirt=F.corner;F.walk=0;if(!S.demo&&IC.Sound&&IC.Sound.music){IC.Sound.music(false);IC.Sound.music(true,song)}
      ann(corner,`${corner==='blue'?'블루':'레드'} 코너, ${F.nick} ${F.name}! 입장곡 '${song.n}'과 함께 관중 사이로 걸어 나옵니다!`);sfx('crowd')}
    const pause=W.t>70&&W.t<125;F.perfK=PERF[F.d.style]||'taunt';
    if(!pause){W.ax+=(AISLE1-AISLE0)/(st.d-40);F.walk+=.16}
    W.ax=Math.min(W.ax,AISLE1);
    F.state=pause?'perf':W.ax>=AISLE1?'idle':'stroll';F.f=1;if(pause)F.perfT=W.t-70;
    W.hype=pause?1:Math.max(0,W.hype-.01);
    if(W.t===72){sfx('crowd');say(`${F.nick}, ${PERFN[F.perfK]}! 관중이 들썩입니다!`)}
    if(W.t===2)W.pyro={t:0,at:'tunnel'};if(W.t===72)W.pyro={t:0,at:'perf'};
    if(W.t%60===40)sfx('crowd');
  };
  switch(st.k){
    case 'blueAisle':aisle(a,W.songA,'blue');break;
    case 'blueIn':if(W.t===1){a.walkShirt=null;a.x=110;a.z=-30;W.pyro={t:0,at:'cage'};sfx('slam')}walkTo(a,250,0,3.6);break;
    case 'blueAnn':walkTo(a,250,0,3);a.f=1;if(W.t===1)ann('blue',annText(a,'블루'));if(W.t===60)sfx('reveal');if(W.t>40){a.perfK=PERF[a.d.style]||'taunt';a.state=W.t<110?'perf':'idle';a.perfT=W.t-40}if(W.t===62)W.pyro={t:0,at:'ann'};break;
    case 'redAisle':a.state='idle';aisle(b,W.songB,'red');break;
    case 'redIn':if(W.t===1){b.walkShirt=null;b.hidden=false;b.x=760;b.z=-30;W.pyro={t:0,at:'cage'};sfx('slam')}a.state='idle';walkTo(b,550,0,5.5);break;
    case 'redAnn':walkTo(b,550,0,3);b.f=-1;if(W.t===1)ann('red',annText(b,'레드'));if(W.t===60)sfx('reveal');if(W.t>40){b.perfK=PERF[b.d.style]||'taunt';b.state=W.t<110?'perf':'idle';b.perfT=W.t-40}if(W.t===62)W.pyro={t:0,at:'ann'};break;
    case 'tape':{a.state=b.state='idle';walkTo(a,250,0,3);walkTo(b,550,0,3);a.f=1;b.f=-1;if(W.t===1){ann('main','테일 오브 더 테이프! 두 선수를 비교해 봅니다');sfx('reveal')}break}
    case 'faceoff':{
      if(!W.bub){if(!S.demo&&IC.Sound&&IC.Sound.music)IC.Sound.music(false);ann('ref','레퍼리가 두 선수를 불러 모읍니다. 깨끗한 경기 부탁드립니다!');
        W.ev=pick(['push','stare','shout']);const tk=IC.talk||(()=>'…');W.bub=[{F:b,text:tk('weigh'),t0:40},{F:a,text:tk('weigh'),t0:62}]}
      a.f=1;b.f=-1;W.tension=0;
      if(W.t<45){a.state=b.state='idle';walkTo(a,345,0,2.4);walkTo(b,455,0,2.4);S.ref.state='start'}
      else if(W.t<120){a.state=b.state='idle';a.x=lerp(a.x,374+Math.sin(W.t*.08)*2,.06);b.x=lerp(b.x,426+Math.sin(W.t*.08+1)*2,.06);S.ref.state='watch';W.tension=Math.min(1,(W.t-45)/40);
        if(W.t%40===0)sfx('heart');if(W.t===50)ann('ref','이마가 닿을 듯한 거리! 신경전이 대단합니다!')}
      else{const k=W.t-120;W.tension=1;
        if(W.t===120){if(W.ev==='push'){sfx('slam');sfx('crowd');banner('밀치기!','#ff6b5e',48);ann('ref',`${b.nick}, ${a.nick}를 밀어냅니다! 레퍼리가 급히 떼어 놓습니다!`)}else if(W.ev==='shout'){sfx('crowd');banner('고성이 오갑니다!','#ffd75e',48);ann('ref','서로를 향해 고함! 관중이 끓어오릅니다!')}else{sfx('crowd');banner('눈을 피하지 않는다!','#ffd75e',70);ann('ref','누구도 먼저 눈을 돌리지 않습니다!')}}
        if(W.ev==='push'){if(k<14){b.state='clinch';a.x=lerp(a.x,330,.25)}else{b.state='idle'}a.state=k>8?'celebrate':'hit';S.ref.state='stop'}
        else if(W.ev==='shout'){a.state=b.state=(k%40<20)?'celebrate':'idle';S.ref.state='stop'}
        else{a.state=b.state='block';S.ref.state='watch'}
        if(k>40){walkTo(a,345,0,1.2);walkTo(b,455,0,1.2);a.f=1;b.f=-1}}
      break}
    case 'touch':W.tension=0;if(W.ev==='push'){a.state=b.state='idle';if(W.t===1){banner('글러브 터치 거부!','#ff6b5e',70);ann('ref',`${b.nick}, 글러브 터치를 거부합니다! 감정이 끓어오릅니다!`);sfx('crowd')}}else{a.state=b.state='block';a.x=lerp(a.x,362,.15);b.x=lerp(b.x,438,.15);if(W.t===18)sfx('block')}break;
    case 'back':a.state=b.state='walk';walkTo(a,250,0,4);walkTo(b,550,0,4);a.f=1;b.f=-1;break;
    case 'coach':{a.state=b.state='idle';walkTo(a,190,0,3);walkTo(b,610,0,3);a.f=-1;b.f=1;
      if(W.t===1){const E=b,t=E.ai,L=[];if(t.td>.25)L.push('저 친구 태클 들어온다. 가드 올리고 아래로 눌러서 스프롤!');if(t.kick>.4)L.push('킥이 많아. 차고 들어올 때 잡아서 넘겨!');if(t.sub>.5)L.push('밑에 깔리면 위험해. 그라운드는 피하고 서서 싸워!');
        if(E.s.chin<75)L.push('맷집이 약해. 머리를 노려!');if(E.s.car<75)L.push('체력이 약점이야. 바디 치고 끝까지 압박해!');L.push('잽으로 거리 재고, 서두르지 마. 숨 아끼면서 가자!');
        ann('coach',`코치: "${pick(L.slice(0,3))}"`);sfx('coach')}
      if(W.t>110){a.f=1;b.f=-1}break}
  }
  if(W.t>=st.d){W.i++;W.t=0;
    if(W.i>=WK.length)endWalkout();else W.k=WK[W.i].k}
}
function endWalkout(){
  if(IC.Sound&&IC.Sound.music)IC.Sound.music(false);
  const a=S.a,b=S.b;S.walk=null;b.hidden=false;a.walkShirt=b.walkShirt=null;a.x=250;b.x=550;a.z=b.z=0;a.f=1;b.f=-1;a.state=b.state='idle';a.walk=b.walk=0;
  S.mode='intro';S.phaseT=70;S.introLen=70;S.ref.x=400;S.ref.state='start';
  banner('1라운드','#e9e6df',80,`${S.arena.name} · ${S.arena.att}`);sfx('bell');
  if(IC.Announcer)IC.Announcer.say('파이트!');
  say(`${a.nick} 대 ${b.nick}, 경기 시작합니다!`);
}
function skipWalkout(){if(S&&S.walk&&(S.walk.i>0||S.walk.t>80)){if(IC.Announcer)IC.Announcer.stop();endWalkout()}}

function roundTalk(j){const a=S.a,b=S.b,ra=a.r,rb=b.r,w=j.a>j.b?a:b,l=w===a?b:a,close=Math.abs(j.a-j.b)<Math.max(4,Math.max(j.a,j.b)*.15);
  const t=[`${S.round}R 정리: 유효타 ${ra.sigL}-${rb.sigL}, 테이크다운 ${ra.td}-${rb.td}${ra.kd||rb.kd?`, 녹다운 ${ra.kd}-${rb.kd}`:''}.`];
  t.push(close?`정말 박빙이었어요. 심판마다 갈릴 수 있는 라운드입니다.`:`이번 라운드는 ${w.nick} 쪽이 확실히 가져갔다고 봅니다.`);
  if(l.legs<60)t.push(`${l.nick}의 다리 상태가 걱정이에요. 다음 라운드 로킥 하나하나가 치명적입니다.`);
  else if(l.st<35)t.push(`${l.nick}, 체력 회복이 관건입니다.`);
  return t}
function endRound(){
  const j=judgeRound();j.talk=roundTalk(j);
  S.rounds_.push({...j,ra:{...S.a.r},rb:{...S.b.r}});setTimeout(()=>{if(S&&S.mode==='pause')say(j.talk[1],'color')},300);
  S.sub=null;S.mode='pause';S.phaseT=80;banner('TIME','#e9e6df',75);sfx('bell');
}
function advice(F,O){
  const t=[];
  if(O.legs<60)t.push('다리가 많이 상했어. 로킥을 계속 차.');
  if(F.legs<55)t.push('로킥 맞고 있어. 체크하든지 거리를 좁혀.');
  if(O.body<60)t.push('바디가 먹힌다. 바디샷 섞어서 체력 빼.');
  if(F.r.tdA>0&&F.r.td===0)t.push('태클이 다 읽히고 있어. 상대가 칠 때 들어가.');
  if(O.r.td>=2)t.push('계속 넘어가고 있어. 상대가 들어올 때 가드 눌러서 스프롤!');
  if(F.st<40)t.push('숨 좀 골라. 쓸데없이 손 내지 말고.');
  if(S.pbf>.5)t.push('가드만 올리고 있으면 레그킥이랑 태클에 당한다.');
  if(F.r.sigL<O.r.sigL*.7)t.push('손이 너무 안 나가. 잽부터 내.');
  if(O.head<55)t.push('상대 흔들린다. 들어가서 마무리해!');
  if(!t.length)t.push('잘하고 있어. 지금 리듬 그대로 가.');
  return t.slice(0,2);
}
function setPlan(p){if(S)S.a.plan=p}
function next(){
  if(!S)return;S.round++;
  for(const F of [S.a,S.b]){if(F.cuts>=2&&Math.random()<.6)F.cuts--}
  if(S.b.plan==null||Math.random()<.5)S.b.plan=pick(['press','wrestle','safe',null]);
  for(const F of [S.a,S.b]){F.head=Math.min(100,F.head+18);F.body=Math.min(100,F.body+10);F.lgL=Math.min(100,F.lgL+6);F.lgR=Math.min(100,F.lgR+6);syncLegs(F);F.exh=false;F.st=stMax(F)}
  startRound();
}
function topHL(){const L=(S.hlPend||[]).slice().sort((x,y)=>y.score-x.score);const out=[];for(const h of L){if(out.length>=3)break;if(!out.some(o=>Math.abs(o.at-h.until)<40))out.push({label:h.label,frames:h.frames,at:h.until})}return out.sort((x,y)=>x.at-y.at)}
function end(){const o=S.o;const r={...S.result,highlights:topHL(),injA:S.a.inj?Object.keys(S.a.inj):[],injB:S.b.inj?Object.keys(S.b.inj):[],fouls:{a:S.a.fouls||0,b:S.b.fouls||0},perfects:S.a.perfects||0,coachWins:S.coachWins||0,heartA:!!S.a.heartUsed,heartB:!!S.b.heartUsed,rounds:S.rounds_,stats:{a:{...S.a.tot},b:{...S.b.tot}},hp:{a:{h:S.a.head,b:S.a.body,l:S.a.legs},b:{h:S.b.head,b:S.b.body,l:S.b.legs}},a:S.a.d,b:S.b.d,pat:{...S.pat},wild:!!S.wild,wildN:S.wildN||0};
  r.perf=r.method!=='판정'&&r.method!=='무승부';
  r.fotn=(r.stats.a.dH+r.stats.b.dH)>140&&Math.min(r.stats.a.sigL,r.stats.b.sigL)>25;
  if(o.onEnd)o.onEnd(r)}
function hlTick(){if(!S.hlPend||!S.hlPend.length)return;const f=S.rec[S.rec.length-1];for(const h of S.hlPend)if(S.frame<=h.until)h.frames.push(f)}
function step(){
  S.frame++;S.heat=(S.heat||0)*.992;if(S.kick&&--S.kick.t<=0)S.kick=null;if(S.impacts)for(let i=S.impacts.length-1;i>=0;i--)if(--S.impacts[i].t<=0)S.impacts.splice(i,1);
  const P=S.p,E=S.e;
  if(S.mode==='fight'){
    if(P.bufT>0)P.bufT--;else if(!S.demo)P.slot=null;
    if(S.demo){if(S.sub){if(Math.random()<.11)mash()}else if(S.gr)aiGround(P,E);else if(S.cl)aiClinch(P,E);else{aiStand(P,E);S.held.left=P.moveDir<0;S.held.right=P.moveDir>0;S.held.block=P.blockHeld}}
    P.blockHeld=S.held.block;
    if(S.remote){if(E.bufT>0)E.bufT--;else E.slot=null}
    if(S.sub)upSub();
    else if(S.gr){
      S.remote?remoteCtl(E,P):aiGround(E,P);upGround(S.gr.top);if(S.gr&&!S.sub&&S.mode==='fight')upGround(S.gr.bot);
      if(S.gr&&!S.sub){S.gr.idle++;if(S.gr.idle>720)exitGround('레퍼리가 두 선수를 일으켜 세웁니다')}
    }else if(S.cl){
      S.remote?remoteCtl(E,P):aiClinch(E,P);upClinch(S.cl.ctrl);if(S.cl&&S.mode==='fight')upClinch(S.cl.other);
      if(S.cl){S.cl.idle++;if(S.cl.cage){const C=S.cage,hz=(S.cl.cz||0)-C.z,half=Math.sqrt(Math.max(0,cageR()*cageR()-hz*hz)),wall=C.x+S.cl.dir*half;S.cl.cx=lerp(S.cl.cx,wall-S.cl.dir*26,.02)}clinchPos();if(S.cl.idle>480)exitClinch('레퍼리가 클린치를 떼어놓습니다')}
    }else{
      P.moveDir=S.held.ax?S.held.ax:(S.held.right?1:0)-(S.held.left?1:0);
      if(!S.demo)P.moveZ=S.held.az?S.held.az:(S.held.dn?1:0)-(S.held.up?1:0);
      S.pbf=S.pbf*.996+(P.blockHeld?.004:0);
      S.remote?remoteCtl(E,P):aiStand(E,P);upStand(P,E);if(S.mode==='fight'&&!S.gr&&!S.cl)upStand(E,P);if(!S.gr&&!S.cl){separate();camFrame()}
    }
    if(S.mode==='fight'&&S.frame%30===0){const cur={a:rpts(S.a.r),b:rpts(S.b.r)},prev=S.rounds_.reduce((t,r)=>{const c=r.cards[0];return t+(c[1]-c[0])},0);S.lean=cur.a-cur.b;S.cardLead=prev+(S.lean<0?1:S.lean>0?-1:0)}
    if(S.mode==='fight'&&!S.inf&&--S.timer<=0){S.timer=0;endRound()}
    coachTick();
    S.rec.push(snap());if(S.rec.length>240)S.rec.shift();
    hlTick();
  }else if(S.mode==='ko'){
    for(const F of [S.a,S.b])if(F.state==='ko')F.koT++;
    if(S.rec.length<240)S.rec.push(snap());{const f=snap();for(const h of S.hlPend||[])if(S.frame<=h.until)h.frames.push(f)}
    if(--S.phaseT<=0){
      if(S.replayOn&&!S.practice&&!S.demo&&S.rec.length>60){S.mode='replay';S.rp={frames:S.rec.slice(-170),i:0,sub:0}}
      else startOutro();
    }
  }else if(S.mode==='foul'){
    const V=S.foulV;if(S.foulK!=='fence'){V.state=S.foulT>40?'hit':'idle';V.stun=0}
    if(--S.foulT<=0){S.mode='fight';V.state='idle';banner('경기 재개','#9fe0a8',45);say(S.foulK==='fence'?'경고 후 경기 재개합니다.':`${V.nick}, 회복하고 다시 시작합니다.`)}
  }else if(S.mode==='doc'){
    const L=S.docF;L.state='idle';other(L).state='idle';
    if(--S.docT<=0){const stop=Math.random()<clamp(.25+(L.cuts-5)*.15+(L.head<50?.2:0),0,.8);
      if(stop){S.mode='fight';finish(other(L),'TKO','닥터 스톱 (컷)');say(`닥터가 고개를 젓습니다! ${L.nick}, 닥터 스톱!`)}
      else{S.mode='fight';L.cuts=4;banner('경기 재개','#9fe0a8',50);say(`닥터 OK 사인. ${L.nick}, 경기를 이어갑니다!`)}}
  }else if(S.mode==='decision'){
    S.decT++;
    const r=S.result;if(r&&r.cards){[50,90,130].forEach((t,i)=>{if(S.decT===t){const c=r.cards[i];sfx('tick');say(`심판 ${i+1}, ${Math.max(c[0],c[1])}-${Math.min(c[0],c[1])} ${c[0]===c[1]?'무승부':c[0]>c[1]?S.a.nick:S.b.nick}`)}});
      if(S.decT===180){sfx('reveal');const w=r.winner?(r.winner==='a'?S.a:S.b):null;say(w?`${r.detail}로, 승자는… ${w.nick}!`:'무승부입니다!')}}
    if(--S.phaseT<=0)startOutro();
  }else if(S.mode==='outro'){
    for(const F of [S.a,S.b])if(F.state==='ko')F.koT++;
    if(--S.phaseT<=0){S.mode='over';end()}
  }else if(S.mode==='intro'){
    if(S.walk)stepWalkout();
    else if(--S.phaseT<=0){S.mode='fight';banner('FIGHT!','#ffd75e',50)}
  }else if(S.mode==='pause'){
    if(--S.phaseT<=0){
      if(S.round>=S.rounds)decision();
      else{S.mode='between';const last=S.rounds_[S.rounds_.length-1];
        /* doctor looks at bad cuts between rounds */
        for(const L of [S.a,S.b]){if(L.cuts>=4&&L.head<55&&!S.practice&&Math.random()<.3+(L.cuts-4)*.15){S.mode='fight';finish(other(L),'TKO','닥터 스톱 (라운드 사이)');say(`라운드 사이 닥터 체크… ${L.nick}, 더 이상 경기를 이어갈 수 없습니다!`);return}}
        if(S.o.onRound)S.o.onRound({round:S.round,last,all:S.rounds_,advice:advice(S.a,S.b),a:S.a,b:S.b})}
    }
  }
  upRef();
  for(const r of S.rings){r.r+=r.big?3.2:2.2;r.l--}S.rings=S.rings.filter(r=>r.l>0);
  if(S.flashScr>0)S.flashScr--;
  for(const s of S.sparks){s.x+=s.vx;s.y+=s.vy;s.vy+=s.drop?.35:.25;s.l--;if(s.drop&&s.y>GY+2&&!s.st){s.st=1;s.l=0;if(S.stains.length<220){const C=S.cage,px=s.x-C.x,pz=rnd(-10,24)-C.z,co=Math.cos(-C.ang),si=Math.sin(-C.ang);S.stains.push({lx:px*co-pz*si,lz:px*si+pz*co,r:rnd(1.5,4)*(s.r?s.r/1.8:1)})}}}
  S.sparks=S.sparks.filter(s=>s.l>0);
  for(const t of S.texts){t.y-=.8;t.l--}
  S.texts=S.texts.filter(t=>t.l>0);
  for(const f of S.feed)f.t--;S.feed=S.feed.filter(f=>f.t>0);
  for(const F of [S.a,S.b])if(F.heart>0&&S.mode==='fight')F.heart--;
  if(S.comboFx&&--S.comboFx.t<=0)S.comboFx=null;
  if(S.banner&&--S.banner.t<=0)S.banner=null;
  S.shake*=.85;if(S.zoomKick)S.zoomKick*=.9;
}
const lerp=(a,b,t)=>a+(b-a)*t;
let slowTick=0;
const SNAPK=['x','z','moveZ','f','state','t','vx','walk','blockHeld','rocked','flash','koT','head','body','legs','lgL','lgR','stance','exh','cuts','st','stun','moveDir'];
function snapF(F){const o={};for(const k of SNAPK)o[k]=F[k];o.A=F.A?{anim:F.A.anim,w:F.A.w,a:F.A.a,r:F.A.r,special:F.A.special,kind:F.A.kind,id:F.A.id}:null;o.g={act:F.g.act,t:F.g.t,A:F.g.A?{w:F.g.A.w,r:F.g.A.r,dmg:F.g.A.dmg,target:F.g.A.target}:null};return o}
function snap(){return{a:snapF(S.a),b:snapF(S.b),gr:S.gr?{top:S.gr.top.side,pos:S.gr.pos,cx:S.gr.cx,hd:S.gr.hd,cz:S.gr.cz}:null,cl:S.cl?{ctrl:S.cl.ctrl.side,cage:S.cl.cage,cx:S.cl.cx,dir:S.cl.dir,cz:S.cl.cz}:null,sub:S.sub?{att:S.sub.att.side,name:S.sub.name,prog:S.sub.prog}:null,ref:{...S.ref},cage:{...S.cage},th:S.camTheta}}
function replayView(){
  const r=S.rp,fr=r.frames[Math.min(r.i,r.frames.length-1)];
  const a=Object.assign(Object.create(S.a),fr.a),b=Object.assign(Object.create(S.b),fr.b),by=x=>x==='a'?a:b,ot=x=>x==='a'?b:a;
  const V=Object.create(S);V.a=a;V.b=b;V.p=a;V.e=b;
  V.gr=fr.gr?{top:by(fr.gr.top),bot:ot(fr.gr.top),pos:fr.gr.pos,cx:fr.gr.cx,hd:fr.gr.hd,cz:fr.gr.cz}:null;
  V.cl=fr.cl?{ctrl:by(fr.cl.ctrl),other:ot(fr.cl.ctrl),cage:fr.cl.cage,cx:fr.cl.cx,dir:fr.cl.dir,cz:fr.cl.cz}:null;
  V.sub=fr.sub?{att:by(fr.sub.att),def:ot(fr.sub.att),name:fr.sub.name,prog:fr.sub.prog,t:0}:null;
  V.ref=fr.ref;V.cage=fr.cage;V.camTheta=fr.th;V.replay=true;V.rpProg=r.i/r.frames.length;V.sparks=[];V.texts=[];V.rings=[];V.banner=null;V.feed=[];V.slow=0;V.shake=0;V.flashScr=0;
  return V;
}
function startOutro(){
  S.mode='outro';S.phaseT=200;S.rp=null;S.slow=0;
  const W=S.winSide?(S.winSide==='a'?S.a:S.b):null,L=W?other(W):null;
  if(S.gr){const {cx,hd}=S.gr;S.a.z=S.b.z=S.gr.cz||0;if(W){W.x=cx-hd*70;L.x=cx+hd*30;L.state='ko';L.koT=99;L.f=-hd;W.f=hd}S.gr=null}
  if(S.cl)S.cl=null;S.sub=null;
  for(const F of [S.a,S.b]){if(F!==L||L.state!=='ko'){F.state=F===W?'celebrate':W?'dejected':'idle';F.t=0;F.A=null}}
  if(L&&L.state==='ko'&&L.koT<30)L.koT=30;
  inCage(S.a);inCage(S.b);
  if(W)banner(W.nick,'#ffd75e',190,S.result.method==='판정'?S.result.detail:`${S.result.method} · ${S.result.round}R ${S.result.time}`);
  sfx('crowd');
}
function upRef(){
  const R=S.ref,a=S.a,b=S.b;let tx=R.x,st='idle';
  if(S.mode==='intro'){tx=S.walk&&WK[S.walk.i]&&['faceoff','touch'].includes(WK[S.walk.i].k)?400:S.walk?400:400;st=S.walk?(WK[S.walk.i].k==='faceoff'||WK[S.walk.i].k==='touch'?'start':'idle'):S.phaseT<70?'start':'idle'}
  else if(S.mode==='ko'){
    /* stoppage: the referee sprints in, gets his body between them and shields the beaten fighter, then waves it off */
    const L=S.camFocus==='a'?a:b,W=L===a?b:a,lx=S.gr?S.gr.cx:L.x,side=(W.x<lx?-1:1),k=200-S.phaseT,m=S.result&&S.result.method;
    tx=lx+side*(S.gr?18:38);const arrived=Math.abs(R.x-tx)<14;
    if(!arrived)st='stop';else if(S.phaseT<70)st='stop';else st=k<(m==='TKO'?70:45)&&!S.gr?'push':'cover';
    if(arrived&&!S.koRefIn){S.koRefIn=1;if(!S.demo){say(m==='서브미션'?'레퍼리가 뛰어들어 두 선수를 떼어 놓습니다!':m==='TKO'?'레퍼리가 몸을 던져 막아섭니다! 경기 끝!':'레퍼리가 곧바로 달려들어 경기를 멈춥니다!');sfx('slam')}}
    if(st==='push'&&!S.gr){W.x+=side*1.7;inCage(W);W.f=-side;if(W.state!=='celebrate')W.state='walk';W.walk=(W.walk||0)+.2}
    else if(k>90&&W.state!=='ko'&&!S.gr)W.state='celebrate';
    const lz=S.gr?(S.gr.cz||0):(L.z||0);R.z=(R.z??-150)+((lz+14-(R.z??-150))*.12);
    const d=tx-R.x;R.x+=clamp(d*.18,-7.5,7.5);R.walk+=Math.min(1,Math.abs(d)*.06)*.38;R.f=lx>R.x?1:-1;R.state=st;R.moving=Math.abs(d)>3;inCage(R);return}
  else if(S.mode==='outro'||S.mode==='decision'){const W=S.winSide?(S.winSide==='a'?a:b):null;tx=W?W.x+(W.x<400?42:-42):400;st=S.mode==='outro'&&W?'raise':'idle'}
  else if(S.mode==='foul'||S.mode==='doc'){const m=(a.x+b.x)/2;tx=m;st='stop'}
  else if(S.gr){tx=S.gr.cx-S.gr.hd*120;st='crouch'}
  else if(S.cl){tx=S.cl.cx+(S.cl.cx<400?110:-110);st='watch'}
  else{const m=(a.x+b.x)/2;tx=m+(m<=400?-200:200);st='watch'}
  tx=clamp(tx,70,730);
  const az=S.gr?(S.gr.cz||0):S.cl?(S.cl.cz||0):((a.z||0)+(b.z||0))/2;const tz=S.walk&&['faceoff','touch'].includes(WK[S.walk.i].k)?(S.walk.tension>0&&S.walk.ev!=='push'?az-130:az-60):az-150;R.z=(R.z??-150)+((tz-(R.z??-150))*.05);R.z=Math.min(R.z,S.walk?az-45:az-110);
  const d=tx-R.x;R.x+=clamp(d*.06,-3.2,3.2);inCage(R);R.walk+=Math.min(1,Math.abs(d)*.04)*.22;
  const focus=S.gr?S.gr.cx:S.cl?S.cl.cx:(a.x+b.x)/2;R.f=focus>R.x?1:-1;R.state=st;R.moving=Math.abs(d)>4;
}
function tick(n){
  if(!S)return;if(S.mirror){for(let i=0;i<n;i++)mirrorStep();return}
  if(S.paused)return;
  for(let i=0;i<n;i++){
    if(S.mode==='between'||S.mode==='over')return;
    if(S.mode==='replay'){const r=S.rp;if(++r.sub%(r.hl?2:3)===0)r.i++;S.frame++;if(r.i>=r.frames.length){if(r.hl){const nx=S.hlQ&&S.hlQ.shift();if(nx){S.rp={frames:nx.frames,i:0,sub:0,hl:true,label:nx.label}}else{S.mode='over';S.rp=null;const cb=S.hlDone;S.hlDone=null;if(cb)cb();return}}else startOutro()}continue}
    if(S.hitstop>0&&S.mode==='fight'){S.hitstop--;S.frame++;continue}
    if(S.slow>0){S.slow--;if((++slowTick)%3){S.frame++;continue}}
    step();
  }
}

/* ---------- controls context ---------- */
const I=(id,label,o={})=>({id,label,...o});
/* simplified pad: 6 buttons per situation, holding guard turns each into its alternate move (like a modifier) */
function resolve(id){return resolveFor(S.p,S.e,!!S.held.block,id)}
function resolveFor(P,E,g,id){
  const dist=Math.abs(E.x-P.x);
  switch(id){
    case '@jab':return g?(S.wild?'eyepoke':'bodyshot'):'jab';
    case '@cross':return g?'slip':'cross';
    case '@hook':return g?'upper':'hook';
    case '@kick':return g?(S.wild?'lowblow':'calf'):dist>110?'highkick':dist>92?'midkick':'lowkick';
    case '@grap':{const sh=E.state==='attack'&&E.A&&E.A.kind==='shoot'&&E.t<=E.A.w+E.A.a;return sh?'clinch':(g||dist<=86)?'clinch':'td'}
    case '@cp':return g?'c_elbow':'c_short';
    case '@ck':return g?(S.wild?'c_hbutt':'c_kneeH'):'c_knee';
    case '@cpos':return S.cl&&S.cl.ctrl===P?'c_cage':'c_rev';
    case '@gp':return g?'g_bodyp':'g_pound';
    case '@ge':return g?(S.wild?'g_soccer':'g_hammer'):'g_elbow';
    case '@adv':{const pos=S.gr?S.gr.pos:0;return pos<2?'g_pass':pos===2?(g?'g_back':'g_pass'):'g_back'}
    case '@bp':return g?'b_elbow':'b_punch';
  }
  return id;
}
function context(){
  if(!S)return null;
  const P=S.p,full=P.meter>=100,dim=!(S.mode==='fight'),g=!!S.held.block;
  const off=()=>I('',' — ',{dim:true});
  let key,left,grid,hint;
  if(S.sub){
    const att=S.sub.att===P;key='sub'+att;
    left=[off(),off()];
    grid=Array.from({length:6},()=>I('mash','연타!',{mash:true}));
    hint=att?`${S.sub.name}! 버튼이나 화면을 빠르게 연타해서 조이세요.`:`${S.sub.name}에 걸렸습니다! 연타해서 빠져나오세요.`;
  }else if(S.gr){
    const gr=S.gr,top=gr.top===P,pos=gr.pos,X=!!P.exh,wd=!!S.wild;key=(top?'t':'b')+pos+full+g+X+wd;
    if(top){
      const subs=TOP_SUBS[pos];
      left=[off(),I('block','포스처',{hold:true})];
      grid=[I('@gp',g?'바디 파운딩':'파운딩'),I('@ge',g?(wd?'사커킥':'해머피스트'):'엘보',{dim:X&&!g}),I('@adv',pos<2?'패스':pos===2?(g?'백 테이크':'패스'):pos===3||pos===5?'백 테이크':'—',{dim:pos===4||X,tone:'g'}),
        I('g_sub','서브미션',{dim:!subs.length||X,tone:'g'}),I('g_stand','일어서기',{tone:'g'}),I('g_power','파워 파운딩',{dim:!full||X,ready:full,tone:'s'})];
      hint=pos===5?'프론트 헤드락! 상대는 터틀입니다. 서브미션(길로틴·다스)이나 백 테이크를 노리세요.':X?'탈진 상태 — 포지션을 지키며 숨을 고르세요. 마운트·백 상위에서는 회복이 1.3배 빠릅니다.':`상위 · ${POSN[pos]}. 패스로 포지션을 올리면 파운딩이 세지고 서브미션이 열려요. 포스처를 누른 채 파운딩 = 바디 파운딩.`;
    }else{
      const subs=BOT_SUBS[pos];
      left=[off(),I('block','커버',{hold:true})];
      grid=[I('@bp',g?'엘보':'펀치'),I('b_sweep',pos===5?'싱글렉 역전':'스윕',{dim:pos===4||X,tone:'g'}),I('b_regard',pos===5?'가드 당기기':'리가드',{dim:pos===0,tone:'g'}),
        I('b_sub',subs.length?'서브미션':'—',{dim:!subs.length||X,tone:'g'}),I('b_getup','일어나기',{tone:'g'}),off()];
      hint=X?'탈진 상태 — 커버로 버티며 숨을 고르고, 일어나기·리가드로 빠져나오세요.':pos===5?'터틀 자세로 눌렸어요! 가드 당기기·싱글렉 역전·일어나기로 빠져나오세요.':`하위 · 상대가 ${POSN[pos]}. 커버로 파운딩을 막고, 리가드·스윕·일어나기로 빠져나오세요.`;
    }
  }else if(S.cl){
    const ctrl=S.cl.ctrl===P,X=!!P.exh,wd=!!S.wild;key='c'+ctrl+S.cl.cage+g+X+wd;
    left=[off(),I('block','프레임',{hold:true})];
    grid=[I('@cp',g?'엘보':'숏 펀치',{dim:X&&g}),I('@ck',g?(wd?'헤드버트':'헤드 니킥'):'니킥',{dim:X&&g}),I('c_trip','클린치 TD',{dim:X,tone:'g'}),
      I('@cpos',ctrl?'케이지 압박':'포지션 역전',{dim:ctrl&&S.cl.cage||X,tone:'g'}),I('c_brk','브레이크',{tone:'g'}),I('c_thigh','허벅지 니킥')];
    hint=ctrl?'클린치 주도권. 니킥·엘보로 데미지를 쌓거나 케이지로 밀어 넘기세요. 프레임을 누른 채 누르면 엘보·헤드 니킥.':'클린치에 잡혔어요. 역전하거나 브레이크로 빠져나오세요.';
  }else{
    const E=S.e,shooting=E.state==='attack'&&E.A&&E.A.kind==='shoot'&&E.t<=E.A.w+E.A.a,dist=Math.abs(E.x-P.x);
    const kick=g?'카프킥':dist>110?'하이킥':dist>92?'미들킥':'로킥';
    const X=!!P.exh,wd=!!S.wild;key='s'+full+P.d.special+shooting+g+kick+(dist<=86)+X+wd+P.stance;
    left=[I('move','이동',{hold:true}),I('block','가드',{hold:true})];
    grid=[I('@jab',g?(wd?'눈 찌르기':'바디샷'):'잽'),I('@cross',g?'회피':'크로스',{dim:X&&!g}),I('@hook',g?'어퍼컷':'훅',{dim:X}),
      I('@kick',g&&wd?'로블로':kick,{dim:X&&kick!=='로킥'&&kick!=='카프킥'}),I('@grap',shooting?'길로틴!':(g||dist<=86)?'클린치':'테이크다운',{tone:'g',ready:shooting,dim:X}),I('special',SPM[P.d.special].name,{dim:!full||X,ready:full,tone:'s'})];
    hint=shooting?'태클이 들어와요! 가드 + 아래(S)를 누르면 스프롤 → 프론트 헤드락':X?'탈진! 강공격과 그래플이 막혔어요. 거리를 벌리고 숨을 고르세요.':wd?'야생 매치: 가드를 누른 채 잽 = 눈 찌르기, 킥 = 로블로. 클린치 가드+니킥 = 헤드버트, 그라운드 가드+엘보 = 사커킥.':'가드를 누른 채 누르면: 잽→바디샷, 크로스→회피, 훅→어퍼컷, 킥→카프킥(앞다리 집중). 킥은 거리에 따라 로·미들·하이킥, 그래플은 멀면 태클·가까우면 클린치.';
  }
  if(dim)key+='dim';
  return{key,left,grid,hint,dim};
}

/* ---------- quick sim (AI vs AI) ---------- */
function sim(a,b,rounds=3){
  const da=a.ovr-b.ovr;const pa=1/(1+Math.exp(-da/6));
  const aw=Math.random()<pa;const Wn=aw?a:b;
  let method='판정',detail=pick(['만장일치 판정','만장일치 판정','스플릿 판정']);
  const fin=Math.random()<.48+Math.abs(da)*.01;
  let round=rounds;
  if(fin){const t=STYLES[Wn.style].ai;
    if(Math.random()<t.sub*.6){method='서브미션';detail=pick(['리어 네이키드 초크','암바','트라이앵글 초크','길로틴 초크','기무라'])}
    else{method=Math.random()<.6?'KO':'TKO';detail=method==='KO'?pick(['훅','크로스','하이킥','어퍼컷','오버핸드']):pick(['파운딩','레그킥','바디샷'])}
    round=1+Math.floor(Math.random()*rounds)}
  return{winner:aw?'a':'b',method,detail,round};
}

IC.Fight={
  start,tick,next,context,mash,sim,DIFF,POSN,SUBK,
  get S(){return S},
  setPlan,INJ,
  playHL(list,done){if(!S||!list||!list.length){done&&done();return}S.hlQ=list.slice(1);S.rp={frames:list[0].frames,i:0,sub:0,hl:true,label:list[0].label};S.mode='replay';S.hlDone=done;S.paused=false},
  press(id){if(!S)return;if(S.mirror){if(!S.spec&&S.netOut)S.netOut('p',S.sub?'mash':id,!!S.held.block);return}if(S.mode!=='fight')return;if(S.sub){mash();return}if(id==='mash')return;S.p.slot=resolve(id);S.p.bufT=10},
  stance(){if(!S||S.mode!=='fight'||S.gr||S.cl||S.mirror)return;const P=S.p;if(P.swT>0||P.state==='attack'||P.state==='hit')return;P.stance=P.stance==='south'?'orth':'south';P.swT=16;floatText(P.x,150+zy(P),P.stance==='south'?'사우스포':'오소독스','#7fe3ff');sfx('whoosh')},
  hold(k,on){if(S){S.held[k]=on;if(S.mirror&&S.netOut)S.netOut('h')}},
  releaseAll(){if(S)S.held={left:false,right:false,block:false,up:false,dn:false,ax:0,az:0}},
  axis(v,w){if(S){S.held.ax=v;S.held.az=w||0;if(S.mirror&&S.netOut)S.netOut('h')}},
  pause(on){if(S&&!S.remote&&!S.mirror)S.paused=on},
  netSnap,applyNet,netInput,
  oppLeft(){if(!S||S.result)return;S.mode='fight';finish(S.p,'TKO','상대 연결 끊김');say('상대의 연결이 끊겼습니다.')},
  skipIntro(){skipWalkout()},
  skipReplay(){if(!S||S.mode!=='replay'||!S.rp)return;if(S.rp.hl){S.hlQ=[];S.mode='over';S.rp=null;const cb=S.hlDone;S.hlDone=null;if(cb)cb()}else startOutro()},
  forfeit(){if(!S)return;if(S.mirror){S.netOut&&S.netOut('p','ff');return}const W=S.e;S.mode='fight';S.replayOn=false;finish(W,'TKO','기권');S.phaseT=1},
  stop(){S=null},
  W,H,GY,GNP,TOP_SUBS,BOT_SUBS,
  _ai:{aiStand,aiClinch,aiGround},replayView,
  arena(){return S?S.arena:ARENAS[2]},ARENAS,
  intensity(){if(!S)return 0;let I=(S.heat||0)*.6;if(S.sub)I+=S.sub.prog/130;if(S.a.rocked>0||S.b.rocked>0)I+=.25;if(S.mode==='ko'||S.mode==='replay')I=1.2;if(S.mode==='outro'||S.mode==='decision')I=Math.max(I,.8);return Math.max(0,Math.min(1.2,I))}
};
})(window.IC);

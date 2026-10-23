/* 아이언 케이지 — 데이터: 체급, 스타일, 기술, 가상 로스터 */
window.IC = window.IC || {};
(function(IC){

const STATS = ['pow','spd','kick','sdef','td','tdd','clinch','gnp','subO','subD','car','chin'];
const STATN = {pow:'펀치 파워',spd:'핸드 스피드',kick:'킥',sdef:'타격 방어',td:'테이크다운',tdd:'TD 방어',clinch:'클린치',gnp:'그라운드 타격',subO:'서브미션 공격',subD:'서브미션 방어',car:'체력',chin:'맷집'};
const STAT_GROUP = {
  타격:['pow','spd','kick','sdef'],
  레슬링:['td','tdd','clinch','gnp'],
  주짓수:['subO','subD'],
  피지컬:['car','chin']
};

const CLASSES8 = [
  {id:'fly', name:'플라이급', kg:57, lb:125, h:[160,170], reach:[163,175]},
  {id:'bw', name:'밴텀급', kg:61, lb:135, h:[165,173], reach:[168,180]},
  {id:'fw', name:'페더급', kg:66, lb:145, h:[168,176], reach:[173,183]},
  {id:'lw', name:'라이트급', kg:70, lb:155, h:[173,180], reach:[178,188]},
  {id:'ww', name:'웰터급', kg:77, lb:170, h:[178,185], reach:[183,193]},
  {id:'mw', name:'미들급', kg:84, lb:185, h:[183,190], reach:[188,200]},
  {id:'lhw', name:'라이트헤비급', kg:93, lb:205, h:[185,193], reach:[190,203]},
  {id:'hw', name:'헤비급', kg:120, lb:265, h:[188,198], reach:[193,208]}
];
/* six weight classes in play: bantam merges into feather, light-heavy into heavy (fighter ids stay the same so saves keep working) */
const CLSMAP={bw:'fw',lhw:'hw'};
const CLASSES = CLASSES8.filter(c=>!CLSMAP[c.id]);

const STYLES = {
  kickboxer:{name:'킥복서', off:{pow:0,spd:3,kick:8,sdef:4,td:-15,tdd:-2,clinch:-5,gnp:-10,subO:-18,subD:-8,car:2,chin:0},
    ai:{agg:.5,kick:.45,td:.04,clinch:.05,sub:.15,counter:.3,combo:.5}, sp:['spinkick','flyknee']},
  boxer:{name:'복서', off:{pow:6,spd:8,kick:-18,sdef:7,td:-18,tdd:0,clinch:-6,gnp:-10,subO:-22,subD:-12,car:-2,chin:4},
    ai:{agg:.55,kick:.08,td:.02,clinch:.04,sub:.1,counter:.45,combo:.65}, sp:['overhand','spinfist']},
  muaythai:{name:'무에타이', off:{pow:3,spd:0,kick:9,sdef:0,td:-16,tdd:-3,clinch:9,gnp:-6,subO:-18,subD:-8,car:4,chin:3},
    ai:{agg:.55,kick:.45,td:.03,clinch:.25,sub:.12,counter:.2,combo:.45}, sp:['flyknee','spinfist']},
  karate:{name:'가라테', off:{pow:-3,spd:7,kick:8,sdef:9,td:-14,tdd:0,clinch:-8,gnp:-10,subO:-14,subD:-6,car:4,chin:-5},
    ai:{agg:.4,kick:.5,td:.04,clinch:.04,sub:.15,counter:.55,combo:.35}, sp:['qmark','spinkick','superman']},
  taekwondo:{name:'태권도', off:{pow:-4,spd:8,kick:11,sdef:6,td:-16,tdd:-4,clinch:-10,gnp:-10,subO:-16,subD:-8,car:5,chin:-4},
    ai:{agg:.45,kick:.62,td:.03,clinch:.03,sub:.12,counter:.45,combo:.45}, sp:['tornado','spinkick','qmark']},
  wrestler:{name:'레슬러', off:{pow:-2,spd:-6,kick:-14,sdef:-4,td:10,tdd:10,clinch:6,gnp:7,subO:-6,subD:3,car:8,chin:2},
    ai:{agg:.5,kick:.1,td:.36,clinch:.22,sub:.3,counter:.15,combo:.35}, sp:['slam','overhand']},
  bjj:{name:'주짓수', off:{pow:-8,spd:-6,kick:-12,sdef:-8,td:0,tdd:-4,clinch:0,gnp:0,subO:11,subD:10,car:2,chin:0},
    ai:{agg:.4,kick:.12,td:.22,clinch:.15,sub:.8,counter:.15,combo:.3}, sp:['pull','superman']},
  sambo:{name:'삼보', off:{pow:0,spd:-4,kick:-10,sdef:-4,td:8,tdd:8,clinch:6,gnp:6,subO:5,subD:5,car:6,chin:2},
    ai:{agg:.5,kick:.15,td:.3,clinch:.25,sub:.55,counter:.2,combo:.4}, sp:['slam','spinfist']},
  brawler:{name:'브롤러', off:{pow:10,spd:-2,kick:-8,sdef:-12,td:-8,tdd:-4,clinch:0,gnp:3,subO:-16,subD:-10,car:-6,chin:9},
    ai:{agg:.75,kick:.12,td:.05,clinch:.08,sub:.1,counter:.1,combo:.55}, sp:['overhand','superman']},
  allround:{name:'올라운더', off:{pow:1,spd:1,kick:1,sdef:1,td:0,tdd:1,clinch:0,gnp:0,subO:-2,subD:0,car:1,chin:0},
    ai:{agg:.5,kick:.3,td:.15,clinch:.12,sub:.35,counter:.3,combo:.45}, sp:['superman','spinkick']}
};

/* 스탠딩 타격 */
const MV = {
  jab:{id:'jab',name:'잽',anim:'jab',target:'head',w:5,a:4,r:9,range:84,dmg:4,st:4,kb:3},
  cross:{id:'cross',name:'크로스',anim:'cross',target:'head',w:10,a:4,r:14,range:90,dmg:8.5,st:9,kb:6},
  hook:{id:'hook',name:'훅',anim:'hook',target:'head',w:8,a:4,r:13,range:82,dmg:9.5,st:10,kb:7},
  upper:{id:'upper',name:'어퍼컷',anim:'upper',target:'head',w:9,a:4,r:14,range:78,dmg:10,st:10,kb:6},
  bodyshot:{id:'bodyshot',name:'바디샷',anim:'bodyshot',target:'body',w:9,a:4,r:13,range:84,dmg:7.5,st:8,kb:4},
  lowkick:{id:'lowkick',name:'로킥',anim:'lowkick',target:'leg',kick:true,w:9,a:5,r:14,range:104,dmg:6.5,st:8,kb:3},
  midkick:{id:'midkick',name:'미들킥',anim:'midkick',target:'body',kick:true,w:12,a:5,r:17,range:112,dmg:9.5,st:13,kb:8},
  highkick:{id:'highkick',name:'하이킥',anim:'highkick',target:'head',kick:true,w:16,a:5,r:22,range:120,dmg:14,st:18,kb:10}
};
/* 필살기 (게이지 100 소모) */
const SPM = {
  superman:{id:'superman',name:'슈퍼맨 펀치',anim:'superman',target:'head',w:12,a:5,r:16,range:138,dmg:16,st:18,kb:12,lunge:5,special:true},
  spinfist:{id:'spinfist',name:'스피닝 백피스트',anim:'spinfist',target:'head',w:11,a:5,r:16,range:96,dmg:15,st:16,kb:11,special:true},
  spinkick:{id:'spinkick',name:'스피닝 백킥',anim:'spinkick',target:'body',kick:true,w:14,a:5,r:20,range:126,dmg:19,st:20,kb:14,special:true},
  flyknee:{id:'flyknee',name:'플라잉 니킥',anim:'flyknee',target:'head',w:10,a:6,r:18,range:116,dmg:19,st:20,kb:12,lunge:6,special:true},
  overhand:{id:'overhand',name:'오버핸드 라이트',anim:'overhand',target:'head',w:13,a:4,r:18,range:94,dmg:18,st:18,kb:12,special:true},
  tornado:{id:'tornado',name:'뒤후려차기',anim:'tornado',target:'head',kick:true,w:15,a:5,r:22,range:130,dmg:20,st:20,kb:14,special:true},
  qmark:{id:'qmark',name:'퀘스천마크 킥',anim:'qmark',target:'head',kick:true,w:14,a:5,r:20,range:122,dmg:17,st:18,kb:12,special:true},
  slam:{id:'slam',name:'파워 슬램',anim:'shoot',kind:'shoot',w:10,a:4,r:20,range:112,st:16,sure:true,special:true},
  pull:{id:'pull',name:'플라잉 트라이앵글',anim:'shoot',kind:'shoot',w:10,a:4,r:20,range:112,st:16,sure:true,special:true}
};
const TD = {id:'td',name:'테이크다운',anim:'shoot',kind:'shoot',w:12,a:3,r:26,range:108,st:14};

const SUBS = {
  '리어 네이키드 초크':1.3,'암바':1.2,'트라이앵글 초크':1.1,'길로틴 초크':1.0,'기무라':1.0,'아메리카나':.9,'암 트라이앵글':1.1,'다스 초크':1.05,
  '아나콘다 초크':1.1,'에제키엘 초크':.95,'본 플루 초크':1.0,'오모플라타':.95,'힐 훅':1.3,'니바':1.1,'카프 슬라이서':1.0,'아킬레스 홀드':.95,'넥 크랭크':1.0,'숏 초크':1.1
};

/* 가상 로스터 — 모든 인물은 창작입니다 */
const RAW = [
  // 라이트급
  ['lw','루슬란 타가예프','그리즐리','다게스탄','sambo',91],
  ['lw','데릭 맥크레인','하이볼티지','미국','boxer',88],
  ['lw','마테우스 칼데이롤라','문어','브라질','bjj',87],
  ['lw','김도현','블레이드','대한민국','kickboxer',84],
  ['lw','아르템 셰스타코프','빙하','러시아','wrestler',82],
  ['lw','키에란 오도노반','불씨','아일랜드','karate',80],
  ['lw','라몬 에체베리아','엘 토로','멕시코','brawler',78],
  ['lw','사토 렌','카타나','일본','allround',75],
  // 웰터급
  ['ww','마커스 오코로','스톰','나이지리아','kickboxer',90],
  ['ww','브라이스 홀링스워스','불도저','미국','wrestler',87],
  ['ww','카를로스 메디로스','판테라','브라질','muaythai',85],
  ['ww','다닐 오르로프','스나이퍼','카자흐스탄','boxer',83],
  ['ww','박준혁','불주먹','대한민국','brawler',80],
  ['ww','레안드로 바스콘셀루스','실크','브라질','bjj',79],
  ['ww','콜튼 리즈데일','레인저','미국','allround',77],
  ['ww','야마다 켄지','닌자','일본','karate',74],
  // 미들급
  ['mw','타네 히코로아','타이달','뉴질랜드','kickboxer',91],
  ['mw','이스마일 베크무르자예프','늑대','체첸','wrestler',88],
  ['mw','안드레 로샤렐리','마카코','브라질','bjj',85],
  ['mw','요나스 린드크비스트','바이킹','스웨덴','boxer',83],
  ['mw','하메드 벤살라','사막여우','모로코','muaythai',81],
  ['mw','트레버 맥과이어','탱크','미국','brawler',79],
  ['mw','이강산','태백','대한민국','allround',77],
  ['mw','페드로 알카사르','마타도르','스페인','karate',75],
  // 헤비급
  ['hw','프랑수아 음보코','해머','카메룬','brawler',90],
  ['hw','빅토르 그로모프','빙산','러시아','sambo',88],
  ['hw','타일러 브록웰','트럭','미국','wrestler',85],
  ['hw','세미 라파이','쓰나미','사모아','boxer',83],
  ['hw','루카스 벨모렐','고릴라','브라질','bjj',80],
  ['hw','마르틴 코발치크','도끼','폴란드','kickboxer',78],
  ['hw','최무진','거인','대한민국','allround',76],
  ['hw','데이먼 크러치필드','바위','미국','brawler',73]
];

const SKIN = {
  '다게스탄':['#d8b08e'],'미국':['#e3b896','#8a5a3c','#c99a76','#5e3b26'],'브라질':['#b47a52','#d2a07a','#7a4c30'],
  '대한민국':['#e2b48c'],'러시아':['#e8c4a4'],'아일랜드':['#f0cdb0'],'멕시코':['#b98058'],'일본':['#e6b892'],
  '나이지리아':['#5a3824'],'카자흐스탄':['#d9ab84'],'뉴질랜드':['#9c6844'],'체첸':['#dcb594'],'스웨덴':['#f2d2b8'],
  '모로코':['#b8845e'],'스페인':['#d3a27a'],'카메룬':['#4e3020'],'사모아':['#8e5c3a'],'폴란드':['#efcfb4']
};
const HAIR = ['#1a1310','#2a1f1a','#3b2a1e','#5a3a22','#141010','#7a5634'];
const TRUNKS = ['#16181d','#1f8a4c','#2b2b2b','#c9a227','#7a1f2b','#f2f0ea','#24407a','#5b2a86','#b54a1c','#0f6b6b','#8a8f99','#c23b6e'];

function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function seeded(seed){let s=seed||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return(s%100000)/100000}}

function makeStats(style, ovr, rand){
  const off = STYLES[style].off, s={};
  for(const k of STATS){s[k]=Math.round(Math.max(30,Math.min(99, ovr + off[k] + (rand()*6-3))))}
  return s;
}
function ovrOf(s, style){
  // 스타일 핵심 스탯 가중 평균
  const w = {pow:1,spd:1,kick:1,sdef:1,td:1,tdd:1,clinch:.7,gnp:.7,subO:1,subD:1,car:1,chin:1};
  const off=STYLES[style]?STYLES[style].off:null;
  let a=0,b=0;
  for(const k of STATS){let ww=w[k];if(off&&off[k]>=6)ww*=1.8;if(off&&off[k]<=-12)ww*=.5;a+=s[k]*ww;b+=ww}
  return Math.round(a/b);
}
function makeLook(id, from, rand){
  const sk=SKIN[from]||['#d2a07a'];
  return {
    skin: sk[Math.floor(rand()*sk.length)],
    hair: HAIR[Math.floor(rand()*HAIR.length)],
    hairStyle: ['short','buzz','bald','long','bun','mohawk'][Math.floor(rand()*6)],
    beard: rand()<.45,
    trunk: TRUNKS[Math.floor(rand()*TRUNKS.length)],
    tattoo: rand()<.35
  };
}

/* generated fighters: every division is filled out to 20 named, entirely fictional athletes */
const NAMES={
  '대한민국':{g:['도윤','서준','하준','지호','민준','건우','현우','태윤','승현','우진','정훈','재원','시우','동현','성민','준혁','지환','태민','상혁','영호'],f:['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','홍'],kr:1},
  '일본':{g:['하루토','소타','유토','렌','다이키','겐타','쇼','류지','다쿠미','고키','슌','가이토'],f:['다나카','사토','스즈키','다카하시','와타나베','이토','나카무라','고바야시','가토','요시다','야마구치','마쓰모토']},
  '브라질':{g:['주앙','페드루','루카스','가브리에우','하파에우','마테우스','치아구','브루누','펠리피','엔조','다니루','비토르'],f:['시우베이라','산투스','올리바스','소자','파헤이라','코스테루','알메이다','카르바류','호샤','바르보자','멘지스','핀투']},
  '미국':{g:['타일러','브랜든','저스틴','케일럽','오스틴','데릭','트래비스','코디','체이스','라이언','마커스','드웨인','칼','제이크'],f:['밀러','데이비스','카터','헤이스','브룩스','웰스','그랜트','페리','콜린스','해리스','월러스','레이놀즈','스톤','맥브라이드']},
  '다게스탄':{g:['마고메드','루스탐','아르투르','티무르','샤밀','압둘라','무사','자우르','라술','가지'],f:['마고메도프','하사노프','압둘라예프','이브라기모프','알리예프','가지예프','우마로프','쿠르바노프','라마자노프','유수포프']},
  '러시아':{g:['드미트리','세르게이','안드레이','막심','니키타','파벨','일리야','로만'],f:['볼코프','소콜로프','페트로프','쿠즈네초프','레베데프','모로조프','파블로프','자이체프']},
  '멕시코':{g:['브란돈','이반','에릭','알레한드로','디에고','리카르도','미겔','세르히오'],f:['모레노','에르난데스','로페스','가르시아','오르티스','레예스','크루스','멘도사']},
  '아일랜드':{g:['코너','리암','션','키런','패트릭','오언'],f:['오닐','머피','오코너','브레넌','플린','도일']},
  '영국':{g:['톰','해리','잭','올리','제임스','루이스'],f:['애스턴','베넷','왓슨','홀','쿠퍼','휴즈']},
  '폴란드':{g:['얀','마테우시','카롤','피오트르','바르토시'],f:['노바크','코발스키','비시니에프스키','자예츠','마주르']},
  '중국':{g:['웨이','하오','레이','쥔','펑','밍'],f:['장','왕','리','류','천','양']},
  '태국':{g:['솜삭','차이','타나','폰','킷티'],f:['삭칸','시통','펫차이','깨우산','룩반']},
  '나이지리아':{g:['오두','치디','에메카','투로','바요'],f:['오카포','아데바요','은와추','오비','에제']},
  '카자흐스탄':{g:['예를란','다니야르','아잣','누를란'],f:['카심로프','베코프','사파로프','누르마노프']},
  '프랑스':{g:['위고','바티스트','레오','네이선'],f:['르블랑','모로','지라르','부셰']},
  '뉴질랜드':{g:['타네','니코','로건','마테오'],f:['와이티','헨리','파라타','모아나']}
};
const NICKS=['블리츠','스틸','라이노','팬텀','코브라','바이퍼','타이탄','스콜피온','마스티프','썬더','라이언','팔콘','데빌','몬스터','섀도','레이저','버팔로','스파르탄','아이스맨','드래곤','하운드','더 월','헌터','록키','폭풍','늑대','독사','화산','태풍','번개','표범','사신','철권','망치','곰','매','호랑이','저격수','검객','유령','폭군','불도저','크라켄','미노타우르','고스트','오로라','레드 존','다이너마이트','라쿤','헤일로','토네이도','샤크','쿠거','아나키','네메시스','바이킹','사무라이','몽크','레퀴엠','칼날'];
const NAT_W=[['대한민국',3],['미국',5],['브라질',4],['다게스탄',2],['러시아',2],['일본',2],['멕시코',2],['아일랜드',1],['영국',1],['폴란드',1],['중국',1],['태국',1],['나이지리아',1],['카자흐스탄',1],['프랑스',1],['뉴질랜드',1]];
Object.assign(SKIN,{'영국':['#efcfb4','#e3b896'],'중국':['#e6b892'],'태국':['#a8724c'],'프랑스':['#efcfb4','#8a5a3c'],'캐나다':['#efcfb4'],'호주':['#efcfb4'],'네덜란드':['#f2d2b8']});
function wpickR(arr,r){const t=arr.reduce((a,x)=>a+x[1],0);let v=r()*t;for(const [k,w] of arr){if((v-=w)<=0)return k}return arr[0][0]}
const STYLE_KEYS=Object.keys(STYLES).filter(k=>k!=='taekwondo');
const USED=new Set(RAW.map(x=>x[1]).concat(RAW.map(x=>x[2])));
function genDivision(cls,have){
  const r=seeded(hash('div_'+cls)),used=USED,out=[];
  // target ladder: champ ~92 down to ~68
  const need=20-have.length,top=have.length?Math.min(...have.map(h=>h[5]))-1:93;
  for(let i=0;i<need;i++){
    let nat,name,nick,tries=0;
    do{nat=wpickR(NAT_W,r);const N=NAMES[nat];const g=N.g[Math.floor(r()*N.g.length)],f=N.f[Math.floor(r()*N.f.length)];name=N.kr?f+g:g+' '+f;tries++}while(used.has(name)&&tries<30);
    used.add(name);
    const PRE=['블랙 ','레드 ','아이언 ','골든 ','리틀 ','빅 ','사일런트 ','와일드 ','다크 ','킹 '];tries=0;
    do{nick=(tries>25?PRE[Math.floor(r()*PRE.length)]:'')+NICKS[Math.floor(r()*NICKS.length)];tries++}while(used.has(nick)&&tries<200);used.add(nick);
    const style=STYLE_KEYS[Math.floor(r()*STYLE_KEYS.length)];
    const ovr=Math.round(have.length?top-(i*(top-67)/Math.max(1,need-1))-r()*2:93-(i*25/(need-1))-r()*2);
    out.push([cls,name,nick,nat,style,ovr]);
  }
  return out;
}
const RAW_ALL=RAW.slice();
for(const C of CLASSES8){const have=RAW.filter(x=>x[0]===C.id);for(const g of genDivision(C.id,have))RAW_ALL.push(g)}
/* second wave: 12 more prospects and veterans per division (separate seed so earlier saves keep their opponents) */
Object.assign(NAMES,{'캐나다':{g:['조던','라일리','브레이든','오웬','네이선','케빈'],f:['트렘블레이','맥도널드','고티에','캠벨','로이','부샤르']},'호주':{g:['미첼','쿠퍼','브로디','제이든','타일','해리슨'],f:['스미스','오브라이언','켈리','테일러','윌리엄스','존스']},
  '네덜란드':{g:['다안','셈','루카','팀','바스','니엘스'],f:['데 용','반 다이크','바커','비세르','스미트','데 브리스']},'스페인':{g:['파블로','하비에르','알바로','다니엘','이케르','세르히오'],f:['가르시아','마르티네스','산체스','로메로','나바로','토레스']},
  '조지아':{g:['기오르기','라샤','니카','다비트','레바니'],f:['베리dze','카파나dze','젤라우리','로르키파니dze','메레비쉬빌리']}});
NAMES['조지아'].f=['베리제','카파나제','젤라우리','로르키파니제','메레비쉬빌리'];
NAMES['대한민국'].g.push('은호','도현','시훈','예준','주원','하람');NAMES['미국'].g.push('브라이스','조시','네이트','트레이','카일');NAMES['브라질'].g.push('카이우','이고르','헤낭','다비');
Object.assign(SKIN,{'스페인':SKIN['스페인']||['#d3a27a'],'조지아':['#e3bc9a']});
const NAT_W2=NAT_W.concat([['캐나다',1],['호주',1],['네덜란드',1],['스페인',1],['조지아',1]]);
for(const C of CLASSES8){const r=seeded(hash('div2_'+C.id));
  for(let i=0;i<12;i++){let nat,name,nick,tries=0;
    do{nat=wpickR(NAT_W2,r);const N=NAMES[nat];const g=N.g[Math.floor(r()*N.g.length)],f=N.f[Math.floor(r()*N.f.length)];name=N.kr?f+g:g+' '+f;tries++}while(USED.has(name)&&tries<40);
    if(USED.has(name))continue;USED.add(name);
    const PRE=['블랙 ','레드 ','아이언 ','골든 ','리틀 ','빅 ','사일런트 ','와일드 ','다크 ','킹 ','미스터 ','영 '];tries=0;
    do{nick=(tries>20?PRE[Math.floor(r()*PRE.length)]:'')+NICKS[Math.floor(r()*NICKS.length)];tries++}while(USED.has(nick)&&tries<300);USED.add(nick);
    RAW_ALL.push([C.id,name,nick,nat,STYLE_KEYS[Math.floor(r()*STYLE_KEYS.length)],Math.round(64+r()*24)])}}
/* taekwondo: Korean kickers and about half of the generated karateka train taekwondo */
const isTKD=(name,from,style,i)=>name==='김도현'||(i>=RAW.length&&((from==='대한민국'&&(style==='kickboxer'||style==='karate'||style==='allround'))||(style==='karate'&&hash(name)%2===0)));
const ROSTER = RAW_ALL.map(([cls,name,nick,from,style,ovr],i)=>{
  if(isTKD(name,from,style,i))style='taekwondo';
  const id = i<RAW.length?cls+'_'+i:'g_'+cls+'_'+hash(name).toString(36);
  const rand = seeded(hash(name));
  const C = CLASSES8.find(c=>c.id===cls);
  const s = makeStats(style, ovr, rand);
  const sp = STYLES[style].sp;
  const wins = 10+Math.floor(rand()*14)+Math.round((ovr-73)/2);
  return {
    id, cls, name, nick, from, style, s,
    special: sp[Math.floor(rand()*sp.length)],
    look: makeLook(id, from, rand),
    height: Math.round(C.h[0]+rand()*(C.h[1]-C.h[0])),
    reach: Math.round(C.reach[0]+rand()*(C.reach[1]-C.reach[0])),
    age: 25+Math.floor(rand()*12),
    rec: [wins, Math.floor(rand()*6)+(ovr<80?2:0), rand()<.15?1:0]
  };
});
ROSTER.forEach(f=>{f.ovr=ovrOf(f.s,f.style);if(CLSMAP[f.cls])f.cls=CLSMAP[f.cls]});

/* active roster: the 20 best per division (champion + 15 ranked + 4 prospects). Everyone else retires but stays
   resolvable by id so old saves, records and hall-of-fame entries keep working. */
const ROSTER_ALL=ROSTER.slice();ROSTER.length=0;
for(const C of CLASSES){const l=ROSTER_ALL.filter(f=>f.cls===C.id).sort((a,b)=>b.ovr-a.ovr);l.forEach((f,i)=>{f.seed=i});ROSTER.push(...l.slice(0,20))}
ROSTER.forEach(f=>{f.ranked=f.seed<16});
const CUSTOM=[];
function byClass(cls){return ROSTER.concat(CUSTOM).filter(f=>f.cls===cls)}
function fighter(id){return ROSTER_ALL.find(f=>f.id===id)||CUSTOM.find(f=>f.id===id)}

const COUNTRIES = ['대한민국','미국','브라질','일본','러시아','멕시코','영국','아일랜드','캐나다','호주','프랑스','태국','중국','나이지리아','뉴질랜드','폴란드','스페인','네덜란드'];
const SKIN_OPTIONS = ['#f0cdb0','#e2b48c','#d2a07a','#b47a52','#8a5a3c','#5a3824'];

const SONGS=[
 {n:'Iron Will',g:'rock',gn:'헤비 록',bpm:150,key:1,d:'묵직한 기타 리프와 몰아치는 드럼'},
 {n:'강철의 행진',g:'rock',gn:'헤비 록',bpm:140,key:1.12,d:'느리게 짓누르는 행진곡풍 메탈'},
 {n:'Bloodline',g:'rock',gn:'헤비 록',bpm:166,key:.89,d:'숨 쉴 틈 없는 스래시 템포'},
 {n:'언더독',g:'hiphop',gn:'힙합',bpm:88,key:1,d:'붐뱁 드럼과 깊은 808 베이스'},
 {n:'No Mercy',g:'hiphop',gn:'시네마틱 힙합',bpm:90,key:1.12,big:true,verb:.42,crowd:1.5,d:'웅장한 현악·브라스 위에 묵직한 비트, 관중 박수'},
 {n:'골목의 왕',g:'hiphop',gn:'힙합',bpm:80,key:.94,d:'어둡고 느린 거리의 비트'},
 {n:'Warpath',g:'epic',gn:'에픽 오케스트라',bpm:76,key:1,d:'타이코 북과 웅장한 현악'},
 {n:'최후의 전사',g:'epic',gn:'에픽 오케스트라',bpm:68,key:1.12,d:'영화 예고편 같은 긴장감'},
 {n:'Valhalla',g:'epic',gn:'에픽 오케스트라',bpm:84,key:.84,d:'전장으로 향하는 북소리'},
 {n:'Neon Riot',g:'edm',gn:'일렉트로닉',bpm:128,key:1,d:'관중을 뛰게 만드는 클럽 비트'},
 {n:'Blackout',g:'edm',gn:'일렉트로닉',bpm:134,key:.89,d:'어두운 신스와 강한 킥'},
 {n:'심장박동',g:'edm',gn:'일렉트로닉',bpm:122,key:1.19,d:'밝고 경쾌한 신스 아르페지오'}];
IC.VER='73';Object.assign(IC,{ROSTER_ALL,CLASSES8,SONGS,CUSTOM,STATS,STATN,STAT_GROUP,CLASSES,CLSMAP,STYLES,MV,SPM,TD,SUBS,ROSTER,byClass,fighter,makeStats,ovrOf,makeLook,hash,seeded,HAIR,TRUNKS,COUNTRIES,SKIN_OPTIONS});
})(window.IC);

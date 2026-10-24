/* IRON CAGE — English UI (menus, buttons, settings, fight HUD).
   Works on the rendered page: text nodes are swapped by an exact-match table, a few number patterns,
   and word tokens (only when the whole string becomes Korean-free, so we never show half-translated sentences).
   Commentary, story events and canvas captions stay Korean for now. */
(function(){
const D={
'홈':'Home','커리어':'Career','야생 리그':'Wild League','대회':'Events','연습':'Practice','온라인':'Online','기록':'Records','명예의 전당':'Hall of Fame',
'앱으로 설치하기':'Install the app','홈 화면에 깔면 전체 화면으로, 더 빠르게 실행돼요':'Add it to your home screen for full-screen, faster play','설치':'Install','알겠어요':'Got it','앱으로 설치':'Install as an app',
'오늘의 빅매치':'Big match tonight','승자가 타이틀 도전권':'Winner gets a title shot','당신의 선수':'Your fighter','무명 신인':'Unknown rookie',
'커리어 모드 · 지역 단체에서 데뷔':'Career mode · debut in a regional promotion','선수 만들기':'Create fighter','노리는 벨트':'Belt to chase','챔피언십':'Championship','6개 체급의 왕좌':'Six thrones, six weight classes',
'＋ 내 노래':'＋ My song','기록 · 설정':'Records · Settings','게임 초기화':'Reset game','전체화면':'Full screen','일시정지':'Pause','제작사: 박시후':'Made by Park Sihoo',
'케이지는':'The cage is','가로':'wide','로 넓다':'— turn sideways','휴대폰을 옆으로 돌리면 경기가 시작됩니다':'Turn your phone sideways to start the fight','화면을 탭하면 한 번 더 찬다':'Tap the screen for another kick',
'메인 메뉴':'Main menu','← 메인 메뉴':'← Main menu','휴대폰':'Phone','모드':'Modes','닫기':'Close','다음 곡':'Next track','음악 켜기/끄기':'Music on/off','경기 화면':'Fight screen','← 뒤로':'← Back','뒤로':'Back',
'전설과 명장면, 그리고 모든 선수':'Legends, highlights and every fighter','레전드 도전 · 헌액 명판':'Legend challenges · Hall plaques','KO 명장면':'KO highlights','피니시 3초 픽셀 GIF 자동 녹화':'Auto-records a 3-second pixel GIF of every finish','📼 5슬롯':'📼 5 slots',
'선수 명단':'Roster','체급별 능력치와 스타일':'Stats and styles by weight class','리더보드':'Leaderboard','커리어·벨트 점수 비교':'Compare career and belt scores','준비 중':'Coming soon','기록실 · 설정':'Records · Settings','전적 통계 · 난이도 · 사운드':'Stats · Sound · Settings',
'케이지 위에서 시대를 지배한 이들의 이름이 새겨지는 곳':'Where the names of those who ruled the cage are carved','전 세계 플레이어의 기록이 실시간으로 모이는 곳':'Records from players around the world, live','온라인 명예의 전당':'Online Hall of Fame',
'내가 헌액되면':'When you are inducted,','다른 모든 플레이어 화면에도':'every other player sees','내 명판이 걸려요. 반대로 다른 사람의 전설도 여기서 볼 수 있어요.':'your plaque. You can see their legends here too.',
'헌액자':'Inductees','참여 플레이어':'Players','방금':'Just now','업데이트':'Updated','빈 자리':'Empty','당신의 이름을 새기세요':'Carve your name here','아직 아무도 없어요.':'Nobody yet.','전 세계 1호 헌액자':'the first inductee in the world',
'가 될 기회예요. 커리어에서 헌액 기준을 넘기고 은퇴하면 바로 여기 올라가요.':'— this is your chance. Pass the Hall standard in Career and retire to appear here.',
'모든 플레이어의 커리어 순위':'Career rankings of every player','온라인 랭킹':'Online Rankings','커리어 경기가 끝날 때마다 내 전적이':'After every career fight your record is','자동으로 올라가요':'uploaded automatically','. 전 세계 플레이어와 순위를 겨뤄 보세요.':'. Compete with players worldwide.',
'종합 점수':'Total score','승리':'Wins','아직 기록이 없어요. 커리어 경기를 하면':'No records yet. Play a career fight and you','자동으로 랭킹에 올라가요':'appear here automatically','커리어 윙':'Career wing',
'아직 헌액된 커리어 선수가 없습니다. 커리어에서 챔피언이 된 뒤 은퇴하면 이곳에 명판이 걸립니다.':'No career fighters inducted yet. Become a champion in Career, then retire to hang your plaque here.',
'온라인 랭킹을 준비하고 있어요. 곧 열려요!':'Online rankings are being set up. Opening soon!','랭킹 불러오는 중…':'Loading rankings…','전 세계 기록 불러오는 중…':'Loading world records…','다시 시도':'Try again',
'통산':'All-time','그랑프리 우승':'Grand Prix wins','토너먼트 우승':'Tournament wins','KO 승':'KO wins','TKO 승':'TKO wins','서브미션 승':'Submission wins','판정승':'Decision wins',
'첫 승리':'First win','어떤 모드든 첫 승리':'Your first win in any mode','K.O. 아티스트':'K.O. Artist','KO로 승리':'Win by KO','번개':'Lightning','1라운드 30초 안에 피니시':'Finish inside 30 seconds of round 1','탭 아웃':'Tap Out','서브미션으로 승리':'Win by submission',
'관절 수집가':'Joint Collector','서로 다른 서브미션 3종으로 승리':'Win with 3 different submissions','하이라이트 필름':'Highlight Reel','필살기로 KO':'KO with a special move','커리어 선수를 명예의 전당에 헌액':'Induct a career fighter into the Hall of Fame',
'철벽':'Iron Wall','한 경기에서 퍼펙트 가드 3번':'3 perfect guards in one fight','불굴의 투혼':'Never Say Die','투혼 발동 후 역전승':'Come-from-behind win after Fighting Spirit','5라운드 혈투':'Five-Round War','5라운드 판정까지 가서 승리':'Win a 5-round decision',
'레전드 격파':'Legend Slayer','레전드 난이도에서 승리':'Win on Legend difficulty','메이저 입성':'Made the Majors','커리어에서 IRON CAGE 계약':'Sign with IRON CAGE in Career','랭커':'Ranked','커리어에서 랭킹 15위 진입':'Break into the top 15 in Career',
'챔피언':'Champion','커리어에서 타이틀 획득':'Win a title in Career','2체급 챔피언':'Two-Division Champ','두 체급에서 벨트 획득':'Win belts in two weight classes','무패 행진':'Unbeaten Run','커리어 10연승':'10-fight win streak in Career','8인 토너먼트 우승':'Win an 8-man tournament',
'은퇴한 선수':'Retired fighters','아직 은퇴한 커리어 선수가 없습니다.':'No retired career fighters yet.','설정':'Settings',
'👤 계정 · 클라우드 저장':'👤 Account · Cloud save','G 구글로 로그인':'G Sign in with Google','로그인하면 폰을 바꿔도 기록이 그대로 이어져요':'Sign in to keep your progress on any phone','지금 저장':'Save now','로그아웃':'Log out',
'라운드 시간':'Round length','1분':'1 min','2분':'2 min','3분':'3 min','🎵 음악 (메뉴 음악·입장곡)':'🎵 Music (menus & walkouts)','켜기':'On','끄기':'Off','🔊 효과음·관중 소리':'🔊 Sound effects & crowd',
'🔕 아이폰 무음 모드에서도 소리 내기':'🔕 Play sound in iPhone silent mode','켜면 옆 무음 스위치를 켜 둬도 게임 소리가 나요':'When on, the game plays sound even with the silent switch on',
'🎵 내가 원하는 노래':'🎵 My own songs','📁 음악 파일 고르기':'📁 Choose music files','폰의 mp3·m4a를 입장곡·홈 음악으로 (여러 곡 가능)':'Use mp3/m4a files from your phone as walkout and menu music (several allowed)',
'선수 입장·소개':'Walkouts & introductions','경기 중 코치 지시':'Coach calls during fights','타격 진동':'Hit vibration','데미지 숫자':'Damage numbers','표시':'Show','숨김':'Hide','피니시 리플레이':'Finish replay',
'진행 상황은 이 브라우저에 저장됩니다.':'Progress is saved in this browser.','모든 기록 초기화':'Reset all records','🌐 언어 · Language':'🌐 Language · 언어',
'기술 익히기':'Learn the moves','시간 제한이 없고, 무한 체력을 켜면 쓰러지지 않습니다. 화면 왼쪽 과제를 하나씩 해보며 조작을 익히세요. 먼저 내 선수를 고르세요.':'No time limit, and with infinite stamina you never go down. Work through the tasks on the left to learn the controls. Pick your fighter first.',
'상대 행동':'Opponent','가만히':'Stand still','방어만':'Defend only','실전처럼':'Real fight','무한 체력':'Infinite stamina','연습 시작':'Start practice',
'하룻밤의 토너먼트부터 체육관 대항전까지':'From one-night tournaments to gym wars','토너먼트':'Tournament','8인 녹아웃 · 3연승이면 우승':'8-man knockout · win 3 straight to take it','그랑프리':'Grand Prix','하룻밤 16인 · 데미지 누적':'16 fighters, one night · damage carries over',
'체육관 모드':'Gym mode','유망주 영입 · 라이벌 대항전':'Sign prospects · rival gym wars','새 체육관 열기':'Open a new gym',
'야생 리그 · 지하 격투 커리어':'Wild League · underground fight career','어떤 인생을 살다 왔나?':'What life did you come from?','지하의 왕':'King of the Underground','까지 올라가라.':'— climb all the way up.',
'이름':'Name','별명':'Nickname','체급':'Weight class','피부':'Skin','머리 · 수염':'Hair · Beard','짧게':'Short','삭발':'Shaved','보통':'Regular','장발':'Long','모히칸':'Mohawk','수염':'Beard','깔끔':'Clean','지하로 내려간다 ↓':'Go underground ↓',
'온라인 아레나':'Online Arena','접속 정보를 불러오는 중…':'Connecting…','온라인 서버에 연결하는 중…':'Connecting to the online server…','온라인 대전 서버를 준비하고 있어요. 곧 열려요!':'Online matches are being set up. Opening soon!',
'내 온라인 선수':'My online fighter','바꾸기':'Change','실시간 대전':'Live matches','고스트 대전':'Ghost matches','주간 우승':'Weekly wins','실시간 1:1 대전':'Live 1-on-1','대전 방':'Match rooms',
'열린 방이 없어요. 방을 만들고 친구를 기다려 보세요.':'No open rooms. Create one and wait for a friend.','방 만들기':'Create room','코드로 입장':'Join with code','방 코드':'Room code','지금 진행 중인 경기':'Live now','진행 중인 경기가 없어요.':'No live fights right now.',
'비동기 대전':'Async matches','주간 토너먼트':'Weekly tournament','도전하기':'Challenge','관전':'Watch','📨 친구 초대하기':'📨 Invite a friend','← 방 나가기':'← Leave room','경기 시작!':'Start fight!','도전자를 기다리는 중…':'Waiting for a challenger…','상대를 기다리는 중':'Waiting for opponent',
'8인 녹아웃':'8-man knockout','대진 추첨':'Draw the bracket','하룻밤 16인 토너먼트':'One-night 16-man tournament','입은 데미지가 다음 경기로 이어집니다':'Damage carries into the next fight',
'시설 레벨':'Facility level','체육관 포인트':'Gym points','선수':'Fighters','다음 주 진행':'Next week','소속 선수':'Signed fighters','균형':'Balanced','타격':'Striking','그래플':'Grappling','체력':'Conditioning','출전':'Fight','방출':'Release','스카우트 리포트':'Scout report','영입':'Sign','체육관 순위':'Gym rankings',
'+ 선수 추가':'+ Add fighter','입장곡 선택':'Walkout song','＋ 노래 추가 (여러 곡 가능)':'＋ Add songs (several allowed)','선택됨':'Selected','선택':'Select','미리듣기':'Preview','내 음악':'My music','자동으로 되돌리기':'Back to automatic',
'커리어 · 선수 생성':'Career · Create fighter','나만의 파이터':'Your own fighter','이름을 입력하세요':'Enter a name','닉네임':'Nickname','국적':'Nationality','파이팅 스타일':'Fighting style','머리색':'Hair color','트렁크':'Trunks','헤어 · 수염':'Hair · Beard',
'짧은':'Short','버즈':'Buzz','묶음':'Tied','수염 없음':'No beard','수염 있음':'Beard','커리어 시작':'Start career',
'시작 시 랭킹 외 무명 선수입니다. 경기마다 3개의 대전 제안 중 하나를 고르고, 4주 트레이닝 캠프를 거쳐 파이트 나이트에 나섭니다.':'You start unranked and unknown. Before each fight pick one of three offers, go through a 4-week camp, then step in on fight night.',
'나가기':'Exit','가드':'Guard','오소독스':'Orthodox','사우스포':'Southpaw','스위치':'Switch','클린치':'Clinch','계속':'Continue','다음':'Next','확인':'OK','결과 보기':'See result','다시 하기':'Rematch','홈으로':'Home',
'라운드 휴식':'Between rounds','코치':'Coach','경기 시작':'Fight','건너뛰기':'Skip','건너뛰기 ▶':'Skip ▶','계체량':'Weigh-in','테일 오브 더 테이프':'Tale of the Tape','승':'W','패':'L','무':'D',
'친구들이 올린 선수(고스트)와 언제든 대전. 내 선수도 올려두면 친구들이 내 고스트에게 도전합니다.':'Fight fighters your friends uploaded (ghosts) anytime. Upload yours and friends can challenge your ghost.','매주 선수를 등록하면 월요일 0시에 대진이 열리고 결과가 공개됩니다.':'Enter a fighter each week; the bracket opens Monday at midnight and results are posted.','캐스터':'Caster','프로':'Pro','루키':'Rookie','레전드':'Legend','불러오기':'Load','이 폰 기록 쓰기':'Keep this phone','취소':'Cancel','노래 고르기':'Choose songs','나중에':'Later','내 노래로 등장!':'Walk out to your own song!'
};
const T=[ /* word tokens, longest first at runtime */
['플라이급','Flyweight'],['페더급','Featherweight'],['라이트급','Lightweight'],['웰터급','Welterweight'],['미들급','Middleweight'],['헤비급','Heavyweight'],['라이트헤비급','Light Heavyweight'],['밴텀급','Bantamweight'],
['킥복서','Kickboxer'],['복서','Boxer'],['무에타이','Muay Thai'],['가라테','Karate'],['태권도','Taekwondo'],['레슬러','Wrestler'],['주짓수','BJJ'],['삼보','Sambo'],['브롤러','Brawler'],['올라운더','All-rounder'],
['대한민국','South Korea'],['미국','USA'],['브라질','Brazil'],['일본','Japan'],['러시아','Russia'],['멕시코','Mexico'],['영국','UK'],['아일랜드','Ireland'],['캐나다','Canada'],['호주','Australia'],['프랑스','France'],['태국','Thailand'],['중국','China'],['나이지리아','Nigeria'],['뉴질랜드','New Zealand'],['폴란드','Poland'],['스페인','Spain'],['네덜란드','Netherlands'],['다게스탄','Dagestan'],['카자흐스탄','Kazakhstan'],['조지아','Georgia'],['스웨덴','Sweden'],['독일','Germany'],['이탈리아','Italy'],['우크라이나','Ukraine'],['몽골','Mongolia'],['필리핀','Philippines'],['카메룬','Cameroon'],['쿠바','Cuba'],['아르헨티나','Argentina'],['칠레','Chile'],['남아공','South Africa'],['자메이카','Jamaica'],
['펀치 파워','Punch power'],['핸드 스피드','Hand speed'],['타격 방어','Striking defense'],['테이크다운','Takedown'],['TD 방어','TD defense'],['그라운드 타격','Ground strikes'],['서브미션 공격','Submission offense'],['서브미션 방어','Submission defense'],['맷집','Chin'],['스태미나','Stamina'],['킥','Kicks'],
['스피닝 백피스트','Spinning backfist'],['스피닝 백킥','Spinning back kick'],['하이킥','High kick'],['미들킥','Body kick'],['로킥','Low kick'],['크로스','Cross'],['어퍼컷','Uppercut'],['오버핸드','Overhand'],['바디샷','Body shot'],['슈퍼맨 펀치','Superman punch'],['플라잉 니','Flying knee'],['잽','Jab'],['훅','Hook'],
['라운드','Round'],['야생 리그','Wild League'],['토너먼트','Tournament'],['그랑프리','Grand Prix'],['연습','Practice'],['오늘의 빅매치','Big match tonight'],['시작 종합','Starting OVR'],['종합','OVR'],['잠재력','Potential'],['챔피언','Champion'],['세','yrs']
].sort((a,b)=>b[0].length-a[0].length);
const RX=[
[/^헌액 (\d+)명$/,'$1 inducted'],[/^나의 헌액자 (\d+)명$/,'My inductees: $1'],[/^우승 (\d+)회$/,'$1 titles'],[/^업적 (\d+) \/ (\d+)$/,'Achievements $1 / $2'],[/^(\d+)점$/,'$1 pts'],[/^(\d+)명$/,'$1 fighters'],
[/^라운드 (\d)분 · v(\d+)$/,'Rounds $1 min · v$2'],[/^지금 접속 (\d+)명$/,'$1 online now'],[/^체육관 모드 · (\d+)주차$/,'Gym mode · week $1'],[/^(\d+)분 전$/,'$1 min ago'],[/^(\d+)승$/,'$1 W'],[/^(\d+)회$/,'$1'],
[/^시설 업그레이드 \((\d+)점\)$/,'Upgrade facility ($1 pts)'],[/^내 헌액자 (\d+)명 온라인에 올리기$/,'Upload my $1 inductees'],[/^(\d+)월 (\d+)일 주$/,'Week of $1/$2'],[/^(.+) RANKINGS$/,null],[/^👑 (.+)급 챔피언$/,null]
];
const has=s=>/[가-힣]/.test(s);
/* quoted nicknames and fighter names may stay Korean; everything else must translate */
function tok(s){let x=s;for(const [a,b] of T)if(x.includes(a))x=x.split(a).join(b);const rest=x.replace(/"[^"]*"/g,'');return has(rest)?null:x}
function tx(raw){const k=raw.trim();if(!k||!has(k))return null;let v=D[k];
  if(v==null)for(const [re,r] of RX){if(re.test(k)){v=r==null?tok(k):k.replace(re,r);if(v&&has(v))v=tok(v);break}}
  if(v==null)v=tok(k);if(v==null)return null;return raw.replace(k,v)}
const on=()=>{try{return window.IC&&IC._data&&IC._data().settings.lang==='en'}catch(e){return false}};
function run(root){if(!on())return;root=root||document.body;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentNode;return p&&/^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}});
  const L=[];let n;while(n=w.nextNode())if(has(n.nodeValue))L.push(n);for(const t of L){const v=tx(t.nodeValue);if(v!=null&&v!==t.nodeValue)t.nodeValue=v}
  root.querySelectorAll&&root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(e=>{for(const a of ['placeholder','aria-label','title']){const v=e.getAttribute(a);if(v&&has(v)){const t=tx(v);if(t)e.setAttribute(a,t)}}});
  if(root===document.body){document.documentElement.lang='en'}}
let pend=0;const sched=()=>{if(pend||!on())return;pend=requestAnimationFrame(()=>{pend=0;run(document.body)})};
window.IC_I18N={run,tx,sched,on};
document.addEventListener('DOMContentLoaded',()=>{try{new MutationObserver(sched).observe(document.body,{childList:true,subtree:true,characterData:true});sched()}catch(e){}});
})();

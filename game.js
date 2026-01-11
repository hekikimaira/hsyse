
/* ========================================================
 * ① State / グローバル管理
 * ====================================================== */

let state = {
  route: "A",
  index: 0,
  freeDepth: 0,
  history: [],
  choiceCount: 0,
  choiceLog: [],
  flags: {
    difficulty: "normal",
    poisoned: false
  },
  injury: {
    leg: false,
    arm: false,
    head: false
  },
  name: "",
  waitingChoice: false,
  ended: false,
  ending: null
};

/* ========================================================
 * ② DOM参照
 * ====================================================== */

const bg = document.getElementById("bg");
const nameBox = document.getElementById("name");
const textBox = document.getElementById("text");
const choiceBox = document.getElementById("choice");

/* ========================================================
 * ③ メイン進行制御
 * ====================================================== */

function canProceed(){
  return !state.ended;
}

function next(){
  if(!canProceed()) return;

  const lines = TEXTS[state.route];
  if(!lines) return;
  if(state.index >= lines.length) return;

  const line = lines[state.index++];

  if(line.startsWith("@")){
    runCommand(line);
    if(canProceed()) next();
    return;
  }

  state.history.push({
    route: state.route,
    index: state.index - 1,
    flags: JSON.parse(JSON.stringify(state.flags || {}))
  });

  const split = line.split("｜");
  if(split.length === 2){
    nameBox.textContent = split[0];
    textBox.textContent = split[1];
  }else{
    textBox.textContent = line;
  }
}

function gotoRoute(route){
  if(!canProceed()) return;
  if(!TEXTS[route]) return;
  state.route = route;
  state.index = 0;
  next();
}

function back(){
  if(!state.history.length) return;
  state.history.pop();
  const prev = state.history.pop();
  if(!prev) return;
  state.route = prev.route;
  state.index = prev.index;
  state.flags = JSON.parse(JSON.stringify(prev.flags || {}));
  state.waitingChoice = false;
  next();
}

function resetGame(){
  state.route = "A";
  state.index = 0;
  state.freeDepth = 0;
  state.choiceCount = 0;
  state.choiceLog = [];
  state.flags = { difficulty: "normal", poisoned: false };
  state.injury = { leg:false, arm:false, head:false };
  state.name = "";
  state.waitingChoice = false;
  state.ended = false;
  state.ending = null;

  nameBox.textContent = "";
  textBox.textContent = "";
  choiceBox.innerHTML = "";
  Timer.stop();

  next();
}

/* ========================================================
 * ④ FX
 * ====================================================== */

const FX = {
  shake(count = 1){
    const root = document.getElementById("game");
    if(!root) return;
    let i = 0;
    const run = () => {
      root.classList.remove("fx-shake");
      void root.offsetWidth;
      root.classList.add("fx-shake");
      i++;
      if(i < count) setTimeout(run, 260);
    };
    run();
  },

  flash(count = 1){
    const layer = document.getElementById("fx-flash-layer");
    if(!layer) return;
    let i = 0;
    const run = () => {
      layer.classList.remove("fx-flash");
      void layer.offsetWidth;
      layer.classList.add("fx-flash");
      i++;
      if(i < count) setTimeout(run, 200);
    };
    run();
  },

  fadeOut(){
    const layer = document.getElementById("fx-fade-layer");
    if(layer) layer.classList.add("show");
  },

  fadeIn(){
    const layer = document.getElementById("fx-fade-layer");
    if(layer) layer.classList.remove("show");
  }
};

/* ========================================================
 * ⑤ AudioManager（完全版）
 * ====================================================== */

const AudioManager = {
  bgm: null,
  bgmId: null,
  loopSE: [],
  activeSE: [],
  unlocked: false,

  volume: {
    bgm: 0.1,
    se: 0.7,
    loop: 0.4
  },

  loadVolume(){
    try{
      const raw = localStorage.getItem("novel_volume");
      if(!raw) return;
      const v = JSON.parse(raw);
      if(typeof v.bgm === "number") this.volume.bgm = v.bgm;
      if(typeof v.se === "number") this.volume.se = v.se;
      if(typeof v.loop === "number") this.volume.loop = v.loop;
    }catch(e){}
  },

  saveVolume(){
    localStorage.setItem("novel_volume", JSON.stringify(this.volume));
  },

  setVolume(type, value){
    const v = Number(value);
    if(Number.isNaN(v)) return;

    this.volume[type] = v;
    this.saveVolume();

    if(type === "bgm" && this.bgm){
      this.bgm.volume = v;
    }
    if(type === "se"){
      this.activeSE.forEach(a => a.volume = v);
    }
    if(type === "loop"){
      this.loopSE.forEach(a => a.volume = v);
    }
  },

  unlock(){
    if(this.unlocked) return;
    const a = new Audio();
    a.play().catch(()=>{});
    this.unlocked = true;
  },

  parseParams(tokens){
    const p = {};
    tokens.forEach(t=>{
      if(t.includes("=")){
        const [k,v] = t.split("=");
        p[k] = Number(v);
      }
    });
    return p;
  },

  playRepeated(create, {delay=0, times=1, interval=0}){
    setTimeout(()=>{
      if(times <= 1){
        create().play();
      }else{
        let c = 0;
        const id = setInterval(()=>{
          create().play();
          c++;
          if(c >= times) clearInterval(id);
        }, interval || 0);
      }
    }, delay || 0);
  },

  playBGM(id, params){
    if(this.bgmId === id) return;
    this.stopBGM();

    const create = ()=>{
      const a = new Audio(id);
      a.loop = true;
      a.volume = this.volume.bgm;
      this.bgm = a;
      this.bgmId = id;
      return a;
    };

    this.playRepeated(create, { delay: params.delay||0, times:1 });
  },

  stopBGM(){
    if(this.bgm){
      this.bgm.pause();
      this.bgm = null;
      this.bgmId = null;
    }
  },

  playSE(id, params){
    const create = ()=>{
      const a = new Audio(id);
      a.volume = this.volume.se;
      this.activeSE.push(a);
      a.onended = ()=>{
        this.activeSE = this.activeSE.filter(x=>x!==a);
      };
      return a;
    };
    this.playRepeated(create, params);
  },

  playLoopSE(id, params){
    const create = ()=>{
      const a = new Audio(id);
      a.loop = true;
      a.volume = this.volume.loop;
      this.loopSE.push(a);
      return a;
    };
    this.playRepeated(create, { delay: params.delay||0, times:1 });
  },

  stopLoopSE(){
    this.loopSE.forEach(a=>a.pause());
    this.loopSE = [];
  }
};

AudioManager.loadVolume();

const Timer = {
  remain: 0,
  running: false,
  t: null,

  el(){ return document.getElementById("timer"); },
  fmt(s){ const m=Math.floor(s/60), r=s%60;
    return String(m).padStart(2,"0")+":"+String(r).padStart(2,"0"); },

  render(){ const e=this.el(); if(e) e.textContent=this.fmt(this.remain); },

  start(sec){
    this.stop();
    this.remain = Math.max(0, sec|0);
    this.running = true;
    this.render();
    this.t = setInterval(()=>this.tick(),1000);
  },

  tick(){
    if(!this.running || state.ended) return;
    this.remain = Math.max(0, this.remain-1);
    this.render();
    if(this.remain===0){ this.stop(); endGame(["TIMEOUT"]); }
  },

  stop(){ if(this.t){ clearInterval(this.t); this.t=null; } this.running=false; },
  resume(){ if(!this.running && this.remain>0){ this.running=true; this.t=setInterval(()=>this.tick(),1000);} },
  add(n){ this.remain=Math.max(0,this.remain+(n|0)); this.render(); },
  sub(n){ this.remain=Math.max(0,this.remain-(n|0)); this.render(); if(this.remain===0){ this.stop(); endGame(["TIMEOUT"]); } },
  show(){ const e=this.el(); if(e) e.style.display="block"; },
  hide(){ const e=this.el(); if(e) e.style.display="none"; }
};

/* ========================================================
 * ⑥ コマンド処理
 * ====================================================== */

function runCommand(cmd){
  if(state.ended) return;


  const p = cmd.trim().split(" ");
  const head = p[0];
  const id = p[1];
  const params = AudioManager.parseParams(p.slice(2));

  switch(head){

    case "@NAME":
      state.name = p.slice(1).join(" ");
      nameBox.textContent = state.name;
      break;

    case "@BG":
      if(id) bg.src = id;
      break;

    case "@GOTO":
      if(id) gotoRoute(id);
      break;

    case "@BGM":
      if(id) AudioManager.playBGM(id, params);
      break;

    case "@BGM_STOP":
      AudioManager.stopBGM();
      break;

    case "@SE":
      if(id) AudioManager.playSE(id, params);
      break;

    case "@LOOP_SE":
      if(id) AudioManager.playLoopSE(id, params);
      break;

    case "@LOOP_SE_STOP":
      AudioManager.stopLoopSE();
      break;

    case "@FX": {
      const type = p[1];
      const count = p[2] ? parseInt(p[2],10) : 1;
      if(type==="SHAKE") FX.shake(count);
      if(type==="FLASH") FX.flash(count);
      if(type==="FADE_OUT") FX.fadeOut();
      if(type==="FADE_IN") FX.fadeIn();
      break;
    }
case "@TIMER_START": Timer.start(Number(p[1])); break;
case "@TIMER_SUB":   Timer.sub(Number(p[1])); break;
case "@TIMER_ADD":   Timer.add(Number(p[1])); break;
case "@TIMER_STOP":  Timer.stop(); break;
case "@TIMER_RESUME":Timer.resume(); break;
case "@TIMER_SHOW":  Timer.show(); break;
case "@TIMER_HIDE":  Timer.hide(); break;

    case "@END":
      endGame(p.slice(1));
      break;

    default:
      console.warn("Unknown command:", cmd);
      break;
  }
}

/* ========================================================
 * ⑦ エンディング
 * ====================================================== */

function endGame(args){
  state.ended = true;
  state.ending = args.length ? args.join(" ") : "NORMAL";
  textBox.textContent = "―― END (" + state.ending + ") ――";
  choiceBox.innerHTML = "";
}

next();

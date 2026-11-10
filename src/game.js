// STAR VELOCITY — game core: estado, lobby, corrida, loja, missões.
// UI DOM fica no index.html; este módulo implementa lógica + canvases.
import { CHARACTERS, MAPS, LOBBY_SCENES, getChar, unlockedMaps } from "./characters.js";
import { drawUma, setupPixelCtx, drawCrowd, drawCloudPuff, drawPennant, drawTuft } from "./pixel.js";
import { RARITY_INFO, PERSONA, SUPER_FX } from "./characters.js";
import { speakSuper, speakResult, speakHello, isVoiceReady } from "./voice.js";
import { sfx, playMusic, setVolumes, initAudio, resumeAudio } from "./audio.js";
import { net, connectNet, createRoom, joinRoom, leaveRoom, sendRace, sendGameEvent, announceHello } from "./net.js";

export const S = window.__SV_STATE__ = {
  name: "Jogador" + Math.floor(Math.random()*99),
  level: 1, xp: 0, coins: 2500, premium: 60, rank: "Bronze III", rankPts: 0,
  charId: "special-week",
  unlocked: ["special-week","haru-urara","sakura-bakushin","twin-turbo"],
  skin: {}, outfit: "default",
  lobbyScene: "academia", frame: "default", trail: "default", superFx: "default",
  missions: {}, wins: 0, races: 0, overtakes: 0,
  settings: { music: 0.7, sfx: 0.8, quality: "Alto", scene: "academia", camera: "Suave", fx: "Alto", voice: "Ligada" },
  ctrlLayout: { scale: 1 },
  ready: false,
  party: [], // {id,name,charId,ready,you}
  mode: "lobby", // lobby|chars|shop|missions|events|friends|settings|race
  race: null,
  emote: null, emoteT: 0,
  lobbyAngle: 0.5,
  lobbyAngleV: 0,
  lobbyPrev: null,
  lobbyBlend: 1,
  lobbySceneFlash: 0,
  lobbyIdleT: 0,
  lobbySpark: [],
  lobbyPetal: [],
  _lobbyUiChar: null,
};

window.__SV_STATE__ = S;

// ---------- SAVE ----------
let kvOk = false;
export async function loadSave(){
  try{
    const v = await root.kv["sv-save"].get("save");
    if(v) Object.assign(S, v);
    kvOk = true;
  }catch(e){
    try{ const raw = localStorage.getItem("sv-save"); if(raw) Object.assign(S, JSON.parse(raw)); }catch(e2){}
  }
  applySettings();
}
export async function save(){
  const data = { name:S.name, level:S.level, xp:S.xp, coins:S.coins, premium:S.premium, rank:S.rank, rankPts:S.rankPts,
    charId:S.charId, unlocked:S.unlocked, lobbyScene:S.lobbyScene, frame:S.frame, trail:S.trail, superFx:S.superFx,
    missions:S.missions, wins:S.wins, races:S.races, overtakes:S.overtakes, settings:S.settings, ctrlLayout:S.ctrlLayout };
  try{ if(kvOk) await root.kv["sv-save"].set("save", data); }catch(e){}
  try{ localStorage.setItem("sv-save", JSON.stringify(data)); }catch(e){}
}
function applySettings(){ setVolumes(S.settings.music, S.settings.sfx); }

// ---------- HELPERS ----------
export const $ = (id)=>document.getElementById(id);
export function toast(msg){
  const t = $("toast"); if(!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(()=>t.hidden=true, 2200);
}
export function fmt(n){ return n>=1000? (n/1000).toFixed(1)+"k" : ""+n; }

// ---------- MISSIONS ----------
export const MISSIONS = [
  { id:"w10", name:"Vença 10 partidas", desc:"Mostre que é lenda.", goal:10, prog:()=>S.wins, reward:{coins:3000} },
  { id:"r30", name:"Complete 30 corridas", desc:"Toda lenda começa correndo.", goal:30, prog:()=>S.races, reward:{coins:2000} },
  { id:"over50", name:"Ultrapasse 50 rivais", desc:"Rei das ultrapassagens.", goal:50, prog:()=>S.overtakes, reward:{premium:20} },
  { id:"lvl5", name:"Alcance nível 5", desc:"Treine e suba.", goal:5, prog:()=>S.level, reward:{coins:1500} },
  { id:"urara", name:"Desafio Urara: vença 1 com Haru Urara", desc:"O sorriso milagroso.", goal:1, prog:()=>S.missions.uraraWin?1:0, reward:{charId:"seium-sky"} },
  { id:"event1", name:"Participe de 3 eventos", desc:"Corra nos eventos especiais.", goal:3, prog:()=>S.missions.events||0, reward:{premium:15} },
];
export function checkMissions(charId, won){
  if(won && charId==="haru-urara") S.missions.uraraWin = 1;
  for(const m of MISSIONS){
    if(S.missions[m.id]) continue;
    if(m.prog() >= m.goal){
      S.missions[m.id]=1;
      if(m.reward.coins){ S.coins+=m.reward.coins; toast(`Missão completa: ${m.name} +${m.reward.coins} moedas!`); sfx.buy(); }
      if(m.reward.premium){ S.premium+=m.reward.premium; toast(`Missão completa: ${m.name} +${m.reward.premium} premium!`); sfx.buy(); }
      if(m.reward.charId && !S.unlocked.includes(m.reward.charId)){ S.unlocked.push(m.reward.charId); toast(`Personagem desbloqueada: ${getChar(m.reward.charId).name}!`); }
    }
  }
  save();
}

// ---------- LOBBY ----------
let lobbyCanvas, lobbyCtx, lobbyRAF=0, lobbyLast=0;
let lobbyDrag=null; // {lastX,lastT,vel}
export function initLobby(){
  lobbyCanvas = $("lobbyCanvas"); if(!lobbyCanvas) return;
  lobbyCtx = lobbyCanvas.getContext("2d");
  setupPixelCtx(lobbyCtx);
  sizeCanvas(lobbyCanvas);
  window.addEventListener("resize", ()=>{ sizeCanvas(lobbyCanvas); sizeCanvas($("raceCanvas")); });
  // --- rotação 360° com inércia (mouse + dedo) ---
  const posX = (e)=> (e.clientX ?? (e.touches && e.touches[0].clientX) ?? 0);
  lobbyCanvas.addEventListener("pointerdown", e=>{
    try{ lobbyCanvas.setPointerCapture(e.pointerId); }catch(err){}
    lobbyDrag = { lastX: e.clientX, lastT: performance.now(), moved: 0 };
    S.lobbyAngleV = 0; S.lobbyIdleT = 0;
  });
  lobbyCanvas.addEventListener("pointermove", e=>{
    if(!lobbyDrag) return;
    const now = performance.now();
    const dx = e.clientX - lobbyDrag.lastX;
    const dt = Math.max(8, now - lobbyDrag.lastT)/1000;
    lobbyDrag.lastX = e.clientX; lobbyDrag.lastT = now;
    lobbyDrag.moved += Math.abs(dx);
    const dA = dx * 0.018;
    S.lobbyAngle += dA;
    S.lobbyAngleV = S.lobbyAngleV*0.6 + (dA/dt)*0.4; // rad/s (suavizado)
    S.lobbyAngleV = Math.max(-12, Math.min(12, S.lobbyAngleV)); // evita giro maluco
    S.lobbyIdleT = 0;
  });
  const endDrag = ()=>{
    if(lobbyDrag && lobbyDrag.moved < 6){
      // toque leve = piscada / carinho: orelhas reagem + sparkle
      spawnLobbySpark(0.5, 0.42, 10);
      try{ sfx.emote(); }catch(err){}
    }
    lobbyDrag = null;
  };
  lobbyCanvas.addEventListener("pointerup", endDrag);
  lobbyCanvas.addEventListener("pointercancel", endDrag);
  buildLobbyGallery();
  updateLobbyCharUI(true);
  cancelAnimationFrame(lobbyRAF);
  lobbyLast = performance.now();
  const loop=(now)=>{
    lobbyRAF=requestAnimationFrame(loop);
    const dt=Math.min(0.05,(now-lobbyLast)/1000); lobbyLast=now;
    if(S.mode!=="lobby" && S.mode!=="friends") return;
    // física da rotação: inércia + atrito + giro automático quando idle
    if(!lobbyDrag){
      S.lobbyAngle += S.lobbyAngleV*dt;
      S.lobbyAngleV *= Math.pow(0.06, dt); // atrito suave
      if(Math.abs(S.lobbyAngleV) < 0.02) S.lobbyAngleV = 0;
      S.lobbyIdleT += dt;
      if(S.lobbyIdleT > 5) S.lobbyAngle += 0.28*dt; // vitrine gira sozinha
    }
    if(S.lobbyBlend < 1) S.lobbyBlend = Math.min(1, S.lobbyBlend + dt*2.4);
    if(S.lobbySceneFlash > 0) S.lobbySceneFlash = Math.max(0, S.lobbySceneFlash - dt*2.2);
    drawLobby(now/1000, dt);
  };
  loop(lobbyLast);
}
function sizeCanvas(c){
  if(!c) return;
  const r = c.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio||1);
  const q = S.settings.quality==="Baixo"?0.6 : S.settings.quality==="Médio"?0.85 : 1;
  c.width = Math.max(320, Math.round(r.width*dpr*q));
  c.height = Math.max(200, Math.round(r.height*dpr*q));
}

const SCENE_BG = {
  "academia": { top:"#79c9ff", mid:"#c9ecff", bot:"#5aa85a", bot2:"#4a9448", acc:"#c9a86a", night:false },
  "hipodromo": { top:"#6fc2ff", mid:"#d8f2ff", bot:"#55b355", bot2:"#489a46", acc:"#8a6a3a", night:false },
  "jardim": { top:"#8fdcff", mid:"#e4f9ff", bot:"#66c466", bot2:"#55a855", acc:"#9e8a5a", night:false },
  "treino": { top:"#5a6f8f", mid:"#9fb2cc", bot:"#3a4a5a", bot2:"#31404e", acc:"#5a6a7e", night:false },
};
export function selectLobbyChar(id){
  const c = getChar(id);
  if(!c) return;
  if(!S.unlocked.includes(id)){
    toast("🔒 Desbloqueie " + c.name + " na loja!");
    try{ sfx.error(); }catch(e){}
    return;
  }
  if(S.charId === id){
    spawnLobbySpark(0.5, 0.42, 8);
    return;
  }
  S.lobbyPrev = getChar(S.charId);
  S.charId = id;
  S.lobbyBlend = 0;
  S.lobbyAngleV += (S.lobbyAngleV >= 0 ? 1 : -1) * 2.2; // girinho de transição
  spawnLobbySpark(0.5, 0.42, 26);
  speakHello(c, S.settings.voice!=="Desligada");
  save(); updateLobbyCharUI(); buildLobbyGallery(); updateTopbar();
  try{ sfx.click(); }catch(e){}
  toast("★ " + c.name + " selecionada!");
}
function flashLobby(){
  S.lobbySceneFlash = 1;
  const f = $("lobbyFlash");
  if(f){ f.style.opacity = "0.55"; setTimeout(()=>{ f.style.opacity = "0"; }, 120); }
}
function spawnLobbySpark(nx, ny, n){
  // nx,ny = posição normalizada (0..1) no canvas
  const cols = ["#ffd166","#ffffff","#ff9ecb","#7dff9e"];
  for(let i=0;i<n;i++){
    S.lobbySpark.push({ nx: nx+(Math.random()-0.5)*0.14, ny: ny+(Math.random()-0.5)*0.2,
      vx:(Math.random()-0.5)*0.25, vy:-0.12-Math.random()*0.22,
      life:0.7+Math.random()*0.5, age:0, s:2+Math.random()*3, c:cols[i%cols.length] });
  }
  if(S.lobbySpark.length > 220) S.lobbySpark.splice(0, S.lobbySpark.length-220);
}
export function buildLobbyGallery(){
  const g = $("lobbyGallery"); if(!g) return;
  g.innerHTML = "";
  for(const c of CHARACTERS){
    const owned = S.unlocked.includes(c.id);
    const b = document.createElement("button");
    b.className = "gThumb"+(S.charId===c.id?" on":"")+(owned?"":" lock");
    b.title = c.name + (owned ? "" : " (bloqueada)");
    const ri = RARITY_INFO[c.rarity];
    const cv = document.createElement("canvas"); cv.width = 34; cv.height = 52;
    b.appendChild(cv);
    const lb = document.createElement("div");
    lb.innerHTML = (owned?"": "🔒 ") + '<span class="rar" style="color:'+(ri?ri.color:"#fff")+'">' + "★".repeat(ri?ri.stars:1) + "</span>";
    b.appendChild(lb);
    const nm = document.createElement("div");
    nm.textContent = c.name.split(" ")[0];
    b.appendChild(nm);
    b.onclick = (e)=>{ e.stopPropagation(); selectLobbyChar(c.id); };
    g.appendChild(b);
    try{
      const x2 = cv.getContext("2d"); setupPixelCtx(x2);
      drawUma(x2, c, 17, 51, 48, 0.4, "idle", 1.2 + c.name.length*0.37, 0, 0);
    }catch(e){}
  }
  // rola até a selecionada
  try{
    const idx = CHARACTERS.findIndex(c=>c.id===S.charId);
    const el = g.children[idx];
    if(el) el.scrollIntoView({ block:"nearest", inline:"center" });
  }catch(e){}
}
const STAT_META = [["speed","⚡"],["stamina","💚"],["power","💪"],["guts","🛡"],["wit","🧠"]];
export function updateLobbyCharUI(force){
  if(S._lobbyUiChar === S.charId && !force) return;
  S._lobbyUiChar = S.charId;
  const c = getChar(S.charId);
  const ri = RARITY_INFO[c.rarity] || { stars: 1, color: "#fff" };
  if($("plateName")) $("plateName").textContent = c.name;
  if($("plateRar")){ $("plateRar").textContent = ("★".repeat(ri.stars)) + " " + c.rarity + " · " + c.style; $("plateRar").style.color = ri.color; }
  if($("plateLvl")) $("plateLvl").textContent = "Nv " + S.level;
  if($("scName")) $("scName").textContent = c.name;
  if($("scSub")) $("scSub").textContent = c.rarity + " · Nv " + S.level + " · " + c.style;
  if($("scBars")){
    $("scBars").innerHTML = STAT_META.map(([k,ico])=>{
      const v = Math.max(0, Math.min(100, c[k]||50));
      return '<div class="statBar"><span class="k">'+ico+'</span><div class="tr"><i class="fl" style="width:'+v+'%"></i></div></div>';
    }).join("");
  }
  if($("scSkill")) $("scSkill").innerHTML = "🎯 <b>"+c.skill.name+"</b><br>" + c.skill.desc + '<br>🌟 <i>'+c.super.name+":</i> “" + c.super.quote + "”";
}
export function drawLobby(t, dt){
  const c=lobbyCanvas, ctx=lobbyCtx;
  if(!c||!ctx) return;
  const w=c.width, h=c.height;
  const qLow = S.settings.quality==="Baixo";
  const sc = SCENE_BG[S.lobbyScene]||SCENE_BG.academia;
  updateLobbyCharUI(false);
  // ===== céu (2 stops + brilho no horizonte) =====
  const g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,sc.top); g.addColorStop(0.45,sc.mid); g.addColorStop(0.62,sc.mid); g.addColorStop(0.63,sc.bot); g.addColorStop(1,sc.bot2);
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  // ===== sol com halo pulsante =====
  const sunX=w*0.82, sunY=h*0.16, sunR=h*0.055;
  ctx.save(); ctx.globalAlpha=0.28+0.05*Math.sin(t*1.4);
  ctx.fillStyle="#fff6d6"; ctx.beginPath(); ctx.arc(sunX,sunY,sunR*1.9,0,7); ctx.fill(); ctx.restore();
  ctx.fillStyle="rgba(255,252,230,0.95)";
  ctx.beginPath(); ctx.arc(sunX,sunY,sunR,0,7); ctx.fill();
  // ===== nuvens em 2 camadas (parallax suave, formato puff) =====
  const cloudN = qLow? 4 : 6;
  for(let i=0;i<cloudN;i++){
    const layer = i%2; // 0 longe (lento), 1 perto (rápido)
    const spd = layer? 16 : 7;
    const per = w+360;
    const cx0 = (((i*263 + t*spd)%per)+per)%per - 180;
    const cy = h*(0.09 + (i%3)*0.075 + layer*0.02);
    const s = (layer? 1.15 : 0.7) * (h/420);
    drawCloudPuff(ctx, cx0, cy, s, layer? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.6)");
  }
  // passarinhos distantes (2, baratos)
  ctx.fillStyle="rgba(40,60,90,0.7)";
  for(let i=0;i<2;i++){
    const bx=((t*40+i*430)%(w+100))-50, by=h*(0.16+i*0.07);
    const flap=Math.sin(t*7+i*2)*3;
    ctx.fillRect(bx-6,by+flap*0.3,6,2); ctx.fillRect(bx,by-flap*0.3,6,2);
  }
  // ===== fundo distante por cenário =====
  drawLobbyFar(ctx,w,h,t,sc);
  // ===== arquibancada com telhado + bandeiras + público animado =====
  const standTop=h*0.38, standBot=h*0.52;
  // corpo da arquibancada
  ctx.fillStyle="rgba(10,16,30,0.35)"; ctx.fillRect(0,standTop,w,standBot-standTop);
  ctx.fillStyle = sc.night? "#23233f" : "#e8e0d0"; ctx.fillRect(0,standTop,w,7);
  // telhado listrado
  const roofN = Math.ceil(w/64);
  for(let i=0;i<roofN;i++){
    ctx.fillStyle = i%2? "#c1121f" : "#f5f5f5";
    ctx.fillRect(i*64, standTop-14, 64, 12);
  }
  ctx.fillStyle="#0a0e1a"; ctx.fillRect(0,standTop-16,w,3);
  // mastros com bandeiras tremulando
  const mastN = Math.max(2, Math.floor(w/300));
  for(let i=0;i<=mastN;i++){
    const mx = 30 + i*(w-60)/Math.max(1,mastN);
    ctx.fillStyle="#3a2a1a"; ctx.fillRect(mx,standTop-46,5,34);
    ctx.fillStyle="#ffd166"; ctx.fillRect(mx-1,standTop-48,7,4);
    const wv = Math.sin(t*5+i*1.9)*4;
    ctx.fillStyle = i%2? "#2ec24f" : "#ff6b6b";
    ctx.beginPath();
    ctx.moveTo(mx+5,standTop-46); ctx.lineTo(mx+34,standTop-40+wv*0.4); ctx.lineTo(mx+5,standTop-32);
    ctx.closePath(); ctx.fill();
  }
  // público: pula, alguns agitam bandeirinhas
  const cols = S.lobbyScene==="treino"? ["#8a9ab8","#c9d4ea","#5a6a86"] : ["#ff6b6b","#ffd166","#7fd4ff","#ffffff","#c9b8ff","#7dff9e"];
  const step = qLow? 18:14;
  const n = Math.ceil(w/step);
  for(let i=0;i<n;i++){
    const px = i*step + ((i*37)%8);
    const jump = Math.abs(Math.sin(t*3.2+i*1.7)) * (i%5===0? 5:2.5);
    const ci = cols[i%cols.length];
    ctx.fillStyle=ci;
    ctx.fillRect(px,standBot-24-jump,8,15);
    ctx.fillStyle="#f2c9a0";
    ctx.fillRect(px+1,standBot-30-jump,6,6);
    // cabelo pixel
    ctx.fillStyle="rgba(0,0,0,0.35)";
    ctx.fillRect(px+1,standBot-30-jump,6,2);
    // 1 em cada 6 agita bandeirinha
    if(i%6===2){
      const wv2=Math.sin(t*9+i)*3;
      ctx.fillStyle="#0a0e1a"; ctx.fillRect(px+8,standBot-34-jump,2,12);
      ctx.fillStyle = i%2? "#ffd166":"#66e0ff";
      ctx.fillRect(px+10,standBot-36-jump+wv2,9,6);
    }
  }
  // varal de bandeirinhas (bunting) em catenária no topo do palco
  const buntY = h*0.055;
  ctx.fillStyle="rgba(20,26,44,0.9)";
  for(let x=0;x<w;x+=14) ctx.fillRect(x, buntY + Math.sin(x/w*Math.PI)*h*0.035, 14, 2);
  const flagCols=["#ff6b6b","#ffd166","#7dff9e","#66e0ff","#ff9ecb"];
  let fi=0;
  for(let x=7;x<w;x+=34){
    const fy = buntY + Math.sin(x/w*Math.PI)*h*0.035 + 2;
    drawPennant(ctx, x, fy, 13, flagCols[fi%flagCols.length], t*4 + x*0.05);
    fi++;
  }
  // ===== pista do hipódromo (terra + textura + raias) =====
  const trackY=h*0.72;
  ctx.fillStyle=sc.acc; ctx.fillRect(0,trackY,w,h-trackY);
  ctx.fillStyle="rgba(255,255,255,0.20)"; ctx.fillRect(0,trackY,w,4);
  ctx.fillStyle="rgba(0,0,0,0.16)"; ctx.fillRect(0,trackY+4,w,3);
  // speckles da terra (determinísticos, baratos)
  ctx.fillStyle="rgba(0,0,0,0.10)";
  const spN = qLow? 40:80;
  for(let i=0;i<spN;i++){
    const sx=(i*97)%w, sy=trackY+8+((i*53)%(h-trackY-10));
    ctx.fillRect(sx,sy,3,2);
  }
  // cerca branca da pista
  ctx.fillStyle="rgba(245,245,245,0.95)"; ctx.fillRect(0,trackY-8,w,4);
  const railStep=46;
  for(let x=(t*0)%railStep;x<w;x+=railStep) ctx.fillRect(x,trackY-20,5,16);
  // flores do jardim / cones do treino
  if(S.lobbyScene==="jardim"){
    for(let i=0;i<14;i++){
      ctx.fillStyle=i%2?"#ff9ecb":"#ffffff";
      const fx=(i*97)%w, fy=h*0.66+((i*53)%(h*0.05));
      ctx.fillRect(fx,fy,5,5); ctx.fillStyle="#2e9e4f"; ctx.fillRect(fx+2,fy+5,2,5);
    }
  }
  if(S.lobbyScene==="treino"){
    for(let i=0;i<5;i++){
      const cx2=(i*211)%w;
      ctx.fillStyle="#ff6b35";
      ctx.beginPath(); ctx.moveTo(cx2,trackY-2); ctx.lineTo(cx2+12,trackY-2); ctx.lineTo(cx2+6,trackY-18); ctx.closePath(); ctx.fill();
    }
  }
  // ===== primeiro plano: tufos de grama balançando =====
  const tuftN = qLow? 8:14;
  for(let i=0;i<tuftN;i++){
    const tx=(i*173)%w, ty=h-6-((i*41)%24);
    drawTuft(ctx, tx, ty, 5, i%2? "#3e8e41":"#4da34f", Math.sin(t*2.4+i*1.3)*2);
  }
  // ===== partículas ambientais: pétalas / poeira dourada / borboleta =====
  updateLobbyAmbient(w,h,dt,t,qLow);
  drawLobbyAmbient(ctx,w,h,t);
  // ===== palco da estrela: glow + sombra + personagem principal =====
  const platY = h*0.90;
  ctx.save(); ctx.globalAlpha=0.30;
  ctx.fillStyle="#ffd166";
  ctx.beginPath(); ctx.ellipse(w*0.5, platY, w*0.10, h*0.022, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  const party = partyList();
  const meIdx = youIndex();
  // companheiros do grupo (laterais, menores, atrás)
  party.forEach((p,i)=>{
    if(i===meIdx) return;
    const def = getChar(p.charId);
    const sidePos = (i<meIdx? -1:1) * (Math.abs(i-meIdx));
    const slotX = w*(0.5 + sidePos*0.24);
    const hh = h*0.40;
    const pose = emotePose(p, t);
    ctx.save(); ctx.globalAlpha=0.92;
    drawUma(ctx, def, slotX, platY-4, hh, 0.4+Math.sin(t+i)*0.1, pose, t+i, 0, S.lobbyAngleV*0.3);
    ctx.restore();
    ctx.font = Math.round(h*0.034)+"px monospace"; ctx.textAlign="center";
    const label=(p.you?"★ ":"")+p.name+(p.ready?" ✓":"");
    ctx.fillStyle="rgba(0,0,0,0.55)";
    const tw=ctx.measureText(label).width;
    ctx.fillRect(slotX-tw/2-6, h*0.60, tw+12, h*0.048);
    ctx.fillStyle="#fff"; ctx.fillText(label, slotX, h*0.634);
  });
  // --- personagem principal com transição suave (desliza + escala + fade) ---
  const cur = getChar(S.charId);
  const prev = S.lobbyPrev;
  const b = S.lobbyBlend;
  const ease = 1-Math.pow(1-b,3);
  const mainH = h*0.58;
  const mainX = w*0.5;
  const spin = Math.max(-8, Math.min(8, S.lobbyAngleV));
  if(prev && b<1){
    ctx.save(); ctx.globalAlpha = 1-ease;
    const px = mainX - (1-ease)*w*0.22;
    const ph = mainH*(1-(1-ease)*0.12);
    drawUma(ctx, prev, px, platY, ph, S.lobbyAngle - 0.9*(1-ease), emotePose(party[meIdx]||{emote:S.emote,emoteT:S.emoteT}, t), t, 0, spin);
    ctx.restore();
  }
  ctx.save(); ctx.globalAlpha = prev && b<1 ? ease : 1;
  const inX = prev && b<1 ? mainX + (1-ease)*w*0.22 : mainX;
  const inH = prev && b<1 ? mainH*(0.88+0.12*ease) : mainH;
  // brilho dourado atrás da estrela
  ctx.save(); ctx.globalAlpha=(prev&&b<1? ease:1)*0.22;
  ctx.fillStyle=cur.super.color;
  ctx.beginPath(); ctx.ellipse(inX, platY-mainH*0.45, mainH*0.30, mainH*0.46, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  const pose = emotePose(party[meIdx]||{emote:S.emote,emoteT:S.emoteT}, t);
  drawUma(ctx, cur, inX, platY, inH, S.lobbyAngle, pose, t, 0, spin);
  ctx.restore();
  // nome do grupo sobre a principal (só se houver grupo)
  if(party.length>1){
    const me = party[meIdx];
    const label=(me.you?"★ ":"")+me.name+(me.ready?" ✓":"");
    ctx.font="bold "+Math.round(h*0.042)+"px monospace"; ctx.textAlign="center";
    const tw=ctx.measureText(label).width;
    ctx.fillStyle="rgba(0,0,0,0.55)";
    ctx.fillRect(mainX-tw/2-8, h*0.075, tw+16, h*0.056);
    ctx.fillStyle="#ffd166"; ctx.fillText(label, mainX, h*0.115);
  }
  // ===== sparkles da seleção (espaço de tela) =====
  for(let i=S.lobbySpark.length-1;i>=0;i--){
    const p=S.lobbySpark[i];
    p.age+=dt; if(p.age>=p.life){ S.lobbySpark.splice(i,1); continue; }
    p.nx+=p.vx*dt; p.ny+=p.vy*dt; p.vy+=0.10*dt;
    const a=1-p.age/p.life;
    ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=p.c;
    const s2=Math.max(2, p.s*(0.6+0.4*a));
    const tw2=Math.sin(t*10+i)*1;
    ctx.fillRect(p.nx*w, p.ny*h+tw2, s2, s2);
    ctx.fillStyle="rgba(255,255,255,0.9)";
    ctx.fillRect(p.nx*w, p.ny*h+tw2, Math.max(1,s2*0.4), Math.max(1,s2*0.4));
    ctx.restore();
  }
  // ===== flash de troca de cenário (suave) =====
  if(S.lobbySceneFlash>0){
    ctx.save(); ctx.globalAlpha=S.lobbySceneFlash*0.35; ctx.fillStyle="#fff";
    ctx.fillRect(0,0,w,h); ctx.restore();
  }
  // ===== vinheta sutil p/ focar na personagem (não compete) =====
  const vg=ctx.createLinearGradient(0,0,w,0);
  vg.addColorStop(0,"rgba(5,8,16,0.30)"); vg.addColorStop(0.25,"rgba(5,8,16,0)");
  vg.addColorStop(0.75,"rgba(5,8,16,0)"); vg.addColorStop(1,"rgba(5,8,16,0.30)");
  ctx.fillStyle=vg; ctx.fillRect(0,0,w,h);
}
function drawLobbyFar(ctx,w,h,t,sc){
  // silhuetas por cenário (camada distante, parallax estático + nuvens já cuidam do movimento)
  const baseY=h*0.38;
  if(S.lobbyScene==="academia"){
    ctx.fillStyle="#d8e4f0"; ctx.fillRect(w*0.06,baseY-70,w*0.30,70);
    ctx.fillStyle="#26418f"; ctx.fillRect(w*0.06,baseY-78,w*0.30,10);
    ctx.fillStyle="#9be8ff";
    for(let r=0;r<2;r++) for(let cix=0;cix<5;cix++) ctx.fillRect(w*0.06+14+cix*26, baseY-62+r*24, 16, 12);
    ctx.fillStyle="#8a5a3a"; ctx.fillRect(w*0.62,baseY-60,14,60); // árvore
    ctx.fillStyle="#2e9e4f"; ctx.beginPath(); ctx.arc(w*0.62+7,baseY-66,34,0,7); ctx.fill();
  } else if(S.lobbyScene==="treino"){
    ctx.fillStyle="#2a3648";
    ctx.fillRect(w*0.08,baseY-56,w*0.24,56); ctx.fillRect(w*0.60,baseY-72,w*0.28,72);
    ctx.fillStyle="#ffd166";
    for(let r=0;r<3;r++){ ctx.fillRect(w*0.08+10,baseY-48+r*16,w*0.24-20,5); ctx.fillRect(w*0.60+10,baseY-64+r*18,w*0.28-20,5); }
  } else if(S.lobbyScene==="jardim"){
    ctx.fillStyle="rgba(90,160,90,0.85)";
    ctx.beginPath(); ctx.arc(w*0.2,baseY,90,Math.PI,0); ctx.fill();
    ctx.beginPath(); ctx.arc(w*0.75,baseY,110,Math.PI,0); ctx.fill();
    ctx.fillStyle="#6b4a2a";
    ctx.fillRect(w*0.2-7,baseY-44,14,44); ctx.fillRect(w*0.75-8,baseY-52,16,52);
    ctx.fillStyle="#ff9ecb";
    for(let i=0;i<6;i++){ const fx=(i*151)%w; ctx.fillRect(fx,baseY-10-((i*29)%30),5,5); }
  } else {
    // hipódromo: colina + torre
    ctx.fillStyle="rgba(90,160,90,0.85)";
    ctx.beginPath(); ctx.arc(w*0.5,baseY+10,150,Math.PI,0); ctx.fill();
    ctx.fillStyle="#e8e0d0"; ctx.fillRect(w*0.44,baseY-96,70,60);
    ctx.fillStyle="#c1121f"; ctx.fillRect(w*0.44,baseY-102,70,8);
    ctx.fillStyle="#26418f"; ctx.fillRect(w*0.44+8,baseY-88,54,10);
    ctx.fillStyle="#0a0e1a"; ctx.fillRect(w*0.465,baseY-36,8,36); ctx.fillRect(w*0.50,baseY-36,8,36);
  }
}
function updateLobbyAmbient(w,h,dt,t,qLow){
  // mantém ~10-16 partículas: pétalas douradas + poeira
  const target = qLow? 8:15;
  if(S.lobbyPetal.length<target && Math.random()<0.25){
    S.lobbyPetal.push({ x:Math.random()*w, y:-10, vx:(Math.random()-0.5)*14, vy:22+Math.random()*26,
      s:2+Math.random()*3, ph:Math.random()*9, c: Math.random()<0.4? "#ffd166": Math.random()<0.5? "#ffffff":"#ff9ecb" });
  }
  for(let i=S.lobbyPetal.length-1;i>=0;i--){
    const p=S.lobbyPetal[i];
    p.x+=(p.vx+Math.sin(t*2+p.ph)*12)*dt; p.y+=p.vy*dt;
    if(p.y>h+12) S.lobbyPetal.splice(i,1);
  }
}
function drawLobbyAmbient(ctx,w,h,t){
  for(const p of S.lobbyPetal){
    ctx.save(); ctx.globalAlpha=0.75; ctx.fillStyle=p.c;
    const wob=Math.sin(t*5+p.ph)*2;
    ctx.fillRect(p.x+wob,p.y,p.s,p.s*0.7);
    ctx.restore();
  }
}
function youIndex(){ const p=partyList(); const i=p.findIndex(x=>x.you); return i<0?0:i; }
function partyList(){
  // você + peers (até 4)
  const base=[{ id:net.myId||"you", name:S.name, charId:S.charId, ready:S.ready, you:true, emote:S.emote, emoteT:S.emoteT }];
  for(const [,v] of net.peers){
    if(base.length>=4) break;
    base.push({ id:v.id, name:v.name||"Amigo", charId:v.charId||"special-week", ready:!!v.ready, emote:v.emote, emoteT:v.emoteT });
  }
  // ordena: você no centro visual (índice meio) — mantemos você no meio
  return base;
}
function emotePose(p,t){
  const age = (Date.now()-(p.emoteT||0))/1000;
  if(p.emote && age<3){
    if(p.emote==="win"||p.emote==="cheer") return "win";
    if(p.emote==="sad") return "lose";
    if(p.emote==="present") return "present";
    if(p.emote==="super") return "super";
  }
  return "idle";
}
export function doEmote(kind){
  S.emote=kind; S.emoteT=Date.now(); sfx.emote();
  spawnLobbySpark(0.5, 0.36, 14);
  sendGameEvent("emote",{ id:net.myId, emote:kind, emoteT:S.emoteT });
}

// ---------- RACE ----------
let raceCanvas, raceCtx, raceRAF=0, raceLast=0;
let btnRun=false; // CORRER (segurar = sprint). Sem joystick: direção é automática.

export function initRace(){
  raceCanvas=$("raceCanvas"); if(!raceCanvas) return;
  raceCtx=raceCanvas.getContext("2d");
  setupPixelCtx(raceCtx);
  sizeCanvas(raceCanvas);
  bindControls();
  cancelAnimationFrame(raceRAF);
  raceLast=performance.now();
  const loop=(now)=>{
    raceRAF=requestAnimationFrame(loop);
    const dt=Math.min(0.05,(now-raceLast)/1000); raceLast=now;
    if(S.mode!=="race"||!S.race) return;
    stepRace(dt, now/1000);
    drawRace(now/1000);
  };
  loop(raceLast);
}

export function startRace(opts={}){
  // opts: {mode, mapId, racers:[{id,name,charId,you,bot}], laps}
  resumeAudio();
  let mapId = opts.mapId || randomMap();
  let map = MAPS.find(m=>m.id===mapId);
  if(!map || map.locked){ mapId = randomMap(); map = MAPS.find(m=>m.id===mapId)||MAPS[0]; }
  const laps = opts.laps || 2;
  let racers = opts.racers;
  if(!racers){
    racers=[{ id:net.myId||"you", name:S.name, charId:S.charId, you:true }];
    // peers entram
    for(const [,v] of net.peers){
      if(racers.length>=8) break;
      racers.push({ id:v.id, name:v.name||"Amigo", charId:v.charId||getChar(S.charId).id });
    }
    // bots completam 8 (mín 4)
    const target = Math.max(4, Math.min(8, racers.length<=1? 6 : 8));
    const pool = CHARACTERS.filter(c=>!racers.some(r=>r.charId===c.id));
    const need = target - racers.length;
    for(let i=0;i<need;i++){
      const c = pool[i%pool.length];
      racers.push({ id:"bot"+i, name:c.name.split(" ")[0]+" (CPU)", charId:c.id, bot:true });
    }
  }
  S.race = {
    map, laps, t:0, countdown:3.2, finished:false, results:[],
    slowmo:0, lapMeters: 650,
    cine: null, // {charDef, name, quote, t}
    cam: { x: -18, zoom: 1, over: 0, overA: null, overB: null, overMsg: "", shake: 0, arrive: 0 },
    finalFx: false,
    runners: racers.map((r,i)=>makeRunner(r,i,racers.length)),
  };
  S.mode="race";
  showScreen("race");
  playMusic(map.night?"night":"race");
  toast(`${map.name} — ${S.race.runners.length} corredoras!`);
  updateRaceUI();
}

function randomMap(){ const open=unlockedMaps(); return open[Math.floor(Math.random()*open.length)].id; }

function makeRunner(r, idx, total){
  const def = getChar(r.charId);
  // vel em m/s (~16-19: 60 km/h de sprint). Raridade não domina.
  const base = 13.5 + def.speed*0.045 + def.power*0.015;
  return {
    ...r, def,
    s: -idx*9, // grid escalonado (metros)
    lat: (idx%2? 1:-1)*(1+idx*0.5),
    v: 0, baseV: base,
    stamina: 100, maxStamina: 60+def.stamina*0.5,
    dashCD: 0, dashT: 0,
    super: 20+Math.random()*15, superOn: false, superT:0,
    lap: 1, finished:false, finishT:0, place:idx+1,
    phase: Math.random(), skillCD: 8+Math.random()*6,
    overCount:0, aiRubber: 0.9+Math.random()*0.2, lastPlace: null,
    buff:null, buffCD: 6+Math.random()*6,
    lastS: -idx*9,
  };
}

// ---------- ESTILOS DE SUPER (cada super, uma apresentação) ----------
// ghosts = fantasmas · zig = zigue-zague · shake = tremor · lines = linhas de
// velocidade · confetti = cores de festa · rays = raios dourados ·
// pose = pose final · dark = fundo de trevas · bounce = quique de palco
const FXC = {
  rainbow:{ ghosts:3, zig:0,  shake:0.4, lines:8,  confetti:["#ff6b6b","#ffd166","#7dff9e","#66e0ff"], rays:false, pose:"super", dark:false, bounce:0 },
  streak: { ghosts:4, zig:0,  shake:0.8, lines:16, confetti:null, rays:false, pose:"dash",  dark:false, bounce:0 },
  dance:  { ghosts:2, zig:0,  shake:0.2, lines:6,  confetti:["#ff9ecb","#ffd166","#ffffff"], rays:false, pose:"win", dark:false, bounce:14 },
  chaos:  { ghosts:3, zig:26, shake:1.2, lines:10, confetti:["#ffd700","#ff6b35","#ffffff"], rays:false, pose:"dash", dark:false, bounce:0 },
  shadow: { ghosts:3, zig:8,  shake:0.8, lines:8,  confetti:null, rays:false, pose:"dash",  dark:true,  bounce:0 },
  royal:  { ghosts:2, zig:0,  shake:0.3, lines:6,  confetti:["#ffd166","#ffffff"], rays:true, pose:"super", dark:false, bounce:0 },
  bloom:  { ghosts:2, zig:6,  shake:0.3, lines:6,  confetti:["#ffb3d9","#7dff9e","#ffffff"], rays:false, pose:"super", dark:false, bounce:6 },
};
function fxOf(id){
  if(SUPER_FX[id]) return SUPER_FX[id];
  return { cute:"bloom", wild:"chaos", cool:"streak", noble:"royal" }[PERSONA[id]] || "streak";
}

// track: elipse. s em METROS; lapM = metros por volta.
function trackLen(R){ return { rx:R.w*0.36, ry:R.h*0.30 }; }
function trackPoint(R, s, lat, lapM){
  const { rx, ry } = trackLen(R);
  const cx=R.w/2, cy=R.h*0.54;
  lapM = lapM || 1300;
  const frac = ((s % lapM)+lapM)%lapM / lapM;
  let a = frac*Math.PI*2;
  // volta completa = per
  const ex = cx + Math.cos(a)*rx, ey = cy + Math.sin(a)*ry*0.62 + Math.sin(a*2)*R.h*0.02;
  // normal
  const nx = Math.cos(a)/rx, ny = Math.sin(a)/(ry*0.62||1);
  const nl = Math.hypot(nx,ny)||1;
  return { x: ex + (nx/nl)*lat*R.w*0.012, y: ey + (ny/nl)*lat*R.h*0.03, a };
}

// ---------- BUFFS (estilo arcade: ícones temporários por skill) ----------
const BUFF_MAP = {
  "progress-accel":{icon:"⚡",label:"Ritmo",mult:1.14,dur:5},
  "steady-speed":{icon:"💨",label:"Vento",mult:1.10,shield:true,dur:5},
  "long-dash":{icon:"💨",label:"Teio Dash",mult:1.12,dur:5},
  "chaos-move":{icon:"🌀",label:"Caos",mult:1.10,dur:4},
  "recover-accel":{icon:"💚",label:"Recupera",mult:1.10,regen:true,dur:5},
  "duel-surge":{icon:"⚔",label:"Duelo",mult:1.14,dur:4},
  "pride-hold":{icon:"🛡",label:"Orgulho",shield:true,mult:1.06,dur:5},
  "late-bloom":{icon:"🌸",label:"Flor",mult:1.14,dur:5},
  "sky-dive":{icon:"🦅",label:"Condor",mult:1.12,dur:4},
  "turbo-start":{icon:"🚀",label:"Turbo",mult:1.12,dur:4},
  "endurance":{icon:"💚",label:"Fôlego",regen:true,mult:1.06,dur:6},
  "burst-advance":{icon:"🌊",label:"Maré",mult:1.14,dur:4},
  "emperor-aura":{icon:"👑",label:"Império",mult:1.10,shield:true,dur:5},
  "shadow-press":{icon:"🌑",label:"Sombra",mult:1.12,dur:4},
  "precision":{icon:"🎯",label:"Precisa",mult:1.08,shield:true,dur:5},
  "rising-accel":{icon:"☀",label:"Sol",mult:1.12,dur:5},
  "diamond-cut":{icon:"💎",label:"Diamante",mult:1.14,dur:4},
  "sprint-king":{icon:"👟",label:"Sprint",mult:1.14,dur:4},
  "never-give-up":{icon:"🌟",label:"Coração",regen:true,mult:1.10,dur:5},
  "experiment":{icon:"🧪",label:"Teste",mult:1.12,dur:4},
  "lock-on":{icon:"🎯",label:"Mira",mult:1.12,dur:4},
  "escape-artist":{icon:"☁",label:"Nuvem",mult:1.08,regen:true,dur:5},
  "turbo-burst":{icon:"🔥",label:"Turbo",mult:1.16,dur:3},
  "hunt":{icon:"🌿",label:"Caça",mult:1.12,dur:4},
  "monarch":{icon:"🦁",label:"Rei",mult:1.10,shield:true,dur:5},
  "overtake-king":{icon:"⚡",label:"Ouro",mult:1.14,dur:4},
  "noble-rush":{icon:"🌹",label:"Dama",mult:1.12,shield:true,dur:4},
  "all-seeing":{icon:"👁",label:"Olho",mult:1.12,dur:5},
};
function skillBuff(def){ return BUFF_MAP[def.skill.id]||{icon:"✨",label:"Up",mult:1.10,dur:4}; }

function stepRace(dt, t){
  const R = S.race; if(!R) return;
  if(R.cine) R.cine.t += dt;
  if(R.cine && R.cine.t>2.6) R.cine=null;
  let timeScale = 1;
  if(R.cine && R.cine.t<1.2) timeScale = 0.55; // câmera aproxima mas não congela
  R.slowmo = timeScale;
  if(R.countdown>0){
    R.countdown-=dt;
    const c = Math.ceil(R.countdown);
    if(R._lastCount!==c){ R._lastCount=c; if(c<=3&&c>0) sfx.countBeep(); if(c===0) sfx.countGo(); }
    if(R.countdown<=0){ R._lastCount=0; }
    else return;
  }
  R.t+=dt*timeScale;
  const me = R.runners.find(r=>r.you);
  for(const r of R.runners){
    if(r.finished) continue;
    const isMe = !!r.you;
    // input
    let steer=0, throttle=0.75, wantRun=false, wantDash=false;
    if(isMe){
      // Sem joystick: o jogador controla o RITMO (CORRER = sprint).
      // A direção é automática: segue a raia e desvia de rivais (setas/WASD afinam).
      steer = (keys.left?-1:0)+(keys.right?1:0);
      steer += -r.lat*0.12; // centraliza na raia
      let dodge=0;
      for(const o of R.runners){
        if(o===r||o.finished) continue;
        const ds=o.s-r.s;
        if(ds>0&&ds<7&&Math.abs(o.lat-r.lat)<2.2) dodge += (r.lat<o.lat?-1:1);
      }
      steer += Math.max(-1,Math.min(1,dodge))*0.9;
      throttle = 0.62;
      wantRun = btnRun || keys.up;
    } else if(r.bot || !net.connected){
      // IA com rubber-banding (s em metros)
      const ahead = me? (me.s - r.s):0;
      throttle = 0.72 + Math.max(-0.08, Math.min(0.12, ahead*0.004)) * r.aiRubber;
      steer = Math.sin(t*0.7 + r.phase*9)*0.5 - Math.sign(r.lat)*0.25;
      wantRun = (R.t%9)<4;
      if(r.dashCD<=0 && Math.random()<dt*0.25) wantDash=true;
      if(r.super>=100 && Math.random()<dt*0.8) fireSuper(r, true);
    } else {
      // remoto: interpola do último estado recebido
      const peer = net.peers.get(r.id);
      if(peer && peer.s!=null){
        r.s += (peer.s - r.s)*Math.min(1,dt*6);
        r.lat += ((peer.lat||0)-r.lat)*Math.min(1,dt*6);
        r.v = peer.v||r.v;
        if(peer.superFire) { peer.superFire=false; fireSuper(r,true); }
      } else { throttle=0.7; }
    }
    // buff da skill: ativa sozinho de tempos em tempos (todas as corredoras)
    r.buffCD-=dt;
    if(r.buffCD<=0 && !r.finished){
      r.buffCD=13+Math.random()*7;
      const b=skillBuff(r.def);
      r.buff={...b, t:b.dur};
      if(isMe){ toast(`${b.icon} ${b.label}!`); sfx.buff(); }
    }
    if(r.buff){ r.buff.t-=dt; if(r.buff.t<=0) r.buff=null; }
    // skill ativa do jogador: tecla E ou auto? jogador usa dash/super; skill passiva aplicada abaixo
    applyCharSkill(r, dt, t);
    // física (m/s) — buff multiplica o alvo
    const target = r.baseV*(0.55+throttle*0.6)*(wantRun&&r.stamina>0?1.18:1)*(r.dashT>0?1.65:1)*(r.superOn?1.35:1)*(r.buff?.mult||1);
    const accel = 7 + r.def.power*0.08;
    r.v += Math.sign(target-r.v)*Math.min(Math.abs(target-r.v), accel*dt);
    // curvas: perde vel se lateral extremo
    r.v -= Math.abs(r.lat)*0.06*dt;
    // contato: empurra (escudo do buff protege)
    if(!r.buff?.shield) for(const o of R.runners){
      if(o===r||o.finished) continue;
      if(Math.abs(o.s-r.s)<4 && Math.abs(o.lat-r.lat)<1.6){
        const push = (r.lat<o.lat?-1:1)*dt*3*(r.def.guts>o.def.guts?0.5:1.2);
        r.lat += push;
        r.v -= dt*2*(r.def.guts<70?2:1);
      }
    }
    r.s += r.v*dt*timeScale;
    r.lat = Math.max(-8, Math.min(8, r.lat + steer*dt*10*timeScale));
    r.phase += dt*(r.v/6);
    // estamina
    if(r.buff?.regen) r.stamina=Math.min(r.maxStamina,r.stamina+dt*14);
    else if(wantRun && r.v>3){ r.stamina=Math.max(0,r.stamina-dt*7); }
    else r.stamina=Math.min(r.maxStamina, r.stamina+dt*(4+r.def.stamina*0.05));
    if(r.dashCD>0) r.dashCD-=dt;
    if(r.dashT>0){ r.dashT-=dt; }
    // super carrega: correr + ultrapassar + objetivos
    if(!r.superOn){
      r.super = Math.min(100, r.super + dt*(2.1 + r.v*0.02 + (wantRun?1.2:0))*(0.7+r.def.wit*0.006));
    } else {
      r.superT-=dt;
      if(r.superT<=0){ r.superOn=false; }
    }
    // ultrapassagem detectada
    // (simplificado: compara ordem)
    // volta / fim (metros)
    const totalS = R.lapMeters*R.laps;
    const lapNow = Math.min(R.laps, Math.floor(r.s/R.lapMeters)+1);
    r.lap = Math.max(1, lapNow);
    if(r.s>=totalS && !r.finished){
      r.finished=true; r.finishT=R.t;
      R.results.push(r);
      if(isMe) onFinish(r);
    }
    // publica estado (10Hz)
    if(isMe && !r.finished){
      sendRace({ s:r.s, lat:r.lat, v:r.v, charId:r.charId, name:r.name, superFire:r._netSuper||false, ready:true });
      r._netSuper=false;
    }
  }
  // posições + detecção de ultrapassagem (evento p/ câmera)
  const ordered=[...R.runners].sort((a,b)=>olip(b)-olip(a));
  ordered.forEach((r,i)=>r.place=i+1);
  const meP = R.runners.find(r=>r.you);
  if(meP && meP.lastPlace!=null && meP.lastPlace!==meP.place && !meP.finished){
    const dir = meP.place<meP.lastPlace? -1: 1; // -1 subiu
    const other = R.runners.find(r=>!r.you && !r.finished && Math.abs(r.s-meP.s)<10 && r.place===meP.place-dir);
    R.cam.over = 1.6; R.cam.overA = meP; R.cam.overB = other||null;
    R.cam.overMsg = dir<0? "ULTRAPASSAGEM!" : "ULTRAPASSADA!";
    sfx.overtake();
  }
  for(const r of R.runners) r.lastPlace = r.place;
  // reta final: líder nos últimos 20% da última volta
  {
    const totalS = R.lapMeters*R.laps;
    const leadS = Math.max(...R.runners.map(r=>r.s));
    R.finalFx = leadS > totalS*0.80 && R.results.length===0;
  }
  if(R.results.length===1 && !R._arrived){ R._arrived=true; R.cam.arrive=2.8; }
  if(R.cam.arrive>0) R.cam.arrive-=dt;
  updateCamera(R, dt);
  // fim de todos / jogador terminou + 8s
  if(me&&me.finished && !R._celebrated && R.t-me.finishT>1.2){
    R._celebrated=true;
    celebrateFinish(me);
  }
  if(R.results.length>=R.runners.length && !R.finished){
    R.finished=true; endRace();
  }
  updateRaceUI();
}
function olip(r){
  return r.s + (r.finished? 1e9 - r.finishT*10 : 0);
}

const keys={};
window.addEventListener("keydown",e=>{
  if(e.key==="ArrowLeft")keys.left=true; if(e.key==="ArrowRight")keys.right=true;
  if(e.key==="ArrowUp")keys.up=true;
  if(e.key===" "){ doDash(); e.preventDefault(); }
  if(e.key==="e"||e.key==="E"){ doSuper(); }
});
window.addEventListener("keyup",e=>{
  if(e.key==="ArrowLeft")keys.left=false; if(e.key==="ArrowRight")keys.right=false;
  if(e.key==="ArrowUp")keys.up=false;
});

function applyCharSkill(r, dt, t){
  const id = r.def.skill.id;
  r._skillMul = r._skillMul||1;
  // passivas (m/s): bônus pequenos mas constantes
  switch(id){
    case "steady-speed": r.v += dt*0.4; break;
    case "endurance": if(r.v>3) r.stamina=Math.min(r.maxStamina,r.stamina+dt*1.2); break;
    case "precision": r.v += Math.abs(r.lat)*dt*0.3; break; // anula perda curva
    case "never-give-up": if(r.place>=7) r.v+=dt*1.0; break;
    case "rising-accel": r.v += dt*(r.lap*0.2); break;
    case "late-bloom": if(r.lap>=S.race.laps) r.v+=dt*0.8; break;
    case "sprint-king": if(S.race.t<20) r.v+=dt*0.8; break;
    case "burst-advance": if(r.place>=7) r.v+=dt*1.2; break;
    case "escape-artist": if(r.place===1) r.stamina=Math.min(r.maxStamina,r.stamina+dt*2); break;
  }
  // ativa periódica p/ bots
  r.skillCD-=dt;
  if(r.skillCD<=0 && !r.you){
    r.skillCD=14+Math.random()*8;
    r.dashT=Math.max(r.dashT,1.2);
  }
}

export function doDash(){
  const R=S.race; if(!R||S.mode!=="race") return;
  const me=R.runners.find(r=>r.you);
  if(!me||me.finished||R.countdown>0) return;
  if(me.dashCD>0){ sfx.error(); return; }
  const mult = me.def.skill.id==="long-dash"?2.1: me.def.skill.id==="turbo-burst"?1.6: 1.4;
  me.dashCD = me.def.skill.id==="long-dash"? 5.5 : me.def.skill.id==="turbo-burst"? 8 : 6.5;
  me.dashT = mult;
  me.super=Math.min(100,me.super+4);
  R.cam.shake=0.6;
  sfx.dash();
}
export function doSuper(){
  const R=S.race; if(!R||S.mode!=="race") return;
  const me=R.runners.find(r=>r.you);
  if(!me||me.finished||R.countdown>0) return;
  if(me.super<100){ sfx.error(); toast("Super ainda carregando!"); return; }
  fireSuper(me,false);
}
function fireSuper(r, remote){
  if(r.superOn||r.super<100) return;
  r.super= r.you? 0 : 15; // bots mantêm um pouco p/ não zerar HUD? jogador zera
  if(r.you) r.super=0;
  r.superOn=true; r.superT=5;
  r.dashT=Math.max(r.dashT,1.5);
  sfx.superFire();
  // cinemática GLOBAL sincronizada
  S.race.cine={ def:r.def, name:r.name, quote:r.def.super.quote, super:r.def.super.name, color:r.def.super.color, t:0, byMe:!!r.you };
  if(r.you){ r._netSuper=true; sendGameEvent("super",{ id:r.id, name:r.name, charId:r.charId }); }
  if(r.you){
    speakSuper(r.def, S.settings.voice!=="Desligada");
  }
  if(!remote) toast(`${r.def.super.name}!`);
}
function onFinish(me){
  const won = me.place===1;
  S.races++; if(won) S.wins++;
  const xpGain = won?120:40;
  S.xp+=xpGain;
  if(S.xp>=S.level*100){ S.level++; S.xp=0; S.coins+=500; toast(`Nível ${S.level}! +500 moedas`); }
  S.coins+= won?400:120;
  S.rankPts+= won?25:8;
  updateRank();
  checkMissions(me.charId, won);
  save();
  if(won) sfx.win(); else sfx.lose();
  speakResult(me.def, won, S.settings.voice!=="Desligada");
  updateTopbar();
}
function updateRank(){
  const p=S.rankPts;
  S.rank = p<50?"Bronze III":p<120?"Bronze I":p<220?"Prata II":p<350?"Ouro III":p<520?"Platina":"Diamante";
}
function celebrateFinish(me){
  // overlay resultado após 2s
  setTimeout(()=>{
    if(S.mode!=="race") return;
    showResults();
  }, 1800);
}
function endRace(){ showResults(); }
function showResults(){
  const R=S.race;
  const ordered=[...R.runners].sort((a,b)=>((a.finishT==null?1e9:a.finishT)-(b.finishT==null?1e9:b.finishT)) || olip(b)-olip(a));
  const me=R.runners.find(r=>r.you);
  $("resTitle").textContent = me.place===1? "🏆 VITÓRIA!": me.place<=3? `#${me.place} — Pódio!` : `#${me.place} — Corrida completa!`;
  // pódio 1º/2º/3º com animação de vitória/derrota
  const top3=[ordered[1],ordered[0],ordered[2]].filter(Boolean);
  const medals=["🥈","🥇","🥉"], steps=[70,110,45];
  $("podium").innerHTML = top3.map((r,i)=>{
    const pi = i===1?0:(i===0?1:2);
    return `<div class="pcol"><div class="pmedal">${medals[i]}</div>`
      + `<canvas id="pdCanvas${i}" width="90" height="200"></canvas>`
      + `<div class="pstep" style="height:${steps[i]*0.4}px">${pi+1}º</div>`
      + `<small>${escapeHtml(r.you?"Você ★":r.name)}<br>${fmtTime(r.finishT||R.t)}</small></div>`;
  }).join("");
  $("resLines").innerHTML = ordered.map((r,i)=>
    `<div class="resRow ${r.you?"me":""}"><span>#${i+1} ${r.you?"★ ":""} ${escapeHtml(r.name)}</span><span>${r.def.name} · ${fmtTime(r.finishT||R.t)}</span></div>`
  ).join("");
  $("resRewards").textContent = `+${me.place===1?400:120} moedas · +${me.place===1?120:40} XP · Circuito: ${R.map.name}`;
  showModal("resultsModal");
  requestAnimationFrame(()=>{
    top3.forEach((r,i)=>{
      const cv=$("pdCanvas"+i); if(!cv) return;
      const x2=cv.getContext("2d"); setupPixelCtx(x2);
      const pi = i===1?0:(i===0?1:2);
      drawUma(x2, r.def, 45, 198, 120, 0.35, pi===0?"win":(pi===2?"lose":"idle"), 1.2+i, i*1.7);
    });
  });
  playMusic("lobby");
}
function fmtTime(s){ const m=Math.floor(s/60), ss=(s%60).toFixed(1).padStart(4,"0"); return `${m}:${ss}`; }
function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

// ---------- CÂMERA LATERAL 2D ----------
// O mundo é medido em metros; a câmera só converte p/ pixels.
// Zooms, shakes e pans são 100% visuais: nunca tocam s, v, colisões ou resultados.
function updateCamera(R, dt){
  const cam = R.cam;
  const reduced = S.settings.camera==="Reduzida";
  const me = R.runners.find(r=>r.you);
  const anchor = me? me.s : Math.max(...R.runners.map(r=>r.s));
  const target = anchor + 9; // câmera SEMPRE grudada no jogador
  const k = reduced? 1-Math.pow(0.0001,dt) : 1-Math.pow(0.02,dt);
  cam.x += (target-cam.x)*Math.min(1,k);
  let z = 1;
  if(cam.over>0 && !reduced) z = 1.22;
  else if(me && me.dashT>0 && !reduced) z = 1.12;
  else if(R.finalFx && !reduced) z = 1.10;
  cam.zoom += (z-cam.zoom)*Math.min(1,dt*4);
  if(cam.over>0) cam.over-=dt;
  if(cam.shake>0) cam.shake=Math.max(0,cam.shake-dt*3);
}

// ---------- RACE DRAW ----------
function drawRace(t){
  const c=raceCanvas, ctx=raceCtx;
  const w=c.width,h=c.height;
  const R=S.race, map=R.map, cam=R.cam;
  const reduced = S.settings.camera==="Reduzida";
  const fxLow = (S.settings.fx||"Alto")==="Baixo";
  const qLow = S.settings.quality==="Baixo" || fxLow;
  const ppm = h*0.052*cam.zoom; // pixels por metro
  const shakeX = (!reduced && cam.shake>0)? Math.sin(t*61)*cam.shake*9 : 0;
  const shakeY = (!reduced && cam.shake>0)? Math.cos(t*47)*cam.shake*5 : 0;
  const anchorX = w*0.38 + shakeX;
  const groundY = h*0.80 + shakeY;
  const X = (s)=>anchorX + (s-cam.x)*ppm;
  const laneY = (lat)=>groundY + lat*h*0.016;

  // ----- céu -----
  const g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,map.sky[0]); g.addColorStop(0.52,map.sky[1]);
  g.addColorStop(0.53,map.grass); g.addColorStop(1,map.grass2);
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  ctx.fillStyle=map.sun||"#fff8d6";
  ctx.beginPath(); ctx.arc(w*0.78,h*0.14,h*0.045,0,7); ctx.fill();
  if(map.night){
    ctx.fillStyle="#fff";
    for(let i=0;i<36;i++){ const sx=(i*173)%w, sy=(i*97)%(h*0.45); ctx.globalAlpha=0.4+0.4*Math.sin(t*2+i); ctx.fillRect(sx,sy,2,2); }
    ctx.globalAlpha=1;
  }
  // nuvens (parallax leve)
  ctx.fillStyle = map.night? "rgba(120,120,180,0.5)" : "rgba(255,255,255,0.75)";
  const cloudOff = reduced? 0 : cam.x*ppm*0.06;
  for(let i=0;i<5;i++){
    const per=w+320;
    const cx0=((i*430-cloudOff)%per+per)%per-160;
    ctx.fillRect(cx0, h*(0.07+i*0.035), 90, 13);
    ctx.fillRect(cx0+18, h*(0.07+i*0.035)-9, 50, 10);
  }

  // ----- fundo distante + arquibancada -----
  drawFarLayer(ctx,w,h,map,t,cam,ppm,reduced);
  drawStands(ctx,w,h,map,t,cam,ppm,reduced,fxLow);

  // ----- pista -----
  const trackTop = h*0.62;
  ctx.fillStyle = map.track;
  ctx.fillRect(0,trackTop,w,h*0.30);
  ctx.fillStyle="rgba(0,0,0,0.12)"; ctx.fillRect(0,trackTop,w,5);
  ctx.fillStyle = map.grass2; ctx.fillRect(0,h*0.92,w,h*0.08);
  // linhas de raia com scroll
  ctx.fillStyle="rgba(255,255,255,0.55)";
  const dashStep=5;
  const startM = Math.floor((cam.x-anchorX/ppm)/dashStep)*dashStep;
  for(let m=startM; m<cam.x+(w-anchorX)/ppm+dashStep; m+=dashStep){
    const sx=X(m);
    if(sx<-20||sx>w+20) continue;
    ctx.fillRect(sx,trackTop+h*0.07,Math.max(2,ppm*2.2),3);
    ctx.fillRect(sx,trackTop+h*0.20,Math.max(2,ppm*2.2),3);
  }
  // pórticos de volta / chegada
  for(let k=0;k<=R.laps;k++){
    const gx=X(k*R.lapMeters);
    if(gx<-100||gx>w+100) continue;
    ctx.fillStyle="#1a2340";
    ctx.fillRect(gx-46,trackTop-h*0.20,10,h*0.20);
    ctx.fillRect(gx+36,trackTop-h*0.20,10,h*0.20);
    ctx.fillStyle = k===R.laps? "#ffd166" : "#f5f5f5";
    ctx.fillRect(gx-50,trackTop-h*0.235,100,h*0.045);
    ctx.fillStyle="#c1121f"; ctx.font=`bold ${Math.round(h*0.026)}px monospace`; ctx.textAlign="center";
    ctx.fillText(k===0?"🏁 LARGADA":(k===R.laps?"🏁 CHEGADA":`VOLTA ${k+1}`), gx, trackTop-h*0.205);
  }

  // grade da pista (trilho + postes com scroll do mundo)
  ctx.fillStyle = map.rail || "#f5f5f5";
  ctx.fillRect(0,trackTop+h*0.015,w,4);
  ctx.fillRect(0,trackTop+h*0.045,w,4);
  const railStep=12;
  const railStart = Math.floor((cam.x-anchorX/ppm)/railStep)*railStep;
  for(let m=railStart; m<cam.x+(w-anchorX)/ppm+railStep; m+=railStep){
    const px=X(m);
    if(px<-10||px>w+10) continue;
    ctx.fillRect(px,trackTop+h*0.005,5,h*0.06);
  }
  // ----- corredoras em perfil lateral -----
  const order=[...R.runners].sort((a,b)=>a.lat-b.lat); // trás primeiro
  let li=0;
  for(const r of order){
    const sx=X(r.s), sy=laneY(r.lat);
    if(sx<-220||sx>w+220) continue;
    const size=h*0.26*cam.zoom*(1+r.lat*0.006);
    const fxKind = fxOf(r.def.id);
    const zig = (r.superOn && fxKind==="chaos") ? Math.sin(t*28+r.phase*9)*size*0.07 : 0;
    const pose = r.finished? (r.place===1?"win":"run") : R.countdown>0? "idle" : (r.superOn||r.dashT>0)? "dash":"run";
    if((r.dashT>0||r.superOn) && !fxLow){
      ctx.save(); ctx.globalAlpha=0.45; ctx.fillStyle=r.def.super.color;
      ctx.fillRect(sx-size*0.55,sy-size*0.62,size*0.5,7);
      ctx.fillRect(sx-size*0.65,sy-size*0.42,size*0.5,6);
      ctx.restore();
    }
    drawUma(ctx, r.def, sx, sy+8+zig, size, 1.08, pose, t+r.phase, r.phase, 0, r.superOn);
    if(r.you || r.place<=3){
      const yOff=(li%3)*20; li++;
      ctx.font=`${Math.round(h*0.030)}px monospace`; ctx.textAlign="center";
      const label=`${r.place}º ${r.name}`;
      const tw=ctx.measureText(label).width;
      ctx.fillStyle="rgba(0,0,0,0.6)";
      ctx.fillRect(sx-tw/2-4,sy-size-24-yOff,tw+8,16);
      ctx.fillStyle=r.you?"#ffd166":"#fff";
      ctx.fillText(label,sx,sy-size-12-yOff);
    }
    if(r.you){
      ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(sx-28,sy-size-34,56,7);
      ctx.fillStyle=r.super>=100?"#ffe45e":"#66e0ff";
      ctx.fillRect(sx-28,sy-size-34,56*Math.min(1,r.super/100),7);
    }
    // ícone do buff ativo (todas as corredoras)
    if(r.buff && !fxLow){
      const bob2=Math.sin(t*6+r.phase*9)*3;
      ctx.font=`${Math.round(h*0.034)}px monospace`; ctx.textAlign="center";
      ctx.fillStyle="rgba(0,0,0,0.55)";
      ctx.fillRect(sx-15,sy-size-60+bob2,30,22);
      ctx.fillStyle="#fff";
      ctx.fillText(r.buff.icon,sx,sy-size-43+bob2);
    }
  }

  // ----- linhas de velocidade -----
  const me=R.runners.find(r=>r.you);
  if(!fxLow && me && (me.dashT>0 || me.v>19)){
    ctx.save(); ctx.globalAlpha=0.5; ctx.fillStyle="#ffffff";
    const n = me.dashT>0? 10:5;
    for(let i=0;i<n;i++){
      const yy=(i*167+t*2200)%h;
      ctx.fillRect(0,yy,w*0.16,3);
    }
    ctx.restore();
  }
  // ----- vinheta reta final -----
  if(R.finalFx && !qLow){
    const pulse=0.10+0.06*Math.sin(t*6);
    const vg=ctx.createLinearGradient(0,0,w,0);
    vg.addColorStop(0,`rgba(255,60,60,${pulse})`); vg.addColorStop(0.2,"rgba(255,60,60,0)");
    vg.addColorStop(0.8,"rgba(255,60,60,0)"); vg.addColorStop(1,`rgba(255,60,60,${pulse})`);
    ctx.fillStyle=vg; ctx.fillRect(0,0,w,h);
    ctx.font=`bold ${Math.round(h*0.05)}px monospace`; ctx.textAlign="center";
    ctx.fillStyle="#ff5252"; ctx.fillText("🔥 RETA FINAL!", w/2, h*0.10);
  }
  // ----- banner ultrapassagem (mostra as duas corredoras) -----
  if(cam.over>0 && cam.overA){
    ctx.save(); ctx.globalAlpha=Math.min(1,cam.over);
    ctx.font=`bold ${Math.round(h*0.055)}px monospace`; ctx.textAlign="center";
    const msg = cam.overMsg + (cam.overB? ` ${cam.overA.name} ⇄ ${cam.overB.name}` : ` ${cam.overA.name}`);
    ctx.fillStyle="rgba(0,0,0,0.55)";
    ctx.fillText(msg, w/2+3, h*0.20+3);
    ctx.fillStyle = cam.overMsg==="ULTRAPASSAGEM!"? "#7dff9e" : "#ff8a80";
    ctx.fillText(msg, w/2, h*0.20);
    ctx.restore();
  }
  // ----- banner chegada -----
  if(cam.arrive>0){
    ctx.save(); ctx.globalAlpha=Math.min(1,cam.arrive);
    ctx.font=`bold ${Math.round(h*0.07)}px monospace`; ctx.textAlign="center";
    ctx.fillStyle="#ffd166"; ctx.fillText("🏁 CHEGADA!", w/2, h*0.30);
    ctx.restore();
    if(!fxLow){
      for(let i=0;i<30;i++){
        const fx=(i*211+t*160)%w, fy=(i*137+t*220)%(h*0.6);
        ctx.fillStyle=["#ff6b6b","#ffd166","#7dff9e","#66e0ff"][i%4];
        ctx.fillRect(fx,fy,5,5);
      }
    }
  }
  // countdown
  if(R.countdown>0){
    ctx.font=`bold ${Math.round(h*0.20)}px monospace`; ctx.textAlign="center";
    ctx.fillStyle="rgba(0,0,0,0.4)"; ctx.fillText(Math.ceil(R.countdown),w/2+4,h*0.45+4);
    ctx.fillStyle="#fff"; ctx.fillText(Math.ceil(R.countdown),w/2,h*0.45);
  }
  // cinemática super: a personagem ATRAVESSA A TELA CORRENDO (sincronizada; só visual)
  // cada super tem apresentação própria (FXC): zigue-zague, raios, trevas, palco...
  if(R.cine){
    const k=R.cine.t;
    const fx = FXC[fxOf(R.cine.def.id)] || FXC.streak;
    R.cam.shake = Math.max(R.cam.shake||0, fx.shake*0.4);
    const a = k<0.25? k/0.25 : k>2.2? Math.max(0,(2.6-k)/0.4) : 1;
    ctx.save(); ctx.globalAlpha=Math.min(1,a);
    if(fx.dark){ ctx.fillStyle="rgba(12,4,26,0.80)"; ctx.fillRect(0,h*0.16,w,h*0.46); }
    else { ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(0,h*0.16,w,h*0.46); }
    ctx.fillStyle=R.cine.color; ctx.fillRect(0,h*0.16,w,6); ctx.fillRect(0,h*0.62-6,w,6);
    // raios dourados girando (royal)
    if(fx.rays && !fxLow){
      ctx.save(); ctx.translate(w*0.25, h*0.39); ctx.globalAlpha=0.30;
      ctx.fillStyle=R.cine.color;
      for(let i=0;i<10;i++){
        ctx.save(); ctx.rotate(t*0.7+i*0.63);
        ctx.fillRect(0,-3,h*0.5,6);
        ctx.restore();
      }
      ctx.restore();
    }
    // linhas de velocidade no fundo da faixa
    if(!fxLow){
      ctx.fillStyle="rgba(255,255,255,0.35)";
      for(let i=0;i<fx.lines;i++){
        const ly=h*0.20+((i*97+k*900)%(h*0.38));
        ctx.fillRect(w-((k*1400+i*260)%(w+300))+150,ly,120,3);
      }
    }
    // confetes/pétalas/estrelas
    if(fx.confetti && !fxLow){
      for(let i=0;i<30;i++){
        const fx2=(i*211+t*160)%w, fy=h*0.16+((i*137+t*220)%(h*0.44));
        ctx.fillStyle=fx.confetti[i%fx.confetti.length];
        ctx.fillRect(fx2,fy,5,5);
      }
    }
    // percurso: entra pela esquerda, corre até a direita (caos zigue-zagueia, dança quica)
    const prog=Math.min(1,k/2.5);
    const ease=prog<0.7? prog/0.7 : 1; // chega e posa no fim
    const runX=w*(0.10+0.30*ease);
    const runY=h*0.60 + (fx.zig? Math.sin(k*22)*fx.zig*ease : 0) - (fx.bounce? Math.abs(Math.sin(k*10))*fx.bounce*0.4*ease : 0);
    const runSize=h*0.36;
    // fantasmas (afterimage) do dash
    if(!fxLow){
      for(let gi=fx.ghosts;gi>=1;gi--){
        ctx.save(); ctx.globalAlpha=0.16;
        drawUma(ctx, R.cine.def, runX-gi*54, runY, runSize, 1.08, "run", t, t*2.4-gi*0.18);
        ctx.restore();
      }
    }
    // poeira nos pés
    if(!fxLow){
      ctx.fillStyle="rgba(255,255,255,0.5)";
      for(let i=0;i<6;i++) ctx.fillRect(runX-40-((t*400+i*37)%90), runY-6-(i*7)%18, 8, 4);
    }
    const endPose = prog>=1? fx.pose : "run";
    drawUma(ctx, R.cine.def, runX, runY, runSize, endPose==="super"?0.5:1.08, endPose, t, t*2.4, 0, true);
    ctx.textAlign="left";
    ctx.fillStyle=R.cine.color; ctx.font=`bold ${Math.round(h*0.055)}px monospace`;
    ctx.fillText(R.cine.super, w*0.46, h*0.30, w*0.50);
    ctx.fillStyle="#fff"; ctx.font=`${Math.round(h*0.038)}px monospace`;
    ctx.fillText(R.cine.name, w*0.46, h*0.365, w*0.50);
    ctx.fillStyle="#ffe9a8"; ctx.font=`italic ${Math.round(h*0.030)}px monospace`;
    ctx.fillText(`“${R.cine.quote}”`, w*0.46, h*0.43, w*0.50);
    // brilho de chegada do super
    if(prog>=1 && !fxLow){
      ctx.save(); ctx.globalAlpha=0.5+0.3*Math.sin(t*20);
      ctx.fillStyle=R.cine.color;
      ctx.fillRect(runX-8,h*0.20,5,h*0.38);
      ctx.restore();
    }
    ctx.restore();
  }
  drawProgress(ctx,w,h,R);
}

// Fundo distante com parallax por circuito
function drawFarLayer(ctx,w,h,map,t,cam,ppm,reduced){
  const off = reduced? 0 : cam.x*ppm*0.25;
  const per = 340, n = Math.ceil(w/per)+2;
  for(let i=-1;i<n;i++){
    const bx = ((i*per - off)%(per*n)+(per*n))%(per*n) - per;
    if(map.deco==="school"){
      ctx.fillStyle="#d8e4f0"; ctx.fillRect(bx+30,h*0.30,150,h*0.16);
      ctx.fillStyle="#26418f"; ctx.fillRect(bx+30,h*0.28,150,10);
      ctx.fillStyle="#9be8ff";
      for(let wy=0;wy<3;wy++) for(let wx=0;wx<5;wx++) ctx.fillRect(bx+40+wx*27,h*0.32+wy*16,16,10);
    } else if(map.deco==="city"){
      const bh = h*(0.14+((i*53)%40)/400);
      ctx.fillStyle="#1a1a3a"; ctx.fillRect(bx+20,h*0.46-bh,110,bh);
      ctx.fillStyle = (i%2)? "#66e0ff":"#ff6b9d";
      for(let wy=0;wy<4;wy++) ctx.fillRect(bx+30,h*0.46-bh+8+wy*14,90,4);
    } else if(map.deco==="palms") {
      ctx.fillStyle = "#e8d49a"; ctx.fillRect(0,h*0.40,w,h*0.08); // duna
      ctx.fillStyle = "#4ec4ff"; ctx.fillRect(0,h*0.44,w,h*0.04); // mar
      const off2 = reduced? 0 : cam.x*ppm*0.25;
      const per2 = 340, n2 = Math.ceil(w/per2)+2;
      for(let j=-1;j<n2;j++){
        const bx2 = ((j*per2 - off2)%(per2*n2)+(per2*n2))%(per2*n2) - per2;
        ctx.fillStyle="#2e8b8b"; ctx.fillRect(bx2+80,h*0.26,10,h*0.16);
        ctx.fillStyle="#2e9e4f";
        ctx.fillRect(bx2+50,h*0.24,80,12); ctx.fillRect(bx2+60,h*0.21,60,10);
        ctx.fillStyle="#8a5a2a"; ctx.fillRect(bx2+72,h*0.30,6,6); // cocos
        ctx.fillRect(bx2+92,h*0.30,6,6);
      }
    } else { // stand / trees: colina + árvore com tronco e copa
      ctx.fillStyle = map.night? "#14243a" : "rgba(90,160,90,0.8)";
      ctx.beginPath(); ctx.arc(bx+170,h*0.50,90,Math.PI,0); ctx.fill();
      ctx.fillStyle = map.deco==="trees"? "#3a2a1a" : "#6b4a2a";
      ctx.fillRect(bx+160,h*0.36,14,h*0.10);
      ctx.fillStyle = map.deco==="trees"? "#1e5a2e" : "rgba(70,130,70,0.95)";
      ctx.beginPath(); ctx.arc(bx+167,h*0.35,h*0.045,0,7); ctx.fill();
      ctx.beginPath(); ctx.arc(bx+140,h*0.38,h*0.03,0,7); ctx.fill();
      ctx.beginPath(); ctx.arc(bx+195,h*0.38,h*0.03,0,7); ctx.fill();
    }
  }
}

// Arquibancada rolando com público animado
function drawStands(ctx,w,h,map,t,cam,ppm,reduced,fxLow){
  const top=h*0.50, bot=h*0.62;
  ctx.fillStyle="rgba(0,0,0,0.30)"; ctx.fillRect(0,top,w,bot-top);
  ctx.fillStyle = map.night? "#23233f" : "#e8e0d0"; ctx.fillRect(0,top,w,8);
  const off = reduced? 0 : cam.x*ppm*0.55;
  const step=14, n=Math.ceil(w/step)+2;
  for(let i=-1;i<n;i++){
    const d = ((i*step - off)%(step*n)+(step*n))%(step*n) - step;
    const ci = ((i%map.crowd.length)+map.crowd.length)%map.crowd.length;
    const bounce = fxLow? 0 : Math.sin(t*4+i*1.7)*2;
    ctx.fillStyle=map.crowd[ci];
    ctx.fillRect(d, bot-22+bounce, 8, 14);
    ctx.fillStyle="#f2c9a0";
    ctx.fillRect(d+1, bot-28+bounce, 6, 6);
  }
}

// Barra de progresso do circuito (posição na competição de relance)
function drawProgress(ctx,w,h,R){
  const x0=w*0.22, x1=w*0.78, y=8, hh=9;
  const totalS=R.lapMeters*R.laps;
  ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(x0-4,y-4,(x1-x0)+8,hh+8);
  ctx.fillStyle="#22283f"; ctx.fillRect(x0,y,x1-x0,hh);
  ctx.fillStyle="rgba(255,255,255,0.35)";
  for(let k=1;k<R.laps;k++){ const lx=x0+(x1-x0)*k/R.laps; ctx.fillRect(lx,y,2,hh); }
  // chegada
  ctx.fillStyle="#fff"; ctx.fillRect(x1-3,y,3,hh);
  for(const r of R.runners){
    const p=Math.max(0,Math.min(1,r.s/totalS));
    const dx=x0+(x1-x0)*p;
    ctx.fillStyle=r.you?"#ffd166":r.bot?"#9aa0b0":"#66e0ff";
    ctx.fillRect(dx-3,y-2,r.you?7:5,r.you?11:9);
  }
}

// ---------- HUD / CONTROLS (só botões: CORRER / DASH / SUPER) ----------
function bindControls(){
  const run=$("btnRun");
  if(!run||run._bound) return; run._bound=true;
  run.addEventListener("pointerdown",e=>{e.preventDefault(); btnRun=true; run.classList.add("held");});
  ["pointerup","pointercancel","pointerleave"].forEach(ev=>run.addEventListener(ev,()=>{btnRun=false; run.classList.remove("held");}));
  $("btnDash").addEventListener("click",()=>doDash());
  $("btnSuper").addEventListener("click",()=>doSuper());
}

export function updateRaceUI(){
  const R=S.race; if(!R) return;
  const me=R.runners.find(r=>r.you);
  if(!me) return;
  $("hudSpeed").textContent=Math.round(me.v*3.6)+" km/h";
  $("hudPos").textContent=`${me.place}º/${R.runners.length}`;
  $("hudLap").textContent=`Volta ${me.lap}/${R.laps}`;
  $("hudTime").textContent=fmtTime(R.t);
  $("superFill").style.width=Math.min(100,me.super)+"%";
  $("stamFill").style.width=Math.max(0,me.stamina/me.maxStamina*100)+"%";
  // buff ativo no HUD
  const br=$("buffRow");
  if(br) br.innerHTML = me.buff
    ? `<div class="buff">${me.buff.icon} ${me.buff.label}<i style="width:${Math.max(0,me.buff.t/me.buff.dur*100)}%"></i></div>`
    : "";
  const bs=$("btnSuper");
  bs.classList.toggle("ready",me.super>=100);
  $("dashCd").textContent = me.dashCD>0? me.dashCD.toFixed(1):"";
}

// ---------- SHOP / CHARS / SCREENS ----------
export function refreshShop(){
  const grid=$("shopGrid"); if(!grid) return;
  grid.innerHTML="";
  const items=[
    ...CHARACTERS.map(c=>({ kind:"char", id:c.id, name:c.name, price:rarityPrice(c), owned:S.unlocked.includes(c.id), rarity:c.rarity })),
    { kind:"scene", id:"jardim", name:"Cenário: Jardins", price:1200, owned:S._scenes?.includes("jardim") },
    { kind:"scene", id:"treino", name:"Cenário: Centro de Treino", price:1200, owned:S._scenes?.includes("treino") },
  ];
  for(const it of items){
    const d=document.createElement("div");
    d.className="shopCard"+(it.owned?" owned":"");
    const icon = it.kind==="char" ? `<canvas width="48" height="48" data-char="${it.id}"></canvas>` : `<div class="sceneIcon">🎨</div>`;
    d.innerHTML=`${icon}<b>${it.name}</b><small>${it.rarity||"extra"}</small><span>${it.owned?"✔":"🪙 "+it.price}</span>`;
    d.onclick=()=>buyItem(it);
    grid.appendChild(d);
  }
  // rostos das personagens como ícones da loja
  grid.querySelectorAll("canvas[data-char]").forEach(cv=>{
    const def=getChar(cv.dataset.char);
    const x2=cv.getContext("2d"); setupPixelCtx(x2);
    drawUma(x2, def, 24, 50, 46, 0.35, "idle", 1.1+def.name.length, 0);
  });
}
function rarityPrice(c){ return RARITY_INFO[c.rarity].priceCoins; }
function buyItem(it){
  if(it.owned){ if(it.kind==="scene"){ S.lobbyScene=it.id; save(); toast("Cenário aplicado!"); } return; }
  if(S.coins<it.price){ sfx.error(); toast("Moedas insuficientes! Complete missões."); return; }
  S.coins-=it.price;
  if(it.kind==="char") S.unlocked.push(it.id);
  if(it.kind==="scene"){ S._scenes=S._scenes||["academia","hipodromo"]; S._scenes.push(it.id); S.lobbyScene=it.id; }
  sfx.buy(); save(); updateTopbar(); refreshShop(); toast("Compra feita!");
}
export function charDetailHTML(c){
  const ri = RARITY_INFO[c.rarity] || { stars: 1, color: "#fff" };
  const bars = [["⚡ Vel.",c.speed],["💚 Fôl.",c.stamina],["💪 For.",c.power],["🛡 Gar.",c.guts],["🧠 Téc.",c.wit]]
    .map(([k,v])=>'<div class="statBar"><span class="k">'+k+'</span><div class="tr"><i class="fl" style="width:'+v+'%"></i></div></div>').join("");
  return '<b>'+c.name+'</b> <span style="color:'+ri.color+'">'+"★".repeat(ri.stars)+" "+c.rarity+'</span> · Nv '+S.level+'<br>'
    +'<small>'+c.personality+" · "+c.style+'</small><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 8px;margin-top:4px">'+bars+'</div>'
    +'<div style="margin-top:4px">🎯 <b>'+c.skill.name+':</b> '+c.skill.desc+'<br>🌟 <b>'+c.super.name+':</b> “'+c.super.quote+'”</div>';
}
export function refreshChars(){
  const grid=$("charGrid"); if(!grid) return;
  grid.innerHTML="";
  for(const c of CHARACTERS){
    const owned=S.unlocked.includes(c.id);
    const ri = RARITY_INFO[c.rarity] || { stars: 1, color: "#fff" };
    const d=document.createElement("div");
    d.className="charCard"+(S.charId===c.id?" sel":"")+(owned?"":" locked");
    d.innerHTML=`<canvas width="72" height="120"></canvas><b>${c.name}</b><div class="cstars" style="color:${ri.color}">${"★".repeat(ri.stars)} ${c.rarity}</div><small>Nv ${S.level} · ${c.style}</small>
      <div class="cstat">⚡<div class="tr"><i class="fl" style="width:${c.speed}%"></i></div></div>
      <div class="cstat">💚<div class="tr"><i class="fl" style="width:${c.stamina}%"></i></div></div>
      <small>${owned? (S.charId===c.id ? "✔ selecionada" : "Toque p/ selecionar · "+c.skill.name) : "🔒 "+rarityPrice(c)+" moedas"}</small>`;
    const cv=d.querySelector("canvas");
    const x2=cv.getContext("2d"); setupPixelCtx(x2);
    drawUma(x2,c,36,118,112,0.5,"idle",performance.now()/1000+c.name.length,0,0);
    d.onclick=()=>{
      if(!owned){
        if(S.coins>=rarityPrice(c)){ S.coins-=rarityPrice(c); S.unlocked.push(c.id); sfx.buy(); save(); updateTopbar(); refreshChars(); buildLobbyGallery(); toast(`${c.name} desbloqueada!`); }
        else { sfx.error(); toast("Bloqueada — compre na loja ou complete missões!"); }
        return;
      }
      selectLobbyChar(c.id);
      refreshChars();
      $("charDetail").innerHTML=charDetailHTML(c);
    };
    grid.appendChild(d);
  }
  const cur=getChar(S.charId);
  $("charDetail").innerHTML=charDetailHTML(cur);
}
export function refreshMissions(){
  const el=$("missionList"); if(!el) return;
  el.innerHTML = MISSIONS.map(m=>{
    const p=Math.min(m.goal,m.prog()), done=!!S.missions[m.id];
    return `<div class="mRow ${done?"done":""}"><div><b>${done?"✅ ":""}${m.name}</b><small>${m.desc} — ${p}/${m.goal}</small></div>
      <div class="mBar"><i style="width:${p/m.goal*100}%"></i></div></div>`;
  }).join("");
}
export function updateTopbar(){
  if($("tbCoins")) $("tbCoins").textContent=fmt(S.coins);
  if($("tbPrem")) $("tbPrem").textContent=fmt(S.premium);
  if($("tbRank")) $("tbRank").textContent=S.rank;
  if($("tbName")) $("tbName").textContent=S.name;
  if($("tbLvl")) $("tbLvl").textContent="Nv "+S.level;
}

// ---------- navigation ----------
export function showScreen(name){
  S.mode=name;
  document.querySelectorAll(".screen").forEach(s=>s.hidden=true);
  const map={ lobby:"scrLobby", chars:"scrChars", shop:"scrShop", missions:"scrMissions", events:"scrEvents", friends:"scrFriends", settings:"scrSettings", race:"scrRace" };
  const id=map[name]||"scrLobby";
  if($(id)) $(id).hidden=false;
  if(name==="chars") refreshChars();
  if(name==="shop") refreshShop();
  if(name==="missions") refreshMissions();
  if(name==="settings") fillSettings();
  sizeCanvas($("lobbyCanvas")); sizeCanvas($("raceCanvas"));
}
export function showModal(id){ if($(id)) $(id).hidden=false; }
export function hideModal(id){ if($(id)) $(id).hidden=true; }

function fillSettings(){
  if(!$("setMusic")) return;
  $("setMusic").value=S.settings.music; $("setSfx").value=S.settings.sfx;
  $("setQuality").value=S.settings.quality; $("setName").value=S.name;
  if($("setCam")) $("setCam").value=S.settings.camera||"Suave";
  if($("setFx")) $("setFx").value=S.settings.fx||"Alto";
  if($("setVoice")) $("setVoice").value=S.settings.voice||"Ligada";
}

// expõe p/ inline handlers
window.SV = { S, showScreen, showModal, hideModal, startRace, doDash, doSuper, doEmote, selectLobbyChar, buildLobbyGallery, updateLobbyCharUI, createRoom, joinRoom, leaveRoom, save, toast };

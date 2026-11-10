// STAR VELOCITY — vozes das corredoras (fala nativa do aparelho, sem download).
// Usa window.speechSynthesis: fala as frases em PT-BR com a voz do dispositivo
// (Android/iOS têm voz PT-BR; no PC usa a melhor disponível). Cada
// personalidade tem ritmo + tom próprios: fofa (aguda e rápida), selvagem
// (aguda e enérgica), fria (grave e lenta), elegante (grave e calma).
// Tudo falha silenciosamente se o aparelho não tiver voz — o jogo segue normal.
import { PERSONA } from "./characters.js";

const RATE = { cute: 1.14, wild: 1.10, cool: 0.90, noble: 0.93 };
const PITCH = { cute: 1.5, wild: 1.25, cool: 0.85, noble: 1.0 };

let voiceCache = null;
function pickVoice(){
  if(voiceCache !== null) return voiceCache;
  try{
    const s = window.speechSynthesis;
    if(!s){ voiceCache = null; return null; }
    const vs = s.getVoices() || [];
    const pt = vs.filter(v => v.lang && v.lang.toLowerCase().startsWith("pt"));
    const pool = pt.length ? pt : vs;
    const prefer = ["luciana", "google português", "google portugues", "maria", "helo", "camila", "female", "feminina"];
    let best = null;
    for(const p of prefer){
      best = pool.find(v => (v.name||"").toLowerCase().includes(p));
      if(best) break;
    }
    voiceCache = best || pool[0] || null;
  }catch(e){ voiceCache = null; }
  return voiceCache;
}
if(typeof window !== "undefined" && window.speechSynthesis){
  try{
    window.speechSynthesis.onvoiceschanged = () => { voiceCache = null; pickVoice(); };
    pickVoice();
  }catch(e){}
}

function personaOf(d){
  if(typeof d === "string") return d.replace(/-[ab]$/, "") || "cool";
  return (PERSONA && PERSONA[d.id]) || "cool";
}

export function isVoiceReady(){
  try{ return !!(window.speechSynthesis); }catch(e){ return false; }
}

export function stopVoice(){
  try{ if(window.speechSynthesis) window.speechSynthesis.cancel(); }catch(e){}
}

// Fala um texto com a voz da personalidade. Retorna true se despachou.
export function speak(text, defOrPers, enabled){
  if(enabled === false || !text) return false;
  try{
    const s = window.speechSynthesis;
    if(!s) return false;
    const p = personaOf(defOrPers);
    try{ s.cancel(); }catch(e){}
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = RATE[p] || 1;
    u.pitch = PITCH[p] || 1;
    const v = pickVoice();
    if(v) u.voice = v;
    s.speak(u);
    return true;
  }catch(e){ return false; }
}

const WIN_LINES = {
  cute: ["Eu consegui! Viu só?!", "Vitória! Essa é pra você!"],
  wild: ["HAHA! Ninguém me segura!", "Fácil demais! Quero de novo!"],
  cool: ["Como previsto. Vitória.", "Silêncio... eu venci."],
  noble: ["Com graça e honra, eu venço.", "A vitória me pertence por direito."],
};
const LOSE_LINES = {
  cute: ["Snif... na próxima eu ganho!", "Poxa... vou treinar mais!"],
  wild: ["O QUÊ?! De novo! Corre de novo!", "Hmph! Foi sorte de principiante!"],
  cool: ["...Anotado. Na próxima, venço.", "Derrota também é dado."],
  noble: ["Que vexame... vou me redimir.", "A derrota de hoje aduba a vitória."],
};
const HELLO = {
  cute: "Oi! Eu sou a",
  wild: "HA! Cheguei! Eu sou a",
  cool: "...Eu sou a",
  noble: "É uma honra. Eu sou a",
};

export function speakSuper(def, enabled){
  return speak(def.super.quote, def, enabled);
}
export function speakResult(def, won, enabled){
  const p = personaOf(def);
  const arr = won ? WIN_LINES[p] : LOSE_LINES[p];
  return speak(arr[def.name.length % arr.length], def, enabled);
}
export function speakHello(def, enabled){
  return speak(`${HELLO[personaOf(def)]} ${def.name}!`, def, enabled);
}

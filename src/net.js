// STAR VELOCITY — net multiplayer via server-plugin (com fallback bots).
// Sala = código 4 letras. Tópico: sv-room-<CODE>. Relay com índice sequencial.
// Funciona sem servidor (bots) e com preview emulator.

export const net = {
  socket: null, room: null, myId: null, name: "Jogador",
  peers: new Map(), // id -> {name,charId,ready,x...}
  seq: 0, lastRemoteSeq: 0,
  connected: false, isLeader: false,
  onEvent: null, // (type, payload) => {}
  _hb: null,
};

function genId(){ return "p"+Math.random().toString(36).slice(2,9); }
export function makeRoomCode(){ const L="ABCDEFGHJKMNPQRSTUVWXYZ"; let s=""; for(let i=0;i<4;i++) s+=L[Math.floor(Math.random()*L.length)]; return s; }

export async function connectNet(){
  net.myId = net.myId || genId();
  if(net.socket) return true;
  try{
    const sock = root.createServerSocket();
    net.socket = sock;
    sock.binaryType = "arraybuffer";
    sock.addEventListener("open", ()=>{
      net.connected = true;
      if(net.room) joinTopic();
      emit("conn", { ok:true });
    });
    sock.addEventListener("message", (ev)=>{
      try{
        const msg = JSON.parse(typeof ev.data==="string"? ev.data : new TextDecoder().decode(ev.data));
        handleMsg(msg);
      }catch(e){}
    });
    sock.addEventListener("close", (ev)=>{
      net.connected = false;
      emit("conn", { ok:false, code: ev.code, reason: ev.reason });
      // 4403 = proibido (não reconecta). 4429 quarentena: espera.
      if(ev.code!==4403 && ev.code!==4429) scheduleReconnect();
    });
    await sock.opened;
    return true;
  }catch(e){ net.connected=false; return false; }
}

let _rcT=null;
function scheduleReconnect(){
  clearTimeout(_rcT);
  _rcT=setTimeout(async ()=>{
    if(net.room && !net.connected){
      net.socket=null;
      await connectNet();
    }
  }, 2500+Math.random()*2000);
}

function joinTopic(){
  // Assinatura é server-side? No server-plugin o subscribe é server-side via mensagem.
  // Nosso servidor entende {t:"sub",room} e publica {t:"ev",...}.
  send({ t:"sub", room: net.room, who:{ id:net.myId, name:net.name, charId: gameState()?.charId } });
  clearInterval(net._hb);
  net._hb = setInterval(()=>{ // presença + heartbeat 5s
    if(net.connected) send({ t:"hb", room:net.room, who:{ id:net.myId, name:net.name, charId:gameState()?.charId, ready:gameState()?.ready } });
  }, 5000);
}

export async function createRoom(name, charId){
  await connectNet();
  net.room = makeRoomCode();
  net.isLeader = true;
  net.name = name;
  net.peers.clear();
  if(net.connected) joinTopic();
  broadcastLocal("room",{ room:net.room, leader:true });
  return net.room;
}
export async function joinRoom(code, name){
  await connectNet();
  net.room = (code||"").toUpperCase().trim();
  net.isLeader = false;
  net.name = name;
  if(net.connected) joinTopic();
  broadcastLocal("room",{ room:net.room, leader:false });
  return net.room;
}
export function leaveRoom(){
  if(net.connected && net.room) try{ send({ t:"leave", room:net.room, id:net.myId }); }catch(e){}
  clearInterval(net._hb);
  net.room=null; net.peers.clear(); net.isLeader=false;
}

function send(o){ if(net.socket && net.connected){ try{ net.socket.send(JSON.stringify(o)); }catch(e){} } }

// broadcast jogo (relay via servidor se conectado; sempre local echo p/ bots)
let _lastSend = 0;
export function sendRace(r){
  const now = performance.now();
  if(now - _lastSend < 100) return; // 10Hz
  _lastSend = now;
  net.seq++;
  const msg = { t:"race", room:net.room, seq:net.seq, from:net.myId, d:r };
  send(msg);
  // echo local tratado pelo game via onEvent? não — game usa estado local direto.
}
export function sendGameEvent(kind, data){
  const msg = { t:"ev", room:net.room, from:net.myId, kind, data, seq:++net.seq };
  send(msg);
  handleMsg(msg); // eco local
}

function handleMsg(m){
  if(!m) return;
  if(m.room && net.room && m.room!==net.room) return;
  if(m.t==="race"){
    if(m.from===net.myId) return;
    if(m.seq<=net.lastRemoteSeq) return;
    net.lastRemoteSeq=m.seq;
    net.peers.set(m.from, { ...(net.peers.get(m.from)||{}), ...m.d, id:m.from, updated:Date.now() });
    emit("race", { from:m.from, d:m.d });
  } else if(m.t==="ev"){
    if(m.kind==="hello"||m.kind==="hb"||m.kind==="state"){
      const w = m.who||m.data;
      if(w&&w.id&&w.id!==net.myId) net.peers.set(w.id,{ ...(net.peers.get(w.id)||{}), ...w, updated:Date.now() });
    } else if(m.kind==="leave"){
      net.peers.delete(m.id||m.from);
    }
    emit(m.kind, m.data||m);
  } else if(m.t==="snap"){
    // snapshot do líder (posições)
    emit("snap", m);
  }
}

function emit(type, payload){ try{ net.onEvent && net.onEvent(type, payload); }catch(e){} }
function broadcastLocal(type,payload){ emit(type,payload); }
function gameState(){ try{ return window.__SV_STATE__||null; }catch(e){ return null; } }

// Anuncia presença/líder inicia
export function announceHello(){
  send({ t:"ev", room:net.room, from:net.myId, kind:"hello", who:{ id:net.myId, name:net.name, charId:gameState()?.charId, ready:gameState()?.ready } });
}

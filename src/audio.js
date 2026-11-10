// STAR VELOCITY — áudio procedural (WebAudio). Sem assets.
let ctx = null, master=null, musicGain=null, sfxGain=null;
let musicTimer=null, musicStep=0, musicMode="lobby";
let volumes = { music: 0.7, sfx: 0.8 };

export function initAudio(){
  if(ctx) return;
  try{
    ctx = new (window.AudioContext||window.webkitAudioContext)();
    master = ctx.createGain(); master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    applyVolumes();
  }catch(e){}
}
export function setVolumes(m, s){ volumes.music=m; volumes.sfx=s; applyVolumes(); }
export function getVolumes(){ return {...volumes}; }
function applyVolumes(){
  if(!ctx) return;
  musicGain.gain.value = volumes.music*0.35;
  sfxGain.gain.value = volumes.sfx;
}
export function resumeAudio(){ initAudio(); if(ctx&&ctx.state==="suspended") ctx.resume(); }

function beep(freq, dur, type="square", vol=0.5, slide=0){
  if(!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type=type; o.frequency.setValueAtTime(freq, ctx.currentTime);
  if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide), ctx.currentTime+dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+dur);
  o.connect(g); g.connect(sfxGain);
  o.start(); o.stop(ctx.currentTime+dur+0.02);
}
function noise(dur=0.2, vol=0.4, hp=1000){
  if(!ctx) return;
  const len = Math.floor(ctx.sampleRate*dur);
  const buf = ctx.createBuffer(1,len,ctx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
  const src = ctx.createBufferSource(); src.buffer=buf;
  const f = ctx.createBiquadFilter(); f.type="highpass"; f.frequency.value=hp;
  const g = ctx.createGain(); g.gain.value=vol;
  src.connect(f); f.connect(g); g.connect(sfxGain); src.start();
}

export const sfx = {
  click(){ beep(660,0.07,"square",0.3); beep(990,0.05,"square",0.2); },
  hover(){ beep(440,0.03,"square",0.1); },
  buy(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.12,"square",0.35),i*80)); },
  error(){ beep(160,0.2,"sawtooth",0.4,-60); },
  dash(){ noise(0.25,0.5,600); beep(300,0.25,"sawtooth",0.3,500); },
  run(){ noise(0.08,0.15,1200); },
  overtake(){ beep(880,0.12,"square",0.35,220); },
  superReady(){ [784,988,1175,1568].forEach((f,i)=>setTimeout(()=>beep(f,0.15,"triangle",0.4),i*90)); },
  superFire(){ noise(0.6,0.5,300); beep(200,0.6,"sawtooth",0.4,800); },
  win(){ [523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>beep(f,0.2,"triangle",0.4),i*120)); },
  lose(){ [400,350,300,220].forEach((f,i)=>setTimeout(()=>beep(f,0.25,"triangle",0.35),i*150)); },
  countGo(){ beep(880,0.3,"square",0.5); },
  countBeep(){ beep(440,0.15,"square",0.4); },
  invite(){ beep(740,0.1,"sine",0.4); setTimeout(()=>beep(980,0.12,"sine",0.4),110); },
  join(){ beep(520,0.1,"sine",0.35,200); },
  emote(){ beep(700,0.08,"sine",0.3,150); },
  buff(){ beep(980,0.09,"sine",0.28,240); setTimeout(()=>beep(1320,0.1,"sine",0.22),90); },
};

// Musiquinha chiptune em loop (lobby calmo / corrida energético)
const SONGS = {
  lobby: { bpm: 112, bass:[130,130,165,147,130,130,196,165], lead:[523,587,659,784,659,587,523,440] },
  race:  { bpm: 150, bass:[110,110,131,110,147,110,165,147], lead:[440,523,659,880,784,659,523,659] },
  night: { bpm: 120, bass:[98,98,117,98,131,117,98,82], lead:[392,440,494,587,659,587,494,440] },
};
export function playMusic(mode="lobby"){
  initAudio(); if(!ctx) return;
  stopMusic();
  musicMode = mode;
  const song = SONGS[mode] || SONGS.lobby;
  const stepDur = 60/song.bpm/2;
  musicStep=0;
  musicTimer = setInterval(()=>{
    if(!ctx) return;
    const i = musicStep % song.bass.length;
    const bf = song.bass[i], lf = song.lead[i];
    // baixo
    const o1=ctx.createOscillator(), g1=ctx.createGain();
    o1.type="triangle"; o1.frequency.value=bf;
    g1.gain.setValueAtTime(0.5,ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+stepDur*0.95);
    o1.connect(g1); g1.connect(musicGain); o1.start(); o1.stop(ctx.currentTime+stepDur);
    // lead (só em alguns steps p/ não cansar)
    if(musicMode==="race" || i%2===0){
      const o2=ctx.createOscillator(), g2=ctx.createGain();
      o2.type="square"; o2.frequency.value=lf;
      g2.gain.setValueAtTime(0.12,ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+stepDur*0.9);
      o2.connect(g2); g2.connect(musicGain); o2.start(); o2.stop(ctx.currentTime+stepDur);
    }
    musicStep++;
  }, stepDur*1000);
}
export function stopMusic(){ if(musicTimer){ clearInterval(musicTimer); musicTimer=null; } }

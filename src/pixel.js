// STAR VELOCITY — renderer pixel art HD procedural (sem blur).
// Modelo CHIBI V1.6 das refs @npc.ffbeta: ~2.5 cabeças, OLHÕES c/ highlight grande,
// juba volumosa arredondada, roupa idol c/ dourado, PERNAS GROSSAS (coxa+meia+botona).
import { PERSONA } from "./characters.js";
function snap(v, p){ return Math.round(v / p) * p; }

export function setupPixelCtx(ctx){
  ctx.imageSmoothingEnabled = false;
}

function shade(hex, amt){
  const n = parseInt(hex.slice(1), 16);
  let r = (n>>16)+amt, g = ((n>>8)&255)+amt, b = (n&255)+amt;
  r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
  return `rgb(${r},${g},${b})`;
}

// x,y = CHÃO (centro dos pés). h = altura total. angle 0=frente, PI=costas.
// Rosto SEMPRE em 3/4 (faceTurn comprimido): os DOIS OLHOS aparecem até de lado.
export function drawUma(ctx, def, x, y, h, angle, pose="idle", t=0, runPhase=0, spin=0, aura=false){
  const P = Math.max(1, Math.round(h / 110)); // pixel médio: traço limpo chibi
  const dirX = Math.sin(angle), dirZ = Math.cos(angle);
  const side = Math.abs(dirX), back = dirZ < 0;
  const pal = def.palette;
  const style = def.hairStyle||"bob";
  const running = (pose==="run"||pose==="dash");
  const dash = (pose==="dash");
  const happy = (pose==="win"||pose==="super"||pose==="present");
  const sad = (pose==="lose");
  const pers = (PERSONA && PERSONA[def.id]) || "cool";
  const wild = pers==="wild", cute = pers==="cute", cool = pers==="cool";
  const hb = wild ? 1.7 : 1;
  const bob = running ? Math.abs(Math.sin(runPhase*Math.PI*2))*h*0.015 : Math.sin(t*2.2)*h*0.003 + (cute? Math.abs(Math.sin(t*3.1))*h*0.004 : 0);
  const sway = Math.sin(t*1.1)*h*0.003;
  const blink = ((t % 3.7) < 0.12) && !happy && !running;
  const faceTurn = Math.max(-0.62, Math.min(0.62, dirX*0.55));
  const lean = dash ? h*0.050 : running ? h*0.035 : 0;
  const crouch = dash ? h*0.030 : running ? h*0.020 : 0;
  const runF = running ? (Math.abs(dirX) > 0.25 ? Math.sign(dirX) : 1)*h*0.025 : 0;
  const spinB = Math.max(-6, Math.min(6, spin*3.0));
  const cx = x + dirX*h*0.008 + sway + lean*0.3;

  const R = (rx,ry,rw,rh,c) => {
    ctx.fillStyle = c;
    ctx.fillRect(snap(rx,P), snap(ry,P), Math.max(P,Math.round(rw/P)*P), Math.max(P,Math.round(rh/P)*P));
  };
  const seg = (x0,y0,x1,y1,w,c0) => {
    ctx.strokeStyle = c0; ctx.lineWidth = Math.max(2,w); ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
  };

  // sombra no chão
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y, h*0.16, h*0.030, 0, 0, Math.PI*2);
  ctx.fill();

  // aura super/present (ou forçada)
  if(pose==="super" || pose==="present" || aura){
    const c = def.super.color;
    ctx.save(); ctx.globalAlpha = 0.30;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(cx, y-h*0.36, h*0.20, h*0.33, 0, 0, Math.PI*2);
    ctx.fill(); ctx.restore();
    ctx.save();
    for(let i=0;i<10;i++){
      const a = t*2 + i*0.63;
      ctx.fillStyle = i%2? "#ffffff" : c;
      ctx.fillRect(snap(cx+Math.cos(a)*h*0.22,P), snap(y-h*0.36+Math.sin(a)*h*0.24,P), P, P);
    }
    ctx.restore();
  }
  if(dash){
    ctx.save(); ctx.globalAlpha=0.35; ctx.fillStyle="#ffffff";
    for(let i=0;i<3;i++){
      const yy = y - h*0.45 + i*h*0.10;
      ctx.fillRect(snap(cx - dirX*h*0.25 - h*0.16,P), snap(yy,P), h*0.20, P*2);
    }
    ctx.restore();
  }

  // ---- esqueleto chibi ----
  const groundY = y;
  const shoeH = h*0.075, shoeL = h*0.125;
  const legH = h*0.165;
  const hipY = groundY - shoeH - legH + bob*0.4 + crouch;
  const waistY = hipY - h*0.055;
  const chestY = hipY - h*0.125;
  const shY = chestY - h*0.01;
  const chinY = shY - h*0.02 + bob*0.3 + crouch*0.3;
  const headH = h*0.455, headW = h*0.43*(1-side*0.08); // cabeção fofo
  const headTop = chinY - headH;
  const headCX = cx + runF + dirX*h*0.008 + lean*0.3;
  const torsoW = h*0.17, hipW = h*0.18;
  const upX = cx + runF;
  const thighW = Math.max(P*4, h*0.058); // coxas GROSSAS (ref: nada de perna fina)
  const calfW = Math.max(P*3, h*0.046);
  const armW = Math.max(P*3, h*0.034);

  // ---- RABINHO pequeno ----
  if(back || side > 0.2){
    for(let i=0;i<3;i++){
      const tx = cx - dirX*h*(0.07 + i*0.038) + Math.sin(t*3.2+i)*h*0.006*(1+i);
      const ty = hipY - h*0.01 + i*h*0.048;
      R(tx-h*0.033, ty, h*0.066, h*0.048, i%2? shade(pal.tail,18) : pal.tail);
    }
    R(cx-dirX*h*0.17-h*0.02, hipY+h*0.115, h*0.04, h*0.03, shade(pal.tail,45));
  }

  // ---- CABELO TRASEIRO (longo até os pés p/ maioria, como na ref) ----
  const backLen = style==="long"||style==="long-wavy" ? h*0.46
    : style==="twin" ? h*0.40
    : style==="mane-wild" ? h*0.32
    : style.includes("ponytail") ? h*0.20
    : style==="bob" ? h*0.12 : h*0.09;
  const bw = headW*0.68; // juba volumosa da ref
  const massTop = headTop - h*0.015, massH = headH*0.85 + backLen;
  for(let i=0;i<6;i++){ // massa ARREDONDADA: estreita no topo e nas pontas
    const yy = massTop + i*(massH/6);
    const taper = 0.60 + 0.40*Math.sin((i+0.5)/6*Math.PI);
    const wdt = Math.max(P*4, bw*2*taper);
    const wob = Math.sin(t*2.4+i*0.8)*h*0.004*hb*(1+i*0.3) - dirX*h*0.005*i + spinB*h*0.0008*i + (running? h*0.005*i*0.3:0);
    R(headCX-dirX*h*0.014+wob-wdt/2-P, yy, wdt+P*2, massH/6+1, shade(pal.hair,-55)); // contorno
    R(headCX-dirX*h*0.014+wob-wdt/2, yy, wdt, massH/6+1, i%2? shade(pal.hair,-10) : pal.hair);
  }
  ctx.save(); ctx.globalAlpha = 0.28;
  R(headCX-dirX*h*0.014-bw*0.5, massTop+P, bw*0.8, P*2, "#ffffff");
  ctx.restore();
  R(headCX-dirX*h*0.014+bw*0.22, massTop+h*0.05, Math.max(P*2,h*0.016), massH*0.4, pal.hair2);
  R(headCX-dirX*h*0.014-bw*0.38, massTop+h*0.10, Math.max(P*2,h*0.012), massH*0.32, pal.hair2); // 2ª mecha
  for(let i=0;i<3;i++){
    const sx = headCX-dirX*h*0.014 - bw*0.6 + i*bw*0.6 + Math.sin(t*3+i*2)*h*0.004*hb;
    const ty = massTop + massH - P;
    ctx.fillStyle = shade(pal.hair,-55);
    ctx.beginPath();
    ctx.moveTo(snap(sx-P,P), snap(ty,P));
    ctx.lineTo(snap(sx+P*3,P), snap(ty,P));
    ctx.lineTo(snap(sx+P,P), snap(ty+h*0.04,P));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.moveTo(snap(sx,P), snap(ty,P));
    ctx.lineTo(snap(sx+P*2,P), snap(ty,P));
    ctx.lineTo(snap(sx+P,P), snap(ty+h*0.03,P));
    ctx.closePath(); ctx.fill();
  }

  // ---- rabo de cavalo (ANTES da cabeça: raiz some atrás) ----
  if(style.includes("ponytail")){
    const high = style.includes("high");
    const frontish = side < 0.45 && !back;
    const pxn = frontish ? headCX + headW*0.55 : headCX - dirX*h*0.02 + headW*0.38;
    const py0 = headTop + headH*(high? 0.05 : 0.18);
    const segsN = 4, plen = h*(high? 0.24 : 0.20) + (running? h*0.04:0);
    const back2 = -Math.sign(dirX||faceTurn||1);
    for(let i=0;i<segsN;i++){
      const wdt = h*0.055*(1-i*0.12);
      const wy = Math.sin(t*4.2+i*0.9)*h*0.007*(1+i*0.4)*hb + spinB*h*0.0008*i + (running? h*0.006*i*0.3:0);
      const sx = frontish ? pxn + i*plen/segsN*0.32 + wy*0.4 : pxn + back2*(i*plen/segsN*0.5) + wy;
      const sy = py0 + i*plen/segsN*(frontish? 0.9 : 1) - (!frontish && high? i*h*0.010 : 0);
      R(sx-wdt/2, sy, wdt, plen/segsN+2, i%2? shade(pal.hair,-10):pal.hair);
    }
    R(pxn-P, py0-P, P*4, P*2, pal.outfit2);
    R(pxn-P, py0-P, P, P, "#ffffff");
  }

  // ---- PERNAS GROSSAS (ref): coxa à mostra + meia alta + botona c/ laço ----
  const drawLeg = (s, far) => {
    const hipX = cx + s*hipW*0.32;
    let ankX, ankY;
    if(running){
      const f = (s>0? Math.sin(ph2) : -Math.sin(ph2));
      ankX = hipX + f*h*0.10 + dirX*h*0.015;
      const lift = Math.max(0, Math.cos(ph2 + (s>0? 0 : Math.PI)))*h*0.06;
      ankY = groundY - shoeH - lift;
    } else if(pose==="win"){
      ankX = hipX + s*h*0.03; ankY = groundY - shoeH - (s>0? h*0.012 : 0);
    } else {
      ankX = hipX + s*h*0.012; ankY = groundY - shoeH;
    }
    const kneeX = (hipX+ankX)/2 + s*P*0.5, kneeY = (hipY+ankY)/2 - h*0.004;
    const skinC = far? shade(pal.skin,-22) : pal.skin;
    const sockC = far? shade(pal.socks,-22) : pal.socks;
    const skinD = far? shade(pal.skin,-48) : shade(pal.skin,-26);
    seg(hipX, hipY, kneeX, kneeY, thighW, skinC); // coxa grossa
    seg(hipX+s*thighW*0.22, hipY, kneeX+s*calfW*0.22, kneeY, Math.max(2,P), skinD); // sombra
    seg(kneeX, kneeY, ankX, ankY, calfW, sockC); // meia/canela grossa
    R(kneeX-calfW*0.6, kneeY-h*0.004, calfW*1.2, Math.max(2,P), far? shade(pal.outfit,-10) : pal.outfit); // listra
    R(kneeX-calfW*0.6, kneeY+h*0.006, calfW*1.2, P, "rgba(255,255,255,0.75)"); // 2ª listra fina
    const sw = Math.round(shoeL/P)*P;
    const bx2 = ankX-sw*0.35;
    R(bx2, ankY, sw, shoeH, far? "#241a10" : "#3a2a1a"); // botona robusta
    R(bx2, ankY, sw, P*2, far? shade(pal.outfit,-30) : pal.outfit); // cano na cor
    R(bx2, ankY+shoeH-P, sw, P, "#f5f0e6"); // sola
    R(bx2+P, ankY+P*2, P*2, P*2, "rgba(255,255,255,0.45)"); // brilho
    R(bx2+sw/2-P, ankY+P, P*2, P, pal.outfit2); // lacinho
    R(bx2+sw/2-P, ankY+P, P, P*2, pal.outfit2);
    R(bx2+sw/2, ankY+P, P, P*2, pal.outfit2);
  };
  const ph2 = runPhase*Math.PI*2;
  drawLeg(-1, true); drawLeg(1, false);

  // ---- VESTIDINHO idol (ref: dourado + joia + cinto + saia rodada) ----
  const shirtW = torsoW*0.52;
  R(headCX-P, chinY, P*2, h*0.03, shade(pal.skin,-12)); // pescoço
  R(upX-torsoW/2-P, chestY-P, torsoW+P*2, waistY-chestY+P*2, shade(pal.outfit,-60)); // contorno
  R(upX-torsoW/2, chestY, torsoW, waistY-chestY, pal.outfit);
  R(upX-shirtW/2, chestY, shirtW, waistY-chestY, "#f7f5ee"); // blusa branca
  R(upX-shirtW*0.28, chestY, shirtW*0.56, (waistY-chestY)*0.45, "#ffffff");
  const gt = Math.max(2,P);
  R(upX-torsoW/2, chestY, gt, waistY-chestY, "#ffd166"); // vivos dourados
  R(upX+torsoW/2-gt, chestY, gt, waistY-chestY, "#ffd166");
  R(upX-shirtW/2, chestY, shirtW, gt, "#ffd166"); // gola dourada
  const bowY = chestY + h*0.026;
  R(upX-P*2, bowY, P*2, P*2, shade(pal.outfit2,-25));
  R(upX, bowY, P*2, P*2, shade(pal.outfit2,-25));
  R(upX-P, bowY-P, P*2, P*3, pal.outfit2);
  R(upX-P, bowY-P, P, P, "#ffffff");
  const gemY = chestY + h*0.052; // joia no peito (ref)
  R(upX-P, gemY, P*2, P*2, "#e63950");
  R(upX-P, gemY, P, P, "#ffffff");
  R(upX-torsoW/2-P, waistY-P, torsoW+P*2, P*3, shade(pal.outfit,-45)); // cinto
  R(upX-P*1.5, waistY-P, P*3, P*3, "#ffd166"); // fivela
  R(upX-P*1.5, waistY-P, P, P, "#ffffff");
  // saia rodada 6 painéis + barra dourada + babado branco
  const wX = cx + runF*0.4;
  const skirtY = waistY+P*2, skirtH = h*0.105, skirtW = hipW*1.55;
  for(let i=0;i<6;i++){
    const swayP = running? Math.sin(ph2+i*1.1)*h*0.006 : Math.sin(t*2.5+i)*h*0.002;
    R(wX-skirtW/2+i*skirtW/6+swayP, skirtY, skirtW/6, skirtH, i%2? shade(pal.outfit,-18) : shade(pal.outfit,-4));
  }
  R(wX-skirtW/2, skirtY+skirtH-P*2, skirtW, P, "#ffd166"); // barra dourada
  R(wX-skirtW/2, skirtY+skirtH-P, skirtW, P, "#ffffff"); // babado
  R(wX+skirtW*0.2, skirtY+P, P*3, P*2, "#ffffff"); // tag de corrida

  // ---- BRACINHOS curtos ----
  const armPose = (pose==="win"&&cute) ? "cheeks" : pose==="win" ? "up" : sad ? "down" : pose==="present" ? "wide" : (pose==="super") ? "up" : running ? "pump" : "rest";
  const drawArm = (s, far) => {
    const shX = upX + s*torsoW*0.60, shY2 = shY + h*0.006;
    let elX, elY, haX, haY;
    if(armPose==="cheeks"){ elX = shX + s*h*0.02; elY = shY2 + h*0.04; haX = headCX + s*headW*0.20; haY = chinY - headH*0.30; }
    else if(armPose==="up"){ elX = shX + s*h*0.02; elY = shY2 + h*0.03; haX = shX + s*h*0.012; haY = headTop + h*0.02; }
    else if(armPose==="wide"){ elX = shX + s*h*0.035; elY = shY2 + h*0.04; haX = shX + s*h*0.07; haY = shY2 + h*0.025; }
    else if(armPose==="down"){ elX = shX; elY = shY2 + h*0.06; haX = shX; haY = shY2 + h*0.11; }
    else if(armPose==="pump"){
      const f = running ? (s>0? -Math.sin(ph2) : Math.sin(ph2))*h*0.04 : 0;
      elX = shX + f*0.5; elY = shY2 + h*0.05; haX = shX + f + dirX*h*0.012; haY = Math.min(elY - h*0.030, chinY + h*0.02);
    }
    else { elX = shX + s*h*0.025; elY = shY2 + h*0.055; haX = shX + s*h*0.012; haY = waistY + h*0.004; }
    const sleeveC = far? shade(pal.outfit,-28) : pal.outfit;
    const skinC = far? shade(pal.skin,-22) : pal.skin;
    seg(shX, shY2, elX, elY, armW, sleeveC);
    R(elX-armW/2, elY-P, armW, P*2, "#ffd166"); // punho dourado (ref)
    seg(elX, elY, haX, haY, armW*0.75, skinC);
    R(haX-P, haY-P, P*2, P*2, shade(pal.skin,-45));
    R(haX-P+1, haY-P+1, P*2-1, P*2-1, skinC);
    R(shX-armW/2, shY2-P, armW, P*3, sleeveC);
    R(shX-armW*0.75, shY2-P*2, armW*1.5, P*3, far? shade("#f7f5ee",-30) : "#f7f5ee"); // manga bufante
  };
  drawArm(-1, true); drawArm(1, false);

  // ---- CABEÇA REDONDA (bandas em círculo — nada de quadrado) ----
  const prof = [0.58,0.76,0.89,0.96,1.00,1.00,0.97,0.92,0.84,0.72,0.55]; // bochecha redonda
  const nB = prof.length, bh = headH/nB;
  for(let i=0;i<nB;i++){
    const yy = headTop + i*bh, wdt = headW*prof[i];
    R(headCX-wdt/2-P, yy-P*0.5, wdt+P*2, bh+P, shade(pal.skin,-65)); // contorno
  }
  for(let i=0;i<nB;i++){
    const yy = headTop + i*bh, wdt = headW*prof[i];
    R(headCX-wdt/2, yy, wdt, bh+1, pal.skin);
  }
  R(headCX-headW*0.40, headTop+headH*0.72, P*2, h*0.018, shade(pal.skin,-14)); // bochecha
  R(headCX+headW*0.40-P*2, headTop+headH*0.72, P*2, h*0.018, shade(pal.skin,-14));

  // ---- ORELHAS GRANDES (igual a ref) ----
  const tw = Math.sin(t*1.3 + def.name.length) > 0.88;
  const tw2 = Math.sin(t*1.9 + def.name.length*2.3) > 0.88;
  const drawEar = (s, twitch) => {
    const ex = headCX + s*headW*0.36 + faceTurn*headW*0.06;
    const ey = headTop + h*0.012 + (running? h*0.005:0) - (twitch? h*0.006:0) + (sad? h*0.012:0);
    const earH = h*(sad? 0.10 : 0.185), earW = Math.max(P*6, h*0.11);
    const tilt = s*h*0.014; // pontas inclinadas p/ fora (ref)
    for(let i=0;i<5;i++){
      const wdt = earW*(1-i*0.19);
      R(ex-wdt/2+tilt*(i/4), ey-earH+i*(earH/5), wdt, earH/5+1, i===0? shade(pal.hair,-55):pal.hair);
    }
    ctx.fillStyle = shade(pal.hair,-55); // ponta
    ctx.beginPath();
    ctx.moveTo(snap(ex-earW*0.13+tilt,P), snap(ey-earH,P));
    ctx.lineTo(snap(ex+earW*0.13+tilt,P), snap(ey-earH,P));
    ctx.lineTo(snap(ex+tilt,P), snap(ey-earH-h*0.02,P));
    ctx.closePath(); ctx.fill();
    R(ex-earW*0.18+tilt*0.8, ey-earH*0.68, earW*0.36, earH*0.38, shade(pal.hair,-30)); // sombra
    R(ex-earW*0.11+tilt*0.8, ey-earH*0.60, earW*0.22, earH*0.28, "#ffcfd8"); // rosa
    R(ex-earW*0.11+tilt*0.8, ey-earH*0.60, earW*0.22, P, "#ff9eb0");
  };
  drawEar(-1, tw); drawEar(1, tw2);

  // ---- ROSTO 3/4: OLHÕES sempre visíveis ----
  if(!back){
    const ecx = headCX + faceTurn*headW*0.16;
    const eyeY = headTop + headH*0.52;
    const exOff = headW*0.24;
    const eyeW = headW*0.32, eyeH = headH*0.32; // OLHÕES fofos (grandes e altos)
    const lookX = Math.max(-1,Math.min(1, faceTurn*1.6));
    const browDrop = wild ? 3 : cool ? 2 : cute ? 0 : 1;
    for(const s of [-1,1]){
      const bx = ecx + s*exOff, by = eyeY-eyeH*0.8 + (happy? -1 : 0);
      const bc = shade(pal.hair,-35);
      if(s<0){ R(bx-eyeW*0.5, by, eyeW*0.5, 1, bc); R(bx, by+browDrop, eyeW*0.5, 1, bc); }
      else { R(bx-eyeW*0.5, by+browDrop, eyeW*0.5, 1, bc); R(bx, by, eyeW*0.5, 1, bc); }
    }
    const drawEye = (s) => {
      const far = (faceTurn > 0.08 && s < 0) || (faceTurn < -0.08 && s > 0);
      const w = far? eyeW*0.80 : eyeW;
      const ehh = eyeH*(cool? 0.85 : 1);
      const ex = ecx + s*exOff + (far? -s*eyeW*0.10 : 0);
      if(blink){ R(ex-w/2, eyeY+ehh*0.45, w, Math.max(2,P), shade(pal.eyes,-40)); return; }
      if(cute && pose==="win" && s===1){ R(ex-w/2, eyeY+ehh*0.45, w, Math.max(2,P), "#2b1a1a"); return; } // piscadinha
      if(happy && !running){ // olhinho feliz grosso (lê bem pequeno)
        const ct = Math.max(2,P);
        R(ex-w/2, eyeY+ehh*0.35, w, ct, "#2b1a1a");
        R(ex-w/2, eyeY+ehh*0.05, ct, ehh*0.35, "#2b1a1a");
        R(ex+w/2-ct, eyeY+ehh*0.05, ct, ehh*0.35, "#2b1a1a");
        return;
      }
      // branco (cantinhos visíveis) + íris GRANDE em degradê
      R(ex-w/2-1, eyeY-1, w+2, ehh+2, shade(pal.skin,-55));
      R(ex-w/2, eyeY, w, ehh, "#ffffff");
      const iw = w*0.82, ih = ehh;
      const ix = ex-iw/2+lookX*P*0.5, iy = eyeY;
      R(ix, iy, iw, ih, pal.eyes);
      R(ix, iy, iw, ih*0.28, shade(pal.eyes,-55)); // topo escuro (ref)
      R(ix, iy+ih*0.28, iw, ih*0.32, shade(pal.eyes,-18));
      R(ix, iy+ih*0.60, iw, ih*0.40, shade(pal.eyes,45)); // brilho inferior (ref)
      R(ex-1+lookX, iy+ih*0.22, Math.max(P,iw*0.18), ih*0.5, "#241016"); // pupila (ref)
      R(ex-w/2, eyeY+ehh-1, w, 1, shade(pal.eyes,-60)); // delineado inferior
      // BRILHÃO em cima (fofo) + pontinho embaixo
      const hl = Math.max(P*2, w*0.34);
      R(ix+1+lookX, iy+1, hl, hl, "#ffffff");
      R(ix+iw-P-1, iy+ih-P-1, Math.max(1,P), Math.max(1,P), "#ffffff");
      // delineado superior proporcional ao olho (ref: fino) + wing
      const lt = Math.max(2, Math.round(ehh*0.12));
      R(ex-w/2-1, eyeY-1, w+2, lt, "#241016");
      const wingS = faceTurn >= 0 ? 1 : -1;
      const wingL = wild? P*3 : P*2;
      R(ex + (s===wingS? w/2-1 : -w/2-wingL+1), eyeY-1, wingL, Math.max(2,P), "#241016");
    };
    drawEye(-1); drawEye(1);
    R(ecx + faceTurn*headW*0.05, eyeY+eyeH*0.95, 1, 1, shade(pal.skin,-45)); // nariz pontinho
    // bochechas rosadas em MANCHA oval + brilhinho (fofo)
    ctx.save(); ctx.globalAlpha = cute? 0.95 : 0.8;
    const blW = eyeW*0.95;
    for(let br=0; br<3; br++){
      const bw2 = Math.max(P*2, blW*(1-Math.abs(br-1)*0.30));
      R(ecx-exOff-bw2/2, eyeY+eyeH*1.0+br*P, bw2, P, "#ff8aa0");
      R(ecx+exOff-bw2/2, eyeY+eyeH*1.0+br*P, bw2, P, "#ff8aa0");
    }
    ctx.globalAlpha = 0.55; // gloss na bochecha
    R(ecx-exOff-blW*0.4, eyeY+eyeH*1.0, P, P, "#ffffff");
    R(ecx+exOff+blW*0.4-P, eyeY+eyeH*1.0, P, P, "#ffffff");
    ctx.restore();
    // boquinha
    const mx = ecx + faceTurn*headW*0.06, my = eyeY + eyeH + headH*0.09;
    if(running){
      R(mx-P*1.5, my, P*3, P*2, "#7a2e3e");
      R(mx-P*1.5, my, P*3, 1, "#ffffff");
      if(wild) R(mx+P*0.5, my, 1, P*2, "#ffffff");
      else if(cute) R(mx-P+1, my+1, P, P, "#d46a7a");
    } else if(happy){
      R(mx-P*2, my, P*4, P*3, "#7a2e3e"); // sorriso aberto (ref)
      R(mx-P*2, my, P*4, 1, "#ffffff");
      R(mx-P, my+P, P*2, P, "#e87a8a"); // língua
    }
    else if(sad){ R(mx-P*1.5, my+1, P*3, 1, "#7a2e3e"); }
    else { R(mx-P, my, P*2, 1, "#7a2e3e"); } // sorrisinho (ref)
  } else {
    for(let i=0;i<nB;i++){
      const yy = headTop + i*bh, wdt = headW*prof[i];
      R(headCX-wdt/2, yy, wdt, bh+1, pal.hair);
    }
    ctx.save(); ctx.globalAlpha = 0.25;
    R(headCX-headW*0.25, headTop+bh, headW*0.5, P*2, "#ffffff");
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.55; // risco central sutil (sombra de mecha)
    R(headCX-headW*0.05, headTop+h*0.03, headW*0.10, headH*0.34, pal.hair2);
    ctx.restore();
  }

  // ---- FRANJA (6 bicos longos + faixa de brilho, igual a ref) ----
  if(!back){
    R(headCX-headW/2-P, headTop-P, headW+P*2, P*4, shade(pal.hair,-55));
    R(headCX-headW/2-P, headTop-P, headW+P*2, P*3, pal.hair);
    ctx.save(); ctx.globalAlpha = 0.35;
    R(headCX-headW*0.18, headTop, headW*0.20, P, "#ffffff"); // fiapo de brilho
    ctx.restore();
    for(let i=0;i<5;i++){
      const fxx = headCX-headW/2 + (i+0.5)*headW/5 - P + faceTurn*h*0.003;
      const len = headH*(i%2? 0.28 : 0.20) + Math.sin(t*3+i*1.7)*h*0.002;
      ctx.fillStyle = shade(pal.hair,-55);
      ctx.beginPath();
      ctx.moveTo(snap(fxx-P,P), snap(headTop+P*2,P));
      ctx.lineTo(snap(fxx+P*3,P), snap(headTop+P*2,P));
      ctx.lineTo(snap(fxx+P+Math.sin(t*3+i)*h*0.002,P), snap(headTop+P*2+len,P));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.moveTo(snap(fxx,P), snap(headTop+P*2,P));
      ctx.lineTo(snap(fxx+P*2,P), snap(headTop+P*2,P));
      ctx.lineTo(snap(fxx+P+Math.sin(t*3+i)*h*0.002,P), snap(headTop+P*2+len-P,P));
      ctx.closePath(); ctx.fill();
    }
    ctx.save(); ctx.globalAlpha = 0.30; // mecha de brilho cruzando a franja
    R(headCX-headW*0.10, headTop+P*2, Math.max(P*2,h*0.014), headH*0.20, pal.hair2);
    ctx.restore();
    // mechas laterais COMPRIDAS (moldura do rosto até o queixo/pescoço)
    for(const s of [-1,1]){
      const lx = headCX + s*headW*0.58 + faceTurn*h*0.005;
      for(let i=0;i<4;i++){
        const yy = headTop + headH*0.26 + i*h*0.05;
        const wob = Math.sin(t*2.6+i+s)*h*0.003*hb + (running? h*0.004:0);
        R(lx+wob-P, yy, P*2+1, h*0.048, i===3? shade(pal.hair,-20):pal.hair);
      }
      R(lx-P, headTop+headH*0.30, Math.max(2,P), h*0.10, pal.hair2); // brilho
    }
  }
  // ---- twin / juba / madeixas frontais (long cai na frente do ombro, ref) ----
  if(style==="long"||style==="long-wavy"){
    for(const sgn of [-1,1]){ // madeixa afunilada: larga no ombro, fina na ponta
      const fx = headCX + sgn*headW*0.55 + faceTurn*h*0.004;
      const fw = Math.max(P*3, h*0.052);
      const fy0 = chinY + h*0.005, fy1 = chestY + h*0.07 + (running? h*0.02:0);
      const wob = Math.sin(t*2.2+sgn*2)*h*0.004*hb + spinB*h*0.0006*sgn;
      const midY = fy0 + (fy1-fy0)*0.55;
      R(fx-fw/2+wob-P, fy0-P, fw+P*2, (midY-fy0)+P, shade(pal.hair,-55));
      R(fx-fw/2+wob, fy0, fw, midY-fy0, pal.hair);
      R(fx-fw/2+wob, fy0+P, Math.max(2,P), (midY-fy0)*0.7, pal.hair2); // brilho
      const fw2 = fw*0.62;
      R(fx-fw2/2+wob-P, midY-P, fw2+P*2, (fy1-midY)+P, shade(pal.hair,-55));
      R(fx-fw2/2+wob, midY, fw2, fy1-midY, pal.hair);
      ctx.fillStyle = shade(pal.hair,-55);
      ctx.beginPath();
      ctx.moveTo(snap(fx-fw2/2+wob-P,P), snap(fy1,P));
      ctx.lineTo(snap(fx+fw2/2+wob+P,P), snap(fy1,P));
      ctx.lineTo(snap(fx+wob+sgn*P,P), snap(fy1+h*0.028,P));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.moveTo(snap(fx-fw2/2+wob,P), snap(fy1,P));
      ctx.lineTo(snap(fx+fw2/2+wob,P), snap(fy1,P));
      ctx.lineTo(snap(fx+wob+sgn*P,P), snap(fy1+h*0.022,P));
      ctx.closePath(); ctx.fill();
    }
  }
  if(style==="twin"){
    for(const sgn of [-1,1]){
      const qx = headCX + sgn*headW*0.60;
      for(let i=0;i<4;i++){
        const wy = Math.cos(t*4+i+sgn)*h*0.003*hb + (running? h*0.004*i:0);
        R(qx+wy-sgn*i*h*0.005-P, headTop+h*0.10+i*h*0.055, P*4, h*0.055, i%2? pal.hair:shade(pal.hair,-10));
      }
      R(qx-P, headTop+h*0.08, P*4, P*2, pal.outfit2);
      R(qx-P, headTop+h*0.08, P, P, "#ffffff");
    }
  }
  if(style==="mane-wild"){
    for(let i=0;i<8;i++){
      const a = -Math.PI*0.85 + i*(Math.PI*0.7/7);
      const sx = headCX + Math.cos(a)*headW*0.62, sy = headTop + headH*0.35 + Math.sin(a)*headW*0.62;
      const tx = headCX + Math.cos(a)*headW*1.05, ty = headTop + headH*0.35 + Math.sin(a)*headW*1.05;
      ctx.fillStyle = shade(pal.hair,-55);
      ctx.beginPath();
      ctx.moveTo(snap(sx-2,P), snap(sy,P)); ctx.lineTo(snap(sx+2,P), snap(sy,P)); ctx.lineTo(snap(tx,P), snap(ty,P));
      ctx.closePath(); ctx.fill();
    }
  }

  // ---- acessório fiel por personagem (28 tipos) ----
  if(def.accessory){
    const acc = def.accessory;
    const A = (x,y,w,h,c)=>R(x,y,w,h,c);
    if(!back){
      if(acc==="crown-mini"||acc==="crown-gold"){
        const big = acc==="crown-gold";
        const ax = headCX + headW*0.16, s = big? P*3 : P*2;
        for(let i=0;i<3;i++) A(ax+(i-1)*s*1.4, headTop-(big?h*0.026:h*0.020)-(i===1?(big?P*3:P*2):0), s, s+(i===1?(big?P*3:P*2):0), "#ffd166");
        A(ax-s*2.2, headTop-h*0.007, s*4.4, P, shade("#ffd166",-40));
        A(ax-P/2, headTop-h*0.007, P, P, "#e63950"); // gema
        A(ax-P/2, headTop-h*0.007, 1, 1, "#ffffff");
      } else if(acc==="tiara"){
        const ax = headCX + headW*0.05;
        for(let i=0;i<3;i++) A(ax+(i-1)*P*2.4, headTop-h*0.020-(i===1?P*2:0), P*2, P*2+(i===1?P*2:0), "#dfe9ff");
        A(ax-P*3.4, headTop-h*0.006, P*6.8, P, "#9fb6d8");
        A(ax-P/2, headTop-h*0.006, P, P, "#3e9ac9");
      } else if(acc==="ribbon-orange"||acc==="ribbon"){
        const ax = headCX - headW*0.44; // laço grande c/ caudas
        A(ax, headTop, P*3, P*3, pal.outfit2);
        A(ax+P*3, headTop-P, P*3, P*2, shade(pal.outfit2,-25));
        A(ax-P*2, headTop+P*3, P*2, P*4, pal.outfit2);
        A(ax+P*2, headTop+P*3, P*2, P*3, shade(pal.outfit2,-25));
        A(ax+P, headTop+P, P*2, P*2, shade(pal.outfit2,20));
        A(ax+P, headTop+P, P, P, "#ffffff");
      } else if(acc==="headband"){
        A(headCX-headW/2, headTop+P*2, headW, P*2, "#2b2b3a"); // faixa
        A(headCX-headW*0.1, headTop+P*2, headW*0.2, P, "rgba(255,255,255,0.35)");
      } else if(acc==="visor"){
        A(headCX-headW/2, headTop, headW, P*2, "#1d3a4d"); // viseira esporte
        A(headCX-headW/2, headTop+P*2, headW, P, "#7fd4ff");
      } else if(acc==="aviator"){
        A(headCX-headW/2, headTop+P, headW, P*2, "#5a3a1a"); // óculos na testa
        A(headCX-headW*0.22, headTop+P, headW*0.16, P*2, "#20242e");
        A(headCX+headW*0.06, headTop+P, headW*0.16, P*2, "#20242e");
        A(headCX-headW*0.22, headTop+P, P, P, "#9be8ff");
        A(headCX+headW*0.06, headTop+P, P, P, "#9be8ff");
      } else if(acc==="ear-cuff"){
        const ex2 = headCX + headW*0.36 + faceTurn*headW*0.06;
        A(ex2-P, headTop+h*0.045, P*2, P, "#ffd166"); // brinco na orelha
        A(ex2-P, headTop+h*0.055, P, P, "#e63950");
      } else if(acc==="bracelet"){
        for(const sgn of [-1,1]){ // pulseiras douradas na base das orelhas
          const ex2 = headCX + sgn*headW*0.36 + faceTurn*headW*0.06;
          A(ex2-P, headTop+h*0.075, P*2, P, "#ffd166");
        }
      } else if(acc==="pearl"){
        const ex2 = headCX + headW*0.40; // fio de pérolas
        A(ex2, headTop+h*0.02, P*2, P*2, "#ffffff");
        A(ex2+P, headTop+h*0.045, P*2, P*2, "#f2d8e8");
        A(ex2, headTop+h*0.07, P*2, P*2, "#ffffff");
      } else if(acc==="star-pin"){
        const ax = headCX + headW*0.40; // estrela amarela
        A(ax, headTop-P, P*3, P, "#ffd166"); A(ax+P, headTop-P*2, P, P*3, "#ffd166");
        A(ax+P, headTop-P, P, P, "#ffffff");
      } else if(acc==="cloud-pin"){
        const ax = headCX - headW*0.44; // nuvenzinha
        A(ax, headTop+P, P*4, P*2, "#ffffff"); A(ax+P, headTop, P*2, P, "#ffffff");
        A(ax+P*2, headTop+P, P, P, "#9be8ff");
      } else if(acc==="diamond"){
        const ax = headCX + headW*0.40; // diamante ciano
        A(ax, headTop, P*2, P, "#9be8ff"); A(ax-P/2, headTop+P, P*3, P, "#5ec8e8");
        A(ax, headTop+P*2, P*2, P, "#2a7ba6"); A(ax, headTop, P, P, "#ffffff");
      } else if(acc==="flower"||acc==="sakura"||acc==="rose"){
        const ax = headCX + headW*0.40;
        const pet = acc==="rose" ? "#e63950" : acc==="sakura" ? "#ffb3d9" : "#ff8ab8";
        A(ax, headTop, P*2, P*2, pet); A(ax+P*2, headTop+P, P*2, P*2, shade(pet,-25));
        A(ax, headTop+P*2, P*2, P*2, "#ffffff"); A(ax-P*2, headTop+P*2, P*2, P, "#2e9e4f");
      } else if(acc==="turbo-fin"){
        const ax = headCX + headW*0.42; // barbatana turbo
        ctx.fillStyle = "#3e9ac9";
        ctx.beginPath();
        ctx.moveTo(snap(ax,P), snap(headTop-h*0.01,P));
        ctx.lineTo(snap(ax+P*4,P), snap(headTop-h*0.01,P));
        ctx.lineTo(snap(ax+P,P), snap(headTop+h*0.03,P));
        ctx.closePath(); ctx.fill();
        A(ax, headTop, P*2, P, "#9be8ff");
      } else { // charms pendurados (anchor/sun/mask/rain/syringe/eye)
        const left = !(acc==="mask-charm"||acc==="syringe-charm");
        const ax = headCX + (left? -headW*0.42 : headW*0.40);
        const ay = headTop + h*0.02;
        A(ax, ay-P*2, P*2, P*2, "#ffd166"); // argola
        if(acc==="anchor-charm"){ A(ax-P/2, ay, P*3, P, "#ffd166"); A(ax+P/2, ay, P, P*4, "#ffd166"); A(ax-P/2, ay+P*3, P*3, P, "#ffd166"); }
        else if(acc==="sun-charm"){ A(ax-P/2, ay, P*3, P*3, "#ff9f1c"); A(ax+P/2, ay+P, P, P, "#fff3d6"); }
        else if(acc==="mask-charm"){ A(ax-P, ay, P*4, P*3, "#b31f34"); A(ax, ay+P, P, P, "#ffd166"); A(ax+P*2, ay+P, P, P, "#ffd166"); }
        else if(acc==="rain-charm"){ A(ax, ay, P*2, P*3, "#3e9ac9"); A(ax, ay+P*3, P*2, P, "#9be8ff"); }
        else if(acc==="syringe-charm"){ A(ax, ay, P*2, P*4, "#ffffff"); A(ax, ay+P*3, P*2, P, "#ff6b9d"); A(ax-P, ay, P, P*2, "#9fb6d8"); }
        else if(acc==="eye-charm"){ A(ax-P/2, ay, P*3, P*3, "#6b3fa0"); A(ax+P/2, ay+P, P, P, "#241016"); A(ax, ay, P, P, "#ffffff"); }
        else { A(ax, ay, P*2, P*2, pal.outfit2); A(ax, ay, P, P, "#ffffff"); }
      }
      if(acc==="fang"){
        A(headCX+headW*0.08, headTop+headH*0.76, P, P*2, "#ffffff"); // presinha
      }
      if(acc==="choker"){
        A(headCX-headW*0.15, chinY, headW*0.3, P*2, "#2b2b3a"); // gargantilha
        A(headCX-P/2, chinY, P, P, "#e63950");
      }
      if(acc==="gloves-red"){
        for(const sgn of [-1,1]) A(upX+sgn*torsoW*0.60-P, shY+h*0.002, P*2, P*2, "#c1121f"); // ombreiras
      }
    }
    if(acc==="emperor-cape"){ // capa (aparece de costas também)
      for(const sgn of [-1,1]){
        A(upX+sgn*torsoW*0.75-P*2, shY-h*0.005, P*4, h*0.09, "#7a1622");
        A(upX+sgn*torsoW*0.75-P*2, shY-h*0.005, P*4, P, "#ffd166");
      }
    }
    if(acc==="gold-chain"){ // corrente no peito (aparece de costas também)
      for(let i=0;i<4;i++) A(upX-torsoW*0.35+i*torsoW*0.17, chestY+h*0.02+i*h*0.008, P*2, P, "#ffd166");
      A(upX-P/2, chestY+h*0.055, P*2, P*2, "#e63950");
    }
  }
}

export function drawRacerSprite(ctx, def, x, y, size, angle, pose, t, phase, spin=0, aura=false){
  drawUma(ctx, def, x, y, size, angle, pose, t, phase, spin, aura);
}

// ---- helpers do lobby vivo (pixel arredondado, baratos) ----
export function drawCloudPuff(ctx, x, y, s, color, alpha=1){
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
  const P = 3;
  const q = (dx,dy,w,h)=>ctx.fillRect(Math.round((x+dx*s)/P)*P, Math.round((y+dy*s)/P)*P, Math.round(w*s), Math.round(h*s));
  q(-30, 0, 62, 14); q(-18, -10, 38, 12); q(4, -6, 22, 8);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  q(-26, 2, 20, 3);
  ctx.restore();
}

export function drawPennant(ctx, x, y, s, color, wave){
  // bandeirinha triangular com onda
  const wob = Math.sin(wave)*s*0.25;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(Math.round(x), Math.round(y));
  ctx.lineTo(Math.round(x+s), Math.round(y));
  ctx.lineTo(Math.round(x+s*0.5+wob), Math.round(y+s*0.8));
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(Math.round(x+s*0.2), Math.round(y+1), Math.round(s*0.2), 2);
}

export function drawTuft(ctx, x, y, s, color, sway){
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y-s*2), 2, Math.round(s*2));
  ctx.fillRect(Math.round(x-3+sway), Math.round(y-s*1.6), 2, Math.round(s*1.6));
  ctx.fillRect(Math.round(x+3+sway), Math.round(y-s*1.7), 2, Math.round(s*1.7));
}

export function drawCrowd(ctx, w, h, trackY, colors, t, night){
  const n = Math.floor(w/14);
  for(let i=0;i<n;i++){
    const cx = (i*14 + (i*37)%10);
    const bounce = Math.sin(t*4 + i*1.7)*2;
    const c = colors[i % colors.length];
    ctx.fillStyle = night? shade2(c,-30): c;
    ctx.fillRect(cx, trackY-26+bounce, 7, 12);
    ctx.fillStyle = "#f2c9a0";
    ctx.fillRect(cx+1, trackY-32+bounce, 5, 5);
  }
}
function shade2(hex, amt){
  if(!hex || hex[0]!=="#") return hex;
  const n = parseInt(hex.slice(1),16);
  let r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt;
  r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));
  return `rgb(${r},${g},${b})`;
}

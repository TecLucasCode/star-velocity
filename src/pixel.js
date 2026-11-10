// STAR VELOCITY — renderer pixel art HD procedural (sem blur).
// Personagens ALTAS, proporções naturais, pernas longas. Grade snap p/ pixel.
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
// ESTILO DEFINITIVO anime Uma Musume: adulta esguia (~6.2 cabeças), uniforme
// Tracen detalhado, cabelo volumoso com mechas, olhos grandes de anime.
// O rosto é SEMPRE desenhado em 3/4 (faceTurn comprimido): mesmo em corrida
// lateral (perfil), OS DOIS OLHOS ficam visíveis — como nas cenas do anime.
export function drawUma(ctx, def, x, y, h, angle, pose="idle", t=0, runPhase=0, spin=0, aura=false){
  const P = Math.max(1, Math.round(h / 130)); // pixel fino: detalhe anime
  const dirX = Math.sin(angle);
  const dirZ = Math.cos(angle);
  const side = Math.abs(dirX);
  const back = dirZ < 0;
  const pal = def.palette;
  const style = def.hairStyle||"bob";
  const running = (pose==="run"||pose==="dash");
  const dash = (pose==="dash");
  const happy = (pose==="win"||pose==="super"||pose==="present");
  const sad = (pose==="lose");
  const pers = (PERSONA && PERSONA[def.id]) || "cool";
  const wild = pers==="wild", cute = pers==="cute", cool = pers==="cool";
  const hb = wild ? 1.7 : 1; // cabelo selvagem balança mais
  const bob = running ? Math.abs(Math.sin(runPhase*Math.PI*2))*h*0.018 : Math.sin(t*2.2)*h*0.003 + (cute? Math.abs(Math.sin(t*3.1))*h*0.004 : 0);
  const sway = Math.sin(t*1.1)*h*0.004;
  const blink = ((t % 3.7) < 0.12) && !happy && !running;
  // rosto 3/4 permanente: comprime a virada para nunca chegar a perfil puro
  const faceTurn = Math.max(-0.62, Math.min(0.62, dirX*0.55));
  // POSTURA CURVADA de corrida (que nem o anime): tronco projeta à frente,
  // quadril baixa, cabeça avança. No super também.
  const lean = dash ? h*0.070 : running ? h*0.050 : 0;
  const crouch = dash ? h*0.045 : running ? h*0.032 : 0;
  const fwd = dash ? h*0.055 : running ? h*0.040 : 0;
  const runDir = Math.abs(dirX) > 0.25 ? Math.sign(dirX) : 1;
  const runF = running ? runDir*fwd : 0;
  const spinB = Math.max(-6, Math.min(6, spin*3.0));
  const cx = x + dirX*h*0.010 + sway + lean*0.35;

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
  ctx.ellipse(x, y, h*0.15, h*0.030, 0, 0, Math.PI*2);
  ctx.fill();

  // aura super/present (ou forçada p/ super correndo curvado)
  if(pose==="super" || pose==="present" || aura){
    const c = def.super.color;
    ctx.save(); ctx.globalAlpha = 0.30;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(cx, y-h*0.42, h*0.22, h*0.40, 0, 0, Math.PI*2);
    ctx.fill(); ctx.restore();
    ctx.save();
    for(let i=0;i<12;i++){
      const a = t*2 + i*0.52;
      ctx.fillStyle = i%2? "#ffffff" : c;
      ctx.fillRect(snap(cx+Math.cos(a)*h*0.24,P), snap(y-h*0.42+Math.sin(a)*h*0.30,P), P, P);
    }
    ctx.restore();
  }
  if(dash){
    ctx.save(); ctx.globalAlpha=0.35; ctx.fillStyle="#ffffff";
    for(let i=0;i<3;i++){
      const yy = y - h*0.55 + i*h*0.12;
      ctx.fillRect(snap(cx - dirX*h*0.30 - h*0.20,P), snap(yy,P), h*0.24, P*2);
    }
    ctx.restore();
  }

  // ---- esqueleto esguio (~6.2 cabeças) ----
  const groundY = y;
  const shoeH = h*0.045, shoeL = h*0.095;
  const legH = h*0.40;
  const hipY = groundY - shoeH - legH + bob*0.4 + crouch;
  const waistY = hipY - h*0.075;
  const chestY = hipY - h*0.205;
  const shY = chestY - h*0.012;
  const chinY = shY - h*0.030 + bob*0.4 + crouch*0.4;
  const headH = h*0.175, headW = h*0.150*(1-side*0.06);
  const headTop = chinY - headH;
  const headCX = cx + runF + dirX*h*0.012 + lean*0.35;
  const torsoW = h*0.105, hipW = h*0.120;
  const upX = cx + runF; // ombros/peito projetados à frente quando corre
  const legW = Math.max(P*2, h*0.026);
  const armW = Math.max(P*2, h*0.024);

  // ---- RABO (atrás do corpo, esvoaçante) ----
  if(back || side > 0.2){
    const segs = 6;
    for(let i=0;i<segs;i++){
      const k = i/(segs-1);
      const wx = Math.sin(t*3.2 + i*0.9)*h*0.008*(1+k*2) + spinB*h*0.0012*i + (running? Math.sin(runPhase*6.28+i)*h*0.010 : 0);
      const tx = cx - dirX*h*(0.055 + k*0.075) + wx;
      const ty = hipY - h*0.01 + k*h*0.185;
      const wdt = h*0.045*(1-k*0.45);
      R(tx-wdt/2, ty, wdt, h*0.042, i%2? shade(pal.tail,18) : pal.tail);
      if(i===segs-1) R(tx-wdt*0.3, ty+h*0.030, wdt*0.6, h*0.028, shade(pal.tail,45)); // ponta clara
    }
  }

  // ---- CABELO TRASEIRO: véu volumoso afunilado ----
  const backLen = style==="long"||style==="long-wavy" ? h*0.34
    : style==="mane-wild" ? h*0.26
    : style.includes("ponytail") ? h*0.17
    : style==="twin" ? h*0.16
    : style==="bob" ? h*0.12 : h*0.10;
  const bw = headW*0.62;
  const massTop = headTop - h*0.012, massH = headH*0.9 + backLen;
  R(headCX-dirX*h*0.018-bw-P, massTop-P, bw*2+P*2, massH+P*2, shade(pal.hair,-55)); // contorno
  for(let i=0;i<6;i++){
    const yy = massTop + i*(massH/6);
    const taper = 1 - i*0.085 - (i>3? (i-3)*0.06:0);
    const wdt = Math.max(P*3, bw*2*taper);
    const wob = Math.sin(t*2.4+i*0.8)*h*0.005*hb*(1+i*0.35) - dirX*h*0.007*i + spinB*h*0.001*i + (running? h*0.006*i*0.4:0);
    R(headCX-dirX*h*0.018-wdt/2+wob, yy, wdt, massH/6+1, i%2? shade(pal.hair,-10) : pal.hair);
  }
  // brilho do topo + mecha hair2
  ctx.save(); ctx.globalAlpha = 0.28;
  R(headCX-dirX*h*0.018-bw*0.55, massTop+P, bw*0.9, P*2, "#ffffff");
  ctx.restore();
  R(headCX-dirX*h*0.018+bw*0.25, massTop+h*0.05, Math.max(P*2,h*0.014), massH*0.45, pal.hair2);
  // pontas do véu (3 bicos)
  for(let i=0;i<3;i++){
    const sx = headCX-dirX*h*0.018 - bw*0.6 + i*bw*0.6 + Math.sin(t*3+i*2)*h*0.005*hb;
    const ty = massTop + massH - P;
    ctx.fillStyle = shade(pal.hair,-55);
    ctx.beginPath();
    ctx.moveTo(snap(sx-P,P), snap(ty,P));
    ctx.lineTo(snap(sx+P*3,P), snap(ty,P));
    ctx.lineTo(snap(sx+P,P), snap(ty+h*0.035,P));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.moveTo(snap(sx,P), snap(ty,P));
    ctx.lineTo(snap(sx+P*2,P), snap(ty,P));
    ctx.lineTo(snap(sx+P,P), snap(ty+h*0.026,P));
    ctx.closePath(); ctx.fill();
  }

  // ---- PERNAS longas (coxa pele + meia + sapato) ----
  const ph = runPhase*Math.PI*2;
  const legSwing = running ? Math.sin(ph) : 0;
  const drawLeg = (s, far) => {
    const hipX = cx + s*hipW*0.30;
    let ankX, ankY;
    if(running){
      const f = (s>0? legSwing : -legSwing);
      ankX = hipX + f*h*0.160 + dirX*h*0.025;
      const lift = Math.max(0, Math.cos(ph + (s>0? 0 : Math.PI)))*h*0.100;
      ankY = groundY - shoeH - lift;
    } else if(pose==="win"){
      ankX = hipX + s*h*0.03; ankY = groundY - shoeH - (s>0? h*0.012 : 0);
    } else {
      ankX = hipX + s*h*0.012; ankY = groundY - shoeH;
    }
    const kneeX = (hipX+ankX)/2 + h*0.018, kneeY = (hipY+ankY)/2 + h*0.008;
    const skinC = far? shade(pal.skin,-22) : pal.skin;
    const sockC = far? shade(pal.socks,-22) : pal.socks;
    seg(hipX, hipY, kneeX, kneeY, legW, skinC);                       // coxa
    seg(kneeX, kneeY, ankX, ankY, legW*0.9, sockC);                   // meia
    R(hipX-legW/2, hipY-h*0.008, legW, P*2, pal.outfit);              // faixa da meia
    R((kneeX+ankX)/2-legW*0.55, (kneeY+ankY)/2-P, legW*1.1, P*2, pal.outfit2); // listra sobre a canela
    const sw = Math.round(shoeL/P)*P;
    R(ankX-sw*0.32, ankY, sw, shoeH, shade("#3a2a1a", far?-25:0));    // loafer
    R(ankX-sw*0.32, ankY+shoeH-P, sw, P, "#f5f0e6");                  // sola
    R(ankX-sw*0.32+P, ankY+P, P*2, P, "rgba(255,255,255,0.5)");       // brilho
    R(ankX-sw*0.32+P, ankY, P*2, P, pal.outfit2);                    // laço sobre o sapato
  };
  drawLeg(-1, true); drawLeg(1, false);

  // ---- TRONCO: uniforme Tracen (ombros projetados à frente na corrida) ----
  const shirtW = torsoW*0.52;
  const wX = cx + runF*0.4; // cintura acompanha pela metade
  // pescoço
  R(headCX-P, chinY, P*2, h*0.035, shade(pal.skin,-12));
  // jaqueta (painéis laterais)
  R(upX-torsoW/2-P, chestY-P, torsoW/2-shirtW/2+P, waistY-chestY+P*2, shade(pal.outfit,-60));
  R(upX+shirtW/2, chestY-P, torsoW/2-shirtW/2+P, waistY-chestY+P*2, shade(pal.outfit,-60));
  R(upX-torsoW/2, chestY, torsoW/2-shirtW/2, waistY-chestY, pal.outfit);
  R(upX+shirtW/2, chestY, torsoW/2-shirtW/2, waistY-chestY, pal.outfit);
  // camisa branca central + gola V
  R(upX-shirtW/2, chestY, shirtW, waistY-chestY, "#f7f5ee");
  R(upX-shirtW*0.28, chestY, shirtW*0.56, (waistY-chestY)*0.4, "#ffffff");
  // vivos dourados na jaqueta
  R(upX-torsoW/2, chestY, 1, waistY-chestY, "#ffd166");
  R(upX+torsoW/2-1, chestY, 1, waistY-chestY, "#ffd166");
  // laço/ribbon no peito
  const bowY = chestY + h*0.035;
  R(upX-P*3, bowY, P*3, P*2, shade(pal.outfit2,-25));
  R(upX, bowY, P*3, P*2, shade(pal.outfit2,-25));
  R(upX-P, bowY-P, P*2, P*4, pal.outfit2);
  R(upX-P*2, bowY+P*2, P, P*3, pal.outfit2);
  R(upX+P, bowY+P*2, P, P*3, pal.outfit2);
  R(upX-P, bowY-P, P, P, "#ffffff");
  // braçadeira Tracen no braço (lado da câmera)
  // cinto + fivela
  R(wX-torsoW/2, waistY, torsoW, P*2, "#1a1a2e");
  R(wX-P, waistY, P*2, P*2, "#ffd166");
  // saia de pregas
  const skirtY = waistY+P*2, skirtH = h*0.088, skirtW = hipW*1.28;
  const skirtN = 6;
  for(let i=0;i<skirtN;i++){
    const swayP = running? Math.sin(ph+i*1.1)*h*0.007 : Math.sin(t*2.5+i)*h*0.002;
    const liftP = running? Math.max(0,Math.sin(ph*0.5+i))*h*0.008 : 0;
    R(cx-skirtW/2+i*skirtW/skirtN+swayP, skirtY-liftP, skirtW/skirtN, skirtH, i%2? shade(pal.outfit,-18) : shade(pal.outfit,-4));
  }
  R(cx-skirtW/2, skirtY+skirtH-P, skirtW, P, "#ffffff"); // bainha branca
  R(cx+skirtW*0.22, skirtY+P, P*3, P*2, "#ffffff");       // tag de corrida

  // ---- BRAÇOS esguios (manga + antebraço + punho) ----
  const armPose = (pose==="win"&&cute) ? "cheeks" : pose==="win" ? "up" : sad ? "down" : pose==="present" ? "wide" : (pose==="super") ? "up" : running ? "pump" : "rest";
  const drawArm = (s, far) => {
    const shX = upX + s*torsoW*0.62, shY2 = shY + h*0.008;
    let elX, elY, haX, haY;
    if(armPose==="cheeks"){ // fofa: mãozinhas nas bochechas
      elX = shX + s*h*0.030; elY = shY2 + h*0.055;
      haX = headCX + s*headW*0.24; haY = chinY - headH*0.38;
    }
    else if(armPose==="up"){ elX = shX + s*h*0.030; elY = shY2 + h*0.045; haX = shX + s*h*0.018; haY = headTop + h*0.030; }
    else if(armPose==="wide"){ elX = shX + s*h*0.045; elY = shY2 + h*0.055; haX = shX + s*h*0.085; haY = shY2 + h*0.030; }
    else if(armPose==="down"){ elX = shX; elY = shY2 + h*0.085; haX = shX; haY = shY2 + h*0.150; }
    else if(armPose==="pump"){
      const f = running ? (s>0? -legSwing : legSwing)*h*0.055 : 0;
      elX = shX + f*0.5; elY = shY2 + h*0.070; haX = shX + f + dirX*h*0.020; haY = Math.min(elY - h*0.042, chinY + h*0.030);
    }
    else { elX = shX + s*h*0.035; elY = shY2 + h*0.075; haX = shX + s*h*0.018; haY = waistY + h*0.005; }
    const sleeveC = far? shade(pal.outfit,-28) : pal.outfit;
    const skinC = far? shade(pal.skin,-22) : pal.skin;
    seg(shX, shY2, elX, elY, armW, sleeveC);                 // manga
    R(elX-armW/2, elY-P, armW, P*2, "#f7f5ee");              // punho branco
    seg(elX, elY, haX, haY, armW*0.8, skinC);                // antebraço
    R(haX-P, haY-P, P*2, P*2, shade(pal.skin,-45));           // punho: contorno
    R(haX-P+1, haY-P+1, P*2-1, P*2-1, skinC);                // punho
    R(shX-armW/2, shY2-P, armW, P*3, sleeveC);               // ombreira
    R(shX-armW/2, shY2+P*2, armW, 1, "#ffd166");              // vivo dourado
    if(!far){ R(shX + (s>0? armW/2 : -armW/2-P), shY2+P*3, P, P*3, "#f7f5ee"); } // braçadeira
  };
  drawArm(-1, true); drawArm(1, false);

  // ---- CABEÇA: rosto oval anime ----
  R(headCX-headW/2, headTop+P, headW, headH-P, shade(pal.skin,-60)); // contorno
  R(headCX-headW/2+P, headTop, headW-P*2, headH, pal.skin);
  R(headCX-headW*0.30, chinY-h*0.022, headW*0.60, h*0.030, pal.skin); // queixo fino
  R(headCX-headW/2+P, chinY-P, headW-P*2, P*2, pal.skin); // cobre a linha do queixo (sem "barba")
  if(side > 0.15){ // sombreado lateral p/ volume
    ctx.save(); ctx.globalAlpha = 0.18;
    R(headCX + (dirX>0? headW/2-P*3 : -headW/2+P*2), headTop+P*2, P, headH-P*3, "#7a4a3a");
    ctx.restore();
  }

  // ---- ORELHAS de cavalo (altas, pontudas) ----
  const tw = Math.sin(t*1.3 + def.name.length) > 0.88;
  const tw2 = Math.sin(t*1.9 + def.name.length*2.3) > 0.88;
  const drawEar = (s, twitch) => {
    const ex = headCX + s*headW*0.30 + faceTurn*headW*0.08;
    const ey = headTop + h*0.004 + (running? h*0.006:0) - (twitch? h*0.007:0) + (sad? h*0.016:0);
    const earH = h*(sad? 0.048 : 0.080), earW = Math.max(P*3, h*0.040);
    const leanE = sad? s*h*0.012 : s*h*0.004;
    for(let i=0;i<4;i++){
      const wdt = earW*(1-i*0.22);
      R(ex-wdt/2+leanE*(i*0.3), ey-earH+i*(earH/4), wdt, earH/4+1, i===0? shade(pal.hair,-55):pal.hair);
    }
    R(ex-earW*0.22, ey-earH*0.72, earW*0.44, earH*0.42, "#ffcfd8"); // interior rosa
    R(ex-earW*0.22, ey-earH*0.72, earW*0.44, P, "#ff9eb0");
  };
  drawEar(-1, tw); drawEar(1, tw2);

  // ---- ROSTO 3/4: OS DOIS OLHOS SEMPRE VISÍVEIS ----
  if(!back){
    const ecx = headCX + faceTurn*headW*0.20;
    const eyeY = headTop + headH*0.48;
    const exOff = headW*0.27;
    const eyeW = headW*0.30, eyeH = headH*0.32;
    const lookX = Math.max(-1,Math.min(1, faceTurn*1.6));
    // sobrancelhas finas (selvagem/fria: inclinadas p/ dentro)
    const browDrop = wild ? 2 : cool ? 1 : 0;
    for(const s of [-1,1]){
      const bx = ecx + s*exOff;
      const by = eyeY-eyeH*0.75 + (happy? -1 : 0);
      const bc = shade(pal.hair,-35);
      if(s<0){ R(bx-eyeW*0.55, by, eyeW*0.55, 1, bc); R(bx, by+browDrop, eyeW*0.55, 1, bc); }
      else { R(bx-eyeW*0.55, by+browDrop, eyeW*0.55, 1, bc); R(bx, by, eyeW*0.55, 1, bc); }
    }
    const drawEye = (s) => {
      // olho distante: um pouco mais estreito, MAS VISÍVEL (nunca some)
      const far = (faceTurn > 0.08 && s < 0) || (faceTurn < -0.08 && s > 0);
      const w = far? eyeW*0.80 : eyeW;
      const ehh = eyeH*(cool? 0.82 : 1); // fria: olhar semicerrado
      const ex = ecx + s*exOff + (far? -s*eyeW*0.10 : 0);
      if(blink){
        R(ex-w/2, eyeY+ehh*0.45, w, 1, shade(pal.eyes,-40));
        return;
      }
      if(cute && pose==="win" && s===1){
        R(ex-w/2, eyeY+ehh*0.45, w, 1, "#2b1a1a"); // piscadinha fofa
        return;
      }
      if(happy && !running){
        // olho feliz fechado ^ ^
        R(ex-w/2, eyeY+eyeH*0.35, w, 1, "#2b1a1a");
        R(ex-w/2, eyeY+eyeH*0.05, 1, eyeH*0.35, "#2b1a1a");
        R(ex+w/2-1, eyeY+eyeH*0.05, 1, eyeH*0.35, "#2b1a1a");
        return;
      }
      // branco do olho (fina moldura)
      R(ex-w/2-1, eyeY-1, w+2, ehh+2, shade(pal.skin,-55));
      R(ex-w/2, eyeY, w, ehh, "#ffffff");
      // íris em degradê (topo escuro → base viva)
      const iw = w*0.86, ih = ehh*0.94;
      const ix = ex-iw/2, iy = eyeY+ehh*0.03;
      R(ix, iy, iw, ih, pal.eyes);
      R(ix, iy, iw, ih*0.42, shade(pal.eyes,-48));
      R(ix, iy+ih*0.62, iw, ih*0.38, shade(pal.eyes,28));
      // pupila + contorno inferior
      R(ex-1+lookX, iy+ih*0.18, Math.max(1,P), ih*0.55, "#241016");
      R(ex-w/2, eyeY+ehh-1, w, 1, shade(pal.eyes,-60));
      // brilhos (luz da alma anime)
      R(ix+1+lookX, iy+1, P*2, P*2, "#ffffff");
      R(ix+iw-P-1, iy+ih-P-1, 1, 1, "#ffffff");
      // delineado superior grosso + wing (selvagem: wing maior)
      R(ex-w/2-1, eyeY-1, w+2, Math.max(2,P), "#241016");
      const wingS = faceTurn >= 0 ? 1 : -1;
      const wingL = wild? P*3 : P*2;
      R(ex + (s===wingS? w/2-1 : -w/2-wingL+1), eyeY-1, wingL, Math.max(2,P), "#241016");
    };
    drawEye(-1); drawEye(1);
    // nariz: pontinho
    R(ecx + faceTurn*headW*0.06, eyeY+eyeH*0.95, 1, 1, shade(pal.skin,-45));
    // bochechas (fofa: maiores e mais rosadas)
    ctx.save(); ctx.globalAlpha = cute? 0.8 : 0.5;
    const blW = cute? eyeW*0.9 : eyeW*0.6;
    R(ecx-exOff-blW*0.55, eyeY+eyeH*0.95, blW, 1, "#ff8aa0");
    R(ecx+exOff-blW*0.45, eyeY+eyeH*0.95, blW, 1, "#ff8aa0");
    ctx.restore();
    // boca
    const mx = ecx + faceTurn*headW*0.08, my = eyeY + eyeH + headH*0.13;
    if(running){
      R(mx-P*2, my, P*4, P*3, "#7a2e3e");          // boca aberta (respiração)
      R(mx-P*2, my, P*4, 1, "#ffffff");            // dentes
      if(wild){ R(mx+P, my, 1, P*3, "#ffffff"); R(mx-P, my+P*2, P*2, 1, "#d46a7a"); } // presa!
      else if(cute){ R(mx-P, my+P, P*2, P*2, "#d46a7a"); } // "o" fofinho
      else { R(mx-P, my+P*2, P*2, 1, "#d46a7a"); }  // língua
    } else if(happy){
      R(mx-P*2, my, P*4, P*3, "#7a2e3e");          // sorriso aberto
      R(mx-P*2, my, P*4, 1, "#ffffff");
      R(mx, my, 1, P*3, "#ffffff");                // dentinho
      if(wild) R(mx-P, my+P*2, P*2, 1, "#d46a7a"); // língua selvagem
    }
    else if(sad){ R(mx-P*2, my+1, P*4, 1, "#7a2e3e"); }
    else { R(mx-P, my, P*2, 1, "#7a2e3e"); }
  } else {
    // costas: cabelo cobre tudo + brilho
    R(headCX-headW/2, headTop, headW, headH, pal.hair);
    ctx.save(); ctx.globalAlpha = 0.25;
    R(headCX-headW/2+P, headTop+P, headW-P*2, P*2, "#ffffff");
    ctx.restore();
    R(headCX-headW*0.2, headTop+h*0.04, headW*0.14, headH*0.5, pal.hair2);
  }

  // ---- FRANJA anime (5 mechas, pontudas) ----
  if(!back){
    R(headCX-headW/2-P, headTop-P, headW+P*2, P*4, shade(pal.hair,-55));
    R(headCX-headW/2-P, headTop-P, headW+P*2, P*3, pal.hair);
    ctx.save(); ctx.globalAlpha = 0.30;
    R(headCX-headW*0.30, headTop-P, headW*0.60, P, "#ffffff");
    ctx.restore();
    for(let i=0;i<5;i++){
      const fxx = headCX-headW/2 + (i+0.5)*headW/5 - P + faceTurn*h*0.004;
      const len = headH*(i%2? 0.34 : 0.24) + Math.sin(t*3+i*1.7)*h*0.003;
      ctx.fillStyle = shade(pal.hair,-55);
      ctx.beginPath();
      ctx.moveTo(snap(fxx-P*0.5,P), snap(headTop+P*2,P));
      ctx.lineTo(snap(fxx+P*2.5,P), snap(headTop+P*2,P));
      ctx.lineTo(snap(fxx+P+Math.sin(t*3+i)*h*0.003,P), snap(headTop+P*2+len,P));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.moveTo(snap(fxx,P), snap(headTop+P*2,P));
      ctx.lineTo(snap(fxx+P*2,P), snap(headTop+P*2,P));
      ctx.lineTo(snap(fxx+P+Math.sin(t*3+i)*h*0.003,P), snap(headTop+P*2+len-P,P));
      ctx.closePath(); ctx.fill();
    }
    // mechas laterais emoldurando o rosto (finas, terminam acima do queixo)
    for(const s of [-1,1]){
      const lx = headCX + s*headW*0.56 + faceTurn*h*0.006;
      for(let i=0;i<3;i++){
        const yy = headTop + headH*0.22 + i*h*0.040;
        const wob = Math.sin(t*2.6+i+s)*h*0.004*hb + (running? h*0.005:0);
        R(lx+wob-P, yy, P*2+1, h*0.038, pal.hair);
      }
    }
  }

  // ---- penteados extras ----
  if(style.includes("ponytail")){
    const high = style.includes("high");
    const frontish = side < 0.45 && !back; // de frente: rabo cai ao lado da cabeça, nunca sobre o rosto
    const pxn = frontish ? headCX + headW*0.55 : headCX - dirX*h*0.03 + headW*0.35;
    const py0 = headTop + headH*(high? 0.02 : 0.15);
    const segsN = 5, plen = h*(high? 0.26 : 0.22) + (running? h*0.05:0);
    const back2 = -Math.sign(dirX||faceTurn||1);
    for(let i=0;i<segsN;i++){
      const wdt = h*0.045*(1-i*0.13);
      const wy = Math.sin(t*4.2+i*0.9)*h*0.008*(1+i*0.4) + spinB*h*0.001*i + (running? h*0.008*i*0.35:0);
      const sx = frontish ? pxn + i*plen/segsN*0.30 + wy*0.4 : pxn + back2*(i*plen/segsN*0.55) + wy;
      const sy = py0 + i*plen/segsN*(frontish? 0.92 : 1) - (!frontish && high? i*h*0.012 : 0);
      R(sx-wdt/2, sy, wdt, plen/segsN+2, i%2? shade(pal.hair,-10):pal.hair);
    }
    R(pxn-P, py0-P, P*4, P*2, pal.outfit2); // elástico
    R(pxn-P, py0-P, P, P, "#ffffff");
  }
  if(style==="twin"){
    for(const sgn of [-1,1]){
      const qx = headCX + sgn*headW*0.58;
      for(let i=0;i<4;i++){
        const wy = Math.cos(t*4+i+sgn)*h*0.004 + (running? h*0.004*i:0);
        R(qx+wy-sgn*i*h*0.006-P, headTop+h*0.06+i*h*0.038, P*3+P, h*0.040, i%2? pal.hair:shade(pal.hair,-10));
      }
      R(qx-P, headTop+h*0.045, P*4, P*2, pal.outfit2);
    }
  }
  if(style==="mane-wild"){
    // juba espetada Gold Ship: espinhos ao redor
    for(let i=0;i<8;i++){
      const a = -Math.PI*0.85 + i*(Math.PI*0.7/7);
      const sx = headCX + Math.cos(a)*headW*0.62, sy = headTop + headH*0.3 + Math.sin(a)*headW*0.62;
      const tx = headCX + Math.cos(a)*headW*1.05, ty = headTop + headH*0.3 + Math.sin(a)*headW*1.05;
      ctx.fillStyle = shade(pal.hair,-55);
      ctx.beginPath();
      ctx.moveTo(snap(sx-2,P), snap(sy,P)); ctx.lineTo(snap(sx+2,P), snap(sy,P)); ctx.lineTo(snap(tx,P), snap(ty,P));
      ctx.closePath(); ctx.fill();
    }
  }

  // ---- acessório ----
  if(def.accessory){
    const acc = def.accessory;
    if(acc.includes("crown")||acc.includes("tiara")){
      const ax = headCX + headW*0.18;
      for(let i=0;i<3;i++) R(ax+i*P*2-P*2, headTop-h*0.020-(i===1? P*2:0), P*2, P*2+(i===1? P*2:0), "#ffd166");
      R(ax-P*2, headTop-h*0.008, P*6, P, shade("#ffd166",-40));
    } else if(acc.includes("ribbon")){
      const ax = headCX - headW*0.42;
      R(ax, headTop, P*3, P*3, pal.outfit2);
      R(ax+P*3, headTop+P, P*2, P*2, shade(pal.outfit2,-25));
    } else if(acc.includes("flower")||acc.includes("sakura")){
      const ax = headCX + headW*0.40;
      R(ax, headTop, P*2, P*2, "#ffb3d9"); R(ax+P*2, headTop+P, P*2, P*2, "#ff8ab8"); R(ax, headTop+P*2, P*2, P*2, "#ffffff");
    } else {
      const ax = headCX + headW*0.34;
      R(ax, headTop-h*0.006, P*3, P*2, pal.outfit2);
      R(ax, headTop-h*0.006, P, P, "#ffffff");
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

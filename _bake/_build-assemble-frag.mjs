import fs from "node:fs"; import path from "node:path";
const ROOT=path.resolve("."); 
const SP="C:/Users/PC/AppData/Local/Temp/claude/C--Users-PC-Documents-Arthefacte-Games/a3692c4d-06bf-465c-956f-7f6db4905db1/scratchpad";
const {F,CELL,frames}=JSON.parse(fs.readFileSync(path.join(ROOT,"_bake","_assemble-frag-frames.json"),"utf8"));
const html=`<title>Fractal Arena — Boot · assemblage 3D (proto #5)</title>
<style>
  :root{ --navy:#05070f; --cyan:#00F0FF; --fire:#F7931A; --text:#EAF1FF; --dim:#7F8DAD;
    --mono:"JetBrains Mono",ui-monospace,Consolas,monospace; --disp:"Chakra Petch","Bahnschrift","Segoe UI Semibold",system-ui,sans-serif; }
  *{box-sizing:border-box;} html,body{margin:0;height:100%;}
  body{background:var(--navy); color:var(--text); font-family:var(--disp); overflow:hidden;}
  .stage{position:fixed; inset:0; display:grid; place-items:center;
    background:radial-gradient(900px 620px at 50% 42%, rgba(0,240,255,.05), transparent 60%),
               radial-gradient(700px 560px at 50% 108%, rgba(247,147,26,.06), transparent 55%), var(--navy);}
  .stage::after{content:""; position:absolute; inset:0; pointer-events:none; opacity:.5;
    background:repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0 1px, transparent 1px 3px); mix-blend-mode:overlay;}
  .boot{display:flex; flex-direction:column; align-items:center; gap:24px;}
  .emblem-wrap{position:relative; width:${CELL}px; height:${CELL}px;}
  .halo{position:absolute; inset:-24%; border-radius:50%;
    background:radial-gradient(circle at 50% 48%, rgba(0,240,255,.28), rgba(247,147,26,.10) 44%, transparent 66%);
    filter:blur(10px); opacity:0; transition:opacity .5s;}
  .emb{position:absolute; inset:0; width:100%; height:100%; image-rendering:auto;}
  .float{animation:float 4.2s ease-in-out infinite;}
  @keyframes float{0%,100%{transform:translateY(-5px);}50%{transform:translateY(5px);}}
  .flash{position:absolute; inset:-40%; pointer-events:none; opacity:0;
    background:radial-gradient(circle, rgba(180,250,255,.9), rgba(0,240,255,.22) 34%, transparent 62%);}
  .flash.go{animation:flash .5s ease-out;}
  @keyframes flash{0%{opacity:0;}40%{opacity:.9;}100%{opacity:0;}}
  .wordmark{font-family:var(--disp); font-weight:700; letter-spacing:.42em; font-size:22px; padding-left:.42em;
    background:linear-gradient(90deg,var(--fire),#fff 52%,var(--cyan)); -webkit-background-clip:text; background-clip:text; color:transparent;
    opacity:0; transition:opacity .5s, transform .5s; transform:translateY(6px);}
  .wordmark.show{opacity:1; transform:none;}
  .hashline{font-family:var(--mono); font-size:12px; letter-spacing:.14em; color:var(--dim); opacity:0; height:16px; display:flex; gap:10px; transition:opacity .5s;}
  .hashline.show{opacity:1;} .hashline .tag{color:var(--cyan);} .hashline .hx{color:#9fb4d6;}
  .replay{position:fixed; bottom:22px; left:50%; transform:translateX(-50%); font-family:var(--mono); font-size:11px; letter-spacing:.16em; text-transform:uppercase;
    color:var(--dim); background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.10); padding:8px 14px; border-radius:2px; cursor:pointer;}
  .replay:hover{color:var(--text); border-color:rgba(0,240,255,.5);} .replay:focus-visible{outline:2px solid var(--cyan); outline-offset:2px;}
  .note{position:fixed; top:16px; left:50%; transform:translateX(-50%); font-family:var(--mono); font-size:10.5px; letter-spacing:.08em; color:#5a6b8f; text-align:center; max-width:90vw;}
</style>
<div class="stage">
  <div class="note">proto #5 — assemblage 3D en 9 blocs découpés du modèle texturé — vraie matière nette</div>
  <div class="boot">
    <div class="emblem-wrap" id="wrap">
      <div class="halo" id="halo"></div>
      <img class="emb" id="emb" alt="Fractal Arena" />
      <div class="flash" id="flash"></div>
    </div>
    <div class="wordmark" id="wordmark">FRACTAL ARENA</div>
    <div class="hashline" id="hashline"><span class="tag">MINING GENESIS</span><span class="hx" id="hx">0x0000000000000000</span></div>
  </div>
  <button class="replay" id="replay">▷ rejouer l'assemblage</button>
</div>
<script>
  const FRAMES=${JSON.stringify(frames)};
  const F=${F};
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const emb=document.getElementById("emb"), wrap=document.getElementById("wrap"),
        halo=document.getElementById("halo"), flash=document.getElementById("flash"),
        wm=document.getElementById("wordmark"), hl=document.getElementById("hashline");
  const imgs=FRAMES.map(s=>{const i=new Image(); i.src=s; return i;});
  let timer=null;
  function play(){
    clearTimeout(timer); wrap.classList.remove("float"); flash.classList.remove("flash","go");
    wm.classList.remove("show"); hl.classList.remove("show"); halo.style.opacity=0;
    if(reduce){ emb.src=FRAMES[F-1]; settle(); return; }
    let f=0; const step=1500/F;
    (function next(){
      emb.src=FRAMES[f];
      if(f>=F-1){ settle(); return; }
      f++; timer=setTimeout(next, step);
    })();
  }
  function settle(){
    halo.style.opacity=.7; wrap.classList.add("float");
    flash.classList.add("go"); wm.classList.add("show"); hl.classList.add("show");
    // reboucle après un temps d'idle
    if(!reduce) timer=setTimeout(play, 2600);
  }
  // hash miner
  const HX="0123456789abcdef", hx=document.getElementById("hx"); let solved=0;
  function line(){let s="0x"+"0".repeat(solved); for(let i=0;i<16-solved;i++)s+=HX[(Math.random()*16)|0]; return s;}
  if(!reduce){ setInterval(()=>hx.textContent=line(),60); setInterval(()=>solved=(solved+1)%13,700); }
  document.getElementById("replay").addEventListener("click",play);
  // démarrage après préchargement rapide
  Promise.all(imgs.map(i=>i.decode().catch(()=>{}))).then(play);
</script>`;
fs.writeFileSync(SP+"/boot-assemble.html",html);
console.log("écrit boot-assemble.html:", Math.round(html.length/1024),"Ko");

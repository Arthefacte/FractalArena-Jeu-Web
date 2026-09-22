import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const __dirname=path.dirname(fileURLToPath(import.meta.url)); const ROOT=path.resolve(__dirname,"..");
const {F,CELL,frames}=JSON.parse(fs.readFileSync(path.join(ROOT,"_bake","_assemble-frames.json"),"utf8"));
const browser=await chromium.launch(); const page=await browser.newPage();
const COLS=8, ROWS=Math.ceil(F/COLS), TH=110;
const durl=await page.evaluate(async ({frames,COLS,ROWS,TH})=>{
  const c=document.createElement("canvas"); c.width=COLS*TH; c.height=ROWS*TH;
  const ctx=c.getContext("2d"); ctx.fillStyle="#05070f"; ctx.fillRect(0,0,c.width,c.height);
  for(let f=0;f<frames.length;f++){ const img=new Image(); img.src=frames[f]; await img.decode();
    ctx.drawImage(img,(f%COLS)*TH,Math.floor(f/COLS)*TH,TH,TH);
    ctx.fillStyle="#00F0FF"; ctx.font="10px monospace"; ctx.fillText(String(f),(f%COLS)*TH+3,Math.floor(f/COLS)*TH+12);
  }
  return c.toDataURL("image/png");
},{frames,COLS,ROWS,TH});
fs.writeFileSync(path.join(ROOT,"_bake","_contact.png"),Buffer.from(durl.split(",")[1],"base64"));
console.log("contact.png écrit",COLS+"x"+ROWS);
await browser.close();

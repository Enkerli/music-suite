#!/usr/bin/env node
/**
 * Pitch-class palette derivation + provenance.
 *
 * Source of truth: Alex's Exquis "Chromeful" layout (hardware-validated),
 * Intuitive Instruments Exquis — Chromeful.xqilayout. The 12 vivid LED
 * colours below ARE the canonical pitch-class identity. This script
 * derives, from those, the AA-safe chip tokens (--es-pc-*, per theme) and
 * the per-pad ink, and prints them for tokens.css. Re-run after any change
 * to EX and paste the output into tokens.css (the contrast-audit.mjs gate
 * guards the result). The JS table lives in components/pitch-class-colors.js.
 *
 *   node packages/ui/tools/make-pc-palette.mjs
 */
// ARGB ff-prefixed → RGB hex, indexed by pc (the exact Exquis LED colours).
const EX = {
  0:"f2f20d",1:"7f0df2",2:"0df20d",3:"f24060",4:"0df2f2",5:"f27f0d",
  6:"0d0df2",7:"40f2a0",8:"f20df2",9:"0dbf40",10:"f20d0d",11:"0d7ff2",
};
const NAMES = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];

const srgb = v => v<=0.03928? v/12.92 : ((v+0.055)/1.055)**2.4;
const lum = hex => { const c=hex.replace('#',''); const [r,g,b]=[0,2,4].map(i=>srgb(parseInt(c.slice(i,i+2),16)/255)); return 0.2126*r+0.7152*g+0.0722*b; };
const ratio = (a,b)=>{const[h,l]=[Math.max(lum(a),lum(b)),Math.min(lum(a),lum(b))];return (h+0.05)/(l+0.05);};

const toHsl = hex => { const c=hex.replace('#',''); let [r,g,b]=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255);
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2; if(mx===mn)return[0,0,l];
  const d=mx-mn,s=l>0.5?d/(2-mx-mn):d/(mx+mn);
  let h=mx===r?((g-b)/d+(g<b?6:0)):mx===g?(b-r)/d+2:(r-g)/d+4; return[h/6,s,l]; };
const toHex = ([h,s,l]) => { const f=(p,q,t)=>{t=(t%1+1)%1;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};
  const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q; return '#'+[f(p,q,h+1/3),f(p,q,h),f(p,q,h-1/3)].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join(''); };

// Derive an AA-safe chip: keep Exquis hue+sat, sweep lightness toward the
// search direction until ≥3:1 vs BOTH surfaces. dir<0 darkens (for paper).
function fit(hex, bgs, target, dir){ let [h,s,l]=toHsl(hex);
  for(let i=0;i<220;i++){ const cand=toHex([h,s,l]); if(bgs.every(b=>ratio(cand,b)>=target)) return cand; l+=dir*0.004; if(l<=0||l>=1) break; }
  return null; }

const lightBgs=["#f5f2eb","#fcfbf7"], darkBgs=["#1a1814","#221f1a"];
const out={pad:{},padInk:{},light:{},dark:{}};
for(let pc=0; pc<12; pc++){
  const hex = '#'+EX[pc];
  out.pad[pc]=hex;
  // per-pad ink: white or black, whichever is more legible on the pad
  out.padInk[pc] = ratio('#ffffff',hex) >= ratio('#0d0d0d',hex) ? '#ffffff' : '#0d0d0d';
  out.padInk[pc+'_r'] = +Math.max(ratio('#ffffff',hex),ratio('#0d0d0d',hex)).toFixed(2);
  // light chips: darken until AA on cream
  out.light[pc] = fit(hex, lightBgs, 3, -1);
  // dark chips: the vivid colours are bright; many already clear; if not, brighten
  out.dark[pc] = lightBgs && (darkBgs.every(b=>ratio(hex,b)>=3) ? hex : fit(hex, darkBgs, 3, +1));
}
const line = obj => [0,1,2,3,4,5,6,7,8,9,10,11].map(pc=>`${NAMES[pc]}:${obj[pc]}`).join("  ");
console.log("PAD (exact Exquis):    ", line(out.pad));
console.log("PAD INK:               ", [0,1,2,3,4,5,6,7,8,9,10,11].map(pc=>`${out.padInk[pc]==='#ffffff'?'W':'K'}${out.padInk[pc+'_r']}`).join(" "));
console.log("LIGHT chips (paper):   ", line(out.light));
console.log("DARK chips:            ", line(out.dark));
// machine output for the CSS
console.log("\nJSON:"+JSON.stringify(out));

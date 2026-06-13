// Re-audit the actual tokens.css: parse per-theme values, check WCAG.
import { readFileSync } from 'node:fs';
const css = readFileSync(process.argv[2], 'utf8');
const lum = (hex) => { const c = hex.replace('#',''); const [r,g,b]=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4); return 0.2126*r+0.7152*g+0.0722*b; };
const ratio = (a,b)=>{const[h,l]=[Math.max(lum(a),lum(b)),Math.min(lum(a),lum(b))];return (h+0.05)/(l+0.05);};

const blocks = { light: css.split(':root[data-theme="light"] {')[1].split('}')[0], dark: css.split(':root[data-theme="dark"]')[1].split('}')[0] };
const rootBlock = css.split(':root {')[1].split('\n}')[0];
const vars = (txt) => Object.fromEntries([...txt.matchAll(/--es-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m=>[m[1],m[2]]));
const root = vars(rootBlock);

let fail = 0;
for (const theme of ['light','dark']) {
  const v = { ...root, ...vars(blocks[theme]) };
  const bgs = [v['bg'], v['bg-raised']];
  const t = (name, fg, target, vs=bgs) => {
    const r = Math.min(...vs.map(b=>ratio(fg,b)));
    const ok = r >= target;
    if (!ok) fail++;
    console.log(`${theme} ${name} ${fg} ${r.toFixed(2)} ${ok?'PASS':'FAIL'}`);
  };
  t('fg', v['fg'], 4.5); t('fg-2', v['fg-2'], 4.5); t('fg-muted', v['fg-muted'], 4.5);
  t('accent-fg on accent', v['accent-fg'], 4.5, [v['accent']]);
  t('accent vs bg (ring)', v['accent'], 3);
  t('border-strong', v['border-strong'], 3);
  t('danger', v['danger'], 3);
  for (let i=0;i<12;i++) t(`pc-${i}`, v[`pc-${i}`], 3);
}
// Pad palette is theme-independent (dark/LED surfaces): check each pad's
// ink (bold note label) is legible on its own pad colour (≥3:1, large text).
for (let i=0;i<12;i++) {
  const pad = root[`pc-pad-${i}`], ink = root[`pc-pad-ink-${i}`];
  const r = ratio(pad, ink), ok = r >= 3;
  if (!ok) fail++;
  console.log(`pad pc-${i} ink ${ink} on ${pad} ${r.toFixed(2)} ${ok?'PASS':'FAIL'}`);
}
console.log(fail ? `${fail} FAILURES` : 'ALL PASS');

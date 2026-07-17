(()=>{var $=["proggenie","midicurator","serpe","vane","drawnqurve","pitchfold","exquisite-fingerings","pickpcs","chord-dictionary","external"];var Te=["envelope","envelopeVersion","id","kind","format","formatVersion","title","app","savedAt","provenance"],wt=[...Te,"creator","facets","tags","payload","payloadRef"];var L="enkerli-suite",ze=1,De=["scale","chord","progression","pattern","manifest","param","command","note"],X=["ratio","percent","count","semitone","cents","pc","pc-mask","rhythm-mask","bpm","ms","hz","db","bool","enum"],J=["set","report","observe"];function Be(){return globalThis.crypto?.randomUUID?.()??`msg${Date.now().toString(36)}-${Math.floor(Math.random()*1e9).toString(36)}`}function Oe(){return new Date().toISOString().replace(/\.\d{3}Z$/,"Z")}function E(t,e,r,n={}){return{protocol:L,v:ze,id:n.id??Be(),from:t,to:n.to??"*",sentAt:n.sentAt??Oe(),type:e,body:r}}function T(t,e,r={}){return E(t,"param",{mode:"set",...e},r)}function z(t,e,r={}){return E(t,"command",e,r)}var Pe=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;function w(t){return typeof t=="object"&&t!==null&&!Array.isArray(t)}function Z(t){let e=[],r=n=>e.push(n);if(!w(t))return{ok:!1,errors:["message: not an object"]};if(t.protocol!==L&&r(`protocol: must be "${L}"`),(!Number.isInteger(t.v)||t.v<1)&&r("v: integer \u2265 1 required"),(typeof t.id!="string"||t.id.length<8)&&r("id: string \u2265 8 chars required"),$.includes(t.from)||r(`from: not in the app vocabulary (${String(t.from)})`),t.to!=="*"&&!$.includes(t.to)&&r(`to: "*" or an app id required (${String(t.to)})`),(typeof t.sentAt!="string"||!Pe.test(t.sentAt))&&r("sentAt: absolute ISO 8601 required"),De.includes(t.type)||r(`type: not a known message type (${String(t.type)})`),!w(t.body))r("body: object required");else{let n=t.body,a=(s,d)=>Number.isInteger(s)&&s>=0&&s<2**d;switch(t.type){case"scale":a(n.mask,12)||r("body.mask: 12-bit integer required (leftmost = LSB)"),n.root!==void 0&&!(Number.isInteger(n.root)&&n.root>=0&&n.root<=11)&&r("body.root: pitch class 0\u201311 required");break;case"chord":n.pcs!==void 0&&!a(n.pcs,12)&&r("body.pcs: 12-bit integer required"),n.notes!==void 0&&(!Array.isArray(n.notes)||n.notes.some(s=>!Number.isInteger(s)||s<0||s>127))&&r("body.notes: array of MIDI notes 0\u2013127 required"),n.pcs===void 0&&n.notes===void 0&&n.symbol===void 0&&r("body: chord needs at least one of pcs / notes / symbol");break;case"progression":w(n.prog)||r("body.prog: the canonical Progression object required");break;case"pattern":(!Number.isInteger(n.steps)||n.steps<1||n.steps>128)&&r("body.steps: integer 1\u2013128 required"),(!Number.isInteger(n.mask)||n.mask<0)&&r("body.mask: non-negative integer required (leftmost = LSB)");break;case"manifest":Re(n,r);break;case"param":Ce(n,r);break;case"command":(typeof n.name!="string"||n.name.length===0)&&r("body.name: non-empty command name required"),n.args!==void 0&&!w(n.args)&&r("body.args: object of named arguments required");break;case"note":(!Array.isArray(n.notes)||n.notes.length===0||n.notes.some(s=>!Number.isInteger(s)||s<0||s>127))&&r("body.notes: non-empty array of MIDI notes 0\u2013127 required"),n.velocity!==void 0&&!(Number.isInteger(n.velocity)&&n.velocity>=0&&n.velocity<=127)&&r("body.velocity: integer 0\u2013127 required"),n.channel!==void 0&&!(Number.isInteger(n.channel)&&n.channel>=1&&n.channel<=16)&&r("body.channel: integer 1\u201316 required"),n.gate!==void 0&&n.gate!=="on"&&n.gate!=="off"&&r('body.gate: "on" or "off" required'),n.durationMs!==void 0&&!(typeof n.durationMs=="number"&&n.durationMs>0)&&r("body.durationMs: positive number required");break}}return{ok:e.length===0,errors:e}}var Le=new Set(X);function Q(t,e,r,n){if(!w(t)){r(`${e}: object required`);return}(typeof t[n]!="string"||t[n].length===0)&&r(`${e}.${n}: non-empty string required`),n==="id"&&t.label!==void 0&&typeof t.label!="string"&&r(`${e}.label: string required`),Le.has(t.unit)||r(`${e}.unit: one of ${X.join("|")} required (${String(t.unit)})`);let a=["min","max","default"];for(let s of a)(typeof t[s]!="number"||!Number.isFinite(t[s]))&&r(`${e}.${s}: finite number required`);typeof t.min=="number"&&typeof t.max=="number"&&t.min>t.max&&r(`${e}: min must be \u2264 max`),typeof t.default=="number"&&typeof t.min=="number"&&typeof t.max=="number"&&(t.default<t.min||t.default>t.max)&&r(`${e}.default: must be within [min, max]`),t.step!==void 0&&(typeof t.step!="number"||t.step<=0)&&r(`${e}.step: positive number required`),t.scale!==void 0&&t.scale!=="linear"&&t.scale!=="log"&&r(`${e}.scale: "linear" or "log" required`),t.scale==="log"&&typeof t.min=="number"&&t.min<=0&&r(`${e}: log scale requires min > 0`),t.unit==="enum"&&(!Array.isArray(t.values)||t.values.length===0)&&r(`${e}: enum unit requires a non-empty values[]`)}function Re(t,e){if($.includes(t.app)||e(`body.app: not in the app vocabulary (${String(t.app)})`),(!Number.isInteger(t.v)||t.v<1)&&e("body.v: integer \u2265 1 required"),!Array.isArray(t.params))e("body.params: array required");else{let r=new Set;t.params.forEach((n,a)=>{Q(n,`body.params[${a}]`,e,"id");let s=w(n)?n.id:void 0;typeof s=="string"&&(r.has(s)&&e(`body.params[${a}].id: duplicate "${s}"`),r.add(s))})}Array.isArray(t.commands)?t.commands.forEach((r,n)=>{if(!w(r)){e(`body.commands[${n}]: object required`);return}(typeof r.name!="string"||r.name.length===0)&&e(`body.commands[${n}].name: non-empty string required`),typeof r.label!="string"&&e(`body.commands[${n}].label: string required`),r.args!==void 0&&(Array.isArray(r.args)?r.args.forEach((a,s)=>Q(a,`body.commands[${n}].args[${s}]`,e,"id")):e(`body.commands[${n}].args: array required`))}):e("body.commands: array required")}function Ce(t,e){t.mode!==void 0&&!J.includes(t.mode)&&e(`body.mode: one of ${J.join("|")} required`);let r=t.id!==void 0,n=t.params!==void 0;r===n&&e("body: exactly one of single (id+value) or batch (params[]) required"),r&&((typeof t.id!="string"||t.id.length===0)&&e("body.id: non-empty string required"),(typeof t.value!="number"||!Number.isFinite(t.value))&&e("body.value: finite number required")),n&&(!Array.isArray(t.params)||t.params.length===0?e("body.params: non-empty array required"):t.params.forEach((a,s)=>{!w(a)||typeof a.id!="string"||a.id.length===0?e(`body.params[${s}].id: non-empty string required`):(typeof a.value!="number"||!Number.isFinite(a.value))&&e(`body.params[${s}].value: finite number required`)}))}var qe=5e3,D=class extends EventTarget{constructor(e={}){super(),this.channel=null,this._seen=new Map,e.channelName&&typeof BroadcastChannel<"u"&&(this.channel=new BroadcastChannel(e.channelName),this.channel.onmessage=r=>this._deliver(r.data,!0))}publish(e){return Z(e).ok?(this._deliver(e,!1),this.channel&&this.channel.postMessage(e),!0):!1}_deliver(e,r){let n=e&&e.id;if(n){let a=Date.now();if(this._seen.has(n))return;if(this._seen.set(n,a),this._seen.size>500)for(let[s,d]of this._seen)a-d>qe&&this._seen.delete(s)}this.dispatchEvent(new CustomEvent("suitemessage",{detail:{msg:e,remote:r}}))}subscribe(e,r={}){let n=a=>{let{msg:s,remote:d}=a.detail;(!r.to||s.to==="*"||s.to===r.to)&&e(s,{remote:d})};return this.addEventListener("suitemessage",n),()=>this.removeEventListener("suitemessage",n)}close(){this.channel&&this.channel.close()}};function Ne(t){return t.param!==void 0}var ee={control:"ctrl",ctrl:"ctrl",option:"alt",alt:"alt",shift:"shift",cmd:"mod",command:"mod",meta:"mod",mod:"mod",super:"mod",win:"mod"},te=["mod","ctrl","alt","shift"];function re(t){let e=t.toLowerCase().split("+").map(a=>a.trim()).filter(Boolean),r=[],n="";for(let a of e)if(ee[a]){let s=ee[a];r.includes(s)||r.push(s)}else n=a;return r.sort((a,s)=>te.indexOf(a)-te.indexOf(s)),[...r,...n?[n]:[]].join("+")}function ne(t,e){return{...t,bindings:[...t.bindings,e]}}function ae(t,e){return{...t,bindings:t.bindings.filter((r,n)=>n!==e)}}var O=(t,e,r)=>Math.max(e,Math.min(r,t));function B(t,e){let r=t;return e.step&&e.step>0&&(r=e.min+Math.round((r-e.min)/e.step)*e.step),O(r,e.min,e.max)}function R(t,e,r={}){let a=(1<<(r.bits??7))-1,s=O(t/a,0,1);if(r.curve==="toggle"||e.unit==="bool")return s>=.5?e.max:e.min;let p=(r.curve==="log"?"log":r.curve==="linear"?"linear":e.scale??"linear")==="log"&&e.min>0?e.min*Math.pow(e.max/e.min,s):e.min+s*(e.max-e.min);return B(p,e)}function se(t,e,r={}){let a=(1<<(r.bits??7))-1,s=O(t,e.min,e.max);if(r.curve==="toggle"||e.unit==="bool")return s>=(e.min+e.max)/2?a:0;let p=(r.curve==="log"?"log":r.curve==="linear"?"linear":e.scale??"linear")==="log"&&e.min>0?Math.log(s/e.min)/Math.log(e.max/e.min):(s-e.min)/(e.max-e.min);return Math.round(O(p,0,1)*a)}function je(t){if(Array.isArray(t)){let e={};for(let r of t)e[r.app]=r;return e}return t}function Ue(t,e,r){return t[e]?.params.find(n=>n.id===r)}function Fe(t,e){return t.kind!==e.kind?!1:t.kind==="key"&&e.kind==="key"?re(t.combo)===re(e.combo):t.kind==="midi-cc"&&e.kind==="midi-cc"?t.cc===e.cc&&(t.channel===void 0||t.channel===e.channel):t.kind==="midi-note"&&e.kind==="midi-note"?t.note===e.note&&(t.channel===void 0||t.channel===e.channel):!1}var We=64;function Ve(t,e,r,n={}){let a=je(r),s=n.from??"external",d=[];for(let p of t.bindings){if(!Fe(p.trigger,e))continue;let c=p.action;if(Ne(c)){let o=Ue(a,c.app,c.param);if(!o)continue;let i;if(c.value!==void 0)i=B(c.value,o);else if(e.kind==="midi-cc"){let l=p.trigger.kind==="midi-cc"?p.trigger.bits:void 0;i=R(e.value,o,{...l&&{bits:l},...c.curve&&{curve:c.curve}})}else e.kind,i=B(o.default,o);d.push(T(s,{mode:"set",id:c.param,value:i},{to:c.app}))}else{if(e.kind==="midi-cc"&&e.value<We||a[c.app]&&!a[c.app].commands.some(o=>o.name===c.command))continue;d.push(z(s,{name:c.command,...c.args&&{args:c.args}},{to:c.app}))}}return d}function oe(t){let e=t.map;return{setMap(r){e=r},handle(r){let n=Ve(e,r,t.manifests,t.from!==void 0?{from:t.from}:{});if(t.send)for(let a of n)t.send(a);return n}}}var C=14,ie=(1<<C)-1;function de(t,e){return R(Math.round(Math.max(0,Math.min(1,t))*ie),e,{bits:C})}function le(t,e){return se(t,e,{bits:C})/ie}function ce(t,e,r,n){return T(t,{mode:"set",id:r,value:n},{to:e})}function pe(t,e,r,n){return z(t,{name:r,...n?{args:n}:{}},{to:e})}function q(t,e){switch(t.unit){case"hz":return e>=1e3?(e/1e3).toFixed(2)+" kHz":Math.round(e)+" Hz";case"bpm":return Math.round(e)+" bpm";case"ms":return Math.round(e)+" ms";case"cents":return(e>0?"+":"")+Math.round(e)+" \xA2";case"count":return String(Math.round(e));case"percent":return Math.round(e)+" %";case"ratio":return e.toFixed(3);case"bool":return e>=.5?"on":"off";default:return String(e)}}function S(t,e,r=0){if(t>e&&(t=e),t<=0)return new Array(e).fill(0);let n=[],a=[],s=[],d=e-t;s[0]=t;let p=0;do a[p]=Math.floor(d/s[p]),s[p+1]=d%s[p],d=s[p],p++;while(s[p]>1);a[p]=d;function c(i){if(i===-1)n.push(0);else if(i===-2)n.push(1);else{for(let l=0;l<a[i];l++)c(i-1);s[i]!==0&&c(i-2)}}for(c(p);n.length<e;)n.push(0);let o=n.findIndex(i=>i);if(o>0&&(n=n.slice(o).concat(n.slice(0,o))),r!==0){r=(r%e+e)%e;let i=new Array(e);for(let l=0;l<e;l++)i[l]=n[(l-r+e)%e];n=i}return n}function _e(t,e){for(;e!==0;){let r=e;e=t%e,t=r}return t}function ue(t,e){if(t===0)return 10;let r=0,n=_e(t,e);n>1&&(r=n/e*10);let a=t/e,s=[1/2,1/4,3/4,1/3,2/3,1/8,3/8,5/8,7/8,1/6,5/6],d=[5,3,3,2.5,2.5,1.5,1.5,1.5,1.5,1,1],p=1,c=0;for(let o=0;o<s.length;o++){let i=Math.abs(a-s[o]);i<p&&(p=i,c=d[o])}if(p<=.5/e&&(r=Math.max(r,c)),r<.5){let o=Math.abs(t-e/2)/(e/2),i=Math.min(t,e-t)/(e/2);r=1-o*.3+i*.2,r+=t%3*.01+t%5*.005}return t===e-1&&(r=Math.max(r,7)),Math.max(r,.1+t*.001)}function N(t){let e=new Array(t);for(let r=0;r<t;r++)e[r]=ue(r,t);return e}function Ge(t,e){let r=e/4,n=e/8;return!(t%r===0||t%n===0)}function fe(t,e,r={}){let n=t.length,a=t.filter(d=>d).length;if(e===a)return t.slice();let s=N(n);return e<a?He(t,e,s,r):Ye(t,e,s,r)}function He(t,e,r,n){let{preserveDownbeat:a=!0,minimumIndispensability:s=0,wolrabMode:d=!1}=n,c=t.filter(l=>l).length-e,o=t.map((l,f)=>({position:f,indispensability:r[f],isDownbeat:f===0,on:l})).filter(l=>l.on);o.sort((l,f)=>{if(a&&!d){if(l.isDownbeat&&!f.isDownbeat)return 1;if(!l.isDownbeat&&f.isDownbeat)return-1}return d?f.indispensability-l.indispensability:l.indispensability-f.indispensability});let i=t.slice();for(let l=0;l<Math.min(c,o.length);l++){let f=o[l];(d||f.indispensability>=s||!a||!f.isDownbeat)&&(i[f.position]=0)}return i}function Ye(t,e,r,n){let{avoidWeakBeats:a=!1,minimumIndispensability:s=.1,wolrabMode:d=!1}=n,p=t.length,c=t.filter(b=>b).length,o=e-c,i=t.map((b,m)=>({position:m,indispensability:r[m],isWeakBeat:Ge(m,p),on:b})).filter(b=>!b.on);i.sort((b,m)=>{if(a){if(b.isWeakBeat&&!m.isWeakBeat)return 1;if(!b.isWeakBeat&&m.isWeakBeat)return-1}return d?b.indispensability-m.indispensability:m.indispensability-b.indispensability});let l=t.slice(),f=0;for(let b=0;b<i.length&&f<o;b++){let m=i[b];m.indispensability>=s&&(l[m.position]=1,f++)}if(f<o)for(let b=0;b<i.length&&f<o;b++){let m=i[b];l[m.position]||(l[m.position]=1,f++)}return l}function U(t,e){return S(t,e)}function F(t,e,r){let n=new Array(r).fill(0);if(t<=0)return n;for(let a=0;a<t;a++){let s=Math.round(a*r/t)%r;n[(s+e)%r]=1}return n}function ge(t,e){let r=[...Array(e).keys()];for(let a=r.length-1;a>0;a--){let s=Math.floor(Math.random()*(a+1));[r[a],r[s]]=[r[s],r[a]]}let n=new Array(e).fill(0);for(let a=0;a<Math.min(t,e);a++)n[r[a]]=1;return n}function be(t){return t.map(e=>e?0:1)}var Ke={tri:"P(3,0)",pent:"P(5,0)",hex:"P(6,0)",hept:"P(7,0)",oct:"P(8,0)",tresillo:"E(3,8)",cinquillo:"E(5,8)"};function Je(t,e){for(;e;)[t,e]=[e,t%e];return t}function he(t,e){return t/Je(t,e)*e}function Qe(t){let e=[],r=0,n="",a="+";for(let s of t)s==="("?r++:s===")"&&r--,r===0&&(s==="+"||s==="-")&&n.trim()?(e.push({op:a,pat:n.trim()}),n="",a=s):n+=s;return n.trim()&&e.push({op:a,pat:n.trim()}),e}var me={a:".-",b:"-...",c:"-.-.",d:"-..",e:".",f:"..-.",g:"--.",h:"....",i:"..",j:".---",k:"-.-",l:".-..",m:"--",n:"-.",o:"---",p:".--.",q:"--.-",r:".-.",s:"...",t:"-",u:"..-",v:"...-",w:".--",x:"-..-",y:"-.--",z:"--.."};function Xe(t){let e=String(t).toLowerCase().trim();e==="sos"?e="...---...":e==="cq"?e="-.-.--.-":/[a-z]/.test(e)&&(e=[...e].map(n=>me[n]!==void 0?me[n]:n).join(""));let r=[];for(let n of e)n==="."?r.push(1):n==="-"?(r.push(1),r.push(0)):n===" "&&r.push(0);return r}function ve(t,e,r=!0){let n=t.length;if(n===0||e<1||n===e)return t.slice();let a=Math.PI*2,s=c=>(c%=a,c<0?c+a:c),d=new Set;for(let c=0;c<n;c++){if(!t[c])continue;let o=c/n*a;r||(o=a-o),o=s(o);let i=Math.round(o/a*e);i>=e&&(i=0),i=Math.max(0,Math.min(i,e-1)),d.add(i)}let p=new Array(e).fill(0);for(let c of d)p[c]=1;return p}function Ze(t,e,r){let n=he(t.length||1,e.length||1),a=new Array(n);for(let s=0;s<n;s++){let d=t[s%t.length],p=e[s%e.length];a[s]=r?d||p?1:0:d&&!p?1:0}return a}function j(t,e){let r=new Array(e).fill(0),n=typeof t=="bigint"?t:BigInt(t);for(let a=0;a<e;a++)r[a]=(n&1n)===1n?1:0,n>>=1n;return r}function I(t,e={n:16}){let r=String(t||"").trim(),n=null,a=r.match(/^\{([^}]*)\}\s*(.*)$/);a&&(r=a[2].trim(),n=a[1].replace(/[^01]/g,"").split("").map(Number));let s=(d,p)=>{let c=d.length,o=new Array(c).fill(0);if(n&&n.length){let i=0;for(let l=0;l<c;l++)d[l]&&(o[l]=n[i%n.length]?1:0,i++)}return{steps:d.map(Number),accents:o,accentPattern:n,label:p,ok:!0}};try{let d,p=r.indexOf(";");if(p>0){let o=r.slice(p+1).trim().match(/^(-?)(\d+)$/);if(o){let i=I(r.slice(0,p).trim(),e);return i.ok?s(ve(i.steps,+o[2],o[1]!=="-"),`${i.label};${o[1]}${o[2]}`):i}}let c=Ke[r.toLowerCase()];c&&(r=c);{let o=null;if(/^M:/i.test(r)?o=r.slice(2):(/^[.\-\s]+$/.test(r)&&/[.\-]/.test(r)||/^[a-z]+$/i.test(r))&&(o=r),o!==null){let i=Xe(o);if(i.length)return s(i,`\u266A ${r}`)}}if(/[+-]/.test(r)){let o=Qe(r);if(o.length>=2&&o.every(i=>!/^\d+$/.test(i.pat))){let i=o.map((m,v)=>(v?m.op:"")+m.pat).join(""),l=/^P\(\s*(\d+)\s*,\s*(-?\d+)\s*(?:,\s*(\d+)\s*)?\)$/i;if(o.every(m=>m.op==="+"&&l.test(m.pat))){let v=o.map(h=>{let x=h.pat.match(l);return+x[1]*(x[3]?+x[3]:1)}).reduce((h,x)=>he(h,x)),g=new Array(v).fill(0);for(let h of o){let x=h.pat.match(l),M=F(+x[1],(+x[2]%v+v)%v,v);for(let y=0;y<v;y++)M[y]&&(g[y]=1)}return s(g,i)}let f=I(o[0].pat,e);if(!f.ok)return f;let b=f.steps.slice();for(let m=1;m<o.length;m++){let v=I(o[m].pat,e);if(!v.ok)return v;b=Ze(b,v.steps,o[m].op==="+")}return s(b,i)}}if(d=r.match(/^E\(\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(-?\d+)\s*)?\)$/i)){let o=+d[1],i=+d[2],l=d[3]?+d[3]:0;return s(S(o,i,l),`E(${o},${i}${l?","+l:""})`)}if(d=r.match(/^P\(\s*(\d+)\s*,\s*(-?\d+)\s*(?:,\s*(\d+)\s*)?\)$/i)){let o=+d[1],i=+d[2],l=d[3]?+d[3]:e.n;return s(F(o,(i%l+l)%l,l),`P(${o},${i}${d[3]?","+l:""})`)}if(d=r.match(/^R\(\s*(\d+)\s*,\s*(\d+)\s*\)$/i)){let o=+d[1],i=+d[2];return s(ge(o,i),`R(${o},${i})`)}if(d=r.match(/^([BWD])\(\s*(\d+)\s*,\s*(\d+)\s*\)$/i)){let o=d[1].toUpperCase(),i=+d[2],l=+d[3];if(o==="D")return s(be(S(l-i,l)),`D(${i},${l})`);let f=new Array(l).fill(0);return f[0]=1,s(fe(f,i,{wolrabMode:o==="W"}),`${o}(${i},${l})`)}if(d=r.match(/^0x([0-9a-f]+)(?::(\d+))?$/i)){let o=BigInt("0x"+[...d[1]].reverse().join("")),i=d[2]?+d[2]:d[1].length*4;return s(j(o,i),`0x${d[1].toUpperCase()}`)}if(d=r.match(/^o([0-7]+)(?::(\d+))?$/i)){let o=BigInt("0o"+[...d[1]].reverse().join("")),i=d[2]?+d[2]:d[1].length*3;return s(j(o,i),`o${d[1]}`)}if(d=r.match(/^d(\d+)(?::(\d+))?$/i)){let o=BigInt(d[1]),i=d[2]?+d[2]:Math.max(1,o.toString(2).length);return s(j(o,i),`d${d[1]}`)}if(d=r.match(/^\[([\d,\s]*)\](?::(\d+))?$/)){let o=d[1].split(",").map(f=>f.trim()).filter(f=>f!=="").map(Number),i=d[2]?+d[2]:o.length?Math.max(...o)+1:e.n,l=new Array(i).fill(0);return o.forEach(f=>{f>=0&&f<i&&(l[f]=1)}),s(l,`[${o.join(",")}]:${i}`)}if((d=r.match(/^b?([01]+)$/i))&&/[01]/.test(r)){let o=d[1].split("").map(Number);return s(o,o.join(""))}}catch(d){return{steps:U(5,e.n),accents:new Array(e.n).fill(0),label:"E(5,16)",ok:!1,error:String(d)}}return{steps:U(5,e.n),accents:new Array(e.n).fill(0),label:"",ok:!1,error:"Unrecognised pattern"}}var xe=Math.PI*2;function P(t){let e=[];for(let r=0;r<t.length;r++)t[r]&&e.push(r);return e}function W(t){let e=t.length,r=0,n=0,a=P(t);for(let d of a){let p=xe*d/e;r+=Math.cos(p),n+=Math.sin(p)}let s=Math.hypot(r,n);return{x:r,y:n,mag:s,angle:Math.atan2(n,r),k:a.length}}function ye(t){let e=W(t),r=e.k?e.mag/e.k:0,n=(e.angle/xe*t.length+t.length)%t.length;return{magnitude:r,angleSteps:n,x:e.x,y:e.y}}function we(t,e=1e-6){let r=W(t);return r.k>=2&&r.mag<e*Math.max(1,r.k)+1e-9?!0:r.mag<1e-6}function V(t){let e=P(t),r=t.length;if(e.length<2)return e.length===1?[r]:[];let n=[];for(let a=0;a<e.length;a++){let s=e[a],d=e[(a+1)%e.length];n.push((d-s+r)%r||r)}return n}function ke(t){let e=V(t);if(e.length<2)return 1;let r=e.reduce((a,s)=>a+s,0)/e.length;if(r===0)return 1;let n=e.reduce((a,s)=>a+Math.abs(s-r),0)/e.length;return Math.max(0,1-n/r)}function _(t){let e=t.length,r=P(t),n=ye(t);return{n:e,k:r.length,density:e?r.length/e:0,onsets:r,intervals:V(t),evenness:ke(t),balanced:we(t),cog:n,binary:t.join(""),hex:"0x"+[...BigInt("0b"+(t.slice().reverse().join("")||"0")).toString(16).toUpperCase()].reverse().join(""),decimal:Number(BigInt("0b"+(t.slice().reverse().join("")||"0")))}}var Me={app:"vane",v:1,params:[{id:"morph",label:"Morph",unit:"ratio",min:0,max:1,step:.001,default:0,wasmId:12},{id:"pulse-width",label:"Pulse Width",unit:"ratio",min:.5,max:.999,step:.001,default:.5,wasmId:13},{id:"wavefold",label:"Wavefold",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:17},{id:"inharmonicity",label:"Inharmonicity",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:14},{id:"hard-sync",label:"Hard Sync",unit:"ratio",min:1,max:8,step:.01,default:1,wasmId:15},{id:"noise",label:"Noise",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:26},{id:"detune",label:"Detune",unit:"cents",min:-100,max:100,step:1,default:0,wasmId:28},{id:"filter-cutoff",label:"Filter Cutoff",unit:"hz",min:20,max:2e4,step:10,default:1128,scale:"log",wasmId:1},{id:"filter-resonance",label:"Filter Resonance",unit:"ratio",min:0,max:1,step:.01,default:.1,wasmId:2},{id:"output",label:"Output",unit:"ratio",min:0,max:1,step:.01,default:.8,wasmId:8},{id:"vel-vca",label:"Velocity \u2192 VCA",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:9},{id:"glide-time",label:"Glide Time",unit:"ms",min:0,max:2e3,step:5,default:0,wasmId:10},{id:"master-tune",label:"Master Tune",unit:"cents",min:-100,max:100,step:1,default:0,wasmId:29},{id:"unison-detune",label:"Unison Detune",unit:"cents",min:0,max:50,step:1,default:14,wasmId:40},{id:"unison-width",label:"Unison Width",unit:"ratio",min:0,max:1,step:.01,default:.7,wasmId:41},{id:"vowel",label:"Vowel",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:20},{id:"vowel-front",label:"Vowel Front",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:21},{id:"vowel-round",label:"Vowel Round",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:22},{id:"vowel-amount",label:"Vowel Amount",unit:"ratio",min:0,max:1,step:.01,default:1,wasmId:23},{id:"vowel-bite",label:"Vowel Bite",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:24},{id:"vowel-move",label:"Vowel Move",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:25},{id:"wg-embouchure",label:"Waveguide Embouchure",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:31},{id:"wg-reed-stiff",label:"Waveguide Reed Stiffness",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:32},{id:"wg-reed-aperture",label:"Waveguide Reed Aperture",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:33},{id:"wg-bore-damping",label:"Waveguide Bore Damping",unit:"ratio",min:0,max:1,step:.01,default:.2,wasmId:34},{id:"wg-bell-bright",label:"Waveguide Bell Brightness",unit:"ratio",min:0,max:1,step:.01,default:.7,wasmId:35},{id:"wg-conical",label:"Waveguide Conical",unit:"ratio",min:0,max:1,step:.01,default:.62,wasmId:36},{id:"wg-breath-noise",label:"Waveguide Breath Noise",unit:"ratio",min:0,max:1,step:.01,default:.05,wasmId:37},{id:"wg-growl",label:"Waveguide Growl",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:38},{id:"transient-gain",label:"Transient Gain",unit:"ratio",min:0,max:2,step:.01,default:0,wasmId:44},{id:"transient-decay",label:"Transient Decay",unit:"ms",min:10,max:2e3,step:1,default:200,scale:"log",wasmId:45},{id:"transient-var",label:"Transient Variation",unit:"ratio",min:0,max:1,step:.01,default:.3,wasmId:47},{id:"transient-dyn",label:"Transient Dynamics",unit:"ratio",min:0,max:1,step:.01,default:.75,wasmId:49},{id:"transient-reso",label:"Transient Resonance",unit:"ratio",min:0,max:1,step:.01,default:.3,wasmId:50},{id:"transient-damp",label:"Transient Damping",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:51},{id:"transient-morph",label:"Transient Morph",unit:"ms",min:0,max:50,step:1,default:12,wasmId:52}],commands:[]};var Ie={app:"serpe",v:1,params:[{id:"steps",label:"Steps",unit:"count",min:1,max:128,default:8,step:1},{id:"tempo",label:"Tempo",unit:"bpm",min:20,max:300,default:120,step:1},{id:"swing",label:"Swing",unit:"ratio",min:0,max:1,default:0,step:.01}],commands:[{name:"rotate",label:"Rotate",args:[{id:"by",unit:"count",min:-64,max:64,default:1}]},{name:"invert",label:"Invert"},{name:"complement",label:"Complement"},{name:"mutate",label:"Mutate",args:[{id:"amount",unit:"ratio",min:0,max:1,default:.5}]}]};var k={vane:Me,serpe:Ie},G="external",u=(t,e={},...r)=>{let n=document.createElement(t);for(let[a,s]of Object.entries(e))a==="class"?n.className=s:a==="text"?n.textContent=s:a.startsWith("on")&&typeof s=="function"?n.addEventListener(a.slice(2),s):s!=null&&n.setAttribute(a,s);for(let a of r)a!=null&&n.append(a);return n};function rt(t){let e=`${t.from}\u2192${t.to}`,r=t.body;return t.type==="param"?r.params?`param ${r.mode??"set"} [${e}] ${r.params.map(n=>`${n.id}=${n.value}`).join(" ")}`:`param ${r.mode??"set"} [${e}] ${r.id}=${typeof r.value=="number"?+r.value.toFixed(3):r.value}`:t.type==="command"?`command [${e}] ${r.name}${r.args?`(${Object.entries(r.args).map(([n,a])=>`${n}=${a}`).join(",")})`:""}`:t.type==="pattern"?`pattern [${e}] ${r.steps} steps, mask ${r.mask}${r.name?` (${r.name})`:""}`:`${t.type} [${e}]`}function nt(t,e,r){let n=r.app??"vane",a=u("select",{class:"ws-select","aria-label":"Target tool",onchange:()=>{r.app=a.value,t.save(),d()}},...Object.keys(k).map(p=>u("option",{value:p,text:p,...p===n?{selected:""}:{}})));a.value=n;let s=u("div",{class:"ws-controls"});e.append(u("div",{class:"ws-row"},u("span",{class:"ws-label",text:"tool"}),a),s);function d(){let p=k[a.value];s.replaceChildren();for(let c of p.params){let o=u("span",{class:"ws-readout",text:q(c,c.default)}),i=u("input",{type:"range",min:"0",max:"1",step:"0.0001",value:String(le(c.default,c)),class:"ws-slider","aria-label":c.label,"data-param":c.id});i.addEventListener("input",()=>{let l=de(+i.value,c);o.textContent=q(c,l),t.bus.publish(ce(G,a.value,c.id,l))}),s.append(u("label",{class:"ws-param"},u("span",{class:"ws-param-name",text:c.label}),i,o))}if(p.commands.length){let c=u("div",{class:"ws-cmds"});for(let o of p.commands){let i=(o.args??[]).reduce((l,f)=>(l[f.id]=f.default,l),{});c.append(u("button",{class:"ws-btn",text:o.label,"data-cmd":o.name,onclick:()=>t.bus.publish(pe(G,a.value,o.name,Object.keys(i).length?i:void 0))}))}s.append(c)}}d()}function at(t,e,r){let n=u("input",{class:"ws-text",type:"text",value:r.upi??"E(3,8)","aria-label":"UPI notation",spellcheck:"false"}),a=u("div",{class:"ws-lane","aria-hidden":"true"}),s=u("div",{class:"ws-readout"});function d(o,i){a.replaceChildren(...o.map(l=>u("span",{class:`ws-step${l?" on":""}`}))),s.textContent=i}function p(){let o=I(n.value,{n:16});if(!o.ok){s.textContent="unparsed";return}r.upi=n.value,t.save();let i=_(o.steps);d(o.steps,`${i.n} steps \xB7 ${i.k} onsets \xB7 mask ${i.decimal} (${i.hex})`),t.bus.publish(E(G,"pattern",{steps:i.n,mask:i.decimal,name:o.label},{to:"*"}))}n.addEventListener("keydown",o=>{o.key==="Enter"&&p()}),e.append(u("div",{class:"ws-row"},n,u("button",{class:"ws-btn",text:"\u25B6 send",onclick:p})),a,s);let c=t.bus.subscribe(o=>{if(o.type!=="pattern")return;let i=Array.from({length:o.body.steps},(l,f)=>o.body.mask>>f&1);d(i,`via bus \u2190 ${o.from}: ${o.body.name??""} (mask ${o.body.mask})`)});return p(),c}function st(t,e){let r=u("div",{class:"ws-log",role:"log","aria-live":"polite"});return e.append(r),t.bus.subscribe(n=>{let a=u("div",{class:"ws-logline",text:`${new Date().toLocaleTimeString()}  ${rt(n)}`});for(r.prepend(a);r.childElementCount>60;)r.lastElementChild.remove()})}var ot={id:"workspace-bindings",kind:"control-map",label:"Workspace bindings",bindings:[{trigger:{kind:"key",combo:"]"},action:{app:"serpe",command:"rotate",args:{by:1}}},{trigger:{kind:"key",combo:"["},action:{app:"serpe",command:"rotate",args:{by:-1}}},{trigger:{kind:"key",combo:"m"},action:{app:"serpe",command:"mutate"}}]};function Se(t){let e=[];t.ctrlKey&&e.push("ctrl"),t.altKey&&e.push("alt"),t.metaKey&&e.push("mod"),t.shiftKey&&e.push("shift");let r=String(t.key).toLowerCase();return["control","alt","meta","shift"].includes(r)||e.push(r),e.join("+")}var it=t=>t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName),dt=t=>t.command?`${t.app}.${t.command}${t.args?`(${Object.entries(t.args).map(([e,r])=>`${e}=${r}`).join(",")})`:""}`:`${t.app}.${t.param}=${t.value}`;function lt(t,e,r){let n=r.map??ot,a=Object.values(k),s=oe({map:n,manifests:a,send:g=>t.bus.publish(g)}),d=u("div",{class:"ws-controls"}),p={combo:""},c=u("input",{class:"ws-text",type:"text",readonly:"",placeholder:"press a key\u2026","aria-label":"Trigger key"});c.addEventListener("keydown",g=>{g.preventDefault(),p.combo=Se(g),c.value=p.combo});let o=u("select",{class:"ws-select","aria-label":"Target app",onchange:()=>l()},...Object.keys(k).map(g=>u("option",{value:g,text:g}))),i=u("select",{class:"ws-select","aria-label":"Action"});function l(){let g=k[o.value];i.replaceChildren(...g.commands.map(h=>u("option",{value:`cmd:${h.name}`,text:`\u26A1 ${h.label}`})),...g.params.map(h=>u("option",{value:`param:${h.id}`,text:`\u25B8 ${h.label}`})))}l();let f=u("button",{class:"ws-btn",text:"+ add",onclick:()=>{if(!p.combo||!i.value)return;let[g,h]=i.value.split(":"),x;if(g==="cmd"){let y=(k[o.value].commands.find(A=>A.name===h).args??[]).reduce((A,K)=>(A[K.id]=K.default,A),{});x={app:o.value,command:h,...Object.keys(y).length?{args:y}:{}}}else{let M=k[o.value].params.find(y=>y.id===h);x={app:o.value,param:h,value:M.default}}n=ne(n,{trigger:{kind:"key",combo:p.combo},action:x}),p.combo="",c.value="",b()}});e.append(d,u("div",{class:"ws-row",style:"flex-wrap:wrap"},c,o,i,f));function b(){r.map=n,s.setMap(n),t.save(),m()}function m(){d.replaceChildren(...n.bindings.map((g,h)=>u("div",{class:"ws-param"},u("span",{class:"ws-readout",style:"text-align:left",text:g.trigger.combo}),u("span",{class:"ws-param-name",style:"overflow:visible",text:dt(g.action)}),u("button",{class:"ws-x",text:"\u2715",title:"Remove binding","aria-label":`Remove ${g.trigger.combo}`,onclick:()=>{n=ae(n,h),b()}})))),n.bindings.length||d.append(u("div",{class:"ws-readout",text:"no bindings \u2014 add one below"}))}m();let v=g=>{it(g.target)||s.handle({kind:"key",combo:Se(g)})};return window.addEventListener("keydown",v),()=>window.removeEventListener("keydown",v)}function ct(t,e){let r;try{r=JSON.parse(e)}catch{return!1}return t.publish(r)}function pt(t,e,r){return!t||e?.remote?!1:!(t.id&&r.has(t.id))}function ut(t,e,r){let n=u("input",{class:"ws-text",type:"text",value:r.url??"http://localhost:8765","aria-label":"Bridge URL",spellcheck:"false"}),a=u("span",{class:"ws-readout",text:"not connected"}),s=u("div",{class:"ws-readout",text:"msuite accompany --play | msuite bridge  \xB7  full duplex: this tab's own actions POST back"}),d=null,p=null,c=0,o=0,i=new Map;function l(g){if(!g)return;let h=Date.now();i.set(g,h);for(let[x,M]of i)h-M>5e3&&i.delete(x)}let f=g=>{a.textContent=`${g} \xB7 in ${c} \xB7 out ${o}`};function b(){d?.close(),d=null,p?.(),p=null,v.textContent="connect",a.textContent="not connected"}function m(){if(typeof EventSource>"u"){a.textContent="no EventSource in this browser";return}b(),r.url=n.value,t.save(),c=0,o=0;let g=n.value.replace(/\/$/,"");d=new EventSource(`${g}/events`),v.textContent="disconnect",a.textContent="connecting\u2026",d.onopen=()=>f("connected"),d.onerror=()=>{a.textContent="retrying\u2026 (is the bridge running?)"},d.onmessage=h=>{let x;try{x=JSON.parse(h.data)}catch{return}l(x.id),ct(t.bus,h.data)&&(c++,f("connected"))},p=t.bus.subscribe((h,x)=>{typeof fetch!="function"||!pt(h,x,i)||fetch(`${g}/send`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(h)}).then(()=>{o++,f("connected")}).catch(()=>{})})}let v=u("button",{class:"ws-btn",text:"connect",onclick:()=>d?b():m()});return e.append(u("div",{class:"ws-row"},n,v),a,s),()=>b()}var H={"control-surface":{title:"Control Surface",make:nt},pattern:{title:"Pattern (UPI)",make:at},bindings:{title:"Bindings",make:lt},monitor:{title:"Bus Monitor",make:st},bridge:{title:"Bridge (CLI)",make:ut}};var Ae=`/**
 * @enkerli/ui \u2014 design tokens v0.2: the "paper & ink" language.
 *
 * Codified from the suite's two most mature UIs rather than invented:
 * Vane (warm cream surfaces, warm dark counterpart, per-dimension accent
 * colors, Inter/JetBrains Mono, soft 20/14/10 radii) and DrawnQurve
 * (the same paper palette \u2014 its --paper-bg IS Vane's panel2 \u2014 plus serif
 * and hand display faces). See packages/ui/DESIGN.md.
 *
 * Theming: LIGHT IS THE DEFAULT design target; dark is a first-class
 * variant. Resolution order: [data-theme="light"|"dark"] wins; otherwise
 * the OS preference applies. theme.js provides the persisted toggle.
 *
 * Accessibility ground rules encoded here:
 *  - color is never the only channel (dimension dots pair with labels)
 *  - touch targets \u2265 44px on coarse pointers (controls scale up)
 *  - motion respects prefers-reduced-motion
 */

/* Fonts are loaded separately via '@enkerli/ui/fonts.css' (self-hosted, SIL
   OFL) \u2014 kept out of tokens.css so text-injected consumers don't runtime-fetch
   a bundler-relative @import. Each app imports fonts.css the way its build
   wants it (bundled url() for vite, injected text + dist/fonts for esbuild). */

:root {
  /* \u2500\u2500 Type \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  --es-font-sans: "Inter Tight", Inter, -apple-system, BlinkMacSystemFont,
                  "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  --es-font-mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
  /* Optional display voices (DrawnQurve's flavor \u2014 opt-in per app) */
  --es-font-serif: "Domine", Georgia, "Iowan Old Style", serif;
  --es-font-hand: "Caveat", "Segoe Script", cursive;

  --es-text-xs: 0.6875rem;  /* 11px \u2014 dense plugin labels */
  --es-text-sm: 0.8125rem;  /* 13px */
  --es-text-md: 1rem;       /* 16px \u2014 body */
  --es-text-lg: 1.25rem;
  --es-text-xl: 1.5625rem;

  /* \u2500\u2500 Spacing \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  --es-space-1: 0.25rem;
  --es-space-2: 0.5rem;
  --es-space-3: 0.75rem;
  --es-space-4: 1rem;
  --es-space-6: 1.5rem;
  --es-gap: 10px;

  /* \u2500\u2500 Shape (the Vane radii) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  --es-radius-lg: 20px;
  --es-radius-md: 14px;
  --es-radius-sm: 10px;
  --es-shadow: 0 6px 22px rgba(28, 25, 20, 0.05);

  /* \u2500\u2500 Interaction \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  --es-ctl-h: 32px;            /* control height; scales up on touch */
  --es-touch-target: 44px;
  --es-section-header: 28px;   /* collapsed-section header (PitchFold grammar) */
  --es-focus-ring: 2px solid var(--es-accent);
  --es-focus-offset: 2px;

  /* \u2500\u2500 Motion \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  --es-motion-fast: 120ms ease-out;
  --es-motion-base: 200ms ease-out;

  /* \u2500\u2500 Expressive-dimension semantics (Vane vocabulary, suite-wide;
        pairs with manifold's controller dimensions). Always pair the
        color with a label or dot \u2014 never color alone. \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  --es-dim-breath: #4b86c7;   --es-dim-breath-tint: #dde8f4;
  --es-dim-expr: #2d9d8a;     --es-dim-expr-tint: #d6ebe6;
  --es-dim-pressure: #d28330; --es-dim-pressure-tint: #f4e3cf;
  --es-dim-slide: #a35bbf;    --es-dim-slide-tint: #ecdcf2;
  --es-dim-bend: #c39529;     --es-dim-bend-tint: #f1e6c3;
  --es-dim-vel: #7a4cff;

  /* \u2500\u2500 Pitch-class palette \u2014 the canonical Exquis "Chromeful" identity
        (Alex's hardware-validated scheme; provenance + derivation in
        tools/make-pc-palette.mjs). ONE hue per pc \u2014 C yellow, C\u266F purple,
        D green, D\u266F rose, E cyan, F orange, F\u266F blue, G spring, G\u266F magenta,
        A green, A\u266F red, B azure \u2014 expressed two ways:
         \xB7 --es-pc-pad-* : the EXACT vivid Exquis LED colours, for dark /
           pad surfaces, with --es-pc-pad-ink-* (black or white per pad,
           chosen for legibility exactly as the Exquis does).
         \xB7 --es-pc-* : the same hue tone-mapped to \u22653:1 (WCAG 1.4.11) on
           chips against the theme surfaces \u2014 this :root carries the light
           (paper) set; the dark blocks override. Hue is preserved; only
           lightness moves to satisfy contrast. \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  --es-pc-0: #919108;  --es-pc-1: #7f0df2;  --es-pc-2: #09a309;
  --es-pc-3: #f24060;  --es-pc-4: #089b9b;  --es-pc-5: #d7710c;
  --es-pc-6: #0d0df2;  --es-pc-7: #0ba05c;  --es-pc-8: #f20df2;
  --es-pc-9: #0ba236;  --es-pc-10: #f20d0d; --es-pc-11: #0d7ff2;
  /* exact Exquis pad colours (dark/LED surfaces) */
  --es-pc-pad-0: #f2f20d;  --es-pc-pad-1: #7f0df2;  --es-pc-pad-2: #0df20d;
  --es-pc-pad-3: #f24060;  --es-pc-pad-4: #0df2f2;  --es-pc-pad-5: #f27f0d;
  --es-pc-pad-6: #0d0df2;  --es-pc-pad-7: #40f2a0;  --es-pc-pad-8: #f20df2;
  --es-pc-pad-9: #0dbf40;  --es-pc-pad-10: #f20d0d; --es-pc-pad-11: #0d7ff2;
  /* per-pad ink (black/white, \u22654.4:1 on its pad) */
  --es-pc-pad-ink-0: #0d0d0d;  --es-pc-pad-ink-1: #ffffff;  --es-pc-pad-ink-2: #0d0d0d;
  --es-pc-pad-ink-3: #0d0d0d;  --es-pc-pad-ink-4: #0d0d0d;  --es-pc-pad-ink-5: #0d0d0d;
  --es-pc-pad-ink-6: #ffffff;  --es-pc-pad-ink-7: #0d0d0d;  --es-pc-pad-ink-8: #0d0d0d;
  --es-pc-pad-ink-9: #0d0d0d;  --es-pc-pad-ink-10: #000000; --es-pc-pad-ink-11: #0d0d0d;
  /* pad-ink-10 is true black: the A\u266F red is the dimmest pad, and #0d0d0d
     lands at 4.48:1 \u2014 a hair under AA small-text; #000 clears 4.8:1. */
}

/* \u2500\u2500 Paper (light) \u2014 the default design target \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
:root,
:root[data-theme="light"] {
  --es-bg: #f5f2eb;          /* paper */
  --es-bg-raised: #fcfbf7;   /* panel */
  --es-bg-sunken: #efebe2;   /* field / well */
  --es-fg: #2d2b27;          /* ink */
  --es-fg-2: #4b463e;
  --es-fg-muted: #6b665b;    /* \u22654.5:1 on bg, bg-raised AND bg-sunken (was
                                #736e62, which hit 4.26 on sunken \u2014 apps
                                legitimately put muted text on wells) */
  --es-fg-faint: #b3ac9e;    /* disabled ink ONLY (WCAG-exempt) \u2014 never for
                                content; replaces --vn-muted-2 / PAPER.ink30 */
  --es-border: #ddd6ca;      /* decorative \u2014 separation, not identification */
  --es-border-soft: #eae3d4;
  --es-border-strong: #9d8967; /* \u22653:1 \u2014 boundaries that identify a control */
  --es-accent: #2f66a5;      /* breath blue, deepened further (a11y pass):
                                usable as SMALL TEXT \u22654.5:1 on bg, raised and
                                sunken \u2014 links, chips, readouts \u2014 while white
                                text on it stays \u22654.5:1 and it stays \u22653:1 vs
                                paper as a focus ring (the graphic dim-breath
                                hue stays #4b86c7) */
  --es-accent-fg: #ffffff;
  --es-danger: #b3403a;        /* destructive actions; \u22653:1 on both surfaces */
  color-scheme: light;
}

/* \u2500\u2500 Warm dark \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --es-bg: #1a1814;
    --es-bg-raised: #221f1a;
    --es-bg-sunken: #14130f;
    --es-fg: #e8e1d2;
    --es-fg-2: #cfc7b5;
    --es-fg-muted: #908672;    /* \u22654.5:1 on bg and bg-raised */
    --es-fg-faint: #5f584a;    /* disabled ink ONLY (WCAG-exempt) */
    --es-border: #38332b;
    --es-border-soft: #2b2620;
    --es-border-strong: #736958; /* \u22653:1 \u2014 boundaries that identify a control */
    --es-accent: #6da3df;
    --es-accent-fg: #14130f;
    --es-danger: #cf6a5e;        /* destructive actions; \u22653:1 on both surfaces */
    /* pc palette: the Exquis hues, kept vivid on the dark surfaces
       (only C\u266F and F\u266F lifted to clear the near-black). */
    --es-pc-0: #f2f20d;  --es-pc-1: #902ef4;  --es-pc-2: #0df20d;
    --es-pc-3: #f24060;  --es-pc-4: #0df2f2;  --es-pc-5: #f27f0d;
    --es-pc-6: #5151f6;  --es-pc-7: #40f2a0;  --es-pc-8: #f20df2;
    --es-pc-9: #0dbf40;  --es-pc-10: #f20d0d; --es-pc-11: #0d7ff2;
    --es-shadow: 0 6px 22px rgba(0, 0, 0, 0.28);
    color-scheme: dark;
  }
}

:root[data-theme="dark"] {
  --es-bg: #1a1814;
  --es-bg-raised: #221f1a;
  --es-bg-sunken: #14130f;
  --es-fg: #e8e1d2;
  --es-fg-2: #cfc7b5;
  --es-fg-muted: #908672;    /* \u22654.5:1 on bg and bg-raised */
  --es-fg-faint: #5f584a;    /* disabled ink ONLY (WCAG-exempt) */
  --es-border: #38332b;
  --es-border-soft: #2b2620;
  --es-border-strong: #736958; /* \u22653:1 \u2014 boundaries that identify a control */
  --es-accent: #6da3df;
  --es-accent-fg: #14130f;
  --es-danger: #cf6a5e;        /* destructive actions; \u22653:1 on both surfaces */
  /* pc palette: the Exquis hues, kept vivid on the dark surfaces
     (only C\u266F and F\u266F lifted to clear the near-black). */
  --es-pc-0: #f2f20d;  --es-pc-1: #902ef4;  --es-pc-2: #0df20d;
  --es-pc-3: #f24060;  --es-pc-4: #0df2f2;  --es-pc-5: #f27f0d;
  --es-pc-6: #5151f6;  --es-pc-7: #40f2a0;  --es-pc-8: #f20df2;
  --es-pc-9: #0dbf40;  --es-pc-10: #f20d0d; --es-pc-11: #0d7ff2;
  --es-shadow: 0 6px 22px rgba(0, 0, 0, 0.28);
  color-scheme: dark;
}

/* \u2500\u2500 Touch scaling (the Vane --ctl-h pattern) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@media (pointer: coarse) {
  :root {
    --es-ctl-h: 44px;
    --es-gap: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --es-motion-fast: 0ms;
    --es-motion-base: 0ms;
  }
}
`;var $e=`/**
 * @enkerli/ui \u2014 shared component classes over the tokens.
 * The primitives every suite app keeps reinventing inline; using these
 * IS the design-language alignment.
 */

.es-app {
  min-height: 100vh;
  background: var(--es-bg);
  color: var(--es-fg);
  font-family: var(--es-font-sans);
  margin: 0;
}

.es-panel {
  background: var(--es-bg-raised);
  border: 1px solid var(--es-border);
  border-radius: var(--es-radius-md);
  box-shadow: var(--es-shadow);
  padding: var(--es-space-4);
}

.es-control,
.es-btn {
  min-height: var(--es-ctl-h);
  font-family: var(--es-font-sans);
  font-size: var(--es-text-md);
  border-radius: var(--es-radius-sm);
  /* Interactive boundary: must identify the control (WCAG 1.4.11 \u22653:1).
     Panels keep the soft decorative border; controls get the strong one. */
  border: 1px solid var(--es-border-strong);
  background: var(--es-bg-raised);
  color: var(--es-fg);
  padding: 0 var(--es-space-3);
}

.es-btn {
  cursor: pointer;
  transition: background var(--es-motion-fast), color var(--es-motion-fast);
}
.es-btn:hover { background: var(--es-bg-sunken); }
.es-btn.es-primary {
  background: var(--es-accent);
  color: var(--es-accent-fg);
  border-color: var(--es-accent);
}
.es-btn.es-small {
  min-height: 32px;
  min-width: 32px;
  font-size: var(--es-text-sm);
  padding: 0 var(--es-space-2);
}
/* House rule (DESIGN.md): touch targets \u226544px on coarse pointers \u2014 "small"
   is a visual density for fine pointers, not a licence for tiny touch
   targets. Native checks/radios/ranges get real target boxes too (they
   default 13-16px, under even the WCAG 2.5.8 24px floor). */
@media (pointer: coarse) {
  .es-btn.es-small { min-height: 44px; min-width: 44px; }
  input[type="checkbox"], input[type="radio"] { width: 24px; height: 24px; }
  input[type="range"] { min-height: 44px; }
  .es-link { min-height: 24px; } /* inline text-buttons clear the WCAG floor */
}

.es-control:focus-visible,
.es-btn:focus-visible {
  outline: var(--es-focus-ring);
  outline-offset: var(--es-focus-offset);
}

/* Vane's eyebrow label: small caps over a section */
.es-eyebrow {
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--es-fg-muted);
  font-weight: 600;
}

/* Tabular numbers for anything musical-numeric */
.es-num {
  font-family: var(--es-font-mono);
  font-variant-numeric: tabular-nums;
}

.es-badge {
  font-size: var(--es-text-xs);
  font-family: var(--es-font-mono);
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--es-border);
  color: var(--es-fg);
}
.es-badge.es-up {
  background: var(--es-accent);
  color: var(--es-accent-fg);
}

/* Proportion bar (corpus stats, meters) */
.es-bar {
  height: 10px;
  border-radius: 5px;
  background: var(--es-border-soft);
  overflow: hidden;
}
.es-bar > div {
  height: 100%;
  max-width: 100%;
  background: var(--es-accent);
  transition: width var(--es-motion-base);
}

/* Dimension dot (always next to a text label) */
.es-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
  flex: none;
}
.es-dot.breath { background: var(--es-dim-breath); }
.es-dot.expr { background: var(--es-dim-expr); }
.es-dot.pressure { background: var(--es-dim-pressure); }
.es-dot.slide { background: var(--es-dim-slide); }
.es-dot.bend { background: var(--es-dim-bend); }
.es-dot.vel { background: var(--es-dim-vel); }

/* \u2500\u2500 Collapsible section shell (the PitchFold grammar, suite-wide) \u2500\u2500\u2500\u2500
   AUv3 windows are small and fixed: every plugin UI is a stack of
   collapsible sections, and a density toggle (.es-dense on a container)
   tightens the whole stack for stage use. Native <details> keeps it
   keyboard- and screen-reader-correct with zero JS. */
.es-section {
  background: var(--es-bg-raised);
  border: 1px solid var(--es-border);
  border-radius: var(--es-radius-md);
  overflow: hidden;
}
.es-section + .es-section { margin-top: var(--es-gap); }
.es-section > summary {
  min-height: var(--es-section-header);
  display: flex;
  align-items: center;
  gap: var(--es-space-2);
  padding: var(--es-space-1) var(--es-space-3);
  cursor: pointer;
  list-style: none;
  font-size: var(--es-text-sm);
  font-weight: 600;
  color: var(--es-fg-2);
  user-select: none;
}
.es-section > summary::-webkit-details-marker { display: none; }
.es-section > summary::before {
  content: "\u25B8";
  color: var(--es-fg-muted);
  transition: transform var(--es-motion-fast);
}
.es-section[open] > summary::before { transform: rotate(90deg); }
.es-section > summary:focus-visible {
  outline: var(--es-focus-ring);
  outline-offset: calc(var(--es-focus-offset) * -1);
}
.es-section > .es-section-body {
  padding: var(--es-space-3);
  border-top: 1px solid var(--es-border-soft);
}

/* Density toggle: tighten the stack (stage-performer persona) */
.es-dense {
  --es-gap: 6px;
  --es-section-header: 22px;
  --es-text-md: 0.875rem;
}
.es-dense .es-section > .es-section-body { padding: var(--es-space-2); }

/* \u2500\u2500 Form controls: custom select (no OS chrome) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The native <select> falls back to platform chrome that breaks the
   paper & ink language. Give it an ink chevron + theme-aware caret so
   it reads as part of the GUI. */
select.es-control {
  appearance: none; -webkit-appearance: none; -moz-appearance: none;
  padding-right: 36px; cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%234b463e' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 12px center; background-size: 14px;
  transition: background-color var(--es-motion-fast), border-color var(--es-motion-fast);
}
select.es-control:hover { background-color: var(--es-bg-sunken); border-color: var(--es-fg-muted); }
:root[data-theme="dark"] select.es-control,
[data-theme="dark"] select.es-control {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23cfc7b5' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
}
select.es-control option { background: var(--es-bg-raised); color: var(--es-fg); }

/* \u2500\u2500 Transport with arming affordance (plugin chrome) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   "Armed vs playing" must read without colour alone: the state word is
   always spelled out, and motion (a pulsing ring) doubles the cue.
   armed = danger red pulse, playing = accent pulse. Honors
   prefers-reduced-motion. */
.es-transport { display: flex; align-items: center; gap: var(--es-space-2); }
.es-tbtn {
  display: grid; place-items: center;
  min-width: var(--es-ctl-h); height: var(--es-ctl-h);
  padding: 0 var(--es-space-2);
  border: 1px solid var(--es-border-strong); border-radius: var(--es-radius-sm);
  background: var(--es-bg-raised); color: var(--es-fg); cursor: pointer;
  transition: background var(--es-motion-fast), border-color var(--es-motion-fast), color var(--es-motion-fast);
}
.es-tbtn:hover { background: var(--es-bg-sunken); }
.es-tbtn:focus-visible { outline: var(--es-focus-ring); outline-offset: 2px; }
.es-tbtn svg { width: 15px; height: 15px; display: block; }
.es-tbtn.play.playing { background: var(--es-accent); border-color: var(--es-accent); color: var(--es-accent-fg); animation: es-pulse-play 1.2s ease-in-out infinite; }
.es-tbtn.arm.armed { background: var(--es-danger); border-color: var(--es-danger); color: #fff; animation: es-pulse-arm 1.05s ease-in-out infinite; }
.es-transport-state { font-size: var(--es-text-sm); color: var(--es-fg-2); }
@keyframes es-pulse-play { 0%,100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--es-accent) 55%, transparent); } 50% { box-shadow: 0 0 0 5px transparent; } }
@keyframes es-pulse-arm  { 0%,100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--es-danger) 60%, transparent); } 50% { box-shadow: 0 0 0 6px transparent; } }
@media (prefers-reduced-motion: reduce) {
  .es-tbtn.play.playing, .es-tbtn.arm.armed { animation: none; }
}

/* \u2500\u2500 Range slider (dual-thumb output range; see components/range-slider.js)
   44px touch targets, elastic edge, draggable band. Visual only. */
.es-range { user-select: none; -webkit-user-select: none; }
.es-range-track {
  position: relative; height: 8px; border-radius: 6px;
  background: var(--es-bg-sunken); border: 1px solid var(--es-border);
  margin: 30px 22px;
}
.es-range-band {
  position: absolute; top: -1px; bottom: -1px; border-radius: 6px;
  background: var(--es-accent); transition: filter var(--es-motion-fast);
  cursor: grab; touch-action: none;
}
.es-range-band.grab { cursor: grabbing; }
.es-range.dragging .es-range-band { filter: saturate(1.15) brightness(1.04); }
.es-range-thumb {
  position: absolute; top: 50%; width: var(--es-touch-target); height: var(--es-touch-target);
  margin: 0; padding: 0; border: none; background: transparent; cursor: grab; touch-action: none;
  display: grid; place-items: center;
  transform: translate(-50%, -50%) translateX(var(--ovr, 0px));
}
.es-range-thumb.releasing { transition: transform 500ms cubic-bezier(.2, 1.5, .35, 1); }
.es-range-thumb::after {
  content: ""; width: 26px; height: 26px; border-radius: 50%;
  background: var(--es-bg-raised); border: 2px solid var(--es-border-strong);
  box-shadow: var(--es-shadow);
  transition: transform 360ms cubic-bezier(.2, 1.4, .3, 1), border-color var(--es-motion-fast), background var(--es-motion-fast);
}
.es-range-thumb::before {
  content: ""; position: absolute; width: 2px; height: 10px; border-radius: 2px;
  background: var(--es-border-strong); opacity: .55;
  transition: background var(--es-motion-fast);
}
.es-range-thumb:hover::after, .es-range-thumb.grab::after { border-color: var(--es-accent); }
.es-range-thumb:hover::before, .es-range-thumb.grab::before { background: var(--es-accent); opacity: 1; }
.es-range-thumb.grab { cursor: grabbing; }
.es-range-thumb.grab::after { transform: scale(1.16); }
.es-range-thumb:focus-visible { outline: none; }
.es-range-thumb:focus-visible::after { outline: var(--es-focus-ring); outline-offset: 3px; }
.es-range-scale {
  display: flex; justify-content: space-between; margin: 0 22px;
  font-family: var(--es-font-mono); font-size: 10px; color: var(--es-fg-muted);
}
@media (pointer: coarse) {
  .es-range-track { height: 12px; margin: 34px 24px; }
  .es-range-thumb::after { width: 32px; height: 32px; }
}

/* \u2500\u2500 Leadsheet editor (components/leadsheet-editor.js) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Bars in a wrapping grid (left-rule = the barline), each holding 1..n
   editable chord chips. The shared editor for ProgGenie & MIDIcurator. */
.es-ls { display: flex; flex-direction: column; gap: var(--es-space-3); }
.es-ls-toolbar { display: flex; flex-wrap: wrap; gap: var(--es-gap); align-items: center; }
/* Spreadsheet-style: a fixed column grid wide enough for any chord name.
   A bar spans one column per chord, so cells stay legible and bars align
   vertically; a 2-chord bar lines up with two 1-chord bars. */
.es-ls-bars { display: grid; grid-template-columns: repeat(auto-fill, 116px); gap: var(--es-space-2); align-items: stretch; justify-content: start; }
.es-ls-bar {
  display: flex; align-items: stretch; gap: var(--es-space-2);
  padding: var(--es-space-2);
  background: var(--es-bg-raised); min-width: 0;
  border-left: 2px solid var(--es-border-strong); border-radius: 0; /* the barline = the bar boundary */
}
.es-ls-bar > .es-ls-chord { flex: 1 1 0; min-width: 0; }            /* chords share the bar's columns */
.es-ls-bar > .es-ls-chord + .es-ls-chord { border-left: 1px solid var(--es-border-soft); } /* faint within-bar divider (adjacent chords) */
.es-ls-repeat { align-items: center; justify-content: center; color: var(--es-fg-muted); font-size: var(--es-text-lg); }
.es-ls-add { grid-column: span 1; }                                /* "+" and "+ bar" each own one column */
.es-ls-add:not(.bar) { align-self: center; }
.es-ls-chord {
  position: relative;
  display: flex; flex-direction: column; justify-content: center; gap: 1px;
  min-height: 44px; min-width: 0;
  padding: var(--es-space-1) var(--es-space-2);
  border: none;                                /* the barline belongs to the bar, not the chord */
  border-radius: 0; background: transparent; color: var(--es-fg); cursor: pointer;
  font-family: var(--es-font-sans); text-align: left;
}
.es-ls-chord:hover { background: var(--es-bg-sunken); }
/* A cell is a tap/press target, never selectable text \u2014 press-and-hold must
   not trigger native text selection or the iOS callout menu. */
.es-ls-chord, .es-ls-caret, .es-ls-repeat, .es-ls-grip, .es-ls-ghost-cell {
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
}
/* The whole cell lifts (press-and-hold on touch; grip on desktop) \u2014 show grab. */
.es-ls.editing .es-ls-chord { cursor: grab; touch-action: pan-y; }
.es-ls.editing .es-ls-chord:active { cursor: grabbing; }
.es-ls-chord.moving { cursor: grabbing; }
.es-ls-chord:focus-visible { outline: var(--es-focus-ring); outline-offset: 1px; }
.es-ls-name { font-size: 1.125rem; font-weight: 600; line-height: 1.1; white-space: nowrap; overflow: hidden; }
.es-ls-sub { display: flex; align-items: center; gap: var(--es-space-1); min-height: 1em; }
.es-ls-real { font-size: var(--es-text-sm); color: var(--es-fg-muted); font-family: var(--es-font-mono); }
/* Consonance: small inline dot, dark (dissonant) \u2192 bright (consonant) */
.es-ls-consonance { width: 6px; height: 6px; border-radius: 50%; flex: 0 0 auto; box-shadow: 0 0 0 1px rgba(0, 0, 0, .12); }

/* Rating: a tap in rate mode reinforces/weakens the move into a chord; the
   effect shows as a tint, not buttons. */
.es-ls-chord.rated-up { box-shadow: inset 0 -2px 0 hsl(140, 55%, 45%); }
.es-ls-chord.rated-down { box-shadow: inset 0 -2px 0 hsl(8, 60%, 52%); }
.es-ls-chord.selected { background: var(--es-bg-sunken); box-shadow: inset 0 0 0 1px var(--es-accent); }
.es-ls-chord.moving { opacity: .45; }

/* Insertion / move caret \u2014 the thin slot between chords *is* the insert point */
.es-ls-caret {
  flex: 0 0 auto; align-self: stretch; width: 16px; min-height: 44px;
  margin: 0 -3px; padding: 0; display: grid; place-items: center;
  border: 1px dashed transparent; border-radius: var(--es-radius-sm);
  background: transparent; color: var(--es-border-strong); cursor: pointer;
  font-size: var(--es-text-md); line-height: 1;
}
/* On touch the caret's hit box widens (the negative margins keep its FLOW
   width at 10px, so bars don't reflow) \u2014 the promised coarse-pointer hit
   zone; 32px box rather than the full 44 so taps near a chord's edge still
   land on the chord. */
@media (pointer: coarse) {
  .es-ls-caret { width: 32px; margin: 0 -11px; }
}
.es-ls-caret:hover, .es-ls-caret:focus-visible {
  border-color: var(--es-accent); color: var(--es-accent);
  background: color-mix(in oklch, var(--es-accent) 9%, transparent); outline: none;
}
.es-ls-caret.trail { grid-column: span 1; width: auto; min-width: 28px; margin: 0; }
.es-ls-caret.drop { border-color: var(--es-accent); color: var(--es-accent); background: color-mix(in oklch, var(--es-accent) 12%, transparent); }
.es-ls-bars.moving .es-ls-caret { border-style: dashed; }

/* Grip \u2014 pick a chord up to move (carets become drop targets) */
.es-ls-grip {
  position: absolute; top: 2px; right: 4px; line-height: 1;
  font-size: 11px; letter-spacing: -1px; color: var(--es-fg-muted); cursor: grab;
}
.es-ls-grip:hover { color: var(--es-accent); }

.es-ls-movebar { display: flex; align-items: center; gap: var(--es-space-2); font-size: var(--es-text-sm); color: var(--es-accent); }

/* Chord inspector \u2014 everything the cell defers, one chord at a time */
.es-ls-inspector {
  display: grid; gap: var(--es-space-2);
  padding: var(--es-space-3); border: 1px solid var(--es-border-strong);
  border-radius: var(--es-radius-md); background: var(--es-bg-raised);
}
.es-ls-insp-head { display: flex; align-items: center; justify-content: space-between; }
.es-ls-insp-title { font-size: var(--es-text-lg); font-weight: 600; }
.es-ls-insp-close { min-width: 0; padding: 2px 8px; }
.es-ls-insp-row { display: flex; align-items: center; gap: var(--es-space-2); flex-wrap: wrap; }
.es-ls-insp-label { width: 88px; flex: 0 0 auto; font-size: var(--es-text-sm); color: var(--es-fg-muted); }
.es-ls-insp-val { font-size: var(--es-text-sm); color: var(--es-fg-2); }
.es-ls-insp-val.mono { font-family: var(--es-font-mono); }
.es-ls-insp-stepper { display: flex; gap: 4px; }
.es-ls-insp-stepper .es-btn.on, .es-ls-insp-row .es-btn.on { border-color: var(--es-accent); background: var(--es-bg-sunken); }
.es-ls-insp-actions { display: flex; gap: var(--es-space-2); margin-top: var(--es-space-1); }
.es-ls-insp-del { margin-left: auto; color: var(--es-danger, #b3261e); border-color: var(--es-danger, #b3261e); }
.es-ls-input {
  min-height: var(--es-ctl-h); width: 6ch; padding: 2px var(--es-space-2);
  border: 1px solid var(--es-border-strong); border-radius: var(--es-radius-sm);
  background: var(--es-bg); color: var(--es-fg); font-family: var(--es-font-mono); font-size: var(--es-text-md);
}
.es-ls-add {
  min-width: 28px; min-height: var(--es-ctl-h); padding: 0 var(--es-space-2);
  border: 1px dashed var(--es-border-strong); border-radius: var(--es-radius-sm);
  background: transparent; color: var(--es-fg-muted); cursor: pointer; font-size: var(--es-text-md);
}
.es-ls-add:hover { color: var(--es-accent); border-color: var(--es-accent); }
.es-ls-add.bar { align-self: stretch; }

/* "+" picker: type a chord, or pick a voiceled next-chord suggestion */
.es-ls-suggest {
  position: relative; display: inline-flex; flex-direction: column; gap: var(--es-space-1);
  padding: var(--es-space-2); min-width: 13ch; z-index: 20;
  border: 1px solid var(--es-border-strong); border-radius: var(--es-radius-sm);
  background: var(--es-bg-raised, var(--es-bg)); box-shadow: var(--es-shadow-2, 0 4px 16px rgba(0,0,0,.18));
}
.es-ls-suggest .es-ls-input { width: 100%; }
.es-ls-suggest-list { display: flex; flex-direction: column; gap: 2px; max-height: 240px; overflow: auto; }
.es-ls-suggest-item {
  display: flex; align-items: center; justify-content: space-between; gap: var(--es-space-2);
  padding: 3px var(--es-space-2); border: 1px solid transparent; border-radius: var(--es-radius-sm);
  background: transparent; color: var(--es-fg); cursor: pointer; text-align: left; font-size: var(--es-text-sm);
}
.es-ls-suggest-item:hover { background: var(--es-bg-sunken); border-color: var(--es-border); }
.es-ls-suggest-item.played { border-color: var(--es-accent); }
.es-ls-suggest-sym { font-weight: 600; }

/* Chord-follow highlight on the leadsheet editor (playhead) */
.es-ls-chord.active { background: var(--es-accent); color: var(--es-accent-fg); }
.es-ls-chord.active .es-ls-real { color: var(--es-accent-fg); opacity: .8; }

/* Pad-grid sounding pad (Q5) \u2014 a pulsing accent ring during playback. */
.es-pg-now { stroke: var(--es-accent) !important; stroke-width: 3 !important; animation: es-pg-pulse 1.2s ease-out infinite; }
@keyframes es-pg-pulse { 0% { stroke-opacity: 1; } 100% { stroke-opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { .es-pg-now { animation: none; } }
/* The chord-scale grid in the inspector + its layout toggle and legend. */
.es-ls-insp-grid { display: flex; flex-direction: column; align-items: flex-start; gap: var(--es-space-2); width: 100%; }
.es-ls-grid-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: var(--es-text-xs); color: var(--es-fg-2); }
.es-ls-grid-legend span { display: inline-flex; align-items: center; gap: 4px; }

/* Motion overlay (Q4) \u2014 texture-first markers in the gap before a chord.
   \u219D arrow = a fifth (cadence), underline = a step. Greyscale-legible; colour
   (slide / expr, \u22653:1 on paper and warm-dark) only reinforces. */
.es-ls-motion { position: absolute; pointer-events: none; }
.es-ls-motion.fifth {
  left: -10px; top: 50%; transform: translateY(-50%);
  font-size: 13px; font-weight: 600; line-height: 1; color: var(--es-dim-slide);
}
.es-ls-motion.step {
  left: 3px; right: 3px; bottom: 1px; height: 0;
  border-bottom: 2px solid var(--es-dim-expr);
}

/* The write cursor (Q1) \u2014 a blinking caret marking where the next played /
   inserted chord lands. Tap any caret to re-aim it. */
.es-ls-caret.cursor {
  border-color: var(--es-accent); color: var(--es-accent);
  background: color-mix(in oklch, var(--es-accent) 16%, transparent);
  animation: es-ls-cursor-blink 1.1s steps(2, start) infinite;
}
@keyframes es-ls-cursor-blink { 50% { opacity: 0.4; } }
@media (prefers-reduced-motion: reduce) { .es-ls-caret.cursor { animation: none; } }

/* The inline ghost cell \u2014 the held live-MIDI chord at the cursor (compact:
   chord + \u2713 add + \u25B8 options + \u2715). Options expand in .es-ls-ghost-opts below. */
.es-ls-ghost-cell {
  display: inline-flex; align-items: center; gap: 4px; align-self: center;
  padding: 2px 5px; border: 1px dashed var(--es-accent); border-radius: var(--es-radius-sm);
  background: color-mix(in oklch, var(--es-accent) 8%, transparent);
}
.es-ls-ghost-label { font-family: var(--es-font-sans); font-weight: 600; color: var(--es-accent); white-space: nowrap; }
.es-ls-ghost-cell .es-btn { padding: 0 5px; min-height: 24px; }
.es-ls-ghost-opts { display: flex; flex-direction: column; gap: 4px; margin-top: var(--es-space-2); }
.es-ls-ghost-opts .es-btn { justify-content: flex-start; text-align: left; }
.es-ls-ghost-detail { color: var(--es-fg-muted); font-family: var(--es-font-mono); font-size: var(--es-text-xs); }

/* Ghost chip \u2014 live MIDI writes into the document at the write cursor.
   A pending, dashed cell sitting just below the sheet; Add commits it. */
.es-ls-ghost {
  margin-top: var(--es-space-3);
  padding: var(--es-space-2) var(--es-space-3);
  border: 1px dashed var(--es-accent);
  border-radius: var(--es-radius-sm);
  background: var(--es-bg-raised);
}
.es-ls-ghost-chip {
  display: inline-flex; align-items: baseline;
  padding: var(--es-space-1) var(--es-space-2);
  border: 1px dashed var(--es-border-strong); border-radius: var(--es-radius-sm);
  background: var(--es-bg-sunken); font-family: var(--es-font-sans);
}
.es-ls-ghost-chip strong { font-size: 1.125rem; }

/* MIDI status line \u2014 routing + what's latched; the building happens at the
   ghost chip, not here. */
.es-statusline {
  display: flex; align-items: center; gap: var(--es-space-2); flex-wrap: wrap;
  padding: var(--es-space-2) var(--es-space-3);
  border: 1px solid var(--es-border); border-radius: var(--es-radius-md);
  background: var(--es-bg-raised);
}

/* Multi-section editor (Q2) \u2014 section headers + a quiet key-change divider. */
.es-ls-section + .es-ls-section { margin-top: var(--es-space-2); }
.es-ls-secthead { display: flex; align-items: center; gap: var(--es-space-2); margin-bottom: var(--es-space-2); flex-wrap: wrap; }
.es-ls-sectbadge {
  font-family: var(--es-font-mono); font-weight: 700; font-size: var(--es-text-sm);
  width: 26px; height: 26px; border-radius: 7px; flex: none;
  display: grid; place-items: center;
  background: var(--es-fg); color: var(--es-bg-raised);
}
.es-ls-sectname { font-size: var(--es-text-sm); color: var(--es-fg-muted); }
.es-ls-sectkey { width: auto; }
.es-ls-sectkey-label {
  font-family: var(--es-font-mono); font-size: var(--es-text-sm); color: var(--es-fg-2);
  padding: 2px 8px; border: 1px solid var(--es-border-strong); border-radius: var(--es-radius-sm);
}
/* Implied modulation (design B, subtle) \u2014 a quiet per-chord key tag + a faint
   tint under the span; no divider, no line split, can start mid-bar. */
.es-ls-chord.in-keyarea { box-shadow: inset 0 -2px 0 color-mix(in oklch, var(--es-accent) 35%, transparent); }
.es-ls-keymark {
  position: absolute; top: -7px; left: 4px;
  font-family: var(--es-font-mono); font-size: 9px; font-weight: 600; line-height: 1;
  padding: 1px 4px; border-radius: 999px;
  background: var(--es-accent); color: var(--es-accent-fg); letter-spacing: 0.02em;
}

/* The key-change seam \u2014 one quiet pill, never re-stated on every chord. */
.es-ls-kchange { display: flex; align-items: center; gap: var(--es-space-2); margin: var(--es-space-2) 0; }
.es-ls-kchange-ln { height: 1px; flex: 1; background: var(--es-border-strong); }
.es-ls-kchange-pill {
  font-family: var(--es-font-mono); font-size: var(--es-text-sm); font-weight: 600;
  padding: 3px 10px; border-radius: 999px; white-space: nowrap;
  border: 1px dashed var(--es-border-strong); color: var(--es-fg-2); background: var(--es-bg-raised);
}

/* \u2500\u2500 Runtime provenance & gating \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The suite ships one UI into three deployments: a standalone webapp, a
   desktop plugin, and an iPad AUv3. Some controls only make sense in one
   context. Three orthogonal gates mark them, and runtime code toggles
   [hidden] on the gate:

     [data-feat="web"]         web-only FEATURES   (pattern DB, Web Audio)
     [data-feat="host"]        plugin-only panels  (host sync, automation)
     [data-chrome="standalone"] webapp-only CHROME (this block)

   "Standalone chrome" is the surface for controls a plugin host normally
   owns \u2014 MIDI/audio device routing, the app's own transport \u2014 that a
   webapp with no host must supply itself. It is the complement of
   [data-feat="host"]: where there is no host, this appears. Instance #1
   is the MIDI device selectors below; pin .es-device-bar inside an
   .es-section at the top of the control rail. */
[data-chrome][hidden],
[data-feat][hidden] { display: none !important; }

/* Provenance badge: rides a section summary to label where a control
   comes from. Colour pairs with the word \u2014 never identifies alone. */
.feat-badge {
  font-family: var(--es-font-mono);
  font-size: 9px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  margin-left: auto;
}
/* Badge TEXT is a darkened take on each dimension hue (a11y pass): the raw
   dim colours sit ~3:1 on their own tints \u2014 under AA for 9px text. Same hue
   family, deepened until \u22654.5:1 on the tint. Dark theme reverts to the raw
   hues (they clear 4.5:1 on the dark mixes). */
.feat-badge.web { background: var(--es-dim-breath-tint); color: #2b619f; }
.feat-badge.host { background: var(--es-dim-pressure-tint); color: #8a561d; }
.feat-badge.standalone { background: var(--es-dim-slide-tint); color: #71407f; }
[data-theme="dark"] .feat-badge.web { background: color-mix(in oklab, var(--es-dim-breath) 24%, transparent); color: #8db9ea; }
[data-theme="dark"] .feat-badge.host { background: color-mix(in oklab, var(--es-dim-pressure) 26%, transparent); color: #e9a95e; }
[data-theme="dark"] .feat-badge.standalone { background: color-mix(in oklab, var(--es-dim-slide) 26%, transparent); color: #cf9ce2; }

/* \u2500\u2500 Standalone chrome: device selectors \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   .es-device-bar  \u2014 a stack of device endpoints (the surface)
   .es-device-select \u2014 one labelled endpoint: head (icon \xB7 name \xB7 status)
                       over a <select>, with a connection state.
   States carried on [data-state]:  connected | empty
   The status LED always rides with a word (no colour-only signalling),
   and the empty state replaces the <select> with a clear message. */
.es-device-bar {
  display: flex;
  flex-direction: column;
  gap: var(--es-space-3);
}

.es-device-select {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.es-device-select-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--es-fg-muted);
}
.es-device-icon {
  width: 15px;
  height: 15px;
  flex: none;
  color: var(--es-fg-2);
  display: inline-flex;
}
.es-device-icon svg { width: 100%; height: 100%; display: block; }
.es-device-name { white-space: nowrap; }

/* connection status \u2014 LED + word, right-aligned, never colour alone */
.es-device-status {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--es-text-xs);
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: none;
  color: var(--es-fg-muted);
}
.es-device-led {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
  background: var(--es-border-strong);
}
.es-device-select[data-state="connected"] .es-device-status { color: var(--es-dim-expr); }
.es-device-select[data-state="connected"] .es-device-led { background: var(--es-dim-expr); }

.es-device-select select.es-control { width: 100%; }

/* empty state \u2014 replaces the <select> when no devices are present */
.es-device-empty {
  min-height: var(--es-ctl-h);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 var(--es-space-3);
  border: 1px dashed var(--es-border-strong);
  border-radius: var(--es-radius-sm);
  background: var(--es-bg-sunken);
  color: var(--es-fg-muted);
  font-size: var(--es-text-sm);
}
.es-device-select[data-state="empty"] select.es-control { display: none; }
.es-device-select:not([data-state="empty"]) .es-device-empty { display: none; }

/* \u2500\u2500 The shared frame (consistency pass, 2026-07) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   One frame for all ten apps: a chrome bar with named slots \u2014 brand
   (left) \xB7 optional transport (center, host-owned in plugins) \xB7 the
   global-controls cluster (right). The cluster order is fixed
   everywhere: theme \xB7 MIDI \xB7 density \xB7 Library. Stable identities:
   #theme-toggle #midi-chip #density-toggle #library-toggle. The
   Library slot opens the LibraryBrowser below (Design pass \xB7 Q2) \u2014 the
   two design efforts converged on that one surface; this block is only
   the surrounding chrome (bar, cluster, popover), not a competing
   saved-item pattern.
   Spec: the "Shared Frame \u2014 Consistency Pass" design document. */

.es-shellbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; min-height: 52px;
  padding: 8px 14px; background: var(--es-bg-raised);
  border-bottom: 1px solid var(--es-border);
}
.es-shellbar .brand { display: flex; align-items: center; gap: 9px; min-width: 0; }
.es-shellbar .brand img { width: 26px; height: 26px; border-radius: 7px; }
.es-shellbar .brand .nm { font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; }
.es-shellbar .brand .k { font-size: var(--es-text-xs); color: var(--es-fg-muted); white-space: nowrap; }
.es-shellbar .mid { flex: 1 1 auto; display: flex; justify-content: center; min-width: 0; }

/* THE global-controls cluster \u2014 same order, every app:
   theme \xB7 MIDI \xB7 density \xB7 Library. Wraps (never clips) when the host rail
   is too narrow for all four in one row \u2014 every control stays reachable;
   see .mc-sidebar-header / .topbar for the sidebar-header wrap partner. */
.es-cluster { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex: none; }
.es-cluster .es-btn { display: inline-flex; align-items: center; gap: 7px;
  font-size: var(--es-text-sm); font-weight: 500; white-space: nowrap; cursor: pointer; }
.es-cluster .glyph { font-size: 13px; line-height: 1; }

/* archetype D \u2014 chrome-less canvas gets a floating cluster */
.es-float-bar {
  position: absolute; top: 12px; right: 12px; z-index: 5;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: var(--es-radius-md);
  background: color-mix(in oklab, var(--es-bg-raised) 88%, transparent);
  border: 1px solid var(--es-border); box-shadow: var(--es-shadow);
  backdrop-filter: blur(8px);
}

/* MIDI status chip (cluster slot 2) \u2014 LED always rides with the word */
.midi-led { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--es-border-strong); }
.midi-chip[data-state="connected"] .midi-led { background: var(--es-dim-expr); }
.midi-chip[data-state="unavailable"] .midi-led { background: var(--es-danger); }
.midi-chip svg { flex: none; }

/* Library chip counter (cluster slot 4) */
.lib-count-badge { font-family: var(--es-font-mono); font-size: 10px; padding: 0 5px;
  border-radius: 999px; background: var(--es-border); color: var(--es-fg-2); }

/* popover (the MIDI panel's home off the chip) */
.pop-anchor { position: relative; }
.es-popover {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 50; width: 300px;
  background: var(--es-bg-raised); border: 1px solid var(--es-border-strong);
  border-radius: var(--es-radius-md); box-shadow: 0 14px 40px rgba(28,25,20,0.16);
  padding: var(--es-space-3);
}
[data-theme="dark"] .es-popover { box-shadow: 0 14px 40px rgba(0,0,0,0.5); }
.es-popover .pop-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.es-popover .pop-head .es-eyebrow { flex: 1; }

/* \u2500\u2500 LibraryBrowser (Design pass \xB7 Q2) \u2014 the one library-browser pattern.
   Config-driven; scales by count (facet rail hides below the threshold).
   createLibraryBrowser(el, { items, facets, \u2026 }) in components/library-browser.js */
.lib { flex: 1; min-height: 0; display: grid; grid-template-columns: 232px 1fr; }
.lib.no-facets { grid-template-columns: 1fr; }

.lib-facets { border-right: 1px solid var(--es-border); background: var(--es-bg-raised);
  overflow: auto; padding: 12px 12px 24px; }
.facet-search-hint { font-size: 11px; color: var(--es-fg-muted); margin: 0 2px 10px; line-height: 1.4; }
.facet-group { margin-bottom: 6px; }
.facet-group > summary {
  list-style: none; cursor: pointer; display: flex; align-items: center; gap: 6px;
  font-size: 10px; letter-spacing: 0.13em; text-transform: uppercase; font-weight: 600;
  color: var(--es-fg-muted); padding: 8px 4px 6px;
}
.facet-group > summary::-webkit-details-marker { display: none; }
.facet-group > summary::before { content: "\u25B8"; font-size: 9px; transition: transform var(--es-motion-fast); color: var(--es-fg-muted); }
.facet-group[open] > summary::before { transform: rotate(90deg); }
.facet-group > summary:focus-visible { outline: var(--es-focus-ring); outline-offset: -2px; border-radius: 6px; }
.facet-row {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 5px 8px; border: 0; background: transparent; cursor: pointer;
  border-radius: 7px; text-align: left; color: var(--es-fg-2); font-size: var(--es-text-sm);
}
.facet-row:hover { background: var(--es-bg-sunken); }
.facet-row .box {
  width: 15px; height: 15px; flex: none; border: 1.5px solid var(--es-border-strong);
  border-radius: 4px; display: inline-flex; align-items: center; justify-content: center;
  color: var(--es-accent-fg); font-size: 11px;
}
.facet-row[aria-pressed="true"] .box { background: var(--es-accent); border-color: var(--es-accent); }
.facet-row[aria-pressed="true"] { color: var(--es-fg); font-weight: 500; }
.facet-row .lbl { flex: 1; display: flex; align-items: center; gap: 7px; min-width: 0; }
.facet-row .lbl .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.facet-row .cnt { font-family: var(--es-font-mono); font-size: 11px; color: var(--es-fg-muted); font-variant-numeric: tabular-nums; }
.facet-row:disabled { opacity: 0.4; cursor: default; }
.facet-row:disabled:hover { background: transparent; }
.facet-row:focus-visible { outline: var(--es-focus-ring); outline-offset: -2px; }

.lib-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.lib-toolbar { flex: none; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 12px 16px; border-bottom: 1px solid var(--es-border-soft); }
.lib-title { font-weight: 600; font-size: var(--es-text-lg); letter-spacing: -0.01em; }
.lib-count { font-family: var(--es-font-mono); font-size: 11px; color: var(--es-fg-muted);
  font-variant-numeric: tabular-nums; }

.search-wrap { position: relative; flex: 1 1 260px; min-width: 180px; }
.search-input {
  width: 100%; height: 34px; padding: 0 32px 0 32px; border-radius: var(--es-radius-sm);
  border: 1px solid var(--es-border-strong); background: var(--es-bg-sunken); color: var(--es-fg);
  font-family: inherit; font-size: var(--es-text-md);
}
.search-input:focus-visible { outline: var(--es-focus-ring); outline-offset: 1px; }
.search-input::-webkit-search-cancel-button { display: none; }
.search-wrap .ico { position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  width: 15px; height: 15px; color: var(--es-fg-muted); pointer-events: none; }
.search-wrap .ico svg { width: 100%; height: 100%; }
.search-wrap .clr { position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  width: 22px; height: 22px; border: 0; background: transparent; color: var(--es-fg-muted);
  cursor: pointer; border-radius: 6px; font-size: 15px; }
.search-wrap .clr:hover { background: var(--es-border); color: var(--es-fg); }
.ac-menu {
  position: absolute; z-index: 40; top: calc(100% + 5px); left: 0; right: 0;
  background: var(--es-bg-raised); border: 1px solid var(--es-border-strong);
  border-radius: var(--es-radius-md); box-shadow: var(--es-shadow); overflow: hidden; padding: 5px;
}
.ac-sec { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--es-fg-muted);
  font-weight: 600; padding: 8px 10px 4px; }
.ac-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 8px;
  cursor: pointer; font-size: var(--es-text-sm); color: var(--es-fg-2); }
.ac-item .cnt { margin-left: auto; font-family: var(--es-font-mono); font-size: 11px; color: var(--es-fg-muted); }
.ac-item.active, .ac-item:hover { background: var(--es-bg-sunken); color: var(--es-fg); }
.ac-item mark { background: var(--es-dim-bend-tint); color: var(--es-fg); border-radius: 3px; padding: 0 1px; }
:root[data-theme="dark"] .ac-item mark { background: color-mix(in oklab, var(--es-dim-bend) 30%, transparent); }

.sort-sel { height: 34px; border-radius: var(--es-radius-sm); border: 1px solid var(--es-border-strong);
  background: var(--es-bg-raised); color: var(--es-fg); font-family: inherit; font-size: var(--es-text-sm);
  padding: 0 8px; cursor: pointer; }
.sort-sel:focus-visible { outline: var(--es-focus-ring); outline-offset: 1px; }

.front-doors { display: inline-flex; gap: 7px; }
.fd {
  display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px;
  border: 1px solid var(--es-border-strong); border-radius: var(--es-radius-sm);
  background: var(--es-bg-raised); color: var(--es-fg); font-size: var(--es-text-sm);
  font-weight: 600; cursor: pointer; white-space: nowrap;
}
.fd:hover { background: var(--es-bg-sunken); }
.fd.primary { background: var(--es-accent); color: var(--es-accent-fg); border-color: var(--es-accent); }
.fd.primary:hover { filter: brightness(0.96); background: var(--es-accent); }
.fd:focus-visible { outline: var(--es-focus-ring); outline-offset: 2px; }
.fd svg { width: 15px; height: 15px; }

.chips-row { flex: none; display: flex; flex-wrap: wrap; gap: 7px; align-items: center;
  padding: 10px 16px; border-bottom: 1px solid var(--es-border-soft); }
.chips-row:empty { display: none; }
.fchip {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 6px 3px 10px;
  border-radius: 999px; background: var(--es-bg-sunken); border: 1px solid var(--es-border);
  font-size: var(--es-text-sm); color: var(--es-fg-2);
}
.fchip .k { color: var(--es-fg-muted); font-size: 11px; }
.fchip button { border: 0; background: transparent; color: var(--es-fg-muted); cursor: pointer;
  width: 18px; height: 18px; border-radius: 50%; font-size: 13px; line-height: 1; }
.fchip button:hover { background: var(--es-border); color: var(--es-fg); }
.chips-clear { border: 0; background: transparent; color: var(--es-accent); font-size: var(--es-text-sm);
  cursor: pointer; font-weight: 500; padding: 4px 6px; }
.chips-clear:hover { text-decoration: underline; }

.lib-list { flex: 1 1 auto; overflow: auto; padding: 6px 8px 20px; }
.lib-row {
  display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 12px;
  padding: 9px 10px; border-radius: var(--es-radius-sm); cursor: default;
  border: 1px solid transparent;
}
.lib.no-fav .lib-row { grid-template-columns: 1fr auto; }
.lib-row:hover { background: var(--es-bg-raised); border-color: var(--es-border-soft); }
.lib-row.sel { background: var(--es-bg-raised); border-color: var(--es-border); }
.fav-btn { width: 24px; height: 24px; border: 0; background: transparent; cursor: pointer;
  color: var(--es-border-strong); font-size: 16px; border-radius: 6px; line-height: 1; }
.fav-btn:hover { background: var(--es-bg-sunken); }
.fav-btn[aria-pressed="true"] { color: var(--es-dim-bend); }
.fav-btn:focus-visible { outline: var(--es-focus-ring); outline-offset: 1px; }
.row-main { min-width: 0; }
.row-name { font-size: var(--es-text-md); font-weight: 500; letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-name input { font: inherit; font-weight: 500; width: 100%; border: 1px solid var(--es-accent);
  border-radius: 6px; padding: 2px 6px; background: var(--es-bg); color: var(--es-fg); }
.row-meta { display: flex; align-items: center; gap: 10px; margin-top: 3px; flex-wrap: wrap; }
.cat-badge { font-size: var(--es-text-xs); font-weight: 600; padding: 1px 8px; border-radius: 999px;
  background: var(--es-bg-sunken); border: 1px solid var(--es-border); color: var(--es-fg-2); }
.dims { display: inline-flex; align-items: center; gap: 6px; }
.dim-pip { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--es-fg-muted); }
.dim-pip .es-dot { width: 8px; height: 8px; }
.row-tags { display: inline-flex; gap: 5px; flex-wrap: wrap; }
.row-tag { font-size: 11px; color: var(--es-fg-muted); }
.row-tag::before { content: "#"; opacity: 0.5; }
.row-submeta { font-size: 11px; color: var(--es-fg-muted); font-family: var(--es-font-mono);
  font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-date { font-family: var(--es-font-mono); font-size: 11px; color: var(--es-fg-muted); }
.row-stars { color: var(--es-dim-bend); font-size: 12px; letter-spacing: 1px; }
.row-stars .off { color: var(--es-border-strong); }
.row-right { display: flex; align-items: center; gap: 10px; }
.src-tag { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600;
  color: var(--es-fg-muted); }
.row-actions { position: relative; }
.kebab { width: 30px; height: 30px; border: 1px solid transparent; background: transparent;
  border-radius: 7px; cursor: pointer; color: var(--es-fg-muted); font-size: 17px; line-height: 1;
  opacity: 0; }
.lib-row:hover .kebab, .kebab[aria-expanded="true"] { opacity: 1; }
.kebab:hover { background: var(--es-bg-sunken); color: var(--es-fg); border-color: var(--es-border); }
.kebab:focus-visible { opacity: 1; outline: var(--es-focus-ring); outline-offset: 1px; }
.menu {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 30; min-width: 168px;
  background: var(--es-bg-raised); border: 1px solid var(--es-border-strong);
  border-radius: var(--es-radius-md); box-shadow: var(--es-shadow); padding: 5px;
}
.menu button { display: flex; align-items: center; gap: 10px; width: 100%; border: 0;
  background: transparent; color: var(--es-fg); font-size: var(--es-text-sm); padding: 8px 10px;
  border-radius: 7px; cursor: pointer; text-align: left; }
.menu button:hover { background: var(--es-bg-sunken); }
.menu button.danger { color: var(--es-danger); }
.menu button.danger:hover { background: color-mix(in oklab, var(--es-danger) 12%, var(--es-bg-raised)); }
.menu .sep { height: 1px; background: var(--es-border-soft); margin: 4px 2px; }
.menu button svg { width: 15px; height: 15px; flex: none; opacity: 0.75; }

.empty { padding: 40px 24px; text-align: center; color: var(--es-fg-muted); max-width: 520px; margin: 0 auto; }
.empty .em-title { font-family: var(--es-font-serif); font-style: italic; font-size: 1.5rem; color: var(--es-fg-2); }
.empty p { line-height: 1.5; text-wrap: pretty; }
.suggest {
  margin: 4px 16px 14px; padding: 12px 14px; border: 1px solid var(--es-border);
  border-radius: var(--es-radius-md); background: var(--es-bg-raised);
}
.suggest[hidden] { display: none; }
.suggest .sg-head { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
  font-weight: 600; color: var(--es-fg-muted); margin-bottom: 8px; display: flex; align-items: center; gap: 7px; }
.suggest .sg-items { display: flex; gap: 8px; flex-wrap: wrap; }
.sg-item { display: inline-flex; align-items: center; gap: 7px; padding: 6px 10px; border-radius: 999px;
  border: 1px solid var(--es-border-strong); background: var(--es-bg); font-size: var(--es-text-sm);
  cursor: pointer; color: var(--es-fg-2); }
.sg-item:hover { background: var(--es-bg-sunken); color: var(--es-fg); }
.sg-item .es-dot { width: 8px; height: 8px; }

/* \u2500\u2500 Toast \u2014 the ONE destructive-action idiom (Design pass \xB7 Q4).
   toast(text, { undo }) in components/toast.js */
.toasts { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 90;
  display: flex; flex-direction: column; gap: 8px; align-items: center; }
.toast {
  display: flex; align-items: center; gap: 14px; padding: 10px 12px 10px 15px;
  background: var(--es-fg); color: var(--es-bg); border-radius: var(--es-radius-sm);
  box-shadow: 0 10px 30px rgba(28,25,20,0.22); font-size: var(--es-text-sm); max-width: 460px;
  animation: toast-in var(--es-motion-base);
}
@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.toast .undo { border: 1px solid color-mix(in oklab, var(--es-bg) 45%, transparent); background: transparent;
  color: var(--es-bg); font-weight: 600; font-size: var(--es-text-sm); padding: 5px 12px;
  border-radius: 7px; cursor: pointer; }
.toast .undo:hover { background: color-mix(in oklab, var(--es-bg) 18%, transparent); }
.toast .x { border: 0; background: transparent; color: color-mix(in oklab, var(--es-bg) 65%, transparent);
  cursor: pointer; font-size: 15px; width: 22px; height: 22px; border-radius: 5px; }
.toast .x:hover { color: var(--es-bg); }
.toast .ttext b { font-weight: 600; }

/* LibraryBrowser \xB7 compact \u2014 narrow rails (Serpe/MIDIcurator sidebars):
   single column; facets collapse into a bar above the list. */
.lib.compact { display: block; overflow: auto; flex: none; max-height: 480px; min-height: 0; }
.lib.compact .lib-main { height: auto; }
.lib.compact .lib-toolbar { padding: 8px 4px; gap: 7px; }
.lib.compact .lib-title { font-size: var(--es-text-md); }
.lib.compact .search-wrap { flex: 1 1 140px; min-width: 120px; }
.lib.compact .lib-list { overflow: visible; padding: 4px 0 8px; }
.lib.compact .lib-row { grid-template-columns: 1fr auto; gap: 8px; padding: 6px 8px; }
.lib.compact.no-fav .lib-row { grid-template-columns: 1fr auto; }
.lib.compact .kebab { opacity: 1; width: 26px; height: 26px; font-size: 15px; }
.lib.compact .chips-row { padding: 6px 2px; }
.lib-filters { border: 1px solid var(--es-border); border-radius: var(--es-radius-sm);
  background: var(--es-bg-raised); margin-bottom: 8px; }
.lib-filters > summary {
  list-style: none; cursor: pointer; padding: 8px 12px; font-size: 10px;
  letter-spacing: 0.13em; text-transform: uppercase; font-weight: 600; color: var(--es-fg-muted);
  display: flex; align-items: center; gap: 6px;
}
.lib-filters > summary::-webkit-details-marker { display: none; }
.lib-filters > summary::before { content: "\u25B8"; font-size: 9px; transition: transform var(--es-motion-fast); }
.lib-filters[open] > summary::before { transform: rotate(90deg); }
.lib-filters > summary:focus-visible { outline: var(--es-focus-ring); outline-offset: -2px; border-radius: 6px; }
.lib-filters-body { padding: 2px 10px 10px; }
.lib-filters-body .facet-search-hint { display: none; }
`;var Ee=`/* Suite Workspace \u2014 floating movable modules over the design tokens. */
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  font-family: var(--es-font-sans, system-ui, sans-serif);
  background: var(--es-bg, #f7f5f0);
  color: var(--es-fg, #26231d);
  overflow: hidden;
}

.ws-topbar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--es-border, #d8d2c6);
  background: var(--es-bg-raised, #fff);
  position: relative; z-index: 10;
}
.ws-brand { font-weight: 700; letter-spacing: .01em; }
.ws-tagline { color: var(--es-fg-muted, #6b6559); font-size: 13px; margin-right: auto; }

.ws-canvas { position: relative; width: 100%; height: calc(100% - 52px); overflow: auto; }

.ws-module {
  position: absolute; min-width: 260px; max-width: 380px;
  background: var(--es-bg-raised, #fff);
  border: 1px solid var(--es-border, #d8d2c6);
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,.08);
}
.ws-module.dragging { box-shadow: 0 8px 24px rgba(0,0,0,.18); opacity: .97; }
.ws-head {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--es-border-soft, #e7e2d8);
  touch-action: none; user-select: none;
}
.ws-title { font-weight: 600; font-size: 13px; margin-right: auto; }
.ws-x {
  border: none; background: transparent; color: var(--es-fg-muted, #6b6559);
  cursor: pointer; font-size: 13px; line-height: 1; padding: 4px 6px; border-radius: 6px;
}
.ws-x:hover { background: var(--es-bg-sunken, #efeadf); color: var(--es-danger, #b3402e); }
.ws-body { padding: 12px; display: flex; flex-direction: column; gap: 10px; }

.ws-row { display: flex; align-items: center; gap: 8px; }
.ws-label { color: var(--es-fg-muted, #6b6559); font-size: 12px; }
.ws-select, .ws-text, .ws-btn {
  font: inherit; font-size: 13px;
  border: 1px solid var(--es-border, #d8d2c6);
  border-radius: 7px; background: var(--es-bg, #f7f5f0); color: inherit;
  padding: 5px 8px; min-height: var(--es-ctl-h, 30px);
}
.ws-text { flex: 1; font-family: var(--es-font-mono, ui-monospace, monospace); }
.ws-btn { cursor: pointer; background: var(--es-accent, #3a6ea5); color: var(--es-accent-fg, #fff); border-color: transparent; }
.ws-btn.ghost { background: transparent; color: var(--es-fg-muted, #6b6559); border-color: var(--es-border, #d8d2c6); }
.ws-btn:hover { filter: brightness(1.05); }
.ws-btn:focus-visible, .ws-slider:focus-visible, .ws-select:focus-visible, .ws-text:focus-visible {
  outline: 2px solid var(--es-focus-ring, #3a6ea5); outline-offset: 2px;
}

.ws-controls { display: flex; flex-direction: column; gap: 7px; max-height: 300px; overflow-y: auto; }
.ws-param { display: grid; grid-template-columns: 96px 1fr 68px; align-items: center; gap: 8px; }
.ws-param-name { font-size: 12px; color: var(--es-fg-muted, #6b6559); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-slider { width: 100%; accent-color: var(--es-accent, #3a6ea5); }
.ws-readout { font-family: var(--es-font-mono, ui-monospace, monospace); font-size: 12px; text-align: right; color: var(--es-fg, #26231d); }
.ws-cmds { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }

.ws-lane { display: flex; gap: 3px; flex-wrap: wrap; }
.ws-step { width: 14px; height: 14px; border-radius: 3px; background: var(--es-bg-sunken, #efeadf); border: 1px solid var(--es-border, #d8d2c6); }
.ws-step.on { background: var(--es-accent, #3a6ea5); border-color: transparent; }

.ws-log { font-family: var(--es-font-mono, ui-monospace, monospace); font-size: 11.5px;
  max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.ws-logline { padding: 3px 0; line-height: 1.45; border-bottom: 1px dotted var(--es-border-soft, #e7e2d8);
  white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
`;var Y="enkerli.workspace.v1";function bt(){let t=document.createElement("style");t.textContent=[Ae,$e,Ee].join(`
`),document.head.append(t)}function ht(){bt();let t=new D({channelName:"enkerli-workspace"}),e=u("div",{class:"ws-canvas"}),r=xt(),n=r.seq??0,a=new Map,s={bus:t,save:d};function d(){yt({seq:n,modules:[...a.values()].map(i=>i.def)})}function p(i,l={}){let f=H[i];if(!f)return;let b=l.id??`m${++n}`,m={id:b,type:i,app:l.app,upi:l.upi,x:l.x??24+a.size*28%240,y:l.y??24+a.size*24%200},v=u("div",{class:"ws-body"}),g=u("section",{class:"ws-module",style:`left:${m.x}px; top:${m.y}px`,"aria-label":f.title},u("header",{class:"ws-head"},u("span",{class:"ws-title",text:f.title}),u("button",{class:"ws-x",text:"\u2715",title:"Remove","aria-label":`Remove ${f.title}`,onclick:()=>c(b)})),v);e.append(g),vt(g,g.querySelector(".ws-head"),m,d);let h=f.make(s,v,m);a.set(b,{def:m,cleanup:h,panel:g}),d()}function c(i){let l=a.get(i);l&&(typeof l.cleanup=="function"&&l.cleanup(),l.panel.remove(),a.delete(i),d())}let o=u("select",{class:"ws-select","aria-label":"Add a module",onchange:()=>{o.value&&(p(o.value),o.value="")}},u("option",{value:"",text:"+ add module"}),...Object.entries(H).map(([i,l])=>u("option",{value:i,text:l.title})));if(document.body.append(u("header",{class:"ws-topbar"},u("span",{class:"ws-brand",text:"Suite Workspace"}),u("span",{class:"ws-tagline",text:"modules on one bus \u2014 drag to arrange"}),o,u("button",{class:"ws-btn ghost",text:"reset",title:"Clear layout",onclick:()=>{localStorage.removeItem(Y),location.reload()}})),e),r.modules&&r.modules.length)for(let i of r.modules)p(i.type,i);else p("control-surface",{app:"vane",x:24,y:24}),p("pattern",{x:360,y:24}),p("bindings",{x:360,y:300}),p("monitor",{x:24,y:300})}function vt(t,e,r,n){let a=0,s=0,d=0,p=0,c=!1;e.style.cursor="grab",e.addEventListener("pointerdown",i=>{i.target.closest(".ws-x")||(c=!0,a=i.clientX,s=i.clientY,d=r.x,p=r.y,e.setPointerCapture?.(i.pointerId),e.style.cursor="grabbing",t.classList.add("dragging"))}),e.addEventListener("pointermove",i=>{c&&(r.x=Math.max(0,d+(i.clientX-a)),r.y=Math.max(0,p+(i.clientY-s)),t.style.left=r.x+"px",t.style.top=r.y+"px")});let o=()=>{c&&(c=!1,e.style.cursor="grab",t.classList.remove("dragging"),n())};e.addEventListener("pointerup",o),e.addEventListener("pointercancel",o)}function xt(){try{return JSON.parse(localStorage.getItem(Y))||{}}catch{return{}}}function yt(t){try{localStorage.setItem(Y,JSON.stringify(t))}catch{}}typeof document<"u"&&ht();})();

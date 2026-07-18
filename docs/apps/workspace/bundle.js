(()=>{var Q=["proggenie","midicurator","serpe","vane","drawnqurve","pitchfold","exquisite-fingerings","pickpcs","chord-dictionary","external"];var Bt=["envelope","envelopeVersion","id","kind","format","formatVersion","title","app","savedAt","provenance"],dr=[...Bt,"creator","facets","tags","payload","payloadRef"];var ce="enkerli-suite",_t=1,zt=["scale","chord","progression","pattern","manifest","param","command","note"],Ge=["ratio","percent","count","semitone","cents","pc","pc-mask","rhythm-mask","bpm","ms","hz","db","bool","enum"],Ue=["set","report","observe"];function Ft(){return globalThis.crypto?.randomUUID?.()??`msg${Date.now().toString(36)}-${Math.floor(Math.random()*1e9).toString(36)}`}function qt(){return new Date().toISOString().replace(/\.\d{3}Z$/,"Z")}function W(t,e,n,r={}){return{protocol:ce,v:_t,id:r.id??Ft(),from:t,to:r.to??"*",sentAt:r.sentAt??qt(),type:e,body:n}}function Z(t,e,n={}){return W(t,"param",{mode:"set",...e},n)}function ee(t,e,n={}){return W(t,"command",e,n)}function He(t,e,n={}){return W(t,"note",e,n)}var Vt=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;function B(t){return typeof t=="object"&&t!==null&&!Array.isArray(t)}function Ke(t){let e=[],n=r=>e.push(r);if(!B(t))return{ok:!1,errors:["message: not an object"]};if(t.protocol!==ce&&n(`protocol: must be "${ce}"`),(!Number.isInteger(t.v)||t.v<1)&&n("v: integer \u2265 1 required"),(typeof t.id!="string"||t.id.length<8)&&n("id: string \u2265 8 chars required"),Q.includes(t.from)||n(`from: not in the app vocabulary (${String(t.from)})`),t.to!=="*"&&!Q.includes(t.to)&&n(`to: "*" or an app id required (${String(t.to)})`),(typeof t.sentAt!="string"||!Vt.test(t.sentAt))&&n("sentAt: absolute ISO 8601 required"),zt.includes(t.type)||n(`type: not a known message type (${String(t.type)})`),!B(t.body))n("body: object required");else{let r=t.body,a=(s,i)=>Number.isInteger(s)&&s>=0&&s<2**i;switch(t.type){case"scale":a(r.mask,12)||n("body.mask: 12-bit integer required (leftmost = LSB)"),r.root!==void 0&&!(Number.isInteger(r.root)&&r.root>=0&&r.root<=11)&&n("body.root: pitch class 0\u201311 required");break;case"chord":r.pcs!==void 0&&!a(r.pcs,12)&&n("body.pcs: 12-bit integer required"),r.notes!==void 0&&(!Array.isArray(r.notes)||r.notes.some(s=>!Number.isInteger(s)||s<0||s>127))&&n("body.notes: array of MIDI notes 0\u2013127 required"),r.pcs===void 0&&r.notes===void 0&&r.symbol===void 0&&n("body: chord needs at least one of pcs / notes / symbol");break;case"progression":B(r.prog)||n("body.prog: the canonical Progression object required");break;case"pattern":(!Number.isInteger(r.steps)||r.steps<1||r.steps>128)&&n("body.steps: integer 1\u2013128 required"),(!Number.isInteger(r.mask)||r.mask<0)&&n("body.mask: non-negative integer required (leftmost = LSB)");break;case"manifest":Wt(r,n);break;case"param":Gt(r,n);break;case"command":(typeof r.name!="string"||r.name.length===0)&&n("body.name: non-empty command name required"),r.args!==void 0&&!B(r.args)&&n("body.args: object of named arguments required");break;case"note":(!Array.isArray(r.notes)||r.notes.length===0||r.notes.some(s=>!Number.isInteger(s)||s<0||s>127))&&n("body.notes: non-empty array of MIDI notes 0\u2013127 required"),r.velocity!==void 0&&!(Number.isInteger(r.velocity)&&r.velocity>=0&&r.velocity<=127)&&n("body.velocity: integer 0\u2013127 required"),r.channel!==void 0&&!(Number.isInteger(r.channel)&&r.channel>=1&&r.channel<=16)&&n("body.channel: integer 1\u201316 required"),r.gate!==void 0&&r.gate!=="on"&&r.gate!=="off"&&n('body.gate: "on" or "off" required'),r.durationMs!==void 0&&!(typeof r.durationMs=="number"&&r.durationMs>0)&&n("body.durationMs: positive number required");break}}return{ok:e.length===0,errors:e}}var Ut=new Set(Ge);function We(t,e,n,r){if(!B(t)){n(`${e}: object required`);return}(typeof t[r]!="string"||t[r].length===0)&&n(`${e}.${r}: non-empty string required`),r==="id"&&t.label!==void 0&&typeof t.label!="string"&&n(`${e}.label: string required`),Ut.has(t.unit)||n(`${e}.unit: one of ${Ge.join("|")} required (${String(t.unit)})`);let a=["min","max","default"];for(let s of a)(typeof t[s]!="number"||!Number.isFinite(t[s]))&&n(`${e}.${s}: finite number required`);typeof t.min=="number"&&typeof t.max=="number"&&t.min>t.max&&n(`${e}: min must be \u2264 max`),typeof t.default=="number"&&typeof t.min=="number"&&typeof t.max=="number"&&(t.default<t.min||t.default>t.max)&&n(`${e}.default: must be within [min, max]`),t.step!==void 0&&(typeof t.step!="number"||t.step<=0)&&n(`${e}.step: positive number required`),t.scale!==void 0&&t.scale!=="linear"&&t.scale!=="log"&&n(`${e}.scale: "linear" or "log" required`),t.scale==="log"&&typeof t.min=="number"&&t.min<=0&&n(`${e}: log scale requires min > 0`),t.unit==="enum"&&(!Array.isArray(t.values)||t.values.length===0)&&n(`${e}: enum unit requires a non-empty values[]`)}function Wt(t,e){if(Q.includes(t.app)||e(`body.app: not in the app vocabulary (${String(t.app)})`),(!Number.isInteger(t.v)||t.v<1)&&e("body.v: integer \u2265 1 required"),!Array.isArray(t.params))e("body.params: array required");else{let n=new Set;t.params.forEach((r,a)=>{We(r,`body.params[${a}]`,e,"id");let s=B(r)?r.id:void 0;typeof s=="string"&&(n.has(s)&&e(`body.params[${a}].id: duplicate "${s}"`),n.add(s))})}Array.isArray(t.commands)?t.commands.forEach((n,r)=>{if(!B(n)){e(`body.commands[${r}]: object required`);return}(typeof n.name!="string"||n.name.length===0)&&e(`body.commands[${r}].name: non-empty string required`),typeof n.label!="string"&&e(`body.commands[${r}].label: string required`),n.args!==void 0&&(Array.isArray(n.args)?n.args.forEach((a,s)=>We(a,`body.commands[${r}].args[${s}]`,e,"id")):e(`body.commands[${r}].args: array required`))}):e("body.commands: array required")}function Gt(t,e){t.mode!==void 0&&!Ue.includes(t.mode)&&e(`body.mode: one of ${Ue.join("|")} required`);let n=t.id!==void 0,r=t.params!==void 0;n===r&&e("body: exactly one of single (id+value) or batch (params[]) required"),n&&((typeof t.id!="string"||t.id.length===0)&&e("body.id: non-empty string required"),(typeof t.value!="number"||!Number.isFinite(t.value))&&e("body.value: finite number required")),r&&(!Array.isArray(t.params)||t.params.length===0?e("body.params: non-empty array required"):t.params.forEach((a,s)=>{!B(a)||typeof a.id!="string"||a.id.length===0?e(`body.params[${s}].id: non-empty string required`):(typeof a.value!="number"||!Number.isFinite(a.value))&&e(`body.params[${s}].value: finite number required`)}))}var Ht=5e3,te=class extends EventTarget{constructor(e={}){super(),this.channel=null,this._seen=new Map,e.channelName&&typeof BroadcastChannel<"u"&&(this.channel=new BroadcastChannel(e.channelName),this.channel.onmessage=n=>this._deliver(n.data,!0))}publish(e){return Ke(e).ok?(this._deliver(e,!1),this.channel&&this.channel.postMessage(e),!0):!1}_deliver(e,n){let r=e&&e.id;if(r){let a=Date.now();if(this._seen.has(r))return;if(this._seen.set(r,a),this._seen.size>500)for(let[s,i]of this._seen)a-i>Ht&&this._seen.delete(s)}this.dispatchEvent(new CustomEvent("suitemessage",{detail:{msg:e,remote:n}}))}subscribe(e,n={}){let r=a=>{let{msg:s,remote:i}=a.detail;(!n.to||s.to==="*"||s.to===n.to)&&e(s,{remote:i})};return this.addEventListener("suitemessage",r),()=>this.removeEventListener("suitemessage",r)}close(){this.channel&&this.channel.close()}};function Kt(t){return t.param!==void 0}var Je={control:"ctrl",ctrl:"ctrl",option:"alt",alt:"alt",shift:"shift",cmd:"mod",command:"mod",meta:"mod",mod:"mod",super:"mod",win:"mod"},Ye=["mod","ctrl","alt","shift"];function Xe(t){let e=t.toLowerCase().split("+").map(a=>a.trim()).filter(Boolean),n=[],r="";for(let a of e)if(Je[a]){let s=Je[a];n.includes(s)||n.push(s)}else r=a;return n.sort((a,s)=>Ye.indexOf(a)-Ye.indexOf(s)),[...n,...r?[r]:[]].join("+")}function Qe(t,e){return{...t,bindings:[...t.bindings,e]}}function Ze(t,e){return{...t,bindings:t.bindings.filter((n,r)=>r!==e)}}var re=(t,e,n)=>Math.max(e,Math.min(n,t));function ne(t,e){let n=t;return e.step&&e.step>0&&(n=e.min+Math.round((n-e.min)/e.step)*e.step),re(n,e.min,e.max)}function de(t,e,n={}){let a=(1<<(n.bits??7))-1,s=re(t/a,0,1);if(n.curve==="toggle"||e.unit==="bool")return s>=.5?e.max:e.min;let u=(n.curve==="log"?"log":n.curve==="linear"?"linear":e.scale??"linear")==="log"&&e.min>0?e.min*Math.pow(e.max/e.min,s):e.min+s*(e.max-e.min);return ne(u,e)}function et(t,e,n={}){let a=(1<<(n.bits??7))-1,s=re(t,e.min,e.max);if(n.curve==="toggle"||e.unit==="bool")return s>=(e.min+e.max)/2?a:0;let u=(n.curve==="log"?"log":n.curve==="linear"?"linear":e.scale??"linear")==="log"&&e.min>0?Math.log(s/e.min)/Math.log(e.max/e.min):(s-e.min)/(e.max-e.min);return Math.round(re(u,0,1)*a)}function Jt(t){if(Array.isArray(t)){let e={};for(let n of t)e[n.app]=n;return e}return t}function Yt(t,e,n){return t[e]?.params.find(r=>r.id===n)}function Xt(t,e){return t.kind!==e.kind?!1:t.kind==="key"&&e.kind==="key"?Xe(t.combo)===Xe(e.combo):t.kind==="midi-cc"&&e.kind==="midi-cc"?t.cc===e.cc&&(t.channel===void 0||t.channel===e.channel):t.kind==="midi-note"&&e.kind==="midi-note"?t.note===e.note&&(t.channel===void 0||t.channel===e.channel):!1}var Qt=64;function Zt(t,e,n,r={}){let a=Jt(n),s=r.from??"external",i=[];for(let u of t.bindings){if(!Xt(u.trigger,e))continue;let d=u.action;if(Kt(d)){let o=Yt(a,d.app,d.param);if(!o)continue;let l;if(d.value!==void 0)l=ne(d.value,o);else if(e.kind==="midi-cc"){let p=u.trigger.kind==="midi-cc"?u.trigger.bits:void 0;l=de(e.value,o,{...p&&{bits:p},...d.curve&&{curve:d.curve}})}else e.kind,l=ne(o.default,o);i.push(Z(s,{mode:"set",id:d.param,value:l},{to:d.app}))}else{if(e.kind==="midi-cc"&&e.value<Qt||a[d.app]&&!a[d.app].commands.some(o=>o.name===d.command))continue;i.push(ee(s,{name:d.command,...d.args&&{args:d.args}},{to:d.app}))}}return i}function tt(t){let e=t.map;return{setMap(n){e=n},handle(n){let r=Zt(e,n,t.manifests,t.from!==void 0?{from:t.from}:{});if(t.send)for(let a of r)t.send(a);return r}}}var ue=14,nt=(1<<ue)-1;function rt(t,e){return de(Math.round(Math.max(0,Math.min(1,t))*nt),e,{bits:ue})}function at(t,e){return et(t,e,{bits:ue})/nt}function st(t,e,n,r){return Z(t,{mode:"set",id:n,value:r},{to:e})}function ot(t,e,n,r){return ee(t,{name:n,...r?{args:r}:{}},{to:e})}function pe(t,e){switch(t.unit){case"hz":return e>=1e3?(e/1e3).toFixed(2)+" kHz":Math.round(e)+" Hz";case"bpm":return Math.round(e)+" bpm";case"ms":return Math.round(e)+" ms";case"cents":return(e>0?"+":"")+Math.round(e)+" \xA2";case"count":return String(Math.round(e));case"percent":return Math.round(e)+" %";case"ratio":return e.toFixed(3);case"bool":return e>=.5?"on":"off";default:return String(e)}}function G(t,e,n=0){if(t>e&&(t=e),t<=0)return new Array(e).fill(0);let r=[],a=[],s=[],i=e-t;s[0]=t;let u=0;do a[u]=Math.floor(i/s[u]),s[u+1]=i%s[u],i=s[u],u++;while(s[u]>1);a[u]=i;function d(l){if(l===-1)r.push(0);else if(l===-2)r.push(1);else{for(let p=0;p<a[l];p++)d(l-1);s[l]!==0&&d(l-2)}}for(d(u);r.length<e;)r.push(0);let o=r.findIndex(l=>l);if(o>0&&(r=r.slice(o).concat(r.slice(0,o))),n!==0){n=(n%e+e)%e;let l=new Array(e);for(let p=0;p<e;p++)l[p]=r[(p-n+e)%e];r=l}return r}function en(t,e){for(;e!==0;){let n=e;e=t%e,t=n}return t}function it(t,e){if(t===0)return 10;let n=0,r=en(t,e);r>1&&(n=r/e*10);let a=t/e,s=[1/2,1/4,3/4,1/3,2/3,1/8,3/8,5/8,7/8,1/6,5/6],i=[5,3,3,2.5,2.5,1.5,1.5,1.5,1.5,1,1],u=1,d=0;for(let o=0;o<s.length;o++){let l=Math.abs(a-s[o]);l<u&&(u=l,d=i[o])}if(u<=.5/e&&(n=Math.max(n,d)),n<.5){let o=Math.abs(t-e/2)/(e/2),l=Math.min(t,e-t)/(e/2);n=1-o*.3+l*.2,n+=t%3*.01+t%5*.005}return t===e-1&&(n=Math.max(n,7)),Math.max(n,.1+t*.001)}function me(t){let e=new Array(t);for(let n=0;n<t;n++)e[n]=it(n,t);return e}function tn(t,e){let n=e/4,r=e/8;return!(t%n===0||t%r===0)}function lt(t,e,n={}){let r=t.length,a=t.filter(i=>i).length;if(e===a)return t.slice();let s=me(r);return e<a?nn(t,e,s,n):rn(t,e,s,n)}function nn(t,e,n,r){let{preserveDownbeat:a=!0,minimumIndispensability:s=0,wolrabMode:i=!1}=r,d=t.filter(p=>p).length-e,o=t.map((p,c)=>({position:c,indispensability:n[c],isDownbeat:c===0,on:p})).filter(p=>p.on);o.sort((p,c)=>{if(a&&!i){if(p.isDownbeat&&!c.isDownbeat)return 1;if(!p.isDownbeat&&c.isDownbeat)return-1}return i?c.indispensability-p.indispensability:p.indispensability-c.indispensability});let l=t.slice();for(let p=0;p<Math.min(d,o.length);p++){let c=o[p];(i||c.indispensability>=s||!a||!c.isDownbeat)&&(l[c.position]=0)}return l}function rn(t,e,n,r){let{avoidWeakBeats:a=!1,minimumIndispensability:s=.1,wolrabMode:i=!1}=r,u=t.length,d=t.filter(f=>f).length,o=e-d,l=t.map((f,h)=>({position:h,indispensability:n[h],isWeakBeat:tn(h,u),on:f})).filter(f=>!f.on);l.sort((f,h)=>{if(a){if(f.isWeakBeat&&!h.isWeakBeat)return 1;if(!f.isWeakBeat&&h.isWeakBeat)return-1}return i?f.indispensability-h.indispensability:h.indispensability-f.indispensability});let p=t.slice(),c=0;for(let f=0;f<l.length&&c<o;f++){let h=l[f];h.indispensability>=s&&(p[h.position]=1,c++)}if(c<o)for(let f=0;f<l.length&&c<o;f++){let h=l[f];p[h.position]||(p[h.position]=1,c++)}return p}function he(t,e){return G(t,e)}function ge(t,e,n){let r=new Array(n).fill(0);if(t<=0)return r;for(let a=0;a<t;a++){let s=Math.round(a*n/t)%n;r[(s+e)%n]=1}return r}function dt(t,e){let n=[...Array(e).keys()];for(let a=n.length-1;a>0;a--){let s=Math.floor(Math.random()*(a+1));[n[a],n[s]]=[n[s],n[a]]}let r=new Array(e).fill(0);for(let a=0;a<Math.min(t,e);a++)r[n[a]]=1;return r}function ut(t){return t.map(e=>e?0:1)}var an={tri:"P(3,0)",pent:"P(5,0)",hex:"P(6,0)",hept:"P(7,0)",oct:"P(8,0)",tresillo:"E(3,8)",cinquillo:"E(5,8)"};function sn(t,e){for(;e;)[t,e]=[e,t%e];return t}function pt(t,e){return t/sn(t,e)*e}function on(t){let e=[],n=0,r="",a="+";for(let s of t)s==="("?n++:s===")"&&n--,n===0&&(s==="+"||s==="-")&&r.trim()?(e.push({op:a,pat:r.trim()}),r="",a=s):r+=s;return r.trim()&&e.push({op:a,pat:r.trim()}),e}var ct={a:".-",b:"-...",c:"-.-.",d:"-..",e:".",f:"..-.",g:"--.",h:"....",i:"..",j:".---",k:"-.-",l:".-..",m:"--",n:"-.",o:"---",p:".--.",q:"--.-",r:".-.",s:"...",t:"-",u:"..-",v:"...-",w:".--",x:"-..-",y:"-.--",z:"--.."};function ln(t){let e=String(t).toLowerCase().trim();e==="sos"?e="...---...":e==="cq"?e="-.-.--.-":/[a-z]/.test(e)&&(e=[...e].map(r=>ct[r]!==void 0?ct[r]:r).join(""));let n=[];for(let r of e)r==="."?n.push(1):r==="-"?(n.push(1),n.push(0)):r===" "&&n.push(0);return n}function mt(t,e,n=!0){let r=t.length;if(r===0||e<1||r===e)return t.slice();let a=Math.PI*2,s=d=>(d%=a,d<0?d+a:d),i=new Set;for(let d=0;d<r;d++){if(!t[d])continue;let o=d/r*a;n||(o=a-o),o=s(o);let l=Math.round(o/a*e);l>=e&&(l=0),l=Math.max(0,Math.min(l,e-1)),i.add(l)}let u=new Array(e).fill(0);for(let d of i)u[d]=1;return u}function cn(t,e,n){let r=pt(t.length||1,e.length||1),a=new Array(r);for(let s=0;s<r;s++){let i=t[s%t.length],u=e[s%e.length];a[s]=n?i||u?1:0:i&&!u?1:0}return a}function fe(t,e){let n=new Array(e).fill(0),r=typeof t=="bigint"?t:BigInt(t);for(let a=0;a<e;a++)n[a]=(r&1n)===1n?1:0,r>>=1n;return n}function O(t,e={n:16}){let n=String(t||"").trim(),r=null,a=n.match(/^\{([^}]*)\}\s*(.*)$/);a&&(n=a[2].trim(),r=a[1].replace(/[^01]/g,"").split("").map(Number));let s=(i,u)=>{let d=i.length,o=new Array(d).fill(0);if(r&&r.length){let l=0;for(let p=0;p<d;p++)i[p]&&(o[p]=r[l%r.length]?1:0,l++)}return{steps:i.map(Number),accents:o,accentPattern:r,label:u,ok:!0}};try{let i,u=n.indexOf(";");if(u>0){let o=n.slice(u+1).trim().match(/^(-?)(\d+)$/);if(o){let l=O(n.slice(0,u).trim(),e);return l.ok?s(mt(l.steps,+o[2],o[1]!=="-"),`${l.label};${o[1]}${o[2]}`):l}}let d=an[n.toLowerCase()];d&&(n=d);{let o=null;if(/^M:/i.test(n)?o=n.slice(2):(/^[.\-\s]+$/.test(n)&&/[.\-]/.test(n)||/^[a-z]+$/i.test(n))&&(o=n),o!==null){let l=ln(o);if(l.length)return s(l,`\u266A ${n}`)}}if(/[+-]/.test(n)){let o=on(n);if(o.length>=2&&o.every(l=>!/^\d+$/.test(l.pat))){let l=o.map((h,x)=>(x?h.op:"")+h.pat).join(""),p=/^P\(\s*(\d+)\s*,\s*(-?\d+)\s*(?:,\s*(\d+)\s*)?\)$/i;if(o.every(h=>h.op==="+"&&p.test(h.pat))){let x=o.map(b=>{let w=b.pat.match(p);return+w[1]*(w[3]?+w[3]:1)}).reduce((b,w)=>pt(b,w)),g=new Array(x).fill(0);for(let b of o){let w=b.pat.match(p),j=ge(+w[1],(+w[2]%x+x)%x,x);for(let S=0;S<x;S++)j[S]&&(g[S]=1)}return s(g,l)}let c=O(o[0].pat,e);if(!c.ok)return c;let f=c.steps.slice();for(let h=1;h<o.length;h++){let x=O(o[h].pat,e);if(!x.ok)return x;f=cn(f,x.steps,o[h].op==="+")}return s(f,l)}}if(i=n.match(/^E\(\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(-?\d+)\s*)?\)$/i)){let o=+i[1],l=+i[2],p=i[3]?+i[3]:0;return s(G(o,l,p),`E(${o},${l}${p?","+p:""})`)}if(i=n.match(/^P\(\s*(\d+)\s*,\s*(-?\d+)\s*(?:,\s*(\d+)\s*)?\)$/i)){let o=+i[1],l=+i[2],p=i[3]?+i[3]:e.n;return s(ge(o,(l%p+p)%p,p),`P(${o},${l}${i[3]?","+p:""})`)}if(i=n.match(/^R\(\s*(\d+)\s*,\s*(\d+)\s*\)$/i)){let o=+i[1],l=+i[2];return s(dt(o,l),`R(${o},${l})`)}if(i=n.match(/^([BWD])\(\s*(\d+)\s*,\s*(\d+)\s*\)$/i)){let o=i[1].toUpperCase(),l=+i[2],p=+i[3];if(o==="D")return s(ut(G(p-l,p)),`D(${l},${p})`);let c=new Array(p).fill(0);return c[0]=1,s(lt(c,l,{wolrabMode:o==="W"}),`${o}(${l},${p})`)}if(i=n.match(/^0x([0-9a-f]+)(?::(\d+))?$/i)){let o=BigInt("0x"+[...i[1]].reverse().join("")),l=i[2]?+i[2]:i[1].length*4;return s(fe(o,l),`0x${i[1].toUpperCase()}`)}if(i=n.match(/^o([0-7]+)(?::(\d+))?$/i)){let o=BigInt("0o"+[...i[1]].reverse().join("")),l=i[2]?+i[2]:i[1].length*3;return s(fe(o,l),`o${i[1]}`)}if(i=n.match(/^d(\d+)(?::(\d+))?$/i)){let o=BigInt(i[1]),l=i[2]?+i[2]:Math.max(1,o.toString(2).length);return s(fe(o,l),`d${i[1]}`)}if(i=n.match(/^\[([\d,\s]*)\](?::(\d+))?$/)){let o=i[1].split(",").map(c=>c.trim()).filter(c=>c!=="").map(Number),l=i[2]?+i[2]:o.length?Math.max(...o)+1:e.n,p=new Array(l).fill(0);return o.forEach(c=>{c>=0&&c<l&&(p[c]=1)}),s(p,`[${o.join(",")}]:${l}`)}if((i=n.match(/^b?([01]+)$/i))&&/[01]/.test(n)){let o=i[1].split("").map(Number);return s(o,o.join(""))}}catch(i){return{steps:he(5,e.n),accents:new Array(e.n).fill(0),label:"E(5,16)",ok:!1,error:String(i)}}return{steps:he(5,e.n),accents:new Array(e.n).fill(0),label:"",ok:!1,error:"Unrecognised pattern"}}var ft=Math.PI*2;function ae(t){let e=[];for(let n=0;n<t.length;n++)t[n]&&e.push(n);return e}function be(t){let e=t.length,n=0,r=0,a=ae(t);for(let i of a){let u=ft*i/e;n+=Math.cos(u),r+=Math.sin(u)}let s=Math.hypot(n,r);return{x:n,y:r,mag:s,angle:Math.atan2(r,n),k:a.length}}function ht(t){let e=be(t),n=e.k?e.mag/e.k:0,r=(e.angle/ft*t.length+t.length)%t.length;return{magnitude:n,angleSteps:r,x:e.x,y:e.y}}function gt(t,e=1e-6){let n=be(t);return n.k>=2&&n.mag<e*Math.max(1,n.k)+1e-9?!0:n.mag<1e-6}function ye(t){let e=ae(t),n=t.length;if(e.length<2)return e.length===1?[n]:[];let r=[];for(let a=0;a<e.length;a++){let s=e[a],i=e[(a+1)%e.length];r.push((i-s+n)%n||n)}return r}function bt(t){let e=ye(t);if(e.length<2)return 1;let n=e.reduce((a,s)=>a+s,0)/e.length;if(n===0)return 1;let r=e.reduce((a,s)=>a+Math.abs(s-n),0)/e.length;return Math.max(0,1-r/n)}function se(t){let e=t.length,n=ae(t),r=ht(t);return{n:e,k:n.length,density:e?n.length/e:0,onsets:n,intervals:ye(t),evenness:bt(t),balanced:gt(t),cog:r,binary:t.join(""),hex:"0x"+[...BigInt("0b"+(t.slice().reverse().join("")||"0")).toString(16).toUpperCase()].reverse().join(""),decimal:Number(BigInt("0b"+(t.slice().reverse().join("")||"0")))}}var Er=1/8;var yt={app:"vane",v:1,params:[{id:"morph",label:"Morph",unit:"ratio",min:0,max:1,step:.001,default:0,wasmId:12},{id:"pulse-width",label:"Pulse Width",unit:"ratio",min:.5,max:.999,step:.001,default:.5,wasmId:13},{id:"wavefold",label:"Wavefold",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:17},{id:"inharmonicity",label:"Inharmonicity",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:14},{id:"hard-sync",label:"Hard Sync",unit:"ratio",min:1,max:8,step:.01,default:1,wasmId:15},{id:"noise",label:"Noise",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:26},{id:"detune",label:"Detune",unit:"cents",min:-100,max:100,step:1,default:0,wasmId:28},{id:"filter-cutoff",label:"Filter Cutoff",unit:"hz",min:20,max:2e4,step:10,default:1128,scale:"log",wasmId:1},{id:"filter-resonance",label:"Filter Resonance",unit:"ratio",min:0,max:1,step:.01,default:.1,wasmId:2},{id:"output",label:"Output",unit:"ratio",min:0,max:1,step:.01,default:.8,wasmId:8},{id:"vel-vca",label:"Velocity \u2192 VCA",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:9},{id:"glide-time",label:"Glide Time",unit:"ms",min:0,max:2e3,step:5,default:0,wasmId:10},{id:"master-tune",label:"Master Tune",unit:"cents",min:-100,max:100,step:1,default:0,wasmId:29},{id:"unison-detune",label:"Unison Detune",unit:"cents",min:0,max:50,step:1,default:14,wasmId:40},{id:"unison-width",label:"Unison Width",unit:"ratio",min:0,max:1,step:.01,default:.7,wasmId:41},{id:"vowel",label:"Vowel",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:20},{id:"vowel-front",label:"Vowel Front",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:21},{id:"vowel-round",label:"Vowel Round",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:22},{id:"vowel-amount",label:"Vowel Amount",unit:"ratio",min:0,max:1,step:.01,default:1,wasmId:23},{id:"vowel-bite",label:"Vowel Bite",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:24},{id:"vowel-move",label:"Vowel Move",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:25},{id:"wg-embouchure",label:"Waveguide Embouchure",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:31},{id:"wg-reed-stiff",label:"Waveguide Reed Stiffness",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:32},{id:"wg-reed-aperture",label:"Waveguide Reed Aperture",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:33},{id:"wg-bore-damping",label:"Waveguide Bore Damping",unit:"ratio",min:0,max:1,step:.01,default:.2,wasmId:34},{id:"wg-bell-bright",label:"Waveguide Bell Brightness",unit:"ratio",min:0,max:1,step:.01,default:.7,wasmId:35},{id:"wg-conical",label:"Waveguide Conical",unit:"ratio",min:0,max:1,step:.01,default:.62,wasmId:36},{id:"wg-breath-noise",label:"Waveguide Breath Noise",unit:"ratio",min:0,max:1,step:.01,default:.05,wasmId:37},{id:"wg-growl",label:"Waveguide Growl",unit:"ratio",min:0,max:1,step:.01,default:0,wasmId:38},{id:"transient-gain",label:"Transient Gain",unit:"ratio",min:0,max:2,step:.01,default:0,wasmId:44},{id:"transient-decay",label:"Transient Decay",unit:"ms",min:10,max:2e3,step:1,default:200,scale:"log",wasmId:45},{id:"transient-var",label:"Transient Variation",unit:"ratio",min:0,max:1,step:.01,default:.3,wasmId:47},{id:"transient-dyn",label:"Transient Dynamics",unit:"ratio",min:0,max:1,step:.01,default:.75,wasmId:49},{id:"transient-reso",label:"Transient Resonance",unit:"ratio",min:0,max:1,step:.01,default:.3,wasmId:50},{id:"transient-damp",label:"Transient Damping",unit:"ratio",min:0,max:1,step:.01,default:.5,wasmId:51},{id:"transient-morph",label:"Transient Morph",unit:"ms",min:0,max:50,step:1,default:12,wasmId:52}],commands:[]};var vt={app:"serpe",v:1,params:[{id:"steps",label:"Steps",unit:"count",min:1,max:128,default:8,step:1},{id:"tempo",label:"Tempo",unit:"bpm",min:20,max:300,default:120,step:1},{id:"swing",label:"Swing",unit:"ratio",min:0,max:1,default:0,step:.01}],commands:[{name:"rotate",label:"Rotate",args:[{id:"by",unit:"count",min:-64,max:64,default:1}]},{name:"invert",label:"Invert"},{name:"complement",label:"Complement"},{name:"mutate",label:"Mutate",args:[{id:"amount",unit:"ratio",min:0,max:1,default:.5}]}]};var xt=t=>(t%12+12)%12;function xe(t,e){let n=e.pcs.findIndex(r=>xt(r)===xt(t));return n===-1?0:n+1}var mn=t=>Math.max(1,Math.min(127,Math.round(t)));function we(t,e){let n=e.steps.flatMap((u,d)=>u?[d]:[]);if(!n.length)throw new Error("applyRhythm: the rhythm has no onsets");let r=t.events.filter(u=>u.note!==void 0);if(!r.length)throw new Error("applyRhythm: the source phrase has no pitched events");let a=t.lengthTicks/e.steps.length,s=n.map(u=>Math.round(u*a)),i=s.map((u,d)=>{let o=r[d%r.length],l=d+1<s.length?s[d+1]:t.lengthTicks,p=e.accents?.[n[d]]?18:0,c;return o.chordRelation&&(c={...o.chordRelation},c.category==="chromatic-approach"?c.target=(d+1)%s.length:delete c.target),{onset:u,duration:Math.max(1,l-u),velocity:mn(o.velocity+p),note:o.note,...o.pitchClass!==void 0&&{pitchClass:o.pitchClass},...c!==void 0&&{chordRelation:c},...o.sourceEventId!==void 0&&{sourceEventId:o.sourceEventId}}});return{...t,id:`${t.id}+${e.label??`r${n.length}of${e.steps.length}`}`,events:i,annotations:{...t.annotations,rhythm:e.label??e.steps.join("")}}}function L(t){return(t%12+12)%12}var wt=["C","D","E","F","G","A","B"],kt=[0,2,4,5,7,9,11];function H(t){return L(kt[t.letterIndex]+t.alteration)}function _(t){let e=/^([A-Ga-g])(.*)$/.exec(t.trim());if(!e)return;let n=wt.indexOf(e[1].toUpperCase());if(n<0)return;let r=0;for(let a of e[2])if(a==="#"||a==="\u266F")r+=1;else if(a==="b"||a==="\u266D")r-=1;else if(a==="x"||a==="\u{1D12A}")r+=2;else if(a==="\u{1D12B}")r-=2;else return;return{letterIndex:n,alteration:r}}function K(t){let e=wt[t.letterIndex],n=t.alteration,r="";for(;n>=2;)r+="\u{1D12A}",n-=2;for(;n<=-2;)r+="\u{1D12B}",n+=2;return n===1&&(r="\u266F"+r),n===-1&&(r="\u266D"+r),e+r}function Mt(t,e,n){let r=((t.letterIndex+e)%7+7)%7,a=L(H(t)+n),s=kt[r],i=a-s;return i>6&&(i-=12),i<-6&&(i+=12),{letterIndex:r,alteration:i}}var Me=[{key:"4",fullName:"quartal",displayName:"q",pcs:[0,5,10,3],binary:"100101000010",decimal:1065,intervals:["R","4","\u266D7","\u266D3"],aliases:["4","quartal"]},{key:"5",fullName:"fifth",displayName:"5",pcs:[0,7],binary:"100000010000",decimal:129,intervals:["R","5"],aliases:["5"]},{key:"6",fullName:"major sixth",displayName:"6",pcs:[0,4,7,9],binary:"100010010100",decimal:657,intervals:["R","3","5","6"],aliases:["6","add6","add13","M6"]},{key:"7",fullName:"dominant seventh",displayName:"7",pcs:[0,4,7,10],binary:"100010010010",decimal:1169,intervals:["R","3","5","\u266D7"],aliases:["7","dom"]},{key:"9",fullName:"dominant ninth",displayName:"9",pcs:[0,4,7,10,2],binary:"101010010010",decimal:1173,intervals:["R","3","5","\u266D7","9"],aliases:["9"]},{key:"11",fullName:"dominant eleventh",displayName:"11",pcs:[0,4,7,10,2,5],binary:"101011010010",decimal:1205,intervals:["R","3","5","\u266D7","9","11"],aliases:["11","dom11"]},{key:"13",fullName:"dominant thirteenth",displayName:"13",pcs:[0,4,7,10,2,5,9],binary:"101011010110",decimal:1717,intervals:["R","3","5","\u266D7","9","11","13"],aliases:["13"]},{key:"maj",fullName:"major triad",displayName:"",pcs:[0,4,7],binary:"100010010000",decimal:145,intervals:["R","3","5"],aliases:["maj","M","major"]},{key:"min",fullName:"minor triad",displayName:"-",pcs:[0,3,7],binary:"100100010000",decimal:137,intervals:["R","\u266D3","5"],aliases:["min","m","minor","-"]},{key:"dim",fullName:"diminished triad",displayName:"\xB0",pcs:[0,3,6],binary:"100100100000",decimal:73,intervals:["R","\u266D3","\u266D5"],aliases:["dim","\xB0"]},{key:"aug",fullName:"augmented triad",displayName:"+",pcs:[0,4,8],binary:"100010001000",decimal:273,intervals:["R","3","\u266F5"],aliases:["aug","+"]},{key:"maj7",fullName:"major seventh",displayName:"\u2206",pcs:[0,4,7,11],binary:"100010010001",decimal:2193,intervals:["R","3","5","7"],aliases:["maj7","M7","\u2206","\u22067"]},{key:"min7",fullName:"minor seventh",displayName:"-7",pcs:[0,3,7,10],binary:"100100010010",decimal:1161,intervals:["R","\u266D3","5","\u266D7"],aliases:["min7","m7","-7"]},{key:"dim7",fullName:"diminished seventh",displayName:"\xB07",pcs:[0,3,6,9],binary:"100100100100",decimal:585,intervals:["R","\u266D3","\u266D5","\u{1D12B}7"],aliases:["dim7","\xB07"]},{key:"m7b5",fullName:"half-diminished seventh",displayName:"\xF8",pcs:[0,3,6,10],binary:"100100100010",decimal:1097,intervals:["R","\u266D3","\u266D5","\u266D7"],aliases:["m7b5","\xF8","\xF87"]},{key:"minMaj7",fullName:"minor-major seventh",displayName:"m\u2206",pcs:[0,3,7,11],binary:"100100010001",decimal:2185,intervals:["R","\u266D3","5","7"],aliases:["minMaj7","mM7","m\u2206"]},{key:"augMaj7",fullName:"augmented major seventh",displayName:"+\u2206",pcs:[0,4,8,11],binary:"100010001001",decimal:2321,intervals:["R","3","\u266F5","7"],aliases:["augMaj7","+M7","+\u2206"]},{key:"m6",fullName:"minor sixth",displayName:"-6",pcs:[0,3,7,9],binary:"100100010100",decimal:649,intervals:["R","\u266D3","5","6"],aliases:["m6","-6"]},{key:"maj9",fullName:"major ninth",displayName:"\u22069",pcs:[0,4,7,11,2],binary:"101010010001",decimal:2197,intervals:["R","3","5","7","9"],aliases:["maj9","M9","\u22069"]},{key:"min9",fullName:"minor ninth",displayName:"-9",pcs:[0,3,7,10,2],binary:"101100010010",decimal:1165,intervals:["R","\u266D3","5","\u266D7","9"],aliases:["min9","m9","-9"]},{key:"m9add13",fullName:"minor ninth added thirteenth",displayName:"-9add13",pcs:[0,3,7,10,2,9],binary:"101100010110",decimal:1677,intervals:["R","\u266D3","5","\u266D7","9","13"],aliases:["m9add13","m13no11","-9add13"]},{key:"maj11",fullName:"major eleventh",displayName:"\u220611",pcs:[0,4,7,11,2,5],binary:"101011010001",decimal:2229,intervals:["R","3","5","7","9","11"],aliases:["maj11","M11","\u220611"]},{key:"min11",fullName:"minor eleventh",displayName:"-11",pcs:[0,3,7,10,2,5],binary:"101101010010",decimal:1197,intervals:["R","\u266D3","5","\u266D7","9","11"],aliases:["min11","m11","-11"]},{key:"maj13",fullName:"major thirteenth",displayName:"\u220613",pcs:[0,4,7,11,2,5,9],binary:"101011010101",decimal:2741,intervals:["R","3","5","7","9","11","13"],aliases:["maj13","M13","\u220613"]},{key:"min13",fullName:"minor thirteenth",displayName:"-13",pcs:[0,3,7,10,2,5,9],binary:"101101010110",decimal:1709,intervals:["R","\u266D3","5","\u266D7","9","11","13"],aliases:["min13","m13","-13"]},{key:"sus2",fullName:"suspended second",displayName:"sus2",pcs:[0,2,7],binary:"101000010000",decimal:133,intervals:["R","2","5"],aliases:["sus2"]},{key:"7sus2",fullName:"dominant seventh suspended second",displayName:"7sus2",pcs:[0,2,7,10],binary:"101000010010",decimal:1157,intervals:["R","2","5","\u266D7"],aliases:["7sus2"]},{key:"M7sus2",fullName:"major seventh suspended second",displayName:"M7sus2",pcs:[0,2,7,11],binary:"101000010001",decimal:2181,intervals:["R","2","5","7"],aliases:["M7sus2"]},{key:"13sus2",fullName:"dominant thirteenth suspended second",displayName:"13sus2",pcs:[0,2,7,10,9],binary:"101000010110",decimal:1669,intervals:["R","2","5","\u266D7","13"],aliases:["13sus2"]},{key:"M13sus2",fullName:"major thirteenth suspended second",displayName:"M13sus2",pcs:[0,2,7,11,9],binary:"101000010101",decimal:2693,intervals:["R","2","5","7","13"],aliases:["M13sus2"]},{key:"7#11sus2",fullName:"lydian dominant suspended second",displayName:"7#11sus2",pcs:[0,2,7,10,6],binary:"101000110010",decimal:1221,intervals:["R","2","5","\u266D7","\u266F11"],aliases:["7#11sus2"]},{key:"M7#11sus2",fullName:"lydian major seventh suspended second",displayName:"M7#11sus2",pcs:[0,2,7,11,6],binary:"101000110001",decimal:2245,intervals:["R","2","5","7","\u266F11"],aliases:["M7#11sus2"]},{key:"13#11sus2",fullName:"lydian dominant thirteenth suspended second",displayName:"13#11sus2",pcs:[0,2,6,7,9,10],binary:"101000110110",decimal:1733,intervals:["R","2","\u266F11","5","13","\u266D7"],aliases:["13#11sus2"]},{key:"M13#11sus2",fullName:"lydian major thirteenth suspended second",displayName:"M13#11sus2",pcs:[0,2,6,7,9,11],binary:"101000110101",decimal:2757,intervals:["R","2","\u266F11","5","13","7"],aliases:["M13#11sus2"]},{key:"sus4",fullName:"suspended fourth",displayName:"sus4",pcs:[0,5,7],binary:"100001010000",decimal:161,intervals:["R","4","5"],aliases:["sus4"]},{key:"7sus4",fullName:"dominant seventh suspended fourth",displayName:"7sus4",pcs:[0,5,7,10],binary:"100001010010",decimal:1185,intervals:["R","4","5","\u266D7"],aliases:["7sus4"]},{key:"9sus4",fullName:"dominant ninth suspended fourth",displayName:"9sus4",pcs:[0,5,7,10,2],binary:"101001010010",decimal:1189,intervals:["R","4","5","\u266D7","9"],aliases:["9sus4"]},{key:"7b5",fullName:"dominant seventh diminished",displayName:"7b5",pcs:[0,4,6,10],binary:"100010100010",decimal:1105,intervals:["R","3","\u266D5","\u266D7"],aliases:["7b5"]},{key:"aug7",fullName:"augmented dominant seventh",displayName:"+7",pcs:[0,4,8,10],binary:"100010001010",decimal:1297,intervals:["R","3","\u266F5","\u266D7"],aliases:["aug7","+7","7#5"]},{key:"7b9",fullName:"dominant seventh flat ninth",displayName:"7b9",pcs:[0,4,7,10,1],binary:"110010010010",decimal:1171,intervals:["R","3","5","\u266D7","\u266D9"],aliases:["7b9"]},{key:"7#9",fullName:"dominant seventh sharp ninth",displayName:"7#9",pcs:[0,4,7,10,3],binary:"100110010010",decimal:1177,intervals:["R","3","5","\u266D7","\u266F9"],aliases:["7#9"]},{key:"7#11",fullName:"lydian dominant seventh",displayName:"7#11",pcs:[0,4,7,10,6],binary:"100010110010",decimal:1233,intervals:["R","3","5","\u266D7","\u266F11"],aliases:["7#11"]},{key:"7b13",fullName:"dominant seventh flat thirteen",displayName:"7b13",pcs:[0,4,7,10,8],binary:"100010011010",decimal:1425,intervals:["R","3","5","\u266D7","\u266D13"],aliases:["7b13"]},{key:"9b13",fullName:"dominant ninth flat thirteenth",displayName:"9b13",pcs:[0,4,7,10,2,8],binary:"101010011010",decimal:1429,intervals:["R","3","5","\u266D7","9","\u266D13"],aliases:["9b13","dom9b13"]},{key:"6add9",fullName:"sixth added ninth",displayName:"69",pcs:[0,4,7,9,2],binary:"101010010100",decimal:661,intervals:["R","3","5","6","9"],aliases:["6add9","69"]},{key:"M6#11",fullName:"sixth sharp eleventh",displayName:"M6#11",pcs:[0,4,7,9,6],binary:"100010110100",decimal:721,intervals:["R","3","5","6","\u266F11"],aliases:["M6#11"]},{key:"69#11",fullName:"major sixth ninth sharp eleventh",displayName:"69#11",pcs:[0,4,7,9,2,6],binary:"101010110100",decimal:725,intervals:["R","3","5","6","9","\u266F11"],aliases:["69#11"]},{key:"maj7add13",fullName:"major seventh added thirteenth",displayName:"\u2206add13",pcs:[0,4,7,11,9],binary:"100010010101",decimal:2705,intervals:["R","3","5","7","13"],aliases:["maj7add13","M7add13","\u2206add13","\u220613no9"]},{key:"maj7b13",fullName:"major seventh flat thirteenth",displayName:"\u2206b13",pcs:[0,4,7,8,11],binary:"100010011001",decimal:2449,intervals:["R","3","5","\u266D13","7"],aliases:["maj7b13","M7b13","\u2206b13"]},{key:"maj#4",fullName:"major seventh sharp eleventh",displayName:"\u2206#4",pcs:[0,4,7,11,6],binary:"100010110001",decimal:2257,intervals:["R","3","5","7","\u266F11"],aliases:["maj#4","\u2206#11"]},{key:"maj7#11add13",fullName:"major seventh sharp eleventh added thirteenth",displayName:"\u2206#11add13",pcs:[0,4,6,7,9,11],binary:"100010110101",decimal:2769,intervals:["R","3","\u266F11","5","13","7"],aliases:["maj7#11add13","\u2206#11add13","M7#11add13"]},{key:"maj9add13",fullName:"major ninth added thirteenth",displayName:"\u22069add13",pcs:[0,2,4,7,9,11],binary:"101010010101",decimal:2709,intervals:["R","9","3","5","13","7"],aliases:["maj9add13","maj13","\u220613","M13"]},{key:"9add13",fullName:"dominant ninth added thirteenth",displayName:"9add13",pcs:[0,2,4,7,9,10],binary:"101010010110",decimal:1685,intervals:["R","9","3","5","13","\u266D7"],aliases:["9add13","13no11","dom13no11"]},{key:"maj9#11",fullName:"major sharp eleventh (lydian)",displayName:"\u22069#11",pcs:[0,4,7,11,2,6],binary:"101010110001",decimal:2261,intervals:["R","3","5","7","9","\u266F11"],aliases:["maj9#11","\u22069#11"]},{key:"maj7#9#11",fullName:"major sharp ninth sharp eleventh",displayName:"\u2206#9#11",pcs:[0,4,7,11,3,6],binary:"100110110001",decimal:2265,intervals:["R","3","5","7","\u266F9","\u266F11"],aliases:["maj7#9#11"]},{key:"M13#11",fullName:"major thirteenth sharp eleventh",displayName:"\u220613#11",pcs:[0,4,7,11,2,6,9],binary:"101010110101",decimal:2773,intervals:["R","3","5","7","9","\u266F11","13"],aliases:["M13#11"]},{key:"M7b9",fullName:"major seventh flat ninth",displayName:"\u2206b9",pcs:[0,4,7,11,1],binary:"110010010001",decimal:2195,intervals:["R","3","5","7","\u266D9"],aliases:["M7b9"]},{key:"Madd9",fullName:"major added ninth",displayName:"add9",pcs:[0,4,7,2],binary:"101010010000",decimal:149,intervals:["R","3","5","9"],aliases:["Madd9","add9"]},{key:"add11",fullName:"major added eleventh",displayName:"add11",pcs:[0,4,5,7],binary:"100011010000",decimal:177,intervals:["R","3","4","5"],aliases:["add11","Madd11","add4"]},{key:"6add11",fullName:"sixth added eleventh",displayName:"6add11",pcs:[0,4,5,7,9],binary:"100011010100",decimal:689,intervals:["R","3","4","5","6"],aliases:["6add11","6(11)","6_11"]},{key:"6_9_11",fullName:"sixth ninth eleventh",displayName:"6/9add11",pcs:[0,2,4,5,7,9],binary:"101011010100",decimal:693,intervals:["R","9","3","4","5","6"],aliases:["6_9_11","69add11","6(9,11)"]},{key:"6sus2",fullName:"sixth suspended second",displayName:"6sus2",pcs:[0,2,7,9],binary:"101000010100",decimal:645,intervals:["R","2","5","6"],aliases:["6sus2"]},{key:"6b5",fullName:"sixth flat fifth",displayName:"6b5",pcs:[0,4,6,9],binary:"100010100100",decimal:593,intervals:["R","3","\u266D5","6"],aliases:["6b5","M6b5"]},{key:"Maddb9",fullName:"major added flat ninth",displayName:"addb9",pcs:[0,4,7,1],binary:"110010010000",decimal:147,intervals:["R","3","5","\u266D9"],aliases:["Maddb9"]},{key:"Mb5",fullName:"major diminished",displayName:"b5",pcs:[0,4,6],binary:"100010100000",decimal:81,intervals:["R","3","\u266D5"],aliases:["Mb5"]},{key:"M7b5",fullName:"major seventh diminished",displayName:"\u2206b5",pcs:[0,4,6,11],binary:"100010100001",decimal:2129,intervals:["R","3","\u266D5","7"],aliases:["M7b5"]},{key:"M9b5",fullName:"major ninth diminished",displayName:"\u22069b5",pcs:[0,4,6,11,2],binary:"101010100001",decimal:2133,intervals:["R","3","\u266D5","7","9"],aliases:["M9b5"]},{key:"mb6",fullName:"minor flat sixth",displayName:"-b6",pcs:[0,3,7,8],binary:"100100011000",decimal:393,intervals:["R","\u266D3","5","\u266D6"],aliases:["mb6"]},{key:"m69",fullName:"minor sixth ninth",displayName:"-69",pcs:[0,3,7,9,2],binary:"101100010100",decimal:653,intervals:["R","\u266D3","5","6","9"],aliases:["m69"]},{key:"m7b9",fullName:"minor seventh flat 9th",displayName:"-7b9",pcs:[0,3,7,10,1],binary:"110100010010",decimal:1163,intervals:["R","\u266D3","5","\u266D7","\u266D9"],aliases:["m7b9"]},{key:"mM9",fullName:"minor/major ninth",displayName:"mM9",pcs:[0,3,7,11,2],binary:"101100010001",decimal:2189,intervals:["R","\u266D3","5","7","9"],aliases:["mM9"]},{key:"m7add11",fullName:"minor seventh added eleventh",displayName:"-7add11",pcs:[0,3,7,10,5],binary:"100101010010",decimal:1193,intervals:["R","\u266D3","5","\u266D7","11"],aliases:["m7add11"]},{key:"madd4",fullName:"minor added fourth",displayName:"-add4",pcs:[0,3,7,5],binary:"100101010000",decimal:169,intervals:["R","\u266D3","5","4"],aliases:["madd4"]},{key:"m9add11",fullName:"minor ninth added eleventh (no seventh)",displayName:"-9add11",pcs:[0,2,3,5,7],binary:"101101010000",decimal:173,intervals:["R","\u266D3","5","9","11"],aliases:["m9add11","madd9add11"]},{key:"mMaj7b6",fullName:"minor/Major seventh flat sixth",displayName:"m\u2206b6",pcs:[0,3,7,11,8],binary:"100100011001",decimal:2441,intervals:["R","\u266D3","5","7","\u266D6"],aliases:["mMaj7b6"]},{key:"mMaj9b6",fullName:"minor/Major ninth flat sixth",displayName:"m\u22069b6",pcs:[0,3,7,11,2,8],binary:"101100011001",decimal:2445,intervals:["R","\u266D3","5","7","9","\u266D6"],aliases:["mMaj9b6"]},{key:"madd9",fullName:"minor added ninth",displayName:"-add9",pcs:[0,3,7,2],binary:"101100010000",decimal:141,intervals:["R","\u266D3","5","9"],aliases:["madd9"]},{key:"m7#5",fullName:"minor seventh sharp fifth",displayName:"-7+",pcs:[0,3,8,10],binary:"100100001010",decimal:1289,intervals:["R","\u266D3","\u266F5","\u266D7"],aliases:["m7#5"]},{key:"m9#5",fullName:"minor ninth sharp fifth",displayName:"-9+",pcs:[0,3,8,10,2],binary:"101100001010",decimal:1293,intervals:["R","\u266D3","\u266F5","\u266D7","9"],aliases:["m9#5"]},{key:"m11A",fullName:"augmented minor eleventh",displayName:"-11+",pcs:[0,3,8,10,2,5],binary:"101101001010",decimal:1325,intervals:["R","\u266D3","\u266F5","\u266D7","9","11"],aliases:["m11A"]},{key:"mb6b9",fullName:"minor flat sixth flat ninth",displayName:"-b6b9",pcs:[0,3,7,8,1],binary:"110100011000",decimal:395,intervals:["R","\u266D3","5","\u266D6","\u266D9"],aliases:["mb6b9"]},{key:"m9b5",fullName:"minor ninth flat fifth",displayName:"\xF89",pcs:[0,3,6,10,2],binary:"101100100010",decimal:1101,intervals:["R","\u266D3","\u266D5","\u266D7","9"],aliases:["m9b5","\xF89"]},{key:"o7M7",fullName:"diminished seventh Major seventh",displayName:"\xB07M7",pcs:[0,3,6,9,11],binary:"100100100101",decimal:2633,intervals:["R","\u266D3","\u266D5","\u{1D12B}7","7"],aliases:["o7M7"]},{key:"oM7",fullName:"diminished/Major seventh",displayName:"\xB0M7",pcs:[0,3,6,11],binary:"100100100001",decimal:2121,intervals:["R","\u266D3","\u266D5","7"],aliases:["oM7"]},{key:"alt7",fullName:"altered",displayName:"alt7",pcs:[0,4,10,1],binary:"110010000010",decimal:1043,intervals:["R","3","\u266D7","\u266D9"],aliases:["alt7"]},{key:"7#11b13",fullName:"dominant flat sixth flat fifth",displayName:"7#11b13",pcs:[0,4,7,10,6,8],binary:"100010111010",decimal:1489,intervals:["R","3","5","\u266D7","\u266F11","\u266D13"],aliases:["7#11b13"]},{key:"7add6",fullName:"dominant added thirteenth",displayName:"7add6",pcs:[0,4,7,9,10],binary:"100010010110",decimal:1681,intervals:["R","3","5","6","\u266D7"],aliases:["7add6"]},{key:"7#9#11",fullName:"dominant sharp ninth sharp eleventh",displayName:"7#9#11",pcs:[0,4,7,10,3,6],binary:"100110110010",decimal:1241,intervals:["R","3","5","\u266D7","\u266F9","\u266F11"],aliases:["7#9#11"]},{key:"13#9#11",fullName:"dominant thirteenth sharp ninth sharp eleventh",displayName:"13#9#11",pcs:[0,4,7,10,3,6,9],binary:"100110110110",decimal:1753,intervals:["R","3","5","\u266D7","\u266F9","\u266F11","13"],aliases:["13#9#11"]},{key:"7#9#11b13",fullName:"dominanth flat thirteenth sharp ninth sharp eleventh",displayName:"7#9#11b13",pcs:[0,4,7,10,3,6,8],binary:"100110111010",decimal:1497,intervals:["R","3","5","\u266D7","\u266F9","\u266F11","\u266D13"],aliases:["7#9#11b13"]},{key:"13#9",fullName:"dominant thirteenth sharp ninth",displayName:"13#9",pcs:[0,4,7,10,3,5,9],binary:"100111010110",decimal:1721,intervals:["R","3","5","\u266D7","\u266F9","11","13"],aliases:["13#9"]},{key:"7#9b13",fullName:"dominant sharp ninth flat thirteenth",displayName:"7#9b13",pcs:[0,4,7,10,3,8],binary:"100110011010",decimal:1433,intervals:["R","3","5","\u266D7","\u266F9","\u266D13"],aliases:["7#9b13"]},{key:"9#11",fullName:"dominant ninth sharp eleventh",displayName:"9#11",pcs:[0,4,7,10,2,6],binary:"101010110010",decimal:1237,intervals:["R","3","5","\u266D7","9","\u266F11"],aliases:["9#11"]},{key:"13#11",fullName:"dominant thirteenth sharp eleventh",displayName:"13#11",pcs:[0,4,7,10,2,6,9],binary:"101010110110",decimal:1749,intervals:["R","3","5","\u266D7","9","\u266F11","13"],aliases:["13#11"]},{key:"9#11b13",fullName:"dominant ninth sharp eleventh flat thirteenth",displayName:"9#11b13",pcs:[0,4,7,10,2,6,8],binary:"101010111010",decimal:1493,intervals:["R","3","5","\u266D7","9","\u266F11","\u266D13"],aliases:["9#11b13"]},{key:"7b9#11",fullName:"dominant flat ninth sharp eleventh",displayName:"7b9#11",pcs:[0,4,7,10,1,6],binary:"110010110010",decimal:1235,intervals:["R","3","5","\u266D7","\u266D9","\u266F11"],aliases:["7b9#11"]},{key:"13b9#11",fullName:"dominant thirteenth flat ninth sharp eleventh",displayName:"13b9#11",pcs:[0,4,7,10,1,6,9],binary:"110010110110",decimal:1747,intervals:["R","3","5","\u266D7","\u266D9","\u266F11","13"],aliases:["13b9#11"]},{key:"7b9b13#11",fullName:"dominant flat thirteenth flat ninth sharp eleventh",displayName:"7b9b13#11",pcs:[0,4,7,10,1,6,8],binary:"110010111010",decimal:1491,intervals:["R","3","5","\u266D7","\u266D9","\u266F11","\u266D13"],aliases:["7b9b13#11"]},{key:"13b9",fullName:"dominant thirteenth flat ninth",displayName:"13b9",pcs:[0,4,7,10,1,5,9],binary:"110011010110",decimal:1715,intervals:["R","3","5","\u266D7","\u266D9","11","13"],aliases:["13b9"]},{key:"7b9b13",fullName:"dominant flat thirteenth flat ninth",displayName:"7b9b13",pcs:[0,4,7,10,1,8],binary:"110010011010",decimal:1427,intervals:["R","3","5","\u266D7","\u266D9","\u266D13"],aliases:["7b9b13"]},{key:"7b9#9",fullName:"dominant flat ninth sharp ninth",displayName:"7b9#9",pcs:[0,3,4,7,10,1],binary:"110110010010",decimal:1179,intervals:["R","\u266D3","3","5","\u266D7","\u266D9"],aliases:["7b9#9"]},{key:"7#5#9",fullName:"altered dominant",displayName:"7#5#9",pcs:[0,4,8,10,3],binary:"100110001010",decimal:1305,intervals:["R","3","\u266F5","\u266D7","\u266F9"],aliases:["7#5#9"]},{key:"9#5",fullName:"dominant ninth augmented",displayName:"9#5",pcs:[0,4,8,10,2],binary:"101010001010",decimal:1301,intervals:["R","3","\u266F5","\u266D7","9"],aliases:["9#5"]},{key:"9#5#11",fullName:"dominant ninth augmented sharp eleventh",displayName:"9#5#11",pcs:[0,4,8,10,2,6],binary:"101010101010",decimal:1365,intervals:["R","3","\u266F5","\u266D7","9","\u266F11"],aliases:["9#5#11"]},{key:"7#5b9",fullName:"dominant augmented flat ninth",displayName:"7#5b9",pcs:[0,4,8,10,1],binary:"110010001010",decimal:1299,intervals:["R","3","\u266F5","\u266D7","\u266D9"],aliases:["7#5b9"]},{key:"7#5b9#11",fullName:"dominant augmented flat ninth sharp eleventh",displayName:"7#5b9#11",pcs:[0,4,8,10,1,6],binary:"110010101010",decimal:1363,intervals:["R","3","\u266F5","\u266D7","\u266D9","\u266F11"],aliases:["7#5b9#11"]},{key:"13b5",fullName:"dominant thirteenth diminished",displayName:"13b5",pcs:[0,4,6,10,2,5,9],binary:"101011100110",decimal:1653,intervals:["R","3","\u266D5","\u266D7","9","11","13"],aliases:["13b5"]},{key:"9b5",fullName:"dominant ninth diminished",displayName:"9b5",pcs:[0,4,6,10,2],binary:"101010100010",decimal:1109,intervals:["R","3","\u266D5","\u266D7","9"],aliases:["9b5"]},{key:"7no5",fullName:"dominant seventh no fifth",displayName:"7no5",pcs:[0,4,10],binary:"100010000010",decimal:1041,intervals:["R","3","\u266D7"],aliases:["7no5"]},{key:"9no5",fullName:"dominant ninth no fifth",displayName:"9no5",pcs:[0,4,10,2],binary:"101010000010",decimal:1045,intervals:["R","3","\u266D7","9"],aliases:["9no5"]},{key:"13no5",fullName:"dominant thirteenth no fifth",displayName:"13no5",pcs:[0,4,10,2,5,9],binary:"101011000110",decimal:1589,intervals:["R","3","\u266D7","9","11","13"],aliases:["13no5"]},{key:"sus24",fullName:"suspended second fourth",displayName:"sus24",pcs:[0,2,5,7],binary:"101001010000",decimal:165,intervals:["R","2","4","5"],aliases:["sus24"]},{key:"b9sus",fullName:"suspended fourth flat ninth",displayName:"b9sus",pcs:[0,5,7,10,1],binary:"110001010010",decimal:1187,intervals:["R","4","5","\u266D7","\u266D9"],aliases:["b9sus"]},{key:"13sus4",fullName:"dominant thirteenth suspended fourth",displayName:"13sus4",pcs:[0,5,7,10,2,9],binary:"101001010110",decimal:1701,intervals:["R","4","5","\u266D7","9","13"],aliases:["13sus4"]},{key:"7sus4b9b13",fullName:"dominant seventh suspended fourth flat ninth flat thirteenth",displayName:"7sus4b9b13",pcs:[0,5,7,10,1,8],binary:"110001011010",decimal:1443,intervals:["R","4","5","\u266D7","\u266D9","\u266D13"],aliases:["7sus4b9b13"]},{key:"M7sus4",fullName:"major seventh suspended fourth",displayName:"M7sus4",pcs:[0,5,7,11],binary:"100001010001",decimal:2209,intervals:["R","4","5","7"],aliases:["M7sus4"]},{key:"M9sus4",fullName:"major ninth suspended fourth",displayName:"M9sus4",pcs:[0,5,7,11,2],binary:"101001010001",decimal:2213,intervals:["R","4","5","7","9"],aliases:["M9sus4"]},{key:"M7#5sus4",fullName:"major seventh augmented suspended fourth",displayName:"M7#5sus4",pcs:[0,5,11,8],binary:"100001001001",decimal:2337,intervals:["R","4","\u266F5","7"],aliases:["M7#5sus4"]},{key:"M9#5sus4",fullName:"major ninth augmented suspended fourth",displayName:"M9#5sus4",pcs:[0,5,8,11,2],binary:"101001001001",decimal:2341,intervals:["R","4","\u266F5","7","9"],aliases:["M9#5sus4"]},{key:"7b13sus",fullName:"dominant flat 13th sus",displayName:"7b13sus",pcs:[0,5,7,8],binary:"100001011000",decimal:417,intervals:["R","4","5","\u266D6"],aliases:["7b13sus"]},{key:"7#5sus4",fullName:"dominant seventh sharp fifth suspended fourth",displayName:"7#5sus4",pcs:[0,5,8,10],binary:"100001001010",decimal:1313,intervals:["R","4","\u266F5","\u266D7"],aliases:["7#5sus4"]},{key:"m#5",fullName:"minor augmented",displayName:"m#5",pcs:[0,3,8],binary:"100100001000",decimal:265,intervals:["R","\u266D3","\u266F5"],aliases:["m#5"]},{key:"maj9#5",fullName:"augmented ninth",displayName:"maj9#5",pcs:[0,4,8,11,2],binary:"101010001001",decimal:2325,intervals:["R","3","\u266F5","7","9"],aliases:["maj9#5"]},{key:"M#5add9",fullName:"augmented added ninth",displayName:"M#5add9",pcs:[0,4,8,2],binary:"101010001000",decimal:277,intervals:["R","3","\u266F5","9"],aliases:["M#5add9"]},{key:"+add#9",fullName:"augmented added sharp ninth",displayName:"+add#9",pcs:[0,4,8,3],binary:"100110001000",decimal:281,intervals:["R","3","\u266F5","\u266F9"],aliases:["+add#9"]},{key:"mb9",fullName:"minor added flat ninth",displayName:"m(\u266D9)",pcs:[0,3,7,1],binary:"110100010000",decimal:139,intervals:["R","\u266D3","5","\u266D9"],aliases:["mb9","madd\u266D9","m(\u266D9)"]},{key:"7Maj7add9",fullName:"dominant with major seventh add nine",displayName:"7(\u22067,9)",pcs:[0,4,7,10,11,2],binary:"101010010011",decimal:3221,intervals:["R","3","5","\u266D7","\u22067","9"],aliases:["7Maj7add9","7(maj7,9)","7(\u22067,9)"]},{key:"7b9add11",fullName:"dominant flat ninth added eleventh",displayName:"7(\u266D9,11)",pcs:[0,4,7,10,1,5],binary:"110011010010",decimal:1203,intervals:["R","3","5","\u266D7","\u266D9","11"],aliases:["7b9add11","7(\u266D9,11)"]},{key:"6sus4",fullName:"sixth suspended fourth",displayName:"6sus4",pcs:[0,5,7,9],binary:"100001010100",decimal:673,intervals:["R","4","5","6"],aliases:["6sus4"]},{key:"dimadd9",fullName:"diminished added ninth",displayName:"\xB0add9",pcs:[0,3,6,2],binary:"101100100000",decimal:77,intervals:["R","\u266D3","\u266D5","9"],aliases:["dimadd9","dim(9)","\xB0add9"]},{key:"dim7add9",fullName:"diminished seventh added ninth",displayName:"\xB07(9)",pcs:[0,3,6,9,2],binary:"101100100100",decimal:589,intervals:["R","\u266D3","\u266D5","\u{1D12B}7","9"],aliases:["dim7add9","dim7(9)","\xB07(9)"]},{key:"m7add13",fullName:"minor seventh added thirteenth",displayName:"-7(13)",pcs:[0,3,7,10,9],binary:"100100010110",decimal:1673,intervals:["R","\u266D3","5","\u266D7","13"],aliases:["m7add13","m7(13)","-7(13)"]},{key:"add#11",fullName:"major added sharp eleventh",displayName:"(\u266F11)",pcs:[0,4,6,7],binary:"100010110000",decimal:209,intervals:["R","3","\u266F11","5"],aliases:["add#11","(\u266F11)"]},{key:"7no3",fullName:"dominant seventh no third",displayName:"5(\u266D7)",pcs:[0,7,10],binary:"100000010010",decimal:1153,intervals:["R","5","\u266D7"],aliases:["7no3","5(7)","5(\u266D7)"]},{key:"mAdd9b13",fullName:"minor added ninth flat thirteenth",displayName:"m(9,\u266D13)",pcs:[0,2,3,7,8],binary:"101100011000",decimal:397,intervals:["R","9","\u266D3","5","\u266D13"],aliases:["mAdd9b13","m(9,\u266D13)"]},{key:"sus4_6_9",fullName:"suspended fourth with sixth and ninth",displayName:"(6,9)sus4",pcs:[0,2,5,7,9],binary:"101001010100",decimal:677,intervals:["R","9","4","5","6"],aliases:["sus4_6_9","6_9sus4","(6,9)sus4"]},{key:"m7b13",fullName:"minor seventh flat thirteenth",displayName:"-7(\u266D13)",pcs:[0,3,7,8,10],binary:"100100011010",decimal:1417,intervals:["R","\u266D3","5","\u266D13","\u266D7"],aliases:["m7b13","-7(\u266D13)","m7\u266D13"]},{key:"7sus4b13",fullName:"dominant seventh suspended fourth flat thirteenth",displayName:"7(\u266D13)sus4",pcs:[0,5,7,8,10],binary:"100001011010",decimal:1441,intervals:["R","4","5","\u266D13","\u266D7"],aliases:["7sus4b13","7(\u266D13)sus4"]},{key:"m6_9_11_b13",fullName:"minor sixth added ninth eleventh flat thirteenth",displayName:"-6(9,11,\u266D13)",pcs:[0,2,3,5,7,8,9],binary:"101101011100",decimal:941,intervals:["R","9","\u266D3","11","5","\u266D13","6"],aliases:["m6_9_11_b13","-6(9,11,\u266D13)"]},{key:"7b9no3",fullName:"dominant seventh flat ninth no third",displayName:"5(7,\u266D9)",pcs:[0,1,7,10],binary:"110000010010",decimal:1155,intervals:["R","\u266D9","5","\u266D7"],aliases:["7b9no3","5(7,\u266D9)"]},{key:"5b9",fullName:"power chord with flat ninth",displayName:"5(\u266D9)",pcs:[0,1,7],binary:"110000010000",decimal:131,intervals:["R","\u266D9","5"],aliases:["5b9","5(\u266D9)"]},{key:"M7add11",fullName:"major seventh added eleventh",displayName:"\u2206add11",pcs:[0,4,5,7,11],binary:"100011010001",decimal:2225,intervals:["R","3","4","5","\u22067"],aliases:["M7add11","\u2206add11","maj7add11"]},{key:"7sus4add13",fullName:"dominant seventh suspended fourth added thirteenth",displayName:"7(13)sus4",pcs:[0,5,7,9,10],binary:"100001010110",decimal:1697,intervals:["R","4","5","13","\u266D7"],aliases:["7sus4add13","7(13)sus4","13sus4"]},{key:"maj#9#11",fullName:"major sharp ninth sharp eleventh",displayName:"(\u266F9,\u266F11)",pcs:[0,3,4,6,7],binary:"100110110000",decimal:217,intervals:["R","\u266F9","3","\u266F11","5"],aliases:["maj#9#11","(\u266F9,\u266F11)"]},{key:"m6#11",fullName:"minor sixth sharp eleventh",displayName:"-6(\u266F11)",pcs:[0,3,6,7,9],binary:"100100110100",decimal:713,intervals:["R","\u266D3","\u266F11","5","6"],aliases:["m6#11","-6(\u266F11)"]},{key:"augMaj7add13",fullName:"augmented major seventh added thirteenth",displayName:"+\u2206(13)",pcs:[0,4,8,9,11],binary:"100010001101",decimal:2833,intervals:["R","3","\u266F5","13","\u22067"],aliases:["augMaj7add13","+\u2206(13)","+M7(13)"]},{key:"maj13sus4",fullName:"major thirteenth suspended fourth",displayName:"\u220613sus4",pcs:[0,2,5,7,9,11],binary:"101001010101",decimal:2725,intervals:["R","9","4","5","13","\u22067"],aliases:["maj13sus4","\u220613sus4","Maj7(9,13)sus4"]},{key:"maj7b9b13",fullName:"major seventh flat ninth flat thirteenth",displayName:"\u2206(\u266D9,\u266D13)",pcs:[0,1,4,7,8,11],binary:"110010011001",decimal:2451,intervals:["R","\u266D9","3","5","\u266D13","\u22067"],aliases:["maj7b9b13","\u2206(\u266D9,\u266D13)","Maj7\u266D9\u266D13"]},{key:"maj7b5add13",fullName:"major seventh flat fifth added thirteenth",displayName:"\u2206b5(13)",pcs:[0,4,6,9,11],binary:"100010100101",decimal:2641,intervals:["R","3","\u266D5","13","\u22067"],aliases:["maj7b5add13","\u2206b5(13)"]},{key:"7add11",fullName:"dominant seventh added eleventh",displayName:"7(11)",pcs:[0,4,5,7,10],binary:"100011010010",decimal:1201,intervals:["R","3","4","5","\u266D7"],aliases:["7add11","7(11)","dom7add11"]},{key:"m9b13",fullName:"minor ninth flat thirteenth",displayName:"-7(9,\u266D13)",pcs:[0,2,3,7,8,10],binary:"101100011010",decimal:1421,intervals:["R","9","\u266D3","5","\u266D13","\u266D7"],aliases:["m9b13","m7(9,\u266D13)","-7(9,\u266D13)"]},{key:"7b9b13no3",fullName:"dominant flat ninth flat thirteenth no third",displayName:"5(7,\u266D9,\u266D13)",pcs:[0,1,7,8,10],binary:"110000011010",decimal:1411,intervals:["R","\u266D9","5","\u266D13","\u266D7"],aliases:["7b9b13no3","5(7,\u266D9,\u266D13)"]},{key:"dimb9",fullName:"diminished flat ninth",displayName:"\xB0(\u266D9)",pcs:[0,1,3,6],binary:"110100100000",decimal:75,intervals:["R","\u266D9","\u266D3","\u266D5"],aliases:["dimb9","dim\u266D9","\xB0(\u266D9)"]},{key:"5_7_13",fullName:"power chord dominant seventh thirteenth",displayName:"5(7,13)",pcs:[0,7,9,10],binary:"100000010110",decimal:1665,intervals:["R","5","13","\u266D7"],aliases:["5_7_13","5(7,13)"]},{key:"Madd9add11",fullName:"major added ninth added eleventh",displayName:"add9(11)",pcs:[0,2,4,5,7],binary:"101011010000",decimal:181,intervals:["R","9","3","11","5"],aliases:["Madd9add11","add9(11)","add9add11"]},{key:"5add6",fullName:"power chord added sixth",displayName:"5(6)",pcs:[0,7,9],binary:"100000010100",decimal:641,intervals:["R","5","6"],aliases:["5add6","5(6)"]},{key:"5b13",fullName:"power chord flat thirteenth",displayName:"5(\u266D13)",pcs:[0,7,8],binary:"100000011000",decimal:385,intervals:["R","5","\u266D13"],aliases:["5b13","5(\u266D13)"]},{key:"5_7_b13",fullName:"power chord dominant seventh flat thirteenth",displayName:"5(7,\u266D13)",pcs:[0,7,8,10],binary:"100000011010",decimal:1409,intervals:["R","5","\u266D13","\u266D7"],aliases:["5_7_b13","5(7,\u266D13)"]},{key:"5Maj7",fullName:"power chord major seventh",displayName:"5\u2206",pcs:[0,7,11],binary:"100000010001",decimal:2177,intervals:["R","5","\u22067"],aliases:["5Maj7","5\u2206","5maj7"]},{key:"5_7_#11",fullName:"power chord dominant seventh sharp eleventh",displayName:"5(7,\u266F11)",pcs:[0,6,7,10],binary:"100000110010",decimal:1217,intervals:["R","\u266F11","5","\u266D7"],aliases:["5_7_#11","5(7,\u266F11)"]},{key:"5Maj7#11",fullName:"power chord major seventh sharp eleventh",displayName:"5\u2206(\u266F11)",pcs:[0,6,7,11],binary:"100000110001",decimal:2241,intervals:["R","\u266F11","5","\u22067"],aliases:["5Maj7#11","5\u2206(\u266F11)"]},{key:"aug#11",fullName:"augmented sharp eleventh",displayName:"+(\u266F11)",pcs:[0,4,6,8],binary:"100010101000",decimal:337,intervals:["R","3","\u266F11","\u266F5"],aliases:["aug#11","+(\u266F11)","augAdd#11"]},{key:"sus2b13",fullName:"suspended second flat thirteenth",displayName:"(\u266D13)sus2",pcs:[0,2,7,8],binary:"101000011000",decimal:389,intervals:["R","9","5","\u266D13"],aliases:["sus2b13","(\u266D13)sus2"]},{key:"mAdd9#11",fullName:"minor added ninth sharp eleventh",displayName:"m(9,\u266F11)",pcs:[0,2,3,6,7],binary:"101100110000",decimal:205,intervals:["R","9","\u266D3","\u266F11","5"],aliases:["mAdd9#11","m(9,\u266F11)"]},{key:"5b9b13",fullName:"power chord flat ninth flat thirteenth",displayName:"5(\u266D9,\u266D13)",pcs:[0,1,7,8],binary:"110000011000",decimal:387,intervals:["R","\u266D9","5","\u266D13"],aliases:["5b9b13","5(\u266D9,\u266D13)"]},{key:"7b9#5no3",fullName:"dominant seventh flat ninth sharp fifth no third",displayName:"(7,\u266D9,\u266F5)",pcs:[0,1,8,10],binary:"110000001010",decimal:1283,intervals:["R","\u266D9","\u266F5","\u266D7"],aliases:["7b9#5no3","5(7,\u266D9,\u266F5)"]},{key:"6#9",fullName:"major sixth sharp ninth",displayName:"6(\u266F9)",pcs:[0,3,4,7,9],binary:"100110010100",decimal:665,intervals:["R","\u266F9","3","5","6"],aliases:["6#9","6(\u266F9)"]},{key:"7b5b9",fullName:"dominant seventh flat fifth flat ninth",displayName:"7\u266D5\u266D9",pcs:[0,4,6,10,1],binary:"110010100010",decimal:1107,intervals:["R","3","\u266D5","\u266D7","\u266D9"],aliases:["7b5b9","7b9b5"]},{key:"7b5#9",fullName:"dominant seventh flat fifth sharp ninth",displayName:"7\u266D5\u266F9",pcs:[0,4,6,10,3],binary:"100110100010",decimal:1113,intervals:["R","3","\u266D5","\u266D7","\u266F9"],aliases:["7b5#9","7#9b5"]},{key:"M7#9b5",fullName:"major seventh flat fifth sharp ninth",displayName:"\u2206\u266D5\u266F9",pcs:[0,4,6,11,3],binary:"100110100001",decimal:2137,intervals:["R","3","\u266D5","7","\u266F9"],aliases:["M7#9b5","maj7#9b5","M7b5#9"]},{key:"add9no3",fullName:"added ninth no third",displayName:"add9no3",pcs:[0,7,2],binary:"101000010000",decimal:133,intervals:["R","5","9"],aliases:["add9no3","add9(no3)"]},{key:"m11b5",fullName:"minor eleventh flat fifth",displayName:"\xF811",pcs:[0,3,6,10,2,5],binary:"101101100010",decimal:1133,intervals:["R","\u266D3","\u266D5","\u266D7","9","11"],aliases:["m11b5","\xF811","m11(b5)"]}],Nt=new Map;for(let t of Me)Nt.has(t.decimal)||Nt.set(t.decimal,t);function J(){return Me}var ke=null;function fn(){return ke||(ke=new Map(Me.map(t=>[t.key,t]))),ke}function Y(t){return fn().get(t)}function bn(t){let e=t.trim().toUpperCase();return e==="NC"||e==="N.C."||e==="N.C"||e==="X"}var yn={"":"maj","+7":"aug7","+add9":"M#5add9","13sus":"13sus4",2:"sus2",4:"sus4",67:"7add6",69:"6add9","6#11":"M6#11","7+":"aug7","7add13":"7add6","7alt":"alt7","7b6":"7b13","7sus":"7sus4","7b9sus4":"b9sus","7sus4b9":"b9sus","7susb9":"b9sus","9+":"9#5","9sus":"9sus4",M:"maj",M13:"maj13",M6:"6",M69:"6add9","M69#11":"69#11",M7:"maj7","M7#11":"maj#4","maj7#11":"maj#4","M7#5":"augMaj7","M7#9#11":"maj7#9#11","M9#11":"maj9#11","M7+":"augMaj7",M7add13:"maj7add13","M9#5":"maj9#5",addb9:"Maddb9",h7:"m7b5",m:"min","m+":"m#5",m7add4:"m7add11","maj7#5":"augMaj7",mi:"min",mM7:"minMaj7",mM7b6:"mMaj7b6",mMaj7:"minMaj7",o:"dim",phryg:"b9sus",o7:"dim7",oM7:"oM7",sus:"sus4",susb9:"b9sus"},Ne=null;function vn(){if(Ne)return Ne;let t=new Map;for(let e of J())for(let n of e.aliases)t.set(n.toLowerCase(),e.key);for(let e of J())for(let n of e.aliases)t.set(n,e.key);for(let e of J())t.set(e.key,e.key);for(let[e,n]of Object.entries(yn))t.set(e,n);return Ne=t,t}function xn(t){let e=new Set([t,t.toLowerCase()]),n=t.replace(/𝄪/g,"##").replace(/𝄫/g,"bb").replace(/♯/g,"#").replace(/♭/g,"b").replace(/Δ/g,"\u2206");e.add(n),e.add(n.toLowerCase());for(let r of[...e]){let a=r.replace(/^min(?=$|[^a-z])/,"m").replace(/^mi(?=[0-9#♯b♭MΔ∆])/,"m");a!==r&&e.add(a)}return[...e]}function q(t){let e=vn();for(let n of xn(t)){let r=e.get(n);if(r!==void 0&&Y(r))return r}}var wn=/^([A-Ga-g])(𝄪|𝄫|##|bb|♯♯|♭♭|[#♯b♭])?/;function It(t){let e=t.trim();if(!e||bn(e))return null;let n=wn.exec(e);if(!n)return null;let r=n[0],a=_(r);if(!a)return null;let s=e.slice(r.length),i,u=s.lastIndexOf("/");if(u>=0){let p=_(s.slice(u+1));p&&(i=K(p),s=s.slice(0,u))}let d=s,o={symbol:e,rootName:K(a),root:a,suffix:d,...i!==void 0?{bassName:i}:{}},l=q(d);return l!==void 0?{...o,qualityKey:l}:o}var kn=["I","II","III","IV","V","VI","VII"],Mn=[0,2,4,5,7,9,11],Nn=[0,2,3,5,7,8,10];function Ie(t,e){let n=_(e.tonic);if(!n)throw new Error(`Unparseable tonic: ${e.tonic}`);let r=/^([♭♯b#𝄪𝄫]*)(VII|VI|V|IV|III|II|I)$/.exec(t.trim());if(!r)throw new Error(`Unparseable numeral: ${t}`);let a=0;for(let d of r[1])d==="\u266F"||d==="#"?a+=1:d==="\u266D"||d==="b"?a-=1:d==="\u{1D12A}"?a+=2:d==="\u{1D12B}"&&(a-=2);let s=kn.indexOf(r[2])+1,u=(e.mode==="major"?Mn:Nn)[s-1]+a;return K(Mt(n,s-1,u))}var Rn=/^([♭♯b#𝄪𝄫]*)([IiVv]+)(.*)$/,Sn=new Set(["I","II","III","IV","V","VI","VII"]),En=/^(m(?!aj)|min|maj|Maj|M|dim|°|aug|\+|sus|ø|h)/;function An(t){return t===""?"m":En.test(t)?t:"m"+t}var jn=new Set(["%","-"]);function Re(t){return t.replace(/##/g,"\u{1D12A}").replace(/bb/g,"\u{1D12B}").replace(/#/g,"\u266F").replace(/b/g,"\u266D")}function Rt(t){return t.replace(/\([^)]*\)/g,"")}function St(t,e={tonic:"C",mode:"major"}){let n=[];for(let r of t.split("|")){let a=r.trim().split(/\s+/).filter(Boolean);if(a.length===0)continue;if(a.length===1&&jn.has(a[0])){n.push({chords:[],repeat:!0});continue}let s=a.map(Tn).filter(i=>i!==null);s.length>0&&n.push({chords:s})}return{key:e,sections:[{bars:n}]}}function Tn(t){let e=t,n=t.lastIndexOf("/"),r=n>0?t.slice(0,n):t,a=n>0?Re(t.slice(n+1)):void 0,s=Rn.exec(r);if(s&&Sn.has(s[2].toUpperCase())){let u=s[1]??"",d=s[2],o=d!==d.toUpperCase(),l=u+d.toUpperCase(),p=Re(s[3]??"");return o&&(p=An(p)),{source:"degree",degree:{numeral:l,suffix:p},...a?{symbol:{root:"",suffix:"",bass:a}}:{},inputText:e}}let i=It(t);return i?{source:"absolute",symbol:{root:i.rootName,suffix:Re(i.suffix),...i.bassName?{bass:i.bassName}:{}},inputText:e}:null}function $n(t){return t.replace(/𝄪/g,"##").replace(/𝄫/g,"bb").replace(/♯/g,"#").replace(/♭/g,"b")}function Pn(t){let e=$n(t);return q(t)??q(e)??q(Rt(t))??q(Rt(e))}function Cn(t,e){let n,r;t.source==="degree"&&t.degree?(n=Ie(t.degree.numeral,e),r=t.degree.suffix):(n=t.symbol.root,r=t.symbol.suffix);let a=_(n),s=a?H(a):0,i=Pn(r)??null,u=i?Y(i):void 0,d=(u?u.pcs:[0]).map(l=>L(s+l)),o=t.symbol?.bass;return{symbol:n+r+(o?"/"+o:""),rootName:n,rootPc:s,suffix:r,qualityKey:i,pcs:d,...o?{bass:o}:{}}}function Se(t,e=t.key){let n=[],r=[];for(let a of t.sections){let s=a.key??e;for(let i of a.bars){if(i.repeat){n.push(r);continue}r=i.chords.map(u=>Cn(u,s)),n.push(r)}}return n}var Dn=["maj","min","7","maj7","min7","6","m6","dim","dim7","m7b5","9","min9","maj9","minMaj7","7add6","m7add13","7sus4","sus4","sus2","6add9","13","min11"],ps=new Map(Dn.map((t,e)=>[t,e]));function oe(t){let e=t>>>0;return()=>{e|=0,e=e+1831565813|0;let n=Math.imul(e^e>>>15,1|e);return n=n+Math.imul(n^n>>>7,61|n)^n,((n^n>>>14)>>>0)/4294967296}}var ie={staccato:.4,tenuto:.85,legato:1};function Ee(t,e,n){let a=(t%(e*n)+e*n)%(e*n)/e;return a===0?1:Number.isInteger(a)?n%2===0&&a===n/2?.75:.5:a%.5===0?.3:.15}var On=t=>Math.max(1,Math.min(127,Math.round(t)));function Ae(t,e){let n=oe(e.seed),r=t.ticksPerBeat,a=t.meter.numerator,s=r*a,i=typeof e.gate=="string"?ie[e.gate]:e.gate,u=[],d=t.events.map((c,f)=>{let h=n();if(!e.rests)return!0;let x=Ee(c.onset,r,a);return x>=1?!0:h<e.rests*(1-x)?(u.push({index:f,onset:c.onset,kind:"rest",detail:`dropped (weight ${x})`}),!1):!0}),o=[],l=new Set,p=t.events;for(let c=0;c<p.length;c++){if(!d[c])continue;let f={...p[c]};if(f.onset%s===0&&f.onset>0){let x=n();if(e.anticipation&&x<e.anticipation){let g=e.pushTicks??Math.round(r/2),b=f.onset-g,w=0;for(;o.length&&o[o.length-1].onset>=b;)o.pop(),w++;f.onset=b,f.duration+=g,l.add(f),u.push({index:c,onset:p[c].onset,kind:"anticipation",detail:`pushed ${g} ticks early${w?`, replacing ${w} event(s)`:""}`})}}o.push(f)}for(let c=1;c<o.length;c++){if(!l.has(o[c]))continue;let f=o[c-1];f.onset+f.duration>o[c].onset&&(f.duration=Math.max(1,o[c].onset-f.onset))}for(let c of o)if(i!==void 0&&(c.duration=Math.max(1,Math.round(c.duration*i))),e.dynamics){let f=Ee(c.onset,r,a);c.velocity=On(c.velocity+e.dynamics*(f-.5)*30)}return{phrase:{...t,events:o,annotations:{...t.annotations,articulation:JSON.stringify({...i!==void 0&&{gate:i},...e.dynamics&&{dynamics:e.dynamics},...e.rests&&{rests:e.rests},...e.anticipation&&{anticipation:e.anticipation},seed:e.seed})}},changes:u}}function $e(t){let e=[];for(e.push(t&127),t>>=7;t>0;)e.unshift(t&127|128),t>>=7;return e}function Te(t,e){let n=new TextEncoder().encode(e);return[255,t,...$e(n.length),...n]}function Ln(t,e){return[77,84,104,100,0,0,0,6,0,t,0,1,e>>8&255,e&255]}function je(t,e={}){let{bpm:n=120,ticksPerBeat:r=480,trackName:a,markers:s=[],textEvents:i=[]}=e,u=[],d=Math.round(6e7/n);u.push({tick:0,order:0,data:[255,81,3,d>>16&255,d>>8&255,d&255]}),a&&u.push({tick:0,order:1,data:Te(3,a)});for(let c of i)u.push({tick:c.tick,order:1,data:Te(1,c.text)});for(let c of s)u.push({tick:c.tick,order:2,data:Te(6,c.text)});for(let c of t){let f=(c.channel??0)&15,h=c.velocity??96;u.push({tick:c.startTick,order:4,data:[144|f,c.pitch&127,h&127]}),u.push({tick:c.startTick+c.durationTicks,order:3,data:[128|f,c.pitch&127,0]})}u.sort((c,f)=>c.tick-f.tick||c.order-f.order);let o=[],l=0;for(let c of u)o.push(...$e(c.tick-l)),l=c.tick,o.push(...c.data);o.push(...$e(0),255,47,0);let p=o.length;return new Uint8Array([...Ln(0,r),77,84,114,107,p>>24&255,p>>16&255,p>>8&255,p&255,...o])}function Pe(t,e,n,r){let a={level:t,header:e};return t!=="none"&&(a.summary=n),(t==="events"||t==="full")&&(a.events=r),a}var Oe="@enkerli/accompaniment",Le="0.1.0",z=t=>(t%12+12)%12;function Be(t,e){let n=z(e-t);return n<=6?n:n-12}function le(t,e){return e+Be(z(e),t)}function Ce(t,e,n){let r=t;for(;r<e.low;)r+=12;for(;r>e.high;)r-=12;return r<e.low?(r=r+12>e.high?e.low:r+12,n.push(`range-pin:${t}\u2192${r}`)):r!==t&&n.push(`range-octave:${t}\u2192${r}`),r}function De(t,e){for(let n of t)if(e>=n.start&&e<n.end)return n;return t[t.length-1]}function Bn(t,e){let n=[],r=t.events.length,a=Math.ceil(e/t.lengthTicks);for(let s=0;s<a;s++)t.events.forEach((i,u)=>{let d=s*t.lengthTicks+i.onset;if(d>=e)return;let o={ev:i,onset:d},l=i.chordRelation?.target;l!==void 0&&(o.targetIndex=l>u?s*r+l:(s+1)*r+l),n.push(o)});return n}function _e(t,e){if(!e.frames.length)throw new Error("adaptBassPhrase: at least one harmonic frame is required");let n=e.chromaticism??.25,r=e.rhythmPreservation??1,a=e.traceLevel??"summary",s=oe(e.seed),i=e.frames[e.frames.length-1].end,u=t.harmonicFrames?.[0]?.chord.rootPc??0,d=Bn(t,i),o=t.meter.numerator*t.ticksPerBeat,l=d.map(y=>{let M=y.onset%o===0;return r>=1||M||s()<r?y:null}),p=new Array(d.length).fill(null),c=[],f=y=>y.ev.chordRelation?.category==="chromatic-approach",h=null,x=(y,M)=>{let k=De(e.frames,y.onset),$=[],F=y.ev.note??48,E=y.ev.chordRelation,C=Be(u,k.chord.rootPc),I=F+C,R,P;if(E&&E.category==="chord-tone"&&E.degree>=1){let A=k.chord.pcs[(E.degree-1)%k.chord.pcs.length];R=le(z(A),I),P=`chord-tone degree ${E.degree} of ${k.chord.symbol}`}else R=k.chord.pcs.map(D=>le(z(D),I)).reduce((D,U)=>Math.abs(U-I)<Math.abs(D-I)?U:D),P=`nearest chord tone of ${k.chord.symbol} (source ${E?.category??"unrelated"})`;if(R=Ce(R,e.range,$),h!==null&&Math.abs(R-h)>12){let A=Ce(le(z(R),h),e.range,[]);Math.abs(A-h)<Math.abs(R-h)&&($.push(`leap-guard:${R}\u2192${A}`),R=A)}return p[M]=R,h=R,{frame:k,ideal:I,pitch:R,reason:P,repairs:$,srcNote:F}},g=0,b=0,w=0,j=0,S=0,v=new Array(d.length).fill(!1);d.forEach((y,M)=>{if(l[M]===null){w++;return}if(f(y)){v[M]=s()<n;return}let k=x(y,M);y.ev.chordRelation?.category==="chord-tone"&&j++,S+=k.repairs.length,c.push({index:M,onset:y.onset,bar:Math.floor(y.onset/o),...y.ev.sourceEventId!==void 0&&{sourceEventId:y.ev.sourceEventId},category:y.ev.chordRelation?.category??"unrelated",sourceNote:k.srcNote,ideal:k.ideal,chosen:k.pitch,reason:k.reason,...k.repairs.length&&{repairs:k.repairs}})}),d.forEach((y,M)=>{if(l[M]===null||!f(y))return;let k=De(e.frames,y.onset),$=[],F=y.ev.note??48,E=y.targetIndex,C=E!==void 0&&E<p.length?p[E]:null,I,R;if(v[M]&&C!==null&&C!==void 0){let P=y.ev.chordRelation.alteration>=0?1:-1;if(I=C+P,I<e.range.low||I>e.range.high){let A=C-P;A>=e.range.low&&A<=e.range.high&&($.push(`approach-flip:${I}\u2192${A}`),I=A)}R=`chromatic approach to ${C} (${P>0?"above":"below"})`,g++}else{let P=F+Be(u,k.chord.rootPc);I=k.chord.pcs.map(D=>le(z(D),P)).reduce((D,U)=>Math.abs(U-P)<Math.abs(D-P)?U:D),R=C==null?"approach without a resolved target \u2014 snapped to chord tone":"approach snapped to chord tone (chromaticism budget)",b++}I=Ce(I,e.range,$),S+=$.length,p[M]=I,c.push({index:M,onset:y.onset,bar:Math.floor(y.onset/o),...y.ev.sourceEventId!==void 0&&{sourceEventId:y.ev.sourceEventId},category:"chromatic-approach",sourceNote:F,chosen:I,reason:R,...$.length&&{repairs:$}})}),c.sort((y,M)=>y.onset-M.onset);let N=[];d.forEach((y,M)=>{let k=p[M];if(l[M]===null||k===null||k===void 0)return;let $=De(e.frames,y.onset),F=Math.min(y.ev.duration,i-y.onset),E=xe(z(k),$.chord);N.push({onset:y.onset,duration:F,velocity:y.ev.velocity,note:k,pitchClass:z(k),chordRelation:{degree:E,alteration:0,octave:Math.floor(k/12),category:E>0?"chord-tone":"chromatic-approach"},...y.ev.sourceEventId!==void 0&&{sourceEventId:y.ev.sourceEventId}})});let T={v:1,id:`${t.id}-adapted-s${e.seed}`,role:"bass",lengthTicks:i,ticksPerBeat:t.ticksPerBeat,meter:t.meter,source:{note:`adapted from ${t.id} by ${Oe}@${Le} seed ${e.seed}`},events:N,harmonicFrames:e.frames},X=Pe(a,{engine:Oe,engineVersion:Le,seed:e.seed,sourcePhraseId:t.id,frames:e.frames.map(y=>y.chord.symbol),options:{chromaticism:n,rhythmPreservation:r,range:e.range}},{sourceEvents:d.length,outputEvents:N.length,dropped:w,chordTones:j,approachesKept:g,approachesSnapped:b,repairs:S},c);return{phrase:T,trace:X}}function Et(t,e){let n=St(t,{tonic:e.tonic??"C",mode:e.mode??"major"}),r=Se(n);if(!r.length||r.every(d=>!d.length))throw new Error("accompany: no chords parsed from the progression");let s=(n.meta?.timeSig?.[0]??e.beatsPerBar)*e.ticksPerBeat,i=e.bars??r.length,u=[];for(let d=0;d<i;d++){let o=r[d%r.length],l=s/Math.max(1,o.length);o.forEach((p,c)=>{u.push({start:d*s+c*l,end:d*s+(c+1)*l,chord:{symbol:p.symbol,rootPc:p.rootPc,pcs:p.pcs}})})}return u}function ze(t,e){let n=t;if(e.rhythm!==void 0){let c=O(e.rhythm,{n:16});if(!c.ok||!c.steps.length)throw new Error(`accompany: --rhythm "${e.rhythm}" did not parse as UPI${c.error?` \u2014 ${c.error}`:""}`);n=we(n,{steps:c.steps,...c.accents.some(f=>f)&&{accents:c.accents},label:c.label??e.rhythm})}let r=Et(e.progression,{...e.tonic!==void 0&&{tonic:e.tonic},...e.mode!==void 0&&{mode:e.mode},ticksPerBeat:n.ticksPerBeat,beatsPerBar:n.meter.numerator,...e.bars!==void 0&&{bars:e.bars}}),a=_e(n,{frames:r,seed:e.seed??42,range:e.range??{low:36,high:60},...e.chromaticism!==void 0&&{chromaticism:e.chromaticism},...e.rhythmPreservation!==void 0&&{rhythmPreservation:e.rhythmPreservation},traceLevel:e.traceLevel??"events"}),s=a.trace,i=a.phrase,u=[];if(e.gate!==void 0||e.dynamics||e.rests||e.anticipation){let c;if(e.gate!==void 0&&(c=typeof e.gate=="string"&&e.gate in ie?e.gate:Number(e.gate),typeof c=="number"&&(!Number.isFinite(c)||c<=0)))throw new Error(`accompany: --gate wants staccato|tenuto|legato or a factor > 0, not "${e.gate}"`);let f=Ae(i,{seed:e.seed??42,...c!==void 0&&{gate:c},...e.dynamics!==void 0&&{dynamics:e.dynamics},...e.rests!==void 0&&{rests:e.rests},...e.anticipation!==void 0&&{anticipation:e.anticipation}});i=f.phrase,u=f.changes}let d=i.events.map(c=>({pitch:c.note??0,startTick:c.onset,durationTicks:c.duration,velocity:c.velocity})),o=r.map(c=>({tick:c.start,text:c.chord.symbol})),l={header:s.header,...s.summary&&{summary:s.summary}},p=je(d,{bpm:e.bpm??120,ticksPerBeat:n.ticksPerBeat,trackName:"GloriArp bass",markers:o,textEvents:[{tick:0,text:`GLORIARP:v1 TRACE ${JSON.stringify(l)}`}]});return{phrase:i,trace:s,frames:r,smf:p,articulation:u}}var At={v:1,id:"walking-bass-dm7-v1",role:"bass",lengthTicks:1920,ticksPerBeat:480,meter:{numerator:4,denominator:4},source:{note:"hand-written CC0 fixture (GLORIARP_BRIEF \xA719 corpus)"},events:[{onset:0,duration:480,velocity:96,note:38,pitchClass:2,chordRelation:{degree:1,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e0"},{onset:480,duration:480,velocity:88,note:41,pitchClass:5,chordRelation:{degree:2,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e1"},{onset:960,duration:480,velocity:90,note:45,pitchClass:9,chordRelation:{degree:3,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e2"},{onset:1440,duration:480,velocity:92,note:49,pitchClass:1,chordRelation:{degree:0,alteration:-1,octave:4,category:"chromatic-approach",confidence:.75,target:0},sourceEventId:"e3"}],harmonicFrames:[{start:0,end:1920,chord:{symbol:"Dm7",rootPc:2,pcs:[2,5,9,0]}}]};var jt={v:1,id:"funk-ghost-dm7-v1",role:"bass",lengthTicks:1920,ticksPerBeat:480,meter:{numerator:4,denominator:4},source:{note:"hand-written CC0 fixture (GLORIARP_BRIEF \xA719 corpus)"},events:[{onset:0,duration:200,velocity:112,note:38,pitchClass:2,chordRelation:{degree:1,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e0"},{onset:360,duration:90,velocity:42,note:38,pitchClass:2,chordRelation:{degree:1,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e1"},{onset:600,duration:180,velocity:90,note:41,pitchClass:5,chordRelation:{degree:2,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e2"},{onset:720,duration:90,velocity:58,note:38,pitchClass:2,chordRelation:{degree:1,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e3"},{onset:960,duration:200,velocity:102,note:45,pitchClass:9,chordRelation:{degree:3,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e4"},{onset:1200,duration:110,velocity:84,note:48,pitchClass:0,chordRelation:{degree:4,alteration:0,octave:4,category:"chord-tone",confidence:1},sourceEventId:"e5"},{onset:1440,duration:200,velocity:108,note:50,pitchClass:2,chordRelation:{degree:1,alteration:0,octave:4,category:"chord-tone",confidence:1},sourceEventId:"e6"},{onset:1680,duration:130,velocity:64,note:48,pitchClass:0,chordRelation:{degree:4,alteration:0,octave:4,category:"chord-tone",confidence:1},sourceEventId:"e7"}],harmonicFrames:[{start:0,end:1920,chord:{symbol:"Dm7",rootPc:2,pcs:[2,5,9,0]}}]};var Tt={v:1,id:"bossa-dm7-v1",role:"bass",lengthTicks:1920,ticksPerBeat:480,meter:{numerator:4,denominator:4},source:{note:"hand-written CC0 fixture (GLORIARP_BRIEF \xA719 corpus)"},events:[{onset:0,duration:700,velocity:92,note:38,pitchClass:2,chordRelation:{degree:1,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e0"},{onset:720,duration:230,velocity:76,note:45,pitchClass:9,chordRelation:{degree:3,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e1"},{onset:960,duration:700,velocity:86,note:38,pitchClass:2,chordRelation:{degree:1,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e2"},{onset:1680,duration:230,velocity:72,note:45,pitchClass:9,chordRelation:{degree:3,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e3"}],harmonicFrames:[{start:0,end:1920,chord:{symbol:"Dm7",rootPc:2,pcs:[2,5,9,0]}}]};var $t={v:1,id:"two-feel-dm7-v1",role:"bass",lengthTicks:1920,ticksPerBeat:480,meter:{numerator:4,denominator:4},source:{note:"hand-written CC0 fixture (GLORIARP_BRIEF \xA719 corpus)"},events:[{onset:0,duration:900,velocity:95,note:38,pitchClass:2,chordRelation:{degree:1,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e0"},{onset:960,duration:900,velocity:87,note:45,pitchClass:9,chordRelation:{degree:3,alteration:0,octave:3,category:"chord-tone",confidence:1},sourceEventId:"e1"}],harmonicFrames:[{start:0,end:1920,chord:{symbol:"Dm7",rootPc:2,pcs:[2,5,9,0]}}]};var V={vane:yt,serpe:vt},Fe="external",m=(t,e={},...n)=>{let r=document.createElement(t);for(let[a,s]of Object.entries(e))a==="class"?r.className=s:a==="text"?r.textContent=s:a.startsWith("on")&&typeof s=="function"?r.addEventListener(a.slice(2),s):s!=null&&r.setAttribute(a,s);for(let a of n)a!=null&&r.append(a);return r};function Vn(t){let e=`${t.from}\u2192${t.to}`,n=t.body;return t.type==="param"?n.params?`param ${n.mode??"set"} [${e}] ${n.params.map(r=>`${r.id}=${r.value}`).join(" ")}`:`param ${n.mode??"set"} [${e}] ${n.id}=${typeof n.value=="number"?+n.value.toFixed(3):n.value}`:t.type==="command"?`command [${e}] ${n.name}${n.args?`(${Object.entries(n.args).map(([r,a])=>`${r}=${a}`).join(",")})`:""}`:t.type==="pattern"?`pattern [${e}] ${n.steps} steps, mask ${n.mask}${n.name?` (${n.name})`:""}`:`${t.type} [${e}]`}function Un(t,e,n){let r=n.app??"vane",a=m("select",{class:"ws-select","aria-label":"Target tool",onchange:()=>{n.app=a.value,t.save(),i()}},...Object.keys(V).map(u=>m("option",{value:u,text:u,...u===r?{selected:""}:{}})));a.value=r;let s=m("div",{class:"ws-controls"});e.append(m("div",{class:"ws-row"},m("span",{class:"ws-label",text:"tool"}),a),s);function i(){let u=V[a.value];s.replaceChildren();for(let d of u.params){let o=m("span",{class:"ws-readout",text:pe(d,d.default)}),l=m("input",{type:"range",min:"0",max:"1",step:"0.0001",value:String(at(d.default,d)),class:"ws-slider","aria-label":d.label,"data-param":d.id});l.addEventListener("input",()=>{let p=rt(+l.value,d);o.textContent=pe(d,p),t.bus.publish(st(Fe,a.value,d.id,p))}),s.append(m("label",{class:"ws-param"},m("span",{class:"ws-param-name",text:d.label}),l,o))}if(u.commands.length){let d=m("div",{class:"ws-cmds"});for(let o of u.commands){let l=(o.args??[]).reduce((p,c)=>(p[c.id]=c.default,p),{});d.append(m("button",{class:"ws-btn",text:o.label,"data-cmd":o.name,onclick:()=>t.bus.publish(ot(Fe,a.value,o.name,Object.keys(l).length?l:void 0))}))}s.append(d)}}i()}function Wn(t,e,n){let r=m("input",{class:"ws-text",type:"text",value:n.upi??"E(3,8)","aria-label":"UPI notation",spellcheck:"false"}),a=m("div",{class:"ws-lane","aria-hidden":"true"}),s=m("div",{class:"ws-readout"});function i(o,l){a.replaceChildren(...o.map(p=>m("span",{class:`ws-step${p?" on":""}`}))),s.textContent=l}function u(){let o=O(r.value,{n:16});if(!o.ok){s.textContent="unparsed";return}n.upi=r.value,t.save();let l=se(o.steps);i(o.steps,`${l.n} steps \xB7 ${l.k} onsets \xB7 mask ${l.decimal} (${l.hex})`),t.bus.publish(W(Fe,"pattern",{steps:l.n,mask:l.decimal,name:o.label},{to:"*"}))}r.addEventListener("keydown",o=>{o.key==="Enter"&&u()}),e.append(m("div",{class:"ws-row"},r,m("button",{class:"ws-btn",text:"\u25B6 send",onclick:u})),a,s);let d=t.bus.subscribe(o=>{if(o.type!=="pattern")return;let l=Array.from({length:o.body.steps},(p,c)=>o.body.mask>>c&1);i(l,`via bus \u2190 ${o.from}: ${o.body.name??""} (mask ${o.body.mask})`)});return u(),d}function Gn(t,e){let n=m("div",{class:"ws-log",role:"log","aria-live":"polite"});return e.append(n),t.bus.subscribe(r=>{let a=m("div",{class:"ws-logline",text:`${new Date().toLocaleTimeString()}  ${Vn(r)}`});for(n.prepend(a);n.childElementCount>60;)n.lastElementChild.remove()})}var Hn={id:"workspace-bindings",kind:"control-map",label:"Workspace bindings",bindings:[{trigger:{kind:"key",combo:"]"},action:{app:"serpe",command:"rotate",args:{by:1}}},{trigger:{kind:"key",combo:"["},action:{app:"serpe",command:"rotate",args:{by:-1}}},{trigger:{kind:"key",combo:"m"},action:{app:"serpe",command:"mutate"}}]};function Pt(t){let e=[];t.ctrlKey&&e.push("ctrl"),t.altKey&&e.push("alt"),t.metaKey&&e.push("mod"),t.shiftKey&&e.push("shift");let n=String(t.key).toLowerCase();return["control","alt","meta","shift"].includes(n)||e.push(n),e.join("+")}var Kn=t=>t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName),Jn=t=>t.command?`${t.app}.${t.command}${t.args?`(${Object.entries(t.args).map(([e,n])=>`${e}=${n}`).join(",")})`:""}`:`${t.app}.${t.param}=${t.value}`;function Yn(t,e,n){let r=n.map??Hn,a=Object.values(V),s=tt({map:r,manifests:a,send:g=>t.bus.publish(g)}),i=m("div",{class:"ws-controls"}),u={combo:""},d=m("input",{class:"ws-text",type:"text",readonly:"",placeholder:"press a key\u2026","aria-label":"Trigger key"});d.addEventListener("keydown",g=>{g.preventDefault(),u.combo=Pt(g),d.value=u.combo});let o=m("select",{class:"ws-select","aria-label":"Target app",onchange:()=>p()},...Object.keys(V).map(g=>m("option",{value:g,text:g}))),l=m("select",{class:"ws-select","aria-label":"Action"});function p(){let g=V[o.value];l.replaceChildren(...g.commands.map(b=>m("option",{value:`cmd:${b.name}`,text:`\u26A1 ${b.label}`})),...g.params.map(b=>m("option",{value:`param:${b.id}`,text:`\u25B8 ${b.label}`})))}p();let c=m("button",{class:"ws-btn",text:"+ add",onclick:()=>{if(!u.combo||!l.value)return;let[g,b]=l.value.split(":"),w;if(g==="cmd"){let S=(V[o.value].commands.find(v=>v.name===b).args??[]).reduce((v,N)=>(v[N.id]=N.default,v),{});w={app:o.value,command:b,...Object.keys(S).length?{args:S}:{}}}else{let j=V[o.value].params.find(S=>S.id===b);w={app:o.value,param:b,value:j.default}}r=Qe(r,{trigger:{kind:"key",combo:u.combo},action:w}),u.combo="",d.value="",f()}});e.append(i,m("div",{class:"ws-row",style:"flex-wrap:wrap"},d,o,l,c));function f(){n.map=r,s.setMap(r),t.save(),h()}function h(){i.replaceChildren(...r.bindings.map((g,b)=>m("div",{class:"ws-param"},m("span",{class:"ws-readout",style:"text-align:left",text:g.trigger.combo}),m("span",{class:"ws-param-name",style:"overflow:visible",text:Jn(g.action)}),m("button",{class:"ws-x",text:"\u2715",title:"Remove binding","aria-label":`Remove ${g.trigger.combo}`,onclick:()=>{r=Ze(r,b),f()}})))),r.bindings.length||i.append(m("div",{class:"ws-readout",text:"no bindings \u2014 add one below"}))}h();let x=g=>{Kn(g.target)||s.handle({kind:"key",combo:Pt(g)})};return window.addEventListener("keydown",x),()=>window.removeEventListener("keydown",x)}function Xn(t,e){let n;try{n=JSON.parse(e)}catch{return!1}return t.publish(n)}function Qn(t,e,n){return!t||e?.remote?!1:!(t.id&&n.has(t.id))}function Zn(t,e,n){let r=m("input",{class:"ws-text",type:"text",value:n.url??"http://localhost:8765","aria-label":"Bridge URL",spellcheck:"false"}),a=m("span",{class:"ws-readout",text:"not connected"}),s=m("div",{class:"ws-readout",text:"msuite accompany --play | msuite bridge  \xB7  full duplex: this tab's own actions POST back"}),i=null,u=null,d=0,o=0,l=new Map;function p(g){if(!g)return;let b=Date.now();l.set(g,b);for(let[w,j]of l)b-j>5e3&&l.delete(w)}let c=g=>{a.textContent=`${g} \xB7 in ${d} \xB7 out ${o}`};function f(){i?.close(),i=null,u?.(),u=null,x.textContent="connect",a.textContent="not connected"}function h(){if(typeof EventSource>"u"){a.textContent="no EventSource in this browser";return}f(),n.url=r.value,t.save(),d=0,o=0;let g=r.value.replace(/\/$/,"");i=new EventSource(`${g}/events`),x.textContent="disconnect",a.textContent="connecting\u2026",i.onopen=()=>c("connected"),i.onerror=()=>{a.textContent="retrying\u2026 (is the bridge running?)"},i.onmessage=b=>{let w;try{w=JSON.parse(b.data)}catch{return}p(w.id),Xn(t.bus,b.data)&&(d++,c("connected"))},u=t.bus.subscribe((b,w)=>{typeof fetch!="function"||!Qn(b,w,l)||fetch(`${g}/send`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(()=>{o++,c("connected")}).catch(()=>{})})}let x=m("button",{class:"ws-btn",text:"connect",onclick:()=>i?f():h()});return e.append(m("div",{class:"ws-row"},r,x),a,s),()=>f()}var Ct={"walking-bass":At,"funk-ghost":jt,bossa:Tt,"two-feel":$t};function er({bus:t,now:e=()=>Date.now(),schedule:n=(a,s)=>setTimeout(a,s),clear:r=clearTimeout}){let a=[],s=!1,i=()=>{s=!1,a.forEach(r),a=[]};function u(d,{bpm:o=100,loop:l=!1,to:p="vane"}={}){i(),s=!0;let c=6e4/(o*d.ticksPerBeat),f=d.lengthTicks*c,h=e(),x=g=>{for(let b of d.events){if(b.note===void 0)continue;let w=h+g*f+b.onset*c;a.push(n(()=>{s&&t.publish(He("external",{notes:[b.note],velocity:b.velocity,durationMs:Math.max(1,Math.round(b.duration*c))},{to:p}))},Math.max(0,w-e())))}l&&a.push(n(()=>{s&&(a=a.filter(Boolean),x(g+1))},Math.max(0,h+(g+1)*f-e())))};x(0)}return{start:u,stop:i,isRunning:()=>s}}function tr(t,e,n){let r=(v,N)=>n[v]??N,a=er({bus:t.bus}),s=m("div",{class:"ws-readout",text:"set a progression, press \u25B6"}),i=m("input",{class:"ws-text",type:"text",value:r("progression","Dm7 | G7 | Cmaj7 | A7"),"aria-label":"Progression (bar notation)",spellcheck:"false"}),u=m("select",{class:"ws-select","aria-label":"Style"},...Object.keys(Ct).map(v=>m("option",{value:v,text:v,...v===r("style","walking-bass")?{selected:""}:{}}))),d=m("input",{class:"ws-text",type:"text",value:r("rhythm",""),placeholder:"rhythm UPI (E(3,8)\u2026)","aria-label":"Rhythm UPI",spellcheck:"false"}),o=m("input",{class:"ws-text ws-num",type:"number",value:r("seed",42),"aria-label":"Seed"}),l=m("input",{class:"ws-text ws-num",type:"number",min:30,max:300,value:r("bpm",100),"aria-label":"BPM"}),p=m("select",{class:"ws-select","aria-label":"Gate"},...["legato","tenuto","staccato"].map(v=>m("option",{value:v,text:v,...v===r("gate","legato")?{selected:""}:{}}))),c=(v,N,T)=>{let X=m("input",{class:"ws-text ws-num",type:"number",min:0,max:1,step:.1,value:r(v,T),"aria-label":N});return{input:X,row:m("label",{class:"ws-ctl",text:N+" "},X)}},f=c("dynamics","dynamics",.6),h=c("rests","rests",0),x=c("anticipation","push",0),g=m("input",{type:"checkbox",...r("loop",!0)?{checked:""}:{},"aria-label":"Loop"});function b(){let v={progression:i.value,seed:Number(o.value)||42,bpm:Number(l.value)||100,gate:p.value,dynamics:Number(f.input.value)||0,rests:Number(h.input.value)||0,anticipation:Number(x.input.value)||0,...d.value.trim()&&{rhythm:d.value.trim()}};return Object.assign(n,v,{style:u.value,loop:g.checked}),t.save(),ze(Ct[u.value],v)}function w(){try{let v=b();a.start(v.phrase,{bpm:Number(l.value)||100,loop:g.checked});let N=v.trace.summary;s.textContent=`\u25B6 ${v.phrase.events.length} notes \xB7 ${v.frames.map(T=>T.chord.symbol).join(" | ")}`+(N?` \xB7 ${N.approachesKept} approaches`:"")+(g.checked?" \xB7 looping":"")}catch(v){s.textContent="\u2717 "+(v&&v.message||v)}}function j(){a.stop(),s.textContent="stopped"}function S(){try{let v=b(),N=new Blob([v.smf],{type:"audio/midi"}),T=document.createElement("a");T.href=URL.createObjectURL(N),T.download=`gloriarp-${u.value}-s${o.value}.mid`,T.click(),URL.revokeObjectURL(T.href),s.textContent=`\u2B07 ${T.download} \u2014 drop it in a DAW / plugin`}catch(v){s.textContent="\u2717 "+(v&&v.message||v)}}return e.append(m("div",{class:"ws-row"},i),m("div",{class:"ws-row",style:"flex-wrap:wrap"},u,d),m("div",{class:"ws-row",style:"flex-wrap:wrap"},m("label",{class:"ws-ctl",text:"seed "},o),m("label",{class:"ws-ctl",text:"bpm "},l),m("label",{class:"ws-ctl",text:"gate "},p),f.row,h.row,x.row),m("div",{class:"ws-row"},m("button",{class:"ws-btn",text:"\u25B6 play",onclick:w}),m("button",{class:"ws-btn",text:"\u25A0 stop",onclick:j}),m("label",{class:"ws-ctl"},g," loop"),m("button",{class:"ws-btn",text:"\u2B07 .mid",title:"Download the identical take the CLI would write \u2014 for a DAW or plugin",onclick:S})),s),()=>a.stop()}var qe={"control-surface":{title:"Control Surface",make:Un},pattern:{title:"Pattern (UPI)",make:Wn},bindings:{title:"Bindings",make:Yn},monitor:{title:"Bus Monitor",make:Gn},bridge:{title:"Bridge (CLI)",make:Zn},gloriarp:{title:"GloriArp",make:tr}};var Dt=`/**
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
`;var Ot=`/**
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
`;var Lt=`/* Suite Workspace \u2014 floating movable modules over the design tokens. */
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

/* GloriArp module */
.ws-ctl { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--es-fg-muted, #999); }
.ws-num { width: 4.5em; }
`;var Ve="enkerli.workspace.v1";function sr(){let t=document.createElement("style");t.textContent=[Dt,Ot,Lt].join(`
`),document.head.append(t)}function or(){sr();let t=new te({channelName:"enkerli-workspace"}),e=m("div",{class:"ws-canvas"}),n=lr(),r=n.seq??0,a=new Map,s={bus:t,save:i};function i(){cr({seq:r,modules:[...a.values()].map(l=>l.def)})}function u(l,p={}){let c=qe[l];if(!c)return;let f=p.id??`m${++r}`,h={id:f,type:l,app:p.app,upi:p.upi,x:p.x??24+a.size*28%240,y:p.y??24+a.size*24%200},x=m("div",{class:"ws-body"}),g=m("section",{class:"ws-module",style:`left:${h.x}px; top:${h.y}px`,"aria-label":c.title},m("header",{class:"ws-head"},m("span",{class:"ws-title",text:c.title}),m("button",{class:"ws-x",text:"\u2715",title:"Remove","aria-label":`Remove ${c.title}`,onclick:()=>d(f)})),x);e.append(g),ir(g,g.querySelector(".ws-head"),h,i);let b=c.make(s,x,h);a.set(f,{def:h,cleanup:b,panel:g}),i()}function d(l){let p=a.get(l);p&&(typeof p.cleanup=="function"&&p.cleanup(),p.panel.remove(),a.delete(l),i())}let o=m("select",{class:"ws-select","aria-label":"Add a module",onchange:()=>{o.value&&(u(o.value),o.value="")}},m("option",{value:"",text:"+ add module"}),...Object.entries(qe).map(([l,p])=>m("option",{value:l,text:p.title})));if(document.body.append(m("header",{class:"ws-topbar"},m("span",{class:"ws-brand",text:"Suite Workspace"}),m("span",{class:"ws-tagline",text:"modules on one bus \u2014 drag to arrange"}),o,m("button",{class:"ws-btn ghost",text:"reset",title:"Clear layout",onclick:()=>{localStorage.removeItem(Ve),location.reload()}})),e),n.modules&&n.modules.length)for(let l of n.modules)u(l.type,l);else u("control-surface",{app:"vane",x:24,y:24}),u("pattern",{x:360,y:24}),u("bindings",{x:360,y:300}),u("monitor",{x:24,y:300})}function ir(t,e,n,r){let a=0,s=0,i=0,u=0,d=!1;e.style.cursor="grab",e.addEventListener("pointerdown",l=>{l.target.closest(".ws-x")||(d=!0,a=l.clientX,s=l.clientY,i=n.x,u=n.y,e.setPointerCapture?.(l.pointerId),e.style.cursor="grabbing",t.classList.add("dragging"))}),e.addEventListener("pointermove",l=>{d&&(n.x=Math.max(0,i+(l.clientX-a)),n.y=Math.max(0,u+(l.clientY-s)),t.style.left=n.x+"px",t.style.top=n.y+"px")});let o=()=>{d&&(d=!1,e.style.cursor="grab",t.classList.remove("dragging"),r())};e.addEventListener("pointerup",o),e.addEventListener("pointercancel",o)}function lr(){try{return JSON.parse(localStorage.getItem(Ve))||{}}catch{return{}}}function cr(t){try{localStorage.setItem(Ve,JSON.stringify(t))}catch{}}typeof document<"u"&&or();})();

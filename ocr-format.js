'use strict';
const OCRFormat=(()=>{
// Weak vision models often emit LaTeX commands without the leading backslash
// (e.g. "$triangle ABC$", "$angle BAC=60^\\circ$"). Repair those, then turn common
// symbol commands into real Unicode characters so the editable text stays readable
// and preview/print is correct even before KaTeX is available.
const SYMBOLS={triangle:'△',angle:'∠',perp:'⊥',parallel:'∥',approx:'≈',neq:'≠',le:'≤',leq:'≤',ge:'≥',geq:'≥',circ:'°',degree:'°',pi:'π',infty:'∞',pm:'±',mp:'∓',times:'×',div:'÷',cdot:'·',therefore:'∴',because:'∵',ldots:'…',cdots:'⋯',sim:'∼',cong:'≅',subset:'⊂',subseteq:'⊆',cup:'∪',cap:'∩',in:'∈',notin:'∉',alpha:'α',beta:'β',gamma:'γ',delta:'δ',theta:'θ',lambda:'λ',mu:'μ',rho:'ρ',phi:'φ',psi:'ψ',sigma:'σ',omega:'ω',Delta:'Δ',Sigma:'Σ',Omega:'Ω',odot:'⊙',equiv:'≡',propto:'∝',forall:'∀',exists:'∃',nabla:'∇',partial:'∂',prime:'′'};
const COMMANDS=Object.keys(SYMBOLS).concat(['frac','dfrac','sqrt','vec','overrightarrow','overline','underline','text','mathrm','mathbf','left','right','quad','qquad','sum','int','prod','lim','sin','cos','tan','cot','log','ln','max','min','det','bmod','top','bot','begin','end','limits','displaystyle','overset','underset','binom']);
const rxEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const MISSING=COMMANDS.map(name=>[new RegExp('(?<![\\\\A-Za-z])'+rxEsc(name)+'(?![a-z])','g'),'\\'+name]);
const CONVERT=Object.entries(SYMBOLS).map(([name,symbol])=>[new RegExp('\\\\'+rxEsc(name)+'(?![a-z])','g'),symbol]);
function repairMath(formula){let out=String(formula).replace(/\^\{?\\?(?:circ|degree)\}?/g,'°');for(const [rx,to] of MISSING)out=out.replace(rx,to);for(const [rx,to] of CONVERT)out=out.replace(rx,to);return out.replace(/([△∠])\s+(?=[A-Za-z])/g,'$1')}
// A formula with no LaTeX-only syntax can be shown as plain text (better than a KaTeX dependency).
const isPlain=formula=>!/[\\{}_^]/.test(formula);
// Recognize math boundaries, not escaped dollar signs or currency such as "$5 and $10".
// Adjacent inline formulas joined only by a ratio separator (":" or "∶") render
// badly apart: the colon falls outside math and shows as a small raised glyph with
// wide gaps. Merge them into one formula so the ratio is typeset as a whole.
const RATIO=/^\s*[:∶]\s*$/;
function mergeRatio(parts){const out=[];for(let i=0;i<parts.length;i++){const part=parts[i];if(part.kind==='math'&&!part.display){let formula=part.formula,n=0;while(i+n+2<parts.length&&parts[i+n+1].kind==='text'&&RATIO.test(parts[i+n+1].value)&&parts[i+n+2].kind==='math'&&!parts[i+n+2].display){formula+=':'+parts[i+n+2].formula;n+=2}if(n){out.push({kind:'math',value:'$'+formula+'$',formula,display:false});i+=n;continue}}out.push(part)}return out}
function segments(text){const out=[];const pattern=/(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\\)\$(?![\s$])((?:\\[^\n]|[^$\\\n])+?)(?<![\s\\])\$(?!\d)/g;let end=0,m;while((m=pattern.exec(text))){out.push({kind:'text',value:text.slice(end,m.index)});const formula=repairMath(m[1]??m[2]??m[3]??m[4]);const open=m[1]!==undefined?'$$':m[2]!==undefined?'\\[':m[3]!==undefined?'\\(': '$';const close=m[1]!==undefined?'$$':m[2]!==undefined?'\\]':m[3]!==undefined?'\\)':'$';out.push({kind:'math',value:open+formula+close,formula,display:m[1]!==undefined||m[2]!==undefined});end=pattern.lastIndex}out.push({kind:'text',value:text.slice(end)});return mergeRatio(out)}
function normalize(text){return segments(String(text)).map(part=>{
 if(part.kind==='math'){const inner=part.formula.trim();if(/^(?:\\_\s*){2,}$/.test(inner))return inner.replace(/\\_/g,'_');return isPlain(inner)?inner:part.value}
 // Markdown punctuation escapes are unnecessary in plain text. Do not unescape TeX commands or braces.
 return part.value.replace(/\\([_*#%&!])/g,'$1');
}).join('')}
return {normalize,segments,repairMath};})();
if(typeof module!=='undefined'&&module.exports)module.exports=OCRFormat;
if(typeof window!=='undefined')window.OCRFormat=OCRFormat;
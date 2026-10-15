'use strict';
const OCRFormat=(()=>{
// Recognize math boundaries, not escaped dollar signs or currency such as "$5 and $10".
function segments(text){const out=[];const pattern=/(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\\)\$(?![\s$])((?:\\[^\n]|[^$\\\n])+?)(?<![\s\\])\$(?!\d)/g;let end=0,m;while((m=pattern.exec(text))){out.push({kind:'text',value:text.slice(end,m.index)});out.push({kind:'math',value:m[0],formula:m[1]||m[2]||m[3]||m[4],display:!!(m[1]||m[2])});end=pattern.lastIndex}out.push({kind:'text',value:text.slice(end)});return out}
function normalize(text){return segments(String(text)).map(part=>{
 if(part.kind==='math'){const inner=part.formula.trim();if(/^(?:\\_\s*){2,}$/.test(inner))return inner.replace(/\\_/g,'_');return part.value}
 // Markdown punctuation escapes are unnecessary in plain text. Do not unescape TeX commands or braces.
 return part.value.replace(/\\([_*#%&!])/g,'$1');
}).join('')}
return {normalize,segments};})();
if(typeof module!=='undefined'&&module.exports)module.exports=OCRFormat;
if(typeof window!=='undefined')window.OCRFormat=OCRFormat;

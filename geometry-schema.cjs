'use strict';
// Only validated geometry primitives may reach the browser. Never accept raw SVG/HTML from a model.
function parseDrawing(text){let value;try{const fence=String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);const raw=fence?fence[1]:String(text);value=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1))}catch{return null}
if(!value||!Array.isArray(value.points)||!Array.isArray(value.lines)||value.points.length>24||value.lines.length>40)return null;
const points=value.points.map(p=>{if(!p||typeof p.name!=='string'||!/^[A-Za-z][A-Za-z0-9']{0,3}$/.test(p.name)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1000||p.y<0||p.y>1000)return null;return {name:p.name,x:p.x,y:p.y}});if(points.some(p=>!p)||new Set(points.map(p=>p.name)).size!==points.length||points.length<2)return null;
const names=new Set(points.map(p=>p.name)),lines=value.lines.map(line=>{if(!Array.isArray(line)||line.length!==2||!names.has(line[0])||!names.has(line[1])||line[0]===line[1])return null;return line});if(lines.some(x=>!x))return null;
return {points,lines,label:typeof value.label==='string'?value.label.slice(0,25):''};}
module.exports={parseDrawing};

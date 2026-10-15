'use strict';
function parseBoxes(text){
  let value;try{const fenced=String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);const raw=fenced?fenced[1]:String(text);const start=raw.indexOf('{'),end=raw.lastIndexOf('}');value=JSON.parse(raw.slice(start,end+1))}catch{return []}
  if(!Array.isArray(value.figures))return [];
  return value.figures.slice(0,8).flatMap((f)=>{if(!f||!Array.isArray(f.box)||f.box.length!==4||!f.box.every(v=>typeof v==='number'&&Number.isFinite(v)))return [];const [x1,y1,x2,y2]=f.box;if(x1<0||y1<0||x2>1000||y2>1000||x2-x1<25||y2-y1<25)return [];return [{box:[x1,y1,x2,y2],label:typeof f.label==='string'?f.label.slice(0,30):''}]});
}
module.exports={parseBoxes};

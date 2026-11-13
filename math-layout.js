'use strict';
// Keep the OCR source editable; pair original-image crops with diagram placeholders only in preview/export.
const MathLayoutCore = (() => {
  const MARK = '【图形需保留原图】';
  function parts(text) {
    const out=[]; let cursor=0,number=0;
    while(true){
      const start=text.indexOf(MARK,cursor);
      if(start<0){out.push({kind:'text',value:text.slice(cursor),start:cursor});break}
      if(start>cursor)out.push({kind:'text',value:text.slice(cursor,start),start:cursor});
      let end=start+MARK.length;
      while(end<text.length&&/\s/.test(text[end]))end++;
      // The model often appends a long parenthesized *description*, not an actual image.
      if(text[end]==='（'||text[end]==='('){let depth=0;for(let i=end;i<text.length;i++){const c=text[i];if(c==='（'||c==='(')depth++;else if(c==='）'||c===')'){depth--;if(depth===0){end=i+1;break}}if(depth>0&&i===text.length-1)end=i+1}}
      out.push({kind:'figure',index:number++});cursor=end;
    }
    return out;
  }
  function problem(text,figures){const count=parts(text).filter(p=>p.kind==='figure').length;if(count>figures.length)return `题目有 ${count} 处图形占位符，但只截取了 ${figures.length} 张原图。请在左侧原图依次圈出图1、图2并点击“加入原图插图”；缺图时不能导出。`;if(count&&figures.length>count)return `题目有 ${count} 处图形占位符，却截取了 ${figures.length} 张图片。请移除多余插图再导出。`;return ''}
  function uncertain(text){const re=/【待核对(?:[:：]([^】]*))?】/g;const out=[];let m;while((m=re.exec(text)))out.push({start:m.index,end:re.lastIndex,value:m[1]||'待核对'});return out}
  // Copy-safe formula rendering for exported/standalone HTML: MathML makes paste targets
  // break one token per line, so the export uses ordinary inline text with <sub>/<sup>.
  function mathHtml(formula){
    const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let s=esc(formula);
    const loop=(re,to)=>{let prev;do{prev=s;s=s.replace(re,to)}while(s!==prev)};
    const simple=v=>/^(?:[A-Za-z]|[0-9]{1,3}|[°′△∠⊥∥π√])$/.test(v)?v:'('+v+')';
    loop(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g,(m,a,b)=>simple(a)+'/'+simple(b));
    loop(/\\sqrt\{([^{}]*)\}/g,(m,a)=>'√<span class="sqrt">'+a+'</span>');
    s=s.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g,'$1');
    s=s.replace(/\\overline\{([^{}]*)\}/g,'<span class="ol">$1</span>');
    s=s.replace(/\\(?:vec|overrightarrow)\{([^{}]*)\}/g,'→$1');
    s=s.replace(/\\left([([|])/g,'$1').replace(/\\right([)\]|])/g,'$1');
    s=s.replace(/\\(?:quad|qquad| )/g,' ').replace(/\\([,;:!])/g,' ');
    loop(/\\([A-Za-z]+)\{([^{}]*)\}/g,'$2');
    s=s.replace(/\\([A-Za-z]+)/g,'').replace(/\\(.)/g,'$1');
    loop(/([_^])\{([^{}]*)\}/g,(m,c,v)=>c==='_'?'<sub>'+v+'</sub>':'<sup>'+v+'</sup>');
    loop(/([_^])([A-Za-z0-9])/g,(m,c,v)=>c==='_'?'<sub>'+v+'</sub>':'<sup>'+v+'</sup>');
    return s.replace(/[{}]/g,'');
  }
  // Plain-text formula for TXT download / copy: no "$", braces or sub/sup markup, so the
  // result reads like the printed question (S_{△ABP} -> S△ABP, x^2 -> x², \frac{a}{b} -> a/b).
  const SUP={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','n':'ⁿ','i':'ⁱ'};
  const sup=v=>[...v].every(c=>SUP[c])?[...v].map(c=>SUP[c]).join(''):'^('+v+')';
  function mathText(formula){
    let s=String(formula);
    const loop=(re,to)=>{let prev;do{prev=s;s=s.replace(re,to)}while(s!==prev)};
    const simple=v=>/^(?:[A-Za-z]|[0-9]{1,3}|[°′△∠⊥∥π√])$/.test(v)?v:'('+v+')';
    loop(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g,(m,a,b)=>simple(a)+'/'+simple(b));
    loop(/\\sqrt\{([^{}]*)\}/g,(m,a)=>/^.{1,3}$/.test(a)?'√'+a:'√('+a+')');
    s=s.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g,'$1');
    s=s.replace(/\\overline\{([^{}]*)\}/g,'$1');
    s=s.replace(/\\(?:vec|overrightarrow)\{([^{}]*)\}/g,'→$1');
    s=s.replace(/\\left([([|])/g,'$1').replace(/\\right([)\]|])/g,'$1');
    s=s.replace(/\\(?:quad|qquad| )/g,' ').replace(/\\([,;:!])/g,' ');
    loop(/\\([A-Za-z]+)\{([^{}]*)\}/g,'$2');
    s=s.replace(/\\([A-Za-z]+)/g,'').replace(/\\(.)/g,'$1');
    loop(/([_^])\{([^{}]*)\}/g,(m,c,v)=>c==='^'?sup(v):v);
    loop(/([_^])([A-Za-z0-9])/g,(m,c,v)=>c==='^'?sup(v):v);
    return s.replace(/[{}]/g,'');
  }
  return {parts,problem,uncertain,mathHtml,mathText};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=MathLayoutCore;
if(typeof document!=='undefined')(()=>{
  const $=id=>document.getElementById(id),editor=$('editor');
  const panel=document.createElement('section');panel.innerHTML='<h3>公式与图文排版预览</h3><div id="mathNotice" role="status" style="margin-bottom:8px;color:#9a4d2a"></div><div id="typesetPreview" style="white-space:pre-wrap;line-height:2;padding:16px;border:1px solid #dbe5db;border-radius:8px;background:white"></div><div id="figureList"></div>';
  editor.insertAdjacentElement('afterend',panel);
  const preview=$('typesetPreview'),notice=$('mathNotice');let figures=[],loading,timer;
  const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/katex/katex.min.css';document.head.appendChild(css);
  function load(){if(window.katex)return Promise.resolve();if(loading)return loading;loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/assets/katex/katex.min.js';script.onload=resolve;script.onerror=()=>{loading=null;reject(Error('公式组件加载失败，请检查网络后重新编辑文本重试'))};document.head.appendChild(script)});return loading}
  function renderText(target,text,plain=false){let errors=0;for(const part of window.OCRFormat.segments(text)){if(part.kind==='text'){target.append(document.createTextNode(window.OCRFormat.normalize(part.value).replace(/\\\$/g,'$')));continue}const span=document.createElement('span');if(plain){span.innerHTML=MathLayoutCore.mathHtml(part.formula)}else{try{window.katex.render(part.formula,span,{displayMode:part.display,throwOnError:true,trust:false,strict:'ignore',output:'mathml',maxExpand:1000})}catch{span.textContent=part.value;span.style.color='#a54124';span.title='公式无法解析，请在原文中修正';errors++}}target.append(span)}return errors}
  function renderMarked(target,text,offset=0,plain=false){let cursor=0,errors=0;for(const item of MathLayoutCore.uncertain(text)){errors+=renderText(target,text.slice(cursor,item.start),plain);const mark=document.createElement('mark');mark.style.cssText='background:#fff1b8;color:#9a4100;border-bottom:2px dashed #dc8a00;padding:2px 4px;cursor:pointer;print-color-adjust:exact';mark.title='模型报告此处不确定，点击定位到原文';errors+=renderText(mark,item.value,plain);mark.onclick=()=>{window.showResultPanel?.();editor.focus();editor.setSelectionRange(offset+item.start,offset+item.end)};target.append(mark);cursor=item.end}errors+=renderText(target,text.slice(cursor),plain);return errors}
  const review=document.createElement('div');review.className='tools';const count=document.createElement('span'),next=document.createElement('button'),confirm=document.createElement('button');next.textContent='下一处待确认';confirm.textContent='确认当前标记';review.append(count,next,confirm);preview.before(review);
  function updateCount(){const n=MathLayoutCore.uncertain(editor.value).length;count.textContent=n?'待确认 '+n+' 处（橙色）':'无模型标记的不确定项';next.disabled=!n;confirm.disabled=!n}
  next.onclick=()=>{const items=MathLayoutCore.uncertain(editor.value);if(!items.length)return;const item=items.find(x=>x.start>=editor.selectionEnd)||items[0];window.showResultPanel?.();editor.focus();editor.setSelectionRange(item.start,item.end)};
  confirm.onclick=()=>{const items=MathLayoutCore.uncertain(editor.value),item=items.find(x=>editor.selectionStart>=x.start&&editor.selectionStart<x.end);if(!item)return;if(item.value==='待核对'||item.value==='无法辨认'){notice.textContent='请先在原文补写正确内容，再移除待核对标记';return}editor.setRangeText(item.value,item.start,item.end,'end');editor.dispatchEvent(new Event('input'))};
  function appendFigure(target,src,n){const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');figure.style.cssText='break-inside:avoid;margin:15px 0';img.src=src;img.alt='原题图'+n;img.style.cssText='max-width:100%;max-height:220mm;object-fit:contain';caption.textContent='图'+n+'（原题图片）';figure.append(img,caption);target.append(figure)}
  function compose(target,plain=false){target.replaceChildren();let errors=0,markers=0;for(const part of MathLayoutCore.parts(editor.value)){if(part.kind==='text'){const section=document.createElement('span');errors+=renderMarked(section,part.value,part.start,plain);target.append(section)}else{markers++;const src=figures[part.index];if(src)appendFigure(target,src,part.index+1);else{const warning=document.createElement('strong');warning.textContent=`【图${part.index+1}未加入原图】`;warning.style.color='#ad3c25';target.append(warning)}}}if(!markers)figures.forEach((src,i)=>appendFigure(target,src,i+1));return errors}
  async function refresh(){updateCount();try{await load();const errors=compose(preview),warning=MathLayoutCore.problem(editor.value,figures);notice.textContent=warning||(errors?`有 ${errors} 处公式无法解析，已保留原文，请修正。`:'原文可继续编辑；打印/导出会在占位位置插入真实裁剪图片。');return errors===0}catch(e){preview.textContent=editor.value;notice.textContent=e.message;return false}}
  editor.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(refresh,180)});window.refreshMathPreview=refresh;
  window.mathPlainText=text=>window.OCRFormat.segments(String(text)).map(part=>part.kind==='text'?window.OCRFormat.normalize(part.value).replace(/\\\$/g,'$'):MathLayoutCore.mathText(part.formula)).join('');
  function figuresView(){const list=$('figureList');list.replaceChildren();figures.forEach((src,i)=>{const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption'),button=document.createElement('button');img.src=src;img.alt='原图图'+(i+1);img.style.cssText='max-width:100%;max-height:220px';caption.textContent='图'+(i+1)+'（真实原图裁剪）';button.textContent='移除此图';button.onclick=()=>{figures.splice(i,1);figuresView();refresh()};figure.append(img,caption,button);list.append(figure)})}
  $('saveFigure').addEventListener('click',()=>{const img=$('figurePreview');if(img.src.startsWith('data:image/png')){figures.push(img.src);figuresView();$('figureWrap').hidden=true;refresh()}});
  $('removeFigure').addEventListener('click',()=>{figures=[];figuresView();refresh()});window.addManualMathFigure=(src,target)=>{if(target==='append'){if(figures.length>=8)throw Error('最多8张插图，请先移除不需要的图');figures.push(src)}else{const index=Number(target);if(index>figures.length)throw Error('请按顺序添加图形，不能跳过前面的图号');figures[index]=src}figuresView();refresh()};window.clearMathFigures=()=>{figures=[];figuresView();refresh()};
  async function ready(){const uncertainCount=MathLayoutCore.uncertain(editor.value).length;if(uncertainCount&&!window.confirm('仍有 '+uncertainCount+' 处待确认内容，导出/打印将保留橙色标记。继续吗？'))return false;if(!editor.value.trim()&&!figures.length){notice.textContent='请先输入题目或添加插图';return false}const missing=MathLayoutCore.problem(editor.value,figures);if(missing){notice.textContent=missing;alert(missing);return false}if(!await refresh()){notice.textContent+=' 请修正公式或等待组件加载后再导出。';return false}return true}
  $('print').onclick=async()=>{if(!await ready())return;const target=$('printPage');compose(target);await Promise.all([...target.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));await document.fonts.ready;window.print()};
  const htmlDialog=document.createElement('dialog');htmlDialog.style.cssText='width:96vw;max-width:1200px;height:94dvh;max-height:94dvh;padding:12px;border:1px solid #adc4b2;border-radius:12px';htmlDialog.innerHTML='<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><strong>图文 HTML 预览</strong><button type="button" style="margin-left:auto">关闭预览</button></div><iframe title="题目图文HTML预览" sandbox="" style="width:100%;flex:1;min-height:0;border:1px solid #dbe5db;background:white"></iframe>';document.body.append(htmlDialog);htmlDialog.querySelector('button').onclick=()=>htmlDialog.close();
  $('downloadHtml').textContent='预览 HTML';
  $('downloadHtml').onclick=async()=>{if(!await ready())return;const content=document.createElement('div');compose(content,true);const doc='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>题目图文预览</title><style>body{max-width:800px;margin:30px auto;padding:0 20px;font:16px/2 sans-serif;white-space:pre-wrap;overflow-wrap:anywhere}img{max-width:100%;height:auto}figure{break-inside:avoid}sub,sup{font-size:.72em;line-height:0}sup{vertical-align:super}sub{vertical-align:sub}.sqrt{border-top:1px solid currentColor;padding:0 .12em}.ol{text-decoration:overline}@media print{body{margin:0}}</style><body>'+content.innerHTML+'</body></html>';htmlDialog.querySelector('iframe').srcdoc=doc;htmlDialog.showModal();htmlDialog.style.display='flex';htmlDialog.style.flexDirection='column';notice.textContent='已打开 HTML 预览：公式以可复制的内联文本排版（复制不会逐字符换行），插图与打印输出一致。'};
  htmlDialog.addEventListener('close',()=>{htmlDialog.style.display='';htmlDialog.querySelector('iframe').srcdoc=''});

  refresh();
})();

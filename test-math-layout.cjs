const assert=require('node:assert/strict');const {parts,problem,uncertain,mathHtml,mathText}=require('./math-layout.js');const {segments,normalize}=require('./ocr-format.js');
// 导出 HTML 必须使用可复制的内联文本，而不是 MathML（MathML 粘贴时会逐元素换行）
const textOf=h=>h.replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
assert.equal(mathHtml('S_{△ABP}:S_{△BCP}'),'S<sub>△ABP</sub>:S<sub>△BCP</sub>');
assert.equal(textOf(mathHtml('S_{△ABP}:S_{△BCP}:S_{△ACP}')),'S△ABP:S△BCP:S△ACP');
assert.equal(mathHtml('\\frac{1}{2}'),'1/2');
assert.equal(mathHtml('\\frac{a+1}{2b}'),'(a+1)/(2b)');
assert.equal(mathHtml('x^2'),'x<sup>2</sup>');
assert.equal(mathHtml('\\sqrt{3}'),'√<span class="sqrt">3</span>');
assert.equal(mathHtml('\\overline{AB}'),'<span class="ol">AB</span>');
assert.equal(mathHtml('\\overrightarrow{AB}'),'→AB');
assert.equal(mathHtml('△ABC'),'△ABC');
assert.equal(mathHtml('<b>注入</b>'),'&lt;b&gt;注入&lt;/b&gt;');
assert.doesNotMatch(mathHtml('S_{△ABP}'),/math>|katex/);
// TXT 下载与复制使用纯文本公式：不出现 $、花括号、_{} 等标记
assert.equal(mathText('S_{△ABP}:S_{△BCP}:S_{△ACP}'),'S△ABP:S△BCP:S△ACP');
assert.equal(mathText('\\frac{1}{2}'),'1/2');
assert.equal(mathText('\\frac{a+1}{2b}'),'(a+1)/(2b)');
assert.equal(mathText('x^2'),'x²');
assert.equal(mathText('\\sqrt{3}'),'√3');
assert.equal(mathText('\\overrightarrow{AB}'),'→AB');
assert.equal(mathText('60°'),'60°');
const plain=text=>segments(String(text)).map(p=>p.kind==='text'?normalize(p.value):mathText(p.formula)).join('');
const txt=plain(String.raw`①若 AB:BC:AC=6:5:3，则 $S_{△ABP}:S_{△BCP}:S_{△ACP}=$________；
②若 ∠BAC=60°，则 PN 与 PM 有怎样的数量关系？`);
assert.equal(txt,String.raw`①若 AB:BC:AC=6:5:3，则 S△ABP:S△BCP:S△ACP=________；
②若 ∠BAC=60°，则 PN 与 PM 有怎样的数量关系？`);
assert.doesNotMatch(txt,/\$|\{|\}/);
assert.equal(parts('普通题没有图').filter(p=>p.kind==='figure').length,0);assert.equal(parts('前【图形需保留原图】（图1（有括号）继续）后').at(-1).value,'后');console.log('通过：占位文本移除、嵌套括号处理、双图对应、缺图阻止导出、可复制公式 HTML');

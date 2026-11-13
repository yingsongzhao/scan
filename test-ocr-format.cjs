const assert=require('node:assert/strict');const {normalize,segments}=require('./ocr-format.js');
const cases=[
 [String.raw`答：\_\_\_`,'答：___'],
 [String.raw`\_ 单独填空；\* \# \% \& \!`,'_ 单独填空；* # % & !'],
 [String.raw`$x_1+\_$`,String.raw`$x_1+\_$`],
 [String.raw`$\_\_\_$`,'___'],
 [String.raw`\(\frac{a_1}{b}\)`,String.raw`\(\frac{a_1}{b}\)`],
 [String.raw`\[a\&b\]`,String.raw`\[a\&b\]`],
 ['&lt; &amp; <script>','&lt; &amp; <script>'],
 [String.raw`路径 C:\test\new`,String.raw`路径 C:\test\new`],
 ['【待核对:PN】','【待核对:PN】'],
 // 弱模型丢失 LaTeX 反斜杠时的确定性修复（线上三角形/角符号乱码问题）
 [String.raw`$triangle ABC$`,'△ABC'],
 [String.raw`$angle BAC=60^\circ$`,'∠BAC=60°'],
 [String.raw`$S_{\triangle ABP}:S_{\triangle BCP}:S_{\triangle ACP}=$`,String.raw`$S_{△ABP}:S_{△BCP}:S_{△ACP}=$`],
 [String.raw`$perp$`,'⊥'],
 [String.raw`$leq 3$`,'≤ 3'],
 ['正文里的 triangle 与 angle 不应被改写','正文里的 triangle 与 angle 不应被改写'],
 [String.raw`$x^circ$`,'x°'],
 // 相邻公式之间的比值冒号应合并为一个公式，避免正文冒号排版偏上、间距过大
 [String.raw`$S_{△ABP}$∶$S_{△BCP}$∶$S_{△ACP}$`,String.raw`$S_{△ABP}:S_{△BCP}:S_{△ACP}$`],
 [String.raw`$A$∶$B$`,'A:B'],
 [String.raw`$A$ 与 $B$`,'A 与 B']
];for(const [input,expected] of cases){assert.equal(normalize(input),expected,input);assert.equal(normalize(normalize(input)),expected,'幂等性：'+input)}
assert.equal(segments(String.raw`$S_{△ABP}$∶$S_{△BCP}$∶$S_{△ACP}$`).filter(x=>x.kind==='math').length,1,'比值冒号应合并为单个公式');
assert.equal(segments(String.raw`$$A$$∶$$B$$`).filter(x=>x.kind==='math').length,2,'展示公式不合并');
const katex=require('katex');
for(const text of [String.raw`$S_{△ABP}:S_{△BCP}:S_{△ACP}=$`,String.raw`\(\frac{a_1}{b}\)`,String.raw`$$a^2$$`,String.raw`$x_1+\_$`,String.raw`$\frac{△ABC}{2}$`]){
  for(const part of segments(text))if(part.kind==='math')assert.doesNotThrow(()=>katex.renderToString(part.formula,{throwOnError:true,strict:'ignore'}),'KaTeX 无法解析：'+part.formula);
}
assert.equal(normalize(String.raw`$\triangle ABC$ 与 $\angle BAC$`),'△ABC 与 ∠BAC');
assert.equal(segments('$5 and $10').filter(x=>x.kind==='math').length,0);
assert.equal(segments(String.raw`价格\$5与\$10`).filter(x=>x.kind==='math').length,0);
assert.equal(segments('$x_1$ 与 $$a^2$$').filter(x=>x.kind==='math').length,2);
assert.equal(segments(String.raw`\(x\)与\[y\]`).filter(x=>x.kind==='math').length,2);
console.log('通过：填空线、普通标点转义、公式保护、金额区分、HTML实体保护及幂等性');

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
 ['【待核对:PN】','【待核对:PN】']
];for(const [input,expected] of cases){assert.equal(normalize(input),expected,input);assert.equal(normalize(normalize(input)),expected,'幂等性：'+input)}
assert.equal(segments('$5 and $10').filter(x=>x.kind==='math').length,0);
assert.equal(segments(String.raw`价格\$5与\$10`).filter(x=>x.kind==='math').length,0);
assert.equal(segments('$x_1$ 与 $$a^2$$').filter(x=>x.kind==='math').length,2);
assert.equal(segments(String.raw`\(x\)与\[y\]`).filter(x=>x.kind==='math').length,2);
console.log('通过：填空线、普通标点转义、公式保护、金额区分、HTML实体保护及幂等性');

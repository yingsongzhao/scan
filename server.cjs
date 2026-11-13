// Local-only proxy for the teacher's OCR page. Keep API credentials server-side.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {normalize}=require('./ocr-format.js');

const ROOT = __dirname;
function loadLocalConfig(){
  const file=path.join(ROOT,'qwen.local.json');
  if(!fs.existsSync(file))return {};
  try{
    const value=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
    for(const field of ['apiKey','baseUrl','model','deepseekApiKey','qwenPaidApiKey','defaultProvider'])if(value[field]!==undefined&&typeof value[field]!=='string')throw Error();
    return value;
  }catch{throw Error('qwen.local.json 格式错误：请使用合法 JSON，apiKey、baseUrl 和 model 均需为字符串。')}
}
const LOCAL=loadLocalConfig();
const PORT = Number(process.env.PORT || 8765);
const BASE_URL = (process.env.QWEN_BASE_URL || LOCAL.baseUrl || 'https://ccproxy.yukework.com').replace(/\/+$/, '');
const MODEL = process.env.QWEN_MODEL || LOCAL.model || 'qwen-3.8-free';
const API_KEY = (process.env.QWEN_API_KEY || LOCAL.apiKey || '').trim();
const PROVIDERS = ['original', 'deepseek', 'qwen-paid'];
const DEFAULT_PROVIDER = PROVIDERS.includes(process.env.DEFAULT_PROVIDER || LOCAL.defaultProvider) ? (process.env.DEFAULT_PROVIDER || LOCAL.defaultProvider) : 'qwen-paid';
const MAX_BYTES = 16 * 1024 * 1024;
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.txt':'text/plain; charset=utf-8'};
function send(res,code,body,headers={}) {res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body));}
function guessImage(raw){let buf;try{buf=Buffer.from(raw,'base64')}catch{return null}if(!buf.length||buf.length>12*1024*1024)return null;if(buf.subarray(0,3).equals(Buffer.from([255,216,255])))return 'image/jpeg';if(buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';if(buf.subarray(0,4).toString()==='RIFF'&&buf.subarray(8,12).toString()==='WEBP')return 'image/webp';return null}
function extractText(value){if(typeof value==='string')return value;if(Array.isArray(value))return value.filter(part=>part&&part.type==='text').map(part=>part.text||'').join('\n');return ''}
function errorMessage(body){return typeof body?.error==='string'?body.error:body?.error?.message||body?.message||'上游未返回有效识别结果'}
function createApp({upstreamFetch=fetch,apiKey=API_KEY,baseUrl=BASE_URL,model=MODEL,auth=null,defaultProvider=DEFAULT_PROVIDER,deepseekKey=process.env.DEEPSEEK_API_KEY||LOCAL.deepseekApiKey||'',qwenPaidKey=process.env.QWEN_PAID_API_KEY||LOCAL.qwenPaidApiKey||''}={}){
  if(!auth&&process.env.AUTH_DATA_FILE)auth=require('./auth.cjs').createAuth({dataFile:process.env.AUTH_DATA_FILE,secure:process.env.AUTH_SECURE!=='false',origin:process.env.PUBLIC_ORIGIN||'https://example.invalid'});
  if(process.env.NODE_ENV==='production'&&!auth)throw Error('生产环境必须配置 AUTH_DATA_FILE');
  return http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Referrer-Policy','same-origin');
    let route;try{route=new URL(req.url,'http://localhost')}catch{return send(res,400,{error:'请求地址无效'})}
    if(auth){try{if(await (typeof auth==='function'?auth:auth.handle)(req,res,route))return}catch(e){console.error('Authentication request failed');return send(res,500,{error:'认证服务暂不可用'})}}
    if(route.pathname==='/api/recognize'){
      if(req.method!=='POST')return send(res,405,{error:'仅支持 POST'});

      let input='';try{for await(const chunk of req){input+=chunk;if(Buffer.byteLength(input)>MAX_BYTES)throw Error('图片过大（请求最多 16 MB）')}}catch(e){return send(res,413,{error:e.message})}
      let parsed;try{parsed=JSON.parse(input)}catch{return send(res,400,{error:'请求不是有效 JSON'})}
      if(!parsed||typeof parsed!=='object')return send(res,400,{error:'请求格式错误'});
      const provider=parsed.provider===undefined?(PROVIDERS.includes(defaultProvider)?defaultProvider:'qwen-paid'):parsed.provider;if(!['original','deepseek','qwen-paid'].includes(provider))return send(res,400,{error:'未知模型选项'});
      const providers={original:{key:apiKey,model,endpoint:baseUrl+'/v1/chat/completions',label:'原模型'},deepseek:{key:deepseekKey,model:'deepseek-flash',endpoint:'https://api.deepseek.com/chat/completions',label:'DeepSeek'},'qwen-paid':{key:qwenPaidKey,model:'qwen3.8-flash',endpoint:'https://maas.qianwenaiapi.com/compatible-mode/v1/chat/completions',label:'千问自费'}};
      const selected=providers[provider],selectedKey=selected.key,selectedModel=selected.model,endpoint=selected.endpoint;
      if(provider==='original'&&!/^https:\/\/[^/]+$/i.test(baseUrl))return send(res,500,{error:'原模型接口必须是 HTTPS 主机地址'});

      if(!selectedKey)return send(res,503,{error:'所选模型尚未配置服务端密钥，请联系管理员'+(auth?'':'（本地可在 qwen.local.json 设置 defaultProvider 或补充该模型密钥）')});
      const raw=parsed.imageBase64;
      if(typeof raw!=='string'||!/^[-\w+/=]+$/.test(raw)||!guessImage(raw))return send(res,400,{error:'需要 12 MB 内的 JPG、PNG 或 WEBP 图片 base64'});
      const mime=guessImage(raw);
      const general='你是严谨的试卷转录员。逐字转录图片中的印刷题目，保留题号、选项、空格、段落与原始语言。数学公式尽可能用清楚的 LaTeX 写出；不要解题，不要猜测看不清的字，不要添加答案或解释。识别不清的局部标记为【待核对】，示意图无法转换的地方标记【图形需保留原图】。只返回转录文本。';
      const math='你是数学试题的精确转录员。只抄写图中实际可见的题目，绝不求解、补全、猜测或创造不存在的图形与数据。先辨别题号和正文，再辨别选项。必须保留△（三角形）、∠（角）、⊥、∥、≈、≠、≤、≥、°、π、根号及上下标；例如三角形ABC写作△ABC，不要写成A4BC；角BAC写作∠BAC，不要写成小于号。数学符号优先直接输出 △、∠、⊥、∥、≈、≠、≤、≥、°、π 等字符（例如 △ABC、∠BAC=60°）；如使用 LaTeX 命令，命令前必须带反斜杠，禁止输出 triangle、angle、perp 这类缺少反斜杠的裸命令。数学分数/指数/根式可用 LaTeX，如\\frac{a}{b}、x^2、\\sqrt{x}；区分数字1和字母l、数字0和字母O。图中几何线段、阴影、坐标图不要仅凭题意描述为文字；在对应位置写【图形需保留原图】，由用户截取原图嵌入。任何看不清的符号写【待核对】，不要强行推断。只输出可见题目原文和图形占位符。';
      const instruction=general+'自动判断图片中的语言、学科和题目类型，保留中英混排，不输出你的分类判断。若含数学内容，还需遵守：'+math+'不确定内容采用统一标记：【待核对:候选内容】。例如点名拿不准时写【待核对:PN】，候选公式必须将完整含美元符号的公式放入标记中。完全无法辨认写【待核对:无法辨认】。只标记确实模糊、有歧义的局部，不因所有内容来自OCR就全部标记；不要编造置信度百分比。此格式优先于前述无候选的【待核对】格式。填空答题横线直接输出普通下划线________，不要加反斜杠转义，不要放进数学公式；真正公式中的上下标仍使用LaTeX。普通文本不要使用Markdown标题、加粗、代码围栏或多余的标点反斜杠转义；英文金额按原文输出，只有真正数学公式才使用公式定界符。需要上下标时（例如面积 S 的下标 △ABP）请用 $S_{△ABP}$ 这样的公式定界符包裹整个式子，不要把 _{...} 裸写在正文里。';
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),90000);
      try{
        const upstream=await upstreamFetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+selectedKey},body:JSON.stringify({model:selectedModel,...(provider==='deepseek'?{thinking:{type:'disabled'}}:{}),messages:[{role:'user',content:[{type:'text',text:instruction},{type:'image_url',image_url:{url:`data:${mime};base64,${raw}`}}]}],temperature:0,max_tokens:4096}),signal:controller.signal});
        let response;try{response=await upstream.json()}catch(e){return send(res,502,{error:`${selected.label}接口返回 ${upstream.status}，但响应正文为空或不是有效 JSON；请稍后重试`})}
        if(!upstream.ok)return send(res,502,{error:`模型接口返回 ${upstream.status}：${errorMessage(response)}`});
        const choice=response?.choices?.[0],text=extractText(choice?.message?.content).trim();
        if(!text)return send(res,502,{error:`${selected.label}未返回识别文字${choice?.finish_reason?'（结束原因：'+String(choice.finish_reason).slice(0,40)+'）':''}；请稍后重试或切换模型`});
        return send(res,200,{text:normalize(text),model:selectedModel,warning:'模型结果仍须与原图逐字核对，尤其是公式及几何图。'});
      }catch(e){return send(res,502,{error:e.name==='AbortError'?'模型请求超过 90 秒':`请求模型失败：${e.message}`})}finally{clearTimeout(timeout)}
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'不支持该请求'});
    // Only the page, its local scripts and KaTeX assets are public; never serve .env, config or arbitrary project files.
    const katexAsset=route.pathname.match(/^\/assets\/katex\/(katex\.min\.(?:js|css)|fonts\/KaTeX_[A-Za-z0-9-]+\.woff2)$/);
    const allowed=route.pathname==='/'||route.pathname==='/index.html'?'index.html':route.pathname==='/math-layout.js'?'math-layout.js':route.pathname==='/ocr-format.js'?'ocr-format.js':route.pathname==='/geometry-board.js'?'geometry-board.js':route.pathname==='/tablet-workspace.js'?'tablet-workspace.js':katexAsset?path.join('node_modules','katex','dist',katexAsset[1]):null;
    if(!allowed)return send(res,404,{error:'未找到页面'});
    const file=path.join(ROOT,allowed),ext=path.extname(file);
    try{const stat=await fs.promises.stat(file);res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Content-Length':stat.size,'X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res)}catch{return send(res,404,{error:'本地页面或静态资源不存在'})}
  });
}
if(require.main===module){createApp().listen(PORT,'127.0.0.1',()=>console.log(`题目识别页面：http://127.0.0.1:${PORT}/（${MODEL}）`))}
module.exports={createApp};

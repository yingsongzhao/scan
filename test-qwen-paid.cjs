'use strict';
const assert=require('node:assert/strict');
const {createApp}=require('./server.cjs');
(async()=>{
  const calls=[];
  const app=createApp({apiKey:'ORIGINAL_TEST',baseUrl:'https://example.test',model:'old-model',deepseekKey:'DEEPSEEK_TEST',qwenPaidKey:'PAID_TEST',defaultProvider:'qwen-paid',upstreamFetch:async(url,request)=>{calls.push({url,request});return {ok:true,status:200,json:async()=>({choices:[{message:{content:'题目 $x^2$'},finish_reason:'stop'}]})}}});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+app.address().port;
  const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64');
  const body=(provider)=>JSON.stringify({provider,imageBase64:png});
  try{
    let r=await fetch(base+'/api/models');assert.equal(r.status,404);
    r=await fetch(base+'/api/recognize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageBase64:png})});assert.equal(r.status,200);assert.equal((await r.json()).model,'qwen3.8-flash');assert.equal(calls.at(-1).url,'https://maas.qianwenaiapi.com/compatible-mode/v1/chat/completions');
    for(const [provider,url,model,token] of [['original','https://example.test/v1/chat/completions','old-model','ORIGINAL_TEST'],['deepseek','https://api.deepseek.com/chat/completions','deepseek-flash','DEEPSEEK_TEST'],['qwen-paid','https://maas.qianwenaiapi.com/compatible-mode/v1/chat/completions','qwen3.8-flash','PAID_TEST']]){
      r=await fetch(base+'/api/recognize',{method:'POST',headers:{'Content-Type':'application/json'},body:body(provider)});assert.equal(r.status,200);const text=await r.json();assert.equal(text.model,model);assert.equal(text.text,'题目 $x^2$');const got=calls.at(-1);assert.equal(got.url,url);assert.equal(got.request.headers.Authorization,'Bearer '+token);assert.equal(JSON.parse(got.request.body).model,model);
    }
    r=await fetch(base+'/api/recognize',{method:'POST',headers:{'Content-Type':'application/json'},body:body('unknown')});assert.equal(r.status,400);
    const disabled=createApp({apiKey:'ORIGINAL_TEST',baseUrl:'https://example.test',deepseekKey:'',qwenPaidKey:''});await new Promise(resolve=>disabled.listen(0,'127.0.0.1',resolve));try{r=await fetch('http://127.0.0.1:'+disabled.address().port+'/api/recognize',{method:'POST',headers:{'Content-Type':'application/json'},body:body('qwen-paid')});assert.equal(r.status,503)}finally{await new Promise(resolve=>disabled.close(resolve))}
    const mock=async(url,request)=>{calls.push({url,request});return {ok:true,status:200,json:async()=>({choices:[{message:{content:'题目 $x^2$'},finish_reason:'stop'}]})}};
    const preferOriginal=createApp({apiKey:'ORIGINAL_TEST',baseUrl:'https://example.test',model:'old-model',deepseekKey:'',qwenPaidKey:'',defaultProvider:'original',upstreamFetch:mock});
    await new Promise(resolve=>preferOriginal.listen(0,'127.0.0.1',resolve));
    try{r=await fetch('http://127.0.0.1:'+preferOriginal.address().port+'/api/recognize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageBase64:png})});assert.equal(r.status,200);assert.equal(calls.at(-1).url,'https://example.test/v1/chat/completions');assert.equal((await r.json()).model,'old-model')}finally{await new Promise(resolve=>preferOriginal.close(resolve))}
    const badDefault=createApp({apiKey:'ORIGINAL_TEST',baseUrl:'https://example.test',model:'old-model',deepseekKey:'',qwenPaidKey:'PAID_TEST',defaultProvider:'bogus',upstreamFetch:mock});
    await new Promise(resolve=>badDefault.listen(0,'127.0.0.1',resolve));
    try{r=await fetch('http://127.0.0.1:'+badDefault.address().port+'/api/recognize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageBase64:png})});assert.equal(r.status,200);assert.equal(calls.at(-1).url,'https://maas.qianwenaiapi.com/compatible-mode/v1/chat/completions');assert.equal((await r.json()).model,'qwen3.8-flash')}finally{await new Promise(resolve=>badDefault.close(resolve))}
    console.log('通过：三模型路由、隔离密钥、模型名称、默认路由可配置、未知模型及未配置保护');
  }finally{await new Promise(resolve=>app.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1});

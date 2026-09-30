// Optional browser regression: NODE_PATH=<directory containing playwright> node tests/browser.integration.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const repo=path.resolve(__dirname,'..');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
 const context=await browser.newContext({viewport:{width:360,height:780},hasTouch:true,acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const avatar='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#7160aa"/><circle cx="100" cy="85" r="45" fill="#fed"/><path d="M45 280V160Q100 120 155 160V280" fill="#eb9ac8"/></svg>';
 await page.route('http://localhost/**',async route=>{
  const url=new URL(route.request().url()),prefix='/scripts/extensions/third-party/persona-stage/';
  if(url.pathname.startsWith(prefix)){const f=path.join(repo,url.pathname.slice(prefix.length));return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.css')?'text/css':'text/javascript'})}
  if(url.pathname==='/script.js')return route.fulfill({contentType:'text/javascript',body:"export let user_avatar='a.png';window.switchPersona=id=>{user_avatar=id;window.context.eventSource.handlers.PERSONA_CHANGED()};"});
  if(url.pathname==='/scripts/extensions.js')return route.fulfill({contentType:'text/javascript',body:`window.context={extensionSettings:JSON.parse(localStorage.getItem('settings')||'{}'),saveSettingsDebounced(){localStorage.setItem('settings',JSON.stringify(this.extensionSettings))},name1:'Alice',powerUserSettings:{personas:{'a.png':'Alice','b.png':'Bob'},persona_descriptions:{}},getThumbnailUrl(){return '/avatar.svg'},eventTypes:{PERSONA_CHANGED:'PERSONA_CHANGED'},eventSource:{handlers:{},on(k,fn){this.handlers[k]=fn}}};export const getContext=()=>window.context;`});
  if(url.pathname==='/avatar.svg')return route.fulfill({contentType:'image/svg+xml',body:avatar});
  return route.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${prefix}settings.css"><style>body{background:#252033;color:white;font:16px sans-serif;margin:16px}#extensions_settings2{display:flex;flex-direction:column;align-items:flex-start}.menu_button{width:40px;background:#42354f;color:white}</style></head><body><div id="extensions_settings2"></div><script>window.audios=[];const NativeAudio=window.Audio;window.Audio=function(...args){const a=new NativeAudio(...args);window.audios.push(a);return a};window.frames=0;const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...a){window.frames++;return clear.apply(this,a)};</script><script type="module" src="${prefix}index.js"></script></body></html>`});
 });
 await page.goto('http://localhost/');await page.locator('#persona-stage-open').click();
 const state=()=>page.evaluate(()=>window.context.extensionSettings.persona_stage);
 await page.locator('[data-action=wardrobe]').click();await page.getByRole('button',{name:'＋ 新建穿搭',exact:true}).click();
 await page.getByLabel('穿搭名称').fill('白裙');await page.getByLabel('NovelAI 正向 tags（Prompt）').fill('1girl, {{{white dress}}}, <script>literal</script>');await page.getByLabel('NovelAI 负向 tags（UC）').fill('lowres');
 // Browser-generated valid image avoids decoder differences in tiny PNG fixtures.
 const image=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=160;c.height=240;const x=c.getContext('2d');x.fillStyle='#bc8fcc';x.fillRect(0,0,160,240);return c.toDataURL().split(',')[1]}),'base64');
 await page.getByLabel('上传展示图', {exact:false}).setInputFiles({name:'dress.png',mimeType:'image/png',buffer:image});
 await page.getByRole('button',{name:'保存穿搭',exact:true}).click();await page.getByRole('button',{name:'换装展示',exact:true}).waitFor();
 await page.getByRole('button',{name:'换装展示',exact:true}).click();
 let s=await state();assert.equal(s.wardrobes['a.png'].outfits.length,1);assert.ok(s.wardrobes['a.png'].active);assert.equal(s.wardrobes['a.png'].outfits[0].negative,'lowres');
 await page.locator('[data-action=closePanel]').click();await page.waitForFunction(()=>document.querySelector('#persona-stage-host').shadowRoot.querySelector('.main img').src.startsWith('blob:'));
 // One-finger movement saves into the active outfit, not the base profile.
 const actor=page.locator('.actor.main'),r=await actor.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+20,r.y+r.height/2+20);await page.mouse.up();
 s=await state();assert.ok(s.wardrobes['a.png'].outfits[0].offsetX>0);
 // Two actual touch points exercise pinch handlers.
 const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:100,y:240,id:1},{x:160,y:240,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:85,y:240,id:1},{x:175,y:240,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 s=await state();assert.ok(s.wardrobes['a.png'].outfits[0].scale>1);
 await page.reload();await page.locator('#persona-stage-open').click();s=await state();assert.equal(s.wardrobes['a.png'].outfits[0].name,'白裙');assert.ok(s.wardrobes['a.png'].active);
 await page.evaluate(()=>window.switchPersona('b.png'));await page.locator('[data-action=wardrobe]').click();assert.equal(await page.getByRole('button',{name:'正在穿着',exact:true}).count(),0);assert.ok((await page.locator('.panel-body').innerText()).includes('还没有穿搭'));
 await page.evaluate(()=>window.switchPersona('a.png'));await page.locator('[data-action=edit]').click();
 // Upload a real 20-second WAV and verify display changes preserve playback.
 const samples=16000*20,wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);
 await page.getByLabel('主题曲',{exact:true}).setInputFiles({name:'tone.wav',mimeType:'audio/wav',buffer:wav});await page.waitForFunction(()=>!!window.audios[0].src);
 await page.locator('[data-action=closePanel]').click();await page.locator('[data-action=play]').click();await page.waitForFunction(()=>!window.audios[0].paused&&window.audios[0].currentTime>0.1);
 await page.locator('[data-action=wardrobe]').click();await page.getByRole('button',{name:'使用原始立绘',exact:true}).click();await page.getByRole('button',{name:'换装展示',exact:true}).click();assert.equal(await page.evaluate(()=>window.audios[0].paused),false);await page.locator('[data-action=closePanel]').click();
 const before=await page.evaluate(()=>({src:window.audios[0].src,time:window.audios[0].currentTime}));
 await page.locator('[data-action=edit]').click();await page.getByLabel('主色',{exact:true}).fill('#ff0000');await page.getByLabel('主题曲音量',{exact:true}).fill('0.35');
 const after=await page.evaluate(()=>({src:window.audios[0].src,time:window.audios[0].currentTime,paused:window.audios[0].paused,volume:window.audios[0].volume}));assert.equal(after.src,before.src);assert.ok(after.time>=before.time);assert.equal(after.paused,false);assert.equal(after.volume,.35);
 await page.getByLabel('隐藏悬浮入口',{exact:true}).check();await page.locator('[data-action=closePanel]').click();await page.locator('[data-action=hide]').click();assert.equal(await page.locator('.launch').isVisible(),false);await page.locator('#persona-stage-open').click();await page.locator('[data-action=edit]').click();await page.getByLabel('隐藏悬浮入口',{exact:true}).uncheck();await page.locator('[data-action=closePanel]').click();await page.locator('[data-action=hide]').click();
 const star=await page.locator('.launch').boundingBox();await page.mouse.move(star.x+20,star.y+20);await page.mouse.down();await page.mouse.move(35,180,{steps:4});await page.mouse.up();assert.equal(await page.locator('.window').isVisible(),false);assert.equal((await state()).launcherPosition.x,8);
 await page.locator('.launch').click();await page.locator('[data-action=motion]').click();await page.waitForTimeout(100);const frames=await page.evaluate(()=>window.frames);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.frames),frames);
 await page.locator('[data-action=wardrobe]').click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出衣柜（含图片）',exact:true}).click();const download=await downloadPromise;const json=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(json.outfits[0].positive,'1girl, {{{white dress}}}, <script>literal</script>');assert.ok(json.outfits[0].image.startsWith('data:image/png'));
 await page.evaluate(()=>window.switchPersona('b.png'));await page.locator('[data-action=wardrobe]').click();const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入衣柜',exact:true}).click();const chooser=await chooserPromise;await chooser.setFiles({name:'wardrobe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});await page.getByRole('button',{name:'换装展示',exact:true}).waitFor();s=await state();assert.notEqual(s.wardrobes['a.png'].outfits[0].id,s.wardrobes['b.png'].outfits[0].id);
 await page.getByRole('button',{name:'编辑',exact:true}).click();await page.getByLabel('穿搭名称').fill('白裙副本');await page.getByRole('button',{name:'保存穿搭',exact:true}).click();await page.getByRole('button',{name:'换装展示',exact:true}).waitFor();assert.equal((await state()).wardrobes['a.png'].outfits[0].name,'白裙');assert.equal((await state()).wardrobes['b.png'].outfits[0].name,'白裙副本');
 await page.screenshot({path:'/tmp/persona-wardrobe-mobile.png'});
 await page.getByRole('button',{name:'编辑',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'删除这套穿搭',exact:true}).click();await page.getByText('还没有穿搭。新建一套，保存图片和生图 tags 吧。',{exact:true}).waitFor();assert.equal((await state()).wardrobes['b.png'].outfits.length,0);assert.equal((await state()).wardrobes['a.png'].outfits.length,1);
 for(const width of [320,390,768]){await page.setViewportSize({width,height:780});await page.waitForFunction(width=>{const r=document.querySelector('#persona-stage-host').shadowRoot.querySelector('.window').getBoundingClientRect();return r.x>=0&&r.right<=width+1},width);const bounds=await page.locator('.window').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);const header=await page.locator('header').evaluate(e=>({w:e.clientWidth,scroll:e.scrollWidth}));assert.ok(header.scroll<=header.w,`header overflows at ${width}`)}
 assert.deepEqual(errors,[]);console.log('PASS: wardrobe CRUD/save/reload/isolation/import/export, drag/pinch, uninterrupted audio, launcher controls, static rendering, responsive bounds');
} finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

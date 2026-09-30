import { MUSIC_SERVERS,DEFAULT_MUSIC_ENDPOINTS,musicURL,musicSearchURL,normalizeMusicResults,officialMusicSearch } from './music-core.mjs';

export function createOnlineMusic({settings,save,current,profile,put,render,showPanel,body,el,button,notify,pauseMain}){
 let generation=0,controller=null,preview=null,previewButton=null,previewTimer=null;
 function stopPreview(){clearTimeout(previewTimer);if(preview){preview.pause();preview.removeAttribute('src');preview.load();preview=null}if(previewButton){previewButton.textContent='试听';previewButton=null}}
 function cleanup(){generation++;controller?.abort();controller=null;stopPreview()}
 const endpoint=server=>settings.musicEndpoints?.[server]||DEFAULT_MUSIC_ENDPOINTS[server];
 function link(label,url){const a=el('a',label,'music-link');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';return a}
 function show(){
  const id=current();if(!id){notify('先选一个 user 人设。');return}
  showPanel('在线搜歌');const ownGeneration=++generation;
  const form=el('form'),platformLabel=el('label',null,'field'),select=el('select');select.setAttribute('aria-label','音乐平台');
  for(const [value,label]of Object.entries(MUSIC_SERVERS)){const o=el('option',label);o.value=value;select.append(o)}select.value=settings.musicServer==='tencent'?'tencent':'netease';platformLabel.append(el('span','音乐平台'),select);form.append(platformLabel);
  const query=el('input');query.type='search';query.maxLength=200;query.placeholder='输入歌名或歌手';query.setAttribute('aria-label','歌名或歌手');query.required=true;form.append(query);
  const actions=el('div',null,'row'),search=el('button','搜索');search.type='submit';actions.append(search,button('停止试听',stopPreview));form.append(actions);
  const official=el('div',null,'row');const updateOfficial=()=>{official.replaceChildren(link('去网易云搜索',officialMusicSearch('netease',query.value)),link('去 QQ 音乐搜索',officialMusicSearch('tencent',query.value)))};query.oninput=updateOfficial;updateOfficial();
  const status=el('p','搜索结果不代表整首可播放；请先试听。部分歌曲仅提供试听片段或需要在官方平台播放。','hint');status.setAttribute('role','status');const results=el('div',null,'music-results');
  const service=el('details'),summary=el('summary','搜索服务设置'),serviceHint=el('p',null,'hint');service.append(summary,serviceHint);
  const addresses={};for(const [server,label]of Object.entries(MUSIC_SERVERS)){const row=el('label',null,'field'),input=el('input');input.type='url';input.value=endpoint(server);row.append(el('span',label+'搜索服务地址'),input);service.append(row);addresses[server]=input}
  const updateService=()=>{const value=musicURL(endpoint(select.value));serviceHint.textContent='当前服务：'+(value?new URL(value).host:'未配置')+'。仅发送搜索词和所选歌曲链接，不发送人设或聊天内容。可使用自己的 Meting 兼容服务。'};updateService();
  service.append(button('保存搜索服务',()=>{try{const endpoints={};for(const [server,input]of Object.entries(addresses)){const value=musicURL(input.value);if(!value)throw Error('请填写有效的 HTTP(S) 搜索服务地址。');endpoints[server]=value}controller?.abort();settings.musicEndpoints=endpoints;save();updateService();notify('搜索服务已保存。')}catch(e){notify(e.message)}}),button('恢复默认服务',()=>{controller?.abort();delete settings.musicEndpoints;save();for(const [server,input]of Object.entries(addresses))input.value=endpoint(server);updateService();notify('已恢复默认服务。')}));
  select.onchange=()=>{controller?.abort();stopPreview();results.replaceChildren();settings.musicServer=select.value;save();updateService();status.textContent='已切换平台，请重新搜索。'};
  const existing=profile(id),selected=existing.onlineMusic;const currentInfo=el('p',existing.musicMode==='online'&&selected?`当前在线主题曲：${selected.title} · ${selected.artist}`:'当前使用本地主题曲。','hint');
  body.append(currentInfo,form,official,status,results,service,button('使用本地主题曲',()=>{put(id,{...profile(id),musicMode:'local'});render();currentInfo.textContent='已切回本地主题曲。';notify('已切回本地主题曲；原来的本地文件保留。')}));
  let serial=0;
  form.onsubmit=async e=>{
   e.preventDefault();stopPreview();controller?.abort();const task=++serial,abort=new AbortController();controller=abort;const server=select.value,base=endpoint(server);let timer;
   try{const url=musicSearchURL(base,server,query.value);search.disabled=true;status.textContent='正在搜索 '+MUSIC_SERVERS[server]+'…';results.replaceChildren();timer=setTimeout(()=>abort.abort(),12000);
    const response=await fetch(url,{signal:abort.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('搜索服务返回 HTTP '+response.status+'。');
    const raw=await response.text();if(raw.length>2*1024*1024)throw Error('搜索结果过大，请更换服务。');let data;try{data=JSON.parse(raw)}catch{throw Error('服务返回的不是 JSON 歌曲列表。')}
    const tracks=normalizeMusicResults(data,server,base);if(ownGeneration!==generation||task!==serial||abort.signal.aborted)return;
    status.textContent=tracks.length?`找到 ${tracks.length} 首。点击试听确认，再设为主题曲。`:'当前服务未返回歌曲，也可能是接口限制。可以换搜索词、使用官方搜索，或更换搜索服务。';
    for(const track of tracks){
     const card=el('div',null,'music-card'),title=el('strong',track.title),artist=el('small',track.artist||'歌手未知'),availability=el('p',track.url?'有播放链接 · 尚未试听':'未提供播放链接，请在官方平台查看。','hint'),row=el('div',null,'row');
     const listen=button('试听',async()=>{if(previewButton===listen){stopPreview();return}stopPreview();pauseMain();const audio=new Audio();preview=audio;previewButton=listen;listen.textContent='停止试听';audio.preload='none';audio.volume=profile(id).volume;audio.src=track.url;
      const fail=()=>{if(preview!==audio)return;availability.textContent='当前链接无法播放，可能已失效或有平台限制。';stopPreview()};audio.onerror=fail;audio.onended=()=>{if(preview===audio)stopPreview()};previewTimer=setTimeout(fail,15000);
      try{await audio.play();if(preview!==audio)return;clearTimeout(previewTimer);availability.textContent='试听播放中（可能是片段）'}catch{fail()}
     });listen.disabled=!track.url;
     const use=button('设为主题曲',()=>{stopPreview();put(id,{...profile(id),musicMode:'online',onlineMusic:track});render();currentInfo.textContent=`当前在线主题曲：${track.title} · ${track.artist}`;notify('已设为该 user 的主题曲，点底部播放按钮播放。')});use.disabled=!track.url;
     row.append(listen,use,link('官方搜索',officialMusicSearch(server,track.title+' '+track.artist)));card.append(title,artist,availability,row);results.append(card);
    }
   }catch(e){if(ownGeneration===generation&&task===serial){status.textContent=abort.signal.aborted?'搜索已取消或超时，请重试或使用官方搜索。':e.message+' 可使用官方搜索，或更换支持跨域的 Meting 搜索服务。'}}finally{clearTimeout(timer);if(ownGeneration===generation&&task===serial)search.disabled=false}
  };
 }
 return {show,cleanup};
}

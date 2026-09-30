export const MUSIC_SERVERS={netease:'网易云音乐',tencent:'QQ 音乐'};
// Public, replaceable Meting-compatible services. Availability is not guaranteed.
export const DEFAULT_MUSIC_ENDPOINTS={netease:'https://met.liiiu.cn/api',tencent:'https://api.zigzagk.top/metingapi/'};
const text=(v,max)=>typeof v==='string'?v.slice(0,max):'';
export function musicURL(value,base){
 if(typeof value!=='string'||!value.trim()||value.length>4096)return '';
 try{const u=base?new URL(value,base):new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return '';if(base){const b=new URL(base);if(u.protocol==='http:'&&b.protocol==='https:'&&u.host===b.host)u.protocol='https:'}return u.href}catch{return ''}
}
export function cleanOnlineMusic(value){
 if(!value||!Object.hasOwn(MUSIC_SERVERS,value.server))return null;
 const url=musicURL(value.url);if(!url)return null;
 return {server:value.server,id:text(value.id,150),title:text(value.title,200)||'未命名歌曲',artist:text(value.artist,300),url,lrc:musicURL(value.lrc),lyrics:text(value.lyrics,100000)};
}
export function musicSearchURL(endpoint,server,query){
 if(!Object.hasOwn(MUSIC_SERVERS,server))throw Error('请选择网易云音乐或 QQ 音乐。');
 const safe=musicURL(endpoint);if(!safe)throw Error('搜索服务地址必须是有效的 HTTP(S) 地址。');
 const keyword=String(query).trim().slice(0,200);if(!keyword)throw Error('请输入歌名或歌手。');
 const u=new URL(safe);u.hash='';for(const [k,v]of Object.entries({server,type:'search',id:keyword,limit:'20',page:'1'}))u.searchParams.set(k,v);return u.href;
}
export function normalizeMusicResults(raw,server,endpoint){
 let rows=Array.isArray(raw)?raw:raw?.data?.result??raw?.data??raw?.result;
 if(!Array.isArray(rows))throw Error('搜索服务没有返回歌曲列表，可能不支持此平台或需要授权。');
 return rows.slice(0,30).filter(x=>x&&typeof x==='object').map(x=>{
  const artist=x.author??x.artist??x.artists??'';
  return {server,id:String(x.id??x.songmid??'').slice(0,150),title:text(x.title??x.name,200)||'未命名歌曲',artist:text(Array.isArray(artist)?artist.map(a=>typeof a==='string'?a:a?.name||'').join(' / '):artist,300),url:musicURL(x.url,endpoint),lrc:musicURL(x.lrc,endpoint)};
 });
}
export function officialMusicSearch(server,query){
 const q=encodeURIComponent(String(query).trim().slice(0,200));
 return server==='tencent'?`https://y.qq.com/n/ryqq/search?w=${q}&t=song`:`https://music.163.com/#/search/m/?s=${q}&type=1`;
}

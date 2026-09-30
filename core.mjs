export const THEMES = {
 neon: {name:'霓虹现场',accent:'#ff65cb',secondary:'#74e9ff',base:'#090817',effect:'laser',radius:18,font:'sans'},
 paper: {name:'黑白线框',accent:'#eeeeee',secondary:'#969696',base:'#171717',effect:'none',radius:0,font:'sans'},
 candy: {name:'粉白星绘',accent:'#e74e9e',secondary:'#78c6d4',base:'#fff0f7',effect:'stars',radius:28,font:'sans'},
 gothic: {name:'月下剧院',accent:'#d390ab',secondary:'#c6b592',base:'#190e19',effect:'stars',radius:3,font:'serif'},
 garden: {name:'水榭听风',accent:'#92cbbd',secondary:'#e3c9aa',base:'#102322',effect:'snow',radius:12,font:'serif'},
};
export const DEFAULT_PROFILE = {theme:'neon',name:'',description:'',quote:'',tags:'',owner:'',accent:'',secondary:'',base:'',font:'',radius:null,opacity:.9,scale:1,offsetX:0,offsetY:0,mirror:false,fit:'contain',image:'',background:'',music:'',lyrics:'',effect:'',volume:.6};
const str=(x,n)=>typeof x==='string'?x.slice(0,n):'';
const number=(x,d,a,b)=>Number.isFinite(Number(x))?Math.max(a,Math.min(b,Number(x))):d;
export function cleanProfile(x={}){if(!x||typeof x!=='object'||Array.isArray(x))x={};const p={...DEFAULT_PROFILE};p.theme=Object.hasOwn(THEMES,x.theme)?x.theme:'neon';for(const [k,n] of Object.entries({name:100,description:15000,quote:300,tags:250,owner:100,image:150,background:150,music:150,lyrics:100000}))p[k]=str(x[k],n);for(const k of ['accent','secondary','base'])p[k]=/^#[0-9a-f]{6}$/i.test(x[k]||'')?x[k]:'';p.font=['sans','serif'].includes(x.font)?x.font:'';p.effect=['laser','stars','snow','none'].includes(x.effect)?x.effect:'';p.radius=x.radius==null?null:number(x.radius,18,0,36);p.scale=number(x.scale??1,1,.5,2);p.offsetX=number(x.offsetX??0,0,-60,60);p.mirror=x.mirror===true;p.offsetY=number(x.offsetY??0,0,-40,40);p.opacity=number(x.opacity??.9,.9,.15,1);p.volume=number(x.volume??.6,.6,0,1);p.fit=x.fit==='cover'?'cover':'contain';return p}
export function styleFor(profile){const p=cleanProfile(profile),t=THEMES[p.theme];return {...t,accent:p.accent||t.accent,secondary:p.secondary||t.secondary,base:p.base||t.base,font:p.font||t.font,effect:p.effect||t.effect,radius:p.radius??t.radius}}
export function collectPersonas(power={},active='',activeName=''){const names=power.personas||{},descs=power.persona_descriptions||{};const keys=new Set([...Object.keys(names),...Object.keys(descs)]);if(active)keys.add(active);return [...keys].map(id=>({id,name:typeof names[id]==='string'?names[id]:(id===active?activeName:'未命名人设'),description:typeof descs[id]?.description==='string'?descs[id].description:'',title:typeof descs[id]?.title==='string'?descs[id].title:''}));}
export function parseLrc(text){const out=[];for(const line of String(text).split(/\r?\n/)){const matches=[...line.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)];const txt=line.replace(/\[[^\]]*\]/g,'').trim();for(const m of matches)out.push({time:Number(m[1])*60+Number(m[2])+Number('0.'+(m[3]||'0')),text:txt});}return out.sort((a,b)=>a.time-b.time)}
export function lyricAt(lines,time){let result='';for(const l of lines){if(l.time>time)break;result=l.text}return result}
export function parsePackage(raw){if(!raw||raw.format!=='persona-stage'||raw.version!==1)throw Error('这不是映我的布景文件');const profile=cleanProfile(raw.profile);const assets={};let total=0;for(const k of ['image','background','music']){const v=raw.assets?.[k];if(v==null)continue;const pattern=k==='music'?/^data:audio\/(mpeg|mp3|wav|x-wav|ogg|mp4|aac|webm);base64,[A-Za-z0-9+/=]+$/:/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;if(typeof v!=='string'||!pattern.test(v))throw Error('布景里有无法识别的素材');total+=v.length;if(total>40*1024*1024)throw Error('布景文件过大');assets[k]=v;}return {profile,assets}}


// Wardrobes belong to a persona ID, never to a display name.
export function cleanOutfit(x={}) {
 if (!x || typeof x !== 'object') x={};
 const pose=cleanProfile(x);
 return {id:str(x.id,150),name:str(x.name,100)||'未命名穿搭',positive:str(x.positive,20000),negative:str(x.negative,20000),image:str(x.image,150),scale:pose.scale,offsetX:pose.offsetX,offsetY:pose.offsetY,mirror:pose.mirror,fit:pose.fit};
}
export function cleanWardrobe(x={}) {
 if (!x || typeof x !== 'object') x={};
 const seen=new Set();
 const outfits=(Array.isArray(x.outfits)?x.outfits:[]).map(cleanOutfit).filter(o=>o.id&&!seen.has(o.id)&&seen.add(o.id));
 return {outfits,active:outfits.some(o=>o.id===x.active)?x.active:''};
}
export function gesturePose(initial, from, to, width, height) {
 const p=cleanProfile(initial),a=from.slice(0,2),b=to.slice(0,2);
 if (!a.length || a.length!==b.length) return p;
 const center=points=>({x:points.reduce((n,p)=>n+p.x,0)/points.length,y:points.reduce((n,p)=>n+p.y,0)/points.length});
 const c=center(a),d=center(b);
 let scale=p.scale;
 if(a.length===2){const dist=v=>Math.hypot(v[1].x-v[0].x,v[1].y-v[0].y);if(dist(a)>1)scale*=dist(b)/dist(a)}
 return cleanProfile({...p,scale,offsetX:p.offsetX+(d.x-c.x)/Math.max(1,width)*100,offsetY:p.offsetY+(d.y-c.y)/Math.max(1,height)*100});
}

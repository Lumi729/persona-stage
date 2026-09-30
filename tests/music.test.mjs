import test from 'node:test';
import assert from 'node:assert/strict';
import {musicURL,musicSearchURL,normalizeMusicResults,cleanOnlineMusic,officialMusicSearch} from '../music-core.mjs';
import {cleanProfile,parsePackage} from '../core.mjs';

test('music search escapes queries and separates the two platforms',()=>{
 const u=new URL(musicSearchURL('https://music.example/api?token=demo','tencent','周杰伦 & 晴天'));
 assert.equal(u.searchParams.get('id'),'周杰伦 & 晴天');assert.equal(u.searchParams.get('server'),'tencent');assert.equal(u.searchParams.get('token'),'demo');assert.equal(u.searchParams.get('type'),'search');assert.throws(()=>musicSearchURL(u.href,'__proto__','x'));assert.throws(()=>musicSearchURL(u.href,'netease',' '));
 assert.ok(officialMusicSearch('tencent','晴天').startsWith('https://y.qq.com/'));
});
test('untrusted music URLs cannot introduce script, credentials or local files',()=>{
 for(const u of ['javascript:alert(1)','data:audio/wav;base64,YQ==','file:///etc/passwd','https://secret@example.com/a'])assert.equal(musicURL(u),'');
 assert.equal(musicURL('http://music.example/play?id=1','https://music.example/api'),'https://music.example/play?id=1');
 assert.equal(cleanOnlineMusic({server:'unknown',url:'https://example.com/a'}),null);
});
test('Meting results accept title/author or name/artist and preserve unavailable rows',()=>{
 const rows=normalizeMusicResults([{title:'A',author:'B',url:'/play'},{name:'C',artist:['D','E'],url:''},{name:'F',url:'javascript:evil()'}],'netease','https://music.example/api');
 assert.equal(rows[0].url,'https://music.example/play');assert.equal(rows[1].artist,'D / E');assert.equal(rows[1].url,'');assert.equal(rows[2].url,'');assert.throws(()=>normalizeMusicResults({error:'unknown type'},'netease','https://music.example/api'));
});
test('online theme metadata survives profile/package roundtrip without removing local assets',()=>{
 const raw={music:'local-asset',musicMode:'online',onlineMusic:{server:'tencent',title:'Song',artist:'Artist',url:'https://music.example/play',lyrics:'[00:01]hello'}};
 const p=cleanProfile(raw);assert.equal(p.music,'local-asset');assert.equal(p.musicMode,'online');assert.equal(p.onlineMusic.lyrics,'[00:01]hello');assert.equal(parsePackage({format:'persona-stage',version:1,profile:raw}).profile.onlineMusic.title,'Song');assert.equal(cleanProfile({...raw,onlineMusic:{server:'tencent',url:'javascript:bad'}}).musicMode,'local');
});

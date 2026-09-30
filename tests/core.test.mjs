import test from 'node:test';import assert from 'node:assert/strict';import {collectPersonas,cleanProfile,styleFor,parseLrc,lyricAt,parsePackage} from '../core.mjs';
test('reads saved personas and includes unnamed active avatar',()=>{const list=collectPersonas({personas:{'a.png':'千千'},persona_descriptions:{'a.png':{description:'白粉卷发'},'b.png':{description:'梨梨'}}},'c.png','新用户');assert.equal(list.length,3);assert.equal(list[0].description,'白粉卷发');assert.equal(list[2].name,'新用户')});
test('invalid imported CSS, prototype names, bounds are normalized',()=>{const p=cleanProfile({theme:'__proto__',base:'url(javascript:bad)',scale:99,radius:-20,volume:-1});assert.equal(p.theme,'neon');assert.equal(p.base,'');assert.equal(p.scale,2);assert.equal(p.radius,0);assert.equal(p.volume,0);assert.equal(styleFor(p).base,'#090817')});
test('LRC supports multiple timestamps and clears during gaps',()=>{const l=parseLrc('[00:01.50][01:02.125]星光\n[00:04.00]\n[ti:歌名]');assert.equal(l.length,3);assert.equal(lyricAt(l,2),'星光');assert.equal(lyricAt(l,5),'');assert.equal(l[2].time,62.125)});
test('package roundtrip validates assets and preserves theme',()=>{const p=parsePackage({format:'persona-stage',version:1,profile:{theme:'garden',quote:'水榭'},assets:{image:'data:image/png;base64,YQ=='}});assert.equal(p.profile.theme,'garden');assert.equal(p.profile.quote,'水榭');assert.ok(p.assets.image)});
test('rejects executable image formats and foreign files',()=>{assert.throws(()=>parsePackage({format:'persona-stage',version:1,assets:{image:'data:image/svg+xml;base64,YQ=='}}));assert.throws(()=>parsePackage({format:'other',version:1}));assert.throws(()=>parsePackage({format:'persona-stage',version:1,assets:{music:'https://example.com/track'}}))});

import {cleanWardrobe,cleanOutfit,gesturePose} from '../core.mjs';
test('wardrobe retains literal NovelAI weights and excludes duplicate or invalid selections',()=>{
 const tags='1girl, {{{white dress}}}, [hat], <script>alert(1)</script>';
 const w=cleanWardrobe({active:'missing',outfits:[{id:'one',positive:tags,negative:'lowres',offsetX:200,mirror:true},{id:'one',name:'duplicate'},{name:'no id'}]});
 assert.equal(w.active,'');assert.equal(w.outfits.length,1);assert.equal(w.outfits[0].positive,tags);assert.equal(w.outfits[0].offsetX,60);assert.equal(w.outfits[0].mirror,true);
 assert.equal(cleanWardrobe({active:'one',outfits:w.outfits}).active,'one');assert.equal(cleanOutfit(null).name,'未命名穿搭');
});
test('gesture translates in stage coordinates and scales around bounded pose',()=>{
 const moved=gesturePose({scale:1},[{x:10,y:20}],[{x:60,y:70}],200,250);
 assert.equal(moved.offsetX,25);assert.equal(moved.offsetY,20);
 const pinch=gesturePose({scale:1},[{x:0,y:0},{x:10,y:0}],[{x:0,y:0},{x:30,y:0}],200,250);
 assert.equal(pinch.scale,2);assert.equal(pinch.offsetX,5);
 assert.equal(gesturePose({},[{x:0,y:0}],[{x:10000,y:-10000}],200,200).offsetY,-40);
});

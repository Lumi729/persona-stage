import { cleanWardrobe, cleanOutfit } from './core.mjs';

export function createWardrobe({settings,save,current,showPanel,body,el,button,notify,render,readAsset,storeAsset,deleteAsset}) {
    settings.wardrobes ??= {};
    let previews=[];
    const cleanup=()=>{previews.forEach(URL.revokeObjectURL);previews=[]};
    const get=id=>cleanWardrobe(Object.hasOwn(settings.wardrobes,id)?settings.wardrobes[id]:{});
    const put=(id,w)=>{Object.defineProperty(settings.wardrobes,id,{value:cleanWardrobe(w),writable:true,enumerable:true,configurable:true});save()};
    const active=id=>{const w=get(id);return w.outfits.find(o=>o.id===w.active)};
    function updatePose(id,pose,outfitId=get(id).active){const w=get(id);const o=w.outfits.find(o=>o.id===outfitId);if(o){Object.assign(o,pose);put(id,w)}}
    async function copy(text){if(!text){notify('这组 tags 还是空的。');return}try{await navigator.clipboard.writeText(text);notify('Tags 已复制。')}catch{const area=el('textarea');area.value=text;body.append(area);area.focus();area.select();notify('请长按选中的文字复制。')}}
    function field(parent,label,value,textarea=false){const row=el('label',null,'field');row.append(el('span',label));const input=el(textarea?'textarea':'input');if(!textarea)input.type='text';input.value=value;input.maxLength=textarea?20000:100;input.spellcheck=false;row.append(input);parent.append(row);return input}
    function show(){
        const id=current();if(!id){notify('先在酒馆选一个 user 人设。');return}
        cleanup();showPanel('衣柜 · 当前展示人设');
        body.append(el('p','每个 user 单独保存穿搭、展示图和 NovelAI tags；只保存和复制，不会自动请求生图。','hint'));
        const w=get(id),actions=el('div',null,'row');
        actions.append(button('＋ 新建穿搭',()=>edit(id)),button('使用原始立绘',()=>{const next=get(id);next.active='';put(id,next);render();show()}));body.append(actions);
        if(!w.outfits.length)body.append(el('p','还没有穿搭。新建一套，保存图片和生图 tags 吧。'));
        for(const o of w.outfits){
            const card=el('div',null,'card'),image=el('img');image.alt=o.name;
            if(o.image){card.append(image);readAsset(o.image).then(blob=>{if(!card.isConnected)return;if(blob){const url=URL.createObjectURL(blob);previews.push(url);image.src=url}else image.alt='此设备缺少展示图'})}
            const detail=el('div');detail.append(el('strong',o.name),el('small',o.positive||'尚未填写正向 tags'));
            const row=el('div',null,'row');row.append(button(w.active===o.id?'正在穿着':'换装展示',()=>{const next=get(id);next.active=o.id;put(id,next);render();show()}),button('编辑',()=>edit(id,o.id)),button('复制正向',()=>copy(o.positive)),button('复制负向',()=>copy(o.negative)));
            detail.append(row);card.append(detail);body.append(card);
        }
        const backups=el('div',null,'row');backups.append(button('导出衣柜（含图片）',()=>exportAll(id)),button('导入衣柜',()=>importAll(id)));body.append(backups,el('p','图片仅保存在当前浏览器。换设备前请导出衣柜；原有“布景包”不包含衣柜。','hint'));
    }
    function edit(id,outfitId=''){
        cleanup();showPanel(outfitId?'编辑穿搭':'新建穿搭');
        const original=get(id).outfits.find(o=>o.id===outfitId),draft=cleanOutfit(original||{id:crypto.randomUUID(),name:'新穿搭'});
        const form=el('form'),name=field(form,'穿搭名称',draft.name),positive=field(form,'NovelAI 正向 tags（Prompt）',draft.positive,true),negative=field(form,'NovelAI 负向 tags（UC）',draft.negative,true);
        positive.placeholder='1girl, white dress, ...';negative.placeholder='lowres, ...';
        const copies=el('div',null,'row');copies.append(button('复制正向',()=>copy(positive.value)),button('复制负向',()=>copy(negative.value)));form.append(copies);
        const preview=el('img',null,'outfit-preview');preview.alt='穿搭展示图';preview.hidden=true;form.append(preview);
        let pending=null,clear=false,busy=false,loading=false,uploadRevision=0;
        const previewBlob=blob=>{cleanup();const url=URL.createObjectURL(blob);previews.push(url);preview.src=url;preview.hidden=false};
        if(draft.image)readAsset(draft.image).then(blob=>{if(blob&&form.isConnected&&!pending&&!clear)previewBlob(blob)});
        const label=el('label','上传展示图（PNG / JPG / WebP，8 MB 以内）','file'),upload=el('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';label.append(upload);form.append(label);
        upload.onchange=async()=>{const file=upload.files[0];if(!file)return;if(file.size>8*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){notify('请选 8 MB 以内的 PNG、JPG 或 WebP 图片。');return}const token=++uploadRevision;loading=true;submit.disabled=true;try{const image=await createImageBitmap(file);image.close();if(!form.isConnected||token!==uploadRevision)return;pending=file;clear=false;previewBlob(file)}catch{notify('这张图片无法读取。')}finally{if(token===uploadRevision){loading=false;submit.disabled=busy}}};
        form.append(button('移除展示图',()=>{uploadRevision++;loading=false;submit.disabled=busy;pending=null;clear=true;cleanup();preview.hidden=true;upload.value=''}));
        const row=el('div',null,'row'),submit=el('button','保存穿搭');submit.type='submit';row.append(submit,button('取消',show));form.append(row);
        form.onsubmit=async e=>{e.preventDefault();if(busy||loading)return;busy=true;submit.disabled=true;let created='';try{const w=get(id);if(!original&&w.outfits.length>=50)throw Error('每个人设最多保存 50 套穿搭，请先整理衣柜。');if(pending)created=await storeAsset(pending);const updated=cleanOutfit({...draft,name:name.value,positive:positive.value,negative:negative.value,image:created||(clear?'':draft.image)});const at=w.outfits.findIndex(o=>o.id===draft.id);if(at<0)w.outfits.push(updated);else w.outfits[at]=updated;put(id,w);if(draft.image&&draft.image!==updated.image)await deleteAsset(draft.image);if(current()===id)render();show();notify('穿搭已保存，点击“换装展示”即可使用。')}catch(e){if(created)await deleteAsset(created);notify(e.message||'保存失败')}finally{busy=false;submit.disabled=false}};
        if(original)form.append(button('删除这套穿搭',async()=>{if(busy||!confirm('删除这套穿搭及其展示图？'))return;busy=true;const w=get(id);w.outfits=w.outfits.filter(o=>o.id!==draft.id);if(w.active===draft.id)w.active='';put(id,w);await deleteAsset(draft.image);if(current()===id)render();show()}));
        body.append(form);
    }
    async function exportAll(id){try{const w=get(id),outfits=[];let size=0;for(const o of w.outfits){const blob=await readAsset(o.image);if(o.image&&!blob)throw Error('衣柜中有缺失图片，请补齐或移除后再导出。');const image=blob?await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)}):'';size+=image.length;if(size>40*1024*1024)throw Error('衣柜图片合计过大，请减少图片大小后导出。');outfits.push({...o,image})}const payload={format:'persona-stage-wardrobe',version:1,active:w.active,outfits};const url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'}));const a=el('a');a.href=url;a.download='映我-衣柜.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);notify('衣柜已导出，包含 tags 和展示图。')}catch(e){notify(e.message||'导出失败')}}
    function importAll(id){const input=el('input');input.type='file';input.accept='.json';input.onchange=async()=>{const file=input.files[0];if(!file)return;const created=[];try{if(file.size>42*1024*1024)throw Error('衣柜文件不能超过 42 MB。');const raw=JSON.parse(await file.text());if(raw?.format!=='persona-stage-wardrobe'||raw.version!==1||!Array.isArray(raw.outfits))throw Error('这不是映我的衣柜文件。');if(get(id).outfits.length+raw.outfits.length>50)throw Error('导入后超过 50 套，请先整理衣柜。');const additions=[];for(const item of raw.outfits){const o=cleanOutfit(item);o.id=crypto.randomUUID();o.image='';if(item.image){if(typeof item.image!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(item.image))throw Error('衣柜包含无法识别的图片。');const blob=await(await fetch(item.image)).blob();if(blob.size>8*1024*1024)throw Error('单张展示图不能超过 8 MB。');const decoded=await createImageBitmap(blob);decoded.close();o.image=await storeAsset(blob);created.push(o.image)}additions.push(o)}const w=get(id);if(w.outfits.length+additions.length>50)throw Error('衣柜数量超过限制。');w.outfits.push(...additions);put(id,w);show();notify('已添加到当前人设衣柜，原有穿搭保留。')}catch(e){for(const asset of created)await deleteAsset(asset);notify(e.message||'导入失败')}};input.click()}
    return {show,active,updatePose,cleanup};
}

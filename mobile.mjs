import { gesturePose } from './core.mjs';

export function setupMobile({root,settings,save,show,el,button,notify,getPose,putPose}) {
    const launch=root.querySelector('.launch'),points=new Map();
    let drag=null,ignoreClick=false,baseline=null,target=null;
    function clampLaunch(){
        launch.classList.toggle('launcher-disabled',settings.launcherHidden===true);
        if(!settings.launcherPosition)return;
        const p=settings.launcherPosition,size=45;
        const x=Math.max(0,Math.min(Number(p.x)||0,innerWidth-size)),y=Math.max(0,Math.min(Number(p.y)||0,innerHeight-size));
        launch.style.left=x+'px';launch.style.top=y+'px';launch.style.right='auto';launch.style.bottom='auto';
    }
    launch.onpointerdown=e=>{if(e.button!==0)return;const r=launch.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};ignoreClick=false;launch.setPointerCapture(e.pointerId)};
    launch.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>6)drag.moved=true;if(!drag.moved)return;settings.launcherPosition={x:drag.left+dx,y:drag.top+dy};clampLaunch()};
    launch.onpointerup=launch.onpointercancel=()=>{if(!drag)return;ignoreClick=drag.moved;if(drag.moved){const rect=launch.getBoundingClientRect();settings.launcherPosition={x:rect.left+22.5<innerWidth/2?8:Math.max(0,innerWidth-53),y:Math.max(0,Math.min(rect.top,innerHeight-45))};clampLaunch();save()}drag=null};
    launch.onclick=()=>{if(ignoreClick){ignoreClick=false;return}show()};
    const apply=(figure,p)=>{figure.style.setProperty('--scale',p.scale);figure.style.setProperty('--x',p.offsetX+'%');figure.style.setProperty('--y',p.offsetY+'%');figure.style.setProperty('--mirror',p.mirror?-1:1)};
    function rebase(){if(!target||!points.size)return;baseline={pose:getPose(target),points:[...points.values()],width:target.clientWidth,height:target.clientHeight}}
    function end(){if(target&&baseline)putPose(target,getPose(target),true);points.clear();target=null;baseline=null}
    for(const figure of root.querySelectorAll('.actor')){
        figure.onpointerdown=e=>{if(e.button!==0||target&&target!==figure||points.size>=2)return;target=figure;putPose(figure,getPose(figure),false);points.set(e.pointerId,{x:e.clientX,y:e.clientY});figure.setPointerCapture(e.pointerId);rebase();e.preventDefault()};
        figure.onpointermove=e=>{if(target!==figure||!points.has(e.pointerId)||!baseline)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=gesturePose(baseline.pose,baseline.points,[...points.values()],baseline.width,baseline.height);putPose(figure,p,false);apply(figure,p);e.preventDefault()};
        figure.onpointerup=figure.onpointercancel=e=>{if(!points.has(e.pointerId))return;points.delete(e.pointerId);if(points.size)rebase();else end()};
        figure.addEventListener('lostpointercapture',e=>{if(points.has(e.pointerId))end()});
    }
    function controls(parent){
        parent.append(el('h4','手机操作'),el('p','直接拖动立绘调整位置，双指缩放；悬浮星星拖动后会自动贴边。','hint'));
        const row=el('label',null,'field'),input=el('input');input.type='checkbox';input.checked=settings.launcherHidden===true;input.onchange=()=>{settings.launcherHidden=input.checked;save();clampLaunch();notify(input.checked?'悬浮入口已隐藏，可从扩展设置重新打开。':'悬浮入口已显示。')};row.append(input,el('span','隐藏悬浮入口'));parent.append(row,button('重置悬浮入口位置',()=>{delete settings.launcherPosition;launch.style.left='';launch.style.top='';launch.style.right='';launch.style.bottom='';save();clampLaunch();notify('悬浮入口位置已重置。')}));
    }
    addEventListener('resize',clampLaunch);clampLaunch();
    return {controls,apply,cancelGesture:end};
}

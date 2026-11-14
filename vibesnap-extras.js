import { supabase } from "./supabase-adapter.js";
(()=>{"use strict";
const $=id=>document.getElementById(id);
const bridge=()=>window.VibeSnapBridge||{};
const user=()=>bridge().currentUser||null;
const friend=()=>bridge().selectedFriend||null;
const notify=(...args)=>{const fn=bridge().notify;if(typeof fn==="function")return fn(...args);console.warn(...args)};
const prefKey=()=> "vibesnap-extras-"+(user()?.uid||"guest");
const read=()=>{try{return JSON.parse(localStorage.getItem(prefKey())||"{}")}catch(_){return{}}};
const write=patch=>{const next={...read(),...patch};try{localStorage.setItem(prefKey(),JSON.stringify(next))}catch(_){notify("Could not save this preference in this browser.","error")}return next};
const css=[
"#app .vsExtraButton{padding:9px 12px;border:1px solid rgba(190,174,255,.2);border-radius:11px;background:#282238;color:#f4efff;font-size:12px;font-weight:800}",
"#app .vsFriendWallpaperButton{width:38px;height:38px;flex:none;border:1px solid rgba(190,174,255,.2);border-radius:12px;background:#282238;color:#fff;font-size:18px}",
"#app .vsFriendSince{display:block;color:#b8a6df;font-size:10px;font-weight:700;white-space:nowrap}",
"#app .vsFrameChoice,#app .vsDynamicChoice{width:100%;min-height:42px;margin:7px 0 12px;padding:0 11px;border:1px solid rgba(190,174,255,.2);border-radius:11px;background:#171421;color:#fff}",
"#app .profileAvatar.vsFrame-violet{outline:4px solid #9675ff;outline-offset:3px}",
"#app .profileAvatar.vsFrame-ocean{outline:4px solid #32b9ed;outline-offset:3px}",
"#app .profileAvatar.vsFrame-rose{outline:4px solid #ed6aa6;outline-offset:3px}",
"#app .profileAvatar.vsFrame-gold{outline:4px solid #f5ca68;outline-offset:3px}",
"#app .vsVoiceSpeed{margin:6px 0 0;padding:6px 8px;border:1px solid rgba(190,174,255,.2);border-radius:8px;background:#211b30;color:#fff;font-size:11px}",
"#app.vsDynamicBackdrop{background-size:300% 300%!important;animation:vsDynamicFlow 18s ease infinite}",
"@keyframes vsDynamicFlow{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}",
"#app #chatMessages.vsFriendWall-violet{background:radial-gradient(ellipse at 10% 0%,rgba(145,100,255,.23),transparent 48%),#151220!important}",
"#app #chatMessages.vsFriendWall-ocean{background:radial-gradient(ellipse at 10% 0%,rgba(30,190,230,.22),transparent 48%),#101923!important}",
"#app #chatMessages.vsFriendWall-rose{background:radial-gradient(ellipse at 10% 0%,rgba(240,85,160,.2),transparent 48%),#1d1420!important}",
"#app #chatMessages.vsFriendWall-aurora{background:linear-gradient(135deg,#102a2b,#24153e,#10233b)!important}",
"#app #chatMessages.vsFriendWall-midnight{background:linear-gradient(145deg,#12101b,#191526 62%,#101827)!important}",
"@media(prefers-reduced-motion:reduce){#app.vsDynamicBackdrop{animation:none}}"
].join("\n");
if(!$("vibesnap-personalization-pack")){const style=document.createElement("style");style.id="vibesnap-personalization-pack";style.textContent=css;document.head.appendChild(style)}
function insertProfileTools(){
 const editor=document.querySelector("#profilePage .vsProfileEditor");if(!editor||$("vsFrameChoice"))return;
 const label=document.createElement("label");label.textContent="Profile frame";label.htmlFor="vsFrameChoice";editor.appendChild(label);
 const select=document.createElement("select");select.id="vsFrameChoice";select.className="vsFrameChoice";
 select.innerHTML='<option value="violet">Violet frame</option><option value="ocean">Ocean frame</option><option value="rose">Rose frame</option><option value="gold">Golden frame</option><option value="none">No frame</option>';
 editor.appendChild(select);select.value=read().frame||"violet";
 select.addEventListener("change",()=>{write({frame:select.value});applyFrame()});
}
function applyFrame(){const avatar=$("profileAvatar");if(!avatar)return;["violet","ocean","rose","gold"].forEach(x=>avatar.classList.remove("vsFrame-"+x));const v=read().frame||"violet";if(v!=="none")avatar.classList.add("vsFrame-"+v);if($("vsFrameChoice"))$("vsFrameChoice").value=v}
function insertSettingsTools(){
 const panel=document.querySelector("#settingsPage .settingsPanel");if(!panel||$("vsDynamicChoice"))return;
 const label=document.createElement("label");label.className="vsSettingRow";
 label.innerHTML='<span><b>Dynamic backgrounds</b><small>Animated colour movement across VibeSnap</small></span>';
 const select=document.createElement("select");select.id="vsDynamicChoice";select.className="vsDynamicChoice";
 select.innerHTML='<option value="off">Off</option><option value="violet">Violet flow</option><option value="ocean">Ocean flow</option><option value="aurora">Aurora flow</option><option value="rose">Rose flow</option>';
 label.appendChild(select);panel.insertBefore(label,panel.querySelector(".vsSettingsDivider")||null);
 select.value=read().dynamic||"off";select.addEventListener("change",()=>{write({dynamic:select.value});applyDynamic()});
}
function applyDynamic(){
 const app=$("app");if(!app)return;const mode=read().dynamic||"off";app.classList.toggle("vsDynamicBackdrop",mode!=="off");
 const backgrounds={violet:"linear-gradient(120deg,#11101b,#35205d,#111827,#241544)",ocean:"linear-gradient(120deg,#081c2b,#14536a,#172c53,#101827)",aurora:"linear-gradient(120deg,#092b2a,#27416b,#4a245f,#0d2631)",rose:"linear-gradient(120deg,#2b1028,#6b2452,#30204f,#161327)"};
 app.style.background=backgrounds[mode]||"";
}
const walls=["midnight","violet","ocean","rose","aurora"];
function applyFriendWallpaper(){
 const host=$("chatMessages");if(!host)return;
 const active=friend();
 if(!active){
  walls.forEach(x=>{const className="vsFriendWall-"+x;if(host.classList.contains(className))host.classList.remove(className)});
  const button=$("vsFriendWallpaperButton");if(button)button.title="Change wallpaper for this friend";return;
 }
 const map=read().friendWallpapers||{},value=walls.includes(map[active.uid])?map[active.uid]:"midnight";
 walls.forEach(x=>{const className="vsFriendWall-"+x;const shouldApply=x===value;if(host.classList.contains(className)!==shouldApply)host.classList.toggle(className,shouldApply)});
 const button=$("vsFriendWallpaperButton");if(button)button.title="Chat wallpaper: "+value;
}
function addChatWallpaperButton(){
 const head=document.querySelector("#chatConversation .conversationHeader");if(!head||$("vsFriendWallpaperButton"))return;
 const button=document.createElement("button");button.id="vsFriendWallpaperButton";button.className="vsFriendWallpaperButton";button.type="button";
 button.textContent="▧";button.title="Change wallpaper for this friend";button.setAttribute("aria-label","Change chat wallpaper");
 button.addEventListener("click",()=>{const active=friend();if(!active)return;const map={...(read().friendWallpapers||{})};const current=map[active.uid]||"midnight";map[active.uid]=walls[(walls.indexOf(current)+1)%walls.length];write({friendWallpapers:map});applyFriendWallpaper();notify("Wallpaper for this chat: "+map[active.uid],"success")});
 const camera=$("conversationCamera");head.insertBefore(button,camera||null);
}
function friendshipSince(){
 const heading=$("chatName"),active=friend(),me=user();if(!heading||!active||!me)return;
 let node=$("vsFriendSince");if(!node){node=document.createElement("small");node.id="vsFriendSince";node.className="vsFriendSince";heading.insertAdjacentElement("afterend",node)}
 const rows=bridge().acceptedFriendships||[];
 const friendship=rows.find(x=>Array.isArray(x.members)&&x.members.includes(me.uid)&&x.members.includes(active.uid));
 const created=friendship&&(friendship.createdAt||friendship.created_at);
 const nextText=created?"Friends since "+new Date(created).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"";
 if(node.textContent!==nextText)node.textContent=nextText;
}
function addVoiceSpeedControls(root=document){
 root.querySelectorAll?.("#chatMessages audio").forEach(audio=>{
  if(audio.dataset.vsSpeedControl)return;audio.dataset.vsSpeedControl="1";
  const select=document.createElement("select");select.className="vsVoiceSpeed";select.setAttribute("aria-label","Voice playback speed");
  select.innerHTML='<option value="1">1× speed</option><option value="1.5">1.5× speed</option><option value="2">2× speed</option>';
  select.addEventListener("change",()=>{audio.playbackRate=Number(select.value)});audio.parentElement?.appendChild(select);
 });
}
function refresh(){insertProfileTools();insertSettingsTools();addChatWallpaperButton();addVoiceSpeedControls();applyFrame();applyDynamic();applyFriendWallpaper();friendshipSince()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",refresh,{once:true});else refresh();
const chat=$("chatConversation");if(chat)new MutationObserver(()=>{addChatWallpaperButton();applyFriendWallpaper();friendshipSince()}).observe(chat,{attributes:true,subtree:true,childList:true,attributeFilter:["class"]});
const messages=$("chatMessages");if(messages)new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)addVoiceSpeedControls(node.parentElement||messages)}))).observe(messages,{childList:true,subtree:true});
const profile=$("profilePage");if(profile)new MutationObserver(()=>{insertProfileTools();applyFrame()}).observe(profile,{childList:true,subtree:true});
const settings=$("settingsPage");if(settings)new MutationObserver(()=>{insertSettingsTools();applyDynamic()}).observe(settings,{childList:true,subtree:true});
// Re-apply account-scoped preferences after sign-in, sign-out, or account changes.
supabase.auth.onAuthStateChange((event)=>{
 if(event==="SIGNED_IN"||event==="SIGNED_OUT"||event==="USER_UPDATED"||event==="INITIAL_SESSION"){
  // Let the main app's auth listener update the bridge's currentUser first.
  setTimeout(()=>refresh(),0);
 }
});
window.VibeSnapExtras={refresh};
})();

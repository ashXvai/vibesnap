(()=>{"use strict";
if(!window.matchMedia("(min-width:1024px)").matches)return;
const $=id=>document.getElementById(id);
const key="vibesnap-desktop-personalization";
const read=()=>{try{return JSON.parse(localStorage.getItem(key)||"{}")}catch(_){return{}}};
const save=patch=>{const next={...read(),...patch};try{localStorage.setItem(key,JSON.stringify(next))}catch(_){}return next};
const css=`
@media(min-width:1024px){
 #app .vsDesktopExtraControl{width:100%;min-height:40px;margin:7px 0 12px;padding:0 11px;border:1px solid rgba(190,174,255,.22);border-radius:11px;background:#171421;color:#fff}
 #app .vsDesktopFrame-violet{outline:4px solid #9675ff!important;outline-offset:3px}
 #app .vsDesktopFrame-ocean{outline:4px solid #32b9ed!important;outline-offset:3px}
 #app .vsDesktopFrame-rose{outline:4px solid #ed6aa6!important;outline-offset:3px}
 #app .vsDesktopFrame-gold{outline:4px solid #f5ca68!important;outline-offset:3px}
 #app.vsDesktopDynamic{background-size:300% 300%!important;animation:vsDesktopFlow 18s ease infinite}
 #app.vsDesktopBg-violet{background-image:linear-gradient(120deg,#11101b,#35205d,#111827,#241544)!important}
 #app.vsDesktopBg-ocean{background-image:linear-gradient(120deg,#081c2b,#14536a,#172c53,#101827)!important}
 #app.vsDesktopBg-aurora{background-image:linear-gradient(120deg,#092b2a,#27416b,#4a245f,#0d2631)!important}
 #app.vsDesktopBg-rose{background-image:linear-gradient(120deg,#2b1028,#6b2452,#30204f,#161327)!important}
 @keyframes vsDesktopFlow{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
 #app .vsDesktopVoiceSpeed{margin:6px 0 0;padding:6px 8px;border:1px solid rgba(190,174,255,.2);border-radius:8px;background:#211b30;color:#fff;font-size:11px}
}
@media(min-width:1024px) and (prefers-reduced-motion:reduce){#app.vsDesktopDynamic{animation:none}}
`;
const style=document.createElement("style");style.id="vibesnap-desktop-personalization-style";style.textContent=css;document.head.appendChild(style);
function applyFrame(){const avatar=$("profileAvatar");if(!avatar)return;["violet","ocean","rose","gold"].forEach(x=>avatar.classList.remove("vsDesktopFrame-"+x));const v=read().frame||"violet";if(v!=="none")avatar.classList.add("vsDesktopFrame-"+v);const select=$("vsDesktopFrameChoice");if(select)select.value=v}
function addFrameChoice(){const editor=document.querySelector("#profilePage .vsProfileEditor");if(!editor||$("vsDesktopFrameChoice"))return;const label=document.createElement("label");label.htmlFor="vsDesktopFrameChoice";label.textContent="Profile frame";const select=document.createElement("select");select.id="vsDesktopFrameChoice";select.className="vsDesktopExtraControl";select.innerHTML='<option value="violet">Violet frame</option><option value="ocean">Ocean frame</option><option value="rose">Rose frame</option><option value="gold">Golden frame</option><option value="none">No frame</option>';editor.append(label,select);select.value=read().frame||"violet";select.addEventListener("change",()=>{save({frame:select.value});applyFrame()})}
function applyBackground(){const app=$("app");if(!app)return;const mode=read().background||"off";["violet","ocean","aurora","rose"].forEach(x=>app.classList.remove("vsDesktopBg-"+x));app.classList.toggle("vsDesktopDynamic",mode!=="off");if(["violet","ocean","aurora","rose"].includes(mode))app.classList.add("vsDesktopBg-"+mode)}
function addBackgroundChoice(){const panel=document.querySelector("#settingsPage .settingsPanel");if(!panel||$("vsDesktopBackgroundChoice"))return;const label=document.createElement("label");label.textContent="Desktop background";label.htmlFor="vsDesktopBackgroundChoice";const select=document.createElement("select");select.id="vsDesktopBackgroundChoice";select.className="vsDesktopExtraControl";select.innerHTML='<option value="off">Off</option><option value="violet">Violet flow</option><option value="ocean">Ocean flow</option><option value="aurora">Aurora flow</option><option value="rose">Rose flow</option>';panel.append(label,select);select.value=read().background||"off";select.addEventListener("change",()=>{save({background:select.value});applyBackground()})}
function addVoiceControls(root=document){root.querySelectorAll?.("#chatMessages audio").forEach(audio=>{if(audio.dataset.vsDesktopSpeed)return;audio.dataset.vsDesktopSpeed="1";const select=document.createElement("select");select.className="vsDesktopVoiceSpeed";select.setAttribute("aria-label","Voice playback speed");select.innerHTML='<option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option>';select.addEventListener("change",()=>{audio.playbackRate=Number(select.value)});audio.parentElement?.appendChild(select)})}
function refresh(){if(!window.matchMedia("(min-width:1024px)").matches)return;addFrameChoice();addBackgroundChoice();addVoiceControls();applyFrame();applyBackground()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",refresh,{once:true});else refresh();
const messages=$("chatMessages");if(messages)new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)addVoiceControls(n.parentElement||messages)}))).observe(messages,{childList:true,subtree:true});
const profile=$("profilePage");if(profile)new MutationObserver(refresh).observe(profile,{childList:true,subtree:true});
const settings=$("settingsPage");if(settings)new MutationObserver(refresh).observe(settings,{childList:true,subtree:true});
window.addEventListener("resize",()=>{if(window.matchMedia("(min-width:1024px)").matches)refresh()});
})();
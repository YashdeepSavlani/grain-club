/* ---------- Grain Club app ---------- */
(function(){
'use strict';
const E = GC_Engine;
const $ = s => document.querySelector(s);
function el(tag, attrs, ...kids){
  const n=document.createElement(tag);
  if(attrs) for(const k in attrs){
    const v=attrs[k];
    if(k==='text') n.textContent=v; else if(k==='class') n.className=v;
    else if(k.slice(0,2)==='on') n.addEventListener(k.slice(2),v);
    else if(v!==false && v!=null) n.setAttribute(k,v===true?'':v);
  }
  for(const k of kids) if(k!=null) n.append(k);
  return n;
}
const rnd=()=>Math.random();
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const p2=n=>String(n).padStart(2,'0');

/* ---------- cameras ---------- */
const DSEG={on:true,style:'seg',color:'amber'};
const LOOKS=[
 {id:'gold135',flick:0.15,name:'Gold 135',tag:'35mm',group:'FILM',ar:1.5,sw:['#f2b04a','#c9642c','#3d5a3a'],
  p:{temp:.18,con:1.08,sat:1.12,fade:.04,gain:[1.04,1,.94],lift:[.02,.01,0],shT:[.01,.015,0],hiT:[.03,.015,-.02],grain:.16,gsize:1.3,hal:.35,bloom:.15,vig:.22,ca:.15,dust:.1}},
 {id:'cine800',flick:0.2,name:'Cine 800T',tag:'Tungsten',group:'FILM',ar:1.5,sw:['#2b5d7a','#e2533a','#f0c9a0'],
  p:{temp:-.22,tint:.04,con:1.1,sat:1.05,shT:[-.02,.01,.04],hiT:[.03,0,-.01],grain:.24,gsize:1.5,hal:.9,bloom:.25,vig:.25,ca:.2}},
 {id:'slide100',name:'Slide 100',tag:'Slide',group:'FILM',ar:1.5,sw:['#d6304a','#1f6fb5','#2f9a4b'],
  p:{con:1.25,sat:1.35,temp:.03,tint:.05,grain:.07,gsize:1,vig:.3,hal:.1,shT:[0,0,.02]}},
 {id:'medium120',name:'Medium 120',tag:'120',group:'FILM',ar:1.2,sw:['#e9d3bd','#b7c4a6','#8a9bb0'],
  p:{con:.96,sat:.92,fade:.06,temp:.06,hiT:[.02,.01,0],shT:[0,.012,.015],grain:.08,gsize:.9,bloom:.2,vig:.14}},
 {id:'half72',name:'Half 72',tag:'Half-frame',group:'FILM',ar:1.5,dip:true,sw:['#d99a4e','#141210','#d99a4e'],
  p:{temp:.1,con:1.1,sat:1.1,grain:.26,gsize:1.7,hal:.3,vig:.25,leak:.25,dust:.25}},
 {id:'onetime',name:'One-Time 27',tag:'Disposable',group:'FILM',ar:1.5,flash:true,date:DSEG,sw:['#7fae5c','#f0d77a','#2c3b2a'],
  p:{gain:[.98,1.03,.95],con:1.15,sat:1.08,fade:.05,shT:[0,.03,.01],grain:.3,gsize:1.6,vig:.4,ca:.35,hal:.3,leak:.15,dust:.2}},
 {id:'plastic',flick:0.3,name:'Plastic',tag:'Toy camera',group:'FILM',ar:1,sw:['#e9d24a','#2f7fd0','#d0402f'],
  p:{sat:1.4,con:1.3,vig:.75,ca:.6,gain:[1.05,1.05,.85],lift:[0,0,.08],shT:[0,0,.06],hiT:[.05,.05,-.05],grain:.2,leak:.45,fish:.25,bloom:.2}},
 {id:'instant',name:'Instant SQ',tag:'Instant',group:'FILM',ar:1,frame:'instant',sw:['#cfe0d8','#e8cfa8','#7d8f9a'],
  p:{fade:.12,con:.92,sat:.85,temp:.05,shT:[0,.03,.04],hiT:[.04,.03,-.01],grain:.1,bloom:.3,vig:.3}},
 {id:'mono400',flick:0.2,name:'Mono 400',tag:'B&W',group:'FILM',ar:1.5,sw:['#f0f0ee','#8a8a88','#141414'],
  p:{mono:1,con:1.25,grain:.34,gsize:1.6,vig:.3,bloom:.15,fade:.03}},
 {id:'panox',name:'Pano X',tag:'Wide 65:24',group:'FILM',ar:2.7,land:true,sw:['#3f6f8f','#e7c98f','#20303a'],
  p:{con:1.1,sat:1.05,temp:-.03,shT:[0,.01,.03],hiT:[.03,.02,0],grain:.14,hal:.4,vig:.35}},

 {id:'fj_provia',name:'Provia',tag:'Film sim',group:'FUJI',ar:1.5,sw:['#3f78c2','#e9e4d8','#4f9a56'],
  p:{con:1.06,sat:1.08,grain:.06,gsize:1,vig:.08}},
 {id:'fj_velvia',name:'Velvia',tag:'Film sim',group:'FUJI',ar:1.5,sw:['#d4213f','#1763c4','#1f9d4a'],
  p:{con:1.22,sat:1.42,tint:.05,shT:[0,0,.015],mat:[1.06,-.04,-.02,-.03,1.06,-.03,-.02,-.05,1.07],grain:.05,gsize:1,vig:.14}},
 {id:'fj_astia',name:'Astia',tag:'Film sim',group:'FUJI',ar:1.5,sw:['#f0c9b8','#9ec3dd','#b9d6a6'],
  p:{con:.97,sat:1.08,tint:.02,fade:.03,hiT:[.015,.005,0],grain:.06,gsize:1,bloom:.08,vig:.06}},
 {id:'fj_cchrome',name:'Classic Chrome',tag:'Film sim',group:'FUJI',ar:1.5,sw:['#6f8f9a','#c9b79a','#5b5a50'],
  p:{con:1.12,sat:.8,temp:.04,shT:[.008,.004,-.004],mat:[.95,.05,0,.04,.92,.04,0,.18,.82],grain:.12,gsize:1.1,vig:.12}},
 {id:'fj_cneg',name:'Classic Neg',tag:'Film sim',group:'FUJI',ar:1.5,sw:['#c8463c','#5f9a8e','#e6dcc6'],
  p:{con:1.22,sat:.9,fade:.02,shT:[-.015,.015,.02],hiT:[.02,0,-.02],mat:[1.06,-.06,0,.05,.9,.05,0,.14,.86],grain:.18,gsize:1.2,vig:.16,hal:.12}},
 {id:'fj_nneg',name:'Nostalgic Neg',tag:'Film sim',group:'FUJI',ar:1.5,sw:['#e2a04a','#b5522e','#3f5f6a'],
  p:{con:1.02,sat:1.08,temp:.14,shT:[0,.005,.015],hiT:[.05,.025,-.03],mat:[.96,.04,0,.05,.95,0,0,.06,.94],grain:.14,gsize:1.2,bloom:.1,vig:.12}},
 {id:'fj_proneg',name:'Pro Neg',tag:'Film sim',group:'FUJI',ar:1.5,sw:['#e6c2ae','#bfc9c4','#7f8f9c'],
  p:{con:1.0,sat:.92,tint:.03,hiT:[.01,0,0],grain:.07,gsize:1,vig:.06}},
 {id:'fj_reala',name:'Reala Ace',tag:'Film sim',group:'FUJI',ar:1.5,sw:['#4c86c9','#e7e2d5','#c9584a'],
  p:{con:1.1,sat:1.0,temp:-.02,grain:.08,gsize:1,vig:.08}},
 {id:'fj_eterna',name:'Eterna',tag:'Cinema sim',group:'FUJI',ar:16/9,sw:['#7f9a94','#c9b8a0','#3a4a4c'],
  p:{con:.86,sat:.78,fade:.05,shT:[0,.01,.015],hiT:[.01,.005,0],grain:.1,gsize:1.1,vig:.14}},
 {id:'fj_bleach',name:'Bleach Bypass',tag:'Cinema sim',group:'FUJI',ar:16/9,sw:['#9aa3a3','#5a6468','#1f2426'],
  p:{con:1.35,sat:.5,shT:[0,.005,.01],grain:.16,gsize:1.2,vig:.2}},
 {id:'fj_acros',name:'Acros',tag:'B&W sim',group:'FUJI',ar:1.5,sw:['#f4f4f2','#9a9a98','#101010'],
  p:{mono:1,con:1.18,grain:.22,gsize:1,vig:.14}},
 {id:'fj_k64',name:'Kodachrome 64',tag:'Recipe',group:'FUJI',ar:1.5,sw:['#c8322e','#2f6fb0','#e3c27a'],
  p:{con:1.2,sat:.95,temp:.1,tint:.03,shT:[.006,0,-.006],hiT:[.02,.012,-.01],mat:[1.0,.02,-.02,.03,.93,.04,0,.14,.86],grain:.14,gsize:1.1,vig:.16}},
 {id:'fj_p400',name:'Portra 400',tag:'Recipe',group:'FUJI',ar:1.5,sw:['#f0c49a','#d9a77e','#8fa58c'],
  p:{con:.98,sat:.9,temp:.2,tint:.02,fade:.05,exp:.1,shT:[.01,.012,0],hiT:[.03,.02,-.01],mat:[.96,.04,0,.05,.92,.03,0,.14,.86],grain:.2,gsize:1.3,bloom:.12,vig:.1}},
 {id:'fj_pacific',name:'Pacific Blues',tag:'Recipe',group:'FUJI',ar:1.5,sw:['#2f7fa8','#8fc4cf','#e8dcc2'],
  p:{con:1.2,sat:.92,temp:-.14,fade:.02,exp:.08,shT:[-.015,.012,.03],hiT:[.015,.005,-.01],mat:[1.05,-.05,0,.04,.9,.06,0,.12,.88],grain:.2,gsize:1.2,vig:.16}},

 {id:'ccd2000',name:'CCD 2000',tag:'2MP digicam',group:'DIGITAL',ar:4/3,res:1600,flash:true,date:DSEG,sw:['#7fb6e8','#f4f1ea','#e86a9a'],
  p:{con:1.12,sat:1.18,temp:-.1,gain:[1,1.02,1.08],exp:.15,chroma:.18,grain:.05,sharp:.7,bloom:.3,ca:.25,vig:.12}},
 {id:'digi5',name:'Digi 5M',tag:'5MP digicam',group:'DIGITAL',ar:4/3,res:2560,date:DSEG,sw:['#f2c1a8','#e7dccb','#8fb7c9'],
  p:{temp:.08,tint:.06,con:1.05,sat:1.1,gamma:[1.04,1,1],bloom:.35,sharp:.4,chroma:.08,vig:.1}},
 {id:'nightshot',name:'Night Shot',tag:'Infrared',group:'DIGITAL',ar:4/3,res:1600,date:{on:true,style:'vhs',color:'white'},sw:['#b9ffb0','#3fa04a','#0c1f0e'],
  p:{mono:1,monoTint:[.5,1.05,.55],exp:.35,con:1.1,grain:.3,gsize:1.4,scan:.5,vig:.5,bloom:.3}},

 {id:'vhs89',name:'VHS 89',tag:'Camcorder',group:'TAPE & CINE',ar:4/3,res:1280,date:{on:true,style:'vhs',color:'white'},sw:['#c94f6d','#5b74c9','#e9e4d4'],
  p:{vhs:1,scan:.5,sat:.85,con:.95,fade:.08,split:.0035,bloom:.25,chroma:.2,temp:.03}},
 {id:'super8',flick:0.9,name:'Super 8',tag:'Cine film',group:'TAPE & CINE',ar:4/3,frame:'gate',sw:['#e8a23e','#a8552a','#2b1a10'],
  p:{temp:.2,con:1.12,sat:1.15,fade:.08,grain:.42,gsize:2.2,vig:.6,hal:.5,leak:.35,dust:.5}},
 {id:'stereo',name:'Stereo 3D',tag:'3D film',group:'TAPE & CINE',ar:4/3,sw:['#ff3b3b','#e9e9e9','#2ad4ff'],
  p:{split:.012,con:1.1,sat:1.1,grain:.15,vig:.2}},

 {id:'y2k',name:'Y2K Flash',tag:'Drop 01',group:'DROPS',ar:4/3,res:2048,flash:true,date:DSEG,sw:['#ff8fd0','#f5f0ff','#7fd4ff'],
  p:{sat:1.25,con:1.2,exp:.1,tint:.08,bloom:.4,chroma:.12,sharp:.5,vig:.2}},
 {id:'tokyo',name:'Tokyo Nights',tag:'Drop 02',group:'DROPS',ar:1.5,sw:['#ff3fa4','#2b3fd6','#19e0d0'],
  p:{temp:-.15,tint:.12,shT:[0,.02,.08],hiT:[.08,0,.04],con:1.15,sat:1.2,hal:.7,bloom:.4,grain:.2,vig:.35,ca:.3}},
 {id:'paris',name:'Paris Film',tag:'Drop 03',group:'DROPS',ar:1.5,sw:['#e8dccb','#c9a48a','#8f9aa3'],
  p:{fade:.1,con:.95,sat:.8,temp:.1,hiT:[.04,.03,0],shT:[.02,.01,.02],grain:.22,bloom:.3,vig:.2}},
 {id:'sleaze',name:'Indie Sleaze',tag:'Drop 04',group:'DROPS',ar:1.5,flash:true,sw:['#f2f2f2','#1a1a1a','#b3261e'],
  p:{con:1.35,sat:.9,exp:.1,fade:.02,grain:.3,vig:.55,ca:.4,shT:[0,.01,.02]}},
 {id:'bolly',name:'90s Bollywood',tag:'Drop 05',group:'DROPS',ar:1.5,sw:['#ff5a36','#ffc531','#d6248f'],
  p:{sat:1.5,con:1.15,temp:.15,tint:.05,bloom:.55,hal:.4,gain:[1.06,1,.95],grain:.18,vig:.25,hiT:[.05,.02,0]}},
 {id:'summer99',name:"Summer '99",tag:'Drop 06',group:'DROPS',ar:1.5,date:DSEG,sw:['#ffd166','#ff9f5a','#6fc3df'],
  p:{temp:.22,exp:.12,fade:.09,sat:1.1,leak:.5,grain:.2,hal:.3,hiT:[.05,.04,-.02]}},
 {id:'grunge',name:'Soft Grunge',tag:'Drop 07',group:'DROPS',ar:1.5,sw:['#8f9a8a','#5d6470','#2a2c2e'],
  p:{sat:.6,con:1.05,fade:.14,shT:[0,.02,.03],temp:-.05,grain:.35,gsize:1.8,vig:.5,dust:.4}},
 {id:'cyber',name:'Cyberpunk Night',tag:'Drop 08',group:'DROPS',ar:16/9,sw:['#00e5ff','#ff2bd6','#1a0b3a'],
  p:{split:.004,shT:[.03,0,.1],hiT:[0,.08,.1],con:1.3,sat:1.35,temp:-.2,tint:.15,bloom:.5,hal:.3,scan:.2,vig:.4,ca:.5}}
];
const LOOK={}; LOOKS.forEach(l=>LOOK[l.id]=l);
const LAB=[
 ['exp','Exposure',-1.5,1.5,.05,v=>(v>0?'+':'')+v.toFixed(1)],
 ['temp','Temperature',-1,1,.02,v=>(v>0?'+':'')+Math.round(v*100)],
 ['tint','Tint',-1,1,.02,v=>(v>0?'+':'')+Math.round(v*100)],
 ['con','Contrast',.6,1.6,.01,v=>Math.round(v*100)],
 ['sat','Saturation',0,2,.01,v=>Math.round(v*100)],
 ['grain','Grain',0,1,.01,v=>Math.round(v*100)],
 ['gsize','Grain size',.6,3,.05,v=>v.toFixed(1)],
 ['dust','Dust & scratches',0,1,.01,v=>Math.round(v*100)],
 ['leak','Light leak',0,1,.01,v=>Math.round(v*100)],
 ['hal','Halation',0,1.5,.01,v=>Math.round(v*100)],
 ['bloom','Bloom',0,1,.01,v=>Math.round(v*100)],
 ['fade','Fade',0,.4,.01,v=>Math.round(v*100)],
 ['vig','Vignette',0,1,.01,v=>Math.round(v*100)],
 ['ca','Aberration',0,1,.01,v=>Math.round(v*100)]
];
const LENS=[['fish','Fisheye',0,2.5,.05],['prism','Prism',0,1,.01],['star','Starburst',0,1,.01],['split','RGB split',0,.03,.0005]];
const FLASHES=[['white','White','#ffffff'],['amber','Amber','#ffa53a'],['red','Red','#ff3a2c'],['pink','Pink','#ff5fb4'],['violet','Violet','#9d62ff'],['blue','Blue','#3f80ff'],['green','Green','#4dff73']];
const CHALLENGES=['Shoot with flash in full daylight.','One colour only. Fill the frame with it.','Capture something older than you.','A stranger\'s hands.','Find a reflection and shoot into it.','Three photos from knee height.','Something lit only by a screen or a sign.','A double exposure of a face and a texture.','Shoot the same corner at two different times.','Only shadows today.','A photo with nothing in the centre.','Make a half-frame pair that tells a tiny story.','Your street in black and white.','The last light of the day.'];
const BOOTH_AR=1.25;

/* ---------- state ---------- */
const S={mode:'photo',lookId:'ccd2000',p:{},lens:{fish:0,prism:0,star:0,split:0,kal:0,dbl:false},flash:{on:false,col:'white'},
  date:{on:false,style:'seg',color:'amber',fmt:0,custom:'',pos:'br'},frame:'none',zoom:1,timer:0,grid:false,sound:true,keep:true,
  rollSize:0,roll:null,booth:{n:4,layout:'strip',paper:'white',story:false},facing:'environment',recipes:[],count:0,vsound:false};
const look=()=>LOOK[S.lookId]||LOOKS[0];
function lookDefaults(l){const o={};LAB.forEach(a=>{o[a[0]]=l.p[a[0]]!=null?l.p[a[0]]:GC_DEF[a[0]];});return o;}
function num(v,a,b,d){v=Number(v);return isFinite(v)?clamp(v,a,b):d;}
function cleanRecipe(r){
  r=r&&typeof r==='object'?r:{};
  const l=LOOK[r.look]?r.look:'ccd2000', d=lookDefaults(LOOK[l]), p={};
  LAB.forEach(a=>{p[a[0]]=num(r.p&&r.p[a[0]],a[2],a[3],d[a[0]]);});
  const ln=r.lens||{}, lens={dbl:!!ln.dbl,kal:[0,3,4,6,8].indexOf(+ln.kal)>=0?+ln.kal:0};
  LENS.forEach(a=>{lens[a[0]]=num(ln[a[0]],a[2],a[3],0);});
  const f=r.flash||{}, dt=r.date||{};
  return {look:l,p,lens,flash:{on:!!f.on,col:GC_FLASH[f.col]?f.col:'white'},
    date:{on:!!dt.on,style:dt.style==='vhs'?'vhs':'seg',color:GC_STAMP[dt.color]?dt.color:'amber',fmt:num(dt.fmt,0,4,0)|0,custom:/^\d{4}-\d{2}-\d{2}$/.test(dt.custom||'')?dt.custom:'',pos:dt.pos==='bl'?'bl':'br'},
    frame:E&&E.FRAMES[r.frame]?r.frame:'none',zoom:num(r.zoom,1,5,1),seed:num(r.seed,0,1,rnd()),lseed:typeof r.lseed==='number'?num(r.lseed,0,1,0):undefined};
}
function snap(seed){return {look:S.lookId,p:Object.assign({},S.p),lens:Object.assign({},S.lens),flash:Object.assign({},S.flash),date:Object.assign({},S.date),frame:S.frame,zoom:S.zoom,seed:seed==null?rnd():seed};}
function resolve(r){const l=LOOK[r.look]||LOOKS[0];return {look:l,p:Object.assign({},GC_DEF,l.p,r.p),lens:r.lens,flash:r.flash,date:r.date,frame:r.frame,zoom:r.zoom,seed:r.seed,lseed:r.lseed};}
function applyRecipe(r){r=cleanRecipe(r);S.lookId=r.look;S.p=r.p;S.lens=r.lens;S.flash=r.flash;S.date=r.date;S.frame=r.frame;S.zoom=r.zoom;}
function setLook(id){
  const l=LOOK[id]; if(!l) return;
  S.lookId=id; S.p=lookDefaults(l); tapEV=0; liveLeak=rnd(); S.flash.on=!!l.flash; S.frame=l.frame||'none';
  S.date.on=!!(l.date&&l.date.on); if(l.date){S.date.style=l.date.style;S.date.color=l.date.color;}
}
function saveSettings(){
  try{localStorage.setItem('grainclub.v1',JSON.stringify({rcp:snap(0),vsound:S.vsound,mode:S.mode,timer:S.timer,grid:S.grid,sound:S.sound,keep:S.keep,rollSize:S.rollSize,roll:S.roll,booth:S.booth,facing:S.facing,recipes:S.recipes,count:S.count}));}catch(e){}
}
function loadSettings(){
  let d=null; try{d=JSON.parse(localStorage.getItem('grainclub.v1')||'null');}catch(e){}
  if(!d||typeof d!=='object'){setLook('ccd2000');return;}
  applyRecipe(d.rcp); S.zoom=1;   // like a phone camera, zoom starts at 1x on every launch
  S.mode=['photo','video','booth'].indexOf(d.mode)>=0?d.mode:'photo'; S.vsound=!!d.vsound; S.timer=[0,3,10].indexOf(d.timer)>=0?d.timer:0; S.grid=!!d.grid; S.sound=d.sound!==false; S.keep=d.keep!==false;
  S.rollSize=[0,12,24,36].indexOf(d.rollSize)>=0?d.rollSize:0;
  if(S.rollSize&&d.roll&&typeof d.roll.id==='string') S.roll={id:d.roll.id,size:S.rollSize,count:num(d.roll.count,0,36,0)|0};
  const b=d.booth||{}; S.booth={n:[2,4,6].indexOf(b.n)>=0?b.n:4,layout:b.layout==='grid'?'grid':'strip',paper:['white','cream','black'].indexOf(b.paper)>=0?b.paper:'white',story:!!b.story};
  S.facing=d.facing==='user'?'user':'environment'; S.count=num(d.count,0,1e6,0)|0;
  if(Array.isArray(d.recipes)) S.recipes=d.recipes.slice(0,24).filter(x=>x&&typeof x.name==='string').map(x=>({name:x.name.slice(0,24),rcp:cleanRecipe(x.rcp)}));
}

/* ---------- storage: photos stay in this browser ---------- */
const DB=(function(){
  let db=null; const mem={meta:new Map(),blobs:new Map()}; const api={volatile:false};
  const req=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
  const done=t=>new Promise((res,rej)=>{t.oncomplete=()=>res();t.onerror=t.onabort=()=>rej(t.error);});
  api.open=()=>new Promise(res=>{
    try{
      const rq=indexedDB.open('grainclub',1);
      rq.onupgradeneeded=()=>{const d=rq.result;if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'id'});if(!d.objectStoreNames.contains('blobs'))d.createObjectStore('blobs',{keyPath:'id'});};
      rq.onsuccess=()=>{db=rq.result;res(true);}; rq.onerror=()=>{api.volatile=true;res(false);}; rq.onblocked=()=>{api.volatile=true;res(false);};
    }catch(e){api.volatile=true;res(false);}
  });
  api.all=async()=>{let out=[];if(db){try{out=await req(db.transaction('meta').objectStore('meta').getAll());}catch(e){}}return out.concat([...mem.meta.values()]);};
  api.put=async(meta,blobs)=>{
    if(db&&!mem.meta.has(meta.id)){
      try{const t=db.transaction(['meta','blobs'],'readwrite');t.objectStore('meta').put(meta);if(blobs)t.objectStore('blobs').put(blobs);await done(t);return true;}catch(e){}
    }
    api.volatile=true; mem.meta.set(meta.id,meta); if(blobs)mem.blobs.set(meta.id,blobs); return false;
  };
  api.blobs=async id=>{if(mem.blobs.has(id))return mem.blobs.get(id);if(!db)return null;try{return await req(db.transaction('blobs').objectStore('blobs').get(id));}catch(e){return null;}};
  api.del=async id=>{mem.meta.delete(id);mem.blobs.delete(id);if(db){try{const t=db.transaction(['meta','blobs'],'readwrite');t.objectStore('meta').delete(id);t.objectStore('blobs').delete(id);await done(t);}catch(e){}}};
  return api;
})();
let shots=[];

/* ---------- elements ---------- */
const view=$('#view'), screen=$('#screen'), stage=$('#stage'), video=$('#liveVideo');
const fileCam=$('#fileCam'), fileLib=$('#fileLib');

/* ---------- sources ---------- */
const mkCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function makeItem(src,w,h,mirror){
  const max=E.MAXL, k=Math.min(1,max/Math.max(w,h));
  const full=mkCanvas(Math.max(1,Math.round(w*k)),Math.max(1,Math.round(h*k)));
  const x=full.getContext('2d');
  if(mirror){x.translate(full.width,0);x.scale(-1,1);}
  x.drawImage(src,0,0,full.width,full.height);
  const k2=Math.min(1,1280/Math.max(full.width,full.height));
  let prev=full;
  if(k2<1){prev=mkCanvas(Math.round(full.width*k2),Math.round(full.height*k2));prev.getContext('2d').drawImage(full,0,0,prev.width,prev.height);}
  return {full,prev};
}
async function loadFile(file){
  let img=null,url=null;
  try{
    url=URL.createObjectURL(file);
    img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('decode'));im.src=url;});
  }catch(e){img=null;}
  try{
    if(!img&&window.createImageBitmap) img=await createImageBitmap(file);
    if(!img) throw new Error('decode');
    return makeItem(img,img.naturalWidth||img.width,img.naturalHeight||img.height,false);
  } finally { if(url) URL.revokeObjectURL(url); }
}
const T=(item,q)=>({el:item[q],w:item[q].width,h:item[q].height});
const sampleItem=E?makeItem(E.sampleScene(),600,800,false):null;
if(E&&E.SAMPLE_SRC){const im=new Image();im.onload=()=>{const it=makeItem(im,im.naturalWidth,im.naturalHeight,false);sampleItem.full=it.full;sampleItem.prev=it.prev;requestDraw();};im.src=E.SAMPLE_SRC;}
const sampleSrc=()=>({kind:'sample',a:sampleItem,b:null,seed:0.37,saved:true});
let SRC=sampleSrc();
let pair=null;            // first shot held for a double exposure or a half-frame pair
let booth=[];             // shots collected for the current photobooth strip
const live={on:false,stream:null};
let busyN=0, dirty=true, sheetName=null;
let tapEV=0, lastR=null, levelOn=false, gotOri=false;
let booting=true, camOK=false, wantLive=true, starting=null;
let liveLeak=Math.random(), rec=null;   // steady light-leak placement while live; the recording in progress   // camera start-up: open straight into the viewfinder   // tap-to-meter offset, last render layout, level state

/* ---------- drawing ---------- */
function prevLong(){const r=screen.getBoundingClientRect();return clamp(Math.round(Math.max(r.width,r.height)*Math.min(2,window.devicePixelRatio||1)),320,1280);}
let fitKey='';
function fit(){
  const r=screen.getBoundingClientRect(); if(!r.width||!r.height) return;
  const key=view.width+'x'+view.height+'@'+Math.round(r.width)+'x'+Math.round(r.height); if(key===fitKey) return; fitKey=key;
  const k=Math.min(r.width/view.width,r.height/view.height);
  view.style.width=Math.max(1,Math.floor(view.width*k))+'px'; view.style.height=Math.max(1,Math.floor(view.height*k))+'px';
}
function liveReady(){return live.on&&video.readyState>=2&&video.videoWidth>0;}
function draw(){
  dirty=false; if(!E) return;
  if(SRC.kind==='result'){
    const c=SRC.canvas, k=Math.min(1,prevLong()/Math.max(c.width,c.height));
    view.width=Math.round(c.width*k); view.height=Math.round(c.height*k);
    view.getContext('2d').drawImage(c,0,0,view.width,view.height); fit(); return;
  }
  let A,B=null,seed; const useLive=liveReady()&&SRC.kind==='sample';
  if(useLive){A={el:video,w:video.videoWidth,h:video.videoHeight,mirror:S.facing==='user',video:true};if(pair)B=T(pair,'prev');seed=rnd();}
  else{
    if(SRC.kind==='sample'&&(booting||camOK||live.on)){
      if(view.width!==600||view.height!==800){view.width=600;view.height=800;}
      const x=view.getContext('2d');x.fillStyle='#101113';x.fillRect(0,0,600,800);lastR=null;fit();return;
    }
    A=T(SRC.a,'prev');if(SRC.b)B=T(SRC.b,'prev');seed=SRC.seed;
  }
  const r=resolve(useLive?liveSnap(seed):snap(seed)); let force=null;
  if(S.mode==='booth'){force={ar:BOOTH_AR,land:true};r.frame='none';r.date=Object.assign({},r.date,{on:false});}
  if(useLive&&S.mode==='video'&&r.look.flick) r.p.exp+=(rnd()-0.5)*0.16*r.look.flick;   // projector flicker on cine looks
  try{lastR=E.render(view,A,B,r,{long:useLive?Math.min(prevLong(),960):prevLong(),ts:Date.now(),n:S.count+1,force});}catch(e){console.error(e);}
  fit();
}
function requestDraw(){dirty=true;}
function loop(){if(dirty||(liveReady()&&SRC.kind==='sample')) draw(); requestAnimationFrame(loop);}

/* ---------- messages ---------- */
let msgTimer=0, msgText='';
function hint(){
  if(busyN) return 'Developing\u2026';
  return '';
}
function setMsg(t){const n=$('#osdMsg');n.textContent=t;n.hidden=!t;}
function msg(t,ms){msgText=t;clearTimeout(msgTimer);setMsg(t);msgTimer=setTimeout(()=>{msgText='';setMsg(hint());},ms||2600);}
let toastTimer=0;
function toast(t,ms){const n=$('#toast');n.textContent=t;n.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{n.hidden=true;},ms||3200);}
function say(t,ms){if(!$('#gal').hidden||!$('#det').hidden)toast(t,ms);else msg(t,ms);}

/* ---------- UI refresh ---------- */
function labTweaked(){const d=lookDefaults(look());return LAB.some(a=>Math.abs(S.p[a[0]]-d[a[0]])>1e-6);}
const GROUPS={'FILM':'Film','FUJI':'Fuji','DIGITAL':'Digital','TAPE & CINE':'Tape and cine','DROPS':'Drops'};
function ctxText(){
  if(SRC.kind==='result') return 'Strip saved';
  if(SRC.kind==='photo') return SRC.saved?'Saved photo':'Photo, not saved';
  if(rec){const t=Math.floor((Date.now()-rec.t0)/1000);return 'Recording '+Math.floor(t/60)+':'+p2(t%60);}
  if(S.mode==='booth') return 'Photobooth '+booth.length+' of '+S.booth.n;
  if(pair) return 'Shot 1 of 2 taken';
  if(SRC.kind==='sample'&&!live.on){
    if(booting) return 'Starting the camera. Allow access if asked.';
    if(camOK) return 'Camera off. Press the shutter to start it.';
    return 'Sample scene';
  }
  if(S.roll) return 'Roll '+p2(S.roll.count)+' of '+S.roll.size;
  return '';
}
const press=(id,on)=>{const b=$(id);b.classList.toggle('on',!!on);b.setAttribute('aria-pressed',on?'true':'false');};
function ui(){
  $('#osdSrc').textContent=ctxText();
  $('#zoomc').hidden=SRC.kind==='result';
  {const zs=[...document.querySelectorAll('#zoomc button')]; let cur=zs[0];
   zs.forEach(b=>{if(+b.dataset.z<=S.zoom+1e-6)cur=b;});
   zs.forEach(b=>{const on=b===cur,z=+b.dataset.z;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');
     b.textContent=on?(Math.abs(S.zoom-z)<0.05?String(z):S.zoom.toFixed(1))+'\u00D7':String(z);});}
  if(!msgText) setMsg(hint());
  $('#saveLook').hidden=!(SRC.kind==='photo'&&!SRC.saved&&S.mode==='photo'&&!busyN);
  $('#closePhoto').hidden=!(SRC.kind!=='sample'||pair||booth.length);
  $('#gridl').hidden=!S.grid; $('#lvl').hidden=!levelOn;
  press('#flashBtn',S.flash.on); press('#gridBtn',S.grid); press('#levelBtn',levelOn);
  press('#adjBtn',!!sheetName&&sheetName!=='more'); press('#moreBtn',sheetName==='more');
  const ae=$('#aeBtn'); ae.hidden=!(tapEV&&live.on&&SRC.kind==='sample'&&!pair&&!booth.length); ae.textContent='Exposure '+(tapEV>0?'+':'')+tapEV.toFixed(1)+' \u00D7';
  const sh=$('#shutter'); sh.classList.toggle('busy',busyN>0); sh.classList.toggle('video',S.mode==='video'); sh.classList.toggle('rec',!!rec);
  sh.setAttribute('aria-label',S.mode==='video'?(rec?'Stop recording':'Start recording'):'Take photo');
  $('#osdSrc').classList.toggle('rec',!!rec);
  press('#mPhoto',S.mode==='photo'); press('#mVideo',S.mode==='video'); press('#mBooth',S.mode==='booth');
  document.querySelectorAll('.cam').forEach(b=>{const on=b.dataset.id===S.lookId&&!b.dataset.rcp;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});
  const last=shots.find(s=>!s.hidden); $('#rollBtn').style.backgroundImage=last?'url('+last.thumb+')':'';
}
function centerCam(smooth){const on=document.querySelector('.cam.on');if(on&&on.scrollIntoView)on.scrollIntoView({inline:'center',block:'nearest',behavior:smooth?'smooth':'auto'});}
function changed(keep){ if(!keep&&SRC.kind==='photo') SRC.saved=false; saveSettings(); ui(); requestDraw(); }
function busy(on){busyN=Math.max(0,busyN+(on?1:-1));ui();}

/* ---------- camera strip ---------- */
function buildCams(){
  const box=$('#cams'); box.textContent=''; let g='';
  const glab=t=>el('span',{class:'glab',text:t,'aria-hidden':'true'});
  if(S.recipes.length){
    box.append(glab('Mine'));
    S.recipes.forEach(rc=>{const l=LOOK[rc.rcp.look]||LOOKS[0];
      box.append(el('button',{type:'button',class:'cam','data-id':l.id,'data-rcp':'1','aria-pressed':'false',text:rc.name,onclick:()=>{applyRecipe(Object.assign({},rc.rcp,{seed:rnd()}));changed();msg(rc.name+', your recipe on '+l.name,2200);}}));});
  }
  LOOKS.forEach(l=>{
    if(l.group!==g){g=l.group;box.append(glab(GROUPS[g]||g));}
    box.append(el('button',{type:'button',class:'cam','data-id':l.id,'aria-pressed':'false',text:l.name,onclick:()=>{setLook(l.id);changed();centerCam(true);msg(l.name+', '+l.tag,1600);}}));
  });
}

/* ---------- developing and saving ---------- */
const toBlob=(c,q)=>new Promise(res=>{try{c.toBlob(b=>res(b),'image/jpeg',q||0.92);}catch(e){res(null);}});
function thumbOf(c){const k=Math.min(1,300/Math.max(c.width,c.height)),t=mkCanvas(Math.max(1,Math.round(c.width*k)),Math.max(1,Math.round(c.height*k)));t.getContext('2d').drawImage(c,0,0,t.width,t.height);return t.toDataURL('image/jpeg',0.72);}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const newRoll=()=>({id:'r'+uid(),size:S.rollSize,count:0});
async function store(a,b,rcp,useRoll){
  const ts=Date.now(), out=mkCanvas(8,8);
  E.render(out,T(a,'full'),b?T(b,'full'):null,resolve(rcp),{ts,n:S.count+1});
  const blob=await toBlob(out); if(!blob) throw new Error('encode');
  const inRoll=!!(useRoll&&S.roll);
  const meta={id:uid(),ts,look:rcp.look,name:(LOOK[rcp.look]||LOOKS[0]).name,rcp,thumb:thumbOf(out),fav:false,w:out.width,h:out.height,kind:'photo',roll:inRoll?S.roll.id:null,hidden:inRoll,orig:false};
  const blobs={id:meta.id,out:blob};
  if(S.keep){blobs.a=await toBlob(a.full,0.9); if(b) blobs.b=await toBlob(b.full,0.9); meta.orig=!!blobs.a;}
  await DB.put(meta,blobs); shots.unshift(meta); S.count++;
  let info={meta,frame:0,size:0,finished:false};
  if(inRoll){S.roll.count++;info.frame=S.roll.count;info.size=S.roll.size;if(S.roll.count>=S.roll.size){info.finished=true;S.roll=S.rollSize?newRoll():null;}}
  saveSettings(); return info;
}
function rollSay(info){
  if(info.finished) msg('Roll finished. Develop it in your roll.',5000);
  else msg('Frame '+info.frame+' of '+info.size+' exposed');
}
async function finishOne(a,b,via){
  const seed=rnd();
  if(via==='import'){SRC={kind:'photo',a,b,seed,saved:false};msg('Pick a camera, then save this look.',4200);return;}
  const info=await store(a,b,liveSnap(seed),true);
  if(info.meta.hidden){if(!live.on)SRC=sampleSrc();rollSay(info);}
  else{if(!live.on)SRC={kind:'photo',a,b,seed,saved:true};msg('Saved to your roll');}
}
async function incoming(items,via){
  if(!items.length) return;
  busy(true);
  try{
    if(S.mode==='booth'){
      for(const it of items) if(booth.length<S.booth.n) booth.push(it);
      if(booth.length>=S.booth.n) await boothFinish();
      else {SRC={kind:'held',a:booth[booth.length-1],b:null,seed:rnd(),saved:true};msg(booth.length+' of '+S.booth.n+' taken');}
      return;
    }
    if(look().dip||S.lens.dbl){
      const q=items.slice();
      if(!pair){pair=q.shift();if(!q.length){if(!live.on)SRC={kind:'held',a:pair,b:null,seed:rnd(),saved:true};msg('1 of 2 exposed. Take the second.',4200);return;}}
      const second=q.shift(), first=pair; pair=null;
      await finishOne(second,first,via); return;
    }
    if(items.length>1){
      let info=null,seed=0;
      for(const it of items){seed=rnd();info=await store(it,null,snap(seed),false);}
      SRC={kind:'photo',a:items[items.length-1],b:null,seed,saved:true};
      msg(items.length+' photos developed and saved',3600); return;
    }
    await finishOne(items[0],null,via);
  }catch(e){console.error(e);msg('That photo could not be developed. Try another.',4200);}
  finally{busy(false);requestDraw();}
}
let chain=Promise.resolve();   // photos are developed one batch at a time, in the order they arrive
function onFiles(input,via){
  const files=[...(input.files||[])].filter(f=>!f.type||f.type.indexOf('image/')===0).slice(0,12); input.value='';
  if(!files.length) return chain;
  busy(true);
  const job=async()=>{
    const items=[];
    try{for(const f of files){try{items.push(await loadFile(f));}catch(e){}}}finally{busy(false);}
    if(!items.length){msg('That file is not a photo this browser can open.',4200);return;}
    await incoming(items,via);
  };
  chain=chain.then(job,job); return chain;
}
async function saveLook(){
  if(SRC.kind!=='photo'||busyN) return;
  busy(true);
  try{await store(SRC.a,SRC.b,snap(SRC.seed),false);SRC.saved=true;click();msg('Saved to your roll');}
  catch(e){msg('Could not save this photo.',4000);}
  finally{busy(false);}
}

/* ---------- photobooth ---------- */
function boothCompose(items,rcp){
  const n=items.length, grid=S.booth.layout==='grid', paper={white:'#f4f1e8',cream:'#e8dcc0',black:'#0c0c0d'}[S.booth.paper], ink=S.booth.paper==='black'?'#e9e5da':'#23221e';
  const fw=grid?640:900, fh=Math.round(fw/BOOTH_AR), m=grid?40:46, gap=grid?22:26, foot=grid?120:140;
  const cols=grid?2:1, rows=Math.ceil(n/cols);
  const W=m*2+cols*fw+(cols-1)*gap, H=m+rows*fh+(rows-1)*gap+foot;
  const out=mkCanvas(W,H), x=out.getContext('2d'), tmp=mkCanvas(8,8);
  x.fillStyle=paper; x.fillRect(0,0,W,H);
  items.forEach((it,i)=>{
    const r=resolve(Object.assign({},rcp,{seed:rnd(),frame:'none',date:Object.assign({},rcp.date,{on:false})}));
    E.render(tmp,T(it,'full'),null,r,{long:fw,force:{ar:BOOTH_AR,land:true},bare:true});
    const px=m+(i%cols)*(fw+gap), py=m+Math.floor(i/cols)*(fh+gap);
    x.drawImage(tmp,px,py,fw,fh);
    x.strokeStyle='rgba(0,0,0,.25)'; x.lineWidth=2; x.strokeRect(px,py,fw,fh);
  });
  const d=new Date(), fy=H-foot/2;
  x.fillStyle=ink; x.textBaseline='middle'; x.textAlign='left';
  x.font='700 '+(grid?28:26)+'px -apple-system,"SF Pro Display","Helvetica Neue",Arial,sans-serif'; x.fillText('Grain Club',m,fy-14);
  x.font='500 '+(grid?22:20)+'px -apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif';
  x.fillText('Photobooth, '+(LOOK[rcp.look]||LOOKS[0]).name,m,fy+22);
  x.textAlign='right'; x.font=(grid?40:36)+'px "VT323","Courier New",monospace';
  x.fillText(p2(d.getDate())+'.'+p2(d.getMonth()+1)+'.'+d.getFullYear(),W-m,fy);
  if(!S.booth.story) return out;
  const st=mkCanvas(1080,1920), y=st.getContext('2d'), dark=S.booth.paper!=='black';
  const g=y.createRadialGradient(540,860,100,540,960,1200);
  if(dark){g.addColorStop(0,'#34312d');g.addColorStop(1,'#131211');}else{g.addColorStop(0,'#f1ece0');g.addColorStop(1,'#cfc8b8');}
  y.fillStyle=g; y.fillRect(0,0,1080,1920);
  const k=Math.min(840/W,1560/H);
  y.save(); y.translate(540,960); y.rotate(-0.045); y.shadowColor='rgba(0,0,0,.5)'; y.shadowBlur=50; y.shadowOffsetY=24;
  y.drawImage(out,-W*k/2,-H*k/2,W*k,H*k); y.restore();
  return st;
}
async function boothFinish(){
  const items=booth; booth=[]; const rcp=liveSnap(rnd());
  const out=boothCompose(items,rcp), blob=await toBlob(out); if(!blob) throw new Error('encode');
  const meta={id:uid(),ts:Date.now(),look:rcp.look,name:look().name+' booth',rcp,thumb:thumbOf(out),fav:false,w:out.width,h:out.height,kind:'booth',roll:null,hidden:false,orig:false};
  await DB.put(meta,{id:meta.id,out:blob}); shots.unshift(meta); S.count++; saveSettings();
  SRC={kind:'result',canvas:out}; msg('Strip saved to your roll',3600);
}

/* ---------- live viewfinder (works where the browser grants the camera) ---------- */
function startLive(quiet){
  if(live.on) return Promise.resolve(true);
  if(starting) return starting;                      // one request at a time, so the phone asks only once
  starting=doStartLive(quiet).then(ok=>{starting=null;return ok;},()=>{starting=null;return false;});
  return starting;
}
async function doStartLive(quiet){
  const fail=()=>{if(!quiet)msg('No live viewfinder here. The shutter opens your phone camera.',5200);return false;};
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) return fail();
  try{
    const st=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:S.facing,width:{ideal:1920},height:{ideal:1440}}});
    live.stream=st; video.srcObject=st; try{await video.play();}catch(e){}
    const tr=st.getVideoTracks()[0];
    if(tr) tr.addEventListener('ended',()=>{if(live.stream!==st)return;dropLive();if(wantLive&&document.visibilityState==='visible')startLive(true);});
    live.on=true; camOK=true; tapEV=0; if(SRC.kind==='held'&&S.mode!=='booth') SRC=sampleSrc();
    if(!quiet) msg('Tap the picture to set focus and exposure.',3600);
    ui(); requestDraw(); return true;
  }catch(e){ return fail(); }
}
function dropLive(){
  tapEV=0; $('#foc').hidden=true;
  if(live.stream) live.stream.getTracks().forEach(t=>t.stop());
  live.stream=null; live.on=false; video.srcObject=null; ui(); requestDraw();
}
function stopLive(){wantLive=false;dropLive();}
function grabLive(){return makeItem(video,video.videoWidth,video.videoHeight,S.facing==='user');}
function flashFx(){const f=$('#flashfx');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');}
let AC=null;
function click(){
  if(!S.sound) return;
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    const len=Math.floor(AC.sampleRate*0.1), bf=AC.createBuffer(1,len,AC.sampleRate), d=bf.getChannelData(0);
    for(let i=0;i<len;i++){const k=i/len;d[i]=(Math.random()*2-1)*Math.pow(1-k,3)*((k<0.12||(k>0.45&&k<0.6))?1:0.22);}
    const s=AC.createBufferSource(), f=AC.createBiquadFilter(), g=AC.createGain();
    s.buffer=bf; f.type='bandpass'; f.frequency.value=2600; f.Q.value=0.7; g.gain.value=0.5;
    s.connect(f); f.connect(g); g.connect(AC.destination); s.start();
  }catch(e){}
}
async function countdown(sec){
  const b=$('#big'); b.hidden=false;
  for(let i=sec;i>0;i--){b.textContent=i;await sleep(1000);if(!live.on)break;}
  b.hidden=true;
}
let running=false;
async function onShutter(){
  if(busyN||running||!E) return;
  if(SRC.kind==='result'){SRC=sampleSrc();ui();requestDraw();}
  if(liveReady()&&SRC.kind!=='sample'){pair=null;SRC=sampleSrc();ui();requestDraw();msg('Back to the viewfinder');return;}
  if(!liveReady()&&camOK&&!starting){wantLive=true;msg('Starting the camera\u2026',1500);startLive();return;}
  if(S.mode==='video'){if(rec)stopRec();else startRec();return;}
  if(!liveReady()){fileCam.setAttribute('capture',S.facing==='user'?'user':'environment');fileCam.click();return;}
  running=true;
  try{
    if(S.mode==='booth'){
      while(booth.length<S.booth.n&&live.on){
        await countdown(3); if(!liveReady()) break;
        const it=grabLive(); flashFx(); click(); booth.push(it); ui();
        if(booth.length<S.booth.n) await sleep(500);
      }
      if(booth.length>=S.booth.n){busy(true);try{await boothFinish();}finally{busy(false);}}
    } else {
      if(S.timer) await countdown(S.timer);
      if(liveReady()){const it=grabLive(); flashFx(); click(); await incoming([it],'live');}
    }
  }catch(e){console.error(e);msg('Something went wrong with that shot.',4000);}
  finally{running=false;ui();requestDraw();}
}

/* ---------- tap to focus and meter, level ---------- */
function liveSnap(seed){const r=snap(seed);if(live.on){r.lseed=liveLeak;if(tapEV)r.p.exp=clamp(r.p.exp+tapEV,-2.5,2.5);}return r;}

/* ---------- video: records the filtered viewfinder exactly as shown ---------- */
function pickMime(){
  const c=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
  for(const m of c){try{if(MediaRecorder.isTypeSupported(m))return m;}catch(e){}}
  return '';
}
async function startRec(){
  if(rec||busyN) return;
  if(!liveReady()||SRC.kind!=='sample'){msg(camOK?'Starting the camera. Press record again in a moment.':'Video needs the live camera, which is not available here.',3600);if(camOK&&!live.on&&!starting){wantLive=true;startLive(true);}return;}
  if(typeof MediaRecorder==='undefined'||!view.captureStream){msg('This browser cannot record video.',4000);return;}
  rec={starting:true,t0:Date.now()};
  let audio=null;
  if(S.vsound){try{audio=await navigator.mediaDevices.getUserMedia({audio:true});}catch(e){audio=null;}}
  let stream,mr; const mime=pickMime();
  try{
    stream=view.captureStream(30);
    if(audio) audio.getAudioTracks().forEach(t=>stream.addTrack(t));
    try{mr=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:6e6}:{videoBitsPerSecond:6e6});}catch(e){mr=new MediaRecorder(stream);}
  }catch(e){if(audio)audio.getTracks().forEach(t=>t.stop());rec=null;ui();msg('This browser cannot record video.',4000);return;}
  rec={mr,chunks:[],t0:Date.now(),audio,stream,thumb:thumbOf(view),w:view.width,h:view.height,mime:mr.mimeType||mime||'video/webm',rcp:snap(0),name:look().name};
  mr.ondataavailable=e=>{if(rec&&e.data&&e.data.size)rec.chunks.push(e.data);};
  mr.onstop=finishRec; mr.onerror=()=>stopRec();
  try{mr.start(1000);}catch(e){finishRec();msg('This browser cannot record video.',4000);return;}
  click();
  rec.timer=setInterval(()=>{if(!rec)return;ui();if(Date.now()-rec.t0>=60000){msg('Stopped at the 60 second limit',3000);stopRec();}},250);
  ui(); msg(S.vsound?(audio?'Recording with sound':'Recording without sound. Microphone access was refused.'):'Recording without sound. Turn sound on in Settings.',3200);
}
function stopRec(){
  if(!rec||rec.stopping||rec.starting) return;
  rec.stopping=true; clearInterval(rec.timer);
  try{rec.mr.requestData&&rec.mr.state==='recording'&&rec.mr.requestData();rec.mr.stop();}catch(e){finishRec();}
}
async function finishRec(){
  const r=rec; rec=null; if(!r||!r.mr){ui();return;}
  clearInterval(r.timer);
  try{r.stream.getVideoTracks().forEach(t=>t.stop());}catch(e){}
  if(r.audio) r.audio.getTracks().forEach(t=>t.stop());
  await sleep(60);                                    // lets the last chunk arrive
  const type=(r.mime||'').split(';')[0]||'video/webm', blob=new Blob(r.chunks,{type});
  if(!blob.size){ui();msg('The recording came out empty. Try again.',4000);return;}
  const meta={id:uid(),ts:Date.now(),look:r.rcp.look,name:r.name,rcp:r.rcp,thumb:r.thumb,fav:false,w:r.w,h:r.h,kind:'video',dur:Math.max(1,Math.round((Date.now()-r.t0)/1000)),ext:type.indexOf('mp4')>=0?'mp4':'webm',roll:null,hidden:false,orig:false};
  await DB.put(meta,{id:meta.id,out:blob}); shots.unshift(meta); S.count++; saveSettings(); ui(); msg('Video saved to your roll',3000);
}
const durText=t=>Math.floor(t/60)+':'+p2(t%60);
const meterCanvas=mkCanvas(64,64);
function meter(x,y){
  try{
    const c=meterCanvas.getContext('2d',{willReadFrequently:true}); c.drawImage(video,0,0,64,64);
    const r=6, cx=Math.round(x*63), cy=Math.round(y*63), x0=clamp(cx-r,0,63), y0=clamp(cy-r,0,63), w=Math.min(64-x0,2*r+1), h=Math.min(64-y0,2*r+1);
    const d=c.getImageData(x0,y0,w,h).data; let s=0;
    for(let i=0;i<d.length;i+=4) s+=(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2])/255;
    const mean=s/(d.length/4);
    return Math.round(clamp(Math.log2(0.45/Math.max(mean,0.03))*0.7,-1.5,1.5)*10)/10;
  }catch(e){return 0;}
}
let focTimer=0;
function showReticle(px,py){const f=$('#foc');f.hidden=true;void f.offsetWidth;f.style.left=px+'px';f.style.top=py+'px';f.hidden=false;clearTimeout(focTimer);focTimer=setTimeout(()=>{if(!tapEV)f.hidden=true;},1600);}
async function focusAt(x,y){
  let hw=false;
  try{
    const tr=live.stream&&live.stream.getVideoTracks()[0];
    if(tr&&tr.getCapabilities&&tr.applyConstraints){
      const caps=tr.getCapabilities(), sup=(navigator.mediaDevices.getSupportedConstraints&&navigator.mediaDevices.getSupportedConstraints())||{};
      if(sup.pointsOfInterest&&caps.focusMode&&caps.focusMode.length){
        const mode=caps.focusMode.indexOf('single-shot')>=0?'single-shot':caps.focusMode.indexOf('continuous')>=0?'continuous':caps.focusMode[0];
        await tr.applyConstraints({advanced:[{pointsOfInterest:[{x,y}],focusMode:mode}]}); hw=true;
      }
    }
  }catch(e){hw=false;}
  if(hw){tapEV=0;msg('Focus set on that point');}
  else{tapEV=meter(x,y);msg('Exposure set on that point. Focus stays automatic in this browser.',4200);}
  ui(); requestDraw();
}
let pinch=null, pinchEnd=0, zoomSave=0;
function setZoom(z){
  z=Math.round(clamp(z,1,5)*10)/10;
  if(z!==S.zoom){S.zoom=z;if(SRC.kind==='photo')SRC.saved=false;ui();requestDraw();}
  clearTimeout(zoomSave); zoomSave=setTimeout(saveSettings,400);
}
function onViewTap(ev){
  if(busyN||running||pinch||Date.now()-pinchEnd<450) return;
  if(!liveReady()||SRC.kind!=='sample'){if(!live.on)msg('Tap to focus works once the camera is on.',3200);return;}
  const b=view.getBoundingClientRect(), L=lastR; if(!L||!b.width) return;
  const cx=(ev.clientX-b.left)/b.width*view.width, cy=(ev.clientY-b.top)/b.height*view.height;
  const u=clamp((cx-L.m[0])/L.W,0,1), v=clamp((cy-L.m[1])/L.H,0,1);
  showReticle(ev.clientX-b.left,ev.clientY-b.top);
  focusAt(clamp(u*L.c1[0]+L.c1[2],0,1),clamp(v*L.c1[1]+L.c1[3],0,1));
}
function onOri(e){
  if(e.beta==null||e.gamma==null) return; gotOri=true;
  const b=e.beta*Math.PI/180, g=e.gamma*Math.PI/180, ux=-Math.cos(b)*Math.sin(g), uy=Math.sin(b), uz=Math.cos(b)*Math.cos(g);
  const n=$('#lvl'), t=$('#lvlDeg');
  if(Math.abs(uz)>0.9){n.classList.add('flat');n.classList.remove('ok');t.textContent='FLAT';return;}
  const roll=Math.atan2(ux,uy)*180/Math.PI, rel=((roll+45)%90+90)%90-45;   // tilt from the nearest upright or sideways hold
  n.classList.remove('flat'); n.classList.toggle('ok',Math.abs(rel)<1);
  n.style.setProperty('--a',rel.toFixed(1)+'deg'); t.textContent=(rel>0?'+':'')+rel.toFixed(1)+'\u00B0';
}
async function setLevel(on){
  window.removeEventListener('deviceorientation',onOri);
  if(!on){levelOn=false;ui();if(sheetName==='more')openSheet('more');return;}
  try{
    if(typeof DeviceOrientationEvent==='undefined') throw new Error('none');
    if(typeof DeviceOrientationEvent.requestPermission==='function'){const p=await DeviceOrientationEvent.requestPermission();if(p!=='granted')throw new Error('denied');}
    levelOn=true; gotOri=false; $('#lvlDeg').textContent=''; window.addEventListener('deviceorientation',onOri);
    setTimeout(()=>{if(levelOn&&!gotOri){setLevel(false);msg('No motion sensor answered, so the level is off.',4200);}},1800);
  }catch(e){levelOn=false;msg('The level needs motion access, which is not available here.',4200);}
  ui(); if(sheetName==='more')openSheet('more');
}

/* ---------- sheets ---------- */
function slider(id,label,min,max,step,val,fmt,on){
  const out=el('output',{text:fmt(val),for:id});
  const inp=el('input',{type:'range',id,min,max,step,value:val,'aria-label':label});
  const fill=v=>inp.style.setProperty('--p',((v-min)/(max-min)*100).toFixed(1)+'%'); fill(val);
  inp.addEventListener('input',()=>{const v=+inp.value;out.textContent=fmt(v);fill(v);on(v);});
  return el('div',{class:'sl'},el('label',{class:'lab',for:id,text:label}),out,inp);
}
function chips(id,label,opts,val,on){
  const seg=opts.length<=5&&!opts.some(o=>o[2])&&opts.reduce((n,o)=>n+String(o[1]).length,0)<=24;
  const wrap=el('div',{class:'chips'+(seg?' seg':''),role:'group','aria-label':label});
  opts.forEach(o=>{
    const b=el('button',{type:'button',class:'chip'+(o[0]===val?' on':''),'aria-pressed':o[0]===val?'true':'false'});
    if(o[2]){const d=el('span',{class:'dot'});d.style.background=o[2];b.append(d);}
    b.append(o[1]);
    b.onclick=()=>{[...wrap.children].forEach(c=>{c.classList.toggle('on',c===b);c.setAttribute('aria-pressed',c===b?'true':'false');});on(o[0]);};
    wrap.append(b);
  });
  return el('div',{class:'grp',id},el('span',{class:'lab',text:label}),wrap);
}
function onoff(id,label,val,on){
  let v=!!val;
  const sw=el('button',{type:'button',class:'switch',role:'switch','aria-checked':v?'true':'false','aria-label':label});
  sw.onclick=()=>{v=!v;sw.setAttribute('aria-checked',v?'true':'false');on(v);};
  return el('div',{class:'row',id},el('span',{text:label}),sw);
}
const note=t=>el('p',{class:'note',text:t});
function copyText(text,area){
  const fall=()=>{if(area){area.hidden=false;area.value=text;area.focus();area.select();}msg('Code shown below. Copy it from the box.',4000);};
  try{navigator.clipboard.writeText(text).then(()=>msg('Recipe code copied'),fall);}catch(e){fall();}
}
const SHEETS={
  flash:{title:'Flash',build(b){
    b.append(onoff('fOn','Direct flash',S.flash.on,v=>{S.flash.on=v;changed();}),
      chips('fCol','Flash colour',FLASHES,S.flash.col,v=>{S.flash.col=v;S.flash.on=true;changed();openSheet('flash');}),
      note('The flash is simulated on the photo: a hot centre, dark surroundings, harder contrast. Colours tint what the flash reaches.'));
  }},
  lens:{title:'Lens lab',build(b){
    const two=el('div',{class:'two'});
    LENS.forEach(a=>two.append(slider('ln_'+a[0],a[1],a[2],a[3],a[4],S.lens[a[0]],v=>Math.round(v/a[3]*100),v=>{S.lens[a[0]]=v;changed();})));
    b.append(two,
      chips('lnKal','Kaleidoscope',[[0,'Off'],[3,'3'],[4,'4'],[6,'6'],[8,'8']],S.lens.kal,v=>{S.lens.kal=v;changed();}),
      onoff('lnDbl','Double exposure',S.lens.dbl,v=>{S.lens.dbl=v;if(!v&&pair){pair=null;if(SRC.kind==='held')SRC=sampleSrc();}changed();}),
      note('With double exposure on, your next two photos are layered into one.'),
      el('div',{class:'btnrow'},el('button',{type:'button',class:'btn lite',text:'Remove all lenses',onclick:()=>{LENS.forEach(a=>S.lens[a[0]]=0);S.lens.kal=0;S.lens.dbl=false;pair=null;if(SRC.kind==='held')SRC=sampleSrc();changed();openSheet('lens');}})));
  }},
  lab:{title:'Imperfection lab',build(b){
    const two=el('div',{class:'two'});
    LAB.forEach(a=>two.append(slider('lab_'+a[0],a[1],a[2],a[3],a[4],S.p[a[0]],a[5],v=>{S.p[a[0]]=v;changed();})));
    b.append(two,el('div',{class:'btnrow'},
      el('button',{type:'button',class:'btn lite',text:'Reset to camera',onclick:()=>{S.p=lookDefaults(look());changed();openSheet('lab');}}),
      el('button',{type:'button',class:'btn lite',text:'Shuffle leaks & dust',onclick:()=>{SRC.seed=rnd();liveLeak=rnd();changed();}}),
      el('button',{type:'button',class:'btn lite',text:'Save as recipe',onclick:()=>openSheet('more','rcName')})));
  }},
  date:{title:'Date stamp',build(b){
    const now=new Date();
    const cust=el('input',{type:'date',id:'dtCustom',class:'field',value:S.date.custom,'aria-label':'Custom date'});
    cust.addEventListener('change',()=>{S.date.custom=/^\d{4}-\d{2}-\d{2}$/.test(cust.value)?cust.value:'';S.date.on=true;changed();openSheet('date');});
    b.append(onoff('dtOn','Stamp the date',S.date.on,v=>{S.date.on=v;changed();}),
      chips('dtStyle','Style',[['seg','Film LED'],['vhs','Camcorder']],S.date.style,v=>{S.date.style=v;S.date.on=true;changed();openSheet('date');}),
      chips('dtCol','Colour',[['amber','Amber','#ff9d1c'],['red','Red','#ff4a2a'],['green','Green','#74ff86'],['white','White','#f7f5ee']],S.date.color,v=>{S.date.color=v;S.date.on=true;changed();openSheet('date');}),
      chips('dtFmt','Format (Film LED)',E.DATE_FORMATS.map((f,i)=>[i,f]),S.date.fmt,v=>{S.date.fmt=v;S.date.on=true;changed();openSheet('date');}),
      chips('dtPos','Corner',[['br','Bottom right'],['bl','Bottom left']],S.date.pos,v=>{S.date.pos=v;changed();}),
      el('div',{class:'grp'},el('label',{class:'lab',for:'dtCustom',text:'Custom date'}),cust,
        el('div',{class:'btnrow'},
          el('button',{type:'button',class:'btn lite',text:"Use today",onclick:()=>{S.date.custom='';changed();openSheet('date');}}),
          el('button',{type:'button',class:'btn lite',text:"Same day, 1999",onclick:()=>{S.date.custom='1999-'+p2(now.getMonth()+1)+'-'+p2(now.getDate());S.date.on=true;changed();openSheet('date');}}))));
  }},
  frame:{title:'Frame',build(b){
    b.append(chips('frSel','Frame',Object.keys(E.FRAMES).map(k=>[k,E.FRAMES[k].name]),S.frame,v=>{S.frame=v;changed();}),
      note('Screen overlay burns the camera display into the photo: battery, frame number and exposure readout.'));
  }},
  more:{title:'Settings',build(b){
    const name=el('input',{type:'text',id:'rcName',class:'field',maxlength:'24',placeholder:'Recipe name',autocomplete:'off','aria-label':'Recipe name'});
    const code=el('textarea',{id:'rcCode',class:'field',placeholder:'Paste a recipe code here',spellcheck:'false','aria-label':'Recipe code'});
    const out=el('textarea',{id:'rcOut',class:'field',readonly:true,hidden:true,'aria-label':'Recipe code to copy'});
    const list=el('div',{id:'rcList'});
    const sec=t=>el('h3',{class:'sec',text:t});
    S.recipes.forEach((rc,i)=>list.append(el('div',{class:'rec'},el('b',{text:rc.name}),
      el('button',{type:'button',class:'btn lite',text:'Share',onclick:()=>copyText(encodeRecipe(rc),out)}),
      el('button',{type:'button',class:'btn lite',text:'Delete',onclick:()=>{S.recipes.splice(i,1);saveSettings();buildCams();ui();openSheet('more');}}))));
    if(S.mode==='booth') b.append(sec('Photobooth'),
      chips('boN','Shots per strip',[[2,'2'],[4,'4'],[6,'6']],S.booth.n,v=>{S.booth.n=v;booth=booth.slice(0,v);changed(true);}),
      chips('boLay','Layout',[['strip','Vertical strip'],['grid','Grid']],S.booth.layout,v=>{S.booth.layout=v;changed(true);}),
      chips('boPap','Paper',[['white','White','#f4f1e8'],['cream','Cream','#e8dcc0'],['black','Black','#0c0c0d']],S.booth.paper,v=>{S.booth.paper=v;changed(true);}),
      onoff('boStory','Export as 9:16 Story',S.booth.story,v=>{S.booth.story=v;changed(true);}),
      note('With the camera running, the booth counts down and shoots every frame by itself. Otherwise press the shutter for each frame, or import the photos together.'));
    b.append(sec('Shooting'),
      onoff('mVSound','Record sound with video',S.vsound,v=>{S.vsound=v;changed(true);}),
      note('Videos record the picture exactly as shown, up to 60 seconds each. Sound uses the microphone, so the phone will ask for it the first time.'),
      chips('mTimer','Self-timer',[[0,'Off'],[3,'3 s'],[10,'10 s']],S.timer,v=>{S.timer=v;changed(true);}),
      chips('mRoll','Film roll',[[0,'Instant'],[12,'12 shots'],[24,'24 shots'],[36,'36 shots']],S.rollSize,v=>{S.rollSize=v;S.roll=v?newRoll():null;changed(true);}),
      note('On a film roll you cannot see your photos until the roll is finished and developed. Imports are never hidden.'),
      sec('Photos'),
      el('div',{class:'btnrow'},el('button',{type:'button',class:'btn lite',text:'Import photos',onclick:importPhotos})),
      el('div',{class:'group'},
        onoff('mKeep','Keep clean originals',S.keep,v=>{S.keep=v;changed(true);}),
        onoff('mSound','Shutter sound',S.sound,v=>{S.sound=v;changed(true);})),
      note('Your photos are stored in this browser on this device only. Save the ones you want to keep to your Photos.'),
      sec('Recipes'),
      el('div',{class:'grp'},el('label',{class:'lab',for:'rcName',text:'Save the current look as a recipe'}),name,
        el('div',{class:'btnrow'},el('button',{type:'button',class:'btn',text:'Save recipe',onclick:()=>{
          const n=name.value.trim().slice(0,24); if(!n){toast('Give the recipe a name first.');name.focus();return;}
          S.recipes.unshift({name:n,rcp:cleanRecipe(snap(0))}); S.recipes=S.recipes.slice(0,24); saveSettings(); buildCams(); ui(); openSheet('more'); toast('Recipe saved: '+n);
        }}))),
      el('div',{class:'grp'},el('span',{class:'lab',text:'Your recipes'}),S.recipes.length?list:note('None yet. Tune a camera under Look, then save it here.'),out),
      el('div',{class:'grp'},el('label',{class:'lab',for:'rcCode',text:'Load a recipe from a code'}),code,
        el('div',{class:'btnrow'},el('button',{type:'button',class:'btn lite',text:'Load recipe',onclick:()=>{
          const rc=decodeRecipe(code.value); if(!rc){toast('That is not a Grain Club recipe code.',4000);return;}
          S.recipes.unshift(rc); S.recipes=S.recipes.slice(0,24); applyRecipe(Object.assign({},rc.rcp,{seed:rnd()})); saveSettings(); buildCams(); changed(); openSheet('more'); toast('Recipe loaded: '+rc.name);
        }}))),
      el('p',{class:'note'},el('b',{text:"Today's challenge: "}),CHALLENGES[Math.floor(Date.now()/864e5)%CHALLENGES.length]));
  }}
};
function encodeRecipe(rc){const r=Object.assign({},rc.rcp);delete r.seed;return 'GC1.'+btoa(unescape(encodeURIComponent(JSON.stringify({n:rc.name,r}))));}
function decodeRecipe(txt){
  try{const s=String(txt||'').trim();if(s.slice(0,4)!=='GC1.')return null;const o=JSON.parse(decodeURIComponent(escape(atob(s.slice(4)))));
    if(!o||typeof o.n!=='string'||!o.r||!LOOK[o.r.look])return null;return {name:o.n.slice(0,24)||'Recipe',rcp:cleanRecipe(o.r)};}catch(e){return null;}
}
const ADJ=[['lab','Look'],['lens','Lens'],['flash','Flash'],['date','Date'],['frame','Frame']];
let lastAdj='lab';
function openSheet(name,focusId){
  const s=SHEETS[name]; if(!s) return;
  const body=$('#sheetBody'), keep=sheetName===name?body.scrollTop:0, isAdj=ADJ.some(a=>a[0]===name);
  sheetName=name; if(isAdj) lastAdj=name;
  const tabs=$('#sheetTabs'), title=$('#sheetTitle'); tabs.textContent=''; tabs.hidden=!isAdj; title.hidden=isAdj; title.textContent=s.title;
  if(isAdj) ADJ.forEach(a=>tabs.append(el('button',{type:'button',class:'tab'+(a[0]===name?' on':''),'aria-pressed':a[0]===name?'true':'false',text:a[1],onclick:()=>openSheet(a[0])})));
  body.textContent=''; s.build(body); $('#sheet').hidden=false; $('#app').classList.add('sheeting'); body.scrollTop=keep; ui();
  if(focusId){const f=document.getElementById(focusId);if(f){f.scrollIntoView({block:'center'});f.focus();}}
}
function closeSheet(){sheetName=null;$('#sheet').hidden=true;$('#app').classList.remove('sheeting');ui();centerCam();}
function importPhotos(){if(busyN||running)return;if(SRC.kind==='result')SRC=sampleSrc();closeSheet();if(!$('#gal').hidden)$('#gal').hidden=true;fileLib.click();}

/* ---------- roll (gallery) and photo view ---------- */
let galTab='all', detId=null, detUrl=null, reveal=false;
function fmtDay(ts){try{return new Date(ts).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'});}catch(e){return new Date(ts).toDateString();}}
function renderGallery(){
  const body=$('#galBody'); body.textContent='';
  $('#tabAll').classList.toggle('on',galTab==='all'); $('#tabAll').setAttribute('aria-pressed',galTab==='all');
  $('#tabFav').classList.toggle('on',galTab==='fav'); $('#tabFav').setAttribute('aria-pressed',galTab==='fav');
  body.append(el('div',{class:'card'},el('p',null,el('span',{class:'k',text:"Today's challenge"}),CHALLENGES[Math.floor(Date.now()/864e5)%CHALLENGES.length])));
  if(DB.volatile) body.append(el('div',{class:'card'},el('p',null,el('span',{class:'k',text:'Not stored'}),'This browser is not letting the app keep photos between visits. Save the ones you want before you close this page.')));
  const rolls=new Map(); shots.forEach(s=>{if(s.hidden&&s.roll){rolls.set(s.roll,(rolls.get(s.roll)||0)+1);}});
  rolls.forEach((n,id)=>{
    const active=S.roll&&S.roll.id===id;
    body.append(el('div',{class:'card'},el('p',null,el('span',{class:'k',text:'Undeveloped roll'}),n+(active?' of '+S.roll.size:'')+' frames exposed. '+(active?'Finish the roll, or develop it early.':'Ready to develop.')),
      el('button',{type:'button',class:'pill go',text:active?'Develop early':'Develop',onclick:()=>developRoll(id)})));
  });
  const vis=shots.filter(s=>!s.hidden&&(galTab==='all'||s.fav));
  if(!vis.length){body.append(el('p',{class:'empty',text:galTab==='fav'?'No favourites yet. Open a photo and mark it.':rolls.size?'Your photos are still on the roll.':'No photos yet. Go back to the camera and press the shutter.'}));return;}
  const days=new Map(); vis.forEach(s=>{const d=new Date(s.ts),k=d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate();if(!days.has(k))days.set(k,[]);days.get(k).push(s);});
  days.forEach(list=>{
    const names=[...new Set(list.map(s=>s.name))];
    const grid=el('div',{class:'gridp'+(reveal?' reveal':'')});
    list.forEach(s=>{const b=el('button',{type:'button',class:(s.fav?'fav':'')+(s.kind==='video'?' vid':''),'data-dur':s.kind==='video'?durText(s.dur||0):null,'aria-label':s.name+(s.kind==='video'?' video, ':' photo, ')+new Date(s.ts).toLocaleTimeString(),onclick:()=>openDetail(s.id)});b.style.backgroundImage='url('+s.thumb+')';grid.append(b);});
    body.append(el('section',{class:'day'},el('h3',{text:fmtDay(list[0].ts)}),el('p',{text:list.length+(list.length===1?' photo':' photos')+' on '+names.slice(0,3).join(', ')+(names.length>3?' and '+(names.length-3)+' more':'')}),grid));
  });
  reveal=false;
}
async function developRoll(id){
  const list=shots.filter(s=>s.roll===id&&s.hidden);
  for(const s of list){s.hidden=false;await DB.put(s,null);}
  if(S.roll&&S.roll.id===id) S.roll=S.rollSize?newRoll():null;
  saveSettings(); reveal=true; renderGallery(); ui(); toast(list.length+' frames developed');
}
function openGallery(){closeSheet();$('#gal').hidden=false;renderGallery();$('#galBack').focus();}
function closeGallery(){$('#gal').hidden=true;$('#rollBtn').focus();}
const DL=(window.claude&&typeof window.claude.use==='function')?window.claude.use('downloads').catch(()=>null):null;
async function saveBlob(blob,name){
  if(DL){
    const dl=await DL;
    if(!dl) return 'hold';
    try{await dl.save({filename:name,data:blob});return 'saved';}
    catch(e){const c=e&&e.code;return c==='declined'?'declined':c==='rate_limited'?'busy':'hold';}
  }
  try{const f=new File([blob],name,{type:blob.type||'image/jpeg'});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]});return 'saved';}}
  catch(e){if(e&&e.name==='AbortError')return 'declined';}
  try{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();return 'saved';}catch(e){}
  return 'hold';
}
function saveMsg(r){toast(r==='saved'?'Saved':r==='declined'?'Not saved':r==='busy'?'One save at a time. Try again in a moment.':'Press and hold the photo, then choose Save to Photos.',r==='hold'?5200:2600);}
function fname(m,suffix){const d=new Date(m.ts);return 'grainclub-'+d.getFullYear()+p2(d.getMonth()+1)+p2(d.getDate())+'-'+p2(d.getHours())+p2(d.getMinutes())+p2(d.getSeconds())+(suffix||'')+'.'+(m.ext||'jpg');}
async function openDetail(id){
  const m=shots.find(s=>s.id===id); if(!m) return;
  const b=await DB.blobs(id);
  if(!b||!b.out){toast('This photo is no longer stored in this browser.');return;}
  detId=id; if(detUrl)URL.revokeObjectURL(detUrl); detUrl=URL.createObjectURL(b.out);
  const isVid=m.kind==='video', im=$('#detImg'), vd=$('#detVid'); im.hidden=isVid; vd.hidden=!isVid;
  if(isVid){im.removeAttribute('src');vd.src=detUrl;}else{vd.removeAttribute('src');im.src=detUrl;}
  $('#detTitle').textContent=m.name;
  const d=new Date(m.ts), r=m.rcp||{}, bits=[];
  if(r.flash&&r.flash.on)bits.push('flash'+(r.flash.col!=='white'?' '+r.flash.col:''));
  if(r.lens){if(r.lens.dbl&&m.kind==='photo')bits.push('double');if(r.lens.fish>0)bits.push('fisheye');if(r.lens.prism>0)bits.push('prism');if(r.lens.star>0)bits.push('starburst');if(r.lens.kal>0)bits.push('kaleido');}
  const info=$('#detInfo'); info.textContent='';
  info.append(el('div',{text:fmtDay(m.ts)+' at '+p2(d.getHours())+':'+p2(d.getMinutes())}),el('div',{text:m.w+' \u00D7 '+m.h+' px'+(isVid?', '+durText(m.dur||0)+' video':'')+(bits.length?', '+bits.join(', '):'')}));
  const act=$('#detAct'); act.textContent='';
  act.append(el('button',{type:'button',class:'pill go',text:isVid?'Save video':'Save photo',onclick:async()=>saveMsg(await saveBlob(b.out,fname(m)))}));
  if(b.a) act.append(
    el('button',{type:'button',class:'pill',text:'Save original',onclick:async()=>saveMsg(await saveBlob(b.a,fname(m,'-original')))}),
    el('button',{type:'button',class:'pill',text:'Develop again',onclick:async()=>{
      try{const a=await loadFile(b.a), bb=b.b?await loadFile(b.b):null;
        applyRecipe(m.rcp); S.mode='photo'; pair=null;
        SRC={kind:'photo',a,b:bb,seed:m.rcp.seed,saved:true}; saveSettings(); closeDetail(true); $('#gal').hidden=true; ui(); requestDraw(); msg('Change the look, then save it as a new photo.',4600);
      }catch(e){toast('The original could not be opened.');}
    }}));
  const fav=el('button',{type:'button',class:'pill'+(m.fav?' on':''),text:m.fav?'Favourite':'Add favourite','aria-pressed':m.fav?'true':'false',onclick:async()=>{m.fav=!m.fav;await DB.put(m,null);fav.classList.toggle('on',m.fav);fav.textContent=m.fav?'Favourite':'Add favourite';fav.setAttribute('aria-pressed',m.fav?'true':'false');}});
  let armed=0;
  const del=el('button',{type:'button',class:'pill',text:'Delete',onclick:async()=>{
    if(Date.now()-armed>3500){armed=Date.now();del.textContent='Tap again to delete';del.classList.add('warn');setTimeout(()=>{if(del.isConnected&&Date.now()-armed>=3400){del.textContent='Delete';del.classList.remove('warn');}},3500);return;}
    await DB.del(id); shots=shots.filter(s=>s.id!==id); closeDetail(); ui();
  }});
  act.append(fav,del);
  $('#det').hidden=false; $('#detBack').focus();
}
function closeDetail(skip){$('#det').hidden=true;$('#detImg').removeAttribute('src');try{const v=$('#detVid');v.pause();v.removeAttribute('src');v.load();}catch(e){}if(detUrl){URL.revokeObjectURL(detUrl);detUrl=null;}detId=null;if(!skip)renderGallery();}

/* ---------- wiring ---------- */
function setMode(m){
  if(S.mode===m) return; if(rec) stopRec(); S.mode=m; pair=null; booth=[];
  if(SRC.kind==='held'||SRC.kind==='result') SRC=sampleSrc();
  saveSettings(); ui(); requestDraw();
}
function boot(){
  if(!E){setMsg('This browser has graphics acceleration off, so photos cannot be developed here.');return;}
  [1,2,3,5].forEach(z=>$('#zoomc').append(el('button',{type:'button','data-z':z,'aria-label':'Zoom '+z+' times','aria-pressed':'false',text:String(z),onclick:()=>setZoom(z)})));
  loadSettings(); buildCams(); ui(); centerCam();
  $('#shutter').onclick=onShutter;
  $('#galImport').onclick=importPhotos;
  fileCam.addEventListener('change',()=>onFiles(fileCam,'camera'));
  fileLib.addEventListener('change',()=>onFiles(fileLib,'import'));
  $('#flipBtn').onclick=async()=>{tapEV=0;S.facing=S.facing==='user'?'environment':'user';saveSettings();if(live.on){dropLive();await startLive();}msg(S.facing==='user'?'Front camera':'Back camera');};
  $('#mPhoto').onclick=()=>setMode('photo'); $('#mVideo').onclick=()=>setMode('video'); $('#mBooth').onclick=()=>setMode('booth');
  $('#rollBtn').onclick=()=>{if(rec)stopRec();openGallery();}; $('#galBack').onclick=closeGallery; $('#detBack').onclick=()=>closeDetail();
  $('#tabAll').onclick=()=>{galTab='all';renderGallery();}; $('#tabFav').onclick=()=>{galTab='fav';renderGallery();};
  $('#sheetDone').onclick=closeSheet;
  $('#flashBtn').onclick=()=>{S.flash.on=!S.flash.on;changed();msg(S.flash.on?'Flash on':'Flash off',1300);};
  $('#adjBtn').onclick=()=>{if(sheetName&&sheetName!=='more')closeSheet();else openSheet(lastAdj);};
  $('#moreBtn').onclick=()=>{if(sheetName==='more')closeSheet();else openSheet('more');};
  $('#saveLook').onclick=saveLook;
  $('#closePhoto').onclick=()=>{pair=null;booth=[];SRC=sampleSrc();ui();requestDraw();};
  $('#gridBtn').onclick=()=>{S.grid=!S.grid;changed(true);};
  $('#levelBtn').onclick=()=>setLevel(!levelOn);
  $('#aeBtn').onclick=()=>{tapEV=0;$('#foc').hidden=true;ui();requestDraw();msg('Exposure point cleared');};
  view.addEventListener('click',onViewTap);
  const tdist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
  stage.addEventListener('touchstart',e=>{if(e.touches.length===2){pinch={d:Math.max(1,tdist(e.touches)),z:S.zoom};e.preventDefault();}},{passive:false});
  stage.addEventListener('touchmove',e=>{if(pinch&&e.touches.length===2){e.preventDefault();setZoom(pinch.z*tdist(e.touches)/pinch.d);}},{passive:false});
  const endPinch=e=>{if(pinch&&e.touches.length<2){pinch=null;pinchEnd=Date.now();}};
  stage.addEventListener('touchend',endPinch); stage.addEventListener('touchcancel',endPinch);
  document.addEventListener('gesturestart',e=>e.preventDefault());
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(!$('#det').hidden)closeDetail();else if(!$('#gal').hidden)closeGallery();else if(sheetName)closeSheet();}
  });
  if(window.ResizeObserver) new ResizeObserver(()=>{fitKey='';requestDraw();}).observe(screen); else window.addEventListener('resize',()=>{fitKey='';requestDraw();});
  window.addEventListener('pagehide',()=>{if(live.on)dropLive();});
  window.addEventListener('pageshow',e=>{if(e.persisted&&wantLive&&camOK&&!live.on)startLive(true);});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible'||!wantLive||!camOK) return;
    const tr=live.stream&&live.stream.getVideoTracks()[0];
    if(live.on&&tr&&tr.readyState!=='ended'){if(video.paused)video.play().catch(()=>{});return;}
    if(live.on)dropLive(); startLive(true);
  });
  if(document.fonts&&document.fonts.load){Promise.all([document.fonts.load('20px VT323')]).then(()=>{requestDraw();centerCam();},()=>{});}
  DB.open().then(()=>DB.all()).then(all=>{shots=(all||[]).filter(s=>s&&s.id&&s.thumb).sort((a,b)=>b.ts-a.ts);ui();});
  startLive(true).then(ok=>{booting=false;if(!ok)wantLive=false;ui();requestDraw();});
  requestAnimationFrame(loop);
}
boot();
})();

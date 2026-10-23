function get(k){try{return localStorage.getItem(k)}catch{return null}}function set(k,v){try{localStorage.setItem(k,v)}catch{}}document.body.classList.toggle('dark',get('theme')==='dark');document.documentElement.style.setProperty('--reading-size',(Number(get('font'))||21)+'px');document.querySelector('[data-theme]').onclick=()=>{document.body.classList.toggle('dark');set('theme',document.body.classList.contains('dark')?'dark':'light')};document.querySelectorAll('[data-font]').forEach(b=>b.onclick=()=>{let n=Math.max(17,Math.min(31,(Number(get('font'))||21)+Number(b.dataset.font)));set('font',n);document.documentElement.style.setProperty('--reading-size',n+'px')});if(document.querySelector('.chapter')){let k='position:'+location.pathname;let p=Number(get(k));if(p)window.scrollTo(0,p);window.addEventListener('scroll',()=>set(k,String(window.scrollY)),{passive:true});set('lastChapter',location.pathname.split('/').pop())}let resume=document.querySelector('[data-resume]');let last=get('lastChapter');if(resume&&/^(chapter-[0-9]+|introduction)\.html$/.test(last||'')){resume.href=last;resume.hidden=false}
if(document.querySelector('.chapter')&&/^#read-position=\d+$/.test(location.hash)){let y=Math.min(Number(location.hash.split('=')[1]),document.documentElement.scrollHeight);requestAnimationFrame(()=>window.scrollTo(0,y))}

// Keep the reader's preferred paragraph layout across all book pages.
function applyReadingMode(mode){
 mode=mode==='plain'?'plain':'book';
 document.body.dataset.readingMode=mode;
 document.querySelectorAll('[data-reading-mode]').forEach(button=>{
  if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.readingMode===mode));
 });
}
applyReadingMode(get('readingMode'));
document.querySelectorAll('button[data-reading-mode]').forEach(button=>button.addEventListener('click',()=>{
 set('readingMode',button.dataset.readingMode);applyReadingMode(button.dataset.readingMode);
}));



// Audio remains invisible until an approved MP3 has loaded valid metadata.
(async function initialiseAudiobook(){
 const article=document.querySelector('article.chapter');
 const page=location.pathname.split('/').pop();
 if(!article||!/^(chapter-\d+|introduction)\.html$/.test(page))return;
 try{
  const response=await fetch('audio/manifest.json',{cache:'no-cache'});
  if(!response.ok)return;
  const manifest=await response.json();
  const entry=manifest.version===1&&manifest.chapters&&manifest.chapters[page];
  if(!entry||entry.approved!==true||typeof entry.src!=='string')return;
  const heading=article.querySelector('h1');
  if(!heading||entry.title!==heading.textContent.trim())return;
  const src=new URL(entry.src,location.href);
  if(src.protocol!=='https:'||!/\.mp3$/i.test(src.pathname))return;
  const download=new URL(entry.download||entry.src,location.href);
  // Same origin ensures the browser can offer a genuine MP3 download.
  if(download.origin!==location.origin||!/\.mp3$/i.test(download.pathname))return;
  const section=document.createElement('section');
  section.hidden=true;section.className='audiobook-player';section.setAttribute('aria-label','Аудиозапись главы');
  const label=document.createElement('h2');label.textContent='Слушать главу';
  const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';
  audio.style.cssText='display:block;width:100%;max-width:100%;margin:0.75rem 0';
  audio.setAttribute('aria-label',entry.title);
  const timing=document.createElement('div');timing.style.cssText='font-size:1rem;margin:0.5rem 0';
  const link=document.createElement('a');link.href=download.href;
  link.download=download.pathname.split('/').pop();link.textContent='Скачать MP3';
  section.append(label,audio,timing,link);
  const anchor=article.querySelector('.tools')||heading;anchor.after(section);
  const key='audio-position:'+page+':'+src.href;
  const readPosition=()=>{try{return Number(localStorage.getItem(key))||0}catch{return 0}};
  const save=()=>{try{localStorage.setItem(key,String(audio.currentTime))}catch{}};
  const time=n=>{n=Math.max(0,Math.floor(n||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
  const update=()=>{timing.textContent=time(audio.currentTime)+' / '+time(audio.duration)};
  audio.addEventListener('loadedmetadata',()=>{
   if(!Number.isFinite(audio.duration)||audio.duration<=0){section.remove();return}
   const saved=readPosition();
   if(saved>0&&saved<audio.duration-1)audio.currentTime=saved;
   update();section.hidden=false;
  },{once:true});
  let lastSaved=0;
  audio.addEventListener('timeupdate',()=>{
   update();if(Date.now()-lastSaved>2000){save();lastSaved=Date.now()}
  });
  audio.addEventListener('pause',save);
  audio.addEventListener('ended',()=>{try{localStorage.removeItem(key)}catch{}});
  window.addEventListener('pagehide',()=>{if(!audio.ended)save()});
  audio.addEventListener('error',()=>{section.remove()});
  audio.src=src.href;audio.load();
 }catch{/* Missing manifest, blocked storage or unavailable audio must not affect reading. */}
})();

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

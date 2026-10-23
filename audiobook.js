(() => {
 'use strict';
 const pageHost = document.querySelector('[data-audiobook]');
 const article = document.querySelector('article.chapter');
 if (!pageHost && !article) return;
 const storageKey = 'audiobook-position:v1';
 const read = () => { try { return JSON.parse(localStorage.getItem(storageKey)) || null; } catch { return null; } };
 const format = n => { n = Math.max(0, Math.floor(n || 0)); return (n >= 3600 ? Math.floor(n / 3600) + ':' : '') + String(Math.floor(n / 60) % 60).padStart(n >= 3600 ? 2 : 1, '0') + ':' + String(n % 60).padStart(2, '0'); };
 async function init() {
  const response = await fetch('audio/manifest.json', {cache:'no-cache'});
  if (!response.ok) throw new Error('manifest unavailable');
  const manifest = await response.json();
  const tracks = manifest.tracks;
  if (manifest.version !== 2 || !Array.isArray(tracks) || tracks.length !== 15) throw new Error('invalid manifest');
  tracks.forEach((t, n) => {
   const id = n === 0 ? 'introduction' : 'chapter-' + n;
   if (t.id !== id || t.src !== 'audio/' + id + '.mp3' || t.page !== id + '.html' || typeof t.title !== 'string' || !Number.isFinite(t.duration) || t.duration <= 0) throw new Error('invalid track');
  });
  const section = pageHost || document.createElement('section');
  section.classList.add('audiobook-player'); section.setAttribute('aria-label','Аудиоплеер книги');
  const title = document.createElement('h2'); title.className = 'audio-current-title';
  const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'metadata';
  audio.setAttribute('aria-label','Аудиокнига');
  // Exactly one native media element per document. No autoplay, no hidden players.
  const timing = document.createElement('p'); timing.className = 'audio-time';
  const buttons = document.createElement('div'); buttons.className = 'audio-buttons';
  function button(text, action, name) { const b = document.createElement('button'); b.type='button'; b.textContent=text; b.dataset.audioAction=name; b.addEventListener('click',action); buttons.append(b); return b; }
  let current=0, pendingSeek=0, epoch=0, active=false, completed=false, lastSave=0;
  let channel;
  try { channel = new BroadcastChannel('architecture-audiobook'); } catch {}
  const status = document.createElement('p'); status.className='audio-status'; status.setAttribute('role','status');
  const previous = button('Предыдущая глава', () => choose(current - 1, true, 0), 'previous');
  const next = button('Следующая глава', () => choose(current + 1, true, 0), 'next');
  const pause = button('Пауза', () => { audio.pause(); save(); }, 'pause');
  const resume = button('Продолжить', () => { active=true; play(); }, 'resume');
  const start = button('Слушать с начала', () => choose(0, true, 0), 'start');
  const download = document.createElement('a'); download.className='audio-download'; download.textContent='Скачать эту запись MP3';
  const full = document.createElement('a'); full.href='audiobook.html'; full.textContent='Вся аудиокнига: список глав';
  function save() {
   if (!active) return;
   const position = audio.readyState >= 1 ? audio.currentTime : pendingSeek;
   try { localStorage.setItem(storageKey, JSON.stringify({version:1,id:tracks[current].id,time:Number.isFinite(position)?position:0,completed,updatedAt:Date.now()})); } catch {}
  }
  function update() {
   timing.textContent = format(audio.currentTime) + ' / ' + format(Number.isFinite(audio.duration)?audio.duration:tracks[current].duration);
   previous.disabled=current===0; next.disabled=current===tracks.length-1;
   pause.disabled=audio.paused; resume.disabled=!audio.paused;
   document.querySelectorAll('[data-audio-track]').forEach(b => {
    const selected=b.dataset.audioTrack===tracks[current].id;
    b.setAttribute('aria-pressed',String(selected));
    b.closest('li')?.classList.toggle('audio-selected',selected);
   });
  }
  function play() {
   const request = epoch;
   completed=false;
   const result=audio.play();
   if(result) result.catch(error => {
    if(request!==epoch || error.name==='AbortError') return;
    status.textContent = error.name==='NotAllowedError' ? 'Браузер остановил запуск следующей записи. Нажмите «Продолжить».' : 'Запись не удалось запустить. Нажмите «Продолжить» или выберите другую главу.';
    update(); resume.disabled=false;
   });
  }
  function choose(index, shouldPlay, position) {
   if(index<0 || index>=tracks.length) return;
   epoch++; audio.pause(); current=index; completed=false;
   pendingSeek=Number.isFinite(position)?Math.max(0,position):0;
   active=active||shouldPlay;
   title.textContent=tracks[current].title;
   audio.setAttribute('aria-label',tracks[current].title);
   audio.src=tracks[current].src; audio.load();
   download.href=tracks[current].src; download.download=tracks[current].src.split('/').pop();
   full.href='audiobook.html?chapter='+encodeURIComponent(tracks[current].id);
   status.textContent=shouldPlay?'Загрузка записи…':'Нажмите «Продолжить», чтобы слушать.';
   update(); save();
   if(shouldPlay) play();
  }
  audio.addEventListener('loadedmetadata', () => {
   if(pendingSeek>0 && Number.isFinite(audio.duration)) audio.currentTime=Math.min(pendingSeek,Math.max(0,audio.duration-.25));
   pendingSeek=0; update();
  });
  audio.addEventListener('play', () => { active=true; completed=false; status.textContent='Воспроизводится: '+tracks[current].title; channel?.postMessage('pause-other-players'); update(); save(); });
  audio.addEventListener('pause', () => { update(); save(); });
  audio.addEventListener('timeupdate', () => { update(); if(Date.now()-lastSave>2000){save();lastSave=Date.now();} });
  audio.addEventListener('seeked',save);
  audio.addEventListener('ended', () => {
   if(current<tracks.length-1) choose(current+1,true,0);
   else { completed=true; save(); status.textContent='Аудиокнига прослушана до конца.'; update(); }
  });
  audio.addEventListener('error', () => { status.textContent='Не удалось загрузить MP3. Попробуйте «Продолжить» или скачайте запись.';update();resume.disabled=false; });
  window.addEventListener('pagehide',save);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState==='hidden')save(); });
  if(channel)channel.onmessage=()=>{if(!audio.paused){active=false;audio.pause();status.textContent='Воспроизведение продолжено в другой вкладке.';}};
  section.append(title,audio,timing,buttons,download,status);
  if(!pageHost){ section.append(document.createElement('br'),full); const anchor=article.querySelector('.tools')||article.querySelector('h1'); anchor.after(section); }
  document.querySelectorAll('[data-audio-track]').forEach(b=>b.addEventListener('click',()=>choose(tracks.findIndex(t=>t.id===b.dataset.audioTrack),true,0)));
  const saved=read();
  const validSaved=saved && saved.version===1 && tracks.some(t=>t.id===saved.id) && Number.isFinite(saved.time) && saved.time>=0;
  const requested=pageHost?new URLSearchParams(location.search).get('chapter'):location.pathname.split('/').pop()?.replace(/\.html$/,'');
  let index=tracks.findIndex(t=>t.id===requested);
  if(index<0)index=validSaved?tracks.findIndex(t=>t.id===saved.id):0;
  choose(index,false,validSaved&&saved.id===tracks[index].id?saved.time:0);
  if(validSaved&&saved.id===tracks[index].id)status.textContent=saved.completed?'Ранее вы дослушали книгу. Можно начать заново.':'Сохранено: '+tracks[index].title+', '+format(saved.time)+'. Нажмите «Продолжить».';
 }
 init().catch(() => { if(pageHost)pageHost.textContent='Аудиоплеер временно недоступен. Записи можно скачать из списка ниже.'; });
})();

const {chromium}=require('playwright');
const {spawn}=require('child_process');
const server=spawn('python3',[require('path').join(__dirname,'audio_server.py')],{stdio:'ignore'});
process.on('exit',()=>server.kill());
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');const manifest=JSON.parse(fs.readFileSync(path.join(root,'audio/manifest.json')));
let assertions=0;const check=(v,msg)=>{assert.ok(v,msg);assertions++};
(async()=>{
 await new Promise(r=>setTimeout(r,500));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile,acceptDownloads:true});
  await context.route('**/analytics/config.json',r=>r.fulfill({json:{enabled:false}}));
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/audiobook.html');
  await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=1);
  check(await page.locator('audio').count()===1,'one player');check(await page.locator('[data-audio-track]').count()===15,'all tracks');
  check(await page.locator('audio').evaluate(a=>a.paused&&!a.autoplay),'no autoplay');
  await page.locator('[data-audio-action="start"]').click();
  await page.waitForFunction(()=>document.querySelector('audio').currentTime>.1);
  check(await page.locator('.audio-current-title').textContent()==='Введение','start from introduction');
  await page.locator('[data-audio-action="pause"]').click();check(await page.locator('audio').evaluate(a=>a.paused),'pause');
  await page.locator('[data-audio-action="resume"]').click();await page.waitForFunction(()=>!document.querySelector('audio').paused);
  for(let i=0;i<manifest.tracks.length;i++){
   const t=manifest.tracks[i];
   await page.locator('[data-audio-track="'+t.id+'"]').click();
   await page.waitForFunction(src=>{const a=document.querySelector('audio');return a.src.endsWith(src)&&a.readyState>=2&&!a.paused&&a.currentTime>.05;},t.src);
   check(await page.locator('audio').evaluate((a,d)=>Math.abs(a.duration-d)<.15,t.duration),'real MP3 duration '+t.id);
   await page.locator('audio').evaluate(a=>a.currentTime=Math.min(3,a.duration/2));
   await page.waitForFunction(()=>document.querySelector('audio').currentTime>=3);
   check(await page.locator('audio').evaluate(a=>a.error===null),'play and seek '+t.id);
   const response=await context.request.get('http://127.0.0.1:8765/'+t.src);
   check(response.status()===200,'download response '+t.id);
   check(crypto.createHash('sha256').update(await response.body()).digest('hex')===t.sha256,'download original bytes '+t.id);
  }
  // Traverse all 14 automatic transitions using actual ended events near each file end.
  await page.locator('[data-audio-action="start"]').click();
  for(let i=0;i<manifest.tracks.length;i++){
   const t=manifest.tracks[i];
   await page.waitForFunction(src=>{const a=document.querySelector('audio');return a.src.endsWith(src)&&a.readyState>=2&&!a.paused;},t.src);
   await page.locator('audio').evaluate(a=>a.currentTime=a.duration-.08);
   if(i<14){
    await page.waitForFunction(src=>{const a=document.querySelector('audio');return a.src.endsWith(src)&&a.readyState>=2&&!a.paused;},manifest.tracks[i+1].src);
    check(true,'automatic advance '+t.id);
   }else{
    await page.waitForFunction(()=>document.querySelector('.audio-status').textContent==='Аудиокнига прослушана до конца.');
    check(await page.locator('audio').evaluate(a=>a.paused),'stop at final');
    check(await page.locator('[data-audio-action="next"]').isDisabled(),'no next after final');
   }
  }
  await page.locator('[data-audio-track="chapter-7"]').click();
  await page.waitForFunction(()=>document.querySelector('audio').readyState>=2&&!document.querySelector('audio').paused);
  await page.locator('audio').evaluate(a=>a.currentTime=37);await page.locator('[data-audio-action="pause"]').click();
  await page.reload();await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=1&&document.querySelector('audio').currentTime>36);
  check(await page.locator('.audio-current-title').textContent()===manifest.tracks[7].title,'restore chapter');
  check(await page.locator('audio').evaluate(a=>a.paused&&a.currentTime>=36&&a.currentTime<39),'restore time without autoplay');
  await page.locator('[data-audio-action="resume"]').click();await page.waitForFunction(()=>!document.querySelector('audio').paused);
  await page.locator('[data-audio-action="next"]').click();await page.waitForFunction(()=>document.querySelector('audio').src.endsWith('chapter-8.mp3'));
  await page.locator('[data-audio-action="previous"]').click();await page.waitForFunction(()=>document.querySelector('audio').src.endsWith('chapter-7.mp3'));check(true,'previous and next');
  // Model a platform blocking the next play(); this is a failure-handling test, not a claim about Safari.
  await page.locator('audio').evaluate(a=>{a.pause();a.play=()=>Promise.reject(new DOMException('blocked','NotAllowedError'));});
  await page.locator('[data-audio-action="next"]').click();
  await page.waitForFunction(()=>document.querySelector('.audio-status').textContent.includes('Браузер остановил'));
  check(await page.locator('[data-audio-action="resume"]').isEnabled(),'mobile fallback remains usable');
  await page.locator('audio').evaluate(a=>delete a.play);await page.locator('[data-audio-action="resume"]').click();await page.waitForFunction(()=>!document.querySelector('audio').paused);check(true,'resume after platform block');
  for(const dark of [false,true]){
   await page.evaluate(v=>document.body.classList.toggle('dark',v),dark);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'responsive layout');
   await page.locator('[data-audiobook]').screenshot({path:path.join(root,'docs','audiobook-'+(mobile?'mobile':'desktop')+'-'+(dark?'dark':'light')+'.png')});
  }
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('a[href="audio/chapter-14.mp3"][download]').click()]);
  const downloaded=await download.path();const hash=crypto.createHash('sha256').update(fs.readFileSync(downloaded)).digest('hex');check(hash===manifest.tracks[14].sha256,'original download hash');
  await page.goto('http://127.0.0.1:8765/chapter-14.html');await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=1);
  check(await page.locator('audio').count()===1,'one chapter player');check(await page.locator('.audio-current-title').textContent()===manifest.tracks[14].title,'chapter player mapping');
  check(await page.locator('audio').evaluate(a=>a.paused&&!a.autoplay),'chapter no autoplay');
  check(errors.length===0,'no JavaScript errors');
  await context.close();
 }
 await browser.close();server.kill();console.log('PASS: '+assertions+' real-media browser assertions on desktop and mobile Chromium. Analytics disabled in tests.');
})().catch(e=>{console.error(e);process.exit(1)});

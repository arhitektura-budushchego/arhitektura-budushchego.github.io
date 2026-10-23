const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),origin='https://arhitektura-budushchego.github.io';
const tracker=process.env.GOATCOUNTER_TRACKER_SOURCE;
if(!tracker)throw Error('GOATCOUNTER_TRACKER_SOURCE required');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});let checks=0;
 for(const [query,want] of [
  ['?utm_campaign=pilot01&utm_source=r002_article01&email=private@example.org#secret','?utm_campaign=pilot01&utm_source=r002_article01'],
  ['?utm_campaign=pilot01&utm_source=private@example.org',''],
  ['?utm_campaign=pilot01&utm_campaign=organic01&utm_source=r002_email',''],
  ['?utm_campaign=unknown&utm_source=r002_email',''],['?token=secret','']]){
  const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage(),hits=[];
  await p.addInitScript(()=>Object.defineProperty(navigator,'webdriver',{get:()=>false}));
  await p.route('**/*',async r=>{
   let u=new URL(r.request().url());
   if(u.origin===origin){let f=path.join(root,u.pathname==='/'?'index.html':u.pathname);if(u.pathname==='/analytics/config.json')return r.fulfill({json:{enabled:true,siteCode:'fixture',productionHost:new URL(origin).hostname}});return r.fulfill({path:f});}
   if(u.hostname==='gc.zgo.at')return r.fulfill({path:tracker,contentType:'application/javascript'});
   if(u.hostname==='fixture.goatcounter.com'){if(u.pathname==='/count')hits.push(u);return r.fulfill({json:{count:'0'}});}
   return r.abort();
  });
  await p.goto(origin+'/'+query);await p.waitForFunction(()=>window.goatcounter?.get_data);await p.waitForTimeout(80);
  assert.equal(hits.length,1);assert.equal(hits[0].searchParams.get('q')||'',want);assert.equal(hits[0].searchParams.get('ns'),'true');assert.equal(hits[0].searchParams.has('s'),false);assert.ok(!hits[0].href.includes('private'));checks+=5;
  assert.equal(await p.evaluate(()=>sessionStorage.length),0);checks++;
  await p.goto(origin+'/chapter-1.html');await p.waitForFunction(()=>window.goatcounter?.get_data);await p.waitForTimeout(80);assert.equal(hits[1].searchParams.has('q'),false);checks++;
  await c.close();
 }
 for(const width of [320,390,768]){
  const c=await browser.newContext({viewport:{width,height:844}}),p=await c.newPage();
  await p.route('**/*',async r=>{let u=new URL(r.request().url());if(u.origin!==origin)return r.abort();if(u.pathname.startsWith('/analytics/'))return r.fulfill({status:404,body:''});return r.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname)});});
  for(const page of ['index.html','chapter-1.html','downloads.html','share.html','arhitektura-budushchego.html']){
   await p.goto(origin+'/'+page);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),page+' width '+width);checks++;
   if(page==='chapter-1.html'){await p.getByRole('button',{name:'Увеличить шрифт'}).click();await p.getByRole('button',{name:'Обычный',exact:true}).click();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks++;}
   if(width===390&&['chapter-1.html','share.html'].includes(page))await p.screenshot({path:process.env.SCREENSHOT_DIR+'/'+page+'.png'});
  }await c.close();
 }
 // Same text after instrumentation; no approved chapter prose changed.
 await browser.close();console.log('PASS '+checks+' distribution assertions; network intercepted, no live analytics hits');
})().catch(e=>{console.error(e);process.exit(1)});

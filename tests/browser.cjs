const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const origin = 'https://arhitektura-budushchego.github.io';
const trackerSource = process.env.GOATCOUNTER_TRACKER_SOURCE;
if (!trackerSource) throw new Error('Set GOATCOUNTER_TRACKER_SOURCE to an audited count.js file');
(async () => {
  const browser = await chromium.launch({headless:true});
  let checks = 0;
  for (const scenario of ['disabled','desktop','desktop-dark','mobile-light','mobile-dark','unavailable','excluded','dnt','gpc','zero']) {
    const context = await browser.newContext({viewport:scenario.startsWith('mobile')?{width:390,height:844}:{width:1280,height:900}});
    const page = await context.newPage(); const hits=[]; const urls=[]; let external=0;
    await page.addInitScript(s => {
      Object.defineProperty(navigator,'webdriver',{get:()=>false});
      if(s.endsWith('-dark'))localStorage.setItem('theme','dark');
      if(s==='excluded')localStorage.setItem('skipgc','t');
      if(s==='dnt')Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'});
      if(s==='gpc')Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true});
    },scenario);
    await page.route('**/*',async route => {
      const url = new URL(route.request().url());
      if(url.origin === origin){
        if(url.pathname==='/analytics/config.json') return route.fulfill({json:{enabled:scenario!=='disabled',siteCode:'test-fixture',productionHost:new URL(origin).hostname}});
        const filename=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1));
        if(!fs.existsSync(filename))return route.fulfill({status:404,body:''});
        const ext=path.extname(filename);
        return route.fulfill({body:fs.readFileSync(filename),contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[ext]||'application/octet-stream'});
      }
      external++;
      if(url.hostname==='gc.zgo.at')return route.fulfill({body:fs.readFileSync(trackerSource),contentType:'application/javascript'});
      if(url.hostname==='test-fixture.goatcounter.com'){
        if(url.pathname==='/count'){hits.push(url);return route.fulfill({status:200,body:''});}
        urls.push(url);
        if(scenario==='unavailable')return route.fulfill({status:503,body:'unavailable'});
        return route.fulfill({json:{count:scenario==='zero'?'0':'1,234'}});
      }
      throw new Error('Unexpected request '+url.origin);
    });
    await page.goto(origin+'/chapter-3.html?private=do-not-send#read-position=10');
    if(scenario==='disabled'){
      await page.waitForTimeout(150); assert.equal(external,0); assert.equal(await page.locator('.visitor-stats').count(),0); checks+=2;
    }else{
      await page.waitForFunction(()=>{const el=document.querySelector('.visitor-stats p:last-child');return el && el.textContent!=='Загрузка статистики…'});
      const today = new Date().toISOString().slice(0,10);
      assert.equal(urls.length,3); assert.equal(urls[0].searchParams.get('start'),today); assert.equal(urls[1].searchParams.get('start'),today.slice(0,7)+'-01'); assert.equal(urls[2].search,''); checks+=4;
      if(['excluded','dnt','gpc'].includes(scenario)){ assert.equal(hits.length,0);checks++; }
      else{
        await page.waitForFunction(()=>window.goatcounter?.get_data);
        assert.equal(hits.length,1);const hit=hits[0];
        assert.equal(hit.searchParams.get('p'),'/chapter-3.html'); assert.equal(hit.searchParams.get('ns'),'true');
        assert.equal(hit.searchParams.has('q'),false); assert.equal(hit.searchParams.has('s'),false);
        checks+=5;
      }
      const nums=await page.locator('.visitor-stats strong').allTextContents();
      if(scenario==='unavailable')assert.deepEqual(nums,['—','—','—']);
      else if(scenario==='zero')assert.deepEqual(nums,['0','0','0']);
      else assert.ok(nums.every(n=>n.replace(/\D/g,'')==='1234'));
      assert.equal(await page.locator('.visitor-stats button').count(),0);assert.equal((await context.cookies()).length,0);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks+=4;
      if(scenario==='mobile-dark'){
        assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('dark')),true);
        await page.screenshot({path:'/tmp/goatcounter-mobile-dark.png',fullPage:false});checks++;
      }
      if(scenario==='desktop'){
        await page.locator('.visitor-stats').screenshot({path:'/tmp/goatcounter-desktop.png'});
        hits.length=0; await page.goto(origin+'/chapter-4.html');
        await page.waitForFunction(()=>window.goatcounter?.get_data);
        assert.equal(hits.length,1);assert.equal(hits[0].searchParams.get('p'),'/chapter-4.html');checks+=2;
      }
    }
    await context.close();
  }
  await browser.close(); console.log('PASS: '+checks+' browser assertions; all network intercepted, no live visits generated.');
})().catch(error=>{console.error(error);process.exit(1)});

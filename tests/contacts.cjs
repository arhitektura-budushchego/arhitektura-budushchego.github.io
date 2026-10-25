const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),origin='https://arhitektura-budushchego.github.io',address='mailto:arhitektura.budushchego@proton.me';
(async()=>{let checks=0;const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
for(const width of [320,390,768,1440])for(const theme of ['light','dark']){
const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme});await context.addInitScript(t=>localStorage.setItem('theme',t),theme);const page=await context.newPage();await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==origin||u.pathname.startsWith('/analytics/'))return r.abort();return r.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname)});});
await page.goto(origin+'/contacts.html');assert.equal(await page.title(),'Контакты — Архитектура будущего');assert.equal(await page.locator('main h1').textContent(),'Контакты');checks+=2;
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks++;
for(const link of await page.locator('a[href^="mailto:"]').all()){assert.equal(await link.getAttribute('href'),address);checks++;}
assert.equal(await page.locator('form,input,textarea').count(),0);checks++;
if([390,1440].includes(width))await page.screenshot({path:root+'/contacts-'+width+'-'+theme+'.png',fullPage:true});
await page.goto(origin+'/index.html');await page.locator('footer').getByRole('link',{name:'Контакты',exact:true}).click();assert.equal(new URL(page.url()).pathname,'/contacts.html');checks++;
await context.close();}
for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.html')&&!n.startsWith('arhitektura-budushchego')&&n!=='404.html')){if(!name.endsWith('.html'))continue;let s=fs.readFileSync(root+'/'+name,'utf8');assert.ok(s.includes(address),name);checks++;}
await browser.close();console.log('PASS '+checks+' contact assertions, mobile/desktop and both themes; all external requests blocked; no email sent');})().catch(e=>{console.error(e);process.exit(1)});

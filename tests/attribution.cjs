const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),origin='https://arhitektura-budushchego.github.io',tracker=process.env.GOATCOUNTER_TRACKER_SOURCE;
if(!tracker)throw Error('GOATCOUNTER_TRACKER_SOURCE required');
const current=JSON.parse(fs.readFileSync(root+'/analytics/attribution.json','utf8'));
const cases=[
 ['editorial','?utm_campaign=pilot01&utm_source=r048_email','?utm_campaign=pilot01&utm_source=r048_email',current],
 ['blogger','?utm_campaign=bloggers01&utm_source=r018_review01','?utm_campaign=bloggers01&utm_source=r018_review01',current],
 ['new configuration only','?utm_campaign=c001&utm_source=p123','?utm_campaign=c001&utm_source=p123',{version:1,campaigns:['c001'],sources:['p123']}],
 ['remove source','?utm_campaign=pilot01&utm_source=r048_email','',{version:1,campaigns:['pilot01'],sources:[]}],
 ['unknown source','?utm_campaign=pilot01&utm_source=p999','',current],
 ['unknown campaign','?utm_campaign=c999&utm_source=r048_email','',current],
 ['duplicate source','?utm_campaign=pilot01&utm_source=r048_email&utm_source=r001_email','',current],
 ['duplicate campaign','?utm_campaign=pilot01&utm_campaign=test01&utm_source=r048_email','',current],
 ['private query','?utm_campaign=pilot01&utm_source=r048_email&email=private@example.org&token=secret#name','?utm_campaign=pilot01&utm_source=r048_email',current],
 ['email in URL','?utm_campaign=pilot01&utm_source=private%40example.org','',current],
 ['email in config','?utm_campaign=pilot01&utm_source=private%40example.org','',{version:1,campaigns:['pilot01'],sources:['private@example.org']}],
 ['private campaign','?utm_campaign=ivan_petrov&utm_source=r048_email','',{version:1,campaigns:['ivan_petrov'],sources:['r048_email']}],
 ['extra config keys','?utm_campaign=pilot01&utm_source=r048_email','',{...current,email:'private@example.org'}],
 ['duplicate config code','?utm_campaign=pilot01&utm_source=r048_email','',{version:1,campaigns:['pilot01'],sources:['r048_email','r048_email']}],
 ['oversized config','?utm_campaign=pilot01&utm_source=r048_email','',{version:1,campaigns:['pilot01'],sources:Array(2001).fill('r048_email')}],
 ['bad schema','?utm_campaign=pilot01&utm_source=r048_email','',{version:2,campaigns:['pilot01'],sources:['r048_email']}],
 ['bad JSON','?utm_campaign=pilot01&utm_source=r048_email','','{broken'],
 ['network failure','?utm_campaign=pilot01&utm_source=r048_email','','NETWORK_ERROR'],
 ['oversized file','?utm_campaign=pilot01&utm_source=r048_email','',' '.repeat(131073)+JSON.stringify(current)],
 ['missing file','?utm_campaign=pilot01&utm_source=r048_email','',null]
];
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});let checks=0;
for(const [name,query,want,config] of cases){const c=await b.newContext(),p=await c.newPage(),hits=[];await p.addInitScript(()=>Object.defineProperty(navigator,'webdriver',{get:()=>false}));await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===origin){if(u.pathname==='/analytics/config.json')return r.fulfill({json:{enabled:true,siteCode:'fixture',productionHost:new URL(origin).hostname}});if(u.pathname==='/analytics/attribution.json'&&config==='NETWORK_ERROR')return r.abort();if(u.pathname==='/analytics/attribution.json')return config===null?r.fulfill({status:404,body:''}):r.fulfill({body:typeof config==='string'?config:JSON.stringify(config),contentType:'application/json'});return r.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname)});}if(u.hostname==='gc.zgo.at')return r.fulfill({path:tracker,contentType:'application/javascript'});if(u.hostname==='fixture.goatcounter.com'){if(u.pathname==='/count')hits.push(u);return r.fulfill({json:{count:'0'}});}return r.abort();});
await p.goto(origin+'/'+query);await p.waitForFunction(()=>window.goatcounter?.get_data);await p.waitForFunction(()=>!!document.querySelector('.visitor-stats'));await p.waitForTimeout(100);
assert.equal(hits.length,1,name);assert.equal(hits[0].searchParams.get('q')||'',want,name);assert.equal(hits[0].searchParams.get('ns'),'true',name);assert.equal(hits[0].searchParams.has('s'),false,name);assert.ok(!hits[0].href.includes('private')&&!hits[0].href.includes('secret'),name);assert.equal(await p.evaluate(()=>sessionStorage.length),0,name);assert.equal(await p.evaluate(()=>localStorage.getItem('utm_source')),null,name);checks+=7;await c.close();}
await b.close();console.log('PASS '+checks+' attribution privacy/configuration assertions in '+cases.length+' scenarios; all external requests intercepted');})().catch(e=>{console.error(e);process.exit(1)});

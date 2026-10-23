// Run with jsdom 26 installed outside the website; never contacts any real service.
const {JSDOM, ResourceLoader} = require(process.env.JSDOM_MODULE || 'jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(process.env.GOATCOUNTER_TRACKER_SOURCE,'utf8');
const integration=fs.readFileSync(path.join(root,'analytics/analytics.js'),'utf8');
const host='arhitektura-budushchego.github.io';
let checks=0;
(async()=>{
for(const scenario of ['disabled','normal','error','malformed','zero','excluded','dnt','gpc','wronghost']) {
  const hits=[],urls=[];
  class Loader extends ResourceLoader {fetch(url){assert.equal(url,'https://gc.zgo.at/count.js');return Promise.resolve(Buffer.from(source));}}
  const dom=new JSDOM('<!doctype html><html><head><title>Глава 3</title></head><body><footer></footer><script src="https://'+host+'/analytics/analytics.js"></script></body></html>',{
    url:'https://'+(scenario==='wronghost'?'preview.invalid':host)+'/chapter-3.html?private=secret#anchor',
    referrer:'https://example.org/private?q=secret',runScripts:'outside-only',pretendToBeVisual:true,resources:new Loader()
  });
  const w=dom.window;
  // jsdom outside-only does not execute remote scripts; execute the audited source on insertion.
  const append=w.document.head.append.bind(w.document.head);
  w.document.head.append=el=>{append(el);if(el.src==='https://gc.zgo.at/count.js'){w.eval(source);el.onload();}};
  w.AbortSignal=AbortSignal;
  Object.defineProperty(w.navigator,'sendBeacon',{value:url=>{hits.push(new URL(url));return true}});
  if(scenario==='excluded')w.localStorage.setItem('skipgc','t');
  if(scenario==='dnt')Object.defineProperty(w.navigator,'doNotTrack',{value:'1'});
  if(scenario==='gpc')Object.defineProperty(w.navigator,'globalPrivacyControl',{value:true});
  w.fetch=async input=>{
    const url=new URL(input);
    if(url.pathname==='/analytics/config.json')return {ok:true,json:async()=>({enabled:scenario!=='disabled',siteCode:'test-fixture',productionHost:host})};
    urls.push(url);
    return {ok:scenario!=='error',json:async()=>({count:scenario==='malformed'?'invalid':scenario==='zero'?'0':'1,234'})};
  };
  Object.defineProperty(w.document,'currentScript',{value:w.document.querySelector('script')});
  w.eval(integration);
  await new Promise(resolve=>setTimeout(resolve,30));
  if(['disabled','wronghost'].includes(scenario)){
    assert.equal(hits.length,0);assert.equal(urls.length,0);assert.equal(w.document.querySelector('.visitor-stats'),null);checks+=3;
  }else{
    assert.equal(urls.length,3);
    const day=new Date().toISOString().slice(0,10);
    assert.equal(urls[0].searchParams.get('start'),day);
    assert.equal(urls[1].searchParams.get('start'),day.slice(0,7)+'-01');
    assert.equal(urls[2].search,'');checks+=4;
    if(['excluded','dnt','gpc'].includes(scenario)){assert.equal(hits.length,0);checks++;}
    else{
      assert.equal(hits.length,1);const q=hits[0].searchParams;
      assert.equal(q.get('p'),'/chapter-3.html');assert.equal(q.get('ns'),'true');
      assert.equal(q.get('r'),'https://example.org');assert.equal(q.has('q'),false);assert.equal(q.has('s'),false);checks+=6;
    }
    const numbers=[...w.document.querySelectorAll('strong')].map(el=>el.textContent.replace(/[\s\u00a0]/g,''));
    const expected=['error','malformed'].includes(scenario)?'—':scenario==='zero'?'0':'1234';
    assert.deepEqual(numbers,[expected,expected,expected]);assert.equal(w.document.querySelectorAll('button').length,0);
    assert.equal(w.document.cookie,'');checks+=3;
    if(scenario==='normal'){
      assert.equal(w.localStorage.length,0);checks++;
      assert.equal(w.document.querySelector('.visitor-stats').getAttribute('aria-label'),'Статистика просмотров страниц');checks++;
    }
  }
  w.close();
}
console.log('PASS: '+checks+' DOM/integration assertions using official count.js. All requests mocked; no live analytics calls.');
})().catch(error=>{console.error(error);process.exit(1)});

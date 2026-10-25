
"use strict";
const REVIEW_API="https://mviknynswxcfzxxsfuak.supabase.co";
const REVIEW_KEY="sb_publishable_GnOrOreOlbvJkix-Q9dO0A_yLF-wId1";
let accessToken=null;
const $=s=>document.querySelector(s);
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
async function api(path,options={}){
 const response=await fetch(REVIEW_API+path,{...options,headers:{"apikey":REVIEW_KEY,"Content-Type":"application/json",...(accessToken?{"Authorization":"Bearer "+accessToken}:{}),...options.headers}});
 const data=await response.json().catch(()=>null);
 if(!response.ok){if(response.status===401){accessToken=null;throw new Error("Сеанс завершён. Войдите снова.");}throw new Error(data?.error||data?.msg||data?.message||"Сервис временно недоступен.");}
 return data;
}
function card(r){
 const a=el("article",undefined,"review-card");
 a.append(el("strong",r.name),el("time",new Date(r.created_at).toLocaleDateString("ru-RU")),el("p",r.body));
 return a;
}
let page=0;
async function publicReviews(){
 const list=$("#review-list");if(!list)return;
 const home=list.hasAttribute("data-featured"),limit=home?10:20;
 const status=$("#review-status");status.textContent="Загрузка…";
 try{
 const rows=await api("/rest/v1/reader_reviews?select=id,name,body,created_at&status=eq.approved"+(home?"&featured_slot=not.is.null&order=featured_slot.asc":"&order=created_at.desc,id.desc")+"&limit="+(limit+(!home?1:0))+"&offset="+(home?0:page*limit));
 list.replaceChildren(...rows.slice(0,limit).map(card));
 status.textContent=rows.length?"":"Одобренных отзывов пока нет.";
 if(!home){$("#previous").disabled=page===0;$("#next").disabled=rows.length<=limit;$("#page-number").textContent="Страница "+(page+1);}
 }catch{status.textContent="Не удалось загрузить отзывы. Попробуйте обновить страницу.";}
}
if($("#previous")){$("#previous").onclick=()=>{if(page>0){page--;publicReviews();}};$("#next").onclick=()=>{page++;publicReviews();};}
if($("#review-form")){
 const form=$("#review-form"),counter=$("#remaining");
 $("#review-body").oninput=()=>counter.textContent=([...$("#review-body").value].length)+" / 1000";
 form.onsubmit=async e=>{
 e.preventDefault();const status=$("#submission-status"),button=form.querySelector("button[type=submit]");
 const token=form.querySelector('[name="cf-turnstile-response"]')?.value;
 if(!token){status.textContent="Дождитесь проверки защиты от ботов.";return;}
 button.disabled=true;status.textContent="Отправка…";
 try{const result=await api("/functions/v1/submit-review",{method:"POST",body:JSON.stringify({name:$("#review-name").value,body:$("#review-body").value,website:$("#website").value,token})});status.textContent=result.message;form.reset();counter.textContent="0 / 1000";}
 catch(e){status.textContent=e.message;}
 finally{button.disabled=false;if(window.turnstile)window.turnstile.reset();}
 };
}
let adminPage=0;
function action(label,run){const b=el("button",label);b.type="button";b.onclick=async()=>{b.disabled=true;try{await run();$("#admin-status").textContent="Сохранено.";await loadAdmin();}catch(e){$("#admin-status").textContent=e.message;}finally{b.disabled=false;}};return b;}
async function change(r,status,slot=null){
 await api("/rest/v1/reader_reviews?id=eq."+r.id,{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify({status,featured_slot:slot})});
}
const statusNames={pending:"На модерации",approved:"Опубликован",rejected:"Отклонён"};
async function loadAdmin(){
 try{
 const filter=$("#status-filter").value;
 const rows=await api("/rest/v1/reader_reviews?select=*&order=created_at.desc,id.desc&limit=21&offset="+adminPage*20+(filter?"&status=eq."+filter:""));
 const cards=rows.slice(0,20).map(r=>{
 const a=card(r);a.append(el("p","Статус: "+statusNames[r.status]+(r.featured_slot?" · Главная: место "+r.featured_slot:""),"muted"));
 const buttons=el("div",undefined,"review-actions");
 if(r.status!=="approved")buttons.append(action("Опубликовать",()=>change(r,"approved")));
 if(r.status!=="rejected")buttons.append(action("Отклонить",()=>change(r,"rejected")));
 if(r.status==="approved"){
 buttons.append(action("Снять с публикации",()=>change(r,"pending")));
 const label=el("label","На главной: "),sel=el("select");sel.setAttribute("aria-label","Место избранного отзыва "+r.name);
 sel.append(new Option("Не показывать",""));for(let i=1;i<=10;i++)sel.append(new Option("Место "+i,i));
 sel.value=r.featured_slot||"";label.append(sel);buttons.append(label,action("Сохранить место",()=>change(r,"approved",sel.value?Number(sel.value):null)));
 }
 buttons.append(action("Удалить",async()=>{if(confirm("Удалить отзыв без возможности отмены? Сначала сохраните резервную копию, если он нужен."))await api("/rest/v1/reader_reviews?id=eq."+r.id,{method:"DELETE"});}));
 a.append(buttons);return a;
 });
 $("#admin-list").replaceChildren(...cards);$("#admin-empty").textContent=rows.length?"":"Отзывов с этим статусом нет.";
 $("#admin-prev").disabled=adminPage===0;$("#admin-next").disabled=rows.length<=20;$("#admin-page").textContent="Страница "+(adminPage+1);
 }catch(e){$("#admin-status").textContent=e.message;}
}
if($("#login-form")){
 $("#login-form").onsubmit=async e=>{
 e.preventDefault();$("#login-status").textContent="Вход…";const b=$("#login-button");b.disabled=true;
 try{
 const result=await api("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email:$("#email").value.trim(),password:$("#password").value})});
 accessToken=result.access_token;$("#password").value="";
 const membership=await api("/rest/v1/review_moderators?select=user_id");
 if(!membership.length){accessToken=null;throw new Error("Эта учётная запись не назначена модератором.");}
 $("#login-section").hidden=true;$("#admin-section").hidden=false;$("#login-status").textContent="";await loadAdmin();
 }catch(e){$("#login-status").textContent=e.message;}finally{b.disabled=false;}
 };
 $("#logout").onclick=async()=>{try{await api("/auth/v1/logout",{method:"POST"});}finally{accessToken=null;location.reload();}};
 $("#status-filter").onchange=()=>{adminPage=0;loadAdmin();};
 $("#admin-prev").onclick=()=>{if(adminPage>0){adminPage--;loadAdmin();}};
 $("#admin-next").onclick=()=>{adminPage++;loadAdmin();};
 $("#refresh").onclick=()=>loadAdmin();
 $("#backup").onclick=async()=>{
 const b=$("#backup");b.disabled=true;
 try{
 let all=[],offset=0;
 while(true){const rows=await api("/rest/v1/reader_reviews?select=*&order=created_at.asc,id.asc&limit=200&offset="+offset);all.push(...rows);if(rows.length<200)break;offset+=200;}
 const data={format:"architecture-reader-reviews-v1",exported_at:new Date().toISOString(),reviews:all};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=el("a");
 a.href=url;a.download="reader-reviews-"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 $("#admin-status").textContent="Резервная копия скачана: "+all.length+" отзывов.";
 }catch(e){$("#admin-status").textContent="Копия не создана: "+e.message;}finally{b.disabled=false;}
 };
 $("#password-form").onsubmit=async e=>{
 e.preventDefault();try{if($("#new-password").value.length<12)throw new Error("Используйте пароль не короче 12 символов.");await api("/auth/v1/user",{method:"PUT",body:JSON.stringify({password:$("#new-password").value})});$("#new-password").value="";$("#admin-status").textContent="Пароль изменён. Сохраните его в менеджере паролей.";}catch(e){$("#admin-status").textContent=e.message;}
 };
}
publicReviews();

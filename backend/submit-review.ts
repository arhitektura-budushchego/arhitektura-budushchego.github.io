
const origin = "https://arhitektura-budushchego.github.io";
const host = "arhitektura-budushchego.github.io";
const cors = {"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST, GET, OPTIONS","Access-Control-Allow-Headers":"content-type, apikey","Vary":"Origin","Cache-Control":"no-store"};
function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});}
Deno.serve(async(req:Request)=>{
 if(req.headers.get("origin")!==origin) return reply({error:"Недопустимый источник запроса."},403);
 if(req.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
 const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
 const base=Deno.env.get("SUPABASE_URL");
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(req.method==="GET") return reply({ready:Boolean(secret&&base&&service)});
 if(req.method!=="POST") return reply({error:"Метод не поддерживается."},405);
 if(!secret||!base||!service) return reply({error:"Приём отзывов пока не настроен."},503);
 try{
 if(!(req.headers.get("content-type")||"").startsWith("application/json")) return reply({error:"Требуется JSON."},415);
 let size=0;const parts:Uint8Array[]=[];const reader=req.body?.getReader();
 if(!reader) return reply({error:"Пустой запрос."},400);
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return reply({error:"Слишком большой запрос."},413);}parts.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}
 const data=JSON.parse(new TextDecoder().decode(bytes));
 if(typeof data.name!=="string"||typeof data.body!=="string"||typeof data.token!=="string") return reply({error:"Заполните имя и отзыв."},400);
 const name=data.name.trim(),body=data.body.trim();
 if([...name].length<1||[...name].length>80||[...body].length<1||[...body].length>1000||data.token.length>2048) return reply({error:"Имя — до 80 символов, отзыв — до 1000."},400);
 if(data.website) return reply({error:"Проверка не пройдена."},400);
 const check=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret,response:data.token}),signal:AbortSignal.timeout(10000)});
 const verified=await check.json();
 if(!check.ok||!verified.success||verified.hostname!==host||verified.action!=="review") return reply({error:"Пройдите проверку ещё раз."},400);
 const ip=(req.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret+"|"+ip)))).map(b=>b.toString(16).padStart(2,"0")).join("");
 const saved=await fetch(base+"/rest/v1/rpc/submit_verified_review",{method:"POST",headers:{"apikey":service,"Authorization":"Bearer "+service,"Content-Type":"application/json"},body:JSON.stringify({p_name:name,p_body:body,p_client_hash:hash}),signal:AbortSignal.timeout(10000)});
 if(!saved.ok){const err=await saved.text();if(err.includes("RATE_LIMIT"))return reply({error:"Лимит отправок достигнут. Попробуйте позже."},429);if(err.includes("STORAGE_LIMIT"))return reply({error:"Приём временно приостановлен: хранилище заполнено."},503);return reply({error:"Не удалось сохранить отзыв. Попробуйте позже."},503);}
 return reply({message:"Спасибо! Ваш отзыв отправлен на модерацию"},201);
 }catch{return reply({error:"Не удалось отправить отзыв. Попробуйте ещё раз."},503);}
});
'use strict';
const $ = id => document.getElementById(id);
const base = window.QR_FOREVER.API_BASE;
let adminKey = '';
let qrUrl = '';
if (base) { $('login').hidden=false;$('editor').hidden=true;$('admin-notice').textContent='Conectați-vă pentru a configura evenimente. Stocarea fotografiilor nu este conectată.';$('create-btn').textContent='Creează eveniment și cod QR'; }
async function api(path, method='GET', body) {
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+adminKey,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,credentials:'omit',cache:'no-store'});
  const data=await response.json();
  if(!response.ok) throw new Error(response.status===401?'Cheia de acces nu este validă.':'Operația nu a reușit: '+(data.error||response.status));
  return data;
}
async function listEvents(cursor='') {
  const data=await api('/admin/events'+(cursor?'?before='+encodeURIComponent(cursor):''));
  if(!cursor) $('event-list').replaceChildren();
  for(const event of data.events) {
    const card=document.createElement('article');card.className='event-item';
    const h=document.createElement('h3');h.textContent=event.name;
    const info=document.createElement('p');info.textContent=`${event.quotaBytes/1e9} GB · ${new Date(event.expiresAt).toLocaleDateString('ro-RO')} · ${event.disabled?'Dezactivat':'Configurat, fără stocare'}`;
    const button=document.createElement('button');button.className='btn btn-ghost';button.textContent=event.disabled?'Reactivează':'Dezactivează';
    button.onclick=async()=>{button.disabled=true;try{await api('/admin/events/'+event.id,'PATCH',{disabled:!event.disabled});await listEvents();}catch(e){$('admin-error').textContent=e.message;button.disabled=false;}};
    const edit=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Modifică detaliile';edit.append(summary);
    const form=document.createElement('form');
    const controls={};
    for(const [key,label,type,value] of [['name','Denumire','text',event.name],['quotaGB','Spațiu (GB)','number',event.quotaBytes/1e9],['expiresAt','Ultima zi de păstrare (UTC)','date',event.expiresAt.slice(0,10)]]){
      const field=document.createElement('label');field.className='field';field.textContent=label;const input=document.createElement('input');input.type=type;input.value=value;input.required=true;
      if(key==='quotaGB'){input.min='1';input.max='1000';input.step='1';}if(key==='name')input.maxLength=120;
      field.append(input);form.append(field);controls[key]=input;
    }
    const save=document.createElement('button');save.className='btn';save.textContent='Salvează modificările';form.append(save);
    form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await api('/admin/events/'+event.id,'PATCH',{name:controls.name.value.trim(),quotaGB:Number(controls.quotaGB.value),expiresAt:controls.expiresAt.value+'T23:59:59.999Z'});await listEvents();}catch(error){$('admin-error').textContent=error.message;save.disabled=false;}};
    edit.append(form);card.append(h,info,button,edit);$('event-list').append(card);
  }
  if(!data.events.length) $('event-list').textContent='Nu sunt evenimente configurate.';
  if(data.nextCursor){const more=document.createElement('button');more.className='btn btn-ghost';more.textContent='Mai multe evenimente';more.onclick=async()=>{more.disabled=true;try{await listEvents(data.nextCursor);more.remove();}catch(error){$('admin-error').textContent=error.message;more.disabled=false;}};$('event-list').append(more);}
  $('events').hidden=false;
}
$('login-form').onsubmit=async e=>{e.preventDefault();adminKey=$('admin-key').value;$('admin-error').textContent='';try{await listEvents();$('admin-key').value='';$('login').hidden=true;$('editor').hidden=false;}catch(error){adminKey='';$('admin-error').textContent=error.message;}};
$('logout').onclick=()=>{adminKey='';$('editor').hidden=true;$('events').hidden=true;$('login').hidden=false;$('qr-result').hidden=true;};
$('event-form').onsubmit=async e=>{
  e.preventDefault();$('admin-error').textContent='';
  const name=$('name').value.trim(), eventDate=$('date').value,quotaGB=Number($('quota').value),retentionDays=Number($('retention').value);
  if(!name){$('name').setCustomValidity('Introduceți denumirea evenimentului.');$('name').reportValidity();return;}
  const expiry=new Date(eventDate+'T23:59:59.999Z');expiry.setUTCDate(expiry.getUTCDate()+retentionDays);
  if(expiry.getTime()<=Date.now()){ $('admin-error').textContent='Perioada de păstrare trebuie să se încheie în viitor.';return; }
  $('create-btn').disabled=true;
  try {
    let url;
    if(base){const result=await api('/admin/events','POST',{name,eventDate,quotaGB,retentionDays});url=new URL('/album.html',location.origin);url.hash=new URLSearchParams({event:result.guestToken}).toString();}
    else{url=new URL('/album.html',location.origin);url.hash=new URLSearchParams({preview:'1',id:crypto.randomUUID(),name,quota:String(quotaGB),expires:expiry.toISOString()}).toString();}
    const qr=qrcode(0,'M');qr.addData(url.href);qr.make();
    const svg=qr.createSvgTag({cellSize:4,margin:16,scalable:true});$('qr').innerHTML=svg;
    if(qrUrl) URL.revokeObjectURL(qrUrl);qrUrl=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    $('download-qr').href=qrUrl;$('guest-link').href=url.href;$('guest-link').textContent=url.href;
    $('qr-title').textContent=name;$('qr-label').textContent=base?'Păstrați linkul acum; cheia de acces a invitaților nu se afișează din nou. Albumul nu primește fotografii până la activare.':'QR DEMONSTRATIV — nu utilizați la eveniment. Previzualizarea nu salvează date și nu rezervă spațiu.';
    $('qr-result').hidden=false;$('qr-result').scrollIntoView({behavior:'smooth'});
  } catch(error){$('admin-error').textContent=error.message;}finally{$('create-btn').disabled=false;}
};
$('name').oninput=()=>$('name').setCustomValidity('');
$('print-qr').onclick=()=>window.print();
$('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText($('guest-link').href);$('copy-link').textContent='Copiat';}catch{$('admin-error').textContent='Selectați și copiați linkul afișat.';}};

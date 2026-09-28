'use strict';
window.QROrder = (() => {
  const plans = Object.freeze({esential:{name:'Esențial',price:29,gift:10,photos:100,days:7},amintiri:{name:'Amintiri',price:69,gift:20,photos:500,days:15},poveste:{name:'Poveste',price:99,gift:40,photos:null,days:60}});
  const key='qr-forever-order-v2';
  const money = value => value.toLocaleString('ro-RO')+' €';
  function normalize(raw) {
    if(!raw||!Object.hasOwn(plans,raw.plan)||!Number.isInteger(raw.stands)||raw.stands<0||raw.stands>99||typeof raw.gift!=='boolean'||!/^[-a-f0-9]{36}$/i.test(raw.id||''))throw Error('Cererea nu este validă. Completați din nou formularul.');
    const fields={};
    for(const [name,max] of Object.entries({mireasa:80,mire:80,eveniment:120,locatia:200,data:10,adresa:300,email:254,telefon:30,mesaj:2000})) {
      fields[name]=String(raw.fields?.[name]||'').trim().slice(0,max);
    }
    if(!fields.eveniment||!fields.locatia||!/^\S+@\S+\.\S+$/.test(fields.email)||!/^\d{4}-\d\d-\d\d$/.test(fields.data)||!Number.isFinite(Date.parse(fields.data)))throw Error('Verificați evenimentul, locația, data și emailul.');
    if(raw.gift||raw.stands){if(!fields.adresa)throw Error('Completați adresa de livrare.');}else fields.adresa='';
    return {id:raw.id,plan:raw.plan,stands:raw.stands,gift:raw.gift,fields,at:raw.at||Date.now(),confirmed:raw.confirmed===true,method:raw.method==='mia'?'mia':'card'};
  }
  function save(order){sessionStorage.setItem(key,JSON.stringify(order));}
  function load(){try{const raw=JSON.parse(sessionStorage.getItem(key));if(!raw||!Number.isFinite(raw.at)||Date.now()-raw.at>86400000||raw.at>Date.now()+60000)return null;return normalize(raw);}catch{return null;}}
  function payload(order) {
    const p=plans[order.plan];
    return {'Referinta cererii':order.id,'Eveniment':order.fields.eveniment,'Locatia evenimentului':order.fields.locatia,'Data evenimentului':order.fields.data,'Numele miresei':order.fields.mireasa,'Numele mirelui':order.fields.mire,email:order.fields.email,'Telefon':order.fields.telefon,'Observatii':order.fields.mesaj,'Plan':p.name,'Pret plan EUR':p.price,'Limita fotografii':p.photos??'Nelimitat','Link activ zile dupa eveniment':p.days,'Stickere cadou':order.gift?p.gift:0,'Suporturi':order.stands,'Pret suport EUR':8,'Adresa de livrare':order.fields.adresa||'Nu sunt materiale fizice','Total estimat EUR':p.price+order.stands*8,'Livrare':'Cost si disponibilitate de confirmat separat','Status plata':'NEPLATIT - nicio plata procesata online'};
  }
  async function send(data,subject){
    const response=await fetch('https://formsubmit.co/ajax/danscutari04@gmail.com',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},referrerPolicy:'strict-origin-when-cross-origin',body:JSON.stringify({...data,_subject:subject,_template:'table'}),signal:AbortSignal.timeout(25000)});
    const result=await response.json();
    if(!response.ok||!(result.success===true||result.success==='true'))throw Error('Trimiterea nu a fost confirmată. Încercați din nou sau scrieți la danscutari04@gmail.com.');
  }
  return {plans,money,normalize,save,load,payload,send,key};
})();

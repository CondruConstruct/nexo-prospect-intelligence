'use strict';
(() => {
 const Q=window.QROrder,$=id=>document.getElementById(id),form=$('req-form');
 let busy=false,requestId=crypto.randomUUID();
 const plan=()=>form.querySelector('input[name=plan]:checked').value;
 function stands(){const n=Number($('suporturi-input').value);return Number.isInteger(n)&&n>=0&&n<=99?n:0;}
 function refresh(){
   const p=Q.plans[plan()],n=stands(),physical=$('gift').checked||n>0;
   $('gift-n').textContent=p.gift;$('st-out').textContent=n;
   $('st-minus').disabled=n===0;$('st-plus').disabled=n===99;
   $('st-line').textContent=n?`${n} suporturi × 8 € = ${Q.money(n*8)}`:'Fără suporturi de masă selectate.';
   $('delivery').hidden=!physical;$('adresa').required=physical;$('adresa').disabled=!physical;
   $('summary').textContent=`${p.name}: ${Q.money(p.price)} · ${$('gift').checked?p.gift:0} stickere cadou · ${n} suporturi: ${Q.money(n*8)}. Total estimat: ${Q.money(p.price+n*8)}. Livrarea se confirmă separat.`;
   document.querySelectorAll('[data-plan]').forEach(a=>{const selected=a.dataset.plan===plan();a.closest('.plan').dataset.selected=selected;a.setAttribute('aria-label',`${selected?'Selectat: ': 'Alege '}${Q.plans[a.dataset.plan].name}`);});
 }
 const today=new Date();$('data').min=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 function setStands(n){$('suporturi-input').value=Math.max(0,Math.min(99,n));refresh();}
 $('st-plus').onclick=()=>setStands(stands()+1);$('st-minus').onclick=()=>setStands(stands()-1);
 document.querySelectorAll('.chips button').forEach(b=>b.onclick=()=>setStands(Number(b.dataset.n)));
 $('suporturi-input').addEventListener('input',refresh);$('gift').onchange=refresh;
 form.querySelectorAll('[name=plan]').forEach(i=>i.onchange=refresh);
 document.querySelectorAll('[data-plan]').forEach(a=>a.addEventListener('click',()=>{form.querySelector(`[name=plan][value=${a.dataset.plan}]`).checked=true;refresh();}));
 const stored=Q.load();
 if(stored){requestId=stored.confirmed?crypto.randomUUID():stored.id;for(const [name,value] of Object.entries(stored.fields)){if(form.elements[name])form.elements[name].value=value;}form.querySelector(`[name=plan][value=${stored.plan}]`).checked=true;$('gift').checked=stored.gift;$('suporturi-input').value=stored.stands;}
 refresh();
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  $('status').className='status';$('status').textContent='';
  if(!form.reportValidity())return;
  if(form.elements._honey.value)return;
  busy=true;$('submit').disabled=true;$('submit').textContent='Se trimite…';
  try{
   const fields=Object.fromEntries(new FormData(form));
   const order=Q.normalize({id:requestId,plan:plan(),stands:Number($('suporturi-input').value),gift:$('gift').checked,fields,at:Date.now()});
   try{Q.save(order);}catch{throw Error('Permiteți stocarea pentru această filă pentru a continua sau scrieți la danscutari04@gmail.com.');}
   await Q.send(Q.payload(order),'QR Forever — cerere eveniment '+order.id);
   location.assign('/plata.html');
  }catch(error){$('status').className='status err';$('status').textContent=error.name==='TimeoutError'?'Confirmarea trimiterii întârzie. Verificați conexiunea; la reîncercare păstrăm aceeași referință.':error.message;$('status').scrollIntoView({block:'center',behavior:'smooth'});}
  finally{busy=false;$('submit').disabled=false;$('submit').textContent='Trimite și continuă';}
 });
 $('submit').disabled=false;
})();

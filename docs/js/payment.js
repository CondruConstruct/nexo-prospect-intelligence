'use strict';
(() => {
 const Q=window.QROrder,$=id=>document.getElementById(id),order=Q.load();
 if(!order){$('missing-order').hidden=false;return;}
 if(order.confirmed){location.replace('/multumim.html');return;}
 $('order-grid').hidden=false;const p=Q.plans[order.plan];
 $('order-event').textContent=order.fields.eveniment;$('order-reference').textContent=order.id;
 $('plan').textContent=p.name;$('planPrice').textContent=Q.money(p.price);$('stands').textContent=order.stands+' buc.';$('standsPrice').textContent=Q.money(order.stands*8);$('stickers').textContent=(order.gift?p.gift:0)+' buc.';$('total').textContent=Q.money(p.price+order.stands*8);
 let method='card',busy=false;
 document.querySelectorAll('.method').forEach(button=>button.onclick=()=>{method=button.dataset.method;document.querySelectorAll('.method').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});$('cardPanel').hidden=method!=='card';$('miaPanel').hidden=method!=='mia';});
 $('confirm-order').onclick=async()=>{
  if(busy)return;busy=true;$('confirm-order').disabled=true;$('confirm-order').textContent='Se trimite…';$('payment-status').textContent='';
  try{
   await Q.send({...Q.payload(order),'Preferinta plata':method==='mia'?'MIA (de confirmat de administrator)':'Card bancar (de confirmat de administrator)'},'QR Forever — confirmare cerere '+order.id);
   order.confirmed=true;order.method=method;try{Q.save(order);}catch{/* Email is accepted; do not invite a duplicate retry for a browser-storage error. */}location.assign('/multumim.html');
  }catch(error){$('payment-status').textContent=error.name==='TimeoutError'?'Confirmarea întârzie. Încercați din nou; referința cererii rămâne aceeași.':'Nu am primit confirmarea trimiterii. Încercați din nou sau scrieți la danscutari04@gmail.com.';}
  finally{busy=false;$('confirm-order').disabled=false;$('confirm-order').textContent='Confirmă cererea';}
 };
})();

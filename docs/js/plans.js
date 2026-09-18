'use strict';
(() => {
  const buttons = [...document.querySelectorAll('.choose-plan')];
  function selectPlan(button, scroll) {
    document.getElementById('plan-' + button.dataset.plan).checked = true;
    for (const other of buttons) {
      const selected = other === button;
      other.setAttribute('aria-pressed', String(selected));
      other.textContent = selected ? 'Ales ✓' : 'Alege';
    }
    document.getElementById('selected-plan').textContent = 'Plan ales: ' + button.dataset.name + '. Apăsați „Trimite” pentru a confirma alegerea.';
    if (scroll) {
      const send = document.getElementById('send-plan');
      send.focus({ preventScroll: true });
      send.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    }
  }
  for (const button of buttons) {
    button.addEventListener('click', () => selectPlan(button, true));
    document.getElementById('plan-' + button.dataset.plan).addEventListener('change', () => selectPlan(button, false));
  }
  const request = new URLSearchParams(location.search).get('request');
  const validId = request && /^[a-f0-9-]{36}$/i.test(request) ? request : '';
  document.getElementById('plan-request-id').value = validId || crypto.randomUUID();
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem('qr-request')); } catch { /* Manual fields remain available. */ }
  if (!saved || !saved.fields || Date.now()-saved.at > 86400000 || saved.fields['Referinta cererii'] !== validId) return;
  const fields = saved.fields;
  for (const [id,name] of [['plan-email','email'],['plan-event','Eveniment'],['plan-location','Locatia evenimentului']]) document.getElementById(id).value = fields[name] || '';
  for (const name of ['Numele miresei','Numele mirelui','Data evenimentului','Telefon','Detalii']) {
    if (typeof fields[name] !== 'string') continue;
    const input = document.createElement('input'); input.type='hidden'; input.name=name; input.value=fields[name];document.getElementById('retained-fields').append(input);
  }
  document.getElementById('contact-note').textContent = 'Am preluat detaliile din cererea voastră. Verificați-le înainte de confirmare.';
})();

'use strict';
document.getElementById('request-form').addEventListener('submit', () => {
  const form = document.getElementById('request-form');
  const id = document.getElementById('request-id');
  if (!id.value) id.value = crypto.randomUUID();
  form.elements._next.value = 'https://jbpsuport.online/planuri.html?request=' + encodeURIComponent(id.value);
  const fields = {};
  for (const [name,value] of new FormData(form)) if (!name.startsWith('_')) fields[name] = value;
  try { sessionStorage.setItem('qr-request', JSON.stringify({at:Date.now(),fields})); } catch { /* Plan page offers manual contact fields. */ }
});

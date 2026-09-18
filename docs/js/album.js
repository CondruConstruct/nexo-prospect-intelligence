'use strict';
window.addEventListener('hashchange', () => location.reload());
(async () => {
  const params = new URLSearchParams(location.hash.slice(1));
  const notice = document.getElementById('album-notice');
  const title = document.getElementById('event-title');
  const details = document.getElementById('event-details');
  let event;
  if (params.get('preview') === '1') {
    const name = params.get('name');
    const quota = Number(params.get('quota'));
    const expiry = new Date(params.get('expires'));
    if (!name || name.length > 120 || !Number.isInteger(quota) || quota < 1 || quota > 1000 || !Number.isFinite(expiry.getTime())) {
      notice.textContent = 'Linkul de previzualizare nu este valid. Cereți organizatorului un link nou.'; return;
    }
    event = { name, quotaBytes: quota * 1e9, expiresAt: expiry.toISOString() };
    notice.textContent = 'Previzualizare demonstrativă. Acesta nu este un album activ; nu se încarcă și nu se salvează fotografii.';
  } else {
    const token = params.get('event');
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      notice.textContent = 'Linkul albumului lipsește sau nu este valid. Folosiți codul QR primit de la organizator.'; return;
    }
    if (!window.QR_FOREVER.API_BASE) {
      notice.textContent = 'Albumul nu este activ încă. Contactați organizatorul pentru confirmarea activării.'; return;
    }
    try {
      const response = await fetch(window.QR_FOREVER.API_BASE + '/events/' + token, {credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
      if (!response.ok) throw new Error(response.status === 410 ? 'Albumul a expirat sau a fost dezactivat.' : 'Albumul nu este disponibil. Verificați linkul cu organizatorul.');
      event = (await response.json()).event;
      notice.textContent = 'Album configurat. Încărcarea și descărcarea vor fi disponibile după conectarea stocării.';
    } catch(error) { notice.textContent = error.message; return; }
  }
  title.textContent = event.name;
  details.textContent = `${event.quotaBytes / 1e9} GB alocați · Păstrare până la ${new Date(event.expiresAt).toLocaleDateString('ro-RO',{timeZone:'UTC'})} (UTC)`;
  if (Date.parse(event.expiresAt) <= Date.now()) { notice.textContent = 'Perioada acestui album a expirat. Contactați organizatorul.'; return; }
  document.getElementById('album-content').hidden = false;
  const tabs = ['photos','upload'];
  function select(id) { tabs.forEach(t=>{ document.getElementById(t).hidden=t!==id; const b=document.getElementById('tab-'+t);b.setAttribute('aria-selected',String(t===id));b.tabIndex=t===id?0:-1; }); }
  tabs.forEach(id => {const b=document.getElementById('tab-'+id);b.onclick=()=>select(id);b.onkeydown=e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'photos':e.key==='End'?'upload':tabs.find(t=>t!==id);select(next);document.getElementById('tab-'+next).focus();}};});
  select('photos');
})();

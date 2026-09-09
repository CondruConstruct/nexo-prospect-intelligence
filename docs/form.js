(() => {
  const form = document.querySelector('#research-form');
  if (!form) return;
  const ro = document.documentElement.lang === 'ro';
  const status = document.querySelector('#form-status');
  const button = form.querySelector('button');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    button.disabled = true;
    status.textContent = ro ? 'Se transmite solicitarea…' : 'Sending your enquiry…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const data = Object.fromEntries(new FormData(form));
      data._url = location.href;
      const response = await fetch('https://formsubmit.co/ajax/condru01@gmail.com', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data), signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || ![true, 'true'].includes(result.success)) throw new Error('Submission not accepted');
      if (/activat|confirm.*email/i.test(result.message || '')) {
        status.textContent = ro ? 'Formularul necesită activarea adresei destinatarului. Trimiteți solicitarea direct la condru01@gmail.com.' : 'This form needs recipient email activation. Please send your enquiry directly to condru01@gmail.com.';
      } else {
        status.textContent = ro ? 'Serviciul de formulare a acceptat solicitarea pentru procesare. Aceasta nu reprezintă confirmarea unei comenzi sau plăți. Pentru confirmare directă, scrieți la condru01@gmail.com.' : 'The form service accepted your enquiry for processing. This is not an order or payment confirmation. For direct confirmation, email condru01@gmail.com.';
        form.reset();
      }
    } catch {
      status.textContent = ro ? 'Nu putem confirma transmiterea. Datele au rămas în formular. Încercați din nou sau scrieți la condru01@gmail.com.' : 'We could not confirm submission. Your details are still in the form. Please retry or email condru01@gmail.com.';
    } finally {
      clearTimeout(timer);
      button.disabled = false;
    }
  });
})();

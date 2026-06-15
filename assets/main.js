const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('v'); obs.unobserve(e.target); }});
}, {threshold: 0.1});
document.querySelectorAll('.fi').forEach(el => obs.observe(el));

document.getElementById('contact-form').addEventListener('submit', function(e) {
  e.preventDefault();

  const fields = [
    {id:'inp-name',  wrap:'f-name',  msg:'Votre prénom est requis'},
    {id:'inp-phone', wrap:'f-phone', msg:'Votre téléphone est requis'},
    {id:'inp-garage',wrap:'f-garage',msg:'Le nom du garage est requis'},
    {id:'inp-rdv',   wrap:'f-rdv',   msg:'Veuillez choisir une option'},
    {id:'inp-gdpr',  wrap:'f-gdpr',  checkbox:true, msg:'Vous devez accepter pour continuer'}
  ];
  let ok = true;
  fields.forEach(f => {
    const el  = document.getElementById(f.id);
    const wr  = document.getElementById(f.wrap);
    const err = document.getElementById(f.id + '-error');
    const invalid = f.checkbox ? !el.checked : !el.value.trim();
    if (invalid) {
      wr.classList.add('error');
      if (err) err.textContent = f.msg;
      el.addEventListener('input',  () => { wr.classList.remove('error'); if(err) err.textContent = ''; }, {once:true});
      el.addEventListener('change', () => { wr.classList.remove('error'); if(err) err.textContent = ''; }, {once:true});
      ok = false;
    }
  });
  if (!ok) return;

  const btn = document.getElementById('form-btn');
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 10000);

  fetch('/submit.php', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    signal: ctrl.signal,
    body: JSON.stringify({
      name:   document.getElementById('inp-name').value.trim(),
      phone:  document.getElementById('inp-phone').value.trim(),
      garage: document.getElementById('inp-garage').value.trim(),
      rdv:    document.getElementById('inp-rdv').value,
      gdpr:   document.getElementById('inp-gdpr').checked
    })
  }).then(r => {
    clearTimeout(timeout);
    if (!r.ok) throw new Error('server');
    document.getElementById('contact-form').style.display = 'none';
    document.getElementById('form-success').style.display = 'block';
  }).catch(() => {
    clearTimeout(timeout);
    btn.disabled = false;
    btn.textContent = 'Réessayer';
    document.getElementById('form-error').style.display = 'block';
  });
});

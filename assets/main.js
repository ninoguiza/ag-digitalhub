const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('v'); obs.unobserve(e.target); }});
}, {threshold: 0.1});
document.querySelectorAll('.fi').forEach(el => obs.observe(el));

// Marquer les SVGs décoratifs comme masqués aux lecteurs d'écran
document.querySelectorAll('svg:not([aria-label]):not([role="img"])').forEach(s => {
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
});

// Respecter prefers-reduced-motion : stopper la vidéo autoplay
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.demo-video').forEach(v => {
    v.pause();
    v.removeAttribute('autoplay');
  });
}

// Bouton pause / lecture vidéo démo — DOM pur, pas de innerHTML
const vidToggle = document.getElementById('vid-toggle');
const demoVideo = document.querySelector('.demo-video');
if (vidToggle && demoVideo) {
  const iconPause = vidToggle.querySelector('.icon-pause');
  const iconPlay  = vidToggle.querySelector('.icon-play');
  vidToggle.addEventListener('click', () => {
    if (demoVideo.paused) {
      demoVideo.play();
      vidToggle.setAttribute('aria-label', 'Mettre en pause la vidéo');
      if (iconPause) iconPause.style.display = '';
      if (iconPlay)  iconPlay.style.display  = 'none';
    } else {
      demoVideo.pause();
      vidToggle.setAttribute('aria-label', 'Lancer la vidéo');
      if (iconPause) iconPause.style.display = 'none';
      if (iconPlay)  iconPlay.style.display  = '';
    }
  });
}

document.getElementById('contact-form').addEventListener('submit', function(e) {
  e.preventDefault();

  // Validation email optionnel
  const emailEl  = document.getElementById('inp-email');
  const emailWr  = document.getElementById('f-email');
  const emailErr = document.getElementById('inp-email-error');
  if (emailEl && emailEl.value.trim() !== '') {
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(emailEl.value.trim())) {
      if (emailWr)  emailWr.classList.add('error');
      if (emailErr) emailErr.textContent = 'Adresse email invalide';
      emailEl.addEventListener('input', () => { emailWr?.classList.remove('error'); if (emailErr) emailErr.textContent = ''; }, {once:true});
      return;
    }
  }

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
  btn.setAttribute('aria-busy', 'true');
  btn.setAttribute('aria-label', 'Envoi en cours, veuillez patienter');

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 10000);

  fetch('/submit.php', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    signal: ctrl.signal,
    body: JSON.stringify({
      name:   document.getElementById('inp-name').value.trim(),
      phone:  document.getElementById('inp-phone').value.trim(),
      email:  (document.getElementById('inp-email')?.value || '').trim(),
      garage: document.getElementById('inp-garage').value.trim(),
      rdv:    document.getElementById('inp-rdv').value,
      gdpr:   document.getElementById('inp-gdpr').checked
    })
  }).then(r => {
    clearTimeout(timeout);
    if (!r.ok) throw new Error('server');
    document.getElementById('contact-form').style.display = 'none';
    document.getElementById('form-error').style.display = 'none';
    document.getElementById('form-success').style.display = 'block';
  }).catch(() => {
    clearTimeout(timeout);
    btn.disabled = false;
    btn.textContent = 'Réessayer';
    btn.removeAttribute('aria-busy');
    btn.removeAttribute('aria-label');
    document.getElementById('form-error').style.display = 'block';
  });
});

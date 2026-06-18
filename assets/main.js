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

// Chat widget
(function(){
  var btn=document.getElementById('chat-btn'),panel=document.getElementById('chat-panel'),
      msgs=document.getElementById('chat-messages'),input=document.getElementById('chat-input'),
      send=document.getElementById('chat-send'),closeBtn=document.getElementById('chat-close-btn');
  if(!btn)return;
  var chatHistory=[],isOpen=false,busy=false,welcomed=false;
  function toggleChat(){
    isOpen=!isOpen;
    panel.classList.toggle('open',isOpen);
    panel.setAttribute('aria-hidden',String(!isOpen));
    btn.setAttribute('aria-expanded',String(isOpen));
    if(isOpen){
      if(!welcomed){welcomed=true;addBot('Bonjour ! Je suis l\'assistant Garage.RDV. Comment puis-je vous aider ?');}
      setTimeout(function(){input.focus();},80);
    }else{btn.focus();}
  }
  function addMsg(text,role){
    var d=document.createElement('div');d.className='msg '+role;
    var b=document.createElement('div');b.className='msg-bubble';b.textContent=text;
    d.appendChild(b);msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;
  }
  function addBot(t){addMsg(t,'bot');}
  function addUser(t){addMsg(t,'user');}
  function showTyping(){
    var d=document.createElement('div');d.className='msg bot';d.id='chat-typing';
    var typing=document.createElement('div');typing.className='msg-typing';
    for(var i=0;i<3;i++){typing.appendChild(document.createElement('span'));}
    d.appendChild(typing);msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;
  }
  function hideTyping(){var t=document.getElementById('chat-typing');if(t)t.remove();}
  function sendMsg(){
    var text=input.value.trim();
    if(!text||busy)return;
    input.value='';busy=true;send.disabled=true;
    addUser(text);
    var prevHistory=chatHistory.slice(-8);
    chatHistory.push({role:'user',content:text});
    showTyping();
    var xhr=new XMLHttpRequest();
    xhr.open('POST','/chat-proxy.php',true);
    xhr.setRequestHeader('Content-Type','application/json');
    xhr.timeout=28000;
    xhr.onload=function(){
      hideTyping();
      var reply='Je suis momentanément indisponible. Utilisez le formulaire.';
      try{reply=JSON.parse(xhr.responseText).reply||reply;}catch(e){}
      addBot(reply);chatHistory.push({role:'assistant',content:reply});
      busy=false;send.disabled=false;input.focus();
    };
    xhr.onerror=xhr.ontimeout=function(){
      hideTyping();
      addBot('Connexion impossible. Veuillez réessayer ou utiliser le formulaire ci-dessous.');
      busy=false;send.disabled=false;
    };
    xhr.send(JSON.stringify({message:text,history:prevHistory}));
  }
  btn.addEventListener('click',toggleChat);
  closeBtn.addEventListener('click',toggleChat);
  send.addEventListener('click',sendMsg);
  input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen){toggleChat();}});
})();

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

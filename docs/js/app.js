// Apex Surge — navigation engine
const screensEl = document.getElementById('screens');
const tabbarEl = document.getElementById('tabbar');
const captionEl = document.getElementById('stageCaption');

function bindGoButtons(){ /* no-op: navigation uses event delegation, kept for readability in screens.js */ }

function go(id, opts={}){
  if(!SCREENS[id]) { console.warn('Unknown screen', id); return; }
  const cur = STATE.nav.current;
  if(!opts.root && !opts.replace && cur && cur !== id){
    STATE.nav.stack.push(cur);
  }
  if(opts.root){
    STATE.nav.stack = [];
  }
  STATE.nav.current = id;
  save();
  renderScreen(id);
}

function goBack(){
  const prev = STATE.nav.stack.pop();
  if(prev){
    STATE.nav.current = prev;
    save();
    renderScreen(prev);
  } else {
    // fall back to nearest tab root
    const s = SCREENS[STATE.nav.current];
    if(!s || !s.tab) go('today', {root:true});
  }
}

function renderScreen(id){
  const def = SCREENS[id];
  if(!def) return;
  const wrap = document.createElement('div');
  wrap.className = 'screen active';
  wrap.innerHTML = def.render();
  screensEl.innerHTML = '';
  screensEl.appendChild(wrap);
  screensEl.scrollTop = 0;
  if(def.after) def.after(wrap);

  // tab bar visibility + active state
  if(def.tab){
    tabbarEl.classList.add('visible');
    tabbarEl.querySelectorAll('.tab').forEach(t=>{
      t.classList.toggle('active', t.dataset.tab === def.tab);
    });
  } else {
    tabbarEl.classList.remove('visible');
  }

  captionEl.textContent = `Screen: ${id}${STATE.nav.stack.length ? '  ·  depth ' + STATE.nav.stack.length : ''}`;
}

// ---- global click delegation ----
screensEl.addEventListener('click', (e)=>{
  const backBtn = e.target.closest('[data-back]');
  if(backBtn){ goBack(); return; }

  const goBtn = e.target.closest('[data-go]');
  if(goBtn){
    const id = goBtn.dataset.go;
    const root = goBtn.dataset.root === '1';
    go(id, { root });
  }
});

// ---- tab bar ----
tabbarEl.addEventListener('click', (e)=>{
  const tab = e.target.closest('.tab');
  if(!tab) return;
  go(tab.dataset.tab, { root:true });
});

// ---- sidebar flow picker ----
document.querySelectorAll('.flow-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    go(btn.dataset.jump, { root:true });
  });
});

document.getElementById('resetProto').addEventListener('click', ()=>{
  if(confirm('Reset all prototype progress and return to the splash screen?')){
    resetState();
    renderScreen('splash');
    tabbarEl.classList.remove('visible');
  }
});

// ---- boot ----
(function boot(){
  const start = STATE.nav.current && SCREENS[STATE.nav.current] ? STATE.nav.current : 'splash';
  renderScreen(start);
})();

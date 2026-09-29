/* Compound — PWA frontend. Single-file SPA wired to the PHP API. */
(function () {
'use strict';
var API = (window.COMPOUND_CONFIG && window.COMPOUND_CONFIG.API_BASE) || '/api';
var TOKEN_KEY = 'compound_token';

var state = {
  token: localStorage.getItem(TOKEN_KEY) || null,
  user: null,
  onboarding: { goal: 'Communication', focus_areas: [], target: '30d', role: '', level: '', daily_minutes: 10, format: 'both' },
  home: null, pathId: null, lastQuiz: { score: 0, total: 0 },
  reader: null, quiz: null, proofs: [], recorder: null, recStream: null
};

/* ---------- utilities ---------- */
function $(s, r) { return (r || document).querySelector(s); }
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
  return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function toast(msg) { var t = el('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600); }

function reducedMotion() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
function haptic(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) {} }
/* confetti burst for wins (lesson done, great quiz, plan ready) */
function celebrate() {
  if (reducedMotion()) return;
  var box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
  var colors = ['var(--brand)', 'var(--grow)', 'var(--amber)', '#FF7AA2', '#46B5FF'];
  for (var i = 0; i < 28; i++) {
    var c = document.createElement('i');
    c.style.left = (Math.random() * 100) + '%';
    c.style.background = colors[i % colors.length];
    c.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
    c.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    c.style.animationDelay = (Math.random() * 0.25) + 's';
    if (i % 3 === 0) c.style.borderRadius = '50%';
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(function () { box.remove(); }, 2200);
}
function api(path, opts) {
  opts = opts || {};
  var headers = opts.headers || {};
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  var body = opts.body;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  return fetch(API + '/' + path, { method: opts.method || 'GET', headers: headers, body: body })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (data) {
      if (!r.ok) throw { status: r.status, data: data }; return data; }); });
}

/* ---------- navigation ---------- */
var histStack = [];
function show(id, opts) {
  opts = opts || {};
  if (typeof audio !== 'undefined' && audio.playing) stopAudio(); // leaving the screen stops narration
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
  if (!opts.replace) { if (histStack[histStack.length - 1] !== id) histStack.push(id); }
  var sc = $('#' + id + ' .scroll'); if (sc) sc.scrollTop = 0;
  window.scrollTo(0, 0);
}
function back() { if (histStack.length > 1) { histStack.pop(); show(histStack[histStack.length - 1], { replace: true }); } else show('s-home', { replace: true }); }

/* ---------- selection (onboarding) ---------- */
document.addEventListener('click', function (e) {
  var goEl = e.target.closest('[data-go]');
  if (goEl) { show(goEl.getAttribute('data-go')); return; }
  var opt = e.target.closest('.choice, .seg');
  if (opt && opt.closest('[data-field]')) {
    var group = opt.closest('[data-field]');
    if (group.hasAttribute('data-single')) {
      group.querySelectorAll('[aria-checked]').forEach(function (c) { c.setAttribute('aria-checked', 'false'); });
      opt.setAttribute('aria-checked', 'true');
    } else {
      opt.setAttribute('aria-checked', opt.getAttribute('aria-checked') === 'true' ? 'false' : 'true');
    }
  }
});

function collectOnboarding() {
  document.querySelectorAll('[data-field]').forEach(function (g) {
    var field = g.dataset.field;
    if (g.hasAttribute('data-single')) {
      var sel = g.querySelector('[aria-checked="true"]');
      var v = sel ? sel.dataset.val : null;
      if (field === 'daily_minutes') v = parseInt(v || '10', 10);
      if (v != null) state.onboarding[field] = v;
    } else {
      state.onboarding[field] = Array.prototype.map.call(
        g.querySelectorAll('[aria-checked="true"]'), function (x) { return x.dataset.val; });
    }
  });
}

/* ---------- boot ---------- */
function sessionExpired() {
  state.token = null; localStorage.removeItem(TOKEN_KEY);
  toast('Your session expired. Please sign in again.');
  show('s-email', { replace: true });
}
function boot() {
  if (!state.token) { show('s-welcome', { replace: true }); return; }
  api('auth/me').then(function (d) {
    state.user = d.user;
    if (d.onboarding) state.onboarding = Object.assign(state.onboarding, d.onboarding);
    if (d.onboarded) { loadHome().then(function () { show('s-home', { replace: true }); }); }
    else { show('s-welcome', { replace: true }); }
  }).catch(function () { state.token = null; localStorage.removeItem(TOKEN_KEY); show('s-welcome', { replace: true }); });
}

/* ---------- auth flow ---------- */
el('finishOnboarding').addEventListener('click', function () {
  collectOnboarding();
  if (state.token) { submitOnboarding(); } else { show('s-email'); setTimeout(function () { el('emailInput').focus(); }, 100); }
});

el('sendCodeBtn').addEventListener('click', function () { requestCode(); });
el('emailInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') requestCode(); });

function authErr(e, fallback) {
  var d = (e && e.data) || {};
  switch (d.error) {
    case 'invalid_email': return 'Enter a valid email.';
    case 'email_send_failed': return 'We couldn\u2019t send the email. Check the address or try again in a minute.';
    case 'too_many_requests': return 'Too many tries. Please wait ' + (d.retry_after >= 120 ? Math.round(d.retry_after / 60) + ' minutes' : 'a minute') + '.';
    case 'code_expired': return 'This code has expired. Tap \u201cResend code\u201d for a new one.';
    case 'too_many_attempts': return 'Too many wrong tries. Tap \u201cResend code\u201d for a new one.';
    case 'wrong_code': return 'That code isn\u2019t right.' + (d.attempts_left ? ' ' + d.attempts_left + (d.attempts_left === 1 ? ' try' : ' tries') + ' left.' : '');
  }
  return e && e.status ? fallback : 'No connection. Check your internet and try again.';
}

var resendTimer = null;
function startResendCooldown(sec) {
  var b = el('resendBtn'); clearInterval(resendTimer);
  var left = sec;
  function tick() {
    if (left <= 0) { clearInterval(resendTimer); b.disabled = false; b.textContent = 'Resend code'; return; }
    b.disabled = true; b.textContent = 'Resend code in ' + left + 's'; left--;
  }
  tick(); resendTimer = setInterval(tick, 1000);
}

function requestCode(isResend) {
  var email = isResend ? state.pendingEmail : el('emailInput').value.trim();
  var errEl = isResend ? el('codeErr') : el('emailErr');
  errEl.textContent = '';
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errEl.textContent = 'Enter a valid email.'; return; }
  var btn = isResend ? el('resendBtn') : el('sendCodeBtn');
  var label = btn.textContent; btn.disabled = true; btn.textContent = 'Sending\u2026';
  api('auth/request-code', { method: 'POST', body: { email: email } }).then(function (d) {
    state.pendingEmail = email;
    el('codeEmail').textContent = email;
    if (d.expires_in_min) el('codeTtl').textContent = d.expires_in_min;
    el('codeInput').value = '';
    if (isResend) toast('New code sent. Check your inbox.');
    else { show('s-code'); setTimeout(function () { el('codeInput').focus(); }, 100); }
    startResendCooldown(60);
  }).catch(function (e) {
    errEl.textContent = authErr(e, 'Could not send the code. Try again.');
    if (isResend && e && e.data && e.data.retry_after) startResendCooldown(Math.min(e.data.retry_after, 60));
    else { btn.disabled = false; btn.textContent = label; }
  }).finally(function () {
    if (!isResend) { btn.disabled = false; btn.textContent = 'Send my code'; }
  });
}

el('verifyBtn').addEventListener('click', verifyCode);
el('codeInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') verifyCode(); });
el('codeInput').addEventListener('input', function () {
  this.value = this.value.replace(/\D/g, '').slice(0, 6);
  if (this.value.length === 6) verifyCode();
});
el('resendBtn').addEventListener('click', function () { requestCode(true); });
function verifyCode() {
  var code = el('codeInput').value.replace(/\D/g, '');
  var btn = el('verifyBtn');
  if (btn.disabled) return;
  el('codeErr').textContent = '';
  if (code.length !== 6) { el('codeErr').textContent = 'Enter the 6-digit code from your email.'; return; }
  btn.disabled = true; btn.textContent = 'Verifying\u2026';
  api('auth/verify-code', { method: 'POST', body: { email: state.pendingEmail, code: code } }).then(function (d) {
    clearInterval(resendTimer);
    state.token = d.token; localStorage.setItem(TOKEN_KEY, d.token); state.user = d.user;
    if (d.onboarded && !state.onboarding.goal) { loadHome().then(function () { show('s-home', { replace: true }); }); }
    else { submitOnboarding(); }
  }).catch(function (e) {
    el('codeErr').textContent = authErr(e, 'Could not verify the code. Try again.');
    el('codeInput').select();
  }).finally(function () { btn.disabled = false; btn.textContent = 'Verify & continue'; });
}

function submitOnboarding() {
  api('onboarding', { method: 'POST', body: state.onboarding }).then(function (d) {
    if (d.path) state.pathId = d.path.id;
    if (d.ai) runBuildingAI(); else runBuilding();
  }).catch(function () { toast('Could not save — retrying home.'); goHome(); });
}
function goHome() { return loadHome().then(function () { show('s-home', { replace: true }); }); }

/* build screen rows: each step shows real progress */
function buildRows(labels) {
  el('buildlog').innerHTML = labels.map(function (t, i) {
    return '<div class="row" id="brow' + i + '"><span class="b"><i></i></span><span class="t">' + esc(t) + '</span></div>'; }).join('');
}
function setRow(i, st, text) {
  var r = el('brow' + i); if (!r) return;
  r.className = 'row ' + st;
  r.querySelector('.b').innerHTML = st === 'done' ? '✓' : st === 'skip' ? '→' : '<i></i>';
  if (text) r.querySelector('.t').textContent = text;
}
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function runBuilding() {
  show('s-building', { replace: true }); histStack = ['s-home'];
  el('buildTitle').textContent = 'Opening your path…'; el('buildSub').textContent = '';
  buildRows(['Saving your goals', 'Loading your lessons']);
  setRow(0, 'done');
  setRow(1, 'on');
  goHome();
}

function runBuildingAI() {
  show('s-building', { replace: true }); histStack = ['s-home'];
  el('buildTitle').textContent = 'Building your plan…';
  el('buildSub').textContent = 'This takes about a minute. Your coach is reading up.';
  el('buildart').innerHTML = '<div class="spinner"></div>';
  buildRows(['Reading your goals', 'Choosing 10 books for you', 'Writing your first summaries', 'Preparing lesson 1']);
  setRow(0, 'done'); setRow(1, 'on');
  var books = [];
  api('plan/build', { method: 'POST', body: {} }).then(function (d) {
    books = d.books || [];
    setRow(1, 'done', books.length + ' books chosen for you');
    el('buildart').innerHTML = '<div class="stack">' + books.slice(0, 10).map(function (b, i) {
      return '<div class="mini bookcover ' + esc(b.cover_class) + '" style="--i:' + i + '" title="' + esc(b.title) + '"><div class="ttl">' + esc(b.title) + '</div></div>'; }).join('') + '</div>';
    el('buildSub').textContent = books[0] ? 'Starting with “' + books[0].title + '”.' : '';
    setRow(2, 'on');
    var first = books.filter(function (b) { return b.gen_status !== 'ready'; }).slice(0, 2), n = 0;
    return first.reduce(function (pr, b) {
      return pr.then(function () {
        setRow(2, 'on', 'Writing summaries · ' + (++n) + ' of ' + first.length);
        return api('plan/books/' + b.id + '/summary', { method: 'POST', body: {} }).catch(function () {});
      });
    }, Promise.resolve()).then(function () {
      setRow(2, 'done', 'Summaries ready to read or listen');
      setRow(3, 'on');
      return api('home');
    }).then(function (h) {
      var cl = h.current_lesson;
      if (!cl || cl.ready) return;
      return api('plan/lessons/' + cl.id + '/prepare', { method: 'POST', body: {} });
    }).then(function () { setRow(3, 'done', 'Lesson 1 is ready'); }, function () {
      setRow(3, 'skip', 'Lesson 1 will finish when you open it');
    }).then(function () {
      el('buildTitle').textContent = 'Your plan is ready'; el('buildSub').textContent = '';
      celebrate(); return wait(900);
    }).then(goHome).then(warmPlan);
  }).catch(function (e) {
    setRow(1, 'skip', 'Using our curated path for now');
    if (!(e && e.status === 409)) toast('Couldn’t build your AI plan right now. We’ll use a curated path.');
    wait(900).then(goHome);
  });
}

/* Quietly prepare what the learner will need next: upcoming lessons, then their book summaries. */
var warm = { running: false, done: {} };
function warmPlan() {
  var h = state.home; if (warm.running || !h || !h.personal || !navigator.onLine) return;
  var jobs = [];
  [h.current_lesson, h.next_lesson].forEach(function (l) {
    if (l && !l.ready && !warm.done['l' + l.id]) jobs.push({ k: 'l' + l.id, path: 'plan/lessons/' + l.id + '/prepare' });
  });
  (h.books || []).forEach(function (b) {
    if (b.gen_status && b.gen_status !== 'ready' && !warm.done['b' + b.id]) jobs.push({ k: 'b' + b.id, path: 'plan/books/' + b.id + '/summary' });
  });
  if (!jobs.length) return;
  warm.running = true;
  jobs.reduce(function (pr, j) {
    return pr.then(function () {
      warm.done[j.k] = true;
      return api(j.path, { method: 'POST', body: {} }).catch(function () {});
    });
  }, Promise.resolve()).then(function () { warm.running = false; });
}

/* ---------- tab bar ---------- */
function tabbar(active) {
  var tabs = [['home', '◎', 'Today'], ['library', '▤', 'Library'], ['coach', '✦', 'Coach'], ['progress', '◔', 'Progress']];
  return '<nav class="tabbar">' + tabs.map(function (t) {
    return '<button class="' + (t[0] === active ? 'on' : '') + '" onclick="App.tab(\'' + t[0] + '\')"><span class="ti">' + t[1] + '</span>' + t[2] + '</button>';
  }).join('') + '</nav>';
}
function tab(name) {
  histStack = ['s-' + name];
  if (name === 'home') return loadHome().then(function () { show('s-home', { replace: true }); });
  if (name === 'library') return loadLibrary().then(function () { show('s-library', { replace: true }); });
  if (name === 'coach') return loadCoach().then(function () { show('s-coach', { replace: true }); });
  if (name === 'progress') return loadProgress().then(function () { show('s-progress', { replace: true }); });
}

/* ---------- HOME ---------- */
function loadHome() {
  return api('home').then(function (d) {
    state.home = d; if (d.path) state.pathId = d.path.id;
    var cl = d.current_lesson, s = d.stats || {}, p = d.path;
    var mission = cl ? (
      '<div class="mission"><div class="halo"></div><div class="halo two"></div>' +
      '<span class="tag">Today\'s mission · ' + (cl.est_minutes || 10) + ' min</span>' +
      '<h3>' + esc(cl.mission_line || cl.title) + '</h3>' +
      '<div class="meta"><span>📖 Lesson ' + cl.idx + '</span><span>💬 ' + esc(p ? p.title : '') + '</span></div>' +
      '<button class="go" onclick="App.openLesson(' + cl.id + ')">Start lesson &nbsp;→</button></div>'
    ) : (
      '<div class="mission"><div class="halo"></div><h3>Path complete 🎉</h3>' +
      '<div class="meta">You finished every lesson. New paths coming soon.</div></div>'
    );
    var pct = p ? p.percent : 0, doneN = p ? p.completed : 0, totalN = p ? p.total : 0;
    var circ = 138, off = circ - circ * pct / 100;
    var track = '';
    for (var k = 0; k < totalN; k++) track += '<i class="' + (k < doneN ? 'done' : (k === doneN ? 'now' : '')) + '"></i>';
    var pathCard = p ? (
      '<h2 class="sec">Your path <span class="more" onclick="App.openPath()">View all</span></h2>' +
      '<div class="card pathcard" onclick="App.openPath()" style="cursor:pointer"><div class="pathrow">' +
      '<div class="ring"><svg width="52" height="52" viewBox="0 0 52 52" style="transform:rotate(-90deg)">' +
      '<circle cx="26" cy="26" r="22" fill="none" stroke="var(--surface-2)" stroke-width="6"/>' +
      '<circle cx="26" cy="26" r="22" fill="none" stroke="var(--brand)" stroke-width="6" stroke-linecap="round" style="--circ:' + circ + '" stroke-dasharray="' + circ + '" stroke-dashoffset="' + off + '"/>' +
      '</svg><div class="val">' + pct + '%</div></div>' +
      '<div style="flex:1"><div class="t">' + esc(p.title) + '</div><div class="d">' + doneN + ' of ' + totalN + ' lessons</div>' +
      '<div class="track">' + track + '</div></div></div></div>'
    ) : '';
    var books = (d.books || []).map(function (b) {
      return '<div class="bookcard" onclick="App.openBook(' + b.id + ')"><div class="bookcover ' + esc(b.cover_class) + '">' +
        (b.rank_no ? '<span class="rank">#' + b.rank_no + '</span>' : '') +
        '<div class="k">' + esc(b.category) + '</div><div><div class="ttl">' + esc(b.title) + '</div><div class="au">' + esc(b.author) + '</div></div></div>' +
        '<div class="bookmeta"><div class="t">' + esc(b.author) + '</div><div class="d">🎧 ' + b.minutes + ' min</div></div></div>';
    }).join('');
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    el('s-home').innerHTML =
      '<div class="scroll">' +
        '<div class="greet"><div><div class="hi">' + greet + ' 👋</div><div class="sub">' +
          (s.streak ? 'Day ' + s.streak + ' of your streak. Keep it going.' : 'Let\'s start your streak today.') +
        '</div></div><div class="streakpill">🔥 ' + (s.streak || 0) + '</div></div>' +
        '<div class="pad" style="padding-top:16px">' + mission + pathCard +
          '<h2 class="sec">' + (d.personal ? 'Your ' + (d.books || []).length + ' books' : 'From your library') +
          ' <span class="more" onclick="App.tab(\'library\')">See all</span></h2></div>' +
        '<div class="hscroll">' + books + '</div><div style="height:16px"></div>' +
      '</div>' + tabbar('home');
    setTimeout(warmPlan, 1500);
  }).catch(function (e) {
    if (e && e.status === 401) return sessionExpired();
    el('s-home').innerHTML = '<div class="loading">Could not load. Check your connection and try again.</div>' + tabbar('home');
  });
}

/* ---------- PATH ---------- */
function openPath() {
  if (!state.pathId) return loadHome().then(openPath);
  api('paths/' + state.pathId).then(function (d) {
    var p = d.path;
    var lessons = p.lessons.map(function (l) {
      var cls = l.status; var node = cls === 'done' ? '✓' : l.idx;
      var chev = cls === 'locked' ? '🔒' : '›';
      var click = cls === 'locked' ? '' : ' onclick="App.openLesson(' + l.id + ')"';
      var badge = cls === 'now' ? '<span class="tag">In progress</span> ' : '';
      return '<div class="lesson ' + cls + '"' + click + '><div class="node">' + node + '</div>' +
        '<div style="flex:1"><div class="t">' + esc(l.title) + '</div><div class="d">' + badge +
        '<span class="src">' + esc(l.source_title || '') + '</span></div></div><div class="chev">' + chev + '</div></div>';
    }).join('');
    el('s-path').innerHTML =
      '<div class="scroll"><div class="pathhero"><div class="halo"></div>' +
        '<span class="tag" style="background:rgba(255,255,255,.2);color:#fff">Your path</span>' +
        '<h2>' + esc(p.title) + '</h2><p>' + esc(p.subtitle || p.description || '') + '</p>' +
        '<div class="stats"><div><div class="n">' + p.completed + '/' + p.total + '</div><div class="l">lessons</div></div>' +
        '<div><div class="n">' + p.percent + '%</div><div class="l">complete</div></div></div></div>' +
        '<div class="pad">' + lessons + '</div></div>';
    show('s-path');
  }).catch(function () { toast('Could not load path.'); });
}

/* ---------- READER ---------- */
function openLesson(id) {
  api('lessons/' + id).then(function (d) {
    if (!d.lesson.ready) return craftLesson(id, d.lesson);
    state.reader = { lesson: d.lesson, idx: 0, total: d.lesson.cards.length };
    renderReader();
    show('s-reader', { replace: document.querySelector('#s-reader.active') !== null });
  }).catch(function (e) {
    if (e && e.status === 401) return sessionExpired();
    toast(e && e.status ? 'Could not open this lesson.' : 'You\u2019re offline. Reconnect to open this lesson.');
  });
}
/* First visit to an AI lesson: show a crafting state while cards, quiz and SMART goal are written. */
function craftLesson(id, L) {
  var lines = ['Reading ' + (L.source_title || 'the book') + '\u2026', 'Picking the most useful idea\u2026', 'Writing your insight cards\u2026',
    'Setting quiz questions\u2026', 'Tailoring a SMART goal to you\u2026'];
  el('s-reader').innerHTML =
    '<div class="rdrtop"><div class="x" onclick="App.tab(\'home\')">\u2715</div><div style="flex:1"></div></div>' +
    '<div class="craft"><div class="craftart"><div class="sheet s1"></div><div class="sheet s2"></div><div class="sheet s3"><div class="pen">\u270E</div></div></div>' +
    '<h2>Crafting your lesson</h2><p class="muted" id="craftLine">' + esc(lines[0]) + '</p>' +
    '<div class="skel"><i></i><i></i><i style="width:70%"></i></div></div>';
  show('s-reader');
  var k = 0, iv = setInterval(function () { var c = el('craftLine'); if (!c) return clearInterval(iv); k = Math.min(k + 1, lines.length - 1); c.textContent = lines[k]; }, 3500);
  api('plan/lessons/' + id + '/prepare', { method: 'POST', body: {} }).then(function () {
    clearInterval(iv); openLesson(id);
  }).catch(function (e) {
    clearInterval(iv);
    if (e && e.status === 401) return sessionExpired();
    el('s-reader').querySelector('.craft').innerHTML =
      '<div class="craftart"><div class="sheet s3"></div></div><h2>That took too long</h2>' +
      '<p class="muted">Your lesson isn\u2019t ready yet. Give it another try.</p>' +
      '<button class="btn" style="max-width:240px" onclick="App.openLesson(' + id + ')">Try again</button>';
  });
}
function renderReader() {
  var r = state.reader, L = r.lesson, cards = L.cards, n = cards.length;
  var slides = cards.map(function (c, i) {
    var parts = '<div class="knum">Insight ' + (i + 1) + ' of ' + n + '</div><h3>' + esc(c.heading) + '</h3>';
    if (c.quote) parts += '<div class="quote">' + esc(c.quote) + '</div>';
    if (c.body) parts += '<p>' + esc(c.body) + '</p>';
    if (c.callout_title || c.callout_body) parts += '<div class="callout"><div class="h">' + esc(c.callout_title || 'Try this') + '</div>' + esc(c.callout_body) + '</div>';
    parts += '<div class="from"><span>from</span><span class="dot"></span><b>' + esc(c.source_label || (L.source_title || '')) + '</b></div>';
    return '<div class="islide"><div class="inner">' + parts + '</div></div>';
  }).join('');
  var prog = ''; for (var i = 0; i < n; i++) prog += '<i class="' + (i === 0 ? 'cur' : '') + '"><b></b></i>';
  el('s-reader').innerHTML =
    '<div class="rdrtop"><div class="x" onclick="App.tab(\'home\')">✕</div><div class="rdrprog" id="rdrprog">' + prog + '</div></div>' +
    '<div class="cards" id="cards">' + slides + '</div>' +
    '<div class="audiobar"><button class="playbtn" id="playbtn" onclick="App.togglePlay()">▶</button>' +
      '<div class="wave"><div class="track2"><b id="audiofill"></b></div>' +
      '<div class="time"><span id="tcur">0:00</span><span id="tdur">audio</span></div></div>' +
      '<div class="spd" id="spd" onclick="App.cycleSpeed()">' + audio.rate + '×</div></div>' +
    '<div class="rdrnav"><button class="btn ghost" style="flex:0 0 54px" onclick="App.readerPrev()">←</button>' +
      '<button class="btn" id="rdrnext" onclick="App.readerNext()">Next insight</button></div>';
  var cardsEl = el('cards');
  cardsEl.addEventListener('scroll', function () {
    var idx = Math.round(cardsEl.scrollLeft / cardsEl.clientWidth);
    if (idx !== r.idx) { r.idx = idx; updateReaderProg(); }
  });
  updateReaderProg();
}
function updateReaderProg() {
  var r = state.reader; var bars = document.querySelectorAll('#rdrprog i');
  bars.forEach(function (b, i) { b.classList.toggle('done', i < r.idx); b.classList.toggle('cur', i === r.idx); });
  var nb = el('rdrnext'); if (nb) nb.textContent = r.idx >= r.total - 1 ? 'Take the quiz →' : 'Next insight';
}
function readerNext() {
  var r = state.reader; stopAudio();
  if (r.idx >= r.total - 1) { openQuiz(r.lesson.id); return; }
  r.idx++; scrollReader();
}
function readerPrev() { var r = state.reader; if (r.idx > 0) { stopAudio(); r.idx--; scrollReader(); } }
function scrollReader() { var c = el('cards'); c.scrollTo({ left: state.reader.idx * c.clientWidth, behavior: 'smooth' }); updateReaderProg(); }

/* audio: device text-to-speech (Web Speech API) */
var audio = { playing: false, rate: 1, rates: [1, 1.25, 1.5, 2], ri: 0, synth: window.speechSynthesis, voice: null };

/* Narrator: a calm, clear female voice with an Indian English accent.
   Voices come from the device, so we rank what's installed:
   named en-IN female voices > any en-IN voice not known to be male > hi-IN Google voice > any female English voice. */
var VOICE_BASE_RATE = 0.9, VOICE_PITCH = 1.05;
var IN_FEMALE = /neerja|heera|veena|isha|kajal|aditi|raveena|swara|en-in-x-(ena|ahp|cxx)/i;
var IN_MALE = /prabhat|ravi|rishi|hemant|en-in-x-(end|ene)/i;
var EN_FEMALE = /female|samantha|karen|moira|tessa|zira|aria|jenny|libby|sonia|serena|fiona|victoria/i;
function pickVoice() {
  if (!audio.synth) return null;
  var vs = audio.synth.getVoices() || [];
  if (!vs.length) return null;
  function lang(v) { return (v.lang || '').replace('_', '-').toLowerCase(); }
  function score(v) {
    var n = v.name + ' ' + (v.voiceURI || ''), l = lang(v), sc = 0;
    if (l === 'en-in') sc = IN_FEMALE.test(n) ? 100 : IN_MALE.test(n) ? 40 : 80;
    else if (l === 'hi-in' && /google/i.test(n)) sc = 60;
    else if (l.indexOf('en') === 0 && EN_FEMALE.test(n)) sc = 30;
    else if (l.indexOf('en') === 0) sc = 10;
    if (sc && /natural|neural|online|enhanced|premium|network/i.test(n)) sc += 5; // better-quality engines
    return sc;
  }
  var best = null, bs = 0;
  vs.forEach(function (v) { var sc = score(v); if (sc > bs) { bs = sc; best = v; } });
  return best;
}
if (audio.synth) {
  audio.voice = pickVoice();
  if ('onvoiceschanged' in audio.synth) audio.synth.addEventListener('voiceschanged', function () { audio.voice = pickVoice(); });
}
function splitSentences(text) {
  return (text.match(/[^.!?…]+[.!?…]*["'”’)]*\s*/g) || [text])
    .map(function (x) { return x.trim(); }).filter(Boolean);
}
function currentCardText() { var c = state.reader.lesson.cards[state.reader.idx]; return [c.heading, c.quote, c.body, c.callout_body].filter(Boolean)
    .map(function (x) { x = String(x).trim(); return /[.!?\u2026"'\u201d\u2019]$/.test(x) ? x : x + '.'; }).join(' '); }
function togglePlay() { audio.playing ? stopAudio() : startAudio(); }
function fmtTime(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }
function ttsSupported() { return !!(audio.synth && 'SpeechSynthesisUtterance' in window); }

/* Speak text sentence by sentence. Progress follows the sentence actually being spoken. */
function narrate(text, ui) {
  audio.synth.cancel();
  if (!audio.voice) audio.voice = pickVoice();
  var parts = splitSentences(text);
  var words = parts.map(function (p) { return p.split(/\s+/).length; });
  var total = words.reduce(function (x, y) { return x + y; }, 0) || 1;
  var dur = Math.max(3, total / (2.6 * VOICE_BASE_RATE * audio.rate)); // estimate for the time label
  var done = 0, session = (audio.session = (audio.session || 0) + 1);
  function progress(pct) {
    var f = el(ui.fill); if (f) f.style.width = pct + '%';
    var tc = el(ui.cur); if (tc) tc.textContent = fmtTime(dur * pct / 100);
  }
  var td = el(ui.dur); if (td) td.textContent = fmtTime(dur);
  progress(0);
  parts.forEach(function (p, i) {
    var u = new SpeechSynthesisUtterance(p);
    if (audio.voice) { u.voice = audio.voice; u.lang = audio.voice.lang; } else u.lang = 'en-IN';
    u.rate = VOICE_BASE_RATE * audio.rate; u.pitch = VOICE_PITCH; u.volume = 1;
    u.onend = function () {
      if (session !== audio.session) return;
      done += words[i]; progress(done / total * 100);
      if (i === parts.length - 1) stopAudio();
    };
    u.onerror = function (e) {
      if (session !== audio.session || e.error === 'interrupted' || e.error === 'canceled') return;
      stopAudio(); toast('Audio stopped. Tap play to try again.');
    };
    audio.synth.speak(u);
  });
}
function setPlayIcon(on) {
  document.querySelectorAll('.playbtn').forEach(function (b) { b.textContent = '\u25B6'; b.classList.remove('live'); });
  var b = audio.ui && el(audio.ui.btn); if (b && on) { b.textContent = '\u275A\u275A'; b.classList.add('live'); }
}
/* A small player bar; ids are prefixed so several can live on one screen. */
function playerBar(prefix, secs) {
  return '<div class="audiobar"><button class="playbtn" id="' + prefix + 'play" onclick="App.playSection(\'' + prefix + '\')">\u25B6</button>' +
    '<div class="wave"><div class="track2"><b id="' + prefix + 'fill"></b></div>' +
    '<div class="time"><span id="' + prefix + 'cur">0:00</span><span id="' + prefix + 'dur">' + fmtTime(secs || 0) + '</span></div></div>' +
    '<div class="spd" onclick="App.cycleSpeed()">' + audio.rate + '\u00D7</div></div>';
}
function listenSecs(text) { return String(text || '').split(/\s+/).length / (2.6 * VOICE_BASE_RATE); }
var sections = {};
function playSection(prefix) {
  if (audio.playing && audio.ui && audio.ui.btn === prefix + 'play') { stopAudio(); return; }
  startAudio(sections[prefix], { btn: prefix + 'play', fill: prefix + 'fill', cur: prefix + 'cur', dur: prefix + 'dur' });
}
function startAudio(text, ui) {
  if (!ttsSupported()) { toast('Listening isn\u2019t supported in this browser. Try Chrome, Edge or Safari.'); return; }
  audio.text = text || currentCardText();
  audio.ui = ui || { btn: 'playbtn', fill: 'audiofill', cur: 'tcur', dur: 'tdur' };
  audio.playing = true; setPlayIcon(true);
  narrate(audio.text, audio.ui);
}
function stopAudio() {
  audio.playing = false; audio.session = (audio.session || 0) + 1; setPlayIcon(false);
  if (audio.synth) audio.synth.cancel();
}
function cycleSpeed() { audio.ri = (audio.ri + 1) % audio.rates.length; audio.rate = audio.rates[audio.ri];
  document.querySelectorAll('.spd').forEach(function (s) { s.textContent = audio.rate + '\u00D7'; });
  if (audio.playing) { var t = audio.text, u = audio.ui; stopAudio(); startAudio(t, u); } }

/* ---------- QUIZ ---------- */
function openQuiz(lessonId) {
  api('quiz/' + lessonId).then(function (d) {
    var qs = (d.questions || []).filter(function (q) { return q.options && q.options.length; });
    if (!qs.length) { openApply(lessonId); return; } // lesson has no quiz yet: go straight to the assignment
    state.quiz = { lessonId: lessonId, questions: qs, idx: 0, score: 0, answers: {}, answered: false };
    el('s-quiz').innerHTML =
      '<div class="rdrtop"><div class="x" onclick="App.tab(\'home\')">✕</div><div class="rdrprog" id="quizprog"></div></div>' +
      '<div class="scroll"><div class="qwrap" id="quizbody"></div></div>' +
      '<div class="footer"><button class="btn" id="quiznext" disabled onclick="App.quizNext()">Choose an answer</button></div>';
    renderQuiz(); show('s-quiz');
  }).catch(function (e) {
    if (e && e.status === 401) { sessionExpired(); return; }
    toast(e && e.status ? 'Could not load the quiz. Please try again.' : 'You\u2019re offline. Reconnect to take the quiz.');
  });
}
function renderQuiz() {
  var q = state.quiz; q.answered = false;
  var Q = q.questions[q.idx], n = q.questions.length;
  el('quizprog').innerHTML = q.questions.map(function (_, i) {
    return '<i class="' + (i < q.idx ? 'done' : (i === q.idx ? 'cur' : '')) + '"><b></b></i>'; }).join('');
  var opts = Q.options.map(function (o, i) {
    return '<div class="opt" data-oid="' + o.id + '" onclick="App.quizAnswer(' + o.id + ')"><span class="lt">' +
      String.fromCharCode(65 + i) + '</span><span>' + esc(o.label) + '</span><span class="mk"></span></div>'; }).join('');
  el('quizbody').innerHTML = '<div class="qkicker">Quick check · Question ' + (q.idx + 1) + ' of ' + n + '</div>' +
    '<h3 class="qtext">' + esc(Q.question) + '</h3><div id="qopts">' + opts + '</div><div id="qexp"></div>';
  var nb = el('quiznext'); nb.disabled = true; nb.textContent = 'Choose an answer';
  $('#s-quiz .scroll').scrollTop = 0;
}
function quizAnswer(oid) {
  var q = state.quiz; if (q.answered) return; q.answered = true;
  var Q = q.questions[q.idx];
  api('quiz/answer', { method: 'POST', body: { question_id: Q.id, option_id: oid } }).then(function (r) {
    q.answers[Q.id] = oid;
    var opts = document.querySelectorAll('#qopts .opt');
    opts.forEach(function (o) {
      var id = parseInt(o.dataset.oid, 10); o.classList.add('locked');
      if (id === r.correct_option_id) { o.classList.add('correct'); o.querySelector('.mk').textContent = '✓'; }
      else if (id === oid) { o.classList.add('wrong'); o.querySelector('.mk').textContent = '✕'; }
      else o.classList.add('dim');
    });
    if (r.correct) { q.score++; haptic(12); } else haptic([20, 40, 20]);
    el('qexp').innerHTML = '<div class="qexp ' + (r.correct ? 'good' : 'bad') + '"><div class="h">' +
      (r.correct ? 'Correct' : 'Not quite') + '</div>' + esc(r.explanation || '') + '</div>';
    var nb = el('quiznext'); nb.disabled = false;
    nb.textContent = q.idx >= q.questions.length - 1 ? 'See my score →' : 'Next question →';
  }).catch(function () { q.answered = false; toast('Network hiccup, tap again.'); });
}
function quizNext() {
  var q = state.quiz;
  if (q.idx >= q.questions.length - 1) { finishQuiz(); return; }
  q.idx++; renderQuiz();
}
function finishQuiz() {
  var q = state.quiz;
  api('quiz/' + q.lessonId + '/submit', { method: 'POST', body: { answers: q.answers } }).then(function (r) {
    state.lastQuiz = { score: r.score, total: r.total };
  }).catch(function () { state.lastQuiz = { score: q.score, total: q.questions.length }; }).finally(function () {
    var pct = Math.round(q.score / q.questions.length * 100);
    var band = pct >= 75 ? 'Nailed it 🎯' : pct >= 50 ? 'Good start 👍' : 'Worth another look 🔁';
    var msg = pct >= 75 ? 'You\'ve got this down. Time to use it for real.' : 'Skim the cards again anytime, then take it into the world.';
    el('quizprog').innerHTML = q.questions.map(function () { return '<i class="done"><b></b></i>'; }).join('');
    el('quizbody').innerHTML = '<div class="qresult"><div class="score">' + q.score + '<small>/' + q.questions.length +
      '</small></div><div class="band">' + band + '</div><p>' + msg + '</p></div>';
    if (pct >= 75) celebrate();
    var nb = el('quiznext'); nb.disabled = false; nb.textContent = 'Continue to assignment →';
    nb.onclick = function () { openApply(q.lessonId); };
  });
}

/* ---------- APPLY / ASSIGNMENT ---------- */
var SMART = [['specific', 'S', 'Specific'], ['measurable', 'M', 'Measurable'], ['achievable', 'A', 'Achievable'], ['relevant', 'R', 'Relevant'], ['time_bound', 'T', 'Time-bound']];
function smartCards(g) {
  return '<div class="smartrow stagger">' + SMART.map(function (k) {
    return '<div class="smartcard"><div class="letter">' + k[1] + '</div><div class="lbl">' + k[2] + '</div><div class="txt">' + esc(g[k[0]] || '') + '</div></div>'; }).join('') + '</div>';
}
function recapCards(L) {
  return '<div class="recap stagger">' + (L.cards || []).map(function (c, i) {
    return '<details class="recapcard"' + (i === 0 ? ' open' : '') + '><summary><span class="n">' + (i + 1) + '</span>' + esc(c.heading) + '</summary>' +
      (c.body ? '<p>' + esc(c.body) + '</p>' : '') +
      (c.callout_body ? '<div class="callout"><b>' + esc(c.callout_title || 'Try this') + ':</b> ' + esc(c.callout_body) + '</div>' : '') + '</details>'; }).join('') + '</div>';
}
function openApply(lessonId) {
  state.proofs = [];
  Promise.all([api('assignments/' + lessonId), api('lessons/' + lessonId)]).then(function (res) {
    var d = res[0], L = res[1].lesson;
    var a = d.assignment, t = a.template, g = t.smart_goal;
    state.currentAssignment = t;
    sections.smart = g ? 'Your SMART goal. ' + SMART.map(function (k) { return k[2] + ': ' + (g[k[0]] || ''); }).join(' ') : '';
    sections.recap = (L.cards || []).map(function (c) { return [c.heading, c.body, c.callout_body].filter(Boolean).join('. '); }).join(' ');
    var done = a.status === 'submitted' || a.status === 'reviewed';
    var statusCard = done
      ? '<div class="card statuscard"><div class="tag grow">' + (a.status === 'reviewed' ? 'Reviewed' : 'Submitted') + '</div>' +
        '<div style="font-weight:700;margin-top:8px">' + (a.status === 'reviewed' ? 'Your coach reviewed this' : 'Proof received. Pending review.') + '</div>' +
        (a.feedback ? '<div class="muted" style="font-size:13.5px;margin-top:6px;line-height:1.5">' + esc(a.feedback) + '</div>' : '') + '</div>'
      : '';
    var due = new Date(Date.now() + (t.due_days || 2) * 864e5);
    var dueStr = due.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    el('s-apply').innerHTML =
      '<div class="scroll"><div class="applyhero"><div class="ic">🧪</div>' +
      '<span class="tag" style="background:var(--amber);color:#fff;margin-bottom:12px">⏳ Due in ' + (t.due_days || 2) + ' days · by ' + dueStr + '</span>' +
      '<h2>' + esc(t.title) + '</h2><p>Take this into a real conversation, then send proof. A photo or a voice note, whatever\'s easiest.</p></div>' +
      '<div class="pad" style="padding-top:14px">' +
        statusCard +
        (g ? '<h2 class="sec" style="margin:4px 0 8px">Your SMART goal</h2>' + playerBar('smart', listenSecs(sections.smart)) + smartCards(g) : '') +
        '<div class="card" style="border-color:var(--brand);border-width:1.5px"><div class="tag">Your task</div>' +
        '<div style="font-weight:700;font-size:15.5px;margin:10px 0 6px;line-height:1.35">' + esc(t.instructions) + '</div>' +
        (t.examples ? '<div class="muted" style="font-size:13px;line-height:1.5">' + esc(t.examples) + '</div>' : '') + '</div>' +
        ((L.cards || []).length ? '<h2 class="sec" style="margin-bottom:8px">Lesson recap</h2>' + playerBar('recap', listenSecs(sections.recap)) + recapCards(L) : '') +
        '<h2 class="sec" style="margin-bottom:8px">' + (done ? 'Add more proof' : 'Submit your proof') + '</h2><div id="uploads"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:2px">' +
          '<button class="btn ghost" style="flex-direction:column;gap:6px;padding:18px" onclick="App.pickPhoto()"><span style="font-size:24px">📷</span><span style="font-size:13px">Add photo</span></button>' +
          '<button class="btn ghost" id="recBtn" style="flex-direction:column;gap:6px;padding:18px" onclick="App.toggleRecord()"><span style="font-size:24px">🎙️</span><span style="font-size:13px">Record audio</span></button>' +
        '</div>' +
        '<input id="photoInput" type="file" accept="image/*" capture="environment" hidden>' +
        '<input id="audioInput" type="file" accept="audio/*" hidden>' +
        '<textarea id="reflect" class="field" placeholder="Optional: a line on how it went…" style="min-height:56px;resize:none;margin-top:12px"></textarea>' +
        '<div class="card" style="margin-top:14px;background:var(--brand-wash);border-color:transparent"><div class="tag">Practice first?</div>' +
        '<div style="font-weight:700;font-size:15px;margin:8px 0 4px">Rehearse it with your AI coach</div>' +
        '<div class="muted" style="font-size:13px;line-height:1.45">Role-play the exact conversation before you do it for real.</div>' +
        '<button class="btn sm" style="margin-top:12px;background:var(--brand)" onclick="App.practice()">Practice with Coach →</button></div>' +
      '</div></div>' +
      '<div class="footer"><button class="btn" id="submitAssignBtn" onclick="App.submitAssignment(' + lessonId + ')">Submit assignment</button>' +
      '<button class="btn ghost" style="margin-top:10px" onclick="App.remindLater(' + lessonId + ')">Remind me later — I have ' + (t.due_days || 2) + ' days</button></div>';
    el('photoInput').addEventListener('change', function (e) { addFileProof(e.target.files[0], 'photo'); });
    el('audioInput').addEventListener('change', function (e) { addFileProof(e.target.files[0], 'audio'); });
    renderProofs(); show('s-apply');
  }).catch(function (e) {
    if (e && e.status === 401) return sessionExpired();
    toast('Could not load this assignment.');
  });
}
function practice() {
  var t = state.currentAssignment || {};
  state.coachPrefill = 'Let\'s rehearse my assignment before I do it for real: "' + (t.title || '') + '". ' + (t.instructions || '') +
    ' Play the other person (my manager or a colleague, whoever fits best), stay in character, then step out and coach me.';
  tab('coach');
}
function pickPhoto() { el('photoInput').click(); }
function addFileProof(file, kind) { if (!file) return; state.proofs.push({ file: file, kind: kind, name: file.name || (kind + '.dat') }); renderProofs(); }
function removeProof(i) { state.proofs.splice(i, 1); renderProofs(); }
function renderProofs() {
  var w = el('uploads'); if (!w) return;
  if (!state.proofs.length) { w.innerHTML = '<div class="muted" style="font-size:13px;padding:2px 2px 12px">Nothing attached yet.</div>'; return; }
  w.innerHTML = state.proofs.map(function (p, i) {
    var icon = p.kind === 'photo' ? '📷' : '🎙️';
    return '<div class="proofchip"><span style="font-weight:600;font-size:13.5px;flex:1">' + icon + ' ' + esc(p.name) +
      '</span><span style="color:var(--grow);font-weight:800;font-size:12px">Attached ✓</span>' +
      '<span class="x" onclick="App.removeProof(' + i + ')">✕</span></div>';
  }).join('');
}
/* in-app audio recording via MediaRecorder */
function toggleRecord() {
  if (state.recorder && state.recorder.state === 'recording') { state.recorder.stop(); return; }
  if (!navigator.mediaDevices || !window.MediaRecorder) { el('audioInput').click(); return; }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
    state.recStream = stream;
    var mr = new MediaRecorder(stream); state.recorder = mr; var chunks = [];
    mr.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
    mr.onstop = function () {
      var blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
      var ext = (blob.type.indexOf('mp4') > -1 || blob.type.indexOf('m4a') > -1) ? 'm4a' : (blob.type.indexOf('ogg') > -1 ? 'ogg' : 'webm');
      state.proofs.push({ file: blob, kind: 'audio', name: 'voice-note.' + ext }); renderProofs();
      stream.getTracks().forEach(function (t) { t.stop(); });
      var b = el('recBtn'); if (b) { b.innerHTML = '<span style="font-size:24px">🎙️</span><span style="font-size:13px">Record audio</span>'; b.style.background = ''; }
    };
    mr.start();
    var b = el('recBtn'); if (b) { b.innerHTML = '<span style="font-size:24px">⏹️</span><span style="font-size:13px">Stop recording</span>'; b.style.background = 'color-mix(in srgb,var(--danger) 16%,var(--surface))'; }
    toast('Recording… tap again to stop.');
  }).catch(function () { el('audioInput').click(); });
}
function submitAssignment(lessonId) {
  var btn = el('submitAssignBtn'); btn.disabled = true; btn.textContent = 'Submitting…';
  var fd = new FormData();
  fd.append('reflection', (el('reflect') && el('reflect').value) || '');
  state.proofs.forEach(function (p) { fd.append('files[]', p.file, p.name); });
  api('assignments/' + lessonId + '/submit', { method: 'POST', body: fd }).then(function () {
    haptic(20); completeLesson(lessonId, 'submitted');
  }).catch(function () { btn.disabled = false; btn.textContent = 'Submit assignment'; toast('Upload failed — try again.'); });
}
function remindLater(lessonId) {
  api('assignments/' + lessonId + '/remind', { method: 'POST', body: {} }).finally(function () { completeLesson(lessonId, 'pending'); });
}
function completeLesson(lessonId, assignState) {
  api('lessons/' + lessonId + '/complete', { method: 'POST', body: {} }).finally(function () { renderComplete(assignState); });
}

/* ---------- COMPLETE ---------- */
function renderComplete(assignState) {
  var q = state.lastQuiz;
  var pending = assignState === 'submitted'
    ? '<div style="width:36px;height:36px;border-radius:10px;background:var(--amber);color:#fff;display:grid;place-items:center;font-size:18px;flex:none">⏳</div><div><div style="font-weight:700;font-size:13.5px">Assignment submitted</div><div class="muted" style="font-size:12px">Pending review</div></div>'
    : '<div style="width:36px;height:36px;border-radius:10px;background:var(--surface-2);display:grid;place-items:center;font-size:18px;flex:none">🔔</div><div><div style="font-weight:700;font-size:13.5px">Assignment saved</div><div class="muted" style="font-size:12px">You have 2 days to submit proof</div></div>';
  el('s-complete').innerHTML =
    '<div class="wrap"><div class="burst">✓</div><h2>Lesson complete!</h2>' +
    '<p>' + (assignState === 'submitted' ? 'Quiz done and your assignment is in.' : 'Quiz done. Your assignment is waiting when you\'re ready.') + '</p>' +
    '<div class="gain"><div class="g"><div class="n grow">' + q.score + '/' + q.total + '</div><div class="l">Quiz score</div></div>' +
    '<div class="g"><div class="n">+15</div><div class="l">Growth</div></div>' +
    '<div class="g"><div class="n grow">🔥</div><div class="l">Streak kept</div></div></div>' +
    '<div class="card" style="margin-top:18px;width:100%;max-width:320px;display:flex;align-items:center;gap:12px;text-align:left">' + pending + '</div></div>' +
    '<div class="footer"><button class="btn" onclick="App.tab(\'home\')">Back to today</button></div>';
  histStack = ['s-home', 's-complete']; show('s-complete', { replace: true });
  celebrate();
}

/* ---------- LIBRARY ---------- */
var libCat = 'All', libBooks = [], libQuery = '';
function loadLibrary() {
  return api('library' + (libCat !== 'All' ? '?category=' + encodeURIComponent(libCat) : '')).then(function (d) {
    libBooks = d.books || [];
    var chips = (d.categories || ['All']).map(function (c) {
      return '<button class="gchip ' + (c === libCat ? 'on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
    el('s-library').innerHTML =
      '<div class="apphead"><div style="flex:1"><div class="eyebrow">Explore</div><h1>Library</h1></div></div>' +
      '<label class="searchbar">\u26B2 <input id="libSearch" type="search" placeholder="Search books, authors, topics\u2026" autocomplete="off" value="' + esc(libQuery) + '"></label>' +
      '<div class="goalchips" id="libCats" style="padding-top:8px">' + chips + '</div>' +
      '<div class="scroll">' + pickedRow(d.mine || []) +
      '<h2 class="sec" style="margin:14px 20px 10px">' + (d.mine && d.mine.length ? 'All books' : 'Books') + '</h2>' +
      '<div class="libgrid" id="libGrid"></div></div>' + tabbar('library');
    el('libSearch').addEventListener('input', function () { libQuery = this.value; renderLibGrid(); });
    el('libCats').addEventListener('click', function (e) { var c = e.target.closest('[data-cat]'); if (c) setCat(c.dataset.cat); });
    renderLibGrid();
  }).catch(function (e) {
    if (e && e.status === 401) return sessionExpired();
    el('s-library').innerHTML = '<div class="loading">Could not load the library. Check your connection and try again.</div>' + tabbar('library');
  });
}
function pickedRow(mine) {
  if (!mine.length) return '';
  return '<h2 class="sec" style="margin:14px 20px 4px">Picked for you</h2>' +
    '<p class="muted" style="margin:0 20px 10px;font-size:12.5px">Chosen by AI for your goal, in the order to read them.</p>' +
    '<div class="hscroll stagger">' + mine.map(function (b) {
      return '<div class="bookcard picked" onclick="App.openBook(' + b.id + ')"><div class="bookcover ' + esc(b.cover_class) + '">' +
        '<span class="rank">#' + b.rank_no + '</span><div class="k">' + esc(b.category) + '</div><div><div class="ttl">' + esc(b.title) +
        '</div><div class="au">' + esc(b.author) + '</div></div></div>' +
        '<div class="why">' + esc(b.reason || b.blurb || '') + '</div></div>'; }).join('') + '</div>';
}
function renderLibGrid() {
  var q = libQuery.trim().toLowerCase();
  var list = libBooks.filter(function (b) {
    return !q || [b.title, b.author, b.category, b.blurb].join(' ').toLowerCase().indexOf(q) !== -1; });
  el('libGrid').innerHTML = list.length ? list.map(function (b) {
    return '<div class="libcard" onclick="App.openBook(' + b.id + ')"><div class="bookcover ' + esc(b.cover_class) + '">' +
      '<div class="k">' + esc(b.category) + '</div><div><div class="ttl">' + esc(b.title) + '</div><div class="au">' + esc(b.author) + '</div></div></div>' +
      (b.blurb ? '<div class="libblurb">' + esc(b.blurb) + '</div>' : '') + '</div>'; }).join('')
    : '<div class="loading" style="grid-column:1/-1">No books match \u201c' + esc(libQuery) + '\u201d.</div>';
}
function setCat(c) { libCat = c; loadLibrary().then(function () { show('s-library', { replace: true }); }); }

/* ---------- BOOK ---------- */
function openBook(id, replace) {
  api('books/' + id).then(function (d) {
    var b = d.book;
    var paras = String(b.summary || '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    var insights = (b.insights || []).map(function (x, i) {
      return '<div class="keyrow"><div class="n">' + (i + 1) + '</div><div class="t">' + esc(x.text) + '</div></div>'; }).join('');
    sections.book = [b.title + ', by ' + b.author + '.'].concat(paras.length ? paras : [b.blurb || '']).join(' ');
    var secs = listenSecs(sections.book), mins = Math.max(1, Math.ceil(secs / 60));
    var writing = !b.summary_ready;
    el('s-book').innerHTML =
      '<div class="obtop" style="padding-bottom:0"><div class="backb" onclick="App.back()">\u2190</div><div style="flex:1"></div></div>' +
      '<div class="scroll"><div class="bd-hero"><div class="bookcover ' + esc(b.cover_class) + '" style="flex-direction:column">' +
        '<div class="k">' + esc(b.category) + '</div><div><div class="ttl">' + esc(b.title) + '</div><div class="au">' + esc(b.author) + '</div></div></div>' +
        '<div style="flex:1"><div class="t">' + esc(b.title) + '</div><div class="au">' + esc(b.author) + '</div>' +
        '<div class="chips">' + (writing ? '' : '<span class="tag">\uD83C\uDFA7 ' + mins + ' min listen</span>') +
        (b.insight_count ? '<span class="tag grow">' + b.insight_count + ' insights</span>' : '') +
        (b.rank_no ? '<span class="tag">#' + b.rank_no + ' on your list</span>' : '') + '</div></div></div>' +
      '<div class="pad" style="padding-top:14px">' +
        (b.reason ? '<div class="whycard"><div class="h">Why it\u2019s on your list</div>' + esc(b.reason) + '</div>' : '') +
        (b.blurb ? '<p class="bookblurb">' + esc(b.blurb) + '</p>' : '') +
        (writing
          ? '<h2 class="sec" style="margin-bottom:6px">Summary</h2><div class="writing"><span class="dotpulse"><i></i><i></i><i></i></span>Writing your summary\u2026</div>' +
            '<div class="skel"><i></i><i></i><i></i><i style="width:60%"></i></div>'
          : playerBar('book', secs) +
            (paras.length ? '<h2 class="sec" style="margin-bottom:6px">Summary</h2><div class="booksummary">' +
              paras.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>' : '') +
            (insights ? '<h2 class="sec" style="margin-bottom:6px">Key insights</h2><div class="stagger">' + insights + '</div>' : '')) +
      '</div></div>' +
      '<div class="footer"><button class="btn" onclick="App.openPath()">Explore in your path \u2192</button></div>';
    show('s-book', { replace: !!replace });
    if (writing) {
      api('plan/books/' + id + '/summary', { method: 'POST', body: {} }).then(function () {
        if (document.querySelector('#s-book.active')) openBook(id, true);
      }).catch(function () {
        var w = document.querySelector('#s-book .writing');
        if (w) w.innerHTML = 'The summary isn\u2019t ready yet. <button class="linkbtn" onclick="App.openBook(' + id + ', true)">Try again</button>';
        var sk = document.querySelector('#s-book .skel'); if (sk) sk.remove();
      });
    }
  }).catch(function (e) {
    if (e && e.status === 401) return sessionExpired();
    toast(e && e.status ? 'Could not load this book.' : 'You\u2019re offline. Reconnect to open this book.');
  });
}

/* ---------- PROGRESS ---------- */
function assignmentsList(rows) {
  if (!rows.length) return '<div class="muted" style="font-size:13.5px;padding:4px 2px">Finish a lesson to get your first field assignment.</div>';
  var label = { not_started: 'To do', pending: 'To do', submitted: 'Submitted', reviewed: 'Reviewed' };
  return '<div class="stagger">' + rows.map(function (r) {
    var due = r.due_at && r.status === 'pending' ? ' \u00B7 due ' + new Date(r.due_at.replace(' ', 'T')).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
    return '<div class="card asgrow" onclick="App.openApply(' + r.lesson_id + ')"><div class="asgtop"><span class="tag ' +
      (r.status === 'submitted' || r.status === 'reviewed' ? 'grow' : '') + '">' + (label[r.status] || 'To do') + due + '</span>' +
      '<span class="chev">\u203A</span></div><div class="t">' + esc(r.title) + '</div>' +
      (r.smart_goal ? '<div class="goal"><b>S</b>' + esc(r.smart_goal.specific || '') + '</div>' : '') +
      '<div class="muted" style="font-size:12px;margin-top:4px">' + esc(r.book_title || r.lesson_title || '') + '</div></div>'; }).join('') + '</div>';
}
function loadProgress() {
  return Promise.all([api('progress'), api('assignments').catch(function () { return { assignments: [] }; })]).then(function (res) {
    var d = res[0], asg = res[1].assignments || [];
    var s = d.stats, w = d.weekly, pb = d.playbook || [];
    var gs = s.growth_score, circ = 465, off = circ - circ * Math.min(gs, 100) / 100;
    var max = Math.max.apply(null, w.values.concat([1]));
    var bars = w.labels.map(function (lb, i) {
      var h = Math.round(w.values[i] / max * 100);
      var soft = w.values[i] === 0 ? ' soft' : '';
      return '<div class="col"><div class="bar' + soft + '" style="height:' + Math.max(h, 6) + '%"></div><div class="lb">' + esc(lb) + '</div></div>'; }).join('');
    var play = pb.length ? pb.map(function (p) {
      return '<div class="card" style="margin-bottom:10px"><div class="tag grow">Works for me</div>' +
        '<div style="font-weight:700;font-size:14px;margin-top:8px">' + esc(p.title) + '</div>' +
        '<div class="muted" style="font-size:12.5px;margin-top:3px">Tried ' + p.tried_count + '× · ' + esc(p.source || '') + '</div></div>'; }).join('')
      : '<div class="muted" style="font-size:13.5px;padding:4px 2px">Your saved insights will show here as you learn.</div>';
    el('s-progress').innerHTML =
      '<div class="apphead"><div style="flex:1"><div class="eyebrow">Your growth</div><h1>Progress</h1></div>' +
        '<div class="avatar">' + esc(((state.user && state.user.email) || 'U')[0].toUpperCase()) + '</div></div>' +
      '<div class="scroll"><div class="scorewrap"><div class="bigring">' +
        '<svg width="170" height="170" viewBox="0 0 170 170" style="transform:rotate(-90deg)">' +
        '<circle cx="85" cy="85" r="74" fill="none" stroke="var(--surface-2)" stroke-width="14"/>' +
        '<circle cx="85" cy="85" r="74" fill="none" stroke="var(--brand)" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + circ + '" stroke-dashoffset="' + off + '"/>' +
        '</svg><div class="v"><div class="num">' + gs + '</div><div class="lab">Growth score</div></div></div></div>' +
      '<div class="stat3"><div class="s"><div class="n">🔥 ' + s.streak + '</div><div class="l">Day streak</div></div>' +
        '<div class="s"><div class="n">' + s.insights_learned + '</div><div class="l">Insights learned</div></div>' +
        '<div class="s"><div class="n">' + s.actions_done + '</div><div class="l">Actions done</div></div></div>' +
      '<div class="pad"><div class="card"><div style="font-weight:700;font-size:14.5px">Last 7 days</div>' +
        '<div class="bars">' + bars + '</div></div>' +
        '<h2 class="sec">Your assignments</h2>' + assignmentsList(asg) +
        '<h2 class="sec">Your Playbook</h2>' + play + '</div></div>' + tabbar('progress');
  }).catch(function () { el('s-progress').innerHTML = '<div class="loading">Could not load progress.</div>' + tabbar('progress'); });
}

/* ---------- COACH ---------- */
function loadCoach() {
  return api('coach').then(function (d) {
    var msgs = d.messages || [];
    var chat = msgs.length ? msgs.map(bubbleHTML).join('') :
      '<div class="bubble ai"><div class="who">✦ Coach</div>Hi! I\'m your Compound coach. Tell me a real situation and I\'ll help you handle it, or we can role-play a tough conversation. What\'s on your mind?</div>';
    el('s-coach').innerHTML =
      '<div class="apphead"><div class="avatar" style="background:var(--brand);color:#fff">✦</div><div style="flex:1"><div class="eyebrow">Always on</div><h1>AI Coach</h1></div></div>' +
      '<div class="scroll" id="coachScroll"><div class="chat" id="chat">' + chat + '</div>' +
      '<div class="quickchips"><div class="q" onclick="App.quickCoach(\'Role-play a tough conversation with my manager. You play my manager.\')">🎭 With my manager</div>' +
      '<div class="q" onclick="App.quickCoach(\'Role-play a tough conversation with a colleague. You play the colleague.\')">🤝 With a colleague</div>' +
      '<div class="q" onclick="App.quickCoach(\'Give me one tip I can use today for my goal\')">💡 Quick tip</div>' +
      '<div class="q" onclick="App.resetCoach()">↺ Reset</div></div></div>' +
      '<div class="composer"><input class="field" id="coachInput" placeholder="Type your reply…"><button class="send" onclick="App.sendCoach()">↑</button></div>';
    el('coachInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendCoach(); });
    scrollChat();
    if (state.coachPrefill) { var t = state.coachPrefill; state.coachPrefill = null; quickCoach(t); }
  }).catch(function () { el('s-coach').innerHTML = '<div class="loading">Could not load coach.</div>' + tabbar('coach'); });
}
function bubbleHTML(m) {
  if (m.role === 'user') return '<div class="bubble me">' + esc(m.content) + '</div>';
  return '<div class="bubble ai"><div class="who">✦ Coach</div>' + esc(m.content) + '</div>';
}
function scrollChat() { var s = el('coachScroll'); if (s) s.scrollTop = s.scrollHeight; }
function quickCoach(text) { el('coachInput').value = text; sendCoach(); }
function sendCoach() {
  var input = el('coachInput'); var text = input.value.trim(); if (!text) return;
  input.value = '';
  var chat = el('chat');
  chat.insertAdjacentHTML('beforeend', bubbleHTML({ role: 'user', content: text }));
  chat.insertAdjacentHTML('beforeend', '<div class="bubble ai" id="typing"><div class="who">✦ Coach</div><span class="typing"><i></i><i></i><i></i></span></div>');
  scrollChat();
  api('coach', { method: 'POST', body: { message: text } }).then(function (d) {
    var t = el('typing'); if (t) t.remove();
    chat.insertAdjacentHTML('beforeend', bubbleHTML({ role: 'assistant', content: d.reply || '…' }));
    scrollChat();
  }).catch(function () {
    var t = el('typing'); if (t) t.remove();
    chat.insertAdjacentHTML('beforeend', bubbleHTML({ role: 'assistant', content: 'I could not reach the coach just now. Please try again.' }));
    scrollChat();
  });
}
function resetCoach() { api('coach/reset', { method: 'POST', body: {} }).finally(function () { loadCoach(); }); }

/* ---------- expose ---------- */
window.App = {
  tab: tab, back: back, openPath: openPath, openLesson: openLesson,
  readerNext: readerNext, readerPrev: readerPrev, togglePlay: togglePlay, cycleSpeed: cycleSpeed, playSection: playSection,
  quizAnswer: quizAnswer, quizNext: quizNext,
  pickPhoto: pickPhoto, toggleRecord: toggleRecord, removeProof: removeProof,
  submitAssignment: submitAssignment, remindLater: remindLater,
  openBook: openBook, openApply: openApply, practice: practice, setCat: setCat, sendCoach: sendCoach, quickCoach: quickCoach, resetCoach: resetCoach
};

boot();
})();

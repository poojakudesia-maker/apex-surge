/* LeapPath Admin — content management + submission review. */
(function () {
'use strict';
var API = (window.COMPOUND_CONFIG && window.COMPOUND_CONFIG.API_BASE) || '/api';
var TOKEN_KEY = 'compound_token';
var token = localStorage.getItem(TOKEN_KEY);
var S = { paths: [], books: [], ctx: { pathId: null, lessonId: null }, section: 'overview', pendingEmail: '' };

function api(path, opts) {
  opts = opts || {};
  var h = opts.headers || {};
  if (token) h['Authorization'] = 'Bearer ' + token;
  var body = opts.body;
  if (body && !(body instanceof FormData)) { h['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  return fetch(API + '/' + path, { method: opts.method || 'GET', headers: h, body: body })
    .then(function (r) { return r.json().catch(function(){return{};}).then(function (d) { if (!r.ok) throw { status: r.status, data: d }; return d; }); });
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function el(id){return document.getElementById(id);}
function root(){return el('root');}
function modal(html){ if(html==null){el('modal').classList.remove('open');return;} el('sheet').innerHTML=html; el('modal').classList.add('open'); }
el('modal').addEventListener('click',function(e){ if(e.target===el('modal')) modal(null); });

/* ---------- boot / auth ---------- */
function boot() {
  if (!token) return renderLogin();
  api('auth/me').then(function (d) {
    if (!d.user || !d.user.is_admin) return renderLogin('That account is not an admin. Add its email to admin_emails in config.php.');
    renderApp();
  }).catch(function () { token = null; renderLogin(); });
}
function renderLogin(msg) {
  root().innerHTML =
    '<div class="login"><div class="brand" style="padding-left:0"><img class="m" src="../assets/logo.svg" alt=""> LeapPath Admin</div>' +
    '<p class="muted">Sign in with an admin email. We\'ll send a 6-digit code.</p>' +
    '<div id="step1"><label>Email</label><input id="aemail" type="email" placeholder="you@domain.com">' +
    '<div class="err" id="aerr">' + (msg ? esc(msg) : '') + '</div>' +
    '<button class="btn" id="asend" style="width:100%;margin-top:8px">Send code</button></div>' +
    '<div id="step2" style="display:none"><label>6-digit code</label><input id="acode" inputmode="numeric" maxlength="6" placeholder="000000">' +
    '<div class="err" id="aerr2"></div><button class="btn" id="averify" style="width:100%;margin-top:8px">Verify</button></div></div>';
  el('asend').onclick = function () {
    var email = el('aemail').value.trim(); el('aerr').textContent = '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { el('aerr').textContent = 'Enter a valid email.'; return; }
    api('auth/request-code', { method: 'POST', body: { email: email } }).then(function (d) {
      S.pendingEmail = email; el('step1').style.display = 'none'; el('step2').style.display = 'block';
      el('acode').focus();
    }).catch(function (e) {
      var err = e && e.data && e.data.error;
      el('aerr').textContent = err === 'too_many_requests' ? 'Too many requests. Wait a minute and try again.'
        : err === 'email_send_failed' ? 'Email could not be sent. Check the SMTP settings in config.php.'
        : 'Could not send code.';
    });
  };
  el('averify').onclick = function () {
    var code = (el('acode').value || '').replace(/\D/g, ''); el('aerr2').textContent = '';
    if (code.length !== 6) { el('aerr2').textContent = 'Enter the 6 digits.'; return; }
    api('auth/verify-code', { method: 'POST', body: { email: S.pendingEmail, code: code } }).then(function (d) {
      token = d.token; localStorage.setItem(TOKEN_KEY, token); boot();
    }).catch(function (e) {
      var d = (e && e.data) || {};
      el('aerr2').textContent = d.error === 'wrong_code' ? 'Wrong code. ' + d.attempts_left + ' tries left.'
        : d.error === 'too_many_attempts' || d.error === 'code_expired' ? 'Code no longer valid. Reload and request a new one.'
        : 'Could not verify the code.';
    });
  };
}

/* ---------- app shell ---------- */
var NAV = [['overview','Overview'],['review','AI review'],['books','Books'],['lessons','Lessons'],['cards','Insight cards'],['questions','Quiz'],['assignment','Assignments'],['submissions','Submissions']];
function renderApp() {
  root().innerHTML =
    '<div class="wrap"><div class="side"><div class="brand"><img class="m" src="../assets/logo.svg" alt=""> Admin</div>' +
    '<div class="nav" id="nav">' + NAV.map(function (n) { return '<button data-s="' + n[0] + '">' + n[1] + '</button>'; }).join('') + '</div>' +
    '<div style="position:absolute;bottom:16px;left:12px;right:12px"><button class="btn sec sm" style="width:100%" id="logout">Log out</button></div></div>' +
    '<div class="main" id="main"></div></div>';
  el('nav').addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (b) select(b.dataset.s); });
  el('logout').onclick = function () { localStorage.removeItem(TOKEN_KEY); token = null; boot(); };
  Promise.all([api('paths'), api('admin/books')]).then(function (r) {
    S.paths = r[0].paths || []; S.books = r[1].rows || [];
    S.ctx.pathId = S.paths[0] ? S.paths[0].id : null;
    select('overview');
  });
}
function select(s) {
  S.section = s;
  document.querySelectorAll('#nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.s === s); });
  ({ overview: secOverview, review: secReview, books: secBooks, lessons: secLessons, cards: secCards, questions: secQuestions, assignment: secAssignment, submissions: secSubmissions }[s])();
}
function head(title, sub) { return '<h1>' + esc(title) + '</h1><p class="sub">' + esc(sub) + '</p>'; }
function pathSelect() {
  return '<label>Path</label><select id="pathSel">' + S.paths.map(function (p) {
    return '<option value="' + p.id + '"' + (p.id == S.ctx.pathId ? ' selected' : '') + '>' + esc(p.title) + '</option>'; }).join('') + '</select>';
}
function lessonSelectFor(pid) {
  return api('admin/lessons?path_id=' + pid).then(function (d) {
    var rows = (d.rows || []).sort(function (a, b) { return a.idx - b.idx; });
    if (!S.ctx.lessonId && rows[0]) S.ctx.lessonId = rows[0].id;
    return rows;
  });
}

/* ---------- overview ---------- */
function secOverview() {
  api('admin/overview').then(function (d) {
    var c = d.counts;
    el('main').innerHTML = head('Overview', 'Your content and activity at a glance.') +
      (d.ai_enabled ? '' : '<div class="card" style="border-color:#E88A2A;background:#FFF6EC;margin-bottom:16px"><b>AI plans are off.</b> ' +
        'Learners get the curated Communication path whatever goal they pick, and onboarding uses built-in options. ' +
        'Add your Claude API key to <code>api/config.php</code> (<code>claude.api_key</code>) to turn on personal plans.</div>') +
      '<div class="grid">' + Object.keys(c).map(function (k) {
        return '<div class="stat"><div class="n">' + c[k] + '</div><div class="l">' + esc(k) + '</div></div>'; }).join('') + '</div>' +
      '<p class="muted">Use the sidebar to manage books, lessons, insight cards, quizzes and assignments, and to review learner submissions.</p>';
  });
}

/* ---------- AI review ---------- */
/* AI-picked books and AI lessons go live immediately; check them here. */
function secReview() {
  el('main').innerHTML = head('AI review', 'Books, summaries and lessons written by AI. They are live already; approve, fix, hide or regenerate.') + '<div id="list">Loading…</div>';
  api('admin/review').then(function (d) {
    var books = d.books || [], lessons = d.lessons || [];
    var bh = books.map(function (b) {
      var paras = String(b.summary || '').split(/\n\s*\n/).filter(Boolean);
      return '<div class="card rv"><div class="rvhead"><div><b>' + esc(b.title) + '</b> <span class="muted">by ' + esc(b.author) + '</span>' +
        '<div class="muted" style="font-size:12px;margin-top:2px">' + esc(b.category) + ' · on ' + b.learners + ' learner list(s) · ' +
        (b.is_hidden == 1 ? 'hidden' : (b.gen_status === 'ready' ? 'summary live' : 'summary ' + esc(b.gen_status))) + '</div></div></div>' +
        (b.blurb ? '<p style="margin:10px 0 6px"><i>' + esc(b.blurb) + '</i></p>' : '') +
        (paras.length ? '<details><summary>Summary (' + paras.join(' ').split(/\s+/).length + ' words)</summary>' + paras.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
          (b.insights.length ? '<ol>' + b.insights.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' : '') + '</details>' : '') +
        '<div class="rvact"><button class="btn sm" onclick="Admin.review(\'books\',' + b.id + ',\'approve\')">Approve</button>' +
        '<button class="btn sec sm" onclick="Admin.editBook(' + b.id + ')">Edit</button>' +
        '<button class="btn sec sm" onclick="Admin.review(\'books\',' + b.id + ',\'regenerate\')">Rewrite summary</button>' +
        (b.is_hidden == 1 ? '<button class="btn sec sm" onclick="Admin.review(\'books\',' + b.id + ',\'unhide\')">Unhide</button>'
          : '<button class="btn dng sm" onclick="Admin.review(\'books\',' + b.id + ',\'hide\')">Hide book</button>') + '</div></div>';
    }).join('');
    var lh = lessons.map(function (l) {
      var c = l.content || {};
      return '<div class="card rv"><b>' + esc(l.title) + '</b> <span class="muted">from ' + esc(l.book_title) + '</span>' +
        '<div class="muted" style="font-size:12.5px;margin-top:2px">Mission: ' + esc(l.mission_line || '') + '</div>' +
        '<details><summary>' + (c.cards || []).length + ' cards · ' + (c.quiz || []).length + ' quiz questions</summary>' +
        (c.cards || []).map(function (k, i) { return '<p><b>' + (i + 1) + '. ' + esc(k.heading) + '</b><br>' + esc(k.body) + '<br><span class="muted">' + esc(k.callout_title) + ': ' + esc(k.callout_body) + '</span></p>'; }).join('') +
        (c.quiz || []).map(function (q) { return '<p><b>Q: ' + esc(q.question) + '</b><br>' + (q.options || []).map(function (o, j) { return (j === q.correct_index ? '✓ ' : '· ') + esc(o); }).join('<br>') + '<br><span class="muted">' + esc(q.explanation) + '</span></p>'; }).join('') +
        '</details><div class="rvact"><button class="btn sm" onclick="Admin.review(\'lessons\',' + l.id + ',\'approve\')">Approve</button>' +
        '<button class="btn sec sm" onclick="Admin.review(\'lessons\',' + l.id + ',\'regenerate\')">Regenerate for new learners</button></div>' +
        '<div class="muted" style="font-size:12px;margin-top:8px">Learners who already opened this lesson keep their copy; edit it under Lessons / Insight cards.</div></div>';
    }).join('');
    el('list').innerHTML =
      '<h2>Books <span class="muted">(' + books.length + ')</span></h2>' + (bh || '<p class="muted">Nothing waiting.</p>') +
      '<h2 style="margin-top:24px">Lessons <span class="muted">(' + lessons.length + ')</span></h2>' + (lh || '<p class="muted">Nothing waiting.</p>');
  }).catch(function () { el('list').innerHTML = '<p class="err">Could not load the review queue.</p>'; });
}
function review(kind, id, action) {
  if ((action === 'hide' || action === 'regenerate') && !confirm(action === 'hide'
      ? 'Hide this book from the library and from new plans?' : 'Throw this away and let AI write it again the next time a learner needs it?')) return;
  api('admin/review/' + kind + '/' + id, { method: 'POST', body: { action: action } }).then(secReview)
    .catch(function () { alert('That did not work. Try again.'); });
}

/* ---------- generic list + form ---------- */
function tableHTML(cols, rows, renderRow) {
  return '<table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
    rows.map(renderRow).join('') + '</tbody></table>';
}

/* books */
function secBooks() {
  api('admin/books').then(function (d) {
    S.books = d.rows || [];
    el('main').innerHTML = head('Books', 'The library learners browse.') +
      '<div class="toolbar"><button class="btn" id="new">+ New book</button></div>' +
      tableHTML(['Title', 'Author', 'Category', 'Cover'], S.books, function (b) {
        return '<tr><td><b>' + esc(b.title) + '</b></td><td>' + esc(b.author) + '</td><td>' + esc(b.category) + '</td><td>' + esc(b.cover_class) + '</td>' +
          '<td class="row-actions"><button class="btn sec sm" onclick="Admin.editBook(' + b.id + ')">Edit</button>' +
          '<button class="btn dng sm" onclick="Admin.del(\'books\',' + b.id + ')">Delete</button></td></tr>'; });
    el('new').onclick = function () { bookForm(null); };
  });
}
function editBook(id) {
  var b = S.books.filter(function (x) { return x.id == id; })[0];
  if (b) return bookForm(b);
  api('admin/books').then(function (d) { S.books = d.rows || []; bookForm(S.books.filter(function (x) { return x.id == id; })[0]); });
}
function bookForm(b) {
  b = b || {};
  var covers = ['cov1','cov2','cov3','cov4','cov5','cov6'];
  modal('<h3>' + (b.id ? 'Edit' : 'New') + ' book</h3>' +
    field('Title', 'f_title', b.title) + field('Author', 'f_author', b.author) +
    field('Slug (url id)', 'f_slug', b.slug) + field('Category', 'f_category', b.category || 'Communication') +
    '<label>Cover style</label><select id="f_cover">' + covers.map(function (c) { return '<option' + (b.cover_class === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select>' +
    area('Blurb (one or two lines)', 'f_blurb', b.blurb) + area('Summary (separate paragraphs with a blank line)', 'f_summary', b.summary) + field('Minutes', 'f_minutes', b.minutes || 9, 'number') + field('Sort order', 'f_sort', b.sort || 0, 'number') +
    formButtons());
  bindSave(function () {
    return api('admin/books', { method: 'POST', body: {
      id: b.id, title: val('f_title'), author: val('f_author'), slug: val('f_slug') || slugify(val('f_title')),
      category: val('f_category'), cover_class: val('f_cover'), blurb: val('f_blurb'), summary: val('f_summary'),
      minutes: parseInt(val('f_minutes') || 9, 10), sort: parseInt(val('f_sort') || 0, 10) } });
  }, secBooks);
}

/* lessons */
function secLessons() {
  el('main').innerHTML = head('Lessons', 'Ordered lessons within a path.') + '<div class="toolbar">' + pathSelect() + '<button class="btn" id="new">+ New lesson</button></div><div id="list"></div>';
  el('pathSel').onchange = function () { S.ctx.pathId = +this.value; S.ctx.lessonId = null; secLessons(); };
  el('new').onclick = function () { lessonForm(null); };
  api('admin/lessons?path_id=' + S.ctx.pathId).then(function (d) {
    var rows = (d.rows || []).sort(function (a, b) { return a.idx - b.idx; });
    el('list').innerHTML = tableHTML(['#', 'Title', 'Source book'], rows, function (l) {
      var book = bookName(l.source_book_id);
      return '<tr><td>' + l.idx + '</td><td><b>' + esc(l.title) + '</b></td><td class="muted">' + esc(book) + '</td>' +
        '<td class="row-actions"><button class="btn sec sm" onclick="Admin.editLesson(' + l.id + ')">Edit</button>' +
        '<button class="btn dng sm" onclick="Admin.del(\'lessons\',' + l.id + ',Admin.secLessons)">Delete</button></td></tr>'; });
  });
}
function editLesson(id) { api('admin/lessons?path_id=' + S.ctx.pathId).then(function (d) { lessonForm((d.rows || []).filter(function (r) { return r.id == id; })[0]); }); }
function lessonForm(l) {
  l = l || {};
  modal('<h3>' + (l.id ? 'Edit' : 'New') + ' lesson</h3>' +
    field('Order (idx)', 'f_idx', l.idx || nextIdx(), 'number') + field('Title', 'f_title', l.title) +
    '<label>Source book</label><select id="f_book"><option value="">— none —</option>' + S.books.map(function (b) {
      return '<option value="' + b.id + '"' + (l.source_book_id == b.id ? ' selected' : '') + '>' + esc(b.title) + '</option>'; }).join('') + '</select>' +
    field('Est. minutes', 'f_min', l.est_minutes || 10, 'number') + field('Mission line (home screen)', 'f_mission', l.mission_line) +
    formButtons());
  bindSave(function () {
    return api('admin/lessons', { method: 'POST', body: {
      id: l.id, path_id: S.ctx.pathId, idx: parseInt(val('f_idx') || 1, 10), title: val('f_title'),
      source_book_id: val('f_book') || null, est_minutes: parseInt(val('f_min') || 10, 10), mission_line: val('f_mission') } });
  }, secLessons);
}

/* cards */
function secCards() {
  el('main').innerHTML = head('Insight cards', 'The swipeable cards inside a lesson.') +
    '<div class="toolbar">' + pathSelect() + '<span id="lsWrap"></span><button class="btn" id="new">+ New card</button></div><div id="list"></div>';
  el('pathSel').onchange = function () { S.ctx.pathId = +this.value; S.ctx.lessonId = null; secCards(); };
  el('new').onclick = function () { if (!S.ctx.lessonId) return alert('Pick a lesson first'); cardForm(null); };
  lessonSelectFor(S.ctx.pathId).then(function (rows) {
    el('lsWrap').innerHTML = '<select id="lsSel">' + rows.map(function (r) {
      return '<option value="' + r.id + '"' + (r.id == S.ctx.lessonId ? ' selected' : '') + '>' + r.idx + '. ' + esc(r.title) + '</option>'; }).join('') + '</select>';
    if (el('lsSel')) el('lsSel').onchange = function () { S.ctx.lessonId = +this.value; loadCards(); };
    loadCards();
  });
}
function loadCards() {
  if (!S.ctx.lessonId) { el('list').innerHTML = '<p class="muted">No lessons in this path yet.</p>'; return; }
  api('admin/cards?lesson_id=' + S.ctx.lessonId).then(function (d) {
    var rows = (d.rows || []).sort(function (a, b) { return a.idx - b.idx; });
    el('list').innerHTML = tableHTML(['#', 'Heading', 'Body'], rows, function (c) {
      return '<tr><td>' + c.idx + '</td><td><b>' + esc(c.heading) + '</b></td><td class="muted">' + esc((c.body || '').slice(0, 80)) + '</td>' +
        '<td class="row-actions"><button class="btn sec sm" onclick="Admin.editCard(' + c.id + ')">Edit</button>' +
        '<button class="btn dng sm" onclick="Admin.del(\'cards\',' + c.id + ',Admin.loadCards)">Delete</button></td></tr>'; });
  });
}
function editCard(id) { api('admin/cards?lesson_id=' + S.ctx.lessonId).then(function (d) { cardForm((d.rows || []).filter(function (r) { return r.id == id; })[0]); }); }
function cardForm(c) {
  c = c || {};
  modal('<h3>' + (c.id ? 'Edit' : 'New') + ' insight card</h3>' +
    field('Order (idx)', 'f_idx', c.idx || 1, 'number') + field('Heading', 'f_head', c.heading) +
    area('Body', 'f_body', c.body) + area('Quote (optional)', 'f_quote', c.quote) +
    field('Callout title (optional)', 'f_ctitle', c.callout_title) + area('Callout body (optional)', 'f_cbody', c.callout_body) +
    field('Source label', 'f_src', c.source_label) + formButtons());
  bindSave(function () {
    return api('admin/cards', { method: 'POST', body: {
      id: c.id, lesson_id: S.ctx.lessonId, idx: parseInt(val('f_idx') || 1, 10), heading: val('f_head'),
      body: val('f_body'), quote: val('f_quote'), callout_title: val('f_ctitle'), callout_body: val('f_cbody'), source_label: val('f_src') } });
  }, loadCards);
}

/* questions + options */
function secQuestions() {
  el('main').innerHTML = head('Quiz', 'Questions and options graded instantly for learners.') +
    '<div class="toolbar">' + pathSelect() + '<span id="lsWrap"></span><button class="btn" id="new">+ New question</button></div><div id="list"></div>';
  el('pathSel').onchange = function () { S.ctx.pathId = +this.value; S.ctx.lessonId = null; secQuestions(); };
  el('new').onclick = function () { if (!S.ctx.lessonId) return alert('Pick a lesson first'); questionForm(null); };
  lessonSelectFor(S.ctx.pathId).then(function (rows) {
    el('lsWrap').innerHTML = '<select id="lsSel">' + rows.map(function (r) {
      return '<option value="' + r.id + '"' + (r.id == S.ctx.lessonId ? ' selected' : '') + '>' + r.idx + '. ' + esc(r.title) + '</option>'; }).join('') + '</select>';
    if (el('lsSel')) el('lsSel').onchange = function () { S.ctx.lessonId = +this.value; loadQuestions(); };
    loadQuestions();
  });
}
function loadQuestions() {
  if (!S.ctx.lessonId) { el('list').innerHTML = '<p class="muted">No lessons in this path yet.</p>'; return; }
  api('admin/questions?lesson_id=' + S.ctx.lessonId).then(function (d) {
    var rows = (d.rows || []);
    if (!rows.length) { el('list').innerHTML = '<p class="muted">No questions yet.</p>'; return; }
    el('list').innerHTML = rows.map(function (q) {
      var opts = (q.options || []).map(function (o) { return '<div>' + (o.is_correct == 1 ? '✅ ' : '◻︎ ') + esc(o.label) + '</div>'; }).join('');
      return '<div class="stat" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:10px">' +
        '<b>' + q.idx + '. ' + esc(q.question) + '</b><span class="row-actions" style="white-space:nowrap">' +
        '<button class="btn sec sm" onclick="Admin.editQuestion(' + q.id + ')">Edit</button>' +
        '<button class="btn dng sm" onclick="Admin.del(\'questions\',' + q.id + ',Admin.loadQuestions)">Delete</button></span></div>' +
        '<div class="muted" style="margin-top:8px;font-size:13px">' + opts + '</div></div>';
    }).join('');
    S._questions = rows;
  });
}
function editQuestion(id) { questionForm((S._questions || []).filter(function (q) { return q.id == id; })[0]); }
function questionForm(q) {
  q = q || { options: [{}, {}, {}, {}] };
  var opts = q.options && q.options.length ? q.options : [{}, {}, {}, {}];
  while (opts.length < 2) opts.push({});
  var correctIdx = 0; opts.forEach(function (o, i) { if (o.is_correct == 1) correctIdx = i; });
  var optRows = opts.map(function (o, i) {
    return '<div class="opt-row"><input type="text" id="opt_' + i + '" value="' + esc(o.label || '') + '" placeholder="Option ' + (i + 1) + '">' +
      '<label><input type="radio" name="correct" value="' + i + '"' + (i === correctIdx ? ' checked' : '') + '> correct</label></div>'; }).join('');
  modal('<h3>' + (q.id ? 'Edit' : 'New') + ' question</h3>' +
    field('Order (idx)', 'f_idx', q.idx || 1, 'number') + area('Question', 'f_q', q.question) +
    area('Explanation (shown after answering)', 'f_exp', q.explanation) +
    '<label>Options (mark the correct one)</label>' + optRows + '<div style="margin-top:6px"><button class="btn sec sm" id="addOpt">+ add option</button></div>' +
    formButtons());
  var count = opts.length;
  el('addOpt').onclick = function () {
    var wrap = document.createElement('div'); wrap.className = 'opt-row';
    wrap.innerHTML = '<input type="text" id="opt_' + count + '" placeholder="Option ' + (count + 1) + '"><label><input type="radio" name="correct" value="' + count + '"> correct</label>';
    el('addOpt').parentNode.parentNode.insertBefore(wrap, el('addOpt').parentNode); count++;
  };
  bindSave(function () {
    var lessonId = S.ctx.lessonId;
    return api('admin/questions', { method: 'POST', body: {
      id: q.id, lesson_id: lessonId, idx: parseInt(val('f_idx') || 1, 10), question: val('f_q'), explanation: val('f_exp') }
    }).then(function (res) {
      var qid = q.id || res.id;
      var chain = Promise.resolve();
      // clear old options on edit
      (q.options || []).forEach(function (o) { if (o.id) chain = chain.then(function () { return api('admin/options/' + o.id, { method: 'DELETE' }); }); });
      var correct = document.querySelector('input[name=correct]:checked');
      var ci = correct ? parseInt(correct.value, 10) : 0;
      for (var i = 0; i < count; i++) (function (i) {
        var inp = el('opt_' + i); if (!inp || !inp.value.trim()) return;
        chain = chain.then(function () { return api('admin/options', { method: 'POST', body: {
          question_id: qid, idx: i, label: inp.value.trim(), is_correct: (i === ci) ? 1 : 0 } }); });
      })(i);
      return chain;
    });
  }, loadQuestions);
}

/* assignment (single per lesson) */
function secAssignment() {
  el('main').innerHTML = head('Assignments', 'The real-world task after each lesson.') +
    '<div class="toolbar">' + pathSelect() + '<span id="lsWrap"></span></div><div id="list"></div>';
  el('pathSel').onchange = function () { S.ctx.pathId = +this.value; S.ctx.lessonId = null; secAssignment(); };
  lessonSelectFor(S.ctx.pathId).then(function (rows) {
    el('lsWrap').innerHTML = '<select id="lsSel">' + rows.map(function (r) {
      return '<option value="' + r.id + '"' + (r.id == S.ctx.lessonId ? ' selected' : '') + '>' + r.idx + '. ' + esc(r.title) + '</option>'; }).join('') + '</select>';
    if (el('lsSel')) el('lsSel').onchange = function () { S.ctx.lessonId = +this.value; loadAssignment(); };
    loadAssignment();
  });
}
function loadAssignment() {
  if (!S.ctx.lessonId) { el('list').innerHTML = '<p class="muted">No lessons yet.</p>'; return; }
  api('admin/assignment?lesson_id=' + S.ctx.lessonId).then(function (d) {
    var a = d.assignment || {};
    el('list').innerHTML =
      field('Title', 'a_title', a.title || 'Field assignment') +
      area('Instructions (the task)', 'a_inst', a.instructions) +
      area('Examples (optional)', 'a_ex', a.examples) +
      field('Due (days)', 'a_due', a.due_days || 2, 'number') +
      '<div style="margin-top:14px"><button class="btn" id="asave">Save assignment</button></div>';
    el('asave').onclick = function () {
      api('admin/assignment', { method: 'POST', body: {
        lesson_id: S.ctx.lessonId, title: val('a_title'), instructions: val('a_inst'), examples: val('a_ex'), due_days: parseInt(val('a_due') || 2, 10) }
      }).then(function () { el('asave').textContent = 'Saved ✓'; setTimeout(function () { el('asave').textContent = 'Save assignment'; }, 1500); });
    };
  });
}

/* submissions */
function secSubmissions() {
  el('main').innerHTML = head('Submissions', 'Learner assignment submissions to review.') + '<div id="list">Loading…</div>';
  api('admin/submissions').then(function (d) {
    var rows = d.rows || [];
    if (!rows.length) { el('list').innerHTML = '<p class="muted">No submissions yet.</p>'; return; }
    el('list').innerHTML = tableHTML(['Learner', 'Lesson', 'Status', 'Submitted'], rows, function (r) {
      var pill = r.status === 'reviewed' ? '<span class="pill rev">reviewed</span>' : '<span class="pill sub">submitted</span>';
      return '<tr><td>' + esc(r.email) + '</td><td>' + esc(r.lesson_title) + '</td><td>' + pill + '</td>' +
        '<td class="muted">' + esc((r.submitted_at || '').replace('T', ' ').slice(0, 16)) + '</td>' +
        '<td class="row-actions"><button class="btn sec sm" onclick="Admin.viewSub(' + r.id + ')">Open</button></td></tr>'; });
  });
}
function viewSub(id) {
  api('admin/submissions/' + id).then(function (d) {
    var s = d.submission;
    var files = (s.files || []).map(function (f, i) {
      return '<button class="btn sec sm" id="file_' + f.id + '" onclick="Admin.openFile(' + f.id + ')">' + (f.kind === 'photo' ? '📷' : '🎙️') + ' ' + esc(f.name || f.kind) + '</button>'; }).join(' ');
    modal('<h3>Submission — ' + esc(s.lesson_title) + '</h3>' +
      '<p class="muted">' + esc(s.email) + ' · ' + esc((s.submitted_at || '').replace('T', ' ').slice(0, 16)) + '</p>' +
      '<label>Reflection</label><div class="stat">' + (s.reflection ? esc(s.reflection) : '<span class="muted">— none —</span>') + '</div>' +
      '<label>Proof files</label><div>' + (files || '<span class="muted">none</span>') + '</div>' +
      '<div id="viewer" style="margin-top:12px"></div>' +
      '<label>Feedback</label><textarea id="fb">' + esc(s.feedback || '') + '</textarea>' +
      '<div style="margin-top:12px;display:flex;gap:8px"><button class="btn" id="rev">Mark reviewed + save feedback</button>' +
      '<button class="btn sec" onclick="Admin.closeModal()">Close</button></div>');
    el('rev').onclick = function () {
      api('admin/submissions/' + id + '/review', { method: 'POST', body: { feedback: val('fb') } }).then(function () { modal(null); secSubmissions(); });
    };
  });
}
function openFile(fid) {
  api('uploads/' + fid, { headers: {} }).catch(function () {}); // warm; but we need blob:
  fetch(API + '/uploads/' + fid, { headers: { 'Authorization': 'Bearer ' + token } }).then(function (r) { return r.blob(); }).then(function (blob) {
    var url = URL.createObjectURL(blob); var v = el('viewer');
    if (blob.type.indexOf('image') === 0) v.innerHTML = '<img src="' + url + '" style="max-width:100%;border-radius:10px">';
    else if (blob.type.indexOf('audio') === 0 || blob.type.indexOf('video') === 0) v.innerHTML = '<audio controls src="' + url + '" style="width:100%"></audio>';
    else v.innerHTML = '<a href="' + url + '" target="_blank">Download file</a>';
  }).catch(function () { el('viewer').innerHTML = '<span class="muted">Could not load file.</span>'; });
}

/* ---------- small form helpers ---------- */
function field(label, id, v, type) { return '<label>' + esc(label) + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(v == null ? '' : v) + '">'; }
function area(label, id, v) { return '<label>' + esc(label) + '</label><textarea id="' + id + '">' + esc(v == null ? '' : v) + '</textarea>'; }
function val(id) { var e = el(id); return e ? e.value.trim() : ''; }
function formButtons() { return '<div style="margin-top:16px;display:flex;gap:8px"><button class="btn" id="save">Save</button><button class="btn sec" onclick="Admin.closeModal()">Cancel</button></div>'; }
function bindSave(fn, after) { el('save').onclick = function () { el('save').disabled = true; el('save').textContent = 'Saving…'; Promise.resolve(fn()).then(function () { modal(null); after(); }).catch(function (e) { el('save').disabled = false; el('save').textContent = 'Save'; alert('Save failed: ' + (e && e.data && e.data.error || 'error')); }); }; }
function del(resource, id, after) { if (!confirm('Delete this ' + resource.replace(/s$/, '') + '?')) return; api('admin/' + resource + '/' + id, { method: 'DELETE' }).then(function () { (after || secBooks)(); }); }
function bookName(id) { var b = S.books.filter(function (x) { return x.id == id; })[0]; return b ? b.title : ''; }
function nextIdx() { return 1; }
function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

window.Admin = {
  editBook: editBook, del: del, editLesson: editLesson, secLessons: secLessons, editCard: editCard, loadCards: loadCards,
  editQuestion: editQuestion, loadQuestions: loadQuestions, viewSub: viewSub, openFile: openFile,
  review: review,
  closeModal: function () { modal(null); }
};
boot();
})();

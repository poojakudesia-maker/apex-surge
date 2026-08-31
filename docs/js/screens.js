// Apex Surge — screen templates + behavior
// Each entry: { tab: 'today'|null, back: bool, render(): html, after(el): bind events }

function topbar(title, opts={}){
  return `<div class="topbar">
    ${opts.back ? `<button class="back-btn" data-back>‹</button>` : `<div class="topbar-spacer"></div>`}
    <div class="topbar-title">${title}</div>
    <div class="topbar-spacer"></div>
  </div>`;
}

function ring(pct, size=118, stroke=10, color='var(--accent)'){
  const r = (size-stroke)/2, c = 2*Math.PI*r, off = c*(1-pct/100);
  return `<svg width="${size}" height="${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="var(--card-soft)" stroke-width="${stroke}" fill="none"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset .6s ease"/>
  </svg>`;
}

function bookCoverHtml(b, w=52, h=70){
  return `<div class="book-cover" style="width:${w}px;height:${h}px;background:linear-gradient(160deg,${b.color},#00000055)">${b.big}</div>`;
}

const SCREENS = {};

/* ============ ONBOARDING ============ */

SCREENS['splash'] = {
  render(){
    return `<div class="screen no-pad active" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:24px;">
      <div style="width:84px;height:84px;border-radius:24px;background:linear-gradient(135deg,var(--accent),#4a34c9);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:28px;box-shadow:0 20px 50px rgba(124,92,255,.4);margin-bottom:20px;">AS</div>
      <div style="font-size:26px;font-weight:800;margin-bottom:8px;">Apex Surge</div>
      <div style="color:var(--text-dim);font-size:14px;line-height:1.6;max-width:260px;margin-bottom:36px;">Don't just learn what the world's best books say. Turn their ideas into a program that helps you actually change.</div>
      <button class="btn" data-go="welcome">Get Started</button>
    </div>`;
  }
};

SCREENS['welcome'] = {
  render(){
    return `<div class="center-col" style="padding-top:40px;">
      <div class="eyebrow">Welcome</div>
      <div class="h1">Knowledge that turns into change.</div>
      <p class="sub">Most learning apps stop at "here's what the book says." Apex Surge turns each idea into a real-world experiment, tracks what happens, and adapts tomorrow's learning to you.</p>
      <div class="card card-soft" style="width:100%;text-align:left;">
        <div class="card-row" style="margin-bottom:10px;"><span>📚</span><span style="flex:1;font-size:13px;">Learn a 5–10 min idea from the best books</span></div>
        <div class="card-row" style="margin-bottom:10px;"><span>🧪</span><span style="flex:1;font-size:13px;">AI turns it into an experiment for your life</span></div>
        <div class="card-row"><span>📈</span><span style="flex:1;font-size:13px;">We track what happens and adapt with you</span></div>
      </div>
      <button class="btn" style="margin-top:18px;" data-go="onboard-why">Continue</button>
    </div>`;
  }
};

SCREENS['onboard-why'] = {
  render(){
    return `
    <div class="steps-row"><div class="done"></div><div></div><div></div><div></div><div></div></div>
    <div class="eyebrow">Step 1 of 5</div>
    <div class="h1">Why do you want to grow right now?</div>
    <p class="sub">There's no wrong answer — this just helps us understand what's on your mind.</p>
    <textarea id="whyInput" rows="5" placeholder="e.g. I keep putting off important things and I want that to change...">${STATE.onboarding.why}</textarea>
    <button class="btn" style="margin-top:20px;" id="whyNext" data-go="onboard-areas">Continue</button>`;
  },
  after(el){
    const ta = el.querySelector('#whyInput');
    ta.addEventListener('input', ()=>{ STATE.onboarding.why = ta.value; save(); });
  }
};

SCREENS['onboard-areas'] = {
  render(){
    return `
    <div class="steps-row"><div class="done"></div><div class="done"></div><div></div><div></div><div></div></div>
    <div class="eyebrow">Step 2 of 5</div>
    <div class="h1">Choose 1–3 life areas to focus on</div>
    <p class="sub">We'll build your Growth Journeys around these.</p>
    <div class="chip-row" id="areaChips">
      ${DATA.areas.map(a=>`<button class="chip ${STATE.onboarding.areas.includes(a.id)?'selected':''}" data-area="${a.id}">${a.ico} ${a.label}</button>`).join('')}
    </div>
    <button class="btn" style="margin-top:22px;" id="areasNext">Continue</button>`;
  },
  after(el){
    const chips = el.querySelectorAll('[data-area]');
    chips.forEach(c=>c.addEventListener('click', ()=>{
      const id = c.dataset.area;
      const arr = STATE.onboarding.areas;
      const idx = arr.indexOf(id);
      if(idx>-1) arr.splice(idx,1);
      else if(arr.length<3) arr.push(id);
      save();
      c.classList.toggle('selected');
    }));
    el.querySelector('#areasNext').addEventListener('click', ()=>{
      if(STATE.onboarding.areas.length===0){ alert('Pick at least 1 area to continue.'); return; }
      go('onboard-challenge');
    });
  }
};

SCREENS['onboard-challenge'] = {
  render(){
    return `
    <div class="steps-row"><div class="done"></div><div class="done"></div><div class="done"></div><div></div><div></div></div>
    <div class="eyebrow">Step 3 of 5</div>
    <div class="h1">What's your biggest challenge right now?</div>
    <p class="sub">Be specific — this becomes the seed of your first Growth Journey.</p>
    <textarea id="challengeInput" rows="4" placeholder="e.g. I avoid difficult conversations with my team">${STATE.onboarding.challenge}</textarea>
    <div class="chip-row">
      ${['Procrastination','Confidence','Delegation','Focus','Difficult conversations'].map(t=>`<button class="chip" data-fill="${t}">${t}</button>`).join('')}
    </div>
    <button class="btn" style="margin-top:16px;" data-go="onboard-time">Continue</button>`;
  },
  after(el){
    const ta = el.querySelector('#challengeInput');
    ta.addEventListener('input', ()=>{ STATE.onboarding.challenge = ta.value; save(); });
    el.querySelectorAll('[data-fill]').forEach(c=>c.addEventListener('click', ()=>{
      ta.value = c.dataset.fill; STATE.onboarding.challenge = c.dataset.fill; save();
    }));
  }
};

SCREENS['onboard-time'] = {
  render(){
    return `
    <div class="steps-row"><div class="done"></div><div class="done"></div><div class="done"></div><div class="done"></div><div></div></div>
    <div class="eyebrow">Step 4 of 5</div>
    <div class="h1">How much time can you give daily?</div>
    <p class="sub">We'll size your daily mission to fit.</p>
    <div class="chip-row">
      ${DATA.timeOptions.map(t=>`<button class="chip ${STATE.onboarding.time===t?'selected':''}" data-time="${t}">${t} min</button>`).join('')}
    </div>
    <button class="btn" style="margin-top:22px;" data-go="onboard-style">Continue</button>`;
  },
  after(el){
    el.querySelectorAll('[data-time]').forEach(c=>c.addEventListener('click', ()=>{
      STATE.onboarding.time = Number(c.dataset.time); save();
      el.querySelectorAll('[data-time]').forEach(x=>x.classList.remove('selected'));
      c.classList.add('selected');
    }));
  }
};

SCREENS['onboard-style'] = {
  render(){
    return `
    <div class="steps-row"><div class="done"></div><div class="done"></div><div class="done"></div><div class="done"></div><div class="done"></div></div>
    <div class="eyebrow">Step 5 of 5</div>
    <div class="h1">Choose your learning style</div>
    <p class="sub">You can change this any time in settings.</p>
    ${DATA.styleOptions.map(s=>`
      <div class="select-card ${STATE.onboarding.style===s.id?'selected':''}" data-style="${s.id}">
        <div class="ico">${s.ico}</div>
        <div class="txt"><div class="ttl">${s.label}</div><div class="dsc">${s.dsc}</div></div>
        <div class="check-circle">✓</div>
      </div>`).join('')}
    <button class="btn" style="margin-top:14px;" data-go="onboard-generating">Create my Growth Profile</button>`;
  },
  after(el){
    el.querySelectorAll('[data-style]').forEach(c=>c.addEventListener('click', ()=>{
      STATE.onboarding.style = c.dataset.style; save();
      el.querySelectorAll('[data-style]').forEach(x=>x.classList.remove('selected'));
      c.classList.add('selected');
    }));
  }
};

SCREENS['onboard-generating'] = {
  render(){
    return `<div class="center-col" style="padding-top:80px;">
      <div class="loader-ring"></div>
      <div class="h2">Building your Growth Profile…</div>
      <p class="sub" id="genStatus">Reading what you told us</p>
    </div>`;
  },
  after(el){
    const msgs = [
      'Reading what you told us',
      'Matching ideas across 300+ books',
      'Designing your first 7-day journey',
      'Almost ready…',
    ];
    let i=0;
    const status = el.querySelector('#genStatus');
    const iv = setInterval(()=>{
      i++;
      if(i<msgs.length){ status.textContent = msgs[i]; }
      else { clearInterval(iv); go('onboard-ready', {replace:true}); }
    }, 700);
  }
};

SCREENS['onboard-ready'] = {
  render(){
    const areaLabels = STATE.onboarding.areas.map(id=>DATA.areas.find(a=>a.id===id)?.label).filter(Boolean).join(', ') || 'your goals';
    return `<div class="center-col" style="padding-top:16px;">
      <div class="eyebrow">Your Growth Profile is ready</div>
      <div class="h1">Your first 7-day journey</div>
      <p class="sub">Built around ${areaLabels}, based on what you told us about "${(STATE.onboarding.challenge||'what you want to change').slice(0,60)}".</p>
      <div class="card" style="width:100%;text-align:left;">
        <div class="tag">Day 1</div>
        <div style="font-weight:800;margin:10px 0 4px;font-size:15px;">Why willpower fails — and what actually works</div>
        <div class="sub" style="margin-bottom:0;">A ${STATE.onboarding.time}-minute lesson + one real-world experiment.</div>
      </div>
      <button class="btn" style="width:100%;" data-go="today" data-root="1">Enter Apex Surge</button>
    </div>`;
  }
};

/* ============ TODAY / DAILY LOOP ============ */

SCREENS['today'] = {
  tab:'today',
  render(){
    const s = STATE.today;
    return `
    <div class="card-row" style="margin-bottom:18px;">
      <div>
        <div style="font-size:12px;color:var(--text-faint);">Good morning 👋</div>
        <div class="h2" style="margin:2px 0 0;">Your Today</div>
      </div>
      <div class="pill-score" data-tabval="playbook">🔥 12 day streak</div>
    </div>

    <div class="card" style="background:linear-gradient(160deg,#241a3d,#171b24);border-color:#3a2c66;">
      <div class="eyebrow">Today's Mission · ${STATE.onboarding.time||10} min</div>
      <div style="font-weight:800;font-size:17px;margin-bottom:6px;">${s.missionDone? 'Mission complete ✓' : 'Why willpower fails — and what actually works'}</div>
      <div class="sub" style="margin-bottom:14px;">Based on Atomic Habits · James Clear</div>
      ${s.missionDone
        ? `<button class="btn secondary" data-go="today-experiment-active">Review your experiment</button>`
        : `<button class="btn" data-go="today-lesson">Start</button>`}
    </div>

    <div class="stat-grid">
      <div class="stat-box"><div class="stat-num">${STATE.growthScore}</div><div class="stat-lbl">Growth Score</div></div>
      <div class="stat-box"><div class="stat-num">45%</div><div class="stat-lbl">Application rate</div></div>
    </div>

    <div class="field-label">Continue your journey</div>
    <div class="card card-soft" data-go="growth-detail">
      <div class="card-row">
        <div>
          <div style="font-weight:700;font-size:13.5px;">Become a Better Leader</div>
          <div class="sub" style="margin:4px 0 8px;">Week 4 of 8</div>
        </div>
        <div style="font-size:13px;color:var(--text-faint);">72%</div>
      </div>
      <div class="progressbar"><div style="width:72%"></div></div>
    </div>

    <div class="field-label">Quick actions</div>
    <div class="card card-soft" data-go="coach-chat" style="margin-bottom:8px;">
      <div class="card-row"><span style="font-size:13.5px;">✦ Ask the AI Coach something</span><span>›</span></div>
    </div>
    <div class="card card-soft" data-go="weekly-intro">
      <div class="card-row"><span style="font-size:13.5px;">📝 Start your Weekly Review</span><span>›</span></div>
    </div>
    `;
  },
  after(el){
    el.querySelector('[data-tabval]')?.addEventListener('click', ()=> go('playbook', {root:true}));
  }
};

SCREENS['today-lesson'] = {
  back:true,
  render(){
    const L = DATA.lesson;
    return `${topbar('Lesson', {back:true})}
    <div class="tag">${L.tag}</div>
    <div class="h1" style="margin-top:10px;">${L.title}</div>
    ${L.body.map(p=>`<p class="sub">${p}</p>`).join('')}
    <button class="btn" data-go="today-lesson-q">Continue</button>`;
  }
};

SCREENS['today-lesson-q'] = {
  back:true,
  render(){
    const q = DATA.lesson.question;
    const chosen = STATE.today.quizAnswer;
    return `${topbar('Check your understanding', {back:true})}
    <div class="eyebrow">Quick check</div>
    <div class="h2">${q.prompt}</div>
    <div style="margin-top:14px;" id="qOpts">
      ${q.options.map((o,i)=>`
        <div class="select-card" data-opt="${i}">
          <div class="txt"><div class="ttl" style="font-weight:600;font-size:13.5px;">${o}</div></div>
          <div class="check-circle">✓</div>
        </div>`).join('')}
    </div>
    <div id="qFeedback"></div>
    <button class="btn" id="qNext" style="margin-top:8px;" disabled>Continue</button>`;
  },
  after(el){
    const q = DATA.lesson.question;
    const next = el.querySelector('#qNext');
    el.querySelectorAll('[data-opt]').forEach(card=>card.addEventListener('click', ()=>{
      el.querySelectorAll('[data-opt]').forEach(c=>c.classList.remove('selected'));
      card.classList.add('selected');
      STATE.today.quizAnswer = Number(card.dataset.opt); save();
      const correct = STATE.today.quizAnswer === q.correct;
      el.querySelector('#qFeedback').innerHTML = `<div class="card card-soft" style="margin-top:14px;border-color:${correct? 'var(--accent-3)':'var(--danger)'}">
        <div style="font-weight:700;font-size:13px;color:${correct?'var(--accent-3)':'var(--danger)'};margin-bottom:4px;">${correct? 'Correct' : 'Not quite'}</div>
        <div class="sub" style="margin-bottom:0;">${q.explain}</div>
      </div>`;
      next.removeAttribute('disabled');
      next.setAttribute('data-go','today-reflection');
    }));
  }
};

SCREENS['today-reflection'] = {
  back:true,
  render(){
    return `${topbar('Apply this to you', {back:true})}
    <div class="eyebrow">Make it personal</div>
    <div class="h1">What are you currently procrastinating on?</div>
    <p class="sub">Be honest — the more specific, the better your experiment will be.</p>
    <textarea id="reflectInput" rows="4" placeholder="e.g. I keep postponing my presentation prep">${STATE.today.reflection}</textarea>
    <button class="btn" style="margin-top:18px;" id="reflectNext" disabled>Show me my pattern</button>`;
  },
  after(el){
    const ta = el.querySelector('#reflectInput');
    const btn = el.querySelector('#reflectNext');
    const sync = ()=>{ btn.toggleAttribute('disabled', ta.value.trim().length<4); };
    ta.addEventListener('input', ()=>{ STATE.today.reflection = ta.value; save(); sync(); });
    sync();
    btn.addEventListener('click', ()=> go('today-personal-example'));
  }
};

SCREENS['today-personal-example'] = {
  back:true,
  render(){
    const txt = STATE.today.reflection || 'your presentation prep';
    return `${topbar('Your pattern', {back:true})}
    <div class="eyebrow">AI diagnosis</div>
    <div class="h1">Your Procrastination Pattern</div>
    <div class="card card-soft">
      <div class="card-row" style="margin-bottom:10px;"><span style="color:var(--text-faint);font-size:12px;">TRIGGER</span><span style="font-size:13px;font-weight:700;">Task feels too large</span></div>
      <div class="card-row" style="margin-bottom:10px;"><span style="color:var(--text-faint);font-size:12px;">BEHAVIOR</span><span style="font-size:13px;font-weight:700;">You switch to email / social</span></div>
      <div class="card-row"><span style="color:var(--text-faint);font-size:12px;">UNDERLYING ISSUE</span><span style="font-size:13px;font-weight:700;">Uncertainty where to start</span></div>
    </div>
    <div class="quote-block">"${txt}" — logged just now</div>
    <div class="field-label">Based on ideas you've learned</div>
    <div class="chip-row">
      <span class="chip">📕 Atomic Habits</span>
      <span class="chip">📕 Eat That Frog</span>
      <span class="chip">📕 Deep Work</span>
    </div>
    <button class="btn" style="margin-top:16px;" data-go="today-experiment">Build my experiment</button>`;
  }
};

SCREENS['today-experiment'] = {
  back:true,
  render(){
    return `${topbar('Your experiment', {back:true})}
    <div class="eyebrow">Behavior experiment</div>
    <div class="h1">Tomorrow at 9:30 AM</div>
    <div class="card">
      <div style="font-weight:700;font-size:15px;margin-bottom:8px;">Open the presentation and write only the 3 key messages.</div>
      <div class="sub" style="margin-bottom:0;">Duration: 10 minutes · 5-day experiment</div>
    </div>
    <p class="sub">We'll remind you, track whether it happens, and ask what got in the way on days it doesn't.</p>
    <button class="btn success" data-go="today-experiment-active">Start Experiment</button>`;
  }
};

SCREENS['today-experiment-active'] = {
  back:true,
  render(){
    const days = STATE.today.experimentDays;
    return `${topbar('Experiment tracker', {back:true})}
    <div class="eyebrow">Day 5 of 5</div>
    <div class="h1">Open the deck, write 3 key messages</div>
    <div class="day-track">
      ${days.map((d,i)=> i<4
        ? `<div class="day-dot ${d?'done':'missed'}">${d?'✓':'✕'}</div>`
        : `<div class="day-dot today" data-todaydot>${d?'✓':(i+1)}</div>`
      ).join('')}
    </div>
    <div class="card card-soft">
      <div class="card-row">
        <span style="font-size:13.5px;">Did you complete today's step?</span>
        <button class="btn small success" id="markDone" ${days[4]?'disabled':''}>${days[4]?'Done ✓':'Mark done'}</button>
      </div>
    </div>
    <button class="btn" style="margin-top:10px;" data-go="today-experiment-reflect">Finish 5-day experiment</button>`;
  },
  after(el){
    el.querySelector('#markDone').addEventListener('click', (e)=>{
      STATE.today.experimentDays[4] = true; save();
      e.target.textContent='Done ✓'; e.target.setAttribute('disabled','1');
      el.querySelector('[data-todaydot]').classList.add('done');
      el.querySelector('[data-todaydot]').textContent='✓';
    });
  }
};

SCREENS['today-experiment-reflect'] = {
  back:true,
  render(){
    return `${topbar('Reflection', {back:true})}
    <div class="eyebrow">What made day 3 different?</div>
    <div class="h1">You missed Day 3. What happened?</div>
    <div class="chip-row">
      ${['I came home late','I forgot','It felt pointless','Something urgent came up'].map(o=>`<button class="chip" data-reason="${o}">${o}</button>`).join('')}
    </div>
    <div class="card card-soft" id="insightCard" style="display:none;margin-top:14px;">
      <div style="font-weight:700;font-size:13.5px;margin-bottom:6px;">Your habit fails mainly when your evening routine changes.</div>
      <div class="sub" style="margin-bottom:0;">Suggested fix: move this habit to your morning routine, right after your coffee.</div>
    </div>
    <button class="btn" style="margin-top:16px;" data-go="today-complete">Update my strategy</button>`;
  },
  after(el){
    el.querySelectorAll('[data-reason]').forEach(c=>c.addEventListener('click', ()=>{
      el.querySelectorAll('[data-reason]').forEach(x=>x.classList.remove('selected'));
      c.classList.add('selected');
      el.querySelector('#insightCard').style.display='block';
    }));
  }
};

SCREENS['today-complete'] = {
  render(){
    STATE.today.missionDone = true; save();
    return `<div class="center-col" style="padding-top:50px;">
      <div style="font-size:52px;margin-bottom:10px;">🌱</div>
      <div class="h1">Mission complete</div>
      <p class="sub">Your strategy has been updated — tomorrow this habit moves to your morning routine.</p>
      <div class="stat-grid" style="width:100%;">
        <div class="stat-box"><div class="stat-num">+3</div><div class="stat-lbl">Growth Score</div></div>
        <div class="stat-box"><div class="stat-num">13🔥</div><div class="stat-lbl">Day streak</div></div>
      </div>
      <button class="btn" style="width:100%;margin-top:18px;" data-go="today" data-root="1">Back to Today</button>
    </div>`;
  }
};

/* ============ EXPLORE / BOOKS ============ */

SCREENS['explore'] = {
  tab:'explore',
  render(){
    return `
    <div class="h2">Explore</div>
    <p class="sub">Books and ideas, matched to what you're working on.</p>
    <input type="text" placeholder="Search books, ideas, topics" style="margin-bottom:16px;" />
    <div class="field-label">Recommended for your Leadership journey</div>
    ${DATA.books.slice(0,4).map(b=>`
      <div class="list-item" data-go="book-detail" data-book="${b.id}">
        ${bookCoverHtml(b)}
        <div style="flex:1;">
          <div style="font-weight:700;font-size:14px;">${b.title}</div>
          <div class="sub" style="margin:2px 0 6px;">${b.author}</div>
          <span class="tag">${b.tag}</span>
        </div>
        <span style="color:var(--text-faint);">›</span>
      </div>`).join('')}
    <div class="field-label">All books</div>
    ${DATA.books.slice(4).map(b=>`
      <div class="list-item" data-go="book-detail" data-book="${b.id}">
        ${bookCoverHtml(b)}
        <div style="flex:1;">
          <div style="font-weight:700;font-size:14px;">${b.title}</div>
          <div class="sub" style="margin:2px 0 6px;">${b.author}</div>
          <span class="tag">${b.tag}</span>
        </div>
        <span style="color:var(--text-faint);">›</span>
      </div>`).join('')}
    `;
  }
};

SCREENS['book-detail'] = {
  back:true,
  render(){
    const d = DATA.bookDetail;
    return `${topbar('Book', {back:true})}
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">
      ${bookCoverHtml(DATA.books[0], 64, 86)}
      <div>
        <div style="font-weight:800;font-size:17px;">${d.title}</div>
        <div class="sub" style="margin:2px 0 0;">${d.author}</div>
      </div>
    </div>
    <div class="card" style="border-color:#3a2c66;background:linear-gradient(160deg,#241a3d,#171b24);">
      <div class="eyebrow">Why this is relevant to you</div>
      <div style="font-size:13.5px;line-height:1.55;">${d.relevance}</div>
    </div>
    <div class="field-label">Key idea</div>
    <p class="sub">${d.keyIdea}</p>
    <div class="field-label">Example</div>
    <p class="sub">${d.example}</p>
    <div class="btn-stack">
      <button class="btn secondary" data-go="book-quiz">Take the quiz</button>
      <button class="btn" data-go="book-apply">Apply this to my life</button>
    </div>`;
  }
};

SCREENS['book-quiz'] = {
  back:true,
  render(){
    return `${topbar('Quick quiz', {back:true})}
    <div class="eyebrow">Atomic Habits</div>
    <div class="h2">What's the "two-minute rule"?</div>
    <div style="margin-top:14px;">
      ${['Every habit should take under 2 minutes','Scale a new habit down until it takes 2 minutes to start','Review habits every 2 minutes of downtime'].map((o,i)=>`
        <div class="select-card" data-qopt="${i}">
          <div class="txt"><div class="ttl" style="font-weight:600;font-size:13.5px;">${o}</div></div>
          <div class="check-circle">✓</div>
        </div>`).join('')}
    </div>
    <div id="bqFeedback"></div>
    <button class="btn" id="bqNext" style="margin-top:10px;" disabled data-go="book-apply">Continue</button>`;
  },
  after(el){
    el.querySelectorAll('[data-qopt]').forEach(c=>c.addEventListener('click', ()=>{
      el.querySelectorAll('[data-qopt]').forEach(x=>x.classList.remove('selected'));
      c.classList.add('selected');
      const correct = c.dataset.qopt==='1';
      el.querySelector('#bqFeedback').innerHTML = `<div class="card card-soft" style="margin-top:14px;border-color:${correct?'var(--accent-3)':'var(--danger)'}">
        <div style="font-weight:700;font-size:13px;color:${correct?'var(--accent-3)':'var(--danger)'};">${correct?'Correct!':'Close — here\'s the idea'}</div>
        <div class="sub" style="margin-bottom:0;">Scale any habit down until its first step takes under 2 minutes — that's the whole trick.</div>
      </div>`;
      el.querySelector('#bqNext').removeAttribute('disabled');
    }));
  }
};

SCREENS['book-apply'] = {
  back:true,
  render(){
    return `${topbar('Apply this', {back:true})}
    <div class="eyebrow">Make it real</div>
    <div class="h1">Where would you like to apply it?</div>
    <div class="chip-row">
      ${DATA.areas.map(a=>`<button class="chip ${STATE.explore.applyArea===a.id?'selected':''}" data-applyarea="${a.id}">${a.ico} ${a.label}</button>`).join('')}
    </div>
    <div class="field-label">What behavior are you trying to change?</div>
    <textarea id="applyBehavior" rows="3" placeholder="e.g. Checking Slack constantly">${STATE.explore.applyBehavior}</textarea>
    <button class="btn" style="margin-top:16px;" id="applyNext" disabled>Build my experiment</button>`;
  },
  after(el){
    const btn = el.querySelector('#applyNext');
    const ta = el.querySelector('#applyBehavior');
    const sync = ()=> btn.toggleAttribute('disabled', !STATE.explore.applyArea || ta.value.trim().length<3);
    el.querySelectorAll('[data-applyarea]').forEach(c=>c.addEventListener('click', ()=>{
      STATE.explore.applyArea = c.dataset.applyarea; save();
      el.querySelectorAll('[data-applyarea]').forEach(x=>x.classList.remove('selected'));
      c.classList.add('selected'); sync();
    }));
    ta.addEventListener('input', ()=>{ STATE.explore.applyBehavior = ta.value; save(); sync(); });
    btn.addEventListener('click', ()=> go('book-apply-experiment'));
    sync();
  }
};

SCREENS['book-apply-experiment'] = {
  back:true,
  render(){
    const behavior = STATE.explore.applyBehavior || 'checking Slack constantly';
    return `${topbar('Your experiment', {back:true})}
    <div class="eyebrow">Generated for you</div>
    <div class="h1">For the next 3 workdays</div>
    <div class="card">
      <div style="font-weight:700;font-size:15px;margin-bottom:6px;">Check Slack only at 10:30, 1:00 and 4:00.</div>
      <div class="sub" style="margin-bottom:0;">Targets: "${behavior}"</div>
    </div>
    <button class="btn success" data-go="book-apply-saved">Start 3-Day Experiment</button>`;
  }
};

SCREENS['book-apply-saved'] = {
  render(){
    return `<div class="center-col" style="padding-top:60px;">
      <div style="font-size:48px;margin-bottom:10px;">✅</div>
      <div class="h1">Saved to your Playbook</div>
      <p class="sub">This experiment now lives in your Playbook and will check in with you daily.</p>
      <div class="btn-stack" style="width:100%;">
        <button class="btn" data-go="playbook" data-root="1">Go to Playbook</button>
        <button class="btn secondary" data-go="explore" data-root="1">Keep exploring</button>
      </div>
    </div>`;
  }
};

/* ============ MY GROWTH ============ */

SCREENS['growth-list'] = {
  tab:'growth-list',
  render(){
    return `
    <div class="h2">My Growth</div>
    <p class="sub">Your active transformation journeys.</p>
    <div class="card" data-go="growth-detail" style="border-color:#3a2c66;background:linear-gradient(160deg,#241a3d,#171b24);">
      <div class="card-row" style="margin-bottom:10px;">
        <div>
          <span class="tag">Active</span>
          <div style="font-weight:800;font-size:16px;margin-top:6px;">Become a Better Leader</div>
        </div>
        <div class="ring-wrap" style="width:56px;height:56px;">
          ${ring(72,56,7)}
          <div class="ring-center"><div style="font-size:13px;font-weight:800;">72%</div></div>
        </div>
      </div>
      <div class="sub" style="margin-bottom:0;">Week 4 of 8 · Executive presence</div>
    </div>
    <div class="field-label">Start something new</div>
    ${DATA.growthAreasCatalog.map(g=>`
      <div class="list-item" data-go="growth-new" data-goal="${g.id}">
        <div class="avatar-ring">${g.ico}</div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:14px;">${g.title}</div>
          <div class="sub" style="margin:2px 0 0;">${g.dsc}</div>
        </div>
        <span style="color:var(--text-faint);">›</span>
      </div>`).join('')}
    `;
  },
  after(el){
    el.querySelectorAll('[data-goal]').forEach(c=>c.addEventListener('click', ()=>{
      STATE.growth.selectedGoal = c.dataset.goal; save();
    }));
  }
};

SCREENS['growth-new'] = {
  back:true,
  render(){
    const goal = DATA.growthAreasCatalog.find(g=>g.id===STATE.growth.selectedGoal) || DATA.growthAreasCatalog[0];
    return `${topbar('New Journey', {back:true})}
    <div class="eyebrow">Step 1 of 2 · ${goal.title}</div>
    <div class="h1">Let's understand where you're starting from</div>
    <p class="sub">Rate yourself honestly — this isn't a test, it's a baseline so we can measure real change.</p>
    <div id="sliders">
      ${DATA.leaderAssessment.map(a=>`
      <div class="slider-row">
        <div class="slider-top"><span>${a.label}</span><b data-val="${a.id}">${a.v}</b>/10</div>
        <input type="range" min="1" max="10" value="${a.v}" data-slider="${a.id}" />
      </div>`).join('')}
    </div>
    <button class="btn" style="margin-top:8px;" data-go="growth-roadmap">See my roadmap</button>`;
  },
  after(el){
    el.querySelectorAll('[data-slider]').forEach(s=>s.addEventListener('input', ()=>{
      el.querySelector(`[data-val="${s.dataset.slider}"]`).textContent = s.value;
    }));
  }
};

SCREENS['growth-roadmap'] = {
  back:true,
  render(){
    return `${topbar('Your Roadmap', {back:true})}
    <div class="eyebrow">Step 2 of 2 · AI generated</div>
    <div class="h1">Become a Better Leader</div>
    <p class="sub">An 8-week roadmap built from Radical Candor, Dare to Lead and The One Minute Manager — sequenced around your lowest scores first.</p>
    ${DATA.roadmapWeeks.map(w=>`
      <div class="card card-soft" style="margin-bottom:8px;${w.current?'border-color:var(--accent);':''}">
        <div class="card-row">
          <div>
            <span class="tag ${w.done?'green':(w.current?'':'')}">Week ${w.week}</span>
            <div style="font-weight:700;font-size:13.5px;margin-top:6px;">${w.theme}</div>
            <div class="sub" style="margin:2px 0 0;">${w.focus}</div>
          </div>
          <div style="font-size:16px;">${w.done? '✅' : (w.current? '▶' : '')}</div>
        </div>
      </div>`).join('')}
    <button class="btn" style="margin-top:6px;" data-go="growth-detail" data-root="1">Start this journey</button>`;
  }
};

SCREENS['growth-detail'] = {
  back:true,
  render(){
    return `${topbar('Become a Better Leader', {back:true})}
    <div class="center-col" style="margin-bottom:6px;">
      <div class="ring-wrap">${ring(72)}
        <div class="ring-center"><div class="ring-val">72%</div><div class="ring-lbl">Week 4 of 8</div></div>
      </div>
    </div>
    <div class="field-label">You're working on</div>
    <div class="chip-row">
      <span class="chip selected">🧠 Strategic thinking</span>
      <span class="chip selected">💬 Difficult conversations</span>
      <span class="chip selected">👥 Delegation</span>
      <span class="chip selected">🎯 Executive presence</span>
    </div>
    <div class="card" style="background:linear-gradient(160deg,#241a3d,#171b24);border-color:#3a2c66;">
      <div class="eyebrow">Today's mission · 8 min</div>
      <div style="font-weight:800;font-size:15px;margin-bottom:8px;">Have one delegation conversation</div>
      <div class="sub" style="margin-bottom:12px;">Based on The One Minute Manager, Radical Candor, Dare to Lead</div>
      <button class="btn" data-go="today-lesson">Do it</button>
    </div>
    <div class="field-label">Roadmap</div>
    <button class="btn secondary" data-go="growth-roadmap">View full 8-week roadmap</button>
    <div class="field-label">Milestone</div>
    <div class="card card-soft">
      <div class="sub" style="margin-bottom:10px;">Complete week 8 to unlock your Leadership Playbook summary.</div>
      <button class="btn ghost small" data-go="growth-complete">Preview completion screen</button>
    </div>`;
  }
};

SCREENS['growth-complete'] = {
  back:true,
  render(){
    return `<div class="center-col" style="padding-top:24px;">
      <div style="font-size:52px;margin-bottom:8px;">🏆</div>
      <div class="h1">Journey complete</div>
      <p class="sub">Become a Better Leader · 8 weeks</p>
      <div class="stat-grid" style="width:100%;">
        <div class="stat-box"><div class="stat-num">5.2→7.6</div><div class="stat-lbl">Avg self-score</div></div>
        <div class="stat-box"><div class="stat-num">11</div><div class="stat-lbl">Experiments run</div></div>
      </div>
      <button class="btn" style="width:100%;margin-top:16px;" data-go="playbook" data-root="1">View my Leadership Playbook</button>
      <button class="btn secondary" style="width:100%;margin-top:10px;" data-go="growth-list" data-root="1">Back to My Growth</button>
    </div>`;
  }
};

/* ============ AI COACH + ROLEPLAY ============ */

SCREENS['coach-chat'] = {
  tab:'coach-chat',
  render(){
    const started = STATE.coach.messages.length>0;
    return `
    <div class="h2">AI Coach</div>
    <p class="sub">Grounded in what you've actually learned — not a generic chatbot.</p>
    <div id="chatLog">
      ${!started ? `<div class="msg system">Try one of these, or type your own</div>` : ''}
      ${STATE.coach.messages.map(m=>`<div class="msg ${m.role}">${m.text}</div>`).join('')}
    </div>
    ${!started ? `<div class="chip-row">${DATA.coachOpeners.map(o=>`<button class="chip" data-opener="${o}">${o}</button>`).join('')}</div>` : ''}
    <div style="display:flex;gap:8px;margin-top:14px;position:sticky;bottom:0;">
      <input type="text" id="chatInput" placeholder="Type what's on your mind..." />
      <button class="btn small" id="chatSend" style="width:auto;">→</button>
    </div>
    `;
  },
  after(el){
    const log = el.querySelector('#chatLog');
    const input = el.querySelector('#chatInput');
    function scrollDown(){ el.closest('.screens').scrollTop = el.closest('.screens').scrollHeight; }

    function userSend(text){
      if(!text.trim()) return;
      STATE.coach.messages.push({role:'user', text}); save();
      log.insertAdjacentHTML('beforeend', `<div class="msg user">${text}</div>`);
      log.insertAdjacentHTML('beforeend', `<div class="msg ai thinking" id="thinkingBubble"><span></span><span></span><span></span></div>`);
      scrollDown();
      setTimeout(()=>{
        el.querySelector('#thinkingBubble')?.remove();
        const reply = `I understand this connects to what you've been working on. ${DATA.coachReply.context}`;
        STATE.coach.messages.push({role:'ai', text:reply}); save();
        log.insertAdjacentHTML('beforeend', `<div class="msg ai">${reply}</div>`);
        log.insertAdjacentHTML('beforeend', `<div class="msg ai"><b>Before you speak:</b><br>${DATA.coachReply.steps.map((s,i)=>`${i+1}. ${s}`).join('<br>')}</div>`);
        log.insertAdjacentHTML('beforeend', `<div style="margin-top:10px;"><button class="btn small" data-go="coach-roleplay-offer">Practice this with me →</button></div>`);
        scrollDown();
        bindGoButtons(log);
      }, 1000);
    }

    el.querySelectorAll('[data-opener]').forEach(c=>c.addEventListener('click', ()=> userSend(c.dataset.opener)));
    el.querySelector('#chatSend').addEventListener('click', ()=>{ userSend(input.value); input.value=''; });
    input.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ userSend(input.value); input.value=''; } });
  }
};

SCREENS['coach-roleplay-offer'] = {
  back:true,
  render(){
    return `${topbar('Practice mode', {back:true})}
    <div class="eyebrow">Roleplay</div>
    <div class="h1">Want to practice the conversation?</div>
    <p class="sub">Choose who you'd like to practice with. The AI will play the role and score your response.</p>
    ${DATA.roleplayScenarios.map(s=>`
      <div class="select-card" data-scenario="${s.id}">
        <div class="ico">${s.ico}</div>
        <div class="txt"><div class="ttl">${s.label}</div><div class="dsc">${s.dsc}</div></div>
        <div class="check-circle">✓</div>
      </div>`).join('')}
    <button class="btn" id="rpStart" disabled>Start roleplay</button>`;
  },
  after(el){
    const btn = el.querySelector('#rpStart');
    el.querySelectorAll('[data-scenario]').forEach(c=>c.addEventListener('click', ()=>{
      el.querySelectorAll('[data-scenario]').forEach(x=>x.classList.remove('selected'));
      c.classList.add('selected');
      STATE.roleplay.scenario = c.dataset.scenario; save();
      btn.removeAttribute('disabled');
    }));
    btn.addEventListener('click', ()=> go('roleplay-chat'));
  }
};

SCREENS['roleplay-chat'] = {
  back:true,
  render(){
    const scenario = DATA.roleplayScenarios.find(s=>s.id===STATE.roleplay.scenario) || DATA.roleplayScenarios[0];
    return `${topbar('Roleplay · ' + scenario.label, {back:true})}
    <div class="msg system">You are speaking with your manager. Say your opening line.</div>
    <div id="rpLog">
      <div class="msg ai">Hey — you wanted to chat? I've got about 15 minutes.</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <input type="text" id="rpInput" placeholder="Type your response..." />
      <button class="btn small" id="rpSend" style="width:auto;">→</button>
    </div>`;
  },
  after(el){
    const log = el.querySelector('#rpLog');
    const input = el.querySelector('#rpInput');
    function send(){
      const text = input.value.trim();
      if(!text) return;
      STATE.roleplay.turns++; save();
      log.insertAdjacentHTML('beforeend', `<div class="msg user">${text}</div>`);
      input.value='';
      log.insertAdjacentHTML('beforeend', `<div class="msg ai thinking" id="rpThinking"><span></span><span></span><span></span></div>`);
      el.closest('.screens').scrollTop = el.closest('.screens').scrollHeight;
      setTimeout(()=>{
        el.querySelector('#rpThinking')?.remove();
        if(STATE.roleplay.turns<2){
          log.insertAdjacentHTML('beforeend', `<div class="msg ai">Okay — say more about why you feel that's the right move now?</div>`);
        } else {
          log.insertAdjacentHTML('beforeend', `<div class="msg ai">Got it, let me think it over and get back to you this week.</div>`);
          log.insertAdjacentHTML('beforeend', `<div style="margin-top:10px;"><button class="btn small" data-go="roleplay-feedback">See my feedback →</button></div>`);
          bindGoButtons(log);
        }
        el.closest('.screens').scrollTop = el.closest('.screens').scrollHeight;
      }, 900);
    }
    el.querySelector('#rpSend').addEventListener('click', send);
    input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') send(); });
  }
};

SCREENS['roleplay-feedback'] = {
  back:true,
  render(){
    return `${topbar('Your performance', {back:true})}
    <div class="eyebrow">Roleplay feedback</div>
    <div class="h1">Nice work — here's the breakdown</div>
    <div class="card card-soft">
      ${[['Clarity',8],['Confidence',6],['Evidence',9],['Assertiveness',5]].map(([k,v])=>`
        <div class="slider-row" style="margin-bottom:12px;">
          <div class="slider-top"><span>${k}</span><b>${v}/10</b></div>
          <div class="progressbar"><div style="width:${v*10}%"></div></div>
        </div>`).join('')}
    </div>
    <div class="card">
      <div style="font-weight:700;font-size:13.5px;margin-bottom:6px;">Where to improve</div>
      <div class="sub" style="margin-bottom:0;">You softened your request too much — try stating the outcome you want before explaining your reasoning.</div>
    </div>
    <div class="btn-stack">
      <button class="btn" data-go="roleplay-chat">Try again</button>
      <button class="btn secondary" data-go="coach-chat" data-root="1">Back to Coach</button>
    </div>`;
  }
};

/* ============ PLAYBOOK ============ */

SCREENS['playbook'] = {
  tab:'playbook',
  render(){
    const tab = STATE.playbookTab;
    const K = DATA.knowledgeGraph;
    const tabs = [
      ['principles','Principles'],['insights','Insights'],['experiments','Experiments'],
      ['works','What works'],['graph','Knowledge Graph']
    ];
    let body = '';
    if(tab==='principles'){
      body = DATA.playbook.principles.map(p=>`<div class="card card-soft">${p}</div>`).join('');
    } else if(tab==='insights'){
      body = DATA.playbook.insights.map(i=>`<div class="card card-soft"><span class="tag">${i.book}</span><div style="margin-top:8px;font-size:13.5px;">${i.text}</div></div>`).join('');
    } else if(tab==='experiments'){
      body = DATA.playbook.experiments.map(e=>`
        <div class="card card-soft">
          <div class="card-row">
            <span style="font-size:13.5px;font-weight:600;flex:1;">${e.title}</span>
            <span class="tag ${e.status==='adopted'?'green':'gold'}">${e.status}</span>
          </div>
          <div class="sub" style="margin:8px 0 0;">🔥 ${e.streak}-day streak</div>
        </div>`).join('');
    } else if(tab==='works'){
      body = DATA.playbook.worksForMe.map(w=>`<div class="card card-soft">✓ ${w}</div>`).join('');
    } else {
      body = `
      <div class="card" style="background:linear-gradient(160deg,#241a3d,#171b24);border-color:#3a2c66;">
        <div class="eyebrow">Knowledge → Action</div>
        <div class="stat-grid">
          <div class="stat-box"><div class="stat-num">${K.ideasLearned}</div><div class="stat-lbl">Ideas learned</div></div>
          <div class="stat-box"><div class="stat-num">${K.applied}</div><div class="stat-lbl">Applied</div></div>
          <div class="stat-box"><div class="stat-num">${K.experiments}</div><div class="stat-lbl">Experiments run</div></div>
          <div class="stat-box"><div class="stat-num">${K.adopted}</div><div class="stat-lbl">Adopted as habit</div></div>
        </div>
        <div style="margin-top:14px;">
          <div class="slider-top"><span>Application rate</span><b>${K.applicationRate}%</b></div>
          <div class="progressbar"><div style="width:${K.applicationRate}%"></div></div>
        </div>
      </div>
      <div class="card card-soft">
        <div style="font-weight:700;font-size:13.5px;margin-bottom:6px;">You're learning faster than you're applying.</div>
        <div class="sub" style="margin-bottom:10px;">7 ideas from the last 2 weeks haven't been turned into an experiment yet.</div>
        <button class="btn small" data-go="today" data-root="1">Apply one now</button>
      </div>`;
    }
    return `
    <div class="h2">My Playbook</div>
    <p class="sub">Everything Apex Surge has learned about you.</p>
    <div class="playbook-tabs">
      ${tabs.map(([id,label])=>`<button class="pb-tab ${tab===id?'active':''}" data-pbtab="${id}">${label}</button>`).join('')}
    </div>
    <div id="pbBody">${body}</div>
    `;
  },
  after(el){
    el.querySelectorAll('[data-pbtab]').forEach(t=>t.addEventListener('click', ()=>{
      STATE.playbookTab = t.dataset.pbtab; save();
      renderScreen('playbook');
    }));
  }
};

/* ============ WEEKLY REVIEW ============ */

SCREENS['weekly-intro'] = {
  back:true,
  render(){
    return `${topbar('Weekly Review', {back:true})}
    <div class="center-col">
      <div style="font-size:44px;margin-bottom:10px;">📝</div>
      <div class="h1">Your week in review</div>
      <p class="sub">Five quick questions. This is how Apex Surge adapts next week's plan to you.</p>
    </div>
    <button class="btn" data-go="weekly-q1">Start (2 min)</button>`;
  }
};

SCREENS['weekly-q1'] = {
  back:true,
  render(){
    return `${topbar('1 of 3', {back:true})}
    <div class="h1">What did you learn this week?</div>
    <div class="chip-row">
      ${['Habit design','Delegation','Difficult conversations','Focus','Confidence'].map(o=>`<button class="chip" data-wk="${o}">${o}</button>`).join('')}
    </div>
    <button class="btn" style="margin-top:20px;" data-go="weekly-q2">Continue</button>`;
  },
  after(el){
    el.querySelectorAll('[data-wk]').forEach(c=>c.addEventListener('click', ()=> c.classList.toggle('selected')));
  }
};

SCREENS['weekly-q2'] = {
  back:true,
  render(){
    return `${topbar('2 of 3', {back:true})}
    <div class="h1">What did you actually apply?</div>
    <textarea rows="4" placeholder="e.g. Tried the Slack check-window experiment"></textarea>
    <button class="btn" style="margin-top:18px;" data-go="weekly-q3">Continue</button>`;
  }
};

SCREENS['weekly-q3'] = {
  back:true,
  render(){
    return `${topbar('3 of 3', {back:true})}
    <div class="h1">What didn't work, and why?</div>
    <textarea rows="4" placeholder="e.g. Missed the evening habit — came home late"></textarea>
    <button class="btn" style="margin-top:18px;" data-go="weekly-summary">See my patterns</button>`;
  }
};

SCREENS['weekly-summary'] = {
  render(){
    const W = DATA.weeklyReview;
    return `<div class="center-col" style="padding-top:6px;">
      <div class="eyebrow">Pattern detected</div>
      <div class="h1">Here's what we noticed</div>
    </div>
    <div class="card" style="background:linear-gradient(160deg,#241a3d,#171b24);border-color:#3a2c66;">
      <div style="font-size:13.5px;line-height:1.6;">${W.pattern}</div>
    </div>
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-num">${W.learned}</div><div class="stat-lbl">Ideas learned</div></div>
      <div class="stat-box"><div class="stat-num">${W.applied}</div><div class="stat-lbl">Applied</div></div>
    </div>
    <div class="field-label">Next week's plan</div>
    <div class="card card-soft">
      <div class="sub" style="margin-bottom:0;">We've moved your evening habit to mornings and added one new experiment around delegation.</div>
    </div>
    <button class="btn" style="width:100%;margin-top:14px;" data-go="today" data-root="1">Back to Today</button>`;
  }
};

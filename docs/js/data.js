// Apex Surge — prototype content/data (static, illustrative)
const DATA = {
  areas: [
    { id:'career', label:'Career', ico:'💼' },
    { id:'confidence', label:'Confidence', ico:'⚡' },
    { id:'relationships', label:'Relationships', ico:'🤝' },
    { id:'money', label:'Money', ico:'💰' },
    { id:'health', label:'Health', ico:'🌿' },
    { id:'leadership', label:'Leadership', ico:'🧭' },
    { id:'productivity', label:'Productivity', ico:'⏱' },
    { id:'communication', label:'Communication', ico:'💬' },
    { id:'mindset', label:'Mindset', ico:'🧠' },
  ],

  timeOptions: [3,5,10,15,30],
  styleOptions: [
    { id:'text', label:'Text', dsc:'Read short lessons', ico:'📄' },
    { id:'audio', label:'Audio', dsc:'Listen on the go', ico:'🎧' },
    { id:'interactive', label:'Interactive', dsc:'Practice as you go', ico:'🎛' },
  ],

  books: [
    { id:'b1', title:'Atomic Habits', author:'James Clear', color:'#7c5cff', tag:'Habits', big:'AH' },
    { id:'b2', title:'Deep Work', author:'Cal Newport', color:'#2ee6a6', tag:'Focus', big:'DW' },
    { id:'b3', title:'Essentialism', author:'Greg McKeown', color:'#ff8a5c', tag:'Priorities', big:'ES' },
    { id:'b4', title:'Radical Candor', author:'Kim Scott', color:'#ffcf5c', tag:'Leadership', big:'RC' },
    { id:'b5', title:'Never Split the Difference', author:'Chris Voss', color:'#ff5c7a', tag:'Negotiation', big:'NS' },
    { id:'b6', title:'Mindset', author:'Carol Dweck', color:'#5cc8ff', tag:'Growth', big:'MS' },
    { id:'b7', title:'The Confidence Code', author:'Kay & Shipman', color:'#c084fc', tag:'Confidence', big:'CC' },
    { id:'b8', title:'Eat That Frog', author:'Brian Tracy', color:'#34d399', tag:'Productivity', big:'EF' },
  ],

  bookDetail: {
    id:'b1',
    title:'Atomic Habits',
    author:'James Clear',
    relevance:"You told us you're trying to stop postponing your presentation prep — this book's core model (cue → craving → response → reward) is the fastest lever for exactly that.",
    keyIdea:"Make the first step of a habit so small it's almost impossible to say no to.",
    example:"Instead of 'work on the presentation for 2 hours,' the rule becomes 'open the file and write one slide title.' Motivation follows the start, not the other way around.",
  },

  lesson: {
    tag:'Habits · 6 min',
    title:'Why willpower fails — and what actually works',
    body:[
      "Most people try to change behavior by relying on motivation. Motivation is unreliable — it's a feeling, and feelings fluctuate with sleep, stress and mood.",
      "What actually works is designing your environment so the right behavior requires the least friction, and the wrong behavior requires the most.",
      "This is why you check your phone more at home than at the gym — the cue density is different, not your willpower."
    ],
    question:{
      prompt:"Which of these is closest to what actually drives consistent behavior change?",
      options:[
        "Having more willpower and motivation",
        "Designing your environment to reduce friction",
        "Reading more books about the topic",
      ],
      correct:1,
      explain:"Environment design beats willpower almost every time — it removes the need to rely on motivation at all."
    }
  },

  growthAreasCatalog: [
    { id:'leader', title:'Become a Better Leader', ico:'🧭', dsc:'Delegation, difficult conversations, executive presence', weeks:8 },
    { id:'confidence', title:'Build Real Confidence', ico:'⚡', dsc:'Speak up, ask for what you want, handle pushback', weeks:6 },
    { id:'focus', title:'Reclaim Deep Focus', ico:'🎯', dsc:'Fewer distractions, more meaningful output', weeks:4 },
    { id:'newjob', title:'Nail Your New Job', ico:'🚀', dsc:'A 30-day plan for your first month', weeks:4 },
  ],

  leaderAssessment: [
    { id:'delegation', label:'Delegation', v:4 },
    { id:'comm', label:'Communication', v:6 },
    { id:'strategy', label:'Strategic thinking', v:5 },
    { id:'difficult', label:'Difficult conversations', v:3 },
    { id:'presence', label:'Executive presence', v:5 },
  ],

  roadmapWeeks: [
    { week:1, theme:'Foundations of Trust', focus:'Delegation basics', done:true },
    { week:2, theme:'Difficult Conversations', focus:'Radical candor framework', done:true },
    { week:3, theme:'Strategic Thinking', focus:'Zoom out before zoom in', done:true },
    { week:4, theme:'Executive Presence', focus:'Owning the room', done:false, current:true },
    { week:5, theme:'Delegating Outcomes', focus:'Not tasks, outcomes', done:false },
    { week:6, theme:'Giving Hard Feedback', focus:'Care personally, challenge directly', done:false },
    { week:7, theme:'Decision Making', focus:'Speed vs. reversibility', done:false },
    { week:8, theme:'Integration', focus:'Your leadership playbook', done:false },
  ],

  playbook: {
    principles: [
      "Protect deep work — my best thinking happens before 11am.",
      "Say no to low-value commitments before they become obligations.",
      "Prepare talking points before difficult conversations.",
    ],
    insights: [
      { book:'Atomic Habits', text:'I procrastinate when a task feels too large and undefined, not when I lack motivation.' },
      { book:'Essentialism', text:"I'm currently carrying 11 active commitments — most are self-imposed, not required." },
      { book:'Radical Candor', text:'I avoid difficult conversations by softening the ask until it disappears.' },
    ],
    experiments: [
      { title:'Slack check windows (10:30 / 1:00 / 4:00)', status:'active', streak:5 },
      { title:'5-min plan after brushing teeth', status:'adopted', streak:21 },
      { title:'Open the deck, write 1 slide title', status:'active', streak:3 },
    ],
    worksForMe: [
      '20-minute focus sessions beat 2-hour blocks I never start',
      'Written prep before hard conversations, not winging it',
      'Morning planning, not night-before planning',
    ],
  },

  knowledgeGraph: {
    ideasLearned: 47,
    applied: 21,
    experiments: 13,
    adopted: 7,
    applicationRate: 45,
  },

  coachOpeners: [
    "I'm afraid to ask my manager for a promotion.",
    "I keep procrastinating on my presentation.",
    "I feel overwhelmed by everything on my plate.",
  ],

  coachReply: {
    context: "You've been working on Confidence, Career Growth and Difficult Conversations — and you've learned ideas from The Confidence Code, Never Split the Difference and Radical Candor.",
    steps: [
      "Establish your contribution — name 2-3 concrete wins from this year.",
      "State your desired outcome clearly — don't hint at it.",
      "Ask a calibrated question — \"How would you feel about revisiting my level?\"",
      "Don't over-explain or apologize for asking.",
    ]
  },

  roleplayScenarios: [
    { id:'manager', label:'Your Manager', dsc:'Practice asking for a promotion', ico:'🧑‍💼' },
    { id:'report', label:'A Direct Report', dsc:'Practice giving hard feedback', ico:'🧑‍🤝‍🧑' },
    { id:'client', label:'A Difficult Client', dsc:'Practice holding a boundary', ico:'🗂' },
  ],

  weeklyReview: {
    learned: 5,
    applied: 3,
    experimentsRun: 4,
    pattern: "Your habits succeed 80% of the time in the morning and fail 60% of the time in the evening. Your environment changes more at night.",
  }
};

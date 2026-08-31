// Apex Surge — prototype state management
const STORAGE_KEY = 'apexSurgeProtoState';

function freshState(){
  return {
    onboarding:{
      why:'', areas:[], challenge:'', time:10, style:'interactive',
    },
    today:{
      missionDone:false,
      quizAnswer:null,
      reflection:'',
      experimentDays:[true,true,false,true,false], // day 1-5, index4 = today
    },
    explore:{ quizAnswer:null, applyArea:null, applyBehavior:'' },
    growth:{
      selectedGoal:null,
      assessment:null,
    },
    coach:{ messages:[], askedFollowup:false },
    roleplay:{ scenario:null, turns:0 },
    playbookTab:'principles',
    nav:{ current:'splash', stack:[], tab:null },
    growthScore: 78,
  };
}

let STATE = load();

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return Object.assign(freshState(), JSON.parse(raw));
  }catch(e){}
  return freshState();
}

function save(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE)); }catch(e){}
}

function resetState(){
  localStorage.removeItem(STORAGE_KEY);
  STATE = freshState();
  save();
}

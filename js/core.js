const STORAGE_KEY = 'salesshop-prototype-v1';
const STAGES = ['Discovery', 'Intent to Bid', 'Bid Development', 'Bid Sent', 'Negotiation', 'Closed Won', 'Closed Lost', 'Discarded'];
const CLOSED_STAGES = new Set(['Closed Won', 'Closed Lost', 'Discarded']);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = (prefix='id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const nowISO = () => new Date().toISOString();
const dateKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const fmtDate = (value, opts={month:'short', day:'numeric'}) => value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, opts) : '—';
const fmtTimestamp = (iso) => new Date(iso).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
const money = (value) => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:0}).format(Number(value || 0));
const escapeHtml = (str='') => String(str).replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));

function seedData() {
  const today = dateKey();
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate()-1);
  const yesterday = dateKey(yesterdayDate);
  const q1 = uid('quote');
  return {
    settings: {
      notebookMode:'daily',
      companyName:'World Stone',
      theme:'dark',
      collapsedStages:['Closed Lost','Discarded']
    },
    notebook: {
      [today]: [
        { id: uid('note'), createdAt: new Date().setHours(8,42,0,0), text: 'Riverwalk pricing is probably too tight on install. Check with Robert.', source:'typed' },
        { id: uid('note'), createdAt: new Date().setHours(10,15,0,0), text: 'Talked with John at ABC. Ownership may want a quartz alternate.', source:'typed' }
      ].map(n => ({...n, createdAt:new Date(n.createdAt).toISOString()})),
      [yesterday]: [
        { id: uid('note'), createdAt: new Date(yesterdayDate.getFullYear(), yesterdayDate.getMonth(), yesterdayDate.getDate(), 15, 40).toISOString(), text:'Greystone mentioned another multifamily job coming up in Spartanburg this winter.', source:'typed' }
      ]
    },
    workItems: [
      { id: uid('work'), title:'Riverwalk Apartments', company:'ABC Construction', stage:'Bid Development', due:today, amount:486000, nextAction:'Finish quartz alternate', lastTouchpoint:today },
      { id: uid('work'), title:'Oak Grove Phase II', company:'Greystone Builders', stage:'Bid Sent', due:'', amount:382000, nextAction:'Follow up with Sarah', lastTouchpoint:yesterday },
      { id: uid('work'), title:'Hampton Inn Greenville', company:'Choate Construction', stage:'Bid Development', due:'', amount:0, nextAction:'Verify room count', lastTouchpoint:'' }
    ],
    quotes: [
      { id:q1, quoteNumber:'Q-1001', title:'Riverwalk Apartments', customer:'ABC Construction', contact:'John Smith', createdAt:nowISO(), updatedAt:nowISO(), revision:0, status:'Draft', notes:'Pricing includes templating, fabrication, and standard installation.\nMaterial subject to final selection and availability.', lines:[
        {id:uid('line'), description:'Quartz countertops', qty:'', rate:'', amount:14500},
        {id:uid('line'), description:'Kitchen sinks', qty:12, rate:220, amount:2640},
        {id:uid('line'), description:'Installation allowance', qty:'', rate:'', amount:4200}
      ], revisions:[] }
    ],
    contacts: [
      {id:uid('contact'), name:'John Smith', company:'ABC Construction', detail:''},
      {id:uid('contact'), name:'Sarah Jones', company:'Greystone Builders', detail:''}
    ],
    companies: [
      {id:uid('company'), name:'ABC Construction'},
      {id:uid('company'), name:'Greystone Builders'}
    ],
    touchpoints: [], reminders: [], projectUpdates: []
  };
}

function normalizeState(raw) {
  const s = raw || seedData();
  s.settings = {...{notebookMode:'daily', companyName:'World Stone', theme:'dark', collapsedStages:['Closed Lost','Discarded']}, ...(s.settings||{})};
  if (!['dark','light'].includes(s.settings.theme)) s.settings.theme='dark';
  if (!Array.isArray(s.settings.collapsedStages)) s.settings.collapsedStages=['Closed Lost','Discarded'];
  s.settings.collapsedStages = [...new Set(s.settings.collapsedStages.filter(stage=>STAGES.includes(stage)))];
  const stageMap = {
    'New':'Discovery', 'Takeoff':'Bid Development', 'Pricing':'Bid Development', 'Review':'Bid Development',
    'Sent':'Bid Sent', 'Decision':'Negotiation', 'Awarded':'Closed Won'
  };
  (s.workItems||[]).forEach(w => { if(stageMap[w.stage]) w.stage=stageMap[w.stage]; if(!STAGES.includes(w.stage)) w.stage='Discovery'; });
  s.notebook ||= {}; s.workItems ||= []; s.quotes ||= []; s.contacts ||= []; s.companies ||= []; s.touchpoints ||= []; s.reminders ||= []; s.projectUpdates ||= [];
  return s;
}

let state = load();
let currentView = 'board';
let currentNotebookDate = dateKey();
let currentQuoteId = state.quotes[0]?.id || null;
let speech = null;
let speechTarget = null;
let selectedNotebookText = '';
let selectedNotebookEntryId = null;

function load() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedData()); }
  catch { return seedData(); }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function mutate(fn) { fn(); save(); applyTheme(); renderAll(); }
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add('hidden'), 2200);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.settings?.theme || 'dark';
  const btn = $('#themeToggleBtn');
  if (btn) {
    const dark = document.documentElement.dataset.theme === 'dark';
    btn.textContent = dark ? '☀' : '☾';
    btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  }
}
function toggleTheme() {
  state.settings.theme = (state.settings.theme || 'dark') === 'dark' ? 'light' : 'dark';
  save(); applyTheme();
}

function showView(name) {
  currentView = name;
  document.body.dataset.view = name;
  const workspace = $('#workspaceBody');
  workspace?.classList.toggle('notebook-focus', name === 'notebook');
  $$('.view').forEach(v => v.classList.remove('active'));
  if (name !== 'notebook') $(`#view-${name}`)?.classList.add('active');
  $$('.top-tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'notebook') currentNotebookDate = dateKey();
  renderAll();
}

function renderAll() {
  renderHome(); renderBoard(); renderNotebook(); renderQuotes(); renderMemory(); applyTheme();
}

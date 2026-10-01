const STORAGE_KEY = 'salesshop-prototype-v1';
const STAGES = ['New', 'Takeoff', 'Pricing', 'Review', 'Sent', 'Decision', 'Awarded'];

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
const escapeHtml = (str='') => str.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function seedData() {
  const today = dateKey();
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate()-1);
  const yesterday = dateKey(yesterdayDate);
  const q1 = uid('quote');
  return {
    settings: { notebookMode: 'daily', companyName: 'World Stone' },
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
      { id: uid('work'), title:'Riverwalk Apartments', company:'ABC Construction', stage:'Pricing', due:today, amount:486000, nextAction:'Finish quartz alternate', lastTouchpoint:today },
      { id: uid('work'), title:'Oak Grove Phase II', company:'Greystone Builders', stage:'Sent', due:'', amount:382000, nextAction:'Follow up with Sarah', lastTouchpoint:yesterday },
      { id: uid('work'), title:'Hampton Inn Greenville', company:'Choate Construction', stage:'Takeoff', due:'', amount:0, nextAction:'Verify room count', lastTouchpoint:'' }
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

let state = load();
let currentView = 'home';
let currentNotebookDate = dateKey();
let currentQuoteId = state.quotes[0]?.id || null;
let speech = null;
let selectedNotebookText = '';
let selectedNotebookEntryId = null;

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedData(); }
  catch { return seedData(); }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function mutate(fn) { fn(); save(); renderAll(); }
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add('hidden'), 2200);
}

function showView(name) {
  currentView = name;
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${name}`).classList.add('active');
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  renderAll();
}

function renderAll() {
  renderHome(); renderBoard(); renderNotebook(); renderQuotes(); renderMemory();
}

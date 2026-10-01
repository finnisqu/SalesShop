const STORAGE_KEY = 'salesshop-prototype-v1';
const STAGES = ['Discovery', 'Intent to Bid', 'Bid Development', 'Bid Sent', 'Negotiation', 'Closed Won', 'Closed Lost', 'Discarded'];
const CLOSED_STAGES = new Set(['Closed Won', 'Closed Lost', 'Discarded']);
const ACCOUNT_STAGES = ['Discovery', 'Outreach', 'Connected', 'Quoted', 'Won', 'Active', 'Cold', 'Lost'];
const ACCOUNT_BOARD_COLUMNS = [...ACCOUNT_STAGES, 'Non-Customer'];

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
const fmtDate = (value, opts={month:'short', day:'numeric'}) => value ? new Date(String(value).includes('T') ? value : `${value}T12:00:00`).toLocaleDateString(undefined, opts) : '—';
const fmtTimestamp = (iso) => new Date(iso).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
const money = (value) => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:0}).format(Number(value || 0));
const escapeHtml = (str='') => String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function hubSpotPrototypeData() {
  return {
    companies: [
      {id:'hub_company_54997524294', hubspotId:'54997524294', name:'D.A. Everett', domain:'daeverettgroup.com', contactCount:1, dealCount:0, source:'hubspot', accountType:'sales'},
      {id:'hub_company_56607598650', hubspotId:'56607598650', name:'pagegrace.com', domain:'pagegrace.com', contactCount:1, dealCount:0, lastContacted:'2026-09-22T16:00:15.556Z', lastEngagement:'2026-09-22T16:04:36.320Z', source:'hubspot', partial:true, accountType:'sales'},
      {id:'hub_company_16317301153', hubspotId:'16317301153', name:'D.R. Horton (DHI Communities)', domain:'drhorton.com', contactCount:16, dealCount:3, lastContacted:'2026-10-01T14:48:53.801Z', lastActivity:'2026-10-01T15:18:31Z', lastEngagement:'2026-10-01T15:18:39.908Z', source:'hubspot', accountType:'sales'},
      {id:'hub_company_16317510810', hubspotId:'16317510810', name:'BAR Construction', domain:'barconstruction.com', contactCount:9, dealCount:2, lastContacted:'2026-09-30T20:23:07.164Z', lastActivity:'2026-09-30T20:23:07.164Z', lastEngagement:'2026-09-29T16:11:05.815Z', source:'hubspot', accountType:'sales'},
      {id:'hub_company_16922951271', hubspotId:'16922951271', name:'RAYWEST DESIGNBUILD', domain:'raywestdesignbuild.com', contactCount:15, dealCount:17, lastContacted:'2026-09-23T20:25:24.302Z', lastActivity:'2026-09-25T13:05:12Z', lastEngagement:'2026-09-24T13:35:54.456Z', source:'hubspot', accountType:'sales'},
      {id:'hub_company_16317413965', hubspotId:'16317413965', name:'Choate Construction', domain:'choateco.com', contactCount:2, dealCount:1, lastActivity:'2025-12-31T13:00:00Z', source:'hubspot', accountType:'sales'},
      {id:'hub_company_35375111240', hubspotId:'35375111240', name:'Business Insurers of the Carolinas', domain:'business-insurers.com', contactCount:3, source:'hubspot', accountType:'non-customer', relationshipLabel:'Insurance'},
      {id:'hub_company_16317558121', hubspotId:'16317558121', name:'World Stone of Sanford', domain:'worldstoneonline.com', contactCount:30, source:'hubspot', accountType:'non-customer', relationshipLabel:'Internal'},
      {id:'hub_company_30256138930', hubspotId:'30256138930', name:'linnstone', domain:'linnstone.com', contactCount:6, source:'hubspot', accountType:'non-customer', relationshipLabel:'Supplier'},
      {id:'hub_company_38667169345', hubspotId:'38667169345', name:'PANMIN', domain:'panmin.com', contactCount:1, lastContacted:'2026-09-30T16:05:19.922Z', source:'hubspot', accountType:'non-customer', relationshipLabel:'Supplier'},
      {id:'hub_company_50538147405', hubspotId:'50538147405', name:'DEYUANS', domain:'deyuans.com', contactCount:1, lastContacted:'2026-09-30T16:05:19.922Z', source:'hubspot', accountType:'non-customer', relationshipLabel:'Supplier'}
    ],
    contacts: [
      {id:'hub_contact_97392940550', hubspotId:'97392940550', name:'Austin Riccio', company:'BAR Construction', companyId:'hub_company_16317510810', detail:'Estimating Manager', email:'ariccio@barconstruction.com', lastContacted:'2025-02-06T13:48:46.829Z', source:'hubspot'},
      {id:'hub_contact_3153', hubspotId:'3153', name:'Glenn Hodges', company:'BAR Construction', companyId:'hub_company_16317510810', detail:'President', email:'ghodges@barconstruction.com', lastContacted:'2026-08-20T22:04:37.624Z', source:'hubspot'}
    ],
    crmDeals: [
      {id:'hub_deal_35059218503', hubspotId:'35059218503', companyId:'hub_company_16317301153', name:'Collins Ridge', stage:'Negotiation', amount:521297.06, currency:'USD', closeDate:'2025-06-09T20:32:50.762Z', source:'hubspot'},
      {id:'hub_deal_19595660189', hubspotId:'19595660189', companyId:'hub_company_16317301153', name:'Mastermind', stage:'Closed Lost', amount:150000, currency:'USD', closeDate:'2024-08-26T14:49:48.823Z', source:'hubspot'},
      {id:'hub_deal_18312237058', hubspotId:'18312237058', companyId:'hub_company_16317301153', name:'Ascend Morganton Park North', stage:'Closed Lost', amount:480000, currency:'USD', closeDate:'2024-08-26T14:49:50.758Z', source:'hubspot'},
      {id:'hub_deal_44958018385', hubspotId:'44958018385', companyId:'hub_company_16317510810', name:'Blue Jay Park', stage:'Bid Sent', amount:14540, currency:'USD', source:'hubspot'},
      {id:'hub_deal_13981589341', hubspotId:'13981589341', companyId:'hub_company_16317510810', name:'Beech Bluff Park', stage:'Closed Won (Complete)', amount:18565, currency:'USD', closeDate:'2023-08-04T11:49:22.297Z', source:'hubspot'},
      {id:'hub_deal_54211716359', hubspotId:'54211716359', companyId:'hub_company_16922951271', name:'Burrito Shak - Kannapolis', stage:'Closed Won (Active)', amount:7239, currency:'USD', closeDate:'2026-05-14T19:37:34.079Z', source:'hubspot'},
      {id:'hub_deal_14710063401', hubspotId:'14710063401', companyId:'hub_company_16317413965', name:'Twin Lakes IL', stage:'Discarded', amount:100000, currency:'USD', closeDate:'2023-09-25T16:16:03.415Z', source:'hubspot'}
    ],
    workItems: [
      {id:'hub_work_35059218503', hubspotId:'35059218503', companyId:'hub_company_16317301153', title:'Collins Ridge', company:'D.R. Horton (DHI Communities)', stage:'Negotiation', due:'', amount:521297.06, nextAction:'', lastTouchpoint:'2026-10-01'},
      {id:'hub_work_44958018385', hubspotId:'44958018385', companyId:'hub_company_16317510810', title:'Blue Jay Park', company:'BAR Construction', stage:'Bid Sent', due:'', amount:14540, nextAction:'', lastTouchpoint:'2026-09-30'},
      {id:'hub_work_54211716359', hubspotId:'54211716359', companyId:'hub_company_16922951271', title:'Burrito Shak - Kannapolis', company:'RAYWEST DESIGNBUILD', stage:'Closed Won', due:'', amount:7239, nextAction:'', lastTouchpoint:'2026-09-23'},
      {id:'hub_work_14710063401', hubspotId:'14710063401', companyId:'hub_company_16317413965', title:'Twin Lakes IL', company:'Choate Construction', stage:'Discarded', due:'', amount:100000, nextAction:'', lastTouchpoint:''}
    ]
  };
}

function mergeById(target, additions) {
  const existing = new Set((target || []).map(x=>x.id));
  additions.forEach(item=>{ if(!existing.has(item.id)) target.push({...item}); });
}

function fillMissingById(target, additions) {
  additions.forEach(item=>{
    const existing=(target||[]).find(x=>x.id===item.id);
    if(!existing)return;
    Object.entries(item).forEach(([key,value])=>{
      if(existing[key]===undefined || existing[key]===null || existing[key]==='') existing[key]=value;
    });
  });
}

function seedData() {
  const today = dateKey();
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate()-1);
  const yesterday = dateKey(yesterdayDate);
  const q1 = uid('quote');
  const hub = hubSpotPrototypeData();
  return {
    settings: {
      notebookMode:'daily',
      companyName:'World Stone',
      theme:'dark',
      boardMode:'projects',
      collapsedStages:['Closed Lost','Discarded'],
      collapsedAccountStages:['Lost','Non-Customer']
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
      { id: uid('work'), title:'Hampton Inn Greenville', company:'Choate Construction', stage:'Bid Development', due:'', amount:0, nextAction:'Verify room count', lastTouchpoint:'' },
      ...hub.workItems
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
      {id:uid('contact'), name:'Sarah Jones', company:'Greystone Builders', detail:''},
      ...hub.contacts
    ],
    companies: [
      {id:uid('company'), name:'ABC Construction', accountType:'sales'},
      {id:uid('company'), name:'Greystone Builders', accountType:'sales'},
      ...hub.companies
    ],
    crmDeals: hub.crmDeals,
    touchpoints: [], reminders: [], projectUpdates: []
  };
}

function normalizeState(raw) {
  const s = raw || seedData();
  s.settings = {...{
    notebookMode:'daily', companyName:'World Stone', theme:'dark', boardMode:'projects',
    collapsedStages:['Closed Lost','Discarded'], collapsedAccountStages:['Lost','Non-Customer']
  }, ...(s.settings||{})};
  if (!['dark','light'].includes(s.settings.theme)) s.settings.theme='dark';
  if (!['projects','accounts'].includes(s.settings.boardMode)) s.settings.boardMode='projects';
  if (!Array.isArray(s.settings.collapsedStages)) s.settings.collapsedStages=['Closed Lost','Discarded'];
  if (!Array.isArray(s.settings.collapsedAccountStages)) s.settings.collapsedAccountStages=['Lost','Non-Customer'];
  s.settings.collapsedStages = [...new Set(s.settings.collapsedStages.filter(stage=>STAGES.includes(stage)))];
  s.settings.collapsedAccountStages = [...new Set(s.settings.collapsedAccountStages.filter(stage=>ACCOUNT_BOARD_COLUMNS.includes(stage)))];
  if (!s.settings.collapsedAccountStages.includes('Non-Customer')) s.settings.collapsedAccountStages.push('Non-Customer');
  const stageMap = {
    'New':'Discovery', 'Takeoff':'Bid Development', 'Pricing':'Bid Development', 'Review':'Bid Development',
    'Sent':'Bid Sent', 'Decision':'Negotiation', 'Awarded':'Closed Won'
  };
  (s.workItems||[]).forEach(w => { if(stageMap[w.stage]) w.stage=stageMap[w.stage]; if(!STAGES.includes(w.stage)) w.stage='Discovery'; });
  s.notebook ||= {}; s.workItems ||= []; s.quotes ||= []; s.contacts ||= []; s.companies ||= []; s.crmDeals ||= []; s.touchpoints ||= []; s.reminders ||= []; s.projectUpdates ||= [];

  const hub = hubSpotPrototypeData();
  mergeById(s.companies, hub.companies);
  mergeById(s.contacts, hub.contacts);
  mergeById(s.crmDeals, hub.crmDeals);
  mergeById(s.workItems, hub.workItems);
  fillMissingById(s.companies, hub.companies);
  fillMissingById(s.contacts, hub.contacts);
  (s.companies||[]).forEach(c=>{ if(!c.accountType)c.accountType='sales'; });
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

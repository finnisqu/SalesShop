/* Calendar History + resumable notebook pages + table Select All.
   A page keeps its original notebook date. Resuming it only changes the live working pointer and
   records a new work-session date, so chronology remains intact while old job pages can become live again. */

let notebookHistoryCalendarMonth = null;
let notebookHistorySelectedDate = null;

function notebookWorkingPageState() {
  state.settings ||= {};
  const saved = state.settings.notebookWorkingPage;
  if (saved?.key && saved?.pageId) return saved;
  const today = dateKey();
  const pageId = notebookPageState()[today] || ensureNotebookPage(today);
  return {key:today,pageId,lastWorkedAt:null};
}

function notebookPageActivityMap() {
  state.settings ||= {};
  state.settings.notebookPageActivityByPage ||= {};
  return state.settings.notebookPageActivityByPage;
}

function notebookPageActivityRecord(key,pageId) {
  const storageKey = notebookPageStorageKey(key,pageId);
  const map = notebookPageActivityMap();
  map[storageKey] ||= {originDate:key,pageId,workDays:{},lastWorkedAt:null};
  map[storageKey].workDays ||= {};
  return map[storageKey];
}

function recordNotebookPageWork(key,pageId,{kind='resume',day=dateKey()}={}) {
  const record = notebookPageActivityRecord(key,pageId);
  record.originDate = key;
  record.pageId = pageId;
  record.lastWorkedAt = nowISO();
  record.lastKind = kind;
  record.workDays[day] = Math.max(0,Number(record.workDays[day])||0) + 1;
  return record;
}

function setNotebookWorkingPage(key,pageId,{record=true,kind='resume'}={}) {
  if (!key || !pageId) return null;
  state.settings ||= {};
  const previous = state.settings.notebookWorkingPage;
  const same = previous?.key===key && previous?.pageId===pageId;
  let activity = notebookPageActivityRecord(key,pageId);
  if (record && (!same || String(activity.lastWorkedAt||'').slice(0,10)!==dateKey())) {
    activity = recordNotebookPageWork(key,pageId,{kind});
  }
  state.settings.notebookWorkingPage = {
    key,
    pageId,
    lastWorkedAt:activity.lastWorkedAt || previous?.lastWorkedAt || nowISO()
  };
  return state.settings.notebookWorkingPage;
}

function notebookWorkingPageMatches(key=currentNotebookDate,pageId=currentNotebookPageId) {
  const working = notebookWorkingPageState();
  return !!working && working.key===key && working.pageId===pageId;
}

/* The live/editable notebook page can now originate on an older date. */
if (typeof isCurrentLiveNotebookPage === 'function' && !window.__salesShopResumableLivePage) {
  window.__salesShopResumableLivePage = true;
  isCurrentLiveNotebookPage = function() {
    return notebookWorkingPageMatches();
  };
  if (typeof currentLiveNotebookPageId === 'function') {
    currentLiveNotebookPageId = function() {
      return notebookWorkingPageState()?.pageId || null;
    };
  }
}

function resumeNotebookPage(key,pageId,{closeHistory=true}={}) {
  if (!key || !pageId) return;
  ensureNotebookPageOrderRegistry?.({persist:false});
  const order = notebookPageOrderForDate?.(key) || [];
  if (order.length && !order.includes(pageId)) return toast('That notebook page is no longer available.');
  notebookPageState()[key] = pageId;
  setNotebookWorkingPage(key,pageId,{record:true,kind:'resume'});
  currentNotebookDate = key;
  currentNotebookPageId = pageId;
  if (typeof unlockedNotebookHistoryPages !== 'undefined') unlockedNotebookHistoryPages.delete?.(notebookPageStorageKey(key,pageId));
  save();
  if (closeHistory) closeModal?.();
  renderAll();
  toast(key===dateKey() ? 'Current page set' : 'Older page resumed');
}

function returnNotebookToToday() {
  const today = dateKey();
  const pageId = notebookPageState()[today] || ensureNotebookPage(today);
  setNotebookWorkingPage(today,pageId,{record:true,kind:'today'});
  currentNotebookDate = today;
  currentNotebookPageId = pageId;
  save();
  renderAll();
}

/* New Page always becomes the new live working page for today. */
if (typeof startFreshNotebookPage === 'function' && !window.__salesShopWorkingPageFreshPage) {
  window.__salesShopWorkingPageFreshPage = true;
  const _workingPageFresh = startFreshNotebookPage;
  startFreshNotebookPage = function(root) {
    const result = _workingPageFresh(root);
    setNotebookWorkingPage(currentNotebookDate,currentNotebookPageId,{record:true,kind:'new-page'});
    save();
    renderAll();
    return result;
  };
}

/* The existing toolbar Today button means "return to today's live page" when an older page is current. */
if (!window.__salesShopWorkingPageTodayButton) {
  window.__salesShopWorkingPageTodayButton = true;
  document.addEventListener('click',event=>{
    const button = event.target?.closest?.('#notebookDock [data-today]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    returnNotebookToToday();
  },true);
}

/* Notebook tab returns to the working page, not blindly to today's page. The older live layer has
   already run when this wrapper gets control, so restore only when its today-reset changed identity. */
if (typeof showView === 'function' && !window.__salesShopWorkingPageNotebookTab) {
  window.__salesShopWorkingPageNotebookTab = true;
  const _workingPageShowView = showView;
  showView = function(name) {
    const working = name==='notebook' ? notebookWorkingPageState() : null;
    const result = _workingPageShowView(name);
    if (name==='notebook' && working && (currentNotebookDate!==working.key || currentNotebookPageId!==working.pageId)) {
      currentNotebookDate = working.key;
      currentNotebookPageId = working.pageId;
      if (String(working.lastWorkedAt||'').slice(0,10)!==dateKey()) {
        setNotebookWorkingPage(working.key,working.pageId,{record:true,kind:'continue'});
        save();
      }
      renderAll();
    }
    return result;
  };
}

/* Ctrl/Cmd+A inside a notebook table selects the complete logical table, not browser text. */
if (!window.__salesShopTableSelectAllCells) {
  window.__salesShopTableSelectAllCells = true;
  document.addEventListener('keydown',event=>{
    if (event.defaultPrevented || event.isComposing || !(event.ctrlKey||event.metaKey) || event.altKey || String(event.key||'').toLowerCase()!=='a') return;
    const active = event.target?.closest?.('.spatial-object-table td') || document.activeElement?.closest?.('.spatial-object-table td');
    const wrap = active?.closest?.('.spatial-object-table');
    const object = spatialObjectById?.(wrap?.dataset?.spatialObjectId);
    const table = wrap ? $('.spatial-table',wrap) : null;
    if (!active || !wrap || !object || !table) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (active.classList.contains('spreadsheet-cell-editing')) spreadsheetEndCellEdit?.(active,{cancel:false});
    window.getSelection()?.removeAllRanges();

    activeSpatialTableSelection = {
      objectId:object.id,
      start:{r:0,c:0},
      end:{r:Math.max(0,object.rows-1),c:Math.max(0,object.cols-1)}
    };
    selectedSpatialObjectId = object.id;
    if (typeof openSpatialFormatObjectId!=='undefined') openSpatialFormatObjectId = object.id;
    wrap.classList.add('is-selected','format-open');
    paintSpatialTableSelection?.(table,object);
    decorateSpreadsheetSelection?.(table,object);
    const controls = $('.spatial-table-controls',wrap);
    if (controls && typeof advancedSpatialTableControls==='function') controls.replaceWith(advancedSpatialTableControls(object));
    requestAnimationFrame(()=>renderSpreadsheetFillHandle?.(wrap,object,table));
    if (typeof notebookFunctionPickMode!=='undefined' && notebookFunctionPickMode?.objectId===object.id) {
      setTimeout(()=>applyNotebookFunctionSourceSelection?.(object,{toggle:false}),0);
    }
  },true);
}

function notebookHistoryDateFromIso(value) {
  const text = String(value||'');
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function notebookAllPageRefs() {
  ensureNotebookPageOrderRegistry?.({persist:false});
  const orderMap = notebookPageOrderMap?.() || {};
  const refs = [];
  Object.keys(orderMap).sort().forEach(key=>{
    const order = notebookPageOrderForDate?.(key) || [];
    order.forEach((pageId,index)=>refs.push({key,pageId,pageNumber:index+1}));
  });
  return refs;
}

function notebookHistoryActivityScores() {
  const scores = Object.create(null);
  const add = (key,amount=1)=>{
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key||''))) return;
    scores[key] = (scores[key]||0) + Math.max(0,Number(amount)||0);
  };

  notebookAllPageRefs().forEach(page=>add(page.key,1));
  Object.values(state.notebook||{}).forEach(entries=>{
    (entries||[]).forEach(entry=>{
      const created = notebookHistoryDateFromIso(entry?.createdAt);
      if (created) add(created,1);
    });
  });
  Object.values(notebookPageActivityMap()).forEach(record=>{
    Object.entries(record?.workDays||{}).forEach(([day,count])=>add(day,count));
  });
  return scores;
}

function notebookHistoryActivityLevel(score) {
  const n = Math.max(0,Number(score)||0);
  if (!n) return 0;
  if (n===1) return 1;
  if (n<=3) return 2;
  if (n<=6) return 3;
  return 4;
}

function notebookHistoryPagesForActivityDate(day) {
  const activityMap = notebookPageActivityMap();
  const working = notebookWorkingPageState();
  return notebookAllPageRefs().map(page=>{
    const entries = notebookEntriesForPage(page.key,page.pageId);
    const storageKey = notebookPageStorageKey(page.key,page.pageId);
    const activity = activityMap[storageKey] || null;
    const notesOnDay = entries.filter(entry=>notebookHistoryDateFromIso(entry?.createdAt)===day).length;
    const workOnDay = Math.max(0,Number(activity?.workDays?.[day])||0);
    const originated = page.key===day;
    if (!originated && !notesOnDay && !workOnDay) return null;
    const order = notebookPageOrderForDate?.(page.key) || [];
    return {
      ...page,
      preview:notebookPagePreviewForHistory?.(page.key,page.pageId) || 'Notebook page',
      blank:notebookPageIsTrulyBlank?.(page.key,page.pageId) || false,
      notesOnDay,
      workOnDay,
      originated,
      current:working?.key===page.key && working?.pageId===page.pageId,
      canDelete:(notebookPageIsTrulyBlank?.(page.key,page.pageId) || false) && order.length>1 && !(working?.key===page.key && working?.pageId===page.pageId),
      lastWorkedAt:activity?.lastWorkedAt || entries.at(-1)?.createdAt || ''
    };
  }).filter(Boolean).sort((a,b)=>{
    if (a.current!==b.current) return a.current ? -1 : 1;
    return String(b.lastWorkedAt||'').localeCompare(String(a.lastWorkedAt||'')) || a.pageNumber-b.pageNumber;
  });
}

function notebookMonthParts(monthKey) {
  const match = String(monthKey||'').match(/^(\d{4})-(\d{2})$/);
  const today = new Date();
  return match ? {year:Number(match[1]),month:Number(match[2])} : {year:today.getFullYear(),month:today.getMonth()+1};
}

function notebookMonthKey(year,month) {
  let y=year,m=month;
  while (m<1) { y--;m+=12; }
  while (m>12) { y++;m-=12; }
  return `${y}-${String(m).padStart(2,'0')}`;
}

function notebookShiftHistoryMonth(delta) {
  const {year,month}=notebookMonthParts(notebookHistoryCalendarMonth);
  notebookHistoryCalendarMonth = notebookMonthKey(year,month+delta);
  const today = dateKey();
  notebookHistorySelectedDate = today.startsWith(`${notebookHistoryCalendarMonth}-`)
    ? today
    : `${notebookHistoryCalendarMonth}-01`;
}

function notebookCalendarDateKey(year,month,day) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function notebookHistoryCalendarCells(monthKey,scores) {
  const {year,month}=notebookMonthParts(monthKey);
  const first = new Date(year,month-1,1);
  const days = new Date(year,month,0).getDate();
  const leading = first.getDay();
  const cells=[];
  for (let i=0;i<42;i++) {
    const day = i-leading+1;
    if (day<1 || day>days) {
      cells.push('<span class="notebook-history-calendar-day spacer" aria-hidden="true"></span>');
      continue;
    }
    const key = notebookCalendarDateKey(year,month,day);
    const score = scores[key]||0;
    const level = notebookHistoryActivityLevel(score);
    const selected = key===notebookHistorySelectedDate;
    const today = key===dateKey();
    cells.push(`<button type="button" class="notebook-history-calendar-day level-${level}${selected?' selected':''}${today?' today':''}" data-history-calendar-date="${key}" title="${escapeHtml(notebookHistoryDateLabel?.(key)||key)} · ${score} activity item${score===1?'':'s'}" aria-label="${escapeHtml(key)}">
      <span>${day}</span>
    </button>`);
  }
  return cells.join('');
}

function notebookHistoryMonthTitle(monthKey) {
  const {year,month}=notebookMonthParts(monthKey);
  return new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(new Date(year,month-1,1));
}

function notebookHistoryPageListHtml(day) {
  const pages = notebookHistoryPagesForActivityDate(day);
  if (!pages.length) return `<div class="notebook-history-calendar-empty">No notebook activity on this date.</div>`;
  return pages.map(page=>{
    const origin = page.key===dateKey() ? 'Today' : fmtDate(page.key,{month:'short',day:'numeric',year:'numeric'});
    const activityBits=[];
    if (page.current) activityBits.push('Current');
    if (!page.originated) activityBits.push(`Origin ${origin}`);
    else activityBits.push(`Page ${page.pageNumber}`);
    if (page.notesOnDay) activityBits.push(`${page.notesOnDay} note${page.notesOnDay===1?'':'s'}`);
    if (page.workOnDay && !page.notesOnDay) activityBits.push('Worked');
    return `<div class="notebook-history-calendar-page${page.current?' current':''}${page.blank?' blank-page':''}">
      <button type="button" class="notebook-history-calendar-page-open" data-history-calendar-open-date="${page.key}" data-history-calendar-open-page="${page.pageId}">
        <span class="notebook-history-calendar-page-meta">${escapeHtml(activityBits.join(' · '))}</span>
        <span class="notebook-history-calendar-page-preview">${escapeHtml(page.preview)}</span>
      </button>
      <div class="notebook-history-calendar-page-actions">
        ${page.current
          ? '<span class="notebook-history-current-pill">Current</span>'
          : `<button type="button" class="notebook-history-resume" data-history-resume-date="${page.key}" data-history-resume-page="${page.pageId}" title="Make this the live notebook page">Resume</button>`}
        ${page.canDelete?`<button type="button" class="notebook-history-page-delete" data-history-calendar-delete-date="${page.key}" data-history-calendar-delete-page="${page.pageId}" title="Delete blank page" aria-label="Delete blank page">×</button>`:''}
      </div>
    </div>`;
  }).join('');
}

function notebookHistoryCalendarHtml() {
  const scores = notebookHistoryActivityScores();
  const month = notebookHistoryCalendarMonth || dateKey().slice(0,7);
  const selected = notebookHistorySelectedDate || dateKey();
  const selectedLabel = notebookHistoryDateLabel?.(selected) || selected;
  return `<div class="notebook-history-calendar-shell">
    <div class="notebook-history-calendar-toolbar">
      <div class="notebook-history-calendar-month-nav">
        <button type="button" data-history-month-prev title="Previous month" aria-label="Previous month">‹</button>
        <strong>${escapeHtml(notebookHistoryMonthTitle(month))}</strong>
        <button type="button" data-history-month-next title="Next month" aria-label="Next month">›</button>
      </div>
      <button type="button" class="notebook-history-today-button" data-history-calendar-today>Today</button>
    </div>
    <div class="notebook-history-calendar-weekdays" aria-hidden="true">
      ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>`<span>${day}</span>`).join('')}
    </div>
    <div class="notebook-history-calendar-grid">${notebookHistoryCalendarCells(month,scores)}</div>
    <div class="notebook-history-calendar-selection-head">
      <strong>${escapeHtml(selectedLabel)}</strong>
      <span>${scores[selected]||0} activity item${(scores[selected]||0)===1?'':'s'}</span>
    </div>
    <div class="notebook-history-calendar-pages">${notebookHistoryPageListHtml(selected)}</div>
  </div>`;
}

function refreshNotebookHistoryCalendar() {
  const body = $('#modalRoot .modal-body');
  if (!body) return openNotebookHistory();
  body.innerHTML = notebookHistoryCalendarHtml();
  bindNotebookHistoryCalendar();
}

function bindNotebookHistoryCalendar() {
  const root = $('#modalRoot');
  if (!root) return;
  $('.modal-card',root)?.classList.add('notebook-history-calendar-modal');
  $('[data-history-month-prev]',root)?.addEventListener('click',()=>{ notebookShiftHistoryMonth(-1);refreshNotebookHistoryCalendar(); });
  $('[data-history-month-next]',root)?.addEventListener('click',()=>{ notebookShiftHistoryMonth(1);refreshNotebookHistoryCalendar(); });
  $('[data-history-calendar-today]',root)?.addEventListener('click',()=>{
    notebookHistorySelectedDate=dateKey();
    notebookHistoryCalendarMonth=dateKey().slice(0,7);
    refreshNotebookHistoryCalendar();
  });
  $$('[data-history-calendar-date]',root).forEach(button=>button.onclick=()=>{
    notebookHistorySelectedDate=button.dataset.historyCalendarDate;
    refreshNotebookHistoryCalendar();
  });
  $$('[data-history-calendar-open-page]',root).forEach(button=>button.onclick=()=>{
    currentNotebookDate=button.dataset.historyCalendarOpenDate;
    currentNotebookPageId=button.dataset.historyCalendarOpenPage;
    closeModal();
    renderAll();
  });
  $$('[data-history-resume-page]',root).forEach(button=>button.onclick=()=>{
    resumeNotebookPage(button.dataset.historyResumeDate,button.dataset.historyResumePage,{closeHistory:true});
  });
  $$('[data-history-calendar-delete-page]',root).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    const key=button.dataset.historyCalendarDeleteDate;
    const pageId=button.dataset.historyCalendarDeletePage;
    deleteBlankNotebookPage?.(key,pageId);
  });
}

/* Calendar History replaces the expanding date accordion with a fixed physical panel. */
openNotebookHistory = function() {
  notebookHistorySelectedDate ||= dateKey();
  notebookHistoryCalendarMonth ||= notebookHistorySelectedDate.slice(0,7);
  openModal('Notebook','History',notebookHistoryCalendarHtml());
  bindNotebookHistoryCalendar();
};

function installWorkingPageBadge(root=$('#notebookDock')) {
  if (!root || !notebookWorkingPageMatches()) return;
  const working = notebookWorkingPageState();
  if (working.key===dateKey()) return;
  const head = $('.notebook-paper-head',root);
  const date = $('.notebook-date',head);
  if (!head || !date || $('.notebook-working-page-badge',head)) return;
  const badge=document.createElement('span');
  badge.className='notebook-working-page-badge';
  badge.textContent='Current · worked today';
  badge.title='This page keeps its original date but is your current live notebook page.';
  date.insertAdjacentElement('afterend',badge);
}

const _historyCalendarNotebookRender = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _historyCalendarNotebookRender(root);
  if (!root) return;
  installWorkingPageBadge(root);
};

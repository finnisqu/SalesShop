/* Lightweight rich text for the notebook.
   Plain text remains canonical/searchable; optional sanitized richHtml is presentation metadata. */

let richSavedSelection = null;
let richDraftSelection = null;
let richGridSelection = null;

const RICH_HIGHLIGHTS = new Set(['yellow','mint','rose']);
const RICH_HEADINGS = new Set(['h1','h2']);

function notebookEntryById(id) {
  if (!id) return null;
  for (const entries of Object.values(state.notebook || {})) {
    const found = entries.find(entry => entry.id === id);
    if (found) return found;
  }
  return null;
}

function richPlainTextFromNode(root) {
  if (!root) return '';
  let out = '';
  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue || '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === 'BR') {
      out += '\n';
      return;
    }
    [...node.childNodes].forEach(walk);
  };
  [...root.childNodes].forEach(walk);
  return out.replace(/\u00a0/g,' ');
}

function richPlainTextFromHtml(html) {
  const box = document.createElement('div');
  box.innerHTML = html || '';
  return richPlainTextFromNode(box);
}

function sanitizeRichHtml(html) {
  const box = document.createElement('div');
  box.innerHTML = html || '';

  const clean = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        return;
      }

      const tag = child.tagName;
      if (tag === 'BR') {
        [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
        return;
      }
      if (tag === 'STRONG' || tag === 'EM' || tag === 'U') {
        [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
        clean(child);
        return;
      }
      if (tag === 'SPAN') {
        const highlight = child.dataset.highlight;
        const heading = child.dataset.heading;
        [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
        if (RICH_HIGHLIGHTS.has(highlight)) child.dataset.highlight = highlight;
        else if (RICH_HEADINGS.has(heading)) child.dataset.heading = heading;
        else {
          child.replaceWith(...child.childNodes);
          return;
        }
        clean(child);
        return;
      }

      /* Anything pasted or browser-generated outside our tiny vocabulary becomes plain content. */
      clean(child);
      child.replaceWith(...child.childNodes);
    });
  };

  clean(box);
  return box.innerHTML;
}

function richHtmlForText(text) {
  return escapeHtml(text || '').replace(/\n/g,'<br>');
}

function validRichHtml(text, html) {
  if (!html) return false;
  return richPlainTextFromHtml(sanitizeRichHtml(html)) === String(text || '');
}

function richEntryBodyHtml(entry) {
  return validRichHtml(entry?.text, entry?.richHtml)
    ? sanitizeRichHtml(entry.richHtml)
    : richHtmlForText(entry?.text || '');
}

function richToolbarHtml({actions=true}={}) {
  return `
    <button type="button" class="rich-tool rich-tool-text" data-rich-command="bold" title="Bold"><strong>B</strong></button>
    <button type="button" class="rich-tool rich-tool-text" data-rich-command="italic" title="Italic"><em>I</em></button>
    <button type="button" class="rich-tool rich-tool-text" data-rich-command="underline" title="Underline"><u>U</u></button>
    <span class="rich-tool-separator"></span>
    <button type="button" class="rich-tool rich-tool-heading" data-rich-command="h1" title="Header 1">H1</button>
    <button type="button" class="rich-tool rich-tool-heading" data-rich-command="h2" title="Header 2">H2</button>
    <span class="rich-tool-separator"></span>
    <button type="button" class="rich-tool rich-highlight rich-highlight-yellow" data-rich-highlight="yellow" title="Yellow highlight" aria-label="Yellow highlight"></button>
    <button type="button" class="rich-tool rich-highlight rich-highlight-mint" data-rich-highlight="mint" title="Green highlight" aria-label="Green highlight"></button>
    <button type="button" class="rich-tool rich-highlight rich-highlight-rose" data-rich-highlight="rose" title="Rose highlight" aria-label="Rose highlight"></button>
    ${actions ? '<span class="rich-tool-separator"></span><button type="button" class="rich-tool rich-tool-action" data-rich-promote>Promote</button><button type="button" class="rich-tool rich-tool-action" data-rich-link>Link</button>' : ''}
  `;
}

function richMatchingAncestor(node, root, command, value=null) {
  let el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  while (el && el !== root) {
    if (command === 'bold' && el.tagName === 'STRONG') return el;
    if (command === 'italic' && el.tagName === 'EM') return el;
    if (command === 'underline' && el.tagName === 'U') return el;
    if ((command === 'h1' || command === 'h2') && el.dataset?.heading === command) return el;
    if (command === 'highlight' && el.dataset?.highlight === value) return el;
    el = el.parentElement;
  }
  return null;
}

function richUnwrap(el) {
  if (!el?.parentNode) return;
  const parent = el.parentNode;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  el.remove();
  parent.normalize?.();
}

function applyRichFormat(range, root, command, value=null) {
  if (!range || range.collapsed || !root) return null;

  const matching = richMatchingAncestor(range.commonAncestorContainer, root, command, value);
  if (matching) {
    richUnwrap(matching);
    return null;
  }

  let wrapper;
  if (command === 'bold') wrapper = document.createElement('strong');
  else if (command === 'italic') wrapper = document.createElement('em');
  else if (command === 'underline') wrapper = document.createElement('u');
  else if (command === 'h1' || command === 'h2') {
    wrapper = document.createElement('span');
    wrapper.dataset.heading = command;
  } else if (command === 'highlight' && RICH_HIGHLIGHTS.has(value)) {
    wrapper = document.createElement('span');
    wrapper.dataset.highlight = value;
  } else return null;

  try {
    const fragment = range.extractContents();
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
    const next = document.createRange();
    next.selectNodeContents(wrapper);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(next);
    return next;
  } catch {
    return null;
  }
}

function insertRichPlainText(text) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function bindRichToolbar(toolbar, getContext) {
  if (!toolbar) return;
  $$('button',toolbar).forEach(btn=>btn.addEventListener('mousedown',e=>e.preventDefault()));

  $$('[data-rich-command]',toolbar).forEach(btn=>btn.onclick=()=>{
    const ctx = getContext();
    if (!ctx?.range || !ctx?.root) return;
    const command = btn.dataset.richCommand;
    ctx.range = applyRichFormat(ctx.range,ctx.root,command);
    ctx.persist?.();
  });
  $$('[data-rich-highlight]',toolbar).forEach(btn=>btn.onclick=()=>{
    const ctx = getContext();
    if (!ctx?.range || !ctx?.root) return;
    ctx.range = applyRichFormat(ctx.range,ctx.root,'highlight',btn.dataset.richHighlight);
    ctx.persist?.();
  });
  $('[data-rich-promote]',toolbar)?.addEventListener('click',()=>{
    const ctx=getContext();
    if (ctx?.text) openPromoteModal(ctx.text,ctx.entryId || null);
  });
  $('[data-rich-link]',toolbar)?.addEventListener('click',()=>{
    const ctx=getContext();
    if (ctx?.text) openLinkModal(ctx.text,ctx.entryId || null);
  });
}

function stripCueFromRichRoot(root) {
  const clone=root.cloneNode(true);
  $$('.entry-cue-inline',clone).forEach(el=>el.remove());
  return clone;
}

function persistSavedRichSelection(ctx) {
  const entry=notebookEntryById(ctx.entryId);
  if (!entry || !ctx.root) return;
  const cleanRoot=stripCueFromRichRoot(ctx.root);
  entry.text=richPlainTextFromNode(cleanRoot);
  entry.richHtml=sanitizeRichHtml(cleanRoot.innerHTML);
  save();
}

function hydrateRichNotebookEntries(root) {
  if (!root) return;
  $$('[data-entry-id]',root).forEach(row=>{
    const entry=notebookEntryById(row.dataset.entryId);
    if (!entry) return;
    const target=$('.entry-text',row) || $('.grid-note-text',row) || $('.grid-history-text',row);
    if (!target) return;
    target.innerHTML=richEntryBodyHtml(entry);
    target.classList.add('rich-rendered-text');

    if (target.classList.contains('entry-text') && entry.cue && notebookPaperView() !== 'cornell') {
      const cue=document.createElement('span');
      cue.className='entry-cue-inline';
      cue.textContent=entry.cue;
      target.prepend(cue,document.createTextNode(' '));
    }
  });
}

function updateRichDraftFocus(root,editor) {
  const entries=$('[data-notebook-entries]',root);
  if (!entries || !editor) return;
  const naturalHeight=Math.max(28,editor.scrollHeight);
  const extra=Math.max(0,naturalHeight-28);
  const historyMax=Math.max(0,84-extra);
  entries.style.setProperty('--notebook-history-max',`${historyMax}px`);
  entries.classList.toggle('draft-hides-history',historyMax<8);
  entries.classList.toggle('has-scrollback',entries.scrollHeight>historyMax+2);
  if (historyMax>0) entries.scrollTop=entries.scrollHeight;
}

function syncRichDraft(root,editor) {
  const source=$('[data-notebook-input]',root);
  if (!source || !editor) return;
  const text=richPlainTextFromNode(editor);
  const html=sanitizeRichHtml(editor.innerHTML);
  source.value=text;
  const draft=notebookBufferedDraft();
  draft.text=text;
  draft.richHtml=html;
  const cue=$('[data-cornell-cue]',root);
  if (cue) draft.cue=cue.value;
  persistentNotebookDrafts()[notebookDraftKey()]={...draft};
  save();
  updateRichDraftFocus(root,editor);
}

function upgradeNotebookDraftRich(root) {
  const source=$('[data-notebook-input]',root);
  if (!source || source.dataset.richUpgraded) return;
  source.dataset.richUpgraded='1';
  source.classList.add('richtext-source');

  const editor=document.createElement('div');
  editor.className='notebook-rich-editor';
  editor.contentEditable='true';
  editor.spellcheck=true;
  editor.dataset.richDraftEditor='';
  editor.setAttribute('role','textbox');
  editor.setAttribute('aria-multiline','true');
  editor.setAttribute('aria-label','Notebook');

  const draft=notebookBufferedDraft();
  const text=source.value || draft.text || '';
  editor.innerHTML=validRichHtml(text,draft.richHtml) ? sanitizeRichHtml(draft.richHtml) : richHtmlForText(text);
  source.insertAdjacentElement('afterend',editor);

  const toolbar=$('[data-draft-tools]',root);
  if (toolbar) {
    toolbar.classList.add('rich-selection-toolbar');
    toolbar.innerHTML=richToolbarHtml();
    bindRichToolbar(toolbar,()=>richDraftSelection);
  }

  const updateSelection=()=>{
    const selection=window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) {
      toolbar?.classList.remove('visible');
      richDraftSelection=null;
      return;
    }
    const range=selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    richDraftSelection={
      range:range.cloneRange(),
      root:editor,
      text:selection.toString().trim(),
      entryId:null,
      persist:()=>{
        syncRichDraft(root,editor);
        richDraftSelection && (richDraftSelection.range=window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0).cloneRange() : richDraftSelection.range);
      }
    };
    toolbar?.classList.toggle('visible',!!richDraftSelection.text);
  };

  editor.addEventListener('input',()=>{
    syncRichDraft(root,editor);
    updateSelection();
  });
  editor.addEventListener('mouseup',updateSelection);
  editor.addEventListener('keyup',updateSelection);
  editor.addEventListener('contextmenu',e=>{
    updateSelection();
    if (richDraftSelection?.text) e.preventDefault();
  });
  editor.addEventListener('keydown',e=>{
    if (e.key!=='Enter' || e.isComposing) return;
    if (e.shiftKey) {
      e.preventDefault();
      syncRichDraft(root,editor);
      saveNotebookDraft(root);
      return;
    }
    e.preventDefault();
    insertRichPlainText('\n');
    syncRichDraft(root,editor);
  });
  editor.addEventListener('paste',e=>{
    e.preventDefault();
    insertRichPlainText(e.clipboardData?.getData('text/plain') || '');
    syncRichDraft(root,editor);
  });

  requestAnimationFrame(()=>updateRichDraftFocus(root,editor));
}

const _salesShopRichSaveNotebookDraft=saveNotebookDraft;
saveNotebookDraft=function(root){
  const editor=$('[data-rich-draft-editor]',root);
  if (!editor) return _salesShopRichSaveNotebookDraft(root);
  syncRichDraft(root,editor);
  const draft=notebookBufferedDraft();
  const text=(draft.text || '').trimEnd();
  const cue=(draft.cue || '').trim();
  if (!text.trim() && !cue) return;
  appendNotebookEntry(text,'typed',currentNotebookDate,currentNotebookPageId,{
    ...(cue?{cue}:{}),
    ...(draft.richHtml?{richHtml:sanitizeRichHtml(draft.richHtml)}:{})
  });
  clearNotebookBufferedDraft();
  save();
  renderAll();
  toast('Added');
};

const _salesShopRichStartFreshPage=startFreshNotebookPage;
startFreshNotebookPage=function(root){
  const editor=$('[data-rich-draft-editor]',root);
  if (!editor) return _salesShopRichStartFreshPage(root);
  syncRichDraft(root,editor);
  const draft=notebookBufferedDraft();
  const text=(draft.text || '').trimEnd();
  const cue=(draft.cue || '').trim();
  if (text.trim() || cue) {
    appendNotebookEntry(text,'typed',currentNotebookDate,currentNotebookPageId,{
      ...(cue?{cue}:{}),
      ...(draft.richHtml?{richHtml:sanitizeRichHtml(draft.richHtml)}:{})
    });
  }
  clearNotebookBufferedDraft();
  currentNotebookDate=dateKey();
  state.notebook[currentNotebookDate] ||= [];
  const newPageId=uid('page');
  notebookPageState()[currentNotebookDate]=newPageId;
  currentNotebookPageId=newPageId;
  save();
  renderAll();
  setTimeout(()=>document.querySelector('[data-rich-draft-editor]')?.focus(),0);
  toast('Fresh page');
};

/* Saved text gets the same compact contextual strip. */
handleSelection=function(e,entryId,force=false){
  setTimeout(()=>{
    const selection=window.getSelection();
    const text=selection?.toString().trim();
    removeSelectionPopover();
    if (!selection?.rangeCount || !text) return;
    const range=selection.getRangeAt(0);
    const eventTarget=e?.target?.nodeType===Node.ELEMENT_NODE ? e.target : e?.target?.parentElement;
    const root=eventTarget?.closest?.('.entry-text,.grid-note-text,.grid-history-text');
    if (!root || !root.contains(range.commonAncestorContainer)) return;

    selectedNotebookText=text;
    selectedNotebookEntryId=entryId;
    richSavedSelection={
      range:range.cloneRange(),
      root,
      entryId,
      text,
      persist:()=>persistSavedRichSelection(richSavedSelection)
    };

    const rect=range.getBoundingClientRect();
    const pop=document.createElement('div');
    pop.id='selectionPopover';
    pop.className='selection-popover rich-selection-popover';
    pop.style.left=`${Math.min(window.innerWidth-430,Math.max(8,rect.left))}px`;
    pop.style.top=`${Math.max(8,rect.top-38)}px`;
    pop.innerHTML=richToolbarHtml();
    document.body.appendChild(pop);
    bindRichToolbar(pop,()=>richSavedSelection);
  },force?0:10);
};

function upgradeGridRichEditor(root) {
  if (!activeGridEditor?.textarea || activeGridEditor.textarea.dataset.richUpgraded) return;
  const source=activeGridEditor.textarea;
  source.dataset.richUpgraded='1';
  source.classList.add('richtext-source');
  const wrap=activeGridEditor.wrap;
  const existingEntry=activeGridEditor.entry;

  const editor=document.createElement('div');
  editor.className='grid-rich-editor';
  editor.contentEditable='true';
  editor.spellcheck=true;
  editor.dataset.gridRichEditor='';
  editor.setAttribute('role','textbox');
  editor.setAttribute('aria-multiline','true');
  editor.setAttribute('aria-label',existingEntry?'Edit grid note':'New grid note');
  const text=source.value || existingEntry?.text || '';
  editor.innerHTML=validRichHtml(text,existingEntry?.richHtml) ? sanitizeRichHtml(existingEntry.richHtml) : richHtmlForText(text);
  source.insertAdjacentElement('afterend',editor);

  const toolbar=activeGridEditor.tools;
  toolbar.classList.add('rich-selection-toolbar');
  toolbar.innerHTML=richToolbarHtml();
  bindRichToolbar(toolbar,()=>richGridSelection);

  const sync=()=>{
    source.value=richPlainTextFromNode(editor);
    source.dispatchEvent(new Event('input',{bubbles:true}));
    const entry=activeGridEditor?.entry;
    if (entry) {
      entry.text=source.value;
      entry.richHtml=sanitizeRichHtml(editor.innerHTML);
      save();
    }
  };

  const updateSelection=()=>{
    const selection=window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) {
      toolbar.classList.remove('visible');
      richGridSelection=null;
      return;
    }
    const range=selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    richGridSelection={
      range:range.cloneRange(),
      root:editor,
      text:selection.toString().trim(),
      entryId:activeGridEditor?.entry?.id || null,
      persist:()=>{
        sync();
        richGridSelection && (richGridSelection.entryId=activeGridEditor?.entry?.id || null);
        richGridSelection && (richGridSelection.range=window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0).cloneRange() : richGridSelection.range);
      }
    };
    toolbar.classList.toggle('visible',!!richGridSelection.text);
  };

  editor.addEventListener('input',()=>{sync();updateSelection();});
  editor.addEventListener('mouseup',updateSelection);
  editor.addEventListener('keyup',updateSelection);
  editor.addEventListener('contextmenu',e=>{
    updateSelection();
    if (richGridSelection?.text) e.preventDefault();
  });
  editor.addEventListener('keydown',e=>{
    if (e.key==='Escape') {
      e.preventDefault();
      sync();
      closeGridEditor({rerender:true});
      return;
    }
    if (e.key!=='Enter' || e.isComposing) return;
    if (e.shiftKey) {
      e.preventDefault();
      sync();
      closeGridEditor({rerender:true});
      return;
    }
    e.preventDefault();
    insertRichPlainText('\n');
    sync();
  });
  editor.addEventListener('paste',e=>{
    e.preventDefault();
    insertRichPlainText(e.clipboardData?.getData('text/plain') || '');
    sync();
  });
  editor.addEventListener('blur',()=>{
    setTimeout(()=>{
      if (!activeGridEditor || wrap.contains(document.activeElement)) return;
      sync();
      closeGridEditor({rerender:true});
    },140);
  });

  requestAnimationFrame(()=>{
    editor.focus();
    const selection=window.getSelection();
    const range=document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

const _salesShopRichOpenGridEditor=openGridEditor;
openGridEditor=function(root,canvas,placement,existingEntry=null){
  _salesShopRichOpenGridEditor(root,canvas,placement,existingEntry);
  if (!activeGridEditor) return;
  upgradeGridRichEditor(root);
};

const _salesShopRichRenderNotebookSurface=renderNotebookSurface;
renderNotebookSurface=function(root){
  _salesShopRichRenderNotebookSurface(root);
  if (!root) return;
  hydrateRichNotebookEntries(root);
  if (notebookPaperView()!=='grid') upgradeNotebookDraftRich(root);
};

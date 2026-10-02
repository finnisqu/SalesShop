/* App-level Focus / Fullscreen mode. Uses the browser Fullscreen API when available and falls back
   to an in-app distraction-free layout. Escape exits native fullscreen; the floating exit button
   also works in both native and fallback focus. */

let salesShopFocusFallback=false;

function syncSalesShopFocusMode() {
  const active=!!document.fullscreenElement || salesShopFocusFallback;
  document.body.classList.toggle('app-focus-mode',active);
  const button=$('#focusModeBtn');
  if (button) {
    button.classList.toggle('active',active);
    button.title=active?'Exit Focus mode':'Enter Focus mode';
    button.setAttribute('aria-label',button.title);
    button.setAttribute('aria-pressed',String(active));
  }
  const exit=$('#focusModeExitBtn');
  if (exit) exit.hidden=!active;
}

async function enterSalesShopFocusMode() {
  salesShopFocusFallback=false;
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({navigationUI:'hide'});
    } else {
      salesShopFocusFallback=true;
    }
  } catch {
    salesShopFocusFallback=true;
  }
  syncSalesShopFocusMode();
}

async function exitSalesShopFocusMode() {
  if (document.fullscreenElement && document.exitFullscreen) {
    try { await document.exitFullscreen(); } catch {}
  }
  salesShopFocusFallback=false;
  syncSalesShopFocusMode();
}

function toggleSalesShopFocusMode() {
  if (document.fullscreenElement || salesShopFocusFallback) return exitSalesShopFocusMode();
  return enterSalesShopFocusMode();
}

function focusModeGlyph() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M7 3H3v4M13 3h4v4M3 13v4h4M17 13v4h-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function installSalesShopFocusMode() {
  const tools=$('.header-tools');
  if (tools && !$('#focusModeBtn')) {
    const button=document.createElement('button');
    button.type='button';
    button.id='focusModeBtn';
    button.className='top-icon-button focus-mode-button';
    button.title='Enter Focus mode';
    button.setAttribute('aria-label','Enter Focus mode');
    button.setAttribute('aria-pressed','false');
    button.innerHTML=focusModeGlyph();
    button.onclick=toggleSalesShopFocusMode;
    const theme=$('#themeToggleBtn',tools);
    tools.insertBefore(button,theme||tools.firstChild);
  }

  if (!$('#focusModeExitBtn')) {
    const exit=document.createElement('button');
    exit.type='button';
    exit.id='focusModeExitBtn';
    exit.className='focus-mode-exit';
    exit.title='Exit Focus mode';
    exit.setAttribute('aria-label','Exit Focus mode');
    exit.innerHTML=`${focusModeGlyph()}<span>Exit</span>`;
    exit.hidden=true;
    exit.onclick=exitSalesShopFocusMode;
    document.body.appendChild(exit);
  }
  syncSalesShopFocusMode();
}

if (!window.__salesShopFocusModeBound) {
  window.__salesShopFocusModeBound=true;
  document.addEventListener('fullscreenchange',syncSalesShopFocusMode);
  document.addEventListener('keydown',event=>{
    if (!(event.ctrlKey||event.metaKey) || !event.shiftKey || event.altKey || String(event.key).toLowerCase()!=='f') return;
    if (event.target?.matches?.('input,textarea,[contenteditable="true"]')) return;
    event.preventDefault();
    toggleSalesShopFocusMode();
  });
}

installSalesShopFocusMode();

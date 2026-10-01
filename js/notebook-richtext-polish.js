/* Small compatibility layer for rich notebook editing. */

const _salesShopPlainToggleSpeech = toggleSpeech;
toggleSpeech = function(root) {
  const editor = $('[data-rich-draft-editor]', root);
  if (!editor) return _salesShopPlainToggleSpeech(root);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return toast('Live browser dictation is not supported here. Typing still works.');
  const btn = $('[data-mic]', root);

  if (speech) {
    speech.stop();
    speech = null;
    speechTarget = null;
    btn?.classList.remove('recording');
    if (btn) btn.textContent = '🎙';
    return;
  }

  editor.focus();
  const selection = window.getSelection();
  const caret = document.createRange();
  caret.selectNodeContents(editor);
  caret.collapse(false);
  selection.removeAllRanges();
  selection.addRange(caret);

  speechTarget = editor;
  speech = new SpeechRecognition();
  speech.continuous = true;
  speech.interimResults = true;
  speech.lang = 'en-US';

  speech.onresult = e => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal) continue;
      const transcript = e.results[i][0].transcript.trim();
      if (!transcript) continue;
      const existing = richPlainTextFromNode(editor);
      insertRichPlainText(`${existing && !existing.endsWith(/\s/) ? ' ' : ''}${transcript} `);
      syncRichDraft(root, editor);
    }
  };
  speech.onend = () => {
    btn?.classList.remove('recording');
    if (btn) btn.textContent = '🎙';
    speech = null;
    speechTarget = null;
  };
  speech.onerror = () => toast('Microphone transcription stopped.');
  speech.start();
  btn?.classList.add('recording');
  if (btn) btn.textContent = '■';
};

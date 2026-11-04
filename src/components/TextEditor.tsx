import { useEffect, useState } from 'react';
import {createPortal} from 'react-dom';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useNotebookStore } from '../store/notebookStore';
import {usePersonalTaskStore} from '../store/personalTaskStore';
import {notebookPromotionActions} from '../services/notebookPromotionActions';
import {agendaTitle,openNotebookCalendarDate} from '../services/notebookDaily';
import {requestTaskModal} from '../services/taskModalEvents';
import {useAppContextMenu} from './AppContextMenu';
import type { NotebookEntry } from '../types/notebook';

interface TextEditorProps {
  entry: NotebookEntry;
  onEditorReady?: (editor: Editor | null) => void;
  readOnly?: boolean;
}

export function TextEditor({ entry, onEditorReady, readOnly = false }: TextEditorProps) {
  const updateContent = useNotebookStore((state) => state.updateContent);
  const activeTool = useNotebookStore((state) => state.activeTool);
  const selectObject = useNotebookStore((state) => state.selectObject);
  const textEnabled = readOnly || activeTool === 'select' || activeTool === 'text';
  const beginPromotion=usePersonalTaskStore(s=>s.beginPromotion);
  const context=useAppContextMenu();
  const [selection,setSelection]=useState<{text:string;left:number;top:number}|null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: entry.contentHtml,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'paper-prose',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => { if(!readOnly) updateContent(entry.id, editor.getHTML()); },
    onSelectionUpdate:({editor})=>{
      if(readOnly||editor.state.selection.empty){setSelection(null);return;}
      const {from,to}=editor.state.selection;
      const text=editor.state.doc.textBetween(from,to,' ').trim().slice(0,2000);
      if(!text){setSelection(null);return;}
      // iOS Safari may report a zero-size native selection rectangle while
      // dragging a handle. The editor's document position is a safer fallback.
      const native=window.getSelection();
      const rect=native?.rangeCount?native.getRangeAt(0).getBoundingClientRect():null;
      let left=rect?.left??0;
      let bottom=rect?.bottom??0;
      if(!rect||rect.width===0||!Number.isFinite(left)||!Number.isFinite(bottom)){
        try{
          const coords=editor.view.coordsAtPos(to);
          left=coords.left;bottom=coords.bottom;
        }catch{setSelection(null);return;}
      }
      const viewport=window.visualViewport;
      const visibleLeft=viewport?.offsetLeft??0;
      const visibleTop=viewport?.offsetTop??0;
      const visibleWidth=viewport?.width??window.innerWidth;
      const visibleHeight=viewport?.height??window.innerHeight;
      const toolbarWidth=Math.min(300,Math.max(1,visibleWidth-16));
      setSelection({text,
       left:Math.max(visibleLeft+8,Math.min(left,visibleLeft+visibleWidth-toolbarWidth-8)),
       top:Math.max(visibleTop+8,Math.min(bottom+8,visibleTop+visibleHeight-86)),
      });
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== entry.contentHtml) {
      editor.commands.setContent(entry.contentHtml, { emitUpdate: false });
    }
  }, [editor, entry.id, entry.contentHtml]);

  useEffect(() => {
    onEditorReady?.(editor ?? null);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  const selectedTask=(text:string)=>{
    setSelection(null);
    requestTaskModal({mode:'create',title:agendaTitle(text),notes:text,
     associations:[{type:'notebook',id:entry.id,label:'Notebook · '+entry.title}],
     agendaSource:{entryId:entry.id,sourceText:text}});
  };
  const selectedDate=(text:string)=>{
    setSelection(null);
    openNotebookCalendarDate({entryId:entry.id,selectedText:text});
  };
  return (
    <div
      className={`text-editor-layer ${textEnabled ? 'is-active' : ''}`}
      onPointerDownCapture={() => {
        if (textEnabled && !readOnly) selectObject(null);
      }}
      onContextMenu={event=>{
        if(readOnly)return;
        // Preserve browser text tools unless a real editor selection is active.
        const selection=window.getSelection();
        const inside=selection?.anchorNode&&event.currentTarget.contains(selection.anchorNode);
        const text=inside?selection?.toString().trim():'';
        if(!text)return;
        event.preventDefault();
        event.stopPropagation();
        context.openDirect(event.clientX,event.clientY,'Selected Notebook text',
          [
           {label:'Add to calendar…',onSelect:()=>selectedDate(text)},
           {label:'Create linked task…',onSelect:()=>selectedTask(text)},
           ...notebookPromotionActions({title:text,sourceText:text,
            linked:{type:'notebook',id:entry.id},sourceLabel:entry.title||'Notebook page'},
            beginPromotion),
          ],event.currentTarget);
      }}
    >
      <EditorContent editor={editor} />
      {context.menu}
      {selection&&!readOnly&&createPortal(
       <div className="notebook-selection-actions" role="toolbar"
        aria-label="Selected Notebook text actions"
        style={{position:'fixed',left:selection.left,top:selection.top,zIndex:9000}}
        onMouseDown={event=>event.preventDefault()}
        onPointerDown={event=>event.preventDefault()}>
        <small title={selection.text}>“{selection.text.slice(0,35)}”</small>
        <button type="button" onClick={()=>selectedDate(selection.text)}>Add to calendar</button>
        <button type="button" onClick={()=>selectedTask(selection.text)}>Create task</button>
        <button type="button" aria-label="Dismiss text selection actions"
         onClick={()=>setSelection(null)}>×</button>
       </div>,document.body)}
    </div>
  );
}

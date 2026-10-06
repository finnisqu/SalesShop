import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useNotebookStore } from '../store/notebookStore';
import type { NotebookEntry } from '../types/notebook';

interface TextEditorProps {
  entry: NotebookEntry;
  onEditorReady?: (editor: Editor | null) => void;
}

export function TextEditor({ entry, onEditorReady }: TextEditorProps) {
  const updateContent = useNotebookStore((state) => state.updateContent);
  const activeTool = useNotebookStore((state) => state.activeTool);
  const selectObject = useNotebookStore((state) => state.selectObject);
  const textEnabled = activeTool === 'select' || activeTool === 'text';

  const editor = useEditor({
    extensions: [StarterKit],
    content: entry.contentHtml,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'paper-prose',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => updateContent(entry.id, editor.getHTML()),
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

  return (
    <div
      className={`text-editor-layer ${textEnabled ? 'is-active' : ''}`}
      onPointerDownCapture={() => {
        if (textEnabled) selectObject(null);
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useNotebookStore } from '../store/notebookStore';
import type { NotebookEntry } from '../types/notebook';

interface TextEditorProps {
  entry: NotebookEntry;
}

export function TextEditor({ entry }: TextEditorProps) {
  const updateContent = useNotebookStore((state) => state.updateContent);
  const activeTool = useNotebookStore((state) => state.activeTool);

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
    editor.commands.setContent(entry.contentHtml, { emitUpdate: false });
  }, [editor, entry.id]);

  return (
    <div className={`text-editor-layer ${activeTool === 'text' ? 'is-active' : ''}`}>
      <EditorContent editor={editor} />
    </div>
  );
}

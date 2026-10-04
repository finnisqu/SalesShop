import { useRef, type ChangeEvent } from 'react';
import { useNotebookStore } from '../store/notebookStore';
import type { PostItTone, ShapeKind } from '../types/notebook';

interface StationeryInsertMenuProps {
  entryId: string;
}

const MAX_LOCAL_IMAGE_BYTES = 1_500_000;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function StationeryInsertMenu({ entryId }: StationeryInsertMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const createPaperCard = useNotebookStore((state) => state.createPaperCard);
  const createPostIt = useNotebookStore((state) => state.createPostIt);
  const createBusinessCard = useNotebookStore((state) => state.createBusinessCard);
  const createPaperScrap = useNotebookStore((state) => state.createPaperScrap);
  const createShape = useNotebookStore((state) => state.createShape);
  const createImage = useNotebookStore((state) => state.createImage);
  const createAttachment = useNotebookStore((state) => state.createAttachment);
  const createSpreadsheet = useNotebookStore((state) => state.createSpreadsheet);

  const close = () => {
    if (menuRef.current) menuRef.current.open = false;
  };

  const insertPostIt = (tone: PostItTone) => {
    createPostIt(entryId, tone);
    close();
  };

  const insertShape = (shape: ShapeKind) => {
    createShape(entryId, shape);
    close();
  };

  const onImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_LOCAL_IMAGE_BYTES) {
      window.alert('For the local prototype, keep images under 1.5 MB. Supabase Storage will remove this limit later.');
      return;
    }
    const src = await readFileAsDataUrl(file);
    createImage(entryId, src, file.name);
    close();
  };

  const onAttachmentSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    createAttachment(entryId, file.name, file.type, file.size);
    close();
  };

  return (
    <details className="insert-menu" ref={menuRef}>
      <summary className="tool-button object-add-button">+ Insert</summary>
      <div className="insert-menu-panel">
        <div className="insert-menu-heading">Paper</div>
        <button type="button" onClick={() => { createPaperCard(entryId); close(); }}>Paper card</button>
        <button type="button" onClick={() => insertPostIt('yellow')}>Yellow Post-it</button>
        <button type="button" onClick={() => insertPostIt('blue')}>Blue Post-it</button>
        <button type="button" onClick={() => { createPaperScrap(entryId, 'index'); close(); }}>Index card</button>
        <button type="button" onClick={() => { createPaperScrap(entryId, 'torn'); close(); }}>Torn note</button>

        <div className="insert-menu-heading">Work</div>
        <button type="button" onClick={() => { createSpreadsheet(entryId); close(); }}>Spreadsheet</button>
        <button type="button" onClick={() => { createBusinessCard(entryId); close(); }}>Business card</button>
        <button type="button" onClick={() => imageInputRef.current?.click()}>Photo / image</button>
        <button type="button" onClick={() => attachmentInputRef.current?.click()}>Attachment</button>

        <div className="insert-menu-heading">Annotate</div>
        <button type="button" onClick={() => insertShape('box')}>Sketch box</button>
        <button type="button" onClick={() => insertShape('arrow')}>Arrow</button>
        <button type="button" onClick={() => insertShape('cloud')}>Cloud</button>
      </div>

      <input ref={imageInputRef} className="visually-hidden-file" type="file" accept="image/*" onChange={onImageSelected} tabIndex={-1} />
      <input ref={attachmentInputRef} className="visually-hidden-file" type="file" onChange={onAttachmentSelected} tabIndex={-1} />
    </details>
  );
}

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useNotebookStore } from '../store/notebookStore';
import type {
  BusinessCardField,
  NotebookEntry,
  NotebookObject,
  NotebookObjectFrame,
  PostItTone,
} from '../types/notebook';
import { RoughShapeArtwork } from './RoughShapeArtwork';
import { SpreadsheetObjectEditor } from './SpreadsheetObjectEditor';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const POST_IT_TONES: PostItTone[] = ['yellow', 'pink', 'blue', 'green'];

interface NotebookObjectLayerProps {
  entry: NotebookEntry;
}

interface InteractionState {
  kind: 'move' | 'resize' | 'rotate';
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startFrame: NotebookObjectFrame;
  startAngle?: number;
  centerX?: number;
  centerY?: number;
}

function frameOf(object: NotebookObject): NotebookObjectFrame {
  return {
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
    rotation: object.rotation,
    zIndex: object.zIndex,
  };
}

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function stopPointer(event: ReactPointerEvent<HTMLElement>) {
  event.stopPropagation();
}

function ObjectContent({ entryId, object, selected }: { entryId: string; object: NotebookObject; selected: boolean }) {
  const updateTextObject = useNotebookStore((state) => state.updateTextObject);
  const updatePostItTone = useNotebookStore((state) => state.updatePostItTone);
  const updateBusinessCardField = useNotebookStore((state) => state.updateBusinessCardField);
  const updateImageCaption = useNotebookStore((state) => state.updateImageCaption);
  const updateSpreadsheetData = useNotebookStore((state) => state.updateSpreadsheetData);

  if (object.type === 'paper-card') {
    return (
      <div className={`paper-card-object tone-${object.tone}`}>
        <textarea value={object.text} onChange={(event) => updateTextObject(entryId, object.id, event.target.value)} aria-label="Paper card text" />
      </div>
    );
  }

  if (object.type === 'post-it') {
    return (
      <div className={`post-it-object tone-${object.tone}`}>
        <div className="post-it-fold" aria-hidden="true" />
        <textarea value={object.text} onChange={(event) => updateTextObject(entryId, object.id, event.target.value)} aria-label="Post-it text" />
        {selected && (
          <div className="post-it-tones" aria-label="Post-it color">
            {POST_IT_TONES.map((tone) => (
              <button key={tone} type="button" className={`tone-dot tone-${tone} ${object.tone === tone ? 'active' : ''}`} onClick={() => updatePostItTone(entryId, object.id, tone)} aria-label={`${tone} Post-it`} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (object.type === 'business-card') {
    const field = (name: BusinessCardField, className: string, placeholder: string) => (
      <input className={className} value={object[name] ?? ''} placeholder={placeholder} onChange={(event) => updateBusinessCardField(entryId, object.id, name, event.target.value)} />
    );
    return (
      <div className="business-card-object">
        <div className="business-card-rule" aria-hidden="true" />
        <div className="business-card-fields">
          {field('name', 'business-card-name', 'Contact name')}
          {field('title', 'business-card-title', 'Title')}
          {field('company', 'business-card-company', 'Company')}
          <div className="business-card-contact-row">
            {field('email', 'business-card-contact', 'email@company.com')}
            {field('phone', 'business-card-contact', '(555) 555-5555')}
          </div>
        </div>
      </div>
    );
  }

  if (object.type === 'paper-scrap') {
    return (
      <div className={`paper-scrap-object variant-${object.variant}`}>
        <textarea value={object.text} onChange={(event) => updateTextObject(entryId, object.id, event.target.value)} aria-label="Paper scrap text" />
      </div>
    );
  }

  if (object.type === 'image') {
    return (
      <figure className="image-object">
        <div className="image-mat"><img src={object.src} alt={object.alt} draggable={false} /></div>
        <input value={object.caption ?? ''} placeholder="Add a caption…" onChange={(event) => updateImageCaption(entryId, object.id, event.target.value)} aria-label="Image caption" />
      </figure>
    );
  }

  if (object.type === 'attachment') {
    const extension = object.name.includes('.') ? object.name.split('.').pop()?.toUpperCase() : 'FILE';
    return (
      <div className="attachment-object">
        <div className="attachment-icon">{extension?.slice(0, 4) || 'FILE'}</div>
        <div className="attachment-copy">
          <strong>{object.name}</strong>
          <span>{[object.mimeType, formatBytes(object.size)].filter(Boolean).join(' · ') || 'Local attachment reference'}</span>
        </div>
        <div className="attachment-clip" aria-hidden="true">⌇</div>
      </div>
    );
  }

  if (object.type === 'shape') {
    return <div className={`shape-object shape-${object.shape}`}><RoughShapeArtwork object={object} /></div>;
  }

  if (object.type === 'spreadsheet') {
    return (
      <SpreadsheetObjectEditor
        objectId={object.id}
        workbookData={object.workbookData}
        interactive={selected}
        onSnapshotChange={(snapshot) => updateSpreadsheetData(entryId, object.id, snapshot)}
      />
    );
  }

  return <div className="future-object-placeholder">Notebook object</div>;
}

function ObjectFrame({ entryId, object, selected }: { entryId: string; object: NotebookObject; selected: boolean }) {
  const selectObject = useNotebookStore((state) => state.selectObject);
  const updateObjectFrame = useNotebookStore((state) => state.updateObjectFrame);
  const deleteObject = useNotebookStore((state) => state.deleteObject);
  const initialFrame = frameOf(object);
  const [draftFrame, setDraftFrame] = useState(initialFrame);
  const draftFrameRef = useRef(initialFrame);
  const interactionRef = useRef<InteractionState | null>(null);

  const setFrame = (frame: NotebookObjectFrame) => {
    draftFrameRef.current = frame;
    setDraftFrame(frame);
  };

  useEffect(() => {
    if (!interactionRef.current) {
      const frame = frameOf(object);
      draftFrameRef.current = frame;
      setDraftFrame(frame);
    }
  }, [object.x, object.y, object.width, object.height, object.rotation, object.zIndex]);

  const layerRect = (target: HTMLElement) => target.closest('.notebook-object-layer')?.getBoundingClientRect() ?? null;

  const beginMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    selectObject(object.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = { kind: 'move', pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startFrame: draftFrameRef.current };
  };

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    selectObject(object.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = { kind: 'resize', pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startFrame: draftFrameRef.current };
  };

  const beginRotate = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    selectObject(object.id);
    const frameRect = event.currentTarget.closest('.notebook-object-frame')?.getBoundingClientRect();
    if (!frameRect) return;
    const centerX = frameRect.left + frameRect.width / 2;
    const centerY = frameRect.top + frameRect.height / 2;
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      kind: 'rotate', pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY,
      startFrame: draftFrameRef.current, centerX, centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI,
    };
  };

  const continueInteraction = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    event.preventDefault();

    if (interaction.kind === 'rotate') {
      const currentAngle = Math.atan2(event.clientY - (interaction.centerY ?? 0), event.clientX - (interaction.centerX ?? 0)) * 180 / Math.PI;
      const rotation = interaction.startFrame.rotation + currentAngle - (interaction.startAngle ?? currentAngle);
      setFrame({ ...interaction.startFrame, rotation: Math.round(rotation * 10) / 10 });
      return;
    }

    const rect = layerRect(event.currentTarget);
    if (!rect) return;
    const dx = (event.clientX - interaction.startClientX) / rect.width * 100;
    const dy = (event.clientY - interaction.startClientY) / rect.height * 100;

    if (interaction.kind === 'move') {
      setFrame({ ...interaction.startFrame, x: clamp(interaction.startFrame.x + dx, 0, 100 - interaction.startFrame.width), y: clamp(interaction.startFrame.y + dy, 0, 100 - interaction.startFrame.height) });
      return;
    }

    setFrame({ ...interaction.startFrame, width: clamp(interaction.startFrame.width + dx, 9, 100 - interaction.startFrame.x), height: clamp(interaction.startFrame.height + dy, 6, 100 - interaction.startFrame.y) });
  };

  const finishInteraction = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    event.preventDefault();
    updateObjectFrame(entryId, object.id, draftFrameRef.current);
    interactionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const interactionHandlers = { onPointerMove: continueInteraction, onPointerUp: finishInteraction, onPointerCancel: finishInteraction };

  return (
    <div
      className={`notebook-object-frame ${selected ? 'is-selected' : ''}`}
      style={{ left: `${draftFrame.x}%`, top: `${draftFrame.y}%`, width: `${draftFrame.width}%`, height: `${draftFrame.height}%`, transform: `rotate(${draftFrame.rotation}deg)`, zIndex: selected ? 1000 : draftFrame.zIndex }}
      onPointerDown={(event) => { event.stopPropagation(); selectObject(object.id); }}
      data-object-type={object.type}
    >
      <ObjectContent entryId={entryId} object={object} selected={selected} />
      {selected && (
        <>
          <button className="object-handle object-move-handle" type="button" aria-label="Move object" title="Move" onPointerDown={beginMove} {...interactionHandlers}>⋮⋮</button>
          <button className="object-handle object-rotate-handle" type="button" aria-label="Rotate object" title="Rotate" onPointerDown={beginRotate} {...interactionHandlers}>↻</button>
          <button className="object-handle object-resize-handle" type="button" aria-label="Resize object" title="Resize" onPointerDown={beginResize} {...interactionHandlers} />
          <button className="object-delete-button" type="button" aria-label="Delete object" title="Delete" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); deleteObject(entryId, object.id); }}>×</button>
        </>
      )}
    </div>
  );
}

export function NotebookObjectLayer({ entry }: NotebookObjectLayerProps) {
  const activeTool = useNotebookStore((state) => state.activeTool);
  const selectedObjectId = useNotebookStore((state) => state.selectedObjectId);
  const selectObject = useNotebookStore((state) => state.selectObject);
  const deleteObject = useNotebookStore((state) => state.deleteObject);
  const selectionEnabled = activeTool === 'select' || activeTool === 'text';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectionEnabled || !selectedObjectId || (event.key !== 'Delete' && event.key !== 'Backspace')) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]') || target?.closest('.spreadsheet-object-editor')) return;
      event.preventDefault();
      deleteObject(entry.id, selectedObjectId);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [deleteObject, entry.id, selectedObjectId, selectionEnabled]);

  return (
    <div className={`notebook-object-layer ${selectionEnabled ? 'is-selecting' : ''}`} onPointerDown={(event) => { if (selectionEnabled && event.target === event.currentTarget) selectObject(null); }} aria-label="Notebook objects">
      {entry.objects.map((object) => (
        <ObjectFrame key={object.id} entryId={entry.id} object={object} selected={selectionEnabled && selectedObjectId === object.id} />
      ))}
    </div>
  );
}

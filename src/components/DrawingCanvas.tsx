import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { getStroke } from 'perfect-freehand';
import { useNotebookStore } from '../store/notebookStore';
import type { InkPoint, InkStroke, InkTool, NotebookEntry } from '../types/notebook';

const PAGE_WIDTH = 1200;
const PAGE_HEIGHT = 1553;

function svgPath(points: number[][]) {
  if (!points.length) return '';
  const [first, ...rest] = points;
  return `M ${first[0].toFixed(2)} ${first[1].toFixed(2)} ${rest
    .map((point) => `L ${point[0].toFixed(2)} ${point[1].toFixed(2)}`)
    .join(' ')} Z`;
}

function toolStyle(tool: InkTool) {
  if (tool === 'marker') return { color: '#315f9a', size: 18, opacity: 0.62 };
  if (tool === 'highlighter') return { color: '#f0c94d', size: 34, opacity: 0.28 };
  return { color: '#2f2b24', size: 5, opacity: 0.92 };
}

function outlineFor(stroke: InkStroke) {
  return getStroke(
    stroke.points.map((point) => [point.x, point.y, point.pressure]),
    {
      size: stroke.size,
      thinning: stroke.tool === 'pen' ? 0.62 : 0.18,
      smoothing: 0.72,
      streamline: 0.38,
      simulatePressure: false,
      last: true,
    },
  );
}

interface DrawingCanvasProps {
  entry: NotebookEntry;
}

export function DrawingCanvas({ entry }: DrawingCanvasProps) {
  const activeTool = useNotebookStore((state) => state.activeTool);
  const addStroke = useNotebookStore((state) => state.addStroke);
  const [draft, setDraft] = useState<InkStroke | null>(null);
  const draftRef = useRef<InkStroke | null>(null);
  const drawingRef = useRef(false);

  const renderedStrokes = useMemo(
    () => entry.strokes.map((stroke) => ({ stroke, path: svgPath(outlineFor(stroke)) })),
    [entry.strokes],
  );

  const draftPath = draft ? svgPath(outlineFor(draft)) : '';
  const drawingEnabled = activeTool !== 'text';

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>): InkPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    const pressure = event.pointerType === 'mouse' ? 0.5 : Math.max(0.05, event.pressure || 0.5);
    return {
      x: ((event.clientX - rect.left) / rect.width) * PAGE_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * PAGE_HEIGHT,
      pressure,
    };
  };

  const beginStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawingEnabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const tool = activeTool as InkTool;
    const style = toolStyle(tool);
    const stroke: InkStroke = {
      id: `stroke_${crypto.randomUUID()}`,
      tool,
      ...style,
      points: [pointFromEvent(event)],
    };
    draftRef.current = stroke;
    setDraft(stroke);
  };

  const extendStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current || !draftRef.current) return;
    event.preventDefault();
    const next = { ...draftRef.current, points: [...draftRef.current.points, pointFromEvent(event)] };
    draftRef.current = next;
    setDraft(next);
  };

  const finishStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawingRef.current = false;
    const completed = draftRef.current;
    if (completed?.points.length) addStroke(entry.id, completed);
    draftRef.current = null;
    setDraft(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <svg
      className={`ink-layer ${drawingEnabled ? 'is-active' : ''}`}
      viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
      preserveAspectRatio="none"
      onPointerDown={beginStroke}
      onPointerMove={extendStroke}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
      aria-label="Notebook ink canvas"
    >
      {renderedStrokes.map(({ stroke, path }) => (
        <path
          key={stroke.id}
          d={path}
          fill={stroke.color}
          fillOpacity={stroke.opacity}
          className={stroke.tool === 'highlighter' ? 'ink-highlighter' : undefined}
        />
      ))}
      {draft && (
        <path
          d={draftPath}
          fill={draft.color}
          fillOpacity={draft.opacity}
          className={draft.tool === 'highlighter' ? 'ink-highlighter' : undefined}
        />
      )}
    </svg>
  );
}

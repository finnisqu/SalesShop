import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { getStroke } from 'perfect-freehand';
import './ink-tools.css';
import { useNotebookInputStore } from '../store/notebookInputStore';
import { useNotebookStore } from '../store/notebookStore';
import type { InkPoint, InkStroke, InkTool, NotebookEntry } from '../types/notebook';

const PAGE_WIDTH = 1200;
const PAGE_HEIGHT = 1553;
const ERASER_RADIUS = 24;

interface DrawingCanvasProps {
  entry: NotebookEntry;
}

interface Bounds {
  x: number;
  y: number;
  maxX: number;
  maxY: number;
}

type Gesture = 'draw' | 'erase' | 'lasso' | 'move-selection' | null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function svgPath(points: number[][]) {
  if (!points.length) return '';
  const [first, ...rest] = points;
  return `M ${first[0].toFixed(2)} ${first[1].toFixed(2)} ${rest
    .map((point) => `L ${point[0].toFixed(2)} ${point[1].toFixed(2)}`)
    .join(' ')} Z`;
}

function toolStyle(tool: InkTool) {
  if (tool === 'marker') return { color: '#315f9a', size: 16, opacity: 0.62 };
  if (tool === 'highlighter') return { color: '#f0c94d', size: 34, opacity: 0.28 };
  return { color: '#2f2b24', size: 4.6, opacity: 0.93 };
}

function outlineFor(stroke: InkStroke) {
  const pen = stroke.tool === 'pen';
  const marker = stroke.tool === 'marker';
  return getStroke(
    stroke.points.map((point) => [point.x, point.y, point.pressure]),
    {
      size: stroke.size,
      thinning: pen ? 0.72 : marker ? 0.28 : 0.05,
      smoothing: pen ? 0.64 : marker ? 0.68 : 0.78,
      streamline: pen ? 0.28 : marker ? 0.42 : 0.56,
      simulatePressure: stroke.input === 'mouse',
      start: { taper: pen ? 1.5 : 0, cap: true },
      end: { taper: pen ? 1.5 : 0, cap: true },
      last: true,
    },
  );
}

function strokeBounds(stroke: InkStroke): Bounds | null {
  if (!stroke.points.length) return null;
  let x = Infinity;
  let y = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of stroke.points) {
    x = Math.min(x, point.x);
    y = Math.min(y, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { x, y, maxX, maxY };
}

function selectionBounds(strokes: InkStroke[]): Bounds | null {
  const bounds = strokes.map(strokeBounds).filter((value): value is Bounds => Boolean(value));
  if (!bounds.length) return null;
  return {
    x: Math.min(...bounds.map((value) => value.x)),
    y: Math.min(...bounds.map((value) => value.y)),
    maxX: Math.max(...bounds.map((value) => value.maxX)),
    maxY: Math.max(...bounds.map((value) => value.maxY)),
  };
}

function pointInBounds(point: InkPoint, bounds: Bounds, padding = 16) {
  return point.x >= bounds.x - padding && point.x <= bounds.maxX + padding && point.y >= bounds.y - padding && point.y <= bounds.maxY + padding;
}

function pointInPolygon(point: InkPoint, polygon: InkPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const crosses = yi > point.y !== yj > point.y
      && point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.0001) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point: InkPoint, a: InkPoint, b: InkPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (!dx && !dy) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function strokeHitsPoint(stroke: InkStroke, point: InkPoint) {
  const radius = ERASER_RADIUS + stroke.size * 0.35;
  if (stroke.points.length === 1) return distanceToSegment(point, stroke.points[0], stroke.points[0]) <= radius;
  for (let index = 1; index < stroke.points.length; index += 1) {
    if (distanceToSegment(point, stroke.points[index - 1], stroke.points[index]) <= radius) return true;
  }
  return false;
}

function selectedByLasso(stroke: InkStroke, polygon: InkPoint[]) {
  if (!stroke.points.length || polygon.length < 3) return false;
  if (stroke.points.some((point) => pointInPolygon(point, polygon))) return true;
  const center = stroke.points.reduce(
    (sum, point) => ({ x: sum.x + point.x / stroke.points.length, y: sum.y + point.y / stroke.points.length, pressure: 0.5 }),
    { x: 0, y: 0, pressure: 0.5 },
  );
  return pointInPolygon(center, polygon);
}

export function DrawingCanvas({ entry }: DrawingCanvasProps) {
  const activeTool = useNotebookStore((state) => state.activeTool);
  const addStroke = useNotebookStore((state) => state.addStroke);
  const deleteStrokes = useNotebookStore((state) => state.deleteStrokes);
  const moveStrokes = useNotebookStore((state) => state.moveStrokes);
  const inputMode = useNotebookInputStore((state) => state.inputMode);

  const [draft, setDraft] = useState<InkStroke | null>(null);
  const [lassoPoints, setLassoPoints] = useState<InkPoint[]>([]);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);
  const [selectionOffset, setSelectionOffset] = useState({ dx: 0, dy: 0 });
  const [erasedPreviewIds, setErasedPreviewIds] = useState<string[]>([]);

  const draftRef = useRef<InkStroke | null>(null);
  const gestureRef = useRef<Gesture>(null);
  const erasedIdsRef = useRef<Set<string>>(new Set());
  const moveStartRef = useRef<InkPoint | null>(null);

  const renderedStrokes = useMemo(
    () => entry.strokes.map((stroke) => ({ stroke, path: svgPath(outlineFor(stroke)) })),
    [entry.strokes],
  );

  const selectedStrokes = useMemo(
    () => entry.strokes.filter((stroke) => selectedStrokeIds.includes(stroke.id)),
    [entry.strokes, selectedStrokeIds],
  );
  const baseSelectionBounds = useMemo(() => selectionBounds(selectedStrokes), [selectedStrokes]);
  const erasedSet = useMemo(() => new Set(erasedPreviewIds), [erasedPreviewIds]);

  const drawingEnabled = activeTool === 'pen' || activeTool === 'marker' || activeTool === 'highlighter';
  const inkInteractionEnabled = drawingEnabled || activeTool === 'eraser' || activeTool === 'lasso';
  const touchInkEnabled = inputMode === 'finger';

  useEffect(() => {
    if (activeTool !== 'lasso') {
      setSelectedStrokeIds([]);
      setLassoPoints([]);
      setSelectionOffset({ dx: 0, dy: 0 });
    }
  }, [activeTool]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (activeTool !== 'lasso' || !selectedStrokeIds.length) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]') || target?.closest('.spreadsheet-object-editor')) return;
      if (event.key === 'Escape') {
        setSelectedStrokeIds([]);
        return;
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      event.preventDefault();
      deleteStrokes(entry.id, selectedStrokeIds);
      setSelectedStrokeIds([]);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeTool, deleteStrokes, entry.id, selectedStrokeIds]);

  const pointsFromEvent = (event: ReactPointerEvent<SVGSVGElement>): InkPoint[] => {
    const rect = event.currentTarget.getBoundingClientRect();
    const native = event.nativeEvent;
    const samples = native.getCoalescedEvents?.() ?? [];
    const events = samples.length ? samples : [native];
    return events.map((sample) => ({
      x: ((sample.clientX - rect.left) / rect.width) * PAGE_WIDTH,
      y: ((sample.clientY - rect.top) / rect.height) * PAGE_HEIGHT,
      pressure: sample.pointerType === 'mouse' ? 0.5 : Math.max(0.05, sample.pressure || 0.5),
    }));
  };

  const primaryPoint = (event: ReactPointerEvent<SVGSVGElement>) => pointsFromEvent(event).at(-1) ?? { x: 0, y: 0, pressure: 0.5 };

  const collectEraseHits = (points: InkPoint[]) => {
    let changed = false;
    for (const point of points) {
      for (const stroke of entry.strokes) {
        if (erasedIdsRef.current.has(stroke.id)) continue;
        if (strokeHitsPoint(stroke, point)) {
          erasedIdsRef.current.add(stroke.id);
          changed = true;
        }
      }
    }
    if (changed) setErasedPreviewIds(Array.from(erasedIdsRef.current));
  };

  const touchAllowed = (event: ReactPointerEvent<SVGSVGElement>) => event.pointerType !== 'touch' || touchInkEnabled;

  const beginGesture = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!inkInteractionEnabled || !touchAllowed(event)) return;
    const point = primaryPoint(event);

    if (activeTool === 'lasso' && baseSelectionBounds) {
      const translatedBounds = {
        x: baseSelectionBounds.x + selectionOffset.dx,
        y: baseSelectionBounds.y + selectionOffset.dy,
        maxX: baseSelectionBounds.maxX + selectionOffset.dx,
        maxY: baseSelectionBounds.maxY + selectionOffset.dy,
      };
      if (pointInBounds(point, translatedBounds)) {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        gestureRef.current = 'move-selection';
        moveStartRef.current = point;
        return;
      }
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    if (activeTool === 'eraser') {
      gestureRef.current = 'erase';
      erasedIdsRef.current = new Set();
      setErasedPreviewIds([]);
      collectEraseHits([point]);
      return;
    }

    if (activeTool === 'lasso') {
      gestureRef.current = 'lasso';
      setSelectedStrokeIds([]);
      setSelectionOffset({ dx: 0, dy: 0 });
      setLassoPoints([point]);
      return;
    }

    const tool = activeTool as InkTool;
    const stroke: InkStroke = {
      id: `stroke_${crypto.randomUUID()}`,
      tool,
      ...toolStyle(tool),
      input: event.pointerType === 'pen' ? 'pen' : 'mouse',
      points: [point],
    };
    gestureRef.current = 'draw';
    draftRef.current = stroke;
    setDraft(stroke);
  };

  const continueGesture = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || !touchAllowed(event)) return;
    const points = pointsFromEvent(event);
    if (!points.length) return;
    event.preventDefault();

    if (gesture === 'draw' && draftRef.current) {
      const next = { ...draftRef.current, points: [...draftRef.current.points, ...points] };
      draftRef.current = next;
      setDraft(next);
      return;
    }

    if (gesture === 'erase') {
      collectEraseHits(points);
      return;
    }

    if (gesture === 'lasso') {
      setLassoPoints((current) => [...current, ...points]);
      return;
    }

    if (gesture === 'move-selection' && moveStartRef.current && baseSelectionBounds) {
      const point = points.at(-1)!;
      const rawDx = point.x - moveStartRef.current.x;
      const rawDy = point.y - moveStartRef.current.y;
      setSelectionOffset({
        dx: clamp(rawDx, -baseSelectionBounds.x, PAGE_WIDTH - baseSelectionBounds.maxX),
        dy: clamp(rawDy, -baseSelectionBounds.y, PAGE_HEIGHT - baseSelectionBounds.maxY),
      });
    }
  };

  const finishGesture = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    event.preventDefault();

    if (gesture === 'draw') {
      const completed = draftRef.current;
      if (completed?.points.length) addStroke(entry.id, completed);
      draftRef.current = null;
      setDraft(null);
    } else if (gesture === 'erase') {
      const ids = Array.from(erasedIdsRef.current);
      if (ids.length) deleteStrokes(entry.id, ids);
      erasedIdsRef.current = new Set();
      setErasedPreviewIds([]);
      setSelectedStrokeIds((current) => current.filter((id) => !ids.includes(id)));
    } else if (gesture === 'lasso') {
      const polygon = lassoPoints;
      const ids = entry.strokes.filter((stroke) => selectedByLasso(stroke, polygon)).map((stroke) => stroke.id);
      setSelectedStrokeIds(ids);
      setLassoPoints([]);
    } else if (gesture === 'move-selection') {
      if (selectionOffset.dx || selectionOffset.dy) moveStrokes(entry.id, selectedStrokeIds, selectionOffset.dx, selectionOffset.dy);
      setSelectionOffset({ dx: 0, dy: 0 });
      moveStartRef.current = null;
    }

    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const draftPath = draft ? svgPath(outlineFor(draft)) : '';
  const selectionBox = baseSelectionBounds ? {
    x: baseSelectionBounds.x + selectionOffset.dx - 12,
    y: baseSelectionBounds.y + selectionOffset.dy - 12,
    width: baseSelectionBounds.maxX - baseSelectionBounds.x + 24,
    height: baseSelectionBounds.maxY - baseSelectionBounds.y + 24,
  } : null;

  return (
    <svg
      className={`ink-layer ${inkInteractionEnabled ? 'is-active' : ''} ${touchInkEnabled ? 'touch-ink-enabled' : ''} tool-${activeTool}`}
      viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
      preserveAspectRatio="none"
      onPointerDown={beginGesture}
      onPointerMove={continueGesture}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
      aria-label="Notebook ink canvas"
    >
      {renderedStrokes.map(({ stroke, path }) => {
        if (erasedSet.has(stroke.id)) return null;
        const selected = selectedStrokeIds.includes(stroke.id);
        return (
          <path
            key={stroke.id}
            d={path}
            fill={stroke.color}
            fillOpacity={stroke.opacity}
            transform={selected && (selectionOffset.dx || selectionOffset.dy) ? `translate(${selectionOffset.dx} ${selectionOffset.dy})` : undefined}
            className={`${stroke.tool === 'highlighter' ? 'ink-highlighter ' : ''}${selected ? 'ink-selected-stroke' : ''}`}
          />
        );
      })}

      {draft && <path d={draftPath} fill={draft.color} fillOpacity={draft.opacity} className={draft.tool === 'highlighter' ? 'ink-highlighter' : undefined} />}

      {lassoPoints.length > 1 && (
        <polyline
          className="ink-lasso-path"
          points={lassoPoints.map((point) => `${point.x},${point.y}`).join(' ')}
        />
      )}

      {activeTool === 'lasso' && selectionBox && selectedStrokeIds.length > 0 && (
        <g className="ink-selection-ui">
          <rect className="ink-selection-box" x={selectionBox.x} y={selectionBox.y} width={selectionBox.width} height={selectionBox.height} rx="8" />
          <text className="ink-selection-label" x={selectionBox.x + 8} y={selectionBox.y - 8}>{selectedStrokeIds.length} stroke{selectedStrokeIds.length === 1 ? '' : 's'}</text>
        </g>
      )}
    </svg>
  );
}

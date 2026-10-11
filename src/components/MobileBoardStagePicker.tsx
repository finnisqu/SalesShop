import { useEffect, useState, type RefObject } from 'react';

/** Navigate a horizontally paged mobile Board without disturbing each stage's vertical scroll. */
export function MobileBoardStagePicker({
  boardRef,
  stages,
  counts,
}: {
  boardRef: RefObject<HTMLElement | null>;
  stages: readonly string[];
  counts: readonly number[];
}) {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const columns = Array.from(board.querySelectorAll<HTMLElement>('.board-column'));
        if (!columns.length) return;
        const center = board.getBoundingClientRect().left + board.clientWidth / 2;
        const index = columns.reduce((best, column, i) => {
          const rect = column.getBoundingClientRect();
          const bestRect = columns[best].getBoundingClientRect();
          return Math.abs(rect.left + rect.width / 2 - center) <
            Math.abs(bestRect.left + bestRect.width / 2 - center) ? i : best;
        }, 0);
        setActiveStage(index);
      });
    };
    board.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    // Existing Board state restoration occurs on the next frame.
    const initialFrame = requestAnimationFrame(update);
    return () => {
      board.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      cancelAnimationFrame(initialFrame);
      cancelAnimationFrame(frame);
    };
  }, [boardRef]);

  const navigateTo = (index: number) => {
    setActiveStage(index);
    const board = boardRef.current;
    const columns = board?.querySelectorAll<HTMLElement>('.board-column');
    if (!board || !columns?.length || !columns[index]) return;
    board.scrollTo({ left: columns[index].offsetLeft - columns[0].offsetLeft, behavior: 'smooth' });
  };

  return (
    <div className="mobile-board-stage-picker" aria-label="Board stage navigation">
      <label>
        <span>Stage</span>
        <select value={Math.min(activeStage, Math.max(0, stages.length - 1))} onChange={(event) => navigateTo(Number(event.target.value))}>
          {stages.map((stage, index) => (
            <option key={stage} value={index}>{stage} · {counts[index] ?? 0}</option>
          ))}
        </select>
      </label>
      <span className="mobile-board-stage-position" aria-live="off">{Math.min(activeStage + 1, stages.length)} / {stages.length}</span>
      <span className="mobile-board-stage-hint">Swipe for next stage →</span>
    </div>
  );
}

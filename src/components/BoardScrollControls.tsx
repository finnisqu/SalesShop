import type { RefObject } from 'react';

function activeColumn(board: HTMLElement) {
  const boardRect = board.getBoundingClientRect();
  const targetX = boardRect.left + boardRect.width / 2;
  const columns = Array.from(board.querySelectorAll<HTMLElement>('.board-column'));
  return columns.reduce<HTMLElement | null>((best, column) => {
    if (!best) return column;
    const columnRect = column.getBoundingClientRect();
    const bestRect = best.getBoundingClientRect();
    const distance = Math.abs(columnRect.left + columnRect.width / 2 - targetX);
    const bestDistance = Math.abs(bestRect.left + bestRect.width / 2 - targetX);
    return distance < bestDistance ? column : best;
  }, null);
}

export function BoardScrollControls({ boardRef }: { boardRef: RefObject<HTMLElement | null> }) {
  const horizontal = (direction: -1 | 1) => {
    const board = boardRef.current;
    if (!board) return;
    board.scrollBy({ left: direction * Math.max(300, board.clientWidth * 0.72), behavior: 'smooth' });
  };

  const vertical = (direction: -1 | 1) => {
    const board = boardRef.current;
    if (!board) return;
    const stack = activeColumn(board)?.querySelector<HTMLElement>('.board-card-stack');
    if (stack && stack.scrollHeight > stack.clientHeight + 4) {
      stack.scrollBy({ top: direction * Math.max(180, stack.clientHeight * 0.7), behavior: 'smooth' });
      return;
    }
    board.scrollBy({ top: direction * Math.max(180, board.clientHeight * 0.55), behavior: 'smooth' });
  };

  return (
    <div className="board-scroll-controls" aria-label="Board scroll controls">
      <button type="button" className="scroll-up" onClick={() => vertical(-1)} aria-label="Scroll board up" title="Scroll up">↑</button>
      <button type="button" className="scroll-left" onClick={() => horizontal(-1)} aria-label="Scroll board left" title="Scroll left">←</button>
      <button type="button" className="scroll-right" onClick={() => horizontal(1)} aria-label="Scroll board right" title="Scroll right">→</button>
      <button type="button" className="scroll-down" onClick={() => vertical(1)} aria-label="Scroll board down" title="Scroll down">↓</button>
    </div>
  );
}

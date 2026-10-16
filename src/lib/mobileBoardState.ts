export const MOBILE_BOARD_MEDIA_QUERY = '(max-width: 700px), (pointer: coarse)';

export type MobileBoardScrollState = {
  stage?: string;
  columns: Record<string, number>;
};

function emptyState(): MobileBoardScrollState {
  return { columns: {} };
}

export function isMobileBoardInteraction() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_BOARD_MEDIA_QUERY).matches;
}

export function readMobileBoardState(storageKey: string): MobileBoardScrollState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<MobileBoardScrollState>;
    return {
      stage: typeof parsed.stage === 'string' ? parsed.stage : undefined,
      columns: parsed.columns && typeof parsed.columns === 'object' ? parsed.columns : {},
    };
  } catch {
    return emptyState();
  }
}

function writeMobileBoardState(storageKey: string, state: MobileBoardScrollState) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Board position memory is a convenience only; never block the CRM if storage is unavailable.
  }
}

export function rememberMobileBoardStage(storageKey: string, board: HTMLElement) {
  if (!isMobileBoardInteraction()) return;
  const columns = Array.from(board.querySelectorAll<HTMLElement>('[data-board-stage]'));
  if (!columns.length) return;
  const boardLeft = board.getBoundingClientRect().left;
  let closest = columns[0];
  let closestDistance = Number.POSITIVE_INFINITY;
  columns.forEach((column) => {
    const distance = Math.abs(column.getBoundingClientRect().left - boardLeft - 10);
    if (distance < closestDistance) {
      closest = column;
      closestDistance = distance;
    }
  });
  const stage = closest.dataset.boardStage;
  if (!stage) return;
  const state = readMobileBoardState(storageKey);
  if (state.stage === stage) return;
  writeMobileBoardState(storageKey, { ...state, stage });
}

export function rememberMobileColumnScroll(storageKey: string, stage: string, scrollTop: number) {
  if (!isMobileBoardInteraction()) return;
  const state = readMobileBoardState(storageKey);
  const previous = state.columns[stage] ?? 0;
  if (Math.abs(previous - scrollTop) < 2) return;
  writeMobileBoardState(storageKey, {
    ...state,
    columns: { ...state.columns, [stage]: scrollTop },
  });
}

export function restoreMobileBoardState(storageKey: string, board: HTMLElement | null) {
  if (!board || !isMobileBoardInteraction()) return;
  const state = readMobileBoardState(storageKey);
  const columns = Array.from(board.querySelectorAll<HTMLElement>('[data-board-stage]'));
  if (!columns.length) return;

  const target = columns.find((column) => column.dataset.boardStage === state.stage) ?? columns[0];
  const boardRect = board.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  board.scrollLeft += targetRect.left - boardRect.left - 10;

  columns.forEach((column) => {
    const stage = column.dataset.boardStage;
    if (!stage) return;
    const stack = column.querySelector<HTMLElement>('.board-card-stack');
    if (!stack) return;
    stack.scrollTop = state.columns[stage] ?? 0;
  });
}

import type { ReactNode } from 'react';

type WorkspaceLoadingStateProps = {
  title: string;
  detail?: string;
  icon?: ReactNode;
};

/** Calm, accessible loading treatment for data-backed workspaces. */
export function WorkspaceLoadingState({ title, detail, icon }: WorkspaceLoadingStateProps) {
  return (
    <div className="workspace-loading-state" role="status" aria-live="polite">
      <span className="workspace-loading-marker" aria-hidden="true">{icon ?? '◌'}</span>
      <div>
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </div>
  );
}

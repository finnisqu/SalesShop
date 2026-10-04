export type PaperStyle = 'lined' | 'grid' | 'blank';
export type InkTool = 'pen' | 'marker' | 'highlighter';

export interface InkPoint {
  x: number;
  y: number;
  pressure: number;
}

export interface InkStroke {
  id: string;
  tool: InkTool;
  color: string;
  size: number;
  opacity: number;
  points: InkPoint[];
}

export interface NotebookEntry {
  id: string;
  title: string;
  contentHtml: string;
  strokes: InkStroke[];
  paperStyle: PaperStyle;
  createdAt: string;
  updatedAt: string;
}

export interface NotebookDocument {
  schemaVersion: 1;
  entries: NotebookEntry[];
  activeEntryId: string | null;
}

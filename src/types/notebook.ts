export type PaperStyle = 'lined' | 'grid' | 'blank';
export type InkTool = 'pen' | 'marker' | 'highlighter';
export type ActiveNotebookTool = 'select' | 'text' | InkTool;

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

export interface NotebookObjectBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaperCardObject extends NotebookObjectBase {
  type: 'paper-card';
  text: string;
  tone: 'cream' | 'white' | 'blue';
}

export interface PostItObject extends NotebookObjectBase {
  type: 'post-it';
  text: string;
  tone: 'yellow' | 'pink' | 'blue' | 'green';
}

export interface ImageObject extends NotebookObjectBase {
  type: 'image';
  src: string;
  alt: string;
}

export interface SpreadsheetObject extends NotebookObjectBase {
  type: 'spreadsheet';
  workbookData?: unknown;
}

export interface ShapeObject extends NotebookObjectBase {
  type: 'shape';
  shape: 'box' | 'oval' | 'arrow' | 'cloud';
  style: 'pencil' | 'sticker';
  text?: string;
}

export interface BusinessCardObject extends NotebookObjectBase {
  type: 'business-card';
  name: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
}

export interface PaperScrapObject extends NotebookObjectBase {
  type: 'paper-scrap';
  text: string;
  variant: 'plain' | 'index' | 'torn';
}

export interface AttachmentObject extends NotebookObjectBase {
  type: 'attachment';
  name: string;
  mimeType?: string;
  url?: string;
}

export type NotebookObject =
  | PaperCardObject
  | PostItObject
  | ImageObject
  | SpreadsheetObject
  | ShapeObject
  | BusinessCardObject
  | PaperScrapObject
  | AttachmentObject;

export type NotebookObjectFrame = Pick<
  NotebookObjectBase,
  'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex'
>;

export interface NotebookEntry {
  id: string;
  title: string;
  contentHtml: string;
  strokes: InkStroke[];
  objects: NotebookObject[];
  paperStyle: PaperStyle;
  createdAt: string;
  updatedAt: string;
}

export interface NotebookDocument {
  schemaVersion: 2;
  entries: NotebookEntry[];
  activeEntryId: string | null;
}

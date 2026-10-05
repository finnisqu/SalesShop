export type PaperStyle = 'lined' | 'grid' | 'blank' | 'cornell' | 'dotted' | 'two-column';
export type PageTone = 'cream' | 'white' | 'blue' | 'green' | 'rose';
export type InkTool = 'pen' | 'marker' | 'highlighter';
export type InkInteractionTool = 'eraser' | 'lasso';
export type ActiveNotebookTool = 'select' | 'text' | InkTool | InkInteractionTool;
export type PostItTone = 'yellow' | 'pink' | 'blue' | 'green';
export type ShapeKind = 'box' | 'oval' | 'arrow' | 'cloud';
export type PaperScrapVariant = 'plain' | 'index' | 'torn';

export interface InkPoint { x: number; y: number; pressure: number; }
export interface InkStroke { id: string; tool: InkTool; color: string; size: number; opacity: number; input?: 'pen' | 'mouse'; points: InkPoint[]; }
export interface NotebookObjectBase { id: string; x: number; y: number; width: number; height: number; rotation: number; zIndex: number; locked?: boolean; createdAt: string; updatedAt: string; }
export interface PaperCardObject extends NotebookObjectBase { type: 'paper-card'; text: string; tone: 'cream' | 'white' | 'blue'; }
export interface PostItObject extends NotebookObjectBase { type: 'post-it'; text: string; tone: PostItTone; }
export interface ImageObject extends NotebookObjectBase { type: 'image'; src: string; alt: string; caption?: string; }
export interface SpreadsheetObject extends NotebookObjectBase { type: 'spreadsheet'; workbookData?: unknown; }
export interface ShapeObject extends NotebookObjectBase { type: 'shape'; shape: ShapeKind; style: 'pencil' | 'sticker'; text?: string; }
export interface BusinessCardObject extends NotebookObjectBase { type: 'business-card'; name: string; company?: string; title?: string; email?: string; phone?: string; }
export interface PaperScrapObject extends NotebookObjectBase { type: 'paper-scrap'; text: string; variant: PaperScrapVariant; }
export interface AttachmentObject extends NotebookObjectBase { type: 'attachment'; name: string; mimeType?: string; size?: number; url?: string; }
export type NotebookObject = PaperCardObject | PostItObject | ImageObject | SpreadsheetObject | ShapeObject | BusinessCardObject | PaperScrapObject | AttachmentObject;
export type NotebookObjectFrame = Pick<NotebookObjectBase, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex'>;
export type BusinessCardField = 'name' | 'company' | 'title' | 'email' | 'phone';

export interface NotebookContext { projectId?: string; }

export interface NotebookEntry {
  id: string;
  title: string;
  contentHtml: string;
  strokes: InkStroke[];
  objects: NotebookObject[];
  paperStyle: PaperStyle;
  tone: PageTone;
  favorite: boolean;
  context?: NotebookContext;
  createdAt: string;
  updatedAt: string;
}

export interface NotebookDocument { schemaVersion: 2; entries: NotebookEntry[]; activeEntryId: string | null; }

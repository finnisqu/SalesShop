import type {TaskAssociation,TaskType} from '../store/personalTaskStore';
export interface CalendarTaskRequest{
 mode:'create'|'preview'|'edit';
 id?:string;dueDate?:string;type?:TaskType;title?:string;
 associations?:TaskAssociation[];
}
/** Central event contract for in-place Task editing across workspaces. */
export function requestTaskModal(detail:CalendarTaskRequest):void{
 window.dispatchEvent(new CustomEvent<CalendarTaskRequest>('salesshop:task-modal',{detail}));
}

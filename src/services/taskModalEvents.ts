import type {TaskAssociation,TaskType} from '../store/personalTaskStore';
export interface CalendarTaskRequest{
 mode:'create'|'preview'|'edit';
 id?:string;dueDate?:string;type?:TaskType;title?:string;notes?:string;
 associations?:TaskAssociation[];
 /** Copy a private Notebook Post-it into a Task; convert deletes only after
  * a successful Task creation, while keep retains the original note. */
 noteSource?:{entryId:string;objectId:string;mode:'convert'|'keep'};
}
/** Central event contract for in-place Task editing across workspaces. */
export function requestTaskModal(detail:CalendarTaskRequest):void{
 window.dispatchEvent(new CustomEvent<CalendarTaskRequest>('salesshop:task-modal',{detail}));
}

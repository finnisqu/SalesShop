import type {TaskLink} from '../store/personalTaskStore';
import type {PreviewRecord} from '../components/RecordPreviewDrawer';

/** Related Task links use the same preview entity types as Board/Connections.
 * Notebook links navigate to their page instead of starting a Record preview. */
export function taskLinkedRecordPreview(link:TaskLink):PreviewRecord|null{
 if(!link.id||link.type==='notebook')return null;
 return {
  kind:link.type==='contact'?'person':
   link.type==='project'?'deal':
   link.type==='company'?'company':'quote',
  id:link.id,
 };
}

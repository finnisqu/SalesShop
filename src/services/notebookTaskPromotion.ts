import type {NotebookObject} from '../types/notebook';
/** Extract just a useful label, never image URLs, spreadsheet bytes or attachments. */
export function notebookObjectTaskText(object:NotebookObject):string{
 const value=object.type==='post-it'||object.type==='paper-card'||object.type==='paper-scrap'
   ?object.text
   :object.type==='business-card'
     ?[object.name,object.company,object.title].filter(Boolean).join(' · ')
   :object.type==='image'?[object.alt,object.caption].filter(Boolean).join(' · ')
   :object.type==='attachment'?object.name
   :object.type==='shape'?object.text||object.shape+' shape'
   :object.type==='spreadsheet'?'Review Notebook spreadsheet'
   :'Follow up on Notebook object';
 return value.trim().slice(0,2000)||'Follow up on Notebook object';
}

import type {AppContextAction} from '../components/AppContextMenu';
import type {NotebookPromotionKind,TaskPromotion} from '../store/personalTaskStore';
const items:ReadonlyArray<readonly [NotebookPromotionKind,string]>=[
 ['task','Task'],['touchpoint','Touchpoint'],['deal','Deal'],
 ['contact','Contact / Person'],['company','Company'],
];
export function notebookPromotionActions(
 draft:TaskPromotion,begin:(value:TaskPromotion)=>void,
):AppContextAction[]{
 return items.map(([target,label],i)=>({
   label:'Promote to '+label+'…',dividerBefore:i===0,
   onSelect:()=>begin({...draft,title:draft.title.slice(0,240),sourceText:draft.sourceText?.slice(0,2000),target}),
 }));
}

import {taskAssociationKey,type TaskAssociation,type TaskLink} from '../store/personalTaskStore';

/** Whether each relevant record collection has finished initial hydration.
 * An empty or filtered options list is NOT evidence of deletion while the
 * corresponding collection is still loading. */
export type AssociationVerifiedTypes=Partial<Record<TaskLink['type'],boolean>>;

/** Distinguish unavailable saved links from valid current options without
 * deleting associations from a recoverable Task/Activity draft.
 * "Unavailable" includes records that were deleted, archived, or are no
 * longer selectable under the current user's permissions. */
export function unavailableTaskAssociations(
 selected:readonly TaskAssociation[],
 options:readonly {key:string}[],
 verifiedTypes:AssociationVerifiedTypes,
):TaskAssociation[]{
 const selectable=new Set(options.map(option=>option.key));
 const seen=new Set<string>();
 return selected.filter(link=>{
  const key=taskAssociationKey(link);
  if(seen.has(key))return false;
  seen.add(key);
  return verifiedTypes[link.type]===true&&!selectable.has(key);
 });
}

export function unavailableAssociationSaveError(missing:readonly TaskAssociation[]):string|null{
 if(!missing.length)return null;
 const count=missing.length;
 return `${count} related record${count===1?' is':'s are'} unavailable in this workspace. Remove or replace ${count===1?'it':'them'} before saving. Your draft is preserved.`;
}

/** Replace one stale ID by its exact key, keeping other relationships and
 * their user-selected order intact; never infer a replacement from names. */
export function replaceTaskAssociation(
 selected:readonly TaskAssociation[],oldKey:string,replacement:TaskAssociation,
):TaskAssociation[]{
 const key=taskAssociationKey(replacement);
 if(selected.some(item=>taskAssociationKey(item)===key))return [...selected];
 const index=selected.findIndex(item=>taskAssociationKey(item)===oldKey);
 if(index<0)return [...selected,replacement];
 return selected.map((item,i)=>i===index?replacement:item);
}

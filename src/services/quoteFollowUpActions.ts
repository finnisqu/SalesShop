import {supabase} from '../lib/supabase';
import {useAuthStore} from '../store/authStore';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import type {Activity} from '../types/crm';
import {confirmedQuoteDeliveries} from './quoteDeliveryLifecycle';
import {followUpLocalDate,type FollowUpAction, type FollowUpMethod} from './quoteFollowUps';

export interface FollowUpInput{
  quoteId:string;revision:number;action:FollowUpAction;
  dueDate?:string;method?:FollowUpMethod;note?:string;
}
export async function recordQuoteFollowUp(input:FollowUpInput):Promise<void>{
  const current=useQuoteStore.getState().quotes.find(q=>q.id===input.quoteId);
  const auth=useAuthStore.getState();
  const crm=useCrmStore.getState();
  crm.hydrate();
  if(!current||current.revision!==input.revision||current.archivedAt||
    !['Sent','Viewed'].includes(current.status)||
    !confirmedQuoteDeliveries(current,useCrmStore.getState().activities).length){
    throw new Error('The customer revision has changed or delivery has not been confirmed. Refresh the quote first.');
  }
  if(input.action==='scheduled'&&(!input.dueDate||!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)||
    !Number.isFinite(Date.parse(input.dueDate+'T12:00:00Z'))||input.dueDate<followUpLocalDate())){
    throw new Error('Choose a valid follow-up date that is today or later.');
  }
  if(input.action==='contacted'&&!input.method)throw new Error('Select how the customer was contacted.');
  const note=(input.note??'').trim().slice(0,500);
  const actionLabel=input.action==='scheduled'?'Follow-up scheduled for '+input.dueDate:
    input.action==='contacted'?'Customer follow-up logged · '+input.method:'Follow-up cleared';
  const activity:Activity={
    id:'activity_'+crypto.randomUUID(),type:'quote-follow-up',
    quoteId:current.id,projectId:current.projectId,companyId:current.companyId,
    contactId:current.contactId,occurredAt:new Date().toISOString(),
    summary:actionLabel+' · Revision '+current.revision+(note?' · '+note:''),
    metadata:{
      source:'manual',quoteNumber:current.quoteNumber,revision:current.revision,
      documentType:current.documentType,followUpAction:input.action,
      followUpDueDate:input.action==='scheduled'?input.dueDate:undefined,
      followUpMethod:input.action==='contacted'?input.method:undefined,
    },
  };
  if(auth.mode==='cloud'){
    if(!supabase||!auth.organizationId)throw new Error('Cloud workspace is not connected.');
    const {error}=await supabase.from('activities').insert({
      organization_id:auth.organizationId,id:activity.id,type:activity.type,
      summary:activity.summary,quote_id:activity.quoteId,
      project_id:activity.projectId??null,company_id:activity.companyId??null,
      contact_id:activity.contactId??null,occurred_at:activity.occurredAt,
      metadata:activity.metadata,
    });
    if(error)throw new Error('Could not save the follow-up to the CRM. '+error.message);
  }
  // Cloud-first: never display a successful follow-up if the database rejected it.
  useCrmStore.getState().recordActivity(activity);
}

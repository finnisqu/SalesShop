import {create} from 'zustand';
export type QuoteCloudSaveStatus='idle'|'pending'|'syncing'|'saved'|'error';
interface StatusState {
  status:QuoteCloudSaveStatus;
  message:string|null;
  setStatus:(status:QuoteCloudSaveStatus,message?:string|null)=>void;
}
export const useQuoteCloudStatusStore=create<StatusState>(set=>({
  status:'idle',message:null,
  setStatus:(status,message=null)=>set({status,message}),
}));

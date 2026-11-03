import {create} from 'zustand';

export type ActivityCloudStatus='idle'|'pending'|'syncing'|'saved'|'error';
interface State {
 status:ActivityCloudStatus;pendingCount:number;message:string|null;
 setStatus:(status:ActivityCloudStatus,pendingCount?:number,message?:string|null)=>void;
}
export const useActivityCloudStatusStore=create<State>(set=>({
 status:'idle',pendingCount:0,message:null,
 setStatus:(status,pendingCount=0,message=null)=>set({status,pendingCount,message}),
}));

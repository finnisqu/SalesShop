import {create} from 'zustand';
import {authorizeGmail,gmailProfile,gmailThreadPage,revokeGmailToken,
 type GmailThreadSummary,type GmailPage} from '../services/gmailRead359a';
interface GmailState {
 scope:string|null;mailbox:string|null;token:string|null;expiresAt:number;
 status:'disconnected'|'connecting'|'connected';loading:boolean;error:string|null;
 query:string;threads:GmailThreadSummary[];nextPageToken?:string;
 bindScope:(scope:string|null)=>void;
 connect:()=>Promise<void>;
 disconnect:()=>void;
 search:(query:string,pageToken?:string)=>Promise<void>;
}
const reset=()=>({mailbox:null,token:null,expiresAt:0,status:'disconnected' as const,
 loading:false,error:null,query:'',threads:[] as GmailThreadSummary[],
 nextPageToken:undefined as string|undefined});
export const useGmailSessionStore=create<GmailState>((set,get)=>({
 scope:null,...reset(),
 bindScope(scope){
  if(get().scope===scope)return;
  const token=get().token;
  set({scope,...reset()});
  if(token)revokeGmailToken(token);
 },
 async connect(){
  const scope=get().scope;
  if(!scope)throw new Error('Sign in to a SalesShop workspace before connecting Gmail.');
  set({status:'connecting',error:null});
  let access;
  try{
   access=await authorizeGmail();
   const mailbox=await gmailProfile(access.token);
   if(get().scope!==scope){
    revokeGmailToken(access.token);
    return;
   }
   set({...reset(),status:'connected',token:access.token,expiresAt:access.expiresAt,mailbox});
  }catch(error){
   if(access?.token)revokeGmailToken(access.token);
   if(get().scope===scope)set({...reset(),error:error instanceof Error?error.message:'Could not connect Gmail.'});
   throw error;
  }
 },
 disconnect(){
  const token=get().token;
  set(reset());
  if(token)revokeGmailToken(token);
 },
 async search(query,pageToken){
  const {scope,token,expiresAt,mailbox}=get();
  if(!scope||!mailbox||!token||Date.now()>=expiresAt){
   set({...reset(),error:'Gmail session expired. Reconnect to read conversations.'});
   return;
  }
  const q=query.trim().slice(0,180);
  set({loading:true,error:null});
  try{
   const response:GmailPage=await gmailThreadPage(token,q,pageToken);
   if(get().scope!==scope||get().token!==token)return;
   set({loading:false,query:q,threads:pageToken?[...get().threads,...response.threads]:
    response.threads,nextPageToken:response.nextPageToken});
  }catch(error){
   if(get().scope===scope&&get().token===token)
    set({loading:false,error:error instanceof Error?error.message:'Could not load Gmail conversations.'});
  }
 },
}));
export function validGmailToken(scope:string|null):{token:string;mailbox:string}|null{
 const state=useGmailSessionStore.getState();
 return !!scope&&state.scope===scope&&state.token&&state.mailbox&&
   Date.now()<state.expiresAt?{token:state.token,mailbox:state.mailbox}:null;
}

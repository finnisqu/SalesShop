/** A same-user auth reconfirmation should not unmount a ready workspace.
 * This is presentation-session continuity only; server RLS remains authoritative. */
export interface WorkspaceAuthSnapshot{
 ready:boolean;
 busy:boolean;
 mode:'local'|'cloud';
 userId?:string|null;
 organizationId?:string|null;
 platformRole?:string|null;
 inviteProblem?:string|null;
}
export function reuseReadyWorkspace(
 current:WorkspaceAuthSnapshot,incomingUserId:string|null
):boolean{
 return !!(
  incomingUserId&&current.ready&&!current.busy&&current.mode==='cloud'&&
  current.userId===incomingUserId&&!current.inviteProblem&&
  (current.organizationId||current.platformRole==='developer')
 );
}

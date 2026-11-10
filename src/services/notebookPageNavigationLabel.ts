/** Stable, concise labels for both desktop and mobile Notebook page menus.
 * An untouched page uses its creation date alone; named pages use their title.
 */
export function notebookPageNavigationLabel(page:{
  title?:string;createdAt:string;favorite?:boolean;
}):string{
 const title=page.title?.trim()??'';
 const untitled=!title||title.toLowerCase()==='untitled page';
 if(untitled){
  const created=new Date(page.createdAt);
  return Number.isNaN(created.getTime())?'Untitled page':
   created.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
 }
 return (page.favorite?'★ ':'')+title;
}

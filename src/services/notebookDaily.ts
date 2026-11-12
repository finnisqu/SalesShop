import type {NotebookAgendaItem,NotebookEntry} from '../types/notebook';

/** Date-only values must be real calendar days. Date.parse and new Date()
 * silently normalize impossible dates such as February 31, so neither
 * should be used as a validity check. */
export function validNotebookDay(value:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number);
 if(year<1000||year>9999||month<1||month>12||day<1)return false;
 return day<=new Date(year,month,0).getDate();
}

export function dailyNotebookPages(entries:readonly NotebookEntry[]):NotebookEntry[]{
 return entries.filter(e=>!!e.dailyDate&&!e.isPostItInbox)
  .slice().sort((a,b)=>(b.dailyDate??'').localeCompare(a.dailyDate??'')||
   b.updatedAt.localeCompare(a.updatedAt));
}
/** Show a short searchable excerpt without exposing stored markup in Home. */
export function notebookPlainText(contentHtml:string):string{
 return contentHtml.replace(/<\/p>/gi,'\n').replace(/<[^>]*>/g,' ')
  .replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  .replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&')
  .replace(/[ \t]+/g,' ').replace(/\n[ \n]+/g,'\n').trim();
}
export function agendaOccurrence(item:NotebookAgendaItem,year:number):string{
 if(!item.annual)return item.date;
 const monthDay=item.date.slice(5);
 // Feb 29 repeats only in leap years, rather than silently moving to Mar 1.
 if(monthDay==='02-29'&&new Date(year,1,29).getMonth()!==1)return '';
 return String(year)+'-'+monthDay;
}
export function notebookCalendarDates(entries:readonly NotebookEntry[],date:string){
 if(!validNotebookDay(date))return[];
 const year=Number(date.slice(0,4));
 return entries.flatMap(page=>(page.agendaItems??[])
  .filter(item=>item.kind==='calendar-date'&&agendaOccurrence(item,year)===date)
  .map(item=>({entryId:page.id,item,pageTitle:page.title})))
  .sort((a,b)=>(a.item.time??'').localeCompare(b.item.time??'')||
   a.item.title.localeCompare(b.item.title));
}
/** A local calendar date should not depend on the Task/CRM calendar module
 * during Notebook store hydration. */
export const notebookToday=()=>{
 const value=new Date();
 return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),
  String(value.getDate()).padStart(2,'0')].join('-');
};
export interface NotebookCalendarRequest{
 entryId?:string;itemId?:string;selectedText?:string;date?:string;
 /** Home can create calendar entries without opening a Notebook page. */
 standalone?:boolean;
}
export function openNotebookCalendarDate(detail:NotebookCalendarRequest):void{
 window.dispatchEvent(new CustomEvent<NotebookCalendarRequest>(
  'salesshop:notebook-calendar-date',{detail}));
}
export function agendaTitle(text:string):string{
 return text.trim().split(/\r?\n/)[0].trim().slice(0,240)||'New calendar date';
}

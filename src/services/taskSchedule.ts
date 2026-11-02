/** Calendar-day scheduling in the user's local timezone (DST-safe at noon). */
export type TaskDuePreset='today'|'tomorrow'|'next-week'|'clear';
export function taskDuePresetDate(today:string,preset:TaskDuePreset):string|undefined{
 if(preset==='clear')return undefined;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(today))return undefined;
 const date=new Date(today+'T12:00:00');
 if(!Number.isFinite(date.getTime()))return undefined;
 date.setDate(date.getDate()+(preset==='today'?0:preset==='tomorrow'?1:7));
 const part=(n:number)=>String(n).padStart(2,'0');
 return [date.getFullYear(),part(date.getMonth()+1),part(date.getDate())].join('-');
}

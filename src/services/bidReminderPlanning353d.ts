/** Offset a bid date by 1/3/7 calendar days without DST drift. */
export function bidReminderDate(dueDate:string,daysBefore:1|3|7):string|null{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))return null;
 const [year,month,day]=dueDate.split('-').map(Number);
 if(year<2000||year>2099)return null;
 const at=new Date(Date.UTC(year,month-1,day));
 if(!Number.isFinite(at.getTime())||at.toISOString().slice(0,10)!==dueDate)return null;
 return new Date(at.getTime()-daysBefore*86400000).toISOString().slice(0,10);
}
export const bidReminderTitle=(name:string)=>'Prepare bid · '+name.trim();

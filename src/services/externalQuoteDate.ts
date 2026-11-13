/** A sent bid must be an actual local calendar date, not a rolled-over
 * date or a future day. Kept pure for prefill and manual-entry regression tests.
 * The CRM store still independently enforces this on persistence.
 */
export function validExternalQuoteSentDate(value:string,today:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value>today)return false;
 const parsed=new Date(value+'T12:00:00');
 if(!Number.isFinite(parsed.getTime()))return false;
 return [parsed.getFullYear(),String(parsed.getMonth()+1).padStart(2,'0'),
  String(parsed.getDate()).padStart(2,'0')].join('-')===value;
}

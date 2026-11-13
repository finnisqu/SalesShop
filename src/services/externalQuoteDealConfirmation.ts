/** A recorded external Quote may complete bid Tasks only when the Deal
 * update is confirmed by Supabase too. No stage, amount or due-date guesses:
 * missing/hidden rows are not acknowledgements. */
export function confirmedExternalQuoteDeal(
 remote:unknown,dealId:string,stage:string,amount:number,
):boolean{
 if(!remote||typeof remote!=='object')return false;
 const row=remote as Record<string,unknown>;
 return row.id===dealId&&row.stage===stage&&
  row.due_date===null&&row.amount!==null&&row.amount!==undefined&&
  Number(row.amount)===amount&&Number.isFinite(Number(row.amount));
}

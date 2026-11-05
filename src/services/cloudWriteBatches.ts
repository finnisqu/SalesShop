/** Bounded batches for PostgREST writes. Keep write ordering deterministic
 * (parent records before children) and stop at the first failed response.
 * Callers preserve the existing onConflict/RLS behavior for each batch. */
export const CLOUD_WRITE_BATCH_SIZE=200;
export async function forEachCloudWriteBatch<T>(
 rows:readonly T[],
 write:(batch:T[])=>Promise<void>,
 size=CLOUD_WRITE_BATCH_SIZE,
):Promise<void>{
 if(!Number.isSafeInteger(size)||size<=0)throw new RangeError('Invalid cloud write batch size');
 for(let offset=0;offset<rows.length;offset+=size)
  await write(rows.slice(offset,offset+size));
}

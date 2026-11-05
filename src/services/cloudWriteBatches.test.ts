import {describe,expect,it} from 'vitest';
import {CLOUD_WRITE_BATCH_SIZE,forEachCloudWriteBatch} from './cloudWriteBatches';

describe('bounded cloud write batches',()=>{
 it('writes every item exactly once in source order',async()=>{
  const source=Array.from({length:CLOUD_WRITE_BATCH_SIZE*2+17},(_,i)=>i);
  const received:number[]=[];
  const sizes:number[]=[];
  await forEachCloudWriteBatch(source,async chunk=>{
   received.push(...chunk);sizes.push(chunk.length);
  });
  expect(sizes).toEqual([200,200,17]);
  expect(received).toEqual(source);
 });
 it('does not perform a request for an empty list',async()=>{
  let count=0;
  await forEachCloudWriteBatch([],async()=>{count++;});
  expect(count).toBe(0);
 });
 it('stops on first failed request rather than pretending save succeeded',async()=>{
  const done:number[]=[];
  await expect(forEachCloudWriteBatch([1,2,3,4,5],async chunk=>{
   if(chunk[0]===3)throw new Error('Cloud quota');
   done.push(...chunk);
  },2)).rejects.toThrow('Cloud quota');
  expect(done).toEqual([1,2]);
 });
 it('rejects invalid batch sizes',async()=>{
  await expect(forEachCloudWriteBatch([1],async()=>{},0)).rejects.toThrow(RangeError);
  await expect(forEachCloudWriteBatch([1],async()=>{},1.5)).rejects.toThrow(RangeError);
 });
});

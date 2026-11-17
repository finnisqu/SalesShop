import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

const file=(name:string)=>readFileSync(new URL('../../'+name,import.meta.url));
describe('SalesShop browser and bookmark icon assets',()=>{
 it('uses one complete filled S shape in the scalable favicon',()=>{
  const svg=file('public/favicon.svg').toString('utf8');
  expect(svg).toContain('viewBox="0 0 64 64"');
  expect(svg).toContain('fill="#25343D"');
  expect(svg).toContain('fill="#FAFBFC"');
  expect(svg).toContain('fill="#E0B755"');
  expect(svg.match(/<path d=/g)).toHaveLength(2);
  expect(svg).not.toContain('stroke-width=');
 });
 it('provides valid PNG-backed ICO sizes for small browser tabs',()=>{
  const ico=file('public/favicon.ico');
  expect(ico.readUInt16LE(0)).toBe(0);
  expect(ico.readUInt16LE(2)).toBe(1);
  expect(ico.readUInt16LE(4)).toBe(3);
  for(const [index,size] of [16,32,48].entries()){
   const at=6+16*index;
   expect(ico[at]).toBe(size);
   expect(ico[at+1]).toBe(size);
   const len=ico.readUInt32LE(at+8);
   const offset=ico.readUInt32LE(at+12);
   expect(offset+len).toBeLessThanOrEqual(ico.length);
   expect(ico.subarray(offset,offset+8)).toEqual(
    Buffer.from([137,80,78,71,13,10,26,10]));
  }
 });
 it('serves a 180px touch icon and cache-busted icon links',()=>{
  const png=file('public/apple-touch-icon.png');
  expect(png.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
  expect(png.readUInt32BE(16)).toBe(180);
  expect(png.readUInt32BE(20)).toBe(180);
  const html=file('index.html').toString('utf8');
  expect(html).toContain('/favicon.svg?v=2');
  expect(html).toContain('/favicon.ico?v=2');
  expect(html).toContain('/apple-touch-icon.png?v=2');
 });
});

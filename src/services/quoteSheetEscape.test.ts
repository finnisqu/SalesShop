import {describe,expect,it} from 'vitest';
import {quoteSheetEscapeShouldClose} from './quoteSheetEscape';

const event=(key:string,kind?:'input'|'picker'|'button',defaultPrevented=false)=>{
 const target=kind?{closest:(_selector:string)=>kind==='input'||kind==='picker'?{}:null}:null;
 return {key,defaultPrevented,target} as unknown as Pick<KeyboardEvent,'key'|'defaultPrevented'|'target'>;
};
describe('Quick Quote sheet Escape scope',()=>{
 it('closes only an active sheet with a non-editing focus target',()=>{
  expect(quoteSheetEscapeShouldClose(event('Escape','button'),true)).toBe(true);
  expect(quoteSheetEscapeShouldClose(event('Escape'),true)).toBe(true);
  expect(quoteSheetEscapeShouldClose(event('Escape','button'),false)).toBe(false);
  expect(quoteSheetEscapeShouldClose(event('Enter','button'),true)).toBe(false);
 });
 it('does not close while an input or nested picker handles Escape',()=>{
  expect(quoteSheetEscapeShouldClose(event('Escape','input'),true)).toBe(false);
  expect(quoteSheetEscapeShouldClose(event('Escape','picker'),true)).toBe(false);
  expect(quoteSheetEscapeShouldClose(event('Escape','button',true),true)).toBe(false);
 });
});

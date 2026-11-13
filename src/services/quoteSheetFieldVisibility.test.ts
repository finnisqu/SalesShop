import {describe,it,expect} from 'vitest';
import {quoteSheetFieldNeedsReveal} from './quoteSheetFieldVisibility';

describe('Quick Quote sheet mobile field visibility',()=>{
 it('keeps an input already visible above the keyboard in place',()=>{
  expect(quoteSheetFieldNeedsReveal(120,155,0,450,64)).toBe(false);
 });
 it('reveals a field covered by the keyboard or sheet header',()=>{
  expect(quoteSheetFieldNeedsReveal(410,450,0,450,64)).toBe(true);
  expect(quoteSheetFieldNeedsReveal(15,40,25,450,64)).toBe(true);
 });
 it('honors nonzero visual viewport offsets and bottom toolbar clearance',()=>{
  expect(quoteSheetFieldNeedsReveal(180,230,75,315,64)).toBe(false);
  expect(quoteSheetFieldNeedsReveal(240,275,75,315,64)).toBe(true);
 });
});

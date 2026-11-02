import {describe,expect,it} from 'vitest';
import {parseQuickGridNumber} from './quoteGridValue';

describe('Safe Quick Quote numeric cell input',()=>{
 it('accepts ordinary values and copied currency formatting',()=>{
  expect(parseQuickGridNumber('43')).toBe(43);
  expect(parseQuickGridNumber('54.25')).toBe(54.25);
  expect(parseQuickGridNumber('$1,296.50')).toBe(1296.5);
  expect(parseQuickGridNumber(' $ 2,000 ')).toBe(2000);
  expect(parseQuickGridNumber('-75')).toBe(-75);
 });
 it('rejects malformed or formula-like paste instead of silently repricing',()=>{
  for(const text of ['','1,20','12,3456','1.2.3','=A1*2','-','54%',
   'Infinity','NaN','1e5','$--15','1 200','1\t2']){
   expect(parseQuickGridNumber(text)).toBeUndefined();
  }
 });
});

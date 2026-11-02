import {describe,expect,it} from 'vitest';
import {changesMultiplierSellBasis} from './quoteMultiplierSellBasis';

describe('Multiplier selling price guard',()=>{
 it('does not treat private production assumptions as selling-price inputs',()=>{
  expect(changesMultiplierSellBasis({shopCostRateSf:14.5,installCostRateSf:5})).toBe(false);
  expect(changesMultiplierSellBasis({shopCostOverride:0,installCostOverride:0})).toBe(false);
  expect(changesMultiplierSellBasis({slabPurchaseQuantityOverride:1.25})).toBe(false);
  expect(changesMultiplierSellBasis({targetMargin:.25})).toBe(false);
 });
 it('treats slab selling-basis changes as repricing actions',()=>{
  expect(changesMultiplierSellBasis({slabYield:.65})).toBe(true);
  expect(changesMultiplierSellBasis({slabAreaOverrideSf:50})).toBe(true);
  expect(changesMultiplierSellBasis({slabCountOverride:2})).toBe(true);
  expect(changesMultiplierSellBasis({slabCostOverride:700})).toBe(true);
  expect(changesMultiplierSellBasis({slabCostOverride:undefined})).toBe(true);
 });
});

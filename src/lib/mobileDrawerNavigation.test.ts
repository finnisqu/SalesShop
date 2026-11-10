import {describe,expect,it} from 'vitest';
import {resolveMobileDrawerChoice} from './mobileDrawerNavigation';

describe('mobile main drawer navigation',()=>{
 it('opens Catalog immediately instead of expanding stale nested destinations',()=>{
  expect(resolveMobileDrawerChoice('catalog')).toEqual({kind:'navigate',view:'catalog'});
 });
 it('opens every other page from its dedicated row',()=>{
  for(const view of ['home','quotes','tasks','board','dashboard','notebook','settings'] as const){
   expect(resolveMobileDrawerChoice(view)).toEqual({kind:'navigate',view});
  }
 });
});

import {describe,it,expect} from 'vitest';
import {parseSalesShopRoute,salesShopRoutePath} from './appRoutes';
import type {NavigationLocation} from '../store/navigationStore';
const loc=(patch:Partial<NavigationLocation>):NavigationLocation=>({view:'home',catalogSection:'materials',focusedProjectId:null,focusedCompanyId:null,focusedQuoteId:null,...patch});
describe('SalesShop route navigation',()=>{
 it('maps private app destinations to reusable deep links',()=>{
   expect(parseSalesShopRoute('/home')).toEqual({view:'home'});
   expect(parseSalesShopRoute('/quotes')).toEqual({view:'quotes',focusedQuoteId:null});
   expect(parseSalesShopRoute('/connections')).toEqual({view:'dashboard'});
   expect(parseSalesShopRoute('/connections/companies/C%201')).toEqual({view:'dashboard',focusedCompanyId:'C 1'});
   expect(parseSalesShopRoute('/notebook')).toEqual({view:'notebook'});
   expect(parseSalesShopRoute('/settings')).toEqual({view:'settings'});
   expect(parseSalesShopRoute('/catalog/suppliers')).toEqual({view:'catalog',catalogSection:'suppliers'});
   expect(parseSalesShopRoute('/board/projects/id%201')).toEqual({view:'board',focusedProjectId:'id 1'});
   expect(parseSalesShopRoute('/board/accounts/abc')).toEqual({view:'board',focusedCompanyId:'abc'});
   expect(parseSalesShopRoute('/quotes/quote%2Btwo')).toEqual({view:'quotes',focusedQuoteId:'quote+two'});
 });
 it('round-trips quote, project and catalog paths',()=>{
   for(const item of [loc({view:'home'}),loc({view:'quotes',focusedQuoteId:'Q/12'}),loc({view:'board',focusedProjectId:'my project'}),loc({view:'board',focusedCompanyId:'C-8'}),loc({view:'dashboard',focusedCompanyId:'new-account'}),loc({view:'catalog',catalogSection:'rates'})]){
     const parsed=parseSalesShopRoute(salesShopRoutePath(item));
     expect(parsed?.view).toBe(item.view);
     if(item.focusedQuoteId)expect(parsed?.focusedQuoteId).toBe(item.focusedQuoteId);
     if(item.focusedProjectId)expect(parsed?.focusedProjectId).toBe(item.focusedProjectId);
     if(item.focusedCompanyId)expect(parsed?.focusedCompanyId).toBe(item.focusedCompanyId);
   }
 });
 it('never treats signing, developer or unknown URLs as private navigation',()=>{
   for(const bad of ['/q/expired-token','/developer/console','/bogus','/catalog/unknown','/quotes/id/another','/connections/companies/id/extra'])expect(parseSalesShopRoute(bad)).toBeNull();
 });
});

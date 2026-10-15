import {beforeEach,describe,expect,it} from 'vitest';
import {useNavigationStore} from './navigationStore';

beforeEach(()=>{
  useNavigationStore.setState({
    view:'quotes',catalogSection:'materials',ratesFocus:undefined,
    focusedProjectId:null,focusedCompanyId:null,focusedQuoteId:null,history:[],
  });
});

describe('bounded in-app navigation history',()=>{
  it('restores the previous tab and earlier Catalog section in order',()=>{
    const store=useNavigationStore;
    store.getState().setView('board');
    store.getState().openCatalog('rates');
    expect(store.getState()).toMatchObject({view:'catalog',catalogSection:'rates'});
    expect(store.getState().history).toHaveLength(2);
    store.getState().goBack();
    expect(store.getState()).toMatchObject({view:'board',history:[expect.any(Object)]});
    store.getState().goBack();
    expect(store.getState()).toMatchObject({view:'quotes',catalogSection:'materials',history:[]});
  });
  it('preserves a focused Connections company record when returning from another tab',()=>{
    const store=useNavigationStore;
    store.getState().openCompany('company-one');
    store.getState().setView('settings');
    store.getState().goBack();
    expect(store.getState()).toMatchObject({
      view:'dashboard',focusedCompanyId:'company-one',focusedProjectId:null,
    });
  });
  it('does not stack same-tab navigation or create a loop when going Back',()=>{
    const store=useNavigationStore;
    store.getState().setView('quotes');
    expect(store.getState().history).toHaveLength(0);
    store.getState().setView('catalog');
    expect(store.getState().history).toHaveLength(1);
    store.getState().goBack();
    expect(store.getState().history).toHaveLength(0);
    store.getState().goBack();
    expect(store.getState().view).toBe('quotes');
  });
});

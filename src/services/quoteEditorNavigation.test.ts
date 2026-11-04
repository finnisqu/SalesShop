import {beforeEach,describe,expect,it,vi} from 'vitest';

const mock=vi.hoisted(()=>({selectQuote:vi.fn(),setView:vi.fn(),setEnabled:vi.fn()}));
vi.mock('../store/quoteStore',()=>({useQuoteStore:{getState:()=>({selectQuote:mock.selectQuote})}}));
vi.mock('../store/navigationStore',()=>({useNavigationStore:{getState:()=>({setView:mock.setView})}}));
vi.mock('../store/quotesMobileBetaStore',()=>({useQuotesMobileBetaStore:{getState:()=>({setEnabled:mock.setEnabled})}}));
import {openDetailedQuoteEditor} from './quoteEditorNavigation';

describe('Detailed Editor remains a non-migrating Quick Quote fallback',()=>{
 beforeEach(()=>{mock.selectQuote.mockClear();mock.setView.mockClear();mock.setEnabled.mockClear();});
 it('opens the same selected Quote record',()=>{
  openDetailedQuoteEditor('quote-17');
  expect(mock.selectQuote).toHaveBeenCalledExactlyOnceWith('quote-17');
  expect(mock.setView).toHaveBeenCalledExactlyOnceWith('quotes');
  expect(mock.setEnabled).toHaveBeenCalledExactlyOnceWith(false);
 });
 it('opens the alternative editor from the Documents list without making a quote',()=>{
  openDetailedQuoteEditor();
  expect(mock.selectQuote).not.toHaveBeenCalled();
  expect(mock.setView).toHaveBeenCalledWith('quotes');
  expect(mock.setEnabled).toHaveBeenCalledWith(false);
 });
});

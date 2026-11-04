import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({
 setMode:vi.fn(),setEnabled:vi.fn(),setLocation:vi.fn(),
 setView:vi.fn(),setItem:vi.fn(),dispatchEvent:vi.fn(),
}));
vi.mock('../store/quoteLibraryStore',()=>({
 useQuoteLibraryStore:{getState:()=>({setMode:mocks.setMode})},
}));
vi.mock('../store/quotesMobileBetaStore',()=>({
 useQuotesMobileBetaStore:{getState:()=>({
  setEnabled:mocks.setEnabled,setLocation:mocks.setLocation,
 })},
}));
vi.mock('../store/navigationStore',()=>({
 useNavigationStore:{getState:()=>({setView:mocks.setView})},
}));
import {openGuidedQuoteCreation} from './quoteCreationNavigation';

describe('shared guided Quote creation',()=>{
 beforeEach(()=>{
  vi.clearAllMocks();
  vi.stubGlobal('window',{sessionStorage:{setItem:mocks.setItem},
   dispatchEvent:mocks.dispatchEvent});
 });
 afterEach(()=>vi.unstubAllGlobals());
 it('opens the same guided template picker from Home and global Quick Create',()=>{
  openGuidedQuoteCreation();
  expect(mocks.setMode).toHaveBeenCalledWith('mine');
  expect(mocks.setEnabled).toHaveBeenCalledWith(true);
  expect(mocks.setLocation).toHaveBeenCalledWith({
   page:'library',quoteTab:'build',areaTab:'measure',areaId:null,
  });
  expect(mocks.setItem).toHaveBeenCalledWith('salesshop-open-document-picker-v1','1');
  expect(mocks.setView).toHaveBeenCalledWith('quotes');
  expect(mocks.dispatchEvent).toHaveBeenCalledTimes(1);
  expect(mocks.dispatchEvent.mock.calls[0][0].type).toBe('salesshop:open-document-picker');
 });
 it('still navigates when session storage is blocked',()=>{
  mocks.setItem.mockImplementationOnce(()=>{throw new Error('Storage denied');});
  expect(()=>openGuidedQuoteCreation()).not.toThrow();
  expect(mocks.setView).toHaveBeenCalledWith('quotes');
  expect(mocks.dispatchEvent).toHaveBeenCalledTimes(1);
 });
});

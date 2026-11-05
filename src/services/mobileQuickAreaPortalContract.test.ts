import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const component=readFileSync(new URL('../components/QuoteAreaQuickPanel.tsx',import.meta.url),'utf8');
const mainSheet=readFileSync(new URL('../mobile-quote-panel-parity.css',import.meta.url),'utf8');
const fallbackSheet=readFileSync(new URL('../mobile-quote-viewport-reliability.css',import.meta.url),'utf8');
const styles=readFileSync(new URL('../main.tsx',import.meta.url),'utf8');

describe('Quick Quote Area sheet CSS portal routing',()=>{
 it('keeps normal in-app and body-fallback mounts covered',()=>{
  expect(component).toContain("document.querySelector('.sales-app')??document.body");
  expect(mainSheet).toContain('.sales-app .qmb.qmb-quick-area-backdrop');
  expect(fallbackSheet).toContain('body > .qmb.qmb-quick-area-backdrop');
 });
 it('keeps the fallback layer later without changing desktop styles',()=>{
  expect(styles.indexOf("import './mobile-quote-panel-parity.css'"))
   .toBeLessThan(styles.indexOf("import './mobile-quote-viewport-reliability.css'"));
  expect(mainSheet).toContain('@media (max-width:700px)');
  expect(fallbackSheet).toContain('@media (max-width:700px)');
  expect(fallbackSheet).toContain('The Area quick editor normally portals under .sales-app');
 });
});

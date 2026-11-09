import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const calendar=read('src/components/SalesCalendarLauncher.tsx');
const homeCSS=read('src/components/sales-calendar.css');
describe('Home badge navigation contract',()=>{
 it('targets the existing agenda instead of rendering a second drilldown page',()=>{
  expect(calendar).toContain('setBadgeFocus({date:key,metric:slot.metric})');
  expect(calendar).toContain('data-home-badge-match=');
  expect(calendar).toContain('setExpandedHistory(previous=>');
  expect(calendar).toContain("scrollIntoView({");
  expect(calendar).toContain('window.setTimeout(()=>setBadgeFocus(null),5200)');
  expect(calendar).not.toContain('home-calendar-drilldown-list');
  expect(calendar).not.toContain('activeDrilldown');
  expect(homeCSS).toContain('.is-badge-highlighted');
 });
});

import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {WorktablePagination,worktablePageRange} from '../components/WorktableChrome';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const render=(total:number,page:number,pageSize:number)=>renderToStaticMarkup(
 <WorktablePagination label="People" total={total} page={page} pageSize={pageSize}
  onPageChange={()=>{}} onPageSizeChange={()=>{}}/>).replace(/<!-- -->/g,'');

describe('Batch 350f — shared pager and mobile bulk page safety',()=>{
 it('uses the same clamped page range for Records and Catalog',()=>{
  expect(worktablePageRange(117,999,50)).toMatchObject({
   page:3,pageCount:3,start:100,end:117,first:101,last:117,
  });
  expect(worktablePageRange(0,8,50)).toMatchObject({
   page:1,pageCount:1,start:0,end:0,first:0,last:0,
  });
  const records=source('src/components/ConnectionsTable.tsx');
  expect(records).toContain('const pageRange=catalogPageRange(sorted.length,page,pageSize);');
  expect(records).toContain('const currentPage=pageRange.page;');
  expect(records).toContain('const display=sorted.slice(pageRange.start,pageRange.end);');
  const catalog=source('src/components/CatalogPagination.tsx');
  expect(catalog).toContain('export const catalogPageRange=worktablePageRange;');
  expect(catalog).toContain('<WorktablePagination');
 });
 it('normalizes invalid totals before displaying the item count',()=>{
  expect(render(Number.NaN,4,50)).toContain('0–0 of 0');
  expect(render(Number.POSITIVE_INFINITY,4,50)).toContain('0–0 of 0');
  expect(render(-10,4,50)).toContain('0–0 of 0');
  expect(render(12.9,1,50)).toContain('1–12 of 12');
  expect(render(83,7,50)).toContain('51–83 of 83');
 });
 it('shows a valid page-size selection even when restored inputs are stale',()=>{
  const invalid=render(83,2,17);
  expect(invalid).toContain('51–83 of 83');
  expect(invalid).toContain('aria-label="People per page"');
  expect(invalid).toContain('value="50" selected=""');
  expect(invalid).toContain('Page 2 of 2');
  expect(render(105,2,100)).toContain('value="100" selected=""');
 });
 it('clamps the displayed page before clicking mobile bulk Previous/Next',()=>{
  const records=source('src/components/ConnectionsTable.tsx');
  expect(records).toContain('disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>Previous</button>');
  expect(records).toContain('disabled={currentPage>=pages} onClick={()=>setPage(currentPage+1)}>Next</button>');
  expect(records).not.toContain('onClick={()=>setPage(page=>page-1)}>Previous');
  expect(records).not.toContain('onClick={()=>setPage(page=>page+1)}>Next');
  expect(records).toContain('Page {currentPage} of {pages}');
  expect(records).toContain('const display=sorted.slice(pageRange.start,pageRange.end);');
 });
 it('keeps page actions keyboard-operable with correct empty/terminal limits',()=>{
  const empty=render(0,1,50);
  expect(empty).toContain('Previous People page');
  expect(empty).toContain('Next People page');
  expect(empty).toContain('aria-live="polite"');
  expect(empty).toContain('Page 1 of 1');
  const end=render(83,999,50);
  expect(end).toContain('Page 2 of 2');
  expect(end).toContain('Previous People page');
  expect(end).toContain('Next People page');
  const controls=source('src/components/WorktableChrome.tsx');
  expect(controls).toContain('disabled={range.page<=1}');
  expect(controls).toContain('disabled={range.page>=range.pageCount}');
  expect(controls).toContain('onClick={()=>onPageChange(range.page-1)}');
  expect(controls).toContain('onClick={()=>onPageChange(range.page+1)}');
 });
});

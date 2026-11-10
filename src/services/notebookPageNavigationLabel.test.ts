import {describe,expect,it} from 'vitest';
import {notebookPageNavigationLabel} from './notebookPageNavigationLabel';

describe('Notebook page menu labels',()=>{
 it('uses just the full created date for an untitled page',()=>{
  const date='2026-11-10T17:50:00Z';
  expect(notebookPageNavigationLabel({title:'Untitled page',createdAt:date}))
    .toBe('Nov 10, 2026');
  expect(notebookPageNavigationLabel({title:'  untitled page  ',createdAt:date,favorite:true}))
    .toBe('Nov 10, 2026');
  expect(notebookPageNavigationLabel({title:'',createdAt:date}))
    .toBe('Nov 10, 2026');
 });
 it('shows named pages by title without adding a timestamp',()=>{
  const page={title:'  Client meeting  ',createdAt:'2026-11-10T17:50:00Z'};
  expect(notebookPageNavigationLabel(page)).toBe('Client meeting');
  expect(notebookPageNavigationLabel({...page,favorite:true})).toBe('★ Client meeting');
 });
 it('handles an invalid date without showing Invalid Date',()=>{
  expect(notebookPageNavigationLabel({title:'Untitled page',createdAt:'bad date'}))
    .toBe('Untitled page');
 });
});

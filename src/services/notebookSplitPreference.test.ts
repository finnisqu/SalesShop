import {describe,expect,it} from 'vitest';
import {decodeNotebookSplitPreference} from './notebookSplitPreference';
describe('Notebook split restoration',()=>{
 it('restores the companion and orientation only for existing distinct pages',()=>{
   expect(decodeNotebookSplitPreference({rightId:'B',stacked:true},'A',['A','B']))
     .toEqual({rightId:'B',stacked:true});
   expect(decodeNotebookSplitPreference({rightId:'A',stacked:true},'A',['A','B']))
     .toEqual({rightId:null,stacked:true});
   expect(decodeNotebookSplitPreference({rightId:'removed',stacked:false},'A',['A','B']))
     .toEqual({rightId:null,stacked:false});
 });
 it('ignores invalid/corrupt saved layouts',()=>{
   expect(decodeNotebookSplitPreference(null,'A',['A'])).toEqual({rightId:null,stacked:false});
   expect(decodeNotebookSplitPreference({rightId:4,stacked:'true'},'A',['A'])).toEqual({rightId:null,stacked:false});
 });
});

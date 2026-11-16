import type {SalesDocumentSort,SalesDocumentStatusFilter} from '../services/salesDocumentLibrary';
import type {SavedQuoteLibraryFilters,QuoteLibrarySource,QuoteLibraryOwner}
 from '../services/salesQuoteLibraryView';
import './quote-library-filters.css';

type Props={
 filters:SavedQuoteLibraryFilters;
 counts:{active:number;drafts:number;issued:number;archived:number};
 externalCount:number;
 canFilterOwner:boolean;
 onChange:(patch:Partial<SavedQuoteLibraryFilters>)=>void;
 onClear:()=>void;
};
/** All fields are direct grid children: no nested popover or flattened columns.
 * This is shared by desktop and phone Quote document directories. */
export function QuoteLibraryFilterControls({filters,counts,externalCount,
 canFilterOwner,onChange,onClear}:Props){
 return <div className="qmb-library-tools qmb-library-filters-v112" aria-label="Quote library filters">
  <label><span>Status</span>
   <select value={filters.status} aria-label="Document status"
    onChange={e=>onChange({status:e.target.value as SalesDocumentStatusFilter})}>
    <option value="active">Active ({counts.active+externalCount})</option>
    <option value="drafts">Drafts ({counts.drafts})</option>
    <option value="issued">Issued ({counts.issued+externalCount})</option>
    <option value="archived">Archived ({counts.archived})</option>
   </select>
  </label>
  <label><span>Source</span>
   <select value={filters.source} aria-label="Quote source"
    onChange={e=>onChange({source:e.target.value as QuoteLibrarySource})}>
    <option value="all">All sources</option>
    <option value="salesshop">SalesShop</option>
    <option value="external">External quotes</option>
   </select>
  </label>
  <label><span>Sort by</span>
   <select value={filters.sort} aria-label="Sort documents"
    onChange={e=>onChange({sort:e.target.value as SalesDocumentSort})}>
    <option value="recent">Recently updated</option>
    <option value="name">Quote name</option>
    <option value="company">Customer / company</option>
    <option value="oldest">Oldest updated</option>
   </select>
  </label>
  {canFilterOwner?<label><span>Ownership</span>
   <select value={filters.owner} aria-label="Quote ownership"
    onChange={e=>onChange({owner:e.target.value as QuoteLibraryOwner})}>
    <option value="all">All accessible quotes</option>
    <option value="mine">Recorded or created by me</option>
    <option value="assigned">External bids on my Deals</option>
   </select>
  </label>:<div className="qmb-library-filter-placeholder" aria-hidden="true"/>}
  <label><span>From date</span><input type="date" aria-label="Quotes from date"
   value={filters.from} max={filters.to||undefined}
   onChange={e=>onChange({from:e.target.value})}/></label>
  <label><span>Through date</span><input type="date" aria-label="Quotes through date"
   value={filters.to} min={filters.from||undefined}
   onChange={e=>onChange({to:e.target.value})}/></label>
  <p className="qmb-library-filter-help">Dates use delivery for submitted quotes and last edit for drafts.</p>
  <button className="qmb-library-filter-reset" type="button" onClick={onClear}>Clear filters</button>
 </div>;
}

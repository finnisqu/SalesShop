import {describe,it,expect} from 'vitest';
import {QUOTE_STANDARD_TERMS,termsEnabled,freeCustomerNotes,
  toggleCustomerTerm,withCustomerTerms} from './quoteCustomerTerms';
describe('Customer wording from quote-sheet template',()=>{
  it('toggles individual clauses without deleting manually typed notes',()=>{
    const original='Material confirmation before fabrication.';
    const first=toggleCustomerTerm(original,'included',true);
    const second=toggleCustomerTerm(first,'payment',true);
    expect(freeCustomerNotes(second)).toBe(original);
    expect(termsEnabled(second,'included')).toBe(true);
    expect(termsEnabled(second,'payment')).toBe(true);
    expect(termsEnabled(second,'natural')).toBe(false);
    const cleared=toggleCustomerTerm(second,'included',false);
    expect(termsEnabled(cleared,'included')).toBe(false);
    expect(termsEnabled(cleared,'payment')).toBe(true);
    expect(freeCustomerNotes(cleared)).toBe(original);
    expect(withCustomerTerms(cleared,[])).toBe(original);
  });
  it('contains six independently selectable customer paragraphs',()=>{
    expect(QUOTE_STANDARD_TERMS.map(t=>t.id)).toEqual([
      'included','changes','trips','payment','natural','validity']);
    expect(withCustomerTerms('',QUOTE_STANDARD_TERMS.map(t=>t.id))
      .includes('THIS PROJECT ESTIMATE IS VALID FOR 30 DAYS.')).toBe(true);
  });
});

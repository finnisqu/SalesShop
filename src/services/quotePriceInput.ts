/** An explicitly cleared selling input must NOT resurrect a prior saved price.
 * The absence of a field means keep it; a present `undefined` means cleared. */
export function editedQuotePriceValue(
  changes: Partial<Record<'amount'|'rate'|'multiplier',number|undefined>>,
  field: 'amount'|'rate'|'multiplier',
  previous: number|undefined,
):number|undefined {
  return Object.prototype.hasOwnProperty.call(changes,field)?changes[field]:previous;
}

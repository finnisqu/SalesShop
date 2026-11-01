import type {Quote} from '../types/quote';

/** Only an explicit deep link should deliberately reopen an archived quote.
 * The workspace's default active selection favors accessible active work. */
export function chooseActiveQuoteId(
  quotes:ReadonlyArray<Pick<Quote,'id'|'archivedAt'>>,
  preferred:string|null|undefined,
):string|null {
  if(preferred&&quotes.some(q=>q.id===preferred&&!q.archivedAt))return preferred;
  return quotes.find(q=>!q.archivedAt)?.id??null;
}

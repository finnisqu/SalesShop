import { displayQuoteNumber, isDraftQuoteNumber, type Quote } from '../types/quote';

type QuoteDestinationDetails = Pick<
  Quote,
  'title' | 'companyName' | 'quoteDate' | 'quoteNumber' | 'documentType' | 'revision'
>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortQuoteDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return '';
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${MONTHS[month - 1]} ${day}, ${match[1]}`;
}

/** Human-readable, title-first label; never show the internal DRAFT UUID. */
export function catalogQuoteDestinationLabel(quote: QuoteDestinationDetails): string {
  const title = quote.title.trim() || 'Untitled quote';
  const company = quote.companyName?.trim();
  const reference = isDraftQuoteNumber(quote.quoteNumber)
    ? [shortQuoteDate(quote.quoteDate), 'Draft'].filter(Boolean).join(' · ')
    : displayQuoteNumber(quote);
  return [title, company, reference].filter(Boolean).join(' · ');
}

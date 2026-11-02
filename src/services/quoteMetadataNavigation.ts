/** Transfer an explicit quote-record navigation request when crossing from
 * Sales Documents or Board into the Connections workspace. This does not
 * change the quote editor route or expose quote data. */
export const QUOTE_RECORD_REQUEST_KEY='salesshop-connections-quote-record-v1';
export function requestQuoteMetadataPage(id:string,setView:()=>void){
 try{window.sessionStorage.setItem(QUOTE_RECORD_REQUEST_KEY,id);}catch{/* route remains usable */}
 setView();
}
export function consumeQuoteMetadataRequest():string|null{
 try{const id=window.sessionStorage.getItem(QUOTE_RECORD_REQUEST_KEY);
   window.sessionStorage.removeItem(QUOTE_RECORD_REQUEST_KEY);return id;
 }catch{return null;}
}

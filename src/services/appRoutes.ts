import type {NavigationLocation,AppView,CatalogSection} from '../store/navigationStore';

/** Pure route mapping. Customer signing (/q/) stays in the isolated public shell. */
const SECTIONS:readonly CatalogSection[]=['materials','sinks','other','rates','suppliers'];
const clean=(id:string)=>{
  try {return decodeURIComponent(id);} catch {return '';}
};
const segment=(value:string)=>encodeURIComponent(value);

export function parseSalesShopRoute(pathname:string):Partial<NavigationLocation>|null{
  const path=pathname.replace(/\/+$/,'')||'/';
  if(path==='/')return null;
  if(path==='/home')return{view:'home'};
  if(path==='/quotes')return{view:'quotes',focusedQuoteId:null};
  if(path.startsWith('/quotes/')){
    const id=path.slice('/quotes/'.length);
    return id&&!id.includes('/')?{view:'quotes',focusedQuoteId:clean(id)}:null;
  }
  if(path==='/board')return{view:'board'};
  if(path.startsWith('/board/projects/')){
    const id=path.slice('/board/projects/'.length);
    return id&&!id.includes('/')?{view:'board',focusedProjectId:clean(id)}:null;
  }
  if(path.startsWith('/board/accounts/')){
    const id=path.slice('/board/accounts/'.length);
    return id&&!id.includes('/')?{view:'board',focusedCompanyId:clean(id)}:null;
  }
  if(path==='/connections')return{view:'dashboard'};
  if(path==='/notebook')return{view:'notebook'};
  if(path==='/catalog')return{view:'catalog'};
  if(path.startsWith('/catalog/')){
    const section=path.slice('/catalog/'.length);
    return SECTIONS.includes(section as CatalogSection)?{view:'catalog',catalogSection:section as CatalogSection}:null;
  }
  if(path==='/settings')return{view:'settings'};
  return null;
}

export function salesShopRoutePath(location:Pick<NavigationLocation,'view'|'catalogSection'|'focusedProjectId'|'focusedCompanyId'|'focusedQuoteId'>):string{
  const view:AppView=location.view;
  switch(view){
    case 'home':return '/home';
    case 'quotes':return location.focusedQuoteId?'/quotes/'+segment(location.focusedQuoteId):'/quotes';
    case 'board':return location.focusedProjectId?'/board/projects/'+segment(location.focusedProjectId):
      location.focusedCompanyId?'/board/accounts/'+segment(location.focusedCompanyId):'/board';
    case 'dashboard':return '/connections';
    case 'notebook':return '/notebook';
    case 'catalog':return '/catalog/'+location.catalogSection;
    case 'settings':return '/settings';
  }
}

import type {ReactNode} from 'react';

/** Shared preview/editor chrome. Retains each existing container's CSS class,
 * scrolling model, and mobile behavior while standardizing its interior.
 */
export function PreviewPanelHeading({eyebrow,title,detail}:{eyebrow:string;title:ReactNode;detail?:ReactNode}){
 return <div className="ss-preview-heading">
   <small className="ss-preview-eyebrow">{eyebrow}</small>
   <h2>{title}</h2>
   {detail&&<span className="ss-preview-detail">{detail}</span>}
 </div>;
}

export function PreviewPanelClose({onClose,label,className='',initialFocus=true,disabled=false}:{
 onClose:()=>void;label:string;className?:string;initialFocus?:boolean;disabled?:boolean;
}){
 return <button type="button" disabled={disabled} data-dialog-initial-focus={initialFocus&&!disabled?true:undefined}
   className={('ss-preview-close '+className).trim()}
   onClick={onClose} aria-label={label}>×</button>;
}

export function PreviewPanelActions({children,className=''}:{
 children:ReactNode;className?:string;
}){
 return <footer className={('ss-preview-actions '+className).trim()}>{children}</footer>;
}

import {useState,type ComponentPropsWithoutRef} from 'react';
type Props=Omit<ComponentPropsWithoutRef<'details'>,'open'|'defaultOpen'|'onToggle'> & {initialOpen?:boolean};
/** React HTMLDetailsElement has no defaultOpen prop. Native details can still
 * be toggled freely, while the initial expanded state is honored on mount. */
export function InitialOpenDetails({initialOpen=false,children,...props}:Props){
 const [open,setOpen]=useState(initialOpen);
 return <details {...props} open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
   {children}
 </details>;
}

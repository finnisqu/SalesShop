/** Shared display-name comparison for inline CRM creation and lookup.
 * Preserve the user's original name in storage; normalize only for matching.
 * In particular, extra whitespace must not create duplicate Companies/People.
 */
export function recordNameKey(value:string):string{
 return value.trim().replace(/\s+/g,' ').toLowerCase();
}

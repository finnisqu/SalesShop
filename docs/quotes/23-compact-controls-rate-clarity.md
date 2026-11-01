# Quotes Beta — compact field rows and rate clarity (November 2026)

Main-first presentation batch. No quote data-schema, Supabase, RLS, customer approval, price, rate-book calculation or persistence changes.

## Improvements
- Consistent grid/table radii, row density and numeric alignment across Pieces, Sinks and Add-ons; narrower desktop rows retain phone-size targets and 16px inputs on small screens to prevent mobile zoom.
- Pieces column names now use simple Length / Width with the toolbar explicitly stating that dimensions are in inches. Existing fraction parser and Enter-to-next-field behavior are preserved.
- Sink price column specifies **Sell / each ($)**, with the calculated row selling total labeled independently. This does not alter sink line syncing or selling math.
- Add-on amount column says **Sell total**, keeping the original saved sell amount visible and unchanged.
- Mobile Rate Picker and desktop SF Rate Chooser show whether a selling rate has been entered and offer a clearly named **Choose from Rate Book** control. The same Builder Levels and other active SF rates still supply the existing rate snapshot.
- Desktop heading distinguishes **Customer selling price** from **private buying costs and margin in Calculator**. The existing Calculator retains all internal buying-cost inputs.

## Smoke-check after Cloudflare Ready
1. Open Kitchen with multiple Pieces: dimensions align across rows, Enter navigation still works, and SF total matches the previous version.
2. Add Sink and edit unit selling price, quantity and model; verify calculated total and faucet-hole menu. Test phone portrait and narrow desktop.
3. Add a Rate Book Add-on then a custom charge; verify selling amount and saved quantities are unchanged.
4. On mobile Pricing, type a custom $/SF rate and choose an existing Rate Book level. On desktop, do the same in the Area's Materials selling price.
5. Confirm rate source/status text, popover behavior, dark-mode input contrast and no mobile zoom. Check issued/read-only quotes.
6. Verify the quote total and Review audit before and after an unchanged quote remain identical.

**Verification:** source reviewed only; automated TS/Vitest/browser checks not run in this GitHub-only session. Cloudflare build and browser smoke checks required.

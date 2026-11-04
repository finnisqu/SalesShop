# Form density, universal icons, decimal Deal amounts — 2026-11-04

## Changes

- **Home 7-day mode:** Increase the fixed desktop height to 520px, keeping the week strip fixed above a scrollable agenda. Month mode retains its existing dimensions.
- **Quick Create:** Replace letter markers with small consistent SVG line icons. Align icon, heading, helper text and chevron; use the current appearance palette for the centered dialog and options. The Quote action still launches the guided template picker.
- **Log Activity:** Replace font-dependent call, email, text, video, and in-person glyphs with explicit monochrome stroke SVG icons. Style the "All types" CRM-association selector and its search input consistently with the active theme and neighboring controls; preserve search and draft recovery.
- **Task create/edit:** Group Type/Priority/Status/Queue under Details and Start/Due/Due Time under Schedule. Move the optional in-app reminder into a toggle; an existing configured reminder opens by default and its state is preserved when collapsed. Shrink control and spacing dimensions; retain notes, CRM associations, draft recovery and all original save fields.
- **Deal Card amount:** Change the Board editor's number input from step 1 to step 0.01 and use a decimal keyboard hint, matching the existing full Deal page. Amounts like 2038.92 should no longer trigger browser step mismatch warnings.

## Deployment acceptance checks

1. Desktop Home 7-day focus is visibly taller, the week strip stays on top, and a busy agenda scrolls without resizing; Month dimensions unchanged.
2. Open + on light/dark desktop and phone: five SVG icons, no cropped captions, matched theme contrast and correct navigation.
3. Log Activity methods look identical on iPhone and desktop. Test the related-record type selector's background in light/dark and test its dropdown.
4. Create and edit Tasks; validate grouped inputs at narrow widths, an existing reminder opens its field, hiding reminder does not erase it, and saving still includes queue, start, due date/time, reminder, notes and linked records.
5. Edit a Deal in the Board: entering 2038.92 is accepted by native field validation and persists. Repeat in full Deal page.

GitHub source diff was reviewed. Automated TypeScript/Vite and live Chrome/mobile acceptance remain unverified in this source-only pass.

# SalesShop React Foundation

This branch is the migration workspace for the mature SalesShop frontend architecture.

## Why this branch exists

The original vanilla-JS prototype remains valuable as a behavior/design reference, but SalesShop is becoming a component-heavy product with notebook objects, rich text, ink, spreadsheets, CRM surfaces, backend state, integrations, and multi-user requirements.

The React foundation deliberately separates:

- **domain data** from UI components
- **persisted notebook data** from transient tool state
- **paper presentation** from editing engines
- **storage adapters** from application behavior

`main` remains the stable prototype while this branch reaches parity.

## Current stack

- React 19
- TypeScript
- Vite
- Zustand
- Tiptap / ProseMirror
- Perfect Freehand
- plain CSS for the SalesShop tactile design language

## Implemented foundation

- Vite + React + TypeScript app shell
- tactile SalesShop notebook workspace
- page/binder navigation
- Tiptap rich-text page content
- vector ink strokes stored as points + pressure
- pen, marker, and highlighter tools
- Pointer Events so Apple Pencil pressure can flow into stroke data
- lined, grid, and blank paper
- localStorage repository boundary
- stable UUID-based page/stroke/object IDs
- schema-versioned notebook document
- automatic schema v1 -> v2 migration preserving existing ProtoBook data
- canonical spatial `NotebookObject` union
- shared selection state
- shared move / resize / rotate object frame behavior
- Delete / Backspace object deletion outside editable fields
- first paper-card object used to validate the shared object mechanics

## Notebook object model

Spatial objects share one physical frame:

- `id`
- `x`, `y`, `width`, `height` as normalized page percentages
- `rotation`
- `zIndex`
- timestamps

Current canonical object types reserve clean seams for:

- paper card
- Post-it
- image
- spreadsheet
- shape / annotation
- business card
- paper scrap
- attachment

The transform system is deliberately object-agnostic so new stationery and embedded engines inherit the same selection, positioning, resize, and rotation behavior.

## Intentional differences from the early setup guide

1. Ink is **not** saved as a Base64 canvas screenshot. It remains editable vector stroke data.
2. Drawing uses **Pointer Events**, not mouse-only events, so pen/touch/pressure are available.
3. Storage is behind a repository interface so Supabase can replace localStorage later.
4. The Notebook keeps text and ink as layered content instead of forcing a hard text/draw page mode.
5. Styling stays native CSS rather than introducing Tailwind during the migration; we can revisit that later if it solves a real problem.
6. Spatial object transforms preview in component state and persist at gesture completion, avoiding localStorage writes on every pointer movement.

## Next batches

1. Rebuild Post-its, images, business cards, paper scraps, attachments, and annotation shapes on the shared object frame.
2. Add Univer as the spreadsheet object engine and retire custom spreadsheet internals.
3. Add Rough.js annotations and richer ink tools (eraser, lasso, selection).
4. Port Binder/page metadata and favorite/color behavior.
5. Port Board and Quotes to React components.
6. Add service/repository/event boundaries for CRM domain objects.
7. Introduce Supabase Postgres/Auth/Storage behind repository adapters.
8. Add integration providers (Gmail, Calendar, Slack, Drive, CAD Lite, etc.).

## Apple Pencil direction

The Notebook should optimize for "pencil to paper" immediacy. A future iPad pass should distinguish finger navigation from Pencil ink where practical, add lasso/eraser interactions, preserve pressure data, and support meeting-mode capture without CRM form friction.

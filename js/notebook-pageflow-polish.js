/* Small follow-up for the full-sheet Grid migration.
   Former history-rail entries stay at the upper-left rather than being appended below spatial notes. */

ensureCurrentGridPlacements = function() {
  migrateGridToFullSheetOnce();
  const entries = gridPageEntries();
  let leftRow = 0;
  let changed = false;

  entries.filter(entry => !entry.grid).forEach(entry => {
    entry.layout = 'grid';
    entry.grid = {col:0,row:leftRow};
    leftRow += gridEntryRowSpan(entry) + 1;
    changed = true;
  });

  if (changed) save();
};

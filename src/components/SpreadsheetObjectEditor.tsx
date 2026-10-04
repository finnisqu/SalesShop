import { useEffect, useRef } from 'react';
import type { IWorkbookData } from '@univerjs/core';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import '@univerjs/preset-sheets-core/lib/index.css';

interface SpreadsheetObjectEditorProps {
  objectId: string;
  workbookData?: unknown;
  interactive: boolean;
  onSnapshotChange: (snapshot: IWorkbookData) => void;
}

const SAVE_DEBOUNCE_MS = 500;

export function SpreadsheetObjectEditor({
  objectId,
  workbookData,
  interactive,
  onSnapshotChange,
}: SpreadsheetObjectEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSnapshotChangeRef = useRef(onSnapshotChange);

  useEffect(() => {
    onSnapshotChangeRef.current = onSnapshotChange;
  }, [onSnapshotChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const container = document.createElement('div');
    container.className = 'univer-sheet-mount';
    host.append(container);

    const { univer, univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: {
        [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
      },
      presets: [
        UniverSheetsCorePreset({
          container,
          header: false,
          toolbar: false,
          formulaBar: false,
          footer: false,
          contextMenu: true,
          disableAutoFocus: true,
        }),
      ],
    });

    const workbook = univerAPI.createWorkbook(
      workbookData
        ? (workbookData as IWorkbookData)
        : {
            id: `notebook_sheet_${objectId}`,
            name: 'Notebook Sheet',
          },
    );

    let saveTimer: number | undefined;
    const saveSnapshot = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        onSnapshotChangeRef.current(workbook.save());
      }, SAVE_DEBOUNCE_MS);
    };

    const commandSubscription = workbook.onCommandExecuted(saveSnapshot);

    return () => {
      window.clearTimeout(saveTimer);
      onSnapshotChangeRef.current(workbook.save());
      commandSubscription.dispose();
      queueMicrotask(() => {
        univer.dispose();
        container.remove();
      });
    };
  }, [objectId]);

  return (
    <div className={`spreadsheet-object-editor ${interactive ? 'is-interactive' : 'is-preview'}`}>
      <div className="spreadsheet-object-label">Sheet</div>
      <div ref={hostRef} className="spreadsheet-object-host" aria-label="Embedded spreadsheet" />
      {!interactive && <div className="spreadsheet-object-cover" aria-hidden="true" />}
    </div>
  );
}

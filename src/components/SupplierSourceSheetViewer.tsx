import { useEffect, useRef, useState } from 'react';
import type { SupplierImportStructuredPreview } from '../types/supplierImport';

type UniverSelectionRange = {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
};

type ViewerHandle = {
  activateRange: (rangeA1: string) => void;
};

function excelColumn(column: number) {
  let value = Math.max(1, column);
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function selectionA1(selection: UniverSelectionRange) {
  const start = `${excelColumn(selection.startColumn + 1)}${selection.startRow + 1}`;
  const end = `${excelColumn(selection.endColumn + 1)}${selection.endRow + 1}`;
  return start === end ? start : `${start}:${end}`;
}

function workbookSnapshot(preview: SupplierImportStructuredPreview, locale: string) {
  const sheetId = 'supplier-source-sheet';
  const cellData: Record<number, Record<number, { v: string }>> = {};

  preview.sourceRows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (!value) return;
      cellData[rowIndex] ??= {};
      cellData[rowIndex][columnIndex] = { v: value };
    });
  });

  return {
    id: `supplier-source-${Date.now()}`,
    name: preview.fileName,
    appVersion: '',
    locale,
    styles: {},
    sheetOrder: [sheetId],
    sheets: {
      [sheetId]: {
        id: sheetId,
        name: preview.sheetName || 'Source',
        rowCount: Math.max(preview.sourceRowCount, preview.sourceRows.length, 20),
        columnCount: Math.max(preview.sourceColumnCount, preview.sourceRows[0]?.length ?? 0, 12),
        defaultColumnWidth: 105,
        defaultRowHeight: 22,
        cellData,
      },
    },
    resources: [],
  };
}

export function SupplierSourceSheetViewer({
  preview,
  activeRangeA1,
  onSelectionChange,
}: {
  preview: SupplierImportStructuredPreview;
  activeRangeA1?: string;
  onSelectionChange: (rangeA1: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ViewerHandle | null>(null);
  const activeRangeRef = useRef(activeRangeA1);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    activeRangeRef.current = activeRangeA1;
  }, [activeRangeA1]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    viewerRef.current?.activateRange(activeRangeA1 ?? '');
  }, [activeRangeA1]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const container = document.createElement('div');
    container.className = 'supplier-source-univer-container';
    host.replaceChildren(container);

    let disposed = false;
    let univerInstance: { dispose: () => void } | undefined;
    let selectionDisposable: { dispose: () => void } | undefined;

    void (async () => {
      try {
        setLoadError(null);
        const [
          presetsModule,
          sheetsModule,
          localeModule,
        ] = await Promise.all([
          import('@univerjs/presets'),
          import('@univerjs/preset-sheets-core'),
          import('@univerjs/preset-sheets-core/locales/en-US'),
          import('@univerjs/preset-sheets-core/lib/index.css'),
        ]);

        if (disposed) return;

        const { createUniver, LocaleType, mergeLocales } = presetsModule;
        const { UniverSheetsCorePreset } = sheetsModule;
        const { default: UniverPresetSheetsCoreEnUS } = localeModule;

        const { univer, univerAPI } = createUniver({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
          },
          presets: [
            UniverSheetsCorePreset({
              container,
            }),
          ],
        });

        univerInstance = univer;
        const workbook = univerAPI.createWorkbook(workbookSnapshot(preview, LocaleType.EN_US));
        const worksheet = workbook.getActiveSheet();

        const activateRange = (range: string) => {
          if (!range) return;
          try {
            worksheet.getRange(range).activate();
          } catch {
            // Ignore stale/manual range text while a new source sheet is loading.
          }
        };

        viewerRef.current = { activateRange };
        if (activeRangeRef.current) activateRange(activeRangeRef.current);

        selectionDisposable = workbook.onSelectionChange((selections: UniverSelectionRange[]) => {
          const primary = selections[0];
          if (!primary) return;
          onSelectionChangeRef.current(selectionA1(primary));
        });
      } catch (reason) {
        if (!disposed) {
          setLoadError(reason instanceof Error ? reason.message : 'The spreadsheet viewer could not be opened.');
        }
      }
    })();

    return () => {
      disposed = true;
      viewerRef.current = null;
      queueMicrotask(() => {
        selectionDisposable?.dispose();
        univerInstance?.dispose();
        container.remove();
      });
    };
  }, [preview]);

  return (
    <div className="supplier-source-viewer">
      <div className="supplier-source-viewer-host" ref={hostRef} />
      {loadError && (
        <div className="supplier-source-viewer-error">
          <strong>Spreadsheet viewer unavailable</strong>
          <span>{loadError}</span>
        </div>
      )}
    </div>
  );
}

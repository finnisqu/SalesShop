import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(file:string)=>readFileSync(join(process.cwd(),file),'utf8');
const suppliers=read('src/components/SuppliersWorkspace.tsx');
const connections=read('src/components/Connections.tsx');
const table=read('src/components/ConnectionsTable.tsx');
const css=read('src/suppliers-connections.css');
const adapter=read('src/design-system/suppliers-adapter.css');

describe('Suppliers in Connections layout regression',()=>{
 it('renders directory or full supplier record, never both',()=>{
  expect(suppliers).toContain('{directoryOpen&&<section className="supplier-directory-page"');
  expect(suppliers).toContain('{!directoryOpen&&<div className="supplier-workbench is-record-mode">');
  expect(suppliers).toContain('{!embeddedInConnections&&<aside className="supplier-navigator">');
  expect(suppliers).toContain('onClick={() => setDirectoryOpen(true)}');
  expect(connections).toContain('<SuppliersWorkspace externalQuery={query} embeddedInConnections/>');
 });
 it('uses standard Connections table instead of a squeezed native table',()=>{
  expect(suppliers).toContain('<ConnectionsTable tableKey="suppliers"');
  expect(suppliers).toContain('columns={supplierColumns} rows={supplierTableRows}');
  expect(table).toContain("'suppliers'");
  expect(suppliers).toContain('Pricing status');
  expect(suppliers).toContain('onOpen={chooseSupplier}');
 });
 it('restores supplier theme in Connections and prevents centered tabs clipping',()=>{
  expect(adapter).toContain('.sales-app:is(.view-catalog,.view-dashboard)');
  expect(connections).toContain("import '../suppliers-connections.css'");
  expect(css).toContain('justify-content:flex-start');
  expect(css).toContain('min-width:max-content');
  expect(css).toContain('.connections-suppliers-host');
  expect(css).toContain('.supplier-workbench.is-record-mode');
 });
});

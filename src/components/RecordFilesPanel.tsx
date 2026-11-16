import {RecordCard} from './RecordPageLayout';
import {FileLinksManager} from './FileLinksManager';
import type {FileTarget} from '../services/fileLinks357a';
export function RecordFilesPanel({target}:{target:FileTarget}){
 return <RecordCard title="Files & folders"><FileLinksManager target={target}/></RecordCard>;
}

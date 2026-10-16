import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STUDIO_TABS,blankStudioSettings,cleanStudioSettings,
} from '../platform/headquartersSettingsTypes';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Developer Studio Settings',()=>{
  const migration=read('supabase/migrations/202610120002_platform_studio_settings.sql');
  const consoleSource=read('src/components/DeveloperConsole.tsx');
  const settingsSource=read('src/platform/HeadquartersSettings.tsx');
  const storeSource=read('src/platform/useHeadquartersDocument.ts');
  const style=read('src/platform/headquarters-settings.css');

  it('defaults to a safe, useful headquarters landing page with follow-ups shown',()=>{
    expect(blankStudioSettings()).toEqual({
      schemaVersion:1,startTab:'overview',density:'comfortable',accent:'gold',showFollowUps:true,
    });
    expect(STUDIO_TABS).toContain('settings');
    expect(STUDIO_TABS).toContain('playground');
  });
  it('validates persisted settings and falls back to safe choices',()=>{
    expect(cleanStudioSettings(null)).toEqual(blankStudioSettings());
    expect(cleanStudioSettings({
      schemaVersion:1,startTab:'crm',density:'compact',accent:'teal',showFollowUps:false,
    })).toEqual({schemaVersion:1,startTab:'crm',density:'compact',accent:'teal',showFollowUps:false});
    expect(cleanStudioSettings({
      schemaVersion:1,startTab:'delete_all_data',density:'infinite',accent:'transparent',
      showFollowUps:'false',
    })).toEqual(blankStudioSettings());
  });
  it('adds only one private, developer-scoped settings document kind and server validation',()=>{
    expect(migration).toContain("document_kind in ('notebook','crm','settings')");
    expect(migration).toContain('create or replace function private.platform_hq_validate_document');
    expect(migration).toContain("if p_kind='settings'");
    expect(migration).toContain("private.is_platform_developer()");
    expect(migration).toContain("d.owner_user_id=(select auth.uid())");
    expect(migration).not.toContain('public.organization_members');
    expect(migration).not.toContain('public.quotes');
    expect(migration).not.toContain('public.contacts');
    expect(storeSource).toContain("type DocumentKind='notebook'|'crm'|'settings'");
  });
  it('keeps preferences functional and excludes customer workspace stores',()=>{
    expect(consoleSource).toContain("useHeadquartersDocument('settings'");
    expect(consoleSource).toContain('setTab(settingsStore.document.startTab)');
    expect(consoleSource).toContain('settingsStore.document.showFollowUps');
    expect(consoleSource).toContain('data-studio-density={settingsStore.document.density}');
    expect(consoleSource).toContain('data-studio-accent={settingsStore.document.accent}');
    expect(consoleSource).toContain('<HeadquartersSettings');
    expect(settingsSource).toContain("set('startTab'");
    expect(settingsSource).toContain("set('showFollowUps'");
    expect(settingsSource).toContain("resetPasswordForEmail(email");
    expect(settingsSource).toContain('Export my Headquarters data');
    expect(settingsSource).toContain('Not implemented');
    expect(style).toContain('@media (max-width:560px)');
    for(const forbidden of ['useQuoteStore','useCrmStore','useNotebookStore',
      "from('organization_members')","from('quotes')","from('contacts')"]){
      expect(settingsSource).not.toContain(forbidden);
    }
  });
});

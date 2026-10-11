import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase',()=>({supabase:null,supabaseConfigured:true}));
vi.mock('../store/authStore',()=>{
  const state={
    platformRole:'developer', mode:'cloud', ready:true, busy:false,
    user:{id:'dedicated-developer',email:'developer@example.test'},
    organizationId:null, teamRole:null, passwordRecovery:false,
    signOut:()=>Promise.resolve(),
  };
  return {useAuthStore:(selector:(value:typeof state)=>unknown)=>selector(state)};
});
import { DeveloperConsole } from './DeveloperConsole';

describe('isolated developer console',()=>{
  it('shows company-safe product metadata without any tenant workspace navigation',()=>{
    const html=renderToStaticMarkup(<DeveloperConsole/>);
    expect(html).toContain('PLATFORM STUDIO');
    expect(html).toContain('Platform overview');
    expect(html).toContain('Customer data access');
    expect(html).toContain('Company ownership');
    expect(html).toContain('Not available by default');
    expect(html).toContain('Subscriptions');
    expect(html).toContain('Planned');
    expect(html).not.toContain('Enter company');
    expect(html).not.toContain('View quote');
    expect(html).not.toContain('Quote editor');
    expect(html).not.toContain('Team members');
  });
});

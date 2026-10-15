import { useEffect, useRef, useState } from 'react';
import { useNavigationStore } from '../store/navigationStore';
import { useAuthStore } from '../store/authStore';
import { useAppearanceStore } from '../store/appearanceStore';
import { AuthStatus } from './AuthGate';
import '../account-menu.css';

export function AccountMenu() {
  const setView = useNavigationStore(s => s.setView);
  const user = useAuthStore(s => s.user);
  const theme = useAppearanceStore(s => s.preferences.themeChoice);
  const setAppearance = useAppearanceStore(s => s.update);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {document.removeEventListener('pointerdown', outside);document.removeEventListener('keydown', escape);};
  }, [open]);
  const initial = (user?.email?.trim().charAt(0) || 'S').toUpperCase();
  return <div className="app-profile-menu" ref={root}>
    <button type="button" className="app-profile-trigger" aria-label="Account and settings" aria-expanded={open}
      aria-haspopup="true" title="Account and settings" onClick={() => setOpen(value => !value)}>
      <span aria-hidden="true">{initial}</span>
    </button>
    {open && <div className="app-profile-panel" aria-label="Account menu">
      <strong>My SalesShop</strong>
      {user?.email && <small title={user.email}>{user.email}</small>}
      <div className="app-profile-theme-shortcuts" aria-label="Quick appearance">
        <span>Appearance</span>
        <div role="group" aria-label="Switch appearance theme">
          {(['warm','light','dark'] as const).map(choice=>
            <button type="button" key={choice} aria-pressed={theme===choice}
              onClick={()=>setAppearance({themeChoice:choice})}>
              {choice==='warm'?'Warm':choice==='light'?'Light':'Dark'}
            </button>)}
        </div>
      </div>
      <button type="button" onClick={() => {setView('settings');setOpen(false);}}>⚙ Settings &amp; Profile</button>
      <div className="app-profile-session"><AuthStatus /></div>
    </div>}
  </div>;
}

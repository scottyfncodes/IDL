import { useEffect } from 'react';
import { useRoute, navigate } from './router';
import { TabLayout } from './TabLayout';
import { TodayPage } from '../pages/TodayPage';
import { PlayPage } from '../pages/PlayPage';
import { LibraryPage } from '../pages/LibraryPage';
import { DailyRoute } from '../pages/DailyRoute';
import { RoomRoute } from '../pages/RoomRoute';
import { EditionPage } from '../pages/EditionPage';
import { NotFound } from '../pages/States';
import { useApplyTheme, useSettings } from '../lib/settings';
import { registerServiceWorker } from '../pwa/register';
import { useToast } from '../ui/Toast';

let swRegistered = false;

export function App() {
  const route = useRoute();
  const [settings] = useSettings();
  const toast = useToast();
  useApplyTheme(settings.theme);

  useEffect(() => {
    if (swRegistered) return;
    swRegistered = true;
    registerServiceWorker((apply) =>
      toast.show('A fresh version of idl is ready', { action: { label: 'Reload', onClick: apply }, duration: 15000 }),
    );
  }, [toast]);

  // Scroll to top on screen change.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);

  const [a, b, c] = route.segments;

  useEffect(() => {
    if (!a) navigate('/today', { replace: true });
  }, [a]);

  if (!a || a === 'today') return <TabLayout active="today"><TodayPage /></TabLayout>;
  if (a === 'play' && !b) return <TabLayout active="play"><PlayPage /></TabLayout>;
  if (a === 'library') return <TabLayout active="library"><LibraryPage /></TabLayout>;
  if (a === 'play' && b) return <RoomRoute gameId={b} />;
  if (a === 'daily' && b) return <DailyRoute gameId={b} date={c} />;
  if (a === 'edition' && b) return <EditionPage date={b} />;
  return <NotFound />;
}

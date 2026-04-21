import { AppShell } from '@mantine/core';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { RightRail } from './RightRail';
import { BottomDock } from './BottomDock';
import { GlobeStage } from '../globe/GlobeStage';

/**
 * Meridian's single-screen IA (§6). Four fixed regions around a
 * full-bleed globe. No routing — state lives in Zustand stores and
 * shareable URL hash.
 */
export function AppChrome() {
  return (
    <AppShell
      header={{ height: 48 }}
      navbar={{ width: 320, breakpoint: 'sm' }}
      aside={{ width: 380, breakpoint: 'sm' }}
      footer={{ height: 88 }}
      padding={0}
      layout="alt"
    >
      <AppShell.Header>
        <TopBar />
      </AppShell.Header>

      <AppShell.Navbar>
        <LeftRail />
      </AppShell.Navbar>

      <AppShell.Aside>
        <RightRail />
      </AppShell.Aside>

      <AppShell.Footer>
        <BottomDock />
      </AppShell.Footer>

      <AppShell.Main>
        <GlobeStage />
      </AppShell.Main>
    </AppShell>
  );
}

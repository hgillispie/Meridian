import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { Spotlight } from '@mantine/spotlight';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme';
import { AppChrome } from './components/chrome/AppChrome';
import { useSpotlightActions } from './components/search/useSpotlightActions';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <QueryClientProvider client={queryClient}>
        <ModalsProvider>
          <Notifications position="top-right" limit={5} />
          <AppShell />
        </ModalsProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}

/**
 * Inner shell — lives inside QueryClientProvider so the spotlight
 * actions hook can subscribe to query / zustand state without an
 * extra wrapper.
 */
function AppShell() {
  const actions = useSpotlightActions();
  return (
    <>
      <Spotlight
        actions={actions}
        shortcut={['mod + K', 'mod + P']}
        nothingFound="Nothing matches. Try @port, @ship, @plane, @sat, or @city."
        highlightQuery
        limit={12}
        searchProps={{
          leftSection: null,
          placeholder: 'Search ports, vessels, flights, satellites…',
        }}
      />
      <AppChrome />
    </>
  );
}

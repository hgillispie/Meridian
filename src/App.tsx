import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { Spotlight } from '@mantine/spotlight';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme';
import { AppChrome } from './components/chrome/AppChrome';
import { getSpotlightActions } from './components/search/spotlightActions';

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
          <Spotlight
            actions={getSpotlightActions()}
            shortcut={['mod + K', 'mod + P']}
            nothingFound="Nothing here yet — vessels, ports, satellites, and cities coming in Phase 4."
            highlightQuery
            searchProps={{
              leftSection: null,
              placeholder: 'Search ports, vessels, flights, satellites…',
            }}
          />
          <AppChrome />
        </ModalsProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}

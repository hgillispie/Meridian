import {
  Button,
  Paper,
  TextInput,
  Select,
  ActionIcon,
  Badge,
  createTheme,
  type MantineColorsTuple,
} from '@mantine/core';

/**
 * Meridian electric-mint primary. 10-stop tuple required by Mantine v7.
 * Anchor: #00E5A8 at index 6. Lighter stops trend toward mint-white;
 * darker stops trend toward deep teal so the focus/active states read
 * correctly against the dark command-center surfaces (§5.2).
 */
const meridian: MantineColorsTuple = [
  '#E6FFF7',
  '#C9FBEA',
  '#93F4D2',
  '#5CEDBA',
  '#2FE8A8',
  '#0FE29B',
  '#00E5A8', // primary
  '#00B585',
  '#008663',
  '#005C44',
];

/**
 * Amber for disruption / warning states (§5.2). Used sparingly so it retains
 * urgency when it does appear.
 */
const amber: MantineColorsTuple = [
  '#FFF7E6',
  '#FFEBC2',
  '#FFDD99',
  '#FFCC66',
  '#FFC147',
  '#FFB830',
  '#FFB020', // primary
  '#E39500',
  '#B07300',
  '#7A5000',
];

/**
 * Coral red for critical / closure states. Used extremely sparingly.
 */
const coral: MantineColorsTuple = [
  '#FFECED',
  '#FFD0D3',
  '#FFA7AD',
  '#FF7E87',
  '#FF6B73',
  '#FF5A5F', // primary
  '#E6484D',
  '#BF383C',
  '#99292C',
  '#731C1E',
];

/**
 * Ice blue for satellite traces / orbital context.
 */
const ice: MantineColorsTuple = [
  '#EEF9FF',
  '#D6F0FF',
  '#B0E3FF',
  '#8BD6FF',
  '#7BD3FF', // primary
  '#5EC4F7',
  '#3FB3E8',
  '#2299CC',
  '#1078A8',
  '#065680',
];

export const theme = createTheme({
  /**
   * Typography — Geist (UI) + IBM Plex Mono (numerics/terminal). Self-hosted
   * in /public/fonts and registered via @font-face in globals.css.
   */
  fontFamily:
    '"Geist Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  fontFamilyMonospace:
    '"IBM Plex Mono", "Geist Mono", ui-monospace, Menlo, Monaco, monospace',
  headings: {
    fontFamily: '"Geist Sans", -apple-system, system-ui, sans-serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '1.75rem', lineHeight: '1.2' },
      h2: { fontSize: '1.375rem', lineHeight: '1.25' },
      h3: { fontSize: '1.125rem', lineHeight: '1.3' },
      h4: { fontSize: '0.9375rem', lineHeight: '1.35' },
    },
  },

  /**
   * Aggressive overrides to erase the "vanilla Mantine" signal (§5.1):
   * sharper corners, mint primary, denser defaults.
   */
  primaryColor: 'meridian',
  primaryShade: { light: 6, dark: 6 },
  defaultRadius: 2,
  cursorType: 'pointer',
  focusRing: 'auto',

  // Tightened spacing scale (§5.1.2)
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },

  radius: {
    xs: '2px',
    sm: '3px',
    md: '4px',
    lg: '6px',
    xl: '10px',
  },

  colors: {
    meridian,
    amber,
    coral,
    ice,
  },

  /**
   * Component defaults — dense, sharp, no shadows (§5.1.6).
   */
  components: {
    Button: Button.extend({
      defaultProps: {
        size: 'xs',
        radius: 'xs',
      },
    }),
    TextInput: TextInput.extend({
      defaultProps: {
        size: 'xs',
        radius: 'xs',
      },
    }),
    Select: Select.extend({
      defaultProps: {
        size: 'xs',
        radius: 'xs',
      },
    }),
    ActionIcon: ActionIcon.extend({
      defaultProps: {
        size: 'sm',
        radius: 'xs',
      },
    }),
    Badge: Badge.extend({
      defaultProps: {
        radius: 'xs',
        size: 'sm',
      },
    }),
    Paper: Paper.extend({
      defaultProps: {
        withBorder: true,
        shadow: 'none',
        radius: 'xs',
      },
    }),
  },
});

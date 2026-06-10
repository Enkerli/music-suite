// Type definitions for i18next autocomplete

import 'react-i18next';
import type common from './locales/en-CA/common.json';
import type accessibility from './locales/en-CA/accessibility.json';
import type messages from './locales/en-CA/messages.json';
import type notes from './locales/en-CA/notes.json';
import type chords from './locales/en-CA/chords.json';
import type progressions from './locales/en-CA/progressions.json';

// Extend the CustomTypeOptions interface to add type safety
declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      accessibility: typeof accessibility;
      messages: typeof messages;
      notes: typeof notes;
      chords: typeof chords;
      progressions: typeof progressions;
    };
  }
}

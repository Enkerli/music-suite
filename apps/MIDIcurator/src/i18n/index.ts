import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import commonEN from './locales/en-CA/common.json';
import commonFR from './locales/fr-CA/common.json';
import accessibilityEN from './locales/en-CA/accessibility.json';
import accessibilityFR from './locales/fr-CA/accessibility.json';
import messagesEN from './locales/en-CA/messages.json';
import messagesFR from './locales/fr-CA/messages.json';
import notesEN from './locales/en-CA/notes.json';
import notesFR from './locales/fr-CA/notes.json';
import chordsEN from './locales/en-CA/chords.json';
import chordsFR from './locales/fr-CA/chords.json';
import progressionsEN from './locales/en-CA/progressions.json';
import progressionsFR from './locales/fr-CA/progressions.json';

// Define resources
const resources = {
  'en-CA': {
    common: commonEN,
    accessibility: accessibilityEN,
    messages: messagesEN,
    notes: notesEN,
    chords: chordsEN,
    progressions: progressionsEN,
  },
  'fr-CA': {
    common: commonFR,
    accessibility: accessibilityFR,
    messages: messagesFR,
    notes: notesFR,
    chords: chordsFR,
    progressions: progressionsFR,
  },
} as const;

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en-CA',
    defaultNS: 'common',
    ns: ['common', 'accessibility', 'messages', 'notes', 'chords', 'progressions'],

    detection: {
      // Detection order: localStorage > navigator language
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    interpolation: {
      escapeValue: false, // React already escapes by default
    },

    // Update document attributes when language changes
    react: {
      useSuspense: false,
    },
  });

// Update HTML lang attribute and dir when language changes
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;

  // RTL support for future expansion
  const rtlLanguages = ['ar', 'he', 'fa'];
  document.documentElement.dir = rtlLanguages.includes(lng) ? 'rtl' : 'ltr';
});

export default i18n;

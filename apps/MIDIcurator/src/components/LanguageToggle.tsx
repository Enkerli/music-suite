import { useTranslation } from 'react-i18next';

/**
 * Language toggle between EN and FR.
 * Persists preference to localStorage via i18next.
 */
export function LanguageToggle() {
  const { i18n, t } = useTranslation('accessibility');

  const currentLang = i18n.language;
  const isEnglish = currentLang === 'en-CA';
  const targetLang = isEnglish ? 'fr-CA' : 'en-CA';
  const targetLangName = isEnglish ? 'Français' : 'English';

  const toggle = () => {
    i18n.changeLanguage(targetLang);
  };

  return (
    <button
      className="mc-lang-toggle"
      onClick={toggle}
      title={t('language_toggle_label', { language: targetLangName })}
      aria-label={t('language_toggle_label', { language: targetLangName })}
    >
      {isEnglish ? 'FR' : 'EN'}
    </button>
  );
}

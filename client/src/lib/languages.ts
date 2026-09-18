/**
 * Languages the interface is prepared for.
 *
 * Kept in step with the server's `SUPPORTED_LANGUAGES` so a value chosen here can
 * always be saved.
 */
export const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'fr', label: 'Français (French)' },
  { value: 'es', label: 'Español (Spanish)' },
  { value: 'ja', label: '日本語 (Japanese)' },
] as const;

export const SUPPORTED_CURRENCIES = [
  { value: 'INR', label: 'INR — Indian rupee' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — Pound sterling' },
  { value: 'JPY', label: 'JPY — Japanese yen' },
  { value: 'SGD', label: 'SGD — Singapore dollar' },
] as const;

export function languageLabel(value: string): string {
  return SUPPORTED_LANGUAGES.find((entry) => entry.value === value)?.label ?? value;
}

export function currencyLabel(value: string): string {
  return SUPPORTED_CURRENCIES.find((entry) => entry.value === value)?.label ?? value;
}

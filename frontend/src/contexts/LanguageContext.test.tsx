import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider, useLanguage } from './LanguageContext';

function TestConsumer() {
  const { language, t, setLanguage } = useLanguage();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="translated">{t.nav.dashboard}</span>
      <button onClick={() => setLanguage('ne')}>to-nepali</button>
      <button onClick={() => setLanguage('en')}>to-english</button>
    </div>
  );
}

describe('LanguageContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
  });

  it('defaults to English when nothing is stored', () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('language').textContent).toBe('en');
    expect(screen.getByTestId('translated').textContent).toBe('Dashboard');
    expect(document.documentElement.lang).toBe('en');
  });

  it('uses the stored language over the default when one exists', () => {
    localStorage.setItem('language', 'ne');
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('language').textContent).toBe('ne');
    expect(screen.getByTestId('translated').textContent).toBe('ड्यासबोर्ड');
  });

  it('setLanguage switches the dictionary, persists to localStorage, and updates document.documentElement.lang', () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByText('to-nepali'));

    expect(screen.getByTestId('language').textContent).toBe('ne');
    expect(screen.getByTestId('translated').textContent).toBe('ड्यासबोर्ड');
    expect(localStorage.getItem('language')).toBe('ne');
    expect(document.documentElement.lang).toBe('ne');

    fireEvent.click(screen.getByText('to-english'));

    expect(screen.getByTestId('language').textContent).toBe('en');
    expect(localStorage.getItem('language')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('throws when useLanguage is used outside a LanguageProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      'useLanguage must be used within LanguageProvider'
    );
    spy.mockRestore();
  });
});

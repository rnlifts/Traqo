import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '../contexts/LanguageContext';
import { LanguageToggle } from './LanguageToggle';

describe('LanguageToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
  });

  it('renders in English by default, showing the "EN" label', () => {
    render(
      <LanguageProvider>
        <LanguageToggle />
      </LanguageProvider>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('switches to Nepali on click and updates document.documentElement.lang', () => {
    render(
      <LanguageProvider>
        <LanguageToggle />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('नेपाली')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ne');
    expect(localStorage.getItem('language')).toBe('ne');
  });
});

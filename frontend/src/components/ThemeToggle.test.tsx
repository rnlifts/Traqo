import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ThemeToggle } from './ThemeToggle';

function mockMatchMedia(prefersDark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    mockMatchMedia(false);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders in light mode with an accessible label to switch to dark', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: /switch to dark theme/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Light')).toBeInTheDocument();
  });

  it('switches to dark mode on click and updates the document attribute', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

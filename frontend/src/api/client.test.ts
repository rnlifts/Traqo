import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import client from './client';

// These tests exercise the REAL interceptor registered on `client` in client.ts, by
// overriding the axios adapter to simulate a server response — not by re-implementing
// the interceptor's logic inline in the test (which would pass even if the real
// interceptor were deleted).
describe('client 401 interceptor', () => {
  const originalAdapter = client.defaults.adapter;
  let originalLocation: Location;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('current_user', JSON.stringify({ username: 'test-user' }));
    client.defaults.headers.common['Authorization'] = 'Bearer test-token';

    originalLocation = window.location;
    delete (window as any).location;
    // Minimal stub — only `href` is used by the interceptor
    (window as any).location = { href: '' };
  });

  afterEach(() => {
    client.defaults.adapter = originalAdapter;
    (window as any).location = originalLocation;
    localStorage.clear();
  });

  it('clears the session and redirects to /login on a real 401 response', async () => {
    client.defaults.adapter = async (config: any) => {
      const error: any = new Error('Unauthorized');
      error.isAxiosError = true;
      error.config = config;
      error.response = { status: 401, data: { error: 'Unauthorized' }, headers: {}, config };
      throw error;
    };

    await expect(client.get('/some-protected-endpoint')).rejects.toBeTruthy();

    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('current_user')).toBeNull();
    expect(client.defaults.headers.common['Authorization']).toBeUndefined();
    expect(window.location.href).toBe('/login');
  });

  it('leaves the session untouched on a non-401 error response', async () => {
    client.defaults.adapter = async (config: any) => {
      const error: any = new Error('Bad Request');
      error.isAxiosError = true;
      error.config = config;
      error.response = { status: 400, data: { error: 'Validation failed' }, headers: {}, config };
      throw error;
    };

    await expect(client.get('/some-endpoint')).rejects.toBeTruthy();

    expect(localStorage.getItem('auth_token')).toBe('test-token');
    expect(localStorage.getItem('current_user')).not.toBeNull();
    expect(client.defaults.headers.common['Authorization']).toBe('Bearer test-token');
    expect(window.location.href).toBe('');
  });
});

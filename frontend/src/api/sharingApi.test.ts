import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import client from './client';
import { sharingApi } from './sharingApi';

// Exercises the real axios client by overriding its adapter to simulate a server
// response, same technique as client.test.ts - proves the actual HTTP call shape
// (method, URL) and that getSharedWithMe goes through the interceptor-bearing
// `client` (not publicClient), since this is a private, auth-required endpoint.
describe('sharingApi.getSharedWithMe', () => {
  const originalAdapter = client.defaults.adapter;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    client.defaults.adapter = originalAdapter;
  });

  it('calls GET /shared-with-me and returns the response data', async () => {
    const mockEntries = [
      {
        plan_id: 5,
        plan_name: 'Beginner Strength',
        token: 'abc123',
        owner_username: 'coach_sam',
        permission: 'log',
      },
    ];

    let requestedUrl = '';
    let requestedMethod = '';
    client.defaults.adapter = async (config: any) => {
      requestedUrl = config.url;
      requestedMethod = config.method;
      return {
        data: mockEntries,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    const result = await sharingApi.getSharedWithMe();

    expect(requestedMethod).toBe('get');
    expect(requestedUrl).toBe('/shared-with-me');
    expect(result).toEqual(mockEntries);
  });

  it('returns an empty array when the caller has no shared plans', async () => {
    client.defaults.adapter = async (config: any) => ({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });

    const result = await sharingApi.getSharedWithMe();
    expect(result).toEqual([]);
  });

  it('uses the interceptor-bearing client, not publicClient - a 401 triggers the session-clear redirect', async () => {
    // Prove this goes through `client` (which has the global 401 interceptor), not
    // publicClient (which doesn't) - by simulating a real 401 and observing the
    // interceptor's known side effect.
    localStorage.setItem('auth_token', 'stale-token');
    localStorage.setItem('current_user', JSON.stringify({ username: 'x' }));
    client.defaults.headers.common['Authorization'] = 'Bearer stale-token';

    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { href: '' };

    client.defaults.adapter = async (config: any) => {
      const error: any = new Error('Unauthorized');
      error.isAxiosError = true;
      error.config = config;
      error.response = { status: 401, data: {}, headers: {}, config };
      throw error;
    };

    await expect(sharingApi.getSharedWithMe()).rejects.toBeTruthy();

    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(window.location.href).toBe('/login');

    (window as any).location = originalLocation;
  });
});

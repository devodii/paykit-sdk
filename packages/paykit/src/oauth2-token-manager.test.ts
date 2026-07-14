import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationFailedError } from './error';
import type { HTTPClient } from './http-client';
import { OAuth2TokenManager } from './oauth2-token-manager';

const makeManager = (
  post: ReturnType<typeof vi.fn>,
  overrides: Partial<
    ConstructorParameters<typeof OAuth2TokenManager>[0]
  > = {},
) =>
  new OAuth2TokenManager({
    client: { post } as unknown as HTTPClient,
    provider: 'test-provider',
    tokenEndpoint: '/oauth2/token',
    credentials: { username: 'user', password: 'pass' },
    responseAdapter: response => ({
      accessToken: response.access_token,
      expiresIn: response.expires_in,
    }),
    ...overrides,
  });

const makeGetManager = (
  get: ReturnType<typeof vi.fn>,
  overrides: Partial<
    ConstructorParameters<typeof OAuth2TokenManager>[0]
  > = {},
) =>
  new OAuth2TokenManager({
    client: { get } as unknown as HTTPClient,
    provider: 'test-provider',
    tokenEndpoint: '/oauth/accesstoken?grant_type=client_credentials',
    method: 'GET',
    credentials: { username: 'user', password: 'pass' },
    responseAdapter: response => ({
      accessToken: response.access_token,
      expiresIn: response.expires_in,
    }),
    ...overrides,
  });

describe('OAuth2TokenManager', () => {
  let post: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    post = vi.fn().mockResolvedValue({
      ok: true,
      value: { access_token: 'tok1', expires_in: 3600 },
    });
  });

  it('fetches a token with Basic auth on first call', async () => {
    const manager = makeManager(post);

    await expect(manager.getToken()).resolves.toBe('tok1');

    expect(post).toHaveBeenCalledTimes(1);
    const [endpoint, options] = post.mock.calls[0];
    expect(endpoint).toBe('/oauth2/token');
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from('user:pass').toString('base64')}`,
    );
  });

  it('getAuthHeaders returns a Bearer header plus extra auth headers', async () => {
    const manager = makeManager(post, {
      authHeaders: { 'X-Extra': '1' },
    });

    await expect(manager.getAuthHeaders()).resolves.toEqual({
      Authorization: 'Bearer tok1',
      'X-Extra': '1',
    });
  });

  it('throws OperationFailedError when the token request fails', async () => {
    post.mockResolvedValue({ ok: false, error: new Error('nope') });
    const manager = makeManager(post);

    await expect(manager.getToken()).rejects.toThrow(
      OperationFailedError,
    );
  });

  it('throws OperationFailedError when the adapter yields no token', async () => {
    post.mockResolvedValue({
      ok: true,
      value: { access_token: '', expires_in: 0 },
    });
    const manager = makeManager(post);

    await expect(manager.getToken()).rejects.toThrow(
      OperationFailedError,
    );
  });

  it('serves the cached token on subsequent calls', async () => {
    const manager = makeManager(post);

    await expect(manager.getToken()).resolves.toBe('tok1');
    await expect(manager.getToken()).resolves.toBe('tok1');

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('refreshes once the cached token expires (honoring the buffer)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const manager = makeManager(post);
      await manager.getToken();

      // expires_in 3600s with a 300s buffer → valid for 3300s
      vi.setSystemTime(Date.now() + 3200 * 1000);
      await manager.getToken();
      expect(post).toHaveBeenCalledTimes(1);

      vi.setSystemTime(Date.now() + 200 * 1000);
      await manager.getToken();
      expect(post).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('deduplicates concurrent refreshes into a single request', async () => {
    const manager = makeManager(post);

    const tokens = await Promise.all([
      manager.getToken(),
      manager.getToken(),
      manager.getToken(),
    ]);

    expect(tokens).toEqual(['tok1', 'tok1', 'tok1']);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('recovers after a failed refresh', async () => {
    post.mockResolvedValueOnce({
      ok: false,
      error: new Error('nope'),
    });
    const manager = makeManager(post);

    await expect(manager.getToken()).rejects.toThrow(
      OperationFailedError,
    );
    await expect(manager.getToken()).resolves.toBe('tok1');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("fetches a token via GET with Basic auth when method: 'GET' is set", async () => {
    const get = vi.fn().mockResolvedValue({
      ok: true,
      value: { access_token: 'tok1', expires_in: 3600 },
    });
    const manager = makeGetManager(get);

    await expect(manager.getToken()).resolves.toBe('tok1');

    expect(get).toHaveBeenCalledTimes(1);
    const [endpoint, options] = get.mock.calls[0];
    expect(endpoint).toBe(
      '/oauth/accesstoken?grant_type=client_credentials',
    );
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from('user:pass').toString('base64')}`,
    );
    expect(options.body).toBeUndefined();
  });
});

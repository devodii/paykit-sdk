import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { HTTPClient } from './http-client';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const makeClient = (headers: Record<string, string> = {}) =>
  new HTTPClient({
    baseUrl: 'https://api.example.com',
    headers,
    retryOptions: { max: 2, baseDelay: 1, debug: false },
  });

describe('HTTPClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET returns OK with the parsed body on success', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ a: 1 }));

    const result = await makeClient().get<{ a: number }>('/thing');

    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ a: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/thing',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('GET strips a leading slash from the endpoint', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await makeClient().get('thing');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.example.com/thing',
    );
  });

  it('GET returns ERR on an HTTP error response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: 'not found' }, 404),
    );

    const result = await makeClient().get('/missing');

    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });

  it('POST returns ERR on an HTTP error response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: 'bad' }, 400),
    );

    const result = await makeClient().post('/create', {
      body: JSON.stringify({ x: 1 }),
    });

    expect(result.ok).toBe(false);
  });

  it('sends config headers and Content-Type by default', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await makeClient({ Authorization: 'Basic abc' }).get('/thing');

    const options = fetchMock.mock.calls[0][1];
    expect(options.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Basic abc',
    });
  });

  it('merges per-call headers with config headers', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await makeClient({ Authorization: 'Basic abc' }).get('/thing', {
      headers: { 'Idempotency-Key': 'k1' },
    });

    const options = fetchMock.mock.calls[0][1];
    expect(options.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Basic abc',
      'Idempotency-Key': 'k1',
    });
  });

  it('retries retryable HTTP statuses until success', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ err: 'busy' }, 503))
      .mockResolvedValueOnce(jsonResponse({ err: 'busy' }, 503))
      .mockResolvedValueOnce(jsonResponse({ fine: true }));

    const result = await makeClient().get('/busy');

    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ fine: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns ERR after exhausting retries', async () => {
    // Fresh Response per call — a body can only be consumed once
    fetchMock.mockImplementation(async () =>
      jsonResponse({ err: 'busy' }, 503),
    );

    const result = await makeClient().get('/busy');

    expect(result.ok).toBe(false);
    // max 2 retries → 3 total attempts
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable HTTP statuses', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ err: 'nope' }, 400),
    );

    const result = await makeClient().post('/create');

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns ERR (not null) on a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const result = await makeClient().get('/down');

    expect(result).not.toBeNull();
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });

  it('DELETE resolves with the parsed body, not a Promise', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ gone: true }));

    const result = await makeClient().delete('/thing/1');

    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ gone: true });
  });

  it('PUT returns ERR on HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'bad' }, 400),
    );

    const result = await makeClient().put('/thing/1', {
      body: JSON.stringify({}),
    });

    expect(result.ok).toBe(false);
  });

  it('PATCH returns OK with the parsed body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ patched: 1 }));

    const result = await makeClient().patch('/thing/1', {
      body: JSON.stringify({}),
    });

    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ patched: 1 });
  });

  it('handles empty response bodies without crashing', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('', { status: 200 }),
    );

    const result = await makeClient().get('/empty');

    expect(result.ok).toBe(true);
    expect(result.value).toBeNull();
  });

  it('returns ERR for malformed JSON on a 200 response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{nope', { status: 200 }),
    );

    const result = await makeClient().get('/broken');

    expect(result.ok).toBe(false);
  });
});

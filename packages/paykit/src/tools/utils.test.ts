import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ERR,
  OK,
  executeWithRetryWithHandler,
  getURLFromHeaders,
  omitInternalMetadata,
  parseJSON,
  refundReasonMatcher,
  safeDecode,
  safeEncode,
  stringifyMetadataValues,
  unwrapAsync,
  validateRequiredKeys,
} from './utils';

describe('OK / ERR / unwrapAsync', () => {
  it('OK wraps a value', () => {
    expect(OK(1)).toEqual({ ok: true, value: 1 });
  });

  it('ERR wraps an error', () => {
    const e = new Error('x');
    expect(ERR(e)).toEqual({ ok: false, error: e });
  });

  it('unwrapAsync resolves the value of an OK result', async () => {
    await expect(unwrapAsync(Promise.resolve(OK(42)))).resolves.toBe(
      42,
    );
  });

  it('unwrapAsync rejects with the error of an ERR result', async () => {
    const e = new Error('boom');
    await expect(
      unwrapAsync(Promise.resolve(ERR(e))),
    ).rejects.toThrow('boom');
  });
});

describe('safeEncode / safeDecode', () => {
  it('round-trips an object', () => {
    const input = { a: 1, b: 'two', c: [3] };
    const encoded = safeEncode(input);
    expect(encoded.ok).toBe(true);
    const decoded = safeDecode<typeof input>(encoded.value!);
    expect(decoded.ok).toBe(true);
    expect(decoded.value).toEqual(input);
  });

  it('safeDecode returns ERR for garbage input', () => {
    const decoded = safeDecode('%%%not-base64-json');
    expect(decoded.ok).toBe(false);
    expect(decoded.error).toBeInstanceOf(Error);
  });
});

describe('validateRequiredKeys', () => {
  it('returns the picked keys when all are present', () => {
    const result = validateRequiredKeys(
      ['a', 'b'],
      { a: '1', b: '2', c: '3' } as Record<'a' | 'b', string>,
      'missing: {keys}',
    );
    expect(result).toEqual({ a: '1', b: '2' });
  });

  it('throws with the missing key names substituted', () => {
    expect(() =>
      validateRequiredKeys(
        ['a', 'b'],
        { a: '1' } as Record<'a' | 'b', string>,
        'missing: {keys}',
      ),
    ).toThrow('missing: b');
  });
});

describe('stringifyMetadataValues', () => {
  it('stringifies non-string values and passes strings through', () => {
    expect(
      stringifyMetadataValues({
        count: 5,
        name: 'John',
        nested: { a: 1 },
      }),
    ).toEqual({
      count: '5',
      name: 'John',
      nested: '{"a":1}',
    });
  });
});

describe('omitInternalMetadata', () => {
  it('strips the internal __paykit key and keeps the rest', () => {
    expect(
      omitInternalMetadata({ __paykit: '{"x":1}', keep: 'me' }),
    ).toEqual({ keep: 'me' });
  });
});

describe('parseJSON', () => {
  const schema = z.object({ a: z.number() });

  it('parses valid JSON matching the schema', () => {
    expect(parseJSON('{"a":1}', schema)).toEqual({ a: 1 });
  });

  it('returns null for invalid JSON', () => {
    expect(parseJSON('{nope', schema)).toBeNull();
  });

  it('returns null for JSON failing the schema', () => {
    expect(parseJSON('{"a":"str"}', schema)).toBeNull();
  });
});

describe('refundReasonMatcher', () => {
  it.each([
    ['duplicate charge', 'duplicate'],
    ['customer was charged twice', 'duplicate'],
    ['fraudulent activity', 'fraudulent'],
    ['unauthorized transaction', 'fraudulent'],
    ['customer requested a refund', 'requested_by_customer'],
    ['changed mind', 'requested_by_customer'],
    ['misc', 'other'],
  ])('maps %j to %j', (input, expected) => {
    expect(refundReasonMatcher(input)).toBe(expected);
  });
});

describe('getURLFromHeaders', () => {
  it('prefers the origin header', () => {
    expect(getURLFromHeaders({ origin: 'https://a.com' })).toBe(
      'https://a.com',
    );
  });

  it('builds from forwarded headers', () => {
    expect(
      getURLFromHeaders({
        'x-forwarded-host': 'b.com',
        'x-forwarded-proto': 'http',
      }),
    ).toBe('http://b.com');
  });

  it('falls back to host and defaults to https', () => {
    expect(getURLFromHeaders({ host: 'c.com' })).toBe(
      'https://c.com',
    );
  });

  it('returns empty string when nothing matches', () => {
    expect(getURLFromHeaders({})).toBe('');
  });
});

describe('executeWithRetryWithHandler', () => {
  it('returns the value when the call succeeds first try', async () => {
    const result = await executeWithRetryWithHandler(
      async () => 'ok',
      () => ({ retry: false, data: null }),
      2,
      1,
    );
    expect(result).toBe('ok');
  });

  it('retries until success when the handler says retry', async () => {
    let attempts = 0;
    const result = await executeWithRetryWithHandler(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('flaky');
        return 'recovered';
      },
      () => ({ retry: true, data: null }),
      3,
      1,
    );
    expect(result).toBe('recovered');
    expect(attempts).toBe(3);
  });

  it('propagates non-retryable errors when the handler has no fallback', async () => {
    await expect(
      executeWithRetryWithHandler(
        async () => {
          throw new Error('fatal');
        },
        () => ({ retry: false, data: null }),
        2,
        1,
      ),
    ).rejects.toThrow('fatal');
  });

  it('returns the handler fallback data when one is provided', async () => {
    const result = await executeWithRetryWithHandler(
      async () => {
        throw new Error('fatal');
      },
      () => ({ retry: false, data: 'fallback' }),
      2,
      1,
    );
    expect(result).toBe('fallback');
  });

  it('propagates the error after exhausting retries', async () => {
    let attempts = 0;
    await expect(
      executeWithRetryWithHandler(
        async () => {
          attempts += 1;
          throw new Error('always failing');
        },
        () => ({ retry: true, data: null }),
        2,
        1,
      ),
    ).rejects.toThrow('always failing');
    expect(attempts).toBe(3);
  });
});

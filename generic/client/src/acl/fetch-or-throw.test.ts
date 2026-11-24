import { test as property } from '@fast-check/vitest';
import fc from 'fast-check';
import { http, HttpResponse } from 'msw/http';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { fetchJson, fetchOrThrow } from './fetch-or-throw';

const url = 'http://workspace.test/api/things';
const fallback = (response: Response) => `Request failed with status ${response.status}`;

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe('fetchOrThrow', () => {
  test('returns the response untouched when the server accepts the request', async () => {
    server.use(http.get(url, () => HttpResponse.text('fine', { status: 201 })));

    const response = await fetchOrThrow(url, undefined, fallback);

    expect(response.status).toBe(201);
    expect(await response.text()).toBe('fine');
  });

  test('sends the request options it was given', async () => {
    server.use(http.post(url, async ({ request }) => HttpResponse.text(`${request.method} ${await request.text()}`)));

    const response = await fetchOrThrow(url, { method: 'POST', body: 'payload' }, fallback);

    expect(await response.text()).toBe('POST payload');
  });

  test('throws the message the server sent in its error body', async () => {
    server.use(http.get(url, () => HttpResponse.json({ error: 'Warehouse is stopped' }, { status: 503 })));

    await expect(fetchOrThrow(url, undefined, fallback)).rejects.toThrow(new Error('Warehouse is stopped'));
  });

  test.each([
    ['plain text', () => HttpResponse.text('boom', { status: 500 })],
    ['JSON without an error field', () => HttpResponse.json({ message: 'boom' }, { status: 500 })],
    ['JSON whose error is not text', () => HttpResponse.json({ error: { code: 7 } }, { status: 500 })],
  ])("falls back to the caller's message when the error body is %s", async (_shape, respond) => {
    server.use(http.get(url, respond));

    await expect(fetchOrThrow(url, undefined, fallback)).rejects.toThrow(new Error('Request failed with status 500'));
  });

  property.prop([fc.string(), fc.constantFrom(400, 403, 404, 409, 422, 500, 502, 503)])(
    "always surfaces the server's own message, whatever it says",
    async (message, status) => {
      // A hundred runs through the mock server cost seconds on a busy machine, and the server's part is covered
      // by the cases above. Here only the response matters, so it comes straight from a stand-in for fetch.
      const fetchStub = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: message }, { status }));
      try {
        await expect(fetchOrThrow(url, undefined, fallback)).rejects.toThrow(new Error(message));
      } finally {
        fetchStub.mockRestore();
      }
    }
  );
});

describe('fetchJson', () => {
  const Thing = z.object({ id: z.number(), name: z.string() });

  test('returns the body parsed with the schema', async () => {
    server.use(http.get(url, () => HttpResponse.json({ id: 1, name: 'first', extra: true })));

    expect(await fetchJson(url, undefined, Thing, fallback)).toEqual({ id: 1, name: 'first' });
  });

  test('rejects a body that does not match the schema, naming the address and the problem', async () => {
    server.use(http.get(url, () => HttpResponse.json({ id: 'one', name: 'first' })));

    await expect(fetchJson(url, undefined, Thing, fallback)).rejects.toThrow(
      new Error(`Unexpected response from ${url}: ✖ Invalid input: expected number, received string\n  → at id`)
    );
  });

  test('passes an error response on as the same error fetchOrThrow gives', async () => {
    server.use(http.get(url, () => HttpResponse.json({ error: 'Not allowed' }, { status: 403 })));

    await expect(fetchJson(url, undefined, Thing, fallback)).rejects.toThrow(new Error('Not allowed'));
  });
});

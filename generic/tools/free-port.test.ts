import { createServer } from 'node:net';
import { expect, test } from 'vitest';
import { freePort } from './free-port.ts';

test('returns a port that can be listened on', async () => {
  const port = await freePort();
  await new Promise<void>((resolve, reject) => {
    const server = createServer().once('error', reject);
    server.listen(port, () => server.close(() => resolve()));
  });
  expect(port).toBeGreaterThan(0);
});

test('returns different ports while earlier ones are in use', async () => {
  const held = [];
  const ports = new Set<number>();
  for (let index = 0; index < 5; index += 1) {
    const port = await freePort();
    ports.add(port);
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(port, resolve));
    held.push(server);
  }
  await Promise.all(held.map((server) => new Promise((resolve) => server.close(resolve))));
  expect(ports.size).toBe(5);
});

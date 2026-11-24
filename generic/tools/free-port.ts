import { createServer } from 'node:net';

/**
 * A port nothing is listening on, chosen by the system. Each run of a check asks for its own, so two runs on one
 * machine (two checkouts, two worktrees, two CI jobs on one runner) never share one. The port is free when this
 * returns; whoever asked should start using it at once.
 */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    // No host, so the probe binds where a server that names none would, and a busy port can't slip past it.
    probe.listen(0, () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close((error) => (error || port === 0 ? reject(error ?? new Error('no port assigned')) : resolve(port)));
    });
  });
}

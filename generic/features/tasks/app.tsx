import { expect } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

/**
 * Opens the whole app, as a visitor with a screen `width` pixels wide who arrives at `address`.
 *
 * The app builds its router once, when it is first loaded, so each visit moves that router to its address
 * the way the browser's back button would.
 */
export async function openTheApp(width: number, address = '/'): Promise<void> {
  await page.viewport(width, 800);
  await expect.poll(() => window.innerWidth).toBe(width);
  const { default: App } = await import('@/App');
  window.history.pushState({}, '', address);
  window.dispatchEvent(new PopStateEvent('popstate'));
  await render(<App />);
}

import axe from 'axe-core';
import { expect } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteError } from '@/components/RouteError';
import { HomePage } from '@/pages/home/HomePage';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';
import { Crash } from './crash';
import { accessibilityTags, missingAddress, type Visitor } from './visitor';

const routes = [
  { path: '/', element: <HomePage /> },
  { path: '*', element: <NotFoundPage /> },
];

/** Throws whatever it is given, even something that is not an error. */
function fail(reason: unknown): never {
  throw reason;
}

/** A visitor whose pages are rendered, one at a time, in the test browser. */
export class InBrowserVisitor implements Visitor {
  async opensTheApp(width: number, address = '/') {
    await page.viewport(width, 800);
    await expect.poll(() => window.innerWidth).toBe(width);
    // The app builds its router once, when it is first loaded, so each visit moves that router to
    // its address the way the browser's back button would.
    const { default: App } = await import('@/App');
    window.history.pushState({}, '', address);
    window.dispatchEvent(new PopStateEvent('popstate'));
    await render(<App />);
  }

  async opensTheNavigationMenu() {
    await userEvent.click(page.getByRole('button', { name: 'Open navigation' }));
  }

  async followsTheHomeLink() {
    await userEvent.click(page.getByRole('link', { name: 'Home', exact: true }));
  }

  async canSeeTheNavigation() {
    await expect.element(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
  }

  async opensAPageThatFailsWithMessage(message: string) {
    await this.opensAFailingPage(() => fail(new Error(message)));
  }

  async opensAPageThatFailsWithStatus(status: number, statusText: string) {
    await this.opensAFailingPage(() => fail(new Response('', { status, statusText })));
  }

  async opensAPageThatFailsWithoutAnExplanation() {
    await this.opensAFailingPage(() => fail('no explanation'));
  }

  async isToldThePageFailedBecause(reason: string) {
    await expect.element(page.getByText('This page failed to load')).toBeVisible();
    await expect.element(page.getByText(reason)).toBeVisible();
  }

  async opensAPageThatCrashesWith(message: string) {
    await render(
      <ErrorBoundary>
        <Crash error={new Error(message)} />
      </ErrorBoundary>
    );
  }

  async opensAPageThatCrashesWithoutATrace(message: string) {
    const error = new Error(message);
    Object.defineProperty(error, 'stack', { value: undefined });
    await render(
      <ErrorBoundary>
        <Crash error={error} />
      </ErrorBoundary>
    );
  }

  async isShownTheCrash(message: string) {
    await expect.element(page.getByText('Application Error')).toBeVisible();
    await expect.element(page.getByText(`Error: ${message}`, { exact: true })).toBeVisible();
  }

  async isShownNoStackTrace() {
    await expect.element(page.getByText('Stack Trace:')).not.toBeInTheDocument();
  }

  private async opensAFailingPage(loader: () => never) {
    const router = createMemoryRouter([{ path: '/', element: <HomePage />, errorElement: <RouteError />, loader }], {
      initialEntries: ['/'],
    });
    await render(<RouterProvider router={router} />);
  }

  async opensTheHomePage() {
    await this.opensAt('/');
  }

  async opensAPageThatDoesNotExist() {
    await this.opensAt(missingAddress);
  }

  async returnsHome() {
    await userEvent.click(page.getByRole('link', { name: 'Back to home' }));
  }

  async isWelcomedToTheApp() {
    await expect.element(page.getByRole('heading', { name: 'Welcome to your Databricks App' })).toBeVisible();
  }

  async isToldThePageWasNotFound() {
    await expect.element(page.getByText('Page not found')).toBeVisible();
    await expect.element(page.getByText(missingAddress)).toBeVisible();
  }

  async canFindTheAppKitDocumentation() {
    await expect
      .element(page.getByRole('link', { name: /AppKit documentation/ }))
      .toHaveAttribute('href', 'https://developers.databricks.com/docs/appkit/v0/');
  }

  async seesNoAccessibilityViolations() {
    const results = await axe.run(document, { runOnly: { type: 'tag', values: accessibilityTags } });
    expect(
      results.violations.map(
        (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`
      )
    ).toEqual([]);
  }

  private async opensAt(address: string) {
    const router = createMemoryRouter(routes, { initialEntries: [address] });
    await render(<RouterProvider router={router} />);
  }
}

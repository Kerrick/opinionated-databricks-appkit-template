import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { accessibilityTags, missingAddress, type Visitor } from './visitor';

/** A visitor driving the whole app in a real browser, over HTTP. */
export class PlaywrightVisitor implements Visitor {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async opensTheHomePage() {
    await this.page.goto('/');
  }

  async opensAPageThatDoesNotExist() {
    await this.page.goto(missingAddress);
  }

  async returnsHome() {
    await this.page.getByRole('link', { name: 'Back to home' }).click();
  }

  async isWelcomedToTheApp() {
    await expect(this.page.getByRole('heading', { level: 1, name: 'Welcome to your Databricks App' })).toBeVisible();
  }

  async isToldThePageWasNotFound() {
    await expect(this.page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(this.page.getByText(missingAddress)).toBeVisible();
  }

  async canFindTheAppKitDocumentation() {
    await expect(this.page.getByRole('link', { name: /AppKit documentation/ })).toHaveAttribute(
      'href',
      'https://developers.databricks.com/docs/appkit/v0/'
    );
  }

  async seesNoAccessibilityViolations() {
    // Judge the page at rest: the pointer is still where the last click left it, and a hovered link
    // is drawn in other colors.
    await this.page.mouse.move(0, 0);
    // A color that is still changing is no color to judge.
    await this.page.waitForFunction(() => document.getAnimations().length === 0);
    const results = await new AxeBuilder({ page: this.page }).withTags(accessibilityTags).analyze();
    expect(
      results.violations.map(
        (violation) =>
          `${violation.id}: ${violation.nodes.map((node) => `${node.target.join(' ')} (${node.any.map((check) => check.message).join('; ')})`).join(', ')}`
      )
    ).toEqual([]);
  }
}

import { defineNetworkFixture, type NetworkFixture } from '@msw/playwright';
import { expect } from '@playwright/test';
import { createBdd, test as base } from 'playwright-bdd';
import { createFakes } from '../mocks/fakes';
import { PlaywrightVisitor } from '../tasks/through-playwright';
import type { Visitor } from '../tasks/visitor';

interface Fixtures {
  network: NetworkFixture;
  visitor: Visitor;
}

/**
 * Journeys against the built app fake what the browser asks `/api/` for. Set
 * `JOURNEY_TARGET=deployed` to run the same journeys against a real
 * deployment, with nothing faked.
 */
const fakeNetwork = process.env['JOURNEY_TARGET'] !== 'deployed';

export const test = base.extend<Fixtures>({
  network: [
    async ({ context }, use) => {
      const fakes = createFakes();
      const network = defineNetworkFixture({ context, handlers: [...fakes.handlers] });
      if (fakeNetwork) await network.enable();
      await use(network);
      if (fakeNetwork) await network.disable();
      expect(fakes.unfaked, 'requests to /api/ that no scenario faked').toEqual([]);
    },
    { auto: true },
  ],
  visitor: async ({ page }, use) => {
    await use(new PlaywrightVisitor(page));
  },
});

const { Given, When, Then } = createBdd(test);

Given('a visitor', () => {
  // Every scenario starts with its own visitor, created by the fixture.
});

When('they open the home page', ({ visitor }) => visitor.opensTheHomePage());
When('they open a page that does not exist', ({ visitor }) => visitor.opensAPageThatDoesNotExist());
When('they return home', ({ visitor }) => visitor.returnsHome());

Then('they are welcomed to the app', ({ visitor }) => visitor.isWelcomedToTheApp());
Then('they are told the page was not found', ({ visitor }) => visitor.isToldThePageWasNotFound());
Then('they can find the AppKit documentation', ({ visitor }) => visitor.canFindTheAppKitDocumentation());
Then('the page has no accessibility violations', ({ visitor }) => visitor.seesNoAccessibilityViolations());

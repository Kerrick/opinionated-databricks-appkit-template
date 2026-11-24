/**
 * What a visitor can accomplish, named for the goal rather than for the
 * controls used to reach it. Step definitions at every test level call only
 * these, so a level can change how it reaches a goal (a page rendered in the
 * test browser, or the built app driven over HTTP) without any scenario
 * changing.
 */
export interface Visitor {
  opensTheHomePage(): Promise<void>;
  opensAPageThatDoesNotExist(): Promise<void>;
  returnsHome(): Promise<void>;
  isWelcomedToTheApp(): Promise<void>;
  isToldThePageWasNotFound(): Promise<void>;
  canFindTheAppKitDocumentation(): Promise<void>;
  seesNoAccessibilityViolations(): Promise<void>;
}

/** The standards the accessibility checks hold every page to. */
export const accessibilityTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Rules that belong to none of the standards above but that every page is held to as well. A page
 * without a top-level heading leaves a screen reader's user no way to learn what the page is.
 */
export const accessibilityRules = { 'page-has-heading-one': { enabled: true } };

/** An address no route serves. */
export const missingAddress = '/there-is-no-page-here';

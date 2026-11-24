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

/** An address no route serves. */
export const missingAddress = '/there-is-no-page-here';

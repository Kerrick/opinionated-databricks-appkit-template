import { Given, QuickPickleWorld, Then, When, setWorldConstructor } from 'quickpickle';
import '../../client/src/index.css';
import '../mocks/browser-network';
import { missingAddress } from '../tasks/visitor';
import { InBrowserVisitor } from '../tasks/in-browser';

class PageWorld extends QuickPickleWorld {
  readonly visitor = new InBrowserVisitor();
}

setWorldConstructor(PageWorld);

Given('a visitor', () => {
  // Every scenario starts with its own visitor, created by the world.
});

When('they open the home page', ({ visitor }: PageWorld) => visitor.opensTheHomePage());
When('they open a page that does not exist', ({ visitor }: PageWorld) => visitor.opensAPageThatDoesNotExist());
When('they return home', ({ visitor }: PageWorld) => visitor.returnsHome());

Then('they are welcomed to the app', ({ visitor }: PageWorld) => visitor.isWelcomedToTheApp());
Then('they are told the page was not found', ({ visitor }: PageWorld) => visitor.isToldThePageWasNotFound());
Then('they can find the AppKit documentation', ({ visitor }: PageWorld) => visitor.canFindTheAppKitDocumentation());
Then('the page has no accessibility violations', ({ visitor }: PageWorld) => visitor.seesNoAccessibilityViolations());

When('they open the app on a screen {int} pixels wide', ({ visitor }: PageWorld, width: number) =>
  visitor.opensTheApp(width)
);
When('they open the app at a missing address on a screen {int} pixels wide', ({ visitor }: PageWorld, width: number) =>
  visitor.opensTheApp(width, missingAddress)
);
When('they open the navigation menu', ({ visitor }: PageWorld) => visitor.opensTheNavigationMenu());
When('they follow the link home', ({ visitor }: PageWorld) => visitor.followsTheHomeLink());
When('they open a page that fails with the message {string}', ({ visitor }: PageWorld, message: string) =>
  visitor.opensAPageThatFailsWithMessage(message)
);
When(
  'they open a page that fails with the response {int} {string}',
  ({ visitor }: PageWorld, status: number, statusText: string) =>
    visitor.opensAPageThatFailsWithStatus(status, statusText)
);
When('they open a page that fails without saying why', ({ visitor }: PageWorld) =>
  visitor.opensAPageThatFailsWithoutAnExplanation()
);
When('they open a page that crashes with the error {string}', ({ visitor }: PageWorld, message: string) =>
  visitor.opensAPageThatCrashesWith(message)
);
When(
  'they open a page that crashes with an error that has no trace {string}',
  ({ visitor }: PageWorld, message: string) => visitor.opensAPageThatCrashesWithoutATrace(message)
);

Then('they can see the navigation', ({ visitor }: PageWorld) => visitor.canSeeTheNavigation());
Then('they are told the page failed to load because {string}', ({ visitor }: PageWorld, reason: string) =>
  visitor.isToldThePageFailedBecause(reason)
);
Then('they are shown the crash {string}', ({ visitor }: PageWorld, message: string) =>
  visitor.isShownTheCrash(message)
);
Then('they are shown no stack trace', ({ visitor }: PageWorld) => visitor.isShownNoStackTrace());

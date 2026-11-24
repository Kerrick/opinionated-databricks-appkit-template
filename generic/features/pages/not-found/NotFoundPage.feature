Feature: Page not found
  A visitor who follows a stale or mistyped address is told so, and can get
  back to the start.

  Scenario: A visitor who reaches a missing page can return home
    Given a visitor
    When they open a page that does not exist
    Then they are told the page was not found
    And the page has no accessibility violations
    When they return home
    Then they are welcomed to the app

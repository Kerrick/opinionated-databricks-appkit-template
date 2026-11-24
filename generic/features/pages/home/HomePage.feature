Feature: Home page
  A visitor who opens the app lands on a page that says where they are and
  where to learn more.

  Scenario: A visitor is welcomed and pointed to the AppKit resources
    Given a visitor
    When they open the home page
    Then they are welcomed to the app
    And they can find the AppKit documentation
    And the page has no accessibility violations

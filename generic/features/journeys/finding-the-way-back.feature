Feature: Finding the way back
  A visitor who lands somewhere unexpected is never stranded.

  @smoke
  Scenario: A visitor reaches the running app
    Given a visitor
    When they open the home page
    Then they are welcomed to the app

  Scenario: A visitor who hits a dead end gets back to the start
    Given a visitor
    When they open a page that does not exist
    Then they are told the page was not found
    And the page has no accessibility violations
    When they return home
    Then they are welcomed to the app
    And the page has no accessibility violations

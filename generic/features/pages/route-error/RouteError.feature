Feature: A page that fails to load
  When a page cannot load, the visitor is told why and is not left on a blank screen.

  Scenario: The page fails with a message
    Given a visitor
    When they open a page that fails with the message "The warehouse is stopped"
    Then they are told the page failed to load because "The warehouse is stopped"
    And the page has no accessibility violations

  Scenario: The page fails with an error response
    Given a visitor
    When they open a page that fails with the response 503 "Service Unavailable"
    Then they are told the page failed to load because "503 Service Unavailable"

  Scenario: The page fails without saying why
    Given a visitor
    When they open a page that fails without saying why
    Then they are told the page failed to load because "Something went wrong."

Feature: An app that crashes
  When something breaks while a page is drawn, the visitor sees what went wrong instead of a blank screen.

  Scenario: The crash is shown with its trace
    Given a visitor
    When they open a page that crashes with the error "The chart could not be drawn"
    Then they are shown the crash "The chart could not be drawn"

  Scenario: The crash is shown when the error carries no trace
    Given a visitor
    When they open a page that crashes with an error that has no trace "No trace was kept"
    Then they are shown the crash "No trace was kept"
    And they are shown no stack trace

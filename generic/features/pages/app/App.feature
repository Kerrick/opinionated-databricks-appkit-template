Feature: Moving around the app
  The app's navigation is always within reach, on a wide screen and on a phone.

  Scenario: A visitor on a wide screen sees the navigation and can go home
    Given a visitor
    When they open the app on a screen 1280 pixels wide
    Then they can see the navigation
    When they follow the link home
    Then they are welcomed to the app

  Scenario: A visitor on a phone opens the menu to go home
    Given a visitor
    When they open the app on a screen 400 pixels wide
    And they open the navigation menu
    And they follow the link home
    Then they are welcomed to the app

  Scenario: A visitor at a missing address still sees the navigation and can go home
    Given a visitor
    When they open the app at a missing address on a screen 1280 pixels wide
    Then they can see the navigation
    When they follow the link home
    Then they are welcomed to the app

  Scenario: A visitor on a phone at a missing address opens the menu to go home
    Given a visitor
    When they open the app at a missing address on a screen 400 pixels wide
    And they open the navigation menu
    And they follow the link home
    Then they are welcomed to the app

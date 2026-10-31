Feature: Service order saga
  An order only reaches the workshop floor after the customer approved and paid,
  and every step already taken is undone when the order stops.

  Background:
    Given a customer with a vehicle
    And a catalog service "Oil change" priced at 120.00
    And an item "Oil filter" priced at 30.00 with 5 units in stock

  Scenario: Customer rejects the budget
    Given an order waiting for approval with 1 "Oil filter" reserved
    When the customer rejects the budget
    Then the order is "REJECTED"
    And "Oil filter" has 0 reserved
    And execution was asked to cancel the order

  Scenario: Payment is refused
    Given an approved order with 1 "Oil filter" reserved
    When the payment is refused
    Then the order is "CANCELLED"
    And "Oil filter" has 0 reserved
    And execution was asked to cancel the order
    And billing was asked to cancel the budget

  Scenario: Budget generation keeps failing
    Given an order waiting for approval with 1 "Oil filter" reserved
    When the budget request exhausts its retries
    Then the order is "CANCELLED"
    And "Oil filter" has 0 reserved
    And execution was asked to cancel the order

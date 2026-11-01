Feature: Service order journey across the three services
  The OS, Billing and Execution services run for real, talking only through
  the saga queues. Payment uses the simulated provider.

  Background:
    Given the shop has a customer with a vehicle, the service "Oil change" and 5 "Oil filter" in stock

  Scenario: A paid order is repaired
    Given an attendant opened an order with "Oil change" and 1 "Oil filter"
    When the order goes through diagnosis, customer approval, payment and repair
    Then the OS service eventually shows the order as "FINISHED"
    And billing shows the payment as "APPROVED"
    And execution shows the repair as "DONE"

  Scenario: A refused payment undoes the order
    Given an order whose budget the customer approved
    When the payment is refused
    Then the OS service eventually shows the order as "CANCELLED"
    And "Oil filter" has 0 reserved
    And billing shows the budget as "CANCELLED"
    And execution shows the order as "CANCELLED"

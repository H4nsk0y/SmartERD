# language: en
Feature: Entity name validation
  As a data modeler
  I want entity names to be unique regardless of case
  So that the model has no ambiguity and generated schema stays consistent

  @imperative
  Scenario: Duplicate names — User vs user (imperative)
    Given I have an entity "User"
    And I have an entity "user"
    When I validate the model
    Then issue "DUP_ENTITY_NAME" is present
    And ok equals false

  @declarative
  Scenario: Duplicate names via data table (declarative)
    Given the following entities exist:
      | name |
      | User |
      | user |
    When I validate the model
    Then issue "DUP_ENTITY_NAME" is present
    And ok equals false

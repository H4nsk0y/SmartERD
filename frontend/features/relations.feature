# language: en
Feature: Валидация связей
  As a data modeler
  I want the validator to enforce FK type compatibility and 1:1 uniqueness
  So that generated SQL constraints are correct and unambiguous

  Background:
    Given there is an entity "Left" with PK "UUID"

  Rule: Ограничения для 1:1
    Background:
      Given there is an entity "Right" with PK "UUID"

    @declarative
    Scenario: 1:1 добавляет UNIQUE на FK (декларативно)
      Given a one-to-one relation between "Left" and "Right"
      When I validate the model
      Then issue "ONE_TO_ONE_UNIQUE" is present
      And ok equals true
      But issue "FK_TYPE_MISMATCH" is absent

  @imperative
  Scenario: 1:N без явного FK вызывает предупреждение (императивно)
    When I add an entity "Book" with attribute "title" of type "TEXT"
    And I create a one-to-many relation between "Left" and "Book"
    And I validate the model
    Then issue "FK_WILL_BE_ADDED" is present
    And ok equals true
    But issue "ONE_TO_ONE_UNIQUE" is absent

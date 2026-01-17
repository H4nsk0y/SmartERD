# language: en
Feature: Совместимость типов внешних ключей
  As a data modeler
  I want the validator to flag FK type mismatches and accept compatible pairs
  So that joins in the generated SQL are consistent and safe

  Background:
    Given there is an entity "A_uuid" with PK "UUID"
    And there is an entity "B_int" with PK "INT"
    And there is an entity "C_uuid" with PK "UUID"

  Rule: Тип FK должен совпадать с типом PK целевой сущности

  @imperative
  Scenario: Несовместимые типы FK (UUID -> INT) вызывают ошибку
    Given a one-to-one relation between "A_uuid" and "B_int"
    When I validate the model
    Then issue "FK_TYPE_MISMATCH" is present
    And ok equals false

  @declarative
  Scenario: Совместимые типы FK (UUID -> UUID) проходят без ошибки
    Given a one-to-one relation between "A_uuid" and "C_uuid"
    When I validate the model
    Then issue "FK_TYPE_MISMATCH" is absent
    And ok equals true

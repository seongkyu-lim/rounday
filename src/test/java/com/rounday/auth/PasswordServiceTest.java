package com.rounday.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class PasswordServiceTest {
  private final PasswordService passwordService = new PasswordService();

  @Test
  void verifiesMatchingPasswordOnly() {
    PasswordService.PasswordHash passwordHash = passwordService.hash("rounday-secret");

    assertTrue(passwordService.verify("rounday-secret", passwordHash.salt(), passwordHash.hash()));
    assertFalse(passwordService.verify("wrong-secret", passwordHash.salt(), passwordHash.hash()));
    assertNotEquals("rounday-secret", passwordHash.hash());
  }

  @Test
  void createsUniqueSaltsForSamePassword() {
    PasswordService.PasswordHash first = passwordService.hash("rounday-secret");
    PasswordService.PasswordHash second = passwordService.hash("rounday-secret");

    assertNotEquals(first.salt(), second.salt());
    assertNotEquals(first.hash(), second.hash());
  }
}

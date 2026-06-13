package com.rounday.auth;

import java.security.MessageDigest;
import java.util.HexFormat;

final class MessageDigestSupport {
  private MessageDigestSupport() {}

  static boolean constantTimeEquals(String actualHex, String expectedHex) {
    try {
      return MessageDigest.isEqual(HexFormat.of().parseHex(actualHex), HexFormat.of().parseHex(expectedHex));
    } catch (IllegalArgumentException error) {
      return false;
    }
  }
}

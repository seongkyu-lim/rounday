package com.rounday.auth;

import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.HexFormat;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.springframework.stereotype.Service;

@Service
public class PasswordService {
  private static final int ITERATIONS = 120_000;
  private static final int KEY_LENGTH = 256;
  private final SecureRandom random = new SecureRandom();

  public PasswordHash hash(String password) {
    byte[] salt = new byte[16];
    random.nextBytes(salt);
    return new PasswordHash(HexFormat.of().formatHex(salt), derive(password, salt));
  }

  public boolean verify(String password, String saltHex, String expectedHash) {
    byte[] salt = HexFormat.of().parseHex(saltHex);
    String actualHash = derive(password, salt);
    return MessageDigestSupport.constantTimeEquals(actualHash, expectedHash);
  }

  private String derive(String password, byte[] salt) {
    try {
      PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_LENGTH);
      byte[] hash = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
      return HexFormat.of().formatHex(hash);
    } catch (NoSuchAlgorithmException | InvalidKeySpecException error) {
      throw new IllegalStateException("Password hashing is not available", error);
    }
  }

  public record PasswordHash(String salt, String hash) {}
}

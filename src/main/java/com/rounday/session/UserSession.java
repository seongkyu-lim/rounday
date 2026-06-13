package com.rounday.session;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "rounday_sessions", indexes = @Index(name = "idx_rounday_sessions_user_id", columnList = "user_id"))
public class UserSession {
  @Id
  @Column(length = 96)
  private String token;

  @Column(name = "user_id", nullable = false, length = 64)
  private String userId;

  @Column(nullable = false)
  private Instant expiresAt;

  public String getToken() {
    return token;
  }

  public void setToken(String token) {
    this.token = token;
  }

  public String getUserId() {
    return userId;
  }

  public void setUserId(String userId) {
    this.userId = userId;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(Instant expiresAt) {
    this.expiresAt = expiresAt;
  }
}

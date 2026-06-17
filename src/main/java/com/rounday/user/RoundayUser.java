package com.rounday.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "rounday_users")
public class RoundayUser {
  @Id
  @Column(length = 64)
  private String id;

  @Column(nullable = false, unique = true, length = 255)
  private String email;

  @Column(nullable = false, length = 64)
  private String passwordSalt;

  @Column(nullable = false, length = 64)
  private String passwordHash;

  @Column(nullable = false)
  private Instant createdAt;

  @Column(nullable = false)
  private Instant signedInAt;

  @Column(columnDefinition = "json")
  private String scheduleState;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getPasswordSalt() {
    return passwordSalt;
  }

  public void setPasswordSalt(String passwordSalt) {
    this.passwordSalt = passwordSalt;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public void setPasswordHash(String passwordHash) {
    this.passwordHash = passwordHash;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }

  public Instant getSignedInAt() {
    return signedInAt;
  }

  public void setSignedInAt(Instant signedInAt) {
    this.signedInAt = signedInAt;
  }

  public String getScheduleState() {
    return scheduleState;
  }

  public void setScheduleState(String scheduleState) {
    this.scheduleState = scheduleState;
  }
}

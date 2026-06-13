package com.rounday.user;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoundayUserRepository extends JpaRepository<RoundayUser, String> {
  Optional<RoundayUser> findByEmail(String email);
}

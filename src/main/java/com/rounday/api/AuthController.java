package com.rounday.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.rounday.auth.PasswordService;
import com.rounday.session.UserSession;
import com.rounday.session.UserSessionRepository;
import com.rounday.user.RoundayUser;
import com.rounday.user.RoundayUserRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AuthController {
  private static final String SESSION_COOKIE = "rounday_session";
  private static final Duration SESSION_TTL = Duration.ofDays(14);
  private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

  private final ObjectMapper objectMapper;
  private final PasswordService passwordService;
  private final RoundayUserRepository users;
  private final UserSessionRepository sessions;
  private final SecureRandom random = new SecureRandom();

  public AuthController(
      ObjectMapper objectMapper,
      PasswordService passwordService,
      RoundayUserRepository users,
      UserSessionRepository sessions) {
    this.objectMapper = objectMapper;
    this.passwordService = passwordService;
    this.users = users;
    this.sessions = sessions;
  }

  @GetMapping("/session")
  public Map<String, Object> session(HttpServletRequest request) {
    return currentUser(request)
        .map((user) -> sessionPayload(user, readState(user)))
        .orElseGet(() -> sessionPayload(null, null));
  }

  @PostMapping("/login")
  public ResponseEntity<Map<String, Object>> login(@RequestBody LoginRequest request) {
    String email = normalizeEmail(request.email());
    if (!EMAIL.matcher(email).matches() || request.password() == null || request.password().length() < 6) {
      return ResponseEntity.badRequest().body(Map.of("error", "이메일과 6자 이상 비밀번호를 입력하세요."));
    }

    RoundayUser user = users.findByEmail(email).orElseGet(() -> createUser(email, request.password()));
    if (!passwordService.verify(request.password(), user.getPasswordSalt(), user.getPasswordHash())) {
      return ResponseEntity.status(401).body(Map.of("error", "비밀번호가 올바르지 않습니다."));
    }

    user.setSignedInAt(Instant.now());
    if (user.getScheduleState() == null && request.state() != null && !request.state().isNull()) {
      user.setScheduleState(writeState(user, request.state()));
    }
    users.save(user);

    UserSession session = new UserSession();
    session.setToken(randomToken());
    session.setUserId(user.getId());
    session.setExpiresAt(Instant.now().plus(SESSION_TTL));
    sessions.save(session);

    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, sessionCookie(session.getToken(), SESSION_TTL).toString())
        .body(sessionPayload(user, readState(user)));
  }

  @PostMapping("/logout")
  public ResponseEntity<Map<String, Object>> logout(HttpServletRequest request) {
    readCookie(request).ifPresent(sessions::deleteById);
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, clearSessionCookie().toString())
        .body(Map.of("ok", true));
  }

  @PutMapping("/state")
  public ResponseEntity<Map<String, Object>> saveState(HttpServletRequest request, @RequestBody SaveStateRequest body) {
    Optional<RoundayUser> maybeUser = currentUser(request);
    if (maybeUser.isEmpty()) {
      return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다."));
    }
    if (body.state() == null || body.state().isNull()) {
      return ResponseEntity.badRequest().body(Map.of("error", "저장할 데이터가 없습니다."));
    }

    RoundayUser user = maybeUser.get();
    user.setScheduleState(writeState(user, body.state()));
    users.save(user);
    JsonNode state = readState(user);
    return ResponseEntity.ok(Map.of("ok", true, "savedAt", state.path("sync").path("lastSyncedAt").asText(), "state", state));
  }

  private RoundayUser createUser(String email, String password) {
    PasswordService.PasswordHash passwordHash = passwordService.hash(password);
    RoundayUser user = new RoundayUser();
    user.setId(userIdFor(email));
    user.setEmail(email);
    user.setPasswordSalt(passwordHash.salt());
    user.setPasswordHash(passwordHash.hash());
    user.setCreatedAt(Instant.now());
    user.setSignedInAt(Instant.now());
    return users.save(user);
  }

  private Optional<RoundayUser> currentUser(HttpServletRequest request) {
    return readCookie(request)
        .flatMap(sessions::findById)
        .filter((session) -> session.getExpiresAt().isAfter(Instant.now()))
        .flatMap((session) -> users.findById(session.getUserId()));
  }

  private Optional<String> readCookie(HttpServletRequest request) {
    Cookie[] cookies = request.getCookies();
    if (cookies == null) return Optional.empty();
    for (Cookie cookie : cookies) {
      if (SESSION_COOKIE.equals(cookie.getName())) return Optional.of(cookie.getValue());
    }
    return Optional.empty();
  }

  private JsonNode readState(RoundayUser user) {
    if (user.getScheduleState() == null) return null;
    try {
      return objectMapper.readTree(user.getScheduleState());
    } catch (Exception error) {
      return null;
    }
  }

  private String writeState(RoundayUser user, JsonNode state) {
    ObjectNode copy = state.deepCopy();
    copy.put("userId", user.getId());
    ObjectNode account = copy.putObject("account");
    account.put("email", user.getEmail());
    account.put("signedInAt", user.getSignedInAt().toString());
    ObjectNode sync = copy.putObject("sync");
    sync.put("provider", "server");
    sync.put("lastSyncedAt", Instant.now().toString());
    if (!copy.hasNonNull("updatedAt")) copy.put("updatedAt", Instant.now().toString());
    try {
      return objectMapper.writeValueAsString(copy);
    } catch (Exception error) {
      throw new IllegalArgumentException("저장할 수 없는 데이터입니다.", error);
    }
  }

  private Map<String, String> publicUser(RoundayUser user) {
    return Map.of("id", user.getId(), "email", user.getEmail(), "signedInAt", user.getSignedInAt().toString());
  }

  private Map<String, Object> sessionPayload(RoundayUser user, JsonNode state) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("user", user == null ? null : publicUser(user));
    payload.put("state", state);
    return payload;
  }

  private String normalizeEmail(String email) {
    return email == null ? "" : email.trim().toLowerCase();
  }

  private String userIdFor(String email) {
    byte[] digest;
    try {
      digest = MessageDigest.getInstance("SHA-256").digest(email.getBytes(StandardCharsets.UTF_8));
    } catch (Exception error) {
      throw new IllegalStateException("SHA-256 is not available", error);
    }
    return HexFormat.of().formatHex(digest).substring(0, 24);
  }

  private String randomToken() {
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    return HexFormat.of().formatHex(bytes);
  }

  private ResponseCookie sessionCookie(String token, Duration maxAge) {
    return ResponseCookie.from(SESSION_COOKIE, token)
        .httpOnly(true)
        .sameSite("Lax")
        .path("/")
        .maxAge(maxAge)
        .build();
  }

  private ResponseCookie clearSessionCookie() {
    return ResponseCookie.from(SESSION_COOKIE, "")
        .httpOnly(true)
        .sameSite("Lax")
        .path("/")
        .maxAge(Duration.ZERO)
        .build();
  }

  public record LoginRequest(String email, String password, JsonNode state) {}

  public record SaveStateRequest(JsonNode state) {}
}

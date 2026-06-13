# Rounday

원형 24시간 시간표를 만들고 관리하는 웹앱입니다. 로컬 저장으로 바로 쓸 수 있고, Spring Boot 서버와 MySQL을 함께 실행하면 계정별 데이터 보관을 사용할 수 있습니다.

## 기능

- 24시간 원형 시계 뷰
- 일정 추가, 수정, 삭제
- 자정 넘김 일정 지원
- 겹치는 일정 표시
- 계획 시간, 빈 시간, 블록 수 통계
- 학생/메이커 템플릿
- 브라우저 로컬 저장
- 이메일/비밀번호 계정
- Spring Boot API 기반 개인 시간표 저장
- MySQL 계정/세션/시간표 데이터 보관
- JSON 내보내기

## 실행

계정 저장 없이 로컬로만 쓰려면 브라우저에서 `index.html`을 열면 됩니다.

계정 기능과 MySQL 저장을 같이 쓰려면 Docker Compose로 실행합니다.

```bash
docker compose up --build
```

그다음 `http://localhost:18080`을 엽니다.

로컬 MySQL이 이미 있다면 Spring Boot만 직접 실행할 수도 있습니다.

```bash
mvn spring-boot:run
```

Spring Boot 서버는 Java 21 이상에서 실행합니다.

기본 DB 설정은 다음과 같습니다.

- JDBC URL: `jdbc:mysql://localhost:3306/rounday`
- username: `rounday`
- password: `rounday`

환경변수 `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`로 바꿀 수 있습니다.

Docker Compose 실행 시 호스트 포트는 다른 프로젝트와 겹치지 않도록 앱 `18080`, MySQL `13306`을 사용합니다.

## 검증

```bash
npm test
node --check app.js
mvn test
```

## 배포

현재 private repository 플랜에서는 GitHub Pages가 지원되지 않을 수 있습니다.
배포 전 검증 workflow는 `.github/workflows/ci.yml`에 포함되어 있습니다.

# Rounday

원형 24시간 시간표를 만들고 관리하는 정적 웹앱 MVP입니다.

## 기능

- 24시간 원형 시계 뷰
- 일정 추가, 수정, 삭제
- 자정 넘김 일정 지원
- 겹치는 일정 표시
- 계획 시간, 빈 시간, 블록 수 통계
- 학생/메이커 템플릿
- 브라우저 로컬 저장
- JSON 내보내기

## 실행

브라우저에서 `index.html`을 열면 됩니다.

## 검증

```bash
npm test
node --check app.js
```

## GitHub 저장 설정

Rounday는 GitHub OAuth PKCE 로그인 후 사용자가 선택한 repo에 날짜별 JSON을 저장할 수 있습니다.

1. GitHub OAuth App을 생성합니다.
2. Authorization callback URL은 배포된 `index.html` 경로와 동일하게 맞춥니다.
3. `config.example.js`를 `config.js`로 복사하고 `githubClientId`를 입력합니다.
4. `config.js`는 commit하지 않습니다.

앱 안에서 Client ID를 직접 입력해도 됩니다. 저장 파일은 `data/schedules/YYYY/MM/YYYY-MM-DD.json` 경로에 commit됩니다.

## 배포

GitHub Pages 배포 workflow는 `.github/workflows/pages.yml`에 포함되어 있습니다.
배포 전 검증 workflow는 `.github/workflows/ci.yml`에 포함되어 있습니다.

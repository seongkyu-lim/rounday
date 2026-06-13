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

## 배포

GitHub Pages workflow는 `.github/workflows/pages.yml`에 포함되어 있습니다.

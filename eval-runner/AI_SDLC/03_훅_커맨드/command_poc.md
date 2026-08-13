# RemoteView POC 이어서 작업

이 프로젝트는 RemoteView(알뷰) 실제 Java 소스 기반으로 Node.js + MariaDB로 구현한 로컬 어드민 콘솔 POC입니다.

## 작업 디렉토리
`/Users/nanheekim/KMS/rview-cli-poc/alview-cli-poc/`

## 규칙
- `/Users/nanheekim/KMS/rview-cli-poc/` 원본 소스는 읽기 전용
- 수정은 `alview-cli-poc/` 하위만
- 작업 전 한국어로 의도 설명

## 현재 상태 확인 방법
1. `cat CLAUDE.md` — 전체 프로젝트 컨텍스트
2. `git log --oneline -5` — 최근 커밋 이력
3. `docker ps | grep mariadb` — DB 실행 여부
4. `curl -s http://localhost:4000/api/users -H "Authorization: Bearer mock-token-rvpoc-2026"` — 서버 동작 확인

## 서버 시작
```bash
cd /Users/nanheekim/KMS/rview-cli-poc/alview-cli-poc
npx ts-node server.ts
```

CLAUDE.md를 읽고 현재 상태(서버 실행 여부, DB 연결 여부)를 확인한 다음, 사용자의 요청을 기다려주세요.

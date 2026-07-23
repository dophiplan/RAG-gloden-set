# GATE_GSBATCH_RC2_6차 — 사람 게이트

- 발행: 2026-07-23T13:53:08 · 제품: RC2 · 단계: ④ 골든셋 배치

## 무엇을 / 왜 멈췄나
6차 생성·검수 완료 — 사람 게이트

## 실측 수치
- 배치: RC2_골든셋_6차_42문항_v1_0.xlsx
- 문항: 42
- 검수 7종: PASS
- 직접 커버 누계: 317
- 잔여: 563
- 미커버 반환: 33단위 — 응답 절단 추정, 다음 차수 재출제 (예: ['RC2-HTTPSF-009', 'RC2-HTTPSF-017', 'RC2-HTTPSF-026'])

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
승인 시 다음 차수 / 잔여 0이면 배치 마감으로

### 👀 사람 확인 가이드 — 기계가 못 보는 것만 보면 됩니다 (표본 검사, 전건 검토 불필요)
1. 아래 표본의 **질문이 실제 고객이 물어볼 법한 말**인가요? (내부 용어·번역투면 반려)
2. **정답이 질문에 대한 답**인가요? (동문서답·과잉 서술 확인)
3. 정답의 **'필수:' 요소가 합리적**인가요? (너무 많으면 채점이 가혹, 너무 적으면 무의미)
4. 전체 문항은 ④ 자료실에서 `RC2_골든셋_6차_42문항_v1_0.xlsx` [받기]

⚠ 이 배치 특이사항: 미커버 33단위는 다음 차수가 자동 재출제 — 승인에 영향 없음

어색한 문항이 있으면 [반려] + 사유에 문항 ID를 적어주세요 — 그 피드백대로 재출제됩니다.

### 표본 문항 (유형별 1개, 자동 발췌)
**[RC2-329] (사실형)**
- 질문: 리모트콜의 '종료하기'는 무엇을 할 수 있는가?
- 정답: 상담을 종료할 수 있다.
필수: 종료하기, 상담 종료
- 출처: RC2-HTTPSF-1028 ; https://files.rsupport.com/ko/remotecall/guides/Remo

**[RC2-344] (열거형)**
- 질문: 리모트콜 WebViewer가 지원하는 브라우저와 OS는 무엇인가?
- 정답: 브라우저는 Chrome, Edge(Chromium), Safari, firefox, opera, samsung Browser, whale(이외 미지원), OS는 Windows, MacOS, Android, iOS, Chromium OS(이 외 미지원)
- 출처: RC2-HTTPSF-1105 ; https://files.rsupport.com/ko/remotecall/guides/Remo

**[RC2-337] (절차형)**
- 질문: 리모트콜에서 비밀번호 변경 절차는 어떻게 되는가?
- 정답: 사용자 메뉴 클릭 → 패스워드를 변경할 ID 선택 → 비밀번호 변경 버튼 클릭 → 회사옵션정보의 비밀번호 보안 단계에 따라 새 비밀번호 입력 → 입력 폼에 각각 입력 후 저장 버튼 클릭.
필수: 사용자 메뉴, ID 선택, 비밀번호 변경 버튼, 저장 버
- 출처: RC2-HTTPSF-1055 ; https://files.rsupport.com/ko/remotecall/guides/Remo

**[RC2-331] (정의형)**
- 질문: 리모트콜에서 고객이 중계페이지에서 입력하는 '접속 코드'는 무엇인가?
- 정답: 원격지원 연결을 위해 고객이 중계페이지에서 입력하는 숫자이다.
필수: 원격지원 연결, 중계페이지, 숫자
- 출처: RC2-HTTPSF-344 ; https://files.rsupport.com/ko/remotecall/guides/Remot

**[RC2-322] (조건형)**
- 질문: 리모트콜에서 녹화 기능을 사용하기 위해 필요한 것은 무엇인가?
- 정답: 사용 권한 설정 및 별도 확장프로그램(Extension) 설치가 필요하다.
필수: 사용 권한 설정, 확장프로그램(Extension) 설치
- 출처: RC2-HTTPSF-332 ; https://files.rsupport.com/ko/remotecall/guides/Remot

## 재개
- 승인: `python3 tools/pipeline.py approve GSBATCH_RC2_6차`
- 반려: `python3 tools/pipeline.py reject GSBATCH_RC2_6차 --reason "..."` (사유 필수)

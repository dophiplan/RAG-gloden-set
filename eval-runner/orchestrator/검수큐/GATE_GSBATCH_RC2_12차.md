# GATE_GSBATCH_RC2_12차 — 사람 게이트

- 발행: 2026-07-23T18:30:43 · 제품: RC2 · 단계: ④ 골든셋 배치

## 무엇을 / 왜 멈췄나
12차 생성·검수 완료 — 사람 게이트

## 실측 수치
- 배치: RC2_골든셋_12차_75문항_v1_0.xlsx
- 문항: 75
- 검수 7종: PASS
- 직접 커버 누계: 703
- 잔여: 177

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
승인 시 다음 차수 / 잔여 0이면 배치 마감으로

### 👀 사람 확인 가이드 — 기계가 못 보는 것만 보면 됩니다 (표본 검사, 전건 검토 불필요)
1. 아래 표본의 **질문이 실제 고객이 물어볼 법한 말**인가요? (내부 용어·번역투면 반려)
2. **정답이 질문에 대한 답**인가요? (동문서답·과잉 서술 확인)
3. 정답의 **'필수:' 요소가 합리적**인가요? (너무 많으면 채점이 가혹, 너무 적으면 무의미)
4. 전체 문항은 ④ 자료실에서 `RC2_골든셋_12차_75문항_v1_0.xlsx` [받기]

어색한 문항이 있으면 [반려] + 사유에 문항 ID를 적어주세요 — 그 피드백대로 재출제됩니다.

### 표본 문항 (유형별 1개, 자동 발췌)
**[RC2-635] (가격조회)**
- 질문: 리모트콜 Professional 상품의 주문 가격은 얼마인가요?
- 정답: 가격은 170,000원입니다.
필수: 170,000원
- 출처: RC2-HTTPSW-1640 ; https://www.remotecall.com/kr/store/product/?prd=pro

**[RC2-632] (기능조회)**
- 질문: 리모트콜 비주얼팩이 제공하는 커뮤니케이션 채팅 기능 두 가지는 무엇인가요?
- 정답: 문자 채팅과 음성 채팅입니다.
필수: 문자 채팅, 음성 채팅
- 출처: RC2-HTTPSW-1621 ; https://www.remotecall.com/kr/purchase/pricing/

**[RC2-657] (날짜확인)**
- 질문: 리모트콜(RemoteCall)의 4차산업혁명 페스티벌 외부행사안내에 기재된 일자는 언제인가요?
- 정답: 외부행사안내 2020년 12월 7일 입니다.
필수: 2020년 12월 7일
- 출처: RC2-HTTPSW-1747 ; https://www.remotecall.com/kr/support/notices/event/

**[RC2-691] (단순사실형)**
- 질문: 리모트콜(알서포트) AIR 챌린지 이벤트에서 모집한 아이디어의 주제는 무엇인가요?
- 정답: AI X 원격 아이디어를 모집한 알서포트 AIR 챌린지 이벤트입니다(종료).
필수: AIR 챌린지, AI X 원격
- 출처: RC2-HTTPSW-1998 ; https://www.remotecall.com/kr/support/notices/promot

**[RC2-640] (단순조회)**
- 질문: 리모트콜 다운로드 페이지에서 다운받을 수 있도록 안내하는 것은 무엇인가요?
- 정답: 리모트콜 사용에 필요한 파일과 보다 쉽게 이해할 수 있는 자료입니다.
필수: 필요한 파일, 자료
- 출처: RC2-HTTPSW-1660 ; https://www.remotecall.com/kr/support/download/

**[RC2-660] (사실확인)**
- 질문: 리모트콜(RemoteCall) 일본 IT위크 후기에서 외부 손님 초대 방법으로 안내한 내용은 무엇인가요?
- 정답: 링크나 연결 번호를 알려주면 외부 손님 초대도 걱정없죠!
필수: 링크, 연결 번호
- 출처: RC2-HTTPSW-1764 ; https://www.remotecall.com/kr/support/notices/event/

**[RC2-630] (사양조회)**
- 질문: 리모트콜 웹뷰어에서 고객 PC의 Chrome은 어떤 버전 이상, 어떤 OS에서 지원되나요?
- 정답: Chrome 100 이상이며 Windows, macOS에서 지원됩니다.
필수: Chrome 100 이상, Windows, macOS
- 출처: RC2-HTTPSW-1605 ; https://www.remotecall.com/kr/products/webviewer/

**[RC2-659] (정의)**
- 질문: 리모트콜(RemoteCall) 공지에서 알서포트를 어떻게 정의하고 있나요?
- 정답: 클라우드 원격 소프트웨어 전문 기업 알서포트입니다.
필수: 클라우드 원격 소프트웨어 전문 기업
- 출처: RC2-HTTPSW-1755 ; https://www.remotecall.com/kr/support/notices/event/

## 재개
- 승인: `python3 tools/pipeline.py approve GSBATCH_RC2_12차`
- 반려: `python3 tools/pipeline.py reject GSBATCH_RC2_12차 --reason "..."` (사유 필수)

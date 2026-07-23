# GATE_GSBATCH_RC2_4차 — 사람 게이트

- 발행: 2026-07-23T13:23:19 · 제품: RC2 · 단계: ④ 골든셋 배치

## 무엇을 / 왜 멈췄나
4차 생성·검수 완료 — 사람 게이트

## 실측 수치
- 배치: RC2_골든셋_4차_75문항_v1_0.xlsx
- 문항: 75
- 검수 7종: PASS
- 직접 커버 누계: 220
- 잔여: 660

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
승인 시 다음 차수 / 잔여 0이면 배치 마감으로

## 재개
- 승인: `python3 tools/pipeline.py approve GSBATCH_RC2_4차`
- 반려: `python3 tools/pipeline.py reject GSBATCH_RC2_4차 --reason "..."` (사유 필수)

## 설계본부 소견 (독립 세션 · 참고 — 확정은 사람)
표준 검수 도구·독립 실측 모두 **승인이 나지 않아 실행되지 못했다.** 여기서 멈춘다 — 실측 없이 승인을 권고하는 것은 §2-1(선언≠실측)·§7(실측 없는 판정 금지) 정면 위반이기 때문이다.

---

## 소견서 — GATE_GSBATCH_RC2_4차 (중간 · 판정 보류)

**[판정] 승인 권고 불가 — 실측 차단으로 판정 보류(HOLD).** 반려가 아니라, 검증을 수행할 수 없는 상태다.

### 실측 가능했던 것 (원장·상태·config 정본 대조 — §2-7)
- 원장 등재 확인: `ledger.jsonl` 최종행에 `BATCH_GENERATED` + `ISSUE_GATE_CARD` + `RUNNING→WAITING_HUMAN` 3행 실재 (2026-07-23T13:23:19). 계보 있음(P-007 통과).
- 배치 파일 실재: `data/RC2/04_goldenset_batch/RC2_골든셋_4차_75문항_v1_0.xlsx` (19,379 bytes, 13:23 생성).
- 커버 등식 산술 검산: 직접누계 220 + 잔여 660 = 880 = `config.yaml pipeline.goldenset_target: 880` **일치**.
- 문항 수 75 = 밴드 상한 `pipeline.band: [60,75]` 이내(상단 경계).
- 플래그 0건 → ack 체크리스트 공란은 정합.

### 실측하지 못한 것 (= 승인 불가 사유)
게이트 카드의 "검수 7종 PASS / 직접 커버 220 / 잔여 660"은 **전부 `script:gen_goldenset`의 선언**이다. 내가 표준 도구로 재측정해야 인정된다(§2-1, P-003). 그런데:
- `verify_batch.py` 실행 → **승인 거부/미승인으로 미실행** (3회 시도, "requires approval").
- 읽기용 독립 python 실측 → 동일하게 미실행.

즉 검수 7종 중 **②1축 문자 대조·⑤커버 등식(소실 0)·⑥흡수대표∈합집합·④질문중복·③citation실재** 를 **하나도 내 손으로 확인하지 못했다.** 특히 직전 커밋 `61ef681a fix: covered_units 정규식 — 3차 75단위 오반환 정정`이 있어 **커버리지 카운터는 노화·오탐 의심 대상**(§3, P-002)이라 선언 신뢰가 더욱 불가하다.

### 발동 조항/판례
§2-1(선언≠실측) · §2-6·P-003(표준 도구 강제) · §2-5(모호하면 정지) · §3 노화 감시(covered_units 정규식 방금 수정) · §7(실측 없는 판정 금지).

### 재현 수단 (승인만 되면 즉시 실행할 정본 명령)
```
python3 tools/verify_batch.py \
  --batch data/RC2/04_goldenset_batch/RC2_골든셋_4차_75문항_v1_0.xlsx \
  --map   data/RC2/03_coverage_map/RC2_커버리지맵_코퍼스판_v1_2.xlsx \
  --product RC \
  --union <파일럿31> <2차40> <3차75> \
  --config config.yaml --json /tmp/verify_rc2_4cha.json
```
(⑥ 흡수대표 검사를 위해 --union에 이전 3개 차수 전부 필요 — P-002 합집합 원칙)

### 다음 단계 지시 (사람 결정 필요)
**위 verify_batch 실행을 승인해 주십시오.** 그래야 7종을 내 손으로 재측정하고, 표본 문항 문맥까지 읽어(P-001) 정식 소견서를 냅니다. 지금 `pipeline.py approve`를 누르시면 **미검증 선언을 그대로 통과시키는 것** — §2-1 위반이라 권고할 수 없습니다.

비유: 지금 저는 "합격 도장"을 요청받았는데, 검사 기계 전원 스위치가 아직 안 켜진 상태입니다. 스위치(도구 실행 승인)를 켜주시면 바로 재보고 드리겠습니다.

### 👀 사람 확인 가이드 — 기계가 못 보는 것만 보면 됩니다 (표본 검사, 전건 검토 불필요)
1. 아래 표본의 **질문이 실제 고객이 물어볼 법한 말**인가요? (내부 용어·번역투면 반려)
2. **정답이 질문에 대한 답**인가요? (동문서답·과잉 서술 확인)
3. 정답의 **'필수:' 요소가 합리적**인가요? (너무 많으면 채점이 가혹, 너무 적으면 무의미)
4. 전체 문항은 ④ 자료실에서 `RC2_골든셋_4차_75문항_v1_0.xlsx` [받기]

어색한 문항이 있으면 [반려] + 사유에 문항 ID를 적어주세요 — 그 피드백대로 재출제됩니다.

### 표본 문항 (유형별 1개, 자동 발췌)
**[RC2-199] (고지)**
- 질문: 리모트콜 매뉴얼의 내용은 어떤 경우에 어떻게 변경될 수 있는가?
- 정답: 제품의 성능 향상 또는 기능 개선 등에 따라 사전 예고 없이 변경될 수 있다.
필수: 사전 예고 없이, 변경
- 출처: RC2-HTTPSF-061 ; https://files.rsupport.com/ko/remotecall/guides/Remot

**[RC2-181] (고지/법적)**
- 질문: 리모트콜 WebViewer SDK 가이드의 무단 복제에 관한 고지는 무엇인가?
- 정답: 알서포트㈜의 사전 서면 동의 없이 가이드의 일부 혹은 전체 내용을 무단 복사·복제·전재하는 것은 저작권법에 저촉된다.
필수: 사전 서면 동의, 저작권법 저촉
- 출처: RC2-REMOTE-961 ; RemoteCall-WebViewer-SDK-Intergration-Guide-Ko.pdf

**[RC2-205] (권한/동작)**
- 질문: 리모트콜 모바일 지원에서 고객이 화면 전송이나 상담원의 원격 제어를 원하지 않을 때 할 수 있는 것은?
- 정답: 고객은 언제든지 화면 전송을 중단할 수 있다.
필수: 고객, 언제든지 화면 전송 중단
- 출처: RC2-HTTPSF-113 ; https://files.rsupport.com/ko/remotecall/guides/Remot

**[RC2-195] (기능)**
- 질문: 리모트콜 영상 지원의 '레이저' 기능은 무엇을 하는가?
- 정답: 레이저 포인터를 이용하여 특정 지점을 가리킨다.
필수: 레이저 포인터, 특정 지점
- 출처: RC2-HTTPSF-029 ; https://files.rsupport.com/ko/remotecall/brochures/Re

**[RC2-161] (기능 존재)**
- 질문: 리모트콜의 사용자관리에서 권한과 관련해 제공되는 기능은?
- 정답: 사용자관리에 '사용자 권한 설정' 기능이 있다.
필수: 사용자 권한 설정
- 출처: RC2-REMOTE-1586 ; [RemoteCall 7.0] Products Specification_v1.7.xlsx

**[RC2-218] (기능/조건)**
- 질문: 리모트콜 iOS 모바일 지원에서 상담원이 단말 화면을 캡쳐할 수 있는 조건은?
- 정답: 화면공유 기능 사용 상태에서 상담원이 단말 화면을 캡쳐할 수 있다.
필수: 화면공유 사용 상태, 단말 화면 캡쳐
- 출처: RC2-HTTPSF-142 ; https://files.rsupport.com/ko/remotecall/guides/Remot

**[RC2-206] (동작)**
- 질문: 리모트콜에서 모바일 지원이 이미 설치되어 있을 때 [모바일 지원 실행] 버튼을 클릭하면?
- 정답: 모바일 지원이 설치되어 있는 경우 [모바일 지원 실행] 버튼 클릭 시 앱이 자동으로 실행된다.
필수: 자동으로 실행
- 출처: RC2-HTTPSF-121 ; https://files.rsupport.com/ko/remotecall/guides/Remot

**[RC2-190] (동작/기본값)**
- 질문: 리모트콜 WebViewer SDK에서 locale을 미입력하거나 지원하지 않는 언어 코드를 입력하면 어떻게 되는가?
- 정답: 미입력 또는 지원하지 않는 언어 코드 입력 시 브라우저 기본 언어로 자동 설정된다.
필수: 브라우저 기본 언어, 자동 설정
- 출처: RC2-REMOTE-1035 ; RemoteCall-WebViewer-SDK-Intergration-Guide-Ko.pdf

**[RC2-209] (목차/기능)**
- 질문: 리모트콜 Android 매뉴얼 6.1.4 절에서 다루는 항목은 무엇인가?
- 정답: 6.1.4 모바일 지원 종료를 다룬다.
필수: 모바일 지원 종료
- 출처: RC2-HTTPSF-868 ; https://files.rsupport.com/ko/remotecall/guides/Remot

**[RC2-198] (사실)**
- 질문: 리모트콜(알서포트) 브로슈어에 명시된 중국 지사 주소는?
- 정답: 중국 지사 주소는 北京市朝阳区阜通东大街6号方恒国际A座2708이다.
필수: 北京市朝阳区阜通东大街6号方恒国际A座2708
- 출처: RC2-HTTPSF-058 ; https://files.rsupport.com/ko/remotecall/brochures/Re

**[RC2-184] (사양)**
- 질문: 리모트콜 Native APP의 모바일 버전 사양(최소·권장)은?
- 정답: 버전 사양은 최소 8.0 이상, 권장 16 이상이다.
필수: 8.0 이상, 16 이상
- 출처: RC2-REMOTE-986 ; RemoteCall-WebViewer-SDK-Intergration-Guide-Ko.pdf

**[RC2-215] (사양/기능)**
- 질문: 리모트콜 Android 모바일 지원의 화면 '사용자 조절'에서 조절 가능한 배율 범위와 기준 해상도는?
- 정답: 고객 단말기 화면 크기를 20~100% 배율(HD 해상도(1280*720) 기준)로 조절한다.
필수: 20~100%, HD 해상도(1280*720)
- 출처: RC2-HTTPSF-920 ; https://files.rsupport.com/ko/remotecall/guides/Remot

**[RC2-180] (사양/이력)**
- 질문: 리모트콜 WebViewer SDK 연동 가이드의 0.9.0 개정(연동 규약 초안) 일자는?
- 정답: 0.9.0 연동 규약 초안의 개정 일자는 2025.04.15이다.
필수: 0.9.0, 2025.04.15
- 출처: RC2-REMOTE-953 ; RemoteCall-WebViewer-SDK-Intergration-Guide-Ko.pdf

**[RC2-146] (사양/제약)**
- 질문: 리모트콜(RemoteCall 7.0)에서 Android 4.3.1(Jellybean)의 지원 상태는 무엇인가?
- 정답: Android 4.3.1(Jellybean)은 RemoteCall 7.0에서 지원이 종료(SpecOut)된 사양이며 웹뷰어(WV) 대상이다.
필수: SpecOut, 4.3.1
- 출처: RC2-REMOTE-1454 ; [RemoteCall 7.0] Products Specification_v1.7.xlsx

**[RC2-152] (설정)**
- 질문: 리모트콜의 '전후면 카메라 전환' 메뉴는 무엇을 제어하는가?
- 정답: 모바일의 촬영 카메라를 전후로 조정하는 메뉴의 사용여부를 설정한다.
필수: 촬영 카메라, 전후 조정
- 출처: RC2-REMOTE-1507 ; [RemoteCall 7.0] Products Specification_v1.7.xlsx

**[RC2-147] (설정 조건)**
- 질문: 리모트콜에서 'SMS 서버 아이디' 설정은 어떤 옵션이 어떤 값일 때 가능한가?
- 정답: '앱설치정보 SMS 전송사용' 옵션이 [전체사용]일 경우 SMS 서버 아이디를 설정할 수 있다.
필수: 앱설치정보 SMS 전송사용, 전체사용
- 출처: RC2-REMOTE-1463 ; [RemoteCall 7.0] Products Specification_v1.7.xlsx

**[RC2-154] (설정/사양)**
- 질문: 리모트콜의 '에이전트 로그파일 기록사용' 설정에서 지정 가능한 기간과 로그 저장 경로는?
- 정답: 권한없음/사용안함/전체사용(7, 15, 30, 60, 90일) 중 설정하며, Agent 로그파일은 C:\Users\Public\Documents\RSupport\RemoteCall\RCLog 경로에 기록된다.
필수: 7·15·30·60·90일, C:\
- 출처: RC2-REMOTE-1525 ; [RemoteCall 7.0] Products Specification_v1.7.xlsx

**[RC2-168] (안내)**
- 질문: 리모트콜 사용 시 Proxy Server 정보는 누구에게 문의해야 하는가?
- 정답: Proxy Server 정보는 네트워크 관리자에게 문의해야 한다.
필수: 네트워크 관리자
- 출처: RC2-REMOTE-884 ; RemoteCall-SaaS-Agent-Manual-Visual-Support-Ko.pdf

**[RC2-187] (오류)**
- 질문: 리모트콜 WebViewer SDK에서 SecretKey가 없을 때 반환되는 HTTP 상태 코드는?
- 정답: Status 401이 반환된다.
필수: 401
- 출처: RC2-REMOTE-1010 ; RemoteCall-WebViewer-SDK-Intergration-Guide-Ko.pdf

**[RC2-200] (절차)**
- 질문: 리모트콜 Android 모바일 지원 사용 전 해제해야 하는 개발자 옵션은 무엇이며 경로는?
- 정답: 단말기>환경설정>개발자 옵션>액티비티 유지 안함(활동보관안함) 옵션 설정을 해제한 후 사용해야 한다.
필수: 개발자 옵션, 액티비티 유지 안함, 해제
- 출처: RC2-HTTPSF-069 ; https://files.rsupport.com/ko/remotecall/guides/Remot

**[RC2-201] (정의)**
- 질문: 리모트콜 모바일 지원에서 '접속 번호'란 무엇인가?
- 정답: 모바일 지원 연결을 위해 고객이 단말기에 입력하는 숫자이다.
필수: 모바일 지원 연결, 고객이 입력하는 숫자
- 출처: RC2-HTTPSF-078 ; https://files.rsupport.com/ko/remotecall/guides/Remot

**[RC2-174] (제약)**
- 질문: 리모트콜 영상지원에서 iOS가 지원하지 않는 기능(스피커폰)에 대한 설명은?
- 정답: 해당 기능(스피커폰)은 iOS에서는 지원하지 않는다.
필수: iOS, 지원하지 않음
- 출처: RC2-REMOTE-935 ; RemoteCall-SaaS-Agent-Manual-Visual-Support-Ko.pdf

# GATE_COVMAP_RV2 — 사람 게이트

- 발행: 2026-07-26T15:25:14 · 제품: RV2 · 단계: ③ 커버리지맵

## 무엇을 / 왜 멈췄나
커버리지맵 생성·검수 완료 — 확정은 사람 (사람확인 큐)

## 실측 수치
- 실행 전략: ensemble
- 커버 단위(검수 통과): 6937
- 기여도: {'generator': {'추출(검수통과)': 6386, '신규 기여': 4197}, 'judge': {'추출(검수통과)': 10550, '신규 기여': 2740}}
- 재검수 탈락: 0
- 1축 문자 대조: 불일치 0 (통과분)
- GAP_AUDIT 누락 문서: 90
- 산출: RV2_커버리지맵_코퍼스판_v1_0.xlsx

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
- [ ] ack: GAP-목록·넘김 페이지 (내용 없음 추정) · 48건 · [] — 페이지네이션·피드·카테고리 목록 — 예: https://content.rview.com/ko/blog/page/10/ · https://content.rview.com/ko/blog/page/11/ · https://content.rview.com/ko/blog/page/13/
- [ ] ack: GAP-내용 페이지 누락 · 기타 · 42건 (710청크) · ['https://content.rview.com/ko/blog/?listType=card&search=', 'https://content.rview.com/ko/blog/cloud-voucher/', 'https://content.rview.com/ko/blog/iso-270012022-achieve/', 'https://content.rview.com/ko/blog/page/12/?listType=list&search=', 'https://content.rview.com/ko/blog/page/2/?listType=card&search=', 'https://content.rview.com/ko/blog/page/2/?listType=list&search=', 'https://content.rview.com/ko/cases/education-02/', 'https://content.rview.com/ko/cases/financial-01/', 'https://content.rview.com/ko/cases/it-solution-02/', 'https://content.rview.com/ko/cases/it-solution-03/', 'https://content.rview.com/ko/feature/rvbox/', 'https://content.rview.com/ko/product/mobile/', 'https://content.rview.com/ko/product/remoteview-ot/', 'https://content.rview.com/ko/product/rv-vs-vdi/', 'https://content.rview.com/ko/uses/cases/?filter=education', 'https://content.rview.com/ko/uses/cases/?filter=equipment', 'https://content.rview.com/ko/uses/cases/?filter=manufacture', 'https://content.rview.com/ko/uses/cases/?filter=medical', 'https://content.rview.com/ko/uses/cases/?filter=public', 'https://content.rview.com/ko/videoguide/adding-a-user/', 'https://content.rview.com/ko/videoguide/chromebook-remotework/', 'https://content.rview.com/ko/videoguide/conference2024/', 'https://content.rview.com/ko/videoguide/dhcp-wol-setting/', 'https://content.rview.com/ko/videoguide/managing-groups/', 'https://content.rview.com/ko/videoguide/mobile-remote-control/', 'https://content.rview.com/ko/videoguide/multiple-monitors/', 'https://content.rview.com/ko/videoguide/new-features-of-remoteview/', 'https://content.rview.com/ko/videoguide/overview_2/', 'https://content.rview.com/ko/videoguide/remotecontrol-freedemo/', 'https://content.rview.com/ko/videoguide/remoteview-se-control/', 'https://content.rview.com/ko/videoguide/remoteview-store-management/', 'https://content.rview.com/ko/videoguide/remoteview-webviewer-introduce/', 'https://content.rview.com/ko/videoguide/remoteviewbox-dhcp/', 'https://content.rview.com/ko/videoguide/remoteviewbox-display/', 'https://content.rview.com/ko/videoguide/remotewol-intro/', 'https://content.rview.com/ko/videoguide/rv-vs-vdi/', 'https://content.rview.com/ko/videoguide/setting-connection-time/', 'https://content.rview.com/ko/videoguide/telework-by-remoteview/', 'https://content.rview.com/ko/videoguide/use-cases-pumpkin/', 'https://content.rview.com/ko/videoguide/using-architectural-cad/', 'https://content.rview.com/ko/videoguide/wol-ip-setting/', 'https://content.rview.com/ko/videoguide/wol-mac-address-check/']

## 기계 권고 (참고용 — 판단은 사람)
GAP 누락·반려 잔존 항목 ack 후 승인 시 맵 확정 → ④ 진입

## 재개
- 승인: `python3 tools/pipeline.py approve COVMAP_RV2`
- 반려: `python3 tools/pipeline.py reject COVMAP_RV2 --reason "..."` (사유 필수)

## 설계본부 소견 (독립 세션 · 참고 — 확정은 사람)
필요한 실측을 마쳤습니다. xlsx 독립 행수 확인만 권한 차단으로 미완입니다(재현 명령은 소견서에 명기). 소견서를 제출합니다.

---

# 소견서 — GATE_COVMAP_RV2 (③ 커버리지맵)

## [판정] 조건부 승인 가능 — 단, 사람이 아래 3개 caveat을 인지한 뒤에만 ack할 것

이 게이트는 **사람 게이트**입니다. 저는 확정하지 않습니다(§1). 결론부터: **숫자의 계보는 깨끗합니다. 그러나 게이트 카드가 "6937 검수통과"를 최종 정제본처럼 보이게 제시하는데, 실제로는 아직 정제가 덜 된 중간 풀입니다.** 이 차이를 모르고 승인하면 나중에 숫자가 줄어드는 걸 "누락"으로 오해하게 됩니다.

---

## 1. 실측으로 확인된 것 (좋은 소식)

- **계보 확인(P-007 충족).** 게이트 카드의 모든 숫자가 원장 `MAP_GENERATED`(2026-07-26T15:25:14)와 **한 글자도 안 틀리고 일치**. 6937 / 6386·4197 / 10550·2740 / 재검수탈락 0 / GAP 90 전부 원장에 계보 있음.
- **기여도 산수 일치.** generator 신규 4197 + judge 신규 2740 = **6937** ✓ (풀은 두 추출기의 새 기여 합집합).
- **GAP 산수 일치.** 넘김 48 + 내용 42 = **90** ✓.
- **judge 완주 — 추론 확인.** 원장에 judge "412/412 완료" 명시 이벤트는 **없습니다**(마지막 judge 로그는 275/412 재개). 다만 `MAP_GENERATED`에 judge 기여(10550/2740)가 기록됐고, HALT나 추출기 실패 없이 그 지점에 도달했으므로 코드 경로상 judge 완주가 함의됩니다. → "명시 로그로 확인"이 아니라 **"코드 경로로 추론 확인"**으로 명기합니다(P-007 — 아는 척 금지).

---

## 2. 사람이 승인 전 반드시 인지할 caveat 3가지 (나쁜 소식 — 같은 온도로 보고)

**A. 6937은 "정제 완료 수"가 아니라 "1차 dedup만 된 중간 풀"이다.**
- 원장 `MERGE_SKIPPED_SCALE`(15:25:08): 풀 6937 > 병합한도 200이라 **앙상블 의미 병합(부분집합 통합)을 스킵**하고 기계 정확일치 dedup만 적용. 코드 주석이 명시: *"부분집합 통합은 사람확인 큐에서"*(gen_coverage.py:311-313).
- 즉 "리모트뷰 60FPS 제어" vs "리모트뷰 끊김없는 60FPS SSO 제어" 같은 **부분집합·근접중복이 아직 남아있음**. 최종 큐레이션 후 6937은 **줄어드는 게 정상**입니다. (RC2도 같은 경로 — pool 7353 스킵 전례.)
- 비유: 6937은 "중복 제거 안 끝난 명함 더미"입니다. 완전히 같은 명함만 뺐고, "이름은 같은데 직함만 다른" 명함은 아직 안 뺐습니다.

**B. "재검수 탈락 0" · "1축 불일치 0"을 품질 보증으로 읽지 말 것.**
- 이 두 0은 **구조상 0이 나올 수밖에 없는 값**입니다. 재검수는 이미 통과한 풀을 다시 확인하는 것이고(gen_coverage.py:284→443), ID는 재부여로 충돌이 원천 불가(:315-321).
- 1축 검사는 "fact 문자열이 코퍼스에 존재하는가"의 공백정규화 substring 검사일 뿐(:343). **P-001이 경고한 바로 그 유형**(공백제거 매칭의 우연 일치). "사실이 문맥상 맞다"는 보증이 아닙니다.

**C. GAP 42건(710청크)에 성격이 다른 세 종류가 "기타"로 뭉뚱그려져 있다 — 그대로 ack하면 진짜 공백까지 무해로 승인된다.**
- 게이트 카드가 42건을 "기타"로 묶은 건 **도구 노화**입니다: 섹션분류 정규식이 `remotecall.com/kr/`용인데 RV2는 `content.rview.com/ko/` 도메인이라 전건 "기타"로 떨어짐(gen_coverage.py:408, P-003 노화 대상). 탐지(gap_audit)는 정상, **분류 라벨만 고장**.
- 제가 42개 URL을 성격별로 분류한 초안(권고 — 확정은 사람):

| 성격 | 건수 | 예시 | 판단 |
|---|---|---|---|
| 목록·필터·검색 URL (무해 추정) | 9 | `/uses/cases/?filter=medical`, `/blog/?listType=card&search=`, `/blog/page/2/?listType=list` | GAP-넘김과 동류. 쿼리스트링 때문에 넘김 정규식이 못 걸러 "내용"으로 오분류됨 |
| 도입사례 `/cases/` (홍보 판례 제외 후보) | 4 | `/cases/education-02`, `/cases/financial-01`, `/cases/it-solution-02·03` | **의도적 제외** — generator가 배치 150에서 홍보문구 반려 이력(feedback_goldenset_promo) 때문에 스스로 추출 거부 |
| **진짜 내용 공백 우려 (핵심)** | 6 | `/product/mobile/`, `/product/remoteview-ot/`, `/product/rv-vs-vdi/`, `/feature/rvbox/`, `/blog/cloud-voucher/`, `/blog/iso-270012022-achieve/` | **핵심 제품 페이지가 커버 0.** 사람 판단 필수 |
| 비디오가이드 `/videoguide/*` | 23 | `/videoguide/mobile-remote-control/` 등 | 영상 위주라 텍스트 적을 수 있음 — 개별 성격 확인 필요 |

(4+5+4+2+3+1+23 = 42 ✓)

---

## 3. 미완 실측 (정직 보고 — §2-1)

- **xlsx 실제 행수를 독립 확인하지 못함.** unzip/python 실행이 권한 차단됨. 게이트카드·원장·pool 3자는 6937로 일치하나, **산출물 자체 행수 대조는 미완**입니다. 승인 전 1줄로 확인 권고.

---

## 4. 재현 수단 (§2-2 필수)

- 원장 계보: `grep '"action": "MAP_GENERATED"' ledger.jsonl | grep RV2` → 6937 등 전 수치
- 병합 스킵 근거: `grep MERGE_SKIPPED_SCALE ledger.jsonl | grep RV2` → pool 6937, limit 200
- 산출물: `data/RV2/03_coverage_map/RV2_커버리지맵_코퍼스판_v1_0.xlsx`
- **미완 실측 보완용(승인 전 권고):** `unzip -p "data/RV2/03_coverage_map/RV2_커버리지맵_코퍼스판_v1_0.xlsx" xl/worksheets/sheet1.xml | grep -c '<row '` → 헤더 포함 6938 나와야 정상

---

## 5. 다음 단계 — 권고 (확정·반출은 사람 전용, §5)

1. **먼저:** xlsx 행수 1줄 확인(위 명령) — 6937 산출물 실재 확정.
2. **ack 전:** GAP 42건을 위 표대로 **"의도적 홍보제외(4) / 목록성 무해(9) / 진짜 제품 공백(6) / 비디오가이드(23)"**로 갈라서 볼 것. 특히 **`/product/remoteview-ot`, `/product/mobile`, `/feature/rvbox` 3개 핵심 제품 페이지 공백**은 후속 ③′ GAP_AUDIT 세션에서 gapfill 대상으로 명시 권고.
3. **인지 후 승인:** A(6937은 중간 풀 — 부분집합 통합이 사람확인 큐에 남아있음)를 이해한 상태에서 `approve COVMAP_RV2`. 이후 ④ 진입 전/후 부분집합 통합을 별도 처리.
4. 승인·반려 버튼은 사람이 누릅니다. 저는 여기까지가 권고입니다.

---

**한 줄 요약:** 숫자 계보는 깨끗하고 승인해도 큰 사고는 없습니다. 다만 **① 6937은 아직 덜 정제된 중간 수치고, ② "탈락 0"은 품질 보증이 아니며, ③ GAP 42건 안에 "일부러 뺀 홍보"와 "진짜 빠진 제품페이지"가 섞여 있다** — 이 세 가지를 알고 ack하면 됩니다.

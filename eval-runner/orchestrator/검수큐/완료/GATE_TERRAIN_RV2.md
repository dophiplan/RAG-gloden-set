# GATE_TERRAIN_RV2 — 사람 게이트

- 발행: 2026-07-24T14:14:56 · 제품: RV2 · 단계: ② 지형 판정

## 무엇을 / 왜 멈췄나
RV2 terrain 프로파일 확정 필요 — citation/앵커 패턴·부록 스위치를 사람이 판정

## 실측 수치
- 프로파일: 초안(복제/빈)
- 확정 항목: citation_pattern·anchor_patterns·appendix_switches

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
기존 제품(RV/RC) 프로파일과 코퍼스 실측 결과를 대조해 결정

## 재개
- 승인: `python3 tools/pipeline.py approve TERRAIN_RV2`
- 반려: `python3 tools/pipeline.py reject TERRAIN_RV2 --reason "..."` (사유 필수)

## 설계본부 소견 (독립 세션 · 참고 — 확정은 사람)
대조 결과가 나왔습니다. 레거시 RV 데이터는 xlsx(바이너리)라 grep으로 앵커 패턴 사용 이력을 신뢰성 있게 실측할 수 없었습니다 — 이 부분은 확인 못 했다고 명기하겠습니다. 나머지는 직접 실측으로 판정 가능합니다.

---

# 소견서 — GATE_TERRAIN_RV2

## [판정] 카드 "실측 수치"는 반려(허위 선언) · 프로파일 실체는 **조건부 승인 권고** (확정은 사람 — §5 기준 결정)

카드가 적은 "프로파일: 초안(복제/빈)"은 **실측과 어긋납니다.** 실제 파일을 열어보니 RV2 프로파일은 비어있지도, 다른 제품 복사본도 아니고, 리모트뷰에 맞춰 채워져 있습니다. 카드의 저 문구는 파이프라인이 미승인 게이트에 자동으로 붙이는 기본 문구(선언)이지 실측이 아닙니다 (§2-1 선언≠실측 위반). **이 문구를 결정 근거로 삼으면 안 됩니다** (P-002 대조 기준 자체 검증).

## 실측 수치

**1) RV2 프로파일은 채워져 있고 제품 맞춤이다** (`terrain.d/RV2.yaml` 직접 읽음)
- citation_pattern: `RV2-[A-Z]+(?:-[A-Z0-9]+)*-\d+` · question_id: `RV2-[A-Z]\d+` — 형제 프로파일과 접두사만 다른 동일 구조
- anchor_patterns: `\(20\d\d-\d\d-\d\d (게시|시행|인덱싱|작성|서술) 기준\)` — **RV2 고유** (RC2·EE는 빈 배열)
- appendix_switches: `[T-1]` — **RV2 고유** · onboarding: `true` — **RV2 고유** · product_name: `리모트뷰`

**2) 다른 프로파일의 복제가 아니다** (3개 나란히 대조)
- RC2·EE는 anchor_patterns=[], appendix_switches=[], onboarding=false. RV2만 셋 다 값이 있음 → 빈 복사본 아님.

**3) product_name은 이미 결함 반려·수정 완료** (`git log terrain.d/RV2.yaml`)
- 최신 커밋 `6acf635d` "파일럿 제품명 결함 반려·재출제 — terrain product_name 등록 (리모트콜/리모트뷰)"

**4) 코퍼스는 등록·해시 검증 완료** (`catalog/manifest_corpus_RV2.json`, 14:14:55 등록)
- 2개 엔트리(RAG_RV_data.zip / content.rview.com_ko.zip_) sha256 동일(`083c385…`) = 같은 파일 1개+사본. P-011 원문 매니페스트 게이트 통과.

**5) RV2 하류 산출물은 아직 비어있음** (`data/RV2/03_coverage_map`~`08_scoring` 전부 빈 폴더)
- 즉 anchor_patterns·appendix T-1·onboarding이 실제 산출물에 맞물리는지는 **아직 스크립트로 검증 불가** — 검증할 대상 파일이 없음. 이 셋은 빌드 전 제품지식 결정.

**6) 확인 못 한 것 (불확실 명기 — §7)**
- 기계 권고("레거시 RV 관행과 대조")를 완수하지 못함. 레거시 RV 커버리지맵·골든셋이 전부 `.xlsx`(바이너리)라 grep 텍스트 실측이 불가. 날짜 앵커 패턴이 레거시 RV에서 검증된 관행인지 여부는 **미확인.** xlsx 파싱 없이는 단정 불가.

## 발동 조항/판례
- §2-1(선언≠실측), §2-4·P-002(대조 기준 검증), §2-5(모호하면 정지), §5(기준·임계값 변경은 사람), P-011(원문 매니페스트 게이트)

## 재현 수단
```
cat terrain.d/RV2.yaml terrain.d/RC2.yaml terrain.d/EE.yaml   # 프로파일 3종 대조
cat catalog/manifest_corpus_RV2.json                          # 코퍼스 해시 검증
ls data/RV2/03_coverage_map data/RV2/04_goldenset_batch       # 하류 산출물 부재 확인
git log --oneline -- terrain.d/RV2.yaml                        # product_name 수정 계보
```
산출물 경로: `terrain.d/RV2.yaml`, `catalog/manifest_corpus_RV2.json`, 본 소견서

## 다음 단계 지시 (사람 결정 — 3분 판단용)

이 게이트는 **터레인=형식 게이트가 앞으로 집행할 기준**을 정하는 자리라, 본질적으로 사람 결정입니다(§5). 저는 확정 안 합니다. 사람이 확인할 것은 딱 세 가지 **제품지식 선택**뿐입니다:

| 선택지 | 트레이드오프 |
|---|---|
| **A. 지금 승인** (권고) | 프로파일이 제품 맞춤·구조 일관·코퍼스 해시 검증됨. 터레인은 빌드보다 먼저 정해야 하는 것이라, "산출물로 검증 후 승인"은 순환(닭-달걀). 세 선택만 제품지식으로 확정하면 진행 가능. |
| B. 보류 | 앵커 패턴이 실제 코퍼스에 맞물리는지 빌드 후 실측하고 승인. 단 그때까지 하류 단계 전부 정지 — 터레인이 그 산출물을 게이트하므로 사실상 진행 불가. |

**확인 요청 3건** (사람이 제품지식으로 예/아니오):
1. **날짜 앵커** `(YYYY-MM-DD 게시|시행|인덱싱|작성|서술 기준)` — 리모트뷰 답변에 이 시점표기가 실제로 쓰이는가?
2. **부록 스위치 T-1** — 켠 게 맞는가? (RC2·EE는 꺼짐)
3. **onboarding: true** — 리모트뷰는 온보딩 문항 포함이 맞는가?

**제 권고: A(승인).** 단, 승인은 카드의 "빈/복제" 문구가 아니라 **위 실측(채워진 제품 맞춤 프로파일 + 해시 검증 코퍼스)** 을 근거로 눌러야 합니다. 위 3건 중 하나라도 "아니오"면 그 항목만 반려 사유로 지정.

```
승인: python3 tools/pipeline.py approve TERRAIN_RV2
반려: python3 tools/pipeline.py reject TERRAIN_RV2 --reason "..."
```

**사람확인 필요:** 확인 3건 + 기계 권고(레거시 RV 대조)는 xlsx 파싱 없이 미완 — 이 대조가 결정에 꼭 필요하면 별도 지시 주십시오. 제가 xlsx를 파싱해 앵커 패턴 실사용 이력을 실측하겠습니다.

# 2축 검증 입력 매니페스트 (STAGE2 PART A)

- 총 문항: 893 = 30배치 합
- 배치 크기: 30 (마지막 23)
- id 규칙: `{원문항ID}@{원배치}` (예: RC-A001@G-B1). B2는 서브파일 간 ID 중복이 있어 서브 접미(@G-B2-1/2/3) 사용
- E형 93건 evidence_excerpt=null

## 원파일 → 문항 수

| 접미 | 건수 | 원파일 |
|---|---|---|
| @G-B1 | 218 | RC_골든셋_G-B1_SPEC.xlsx |
| @G-B2-1 | 265 | RC_골든셋_G-B2-1_MANUAL_Agent.xlsx |
| @G-B2-2 | 113 | RC_골든셋_G-B2-2_MANUAL_AdminUser.xlsx |
| @G-B2-3 | 40 | RC_골든셋_G-B2-3_MANUAL_Customer.xlsx |
| @G-B3 | 57 | RC_골든셋_G-B3_TERMS.xlsx |
| @G-B4 | 61 | RC_골든셋_G-B4_NOTICE.xlsx |
| @G-B5 | 42 | RC_골든셋_G-B5_BROCHURE.xlsx |
| @G-B6 | 97 | RC_골든셋_G-B6_WEB.xlsx |

## 배치별 구성

| 배치 | 건수 | 첫 id | 끝 id |
|---|---|---|---|
| B01 | 30 | RC-A001@G-B1 | RC-A021@G-B1 |
| B02 | 30 | RC-A022@G-B1 | RC-A043@G-B1 |
| B03 | 30 | RC-A044@G-B1 | RC-C010@G-B1 |
| B04 | 30 | RC-C011@G-B1 | RC-C013@G-B1 |
| B05 | 30 | RC-C014@G-B1 | RC-G019@G-B1 |
| B06 | 30 | RC-G020@G-B1 | RC-A119@G-B1 |
| B07 | 30 | RC-A120@G-B1 | RC-E022@G-B1 |
| B08 | 30 | RC-E023@G-B1 | RC-A017@G-B2-1 |
| B09 | 30 | RC-D002@G-B2-1 | RC-A030@G-B2-1 |
| B10 | 30 | RC-C002@G-B2-1 | RC-G020@G-B2-1 |
| B11 | 30 | RC-A041@G-B2-1 | RC-D021@G-B2-1 |
| B12 | 30 | RC-G027@G-B2-1 | RC-A074@G-B2-1 |
| B13 | 30 | RC-D031@G-B2-1 | RC-D038@G-B2-1 |
| B14 | 30 | RC-G035@G-B2-1 | RC-A103@G-B2-1 |
| B15 | 30 | RC-A104@G-B2-1 | RC-D049@G-B2-1 |
| B16 | 30 | RC-A123@G-B2-1 | RC-E009@G-B2-1 |
| B17 | 30 | RC-E010@G-B2-1 | RC-C004@G-B2-2 |
| B18 | 30 | RC-C005@G-B2-2 | RC-A026@G-B2-2 |
| B19 | 30 | RC-A027@G-B2-2 | RC-A042@G-B2-2 |
| B20 | 30 | RC-D018@G-B2-2 | RC-F002@G-B2-3 |
| B21 | 30 | RC-D002@G-B2-3 | RC-E001@G-B2-3 |
| B22 | 30 | RC-E002@G-B2-3 | RC-C002@G-B3 |
| B23 | 30 | RC-G011@G-B3 | RC-E005@G-B3 |
| B24 | 30 | RC-E006@G-B3 | RC-A007@G-B4 |
| B25 | 30 | RC-D006@G-B4 | RC-E004@G-B4 |
| B26 | 30 | RC-E005@G-B4 | RC-A010@G-B5 |
| B27 | 30 | RC-C006@G-B5 | RC-D001@G-B6 |
| B28 | 30 | RC-A010@G-B6 | RC-A027@G-B6 |
| B29 | 30 | RC-A028@G-B6 | RC-G012@G-B6 |
| B30 | 23 | RC-G013@G-B6 | RC-E010@G-B6 |

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

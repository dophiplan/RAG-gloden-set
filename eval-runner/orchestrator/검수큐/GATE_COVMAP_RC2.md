# GATE_COVMAP_RC2 — 사람 게이트

- 발행: 2026-07-23T08:01:35 · 제품: RC2 · 단계: ③ 커버리지맵

## 무엇을 / 왜 멈췄나
커버리지맵 확정 대기 — GAP 재점검 완료 (도구 수리 반영)

## 실측 수치
- 실행 전략: ensemble
- 커버 단위(검수 통과): 7353
- GAP 누락 (재점검·source 기준): 61
- 산출: RC2_커버리지맵_코퍼스판_v1_0.xlsx
- 재점검: GAP 도구 수리 후 소급 재산출 (재추출 없음)

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
- [ ] ack: GAP-목록·넘김 페이지 (내용 없음 추정) · 23건 · [] — 페이지네이션·피드·카테고리 목록 — 예: https://www.remotecall.com/kr/blog/page/2/ · https://www.remotecall.com/kr/blog/page/3/ · https://www.remotecall.com/kr/support/notices/company/feed/
- [ ] ack: GAP-내용 페이지 누락 · 기타 · 14건 (49청크) · ['http://files.rsupport.com/kr/remotecall/documents/features/remotecall6.0-new-features-kr.pdf', 'https://files.rsupport.com/ko/company/brochures/RemoteCall-Product-Brochure-8P2025-Ko.pdf', 'https://files.rsupport.com/kr/remotecall/documents/brochures/remotecall6.0-brochure-1p-kr.pdf', 'https://files.rsupport.com/kr/remotecall/documents/brochures/remotecall6.0-mobilepack-brochure-1p-kr.pdf', 'https://files.rsupport.com/kr/remotecall/documents/brochures/remotecall6.0-visualpack-brochure-1p-kr.pdf', 'https://files.rsupport.com/kr/remotecall/documents/features/RemoteCall-product-specification-ko.pdf', 'https://files.rsupport.com/kr/remotecall/documents/leaflets/RemoteCall-SaaS-leaflet-ko.pdf', 'https://files.rsupport.com/kr/remotecall/documents/leaflets/RemoteCall-visual-support-leaflet-ko.pdf', 'https://files.rsupport.com/kr/remotecall/documents/leaflets/remotecall6.0-leaflet-cloud-kr.pdf', 'https://files.rsupport.com/kr/remotecall/documents/leaflets/remotecall6.0-leaflet-solution-kr.pdf', 'https://files.rsupport.com/kr/remotecall/documents/user-guides/RemoteCall-SaaS-Mobile-Support-Android-Quick-Guide-ko.pdf', 'https://files.rsupport.com/kr/remotecall/documents/user-guides/RemoteCall-SaaS-Mobile-Support-iOS-Quick-Guide-ko.pdf', 'https://files.rsupport.com/kr/remotecall/documents/whitepapers/RemoteCall-Usage-Tips-2022.pdf', 'https://files.rsupport.com/kr/remotecall/documents/whitepapers/remotecall-keep-the-infrastructure-kr.pdf']
- [ ] ack: GAP-내용 페이지 누락 · success-stories · 6건 (48청크) · ['https://www.remotecall.com/kr/success-stories/customer-support/jwonit/', 'https://www.remotecall.com/kr/success-stories/customer-support/lg-electronics-smartphone/', 'https://www.remotecall.com/kr/success-stories/customer-support/woori-bank/', 'https://www.remotecall.com/kr/success-stories/maintenance/initech/', 'https://www.remotecall.com/kr/success-stories/mobile-device/lg-electronics-home/', 'https://www.remotecall.com/kr/success-stories/standard-chartered-bank-korea/']
- [ ] ack: GAP-내용 페이지 누락 · support · 6건 (35청크) · ['https://www.remotecall.com/kr/support/notices/company/office-holiday-notice-202102/', 'https://www.remotecall.com/kr/support/notices/company/office-holiday-notice-202109/', 'https://www.remotecall.com/kr/support/notices/promotion/notice-event-winner-20221129/', 'https://www.remotecall.com/kr/support/notices_renew/promotion/free-remotecall-and-free-coffee/', 'https://www.remotecall.com/kr/support/tutorials/', 'https://www.remotecall.com/kr/support/update-history_renew/']
- [ ] ack: GAP-내용 페이지 누락 · blog · 5건 (36청크) · ['https://www.remotecall.com/kr/blog/rainyseason-damand/', 'https://www.remotecall.com/kr/blog/remotecall-it-kakao/', 'https://www.remotecall.com/kr/blog/remotecall-maintenance-sbank-case-study/', 'https://www.remotecall.com/kr/blog/remotecall-visualpack-innovation/', 'https://www.remotecall.com/kr/blog/sdk-update-remotecall/']
- [ ] ack: GAP-내용 페이지 누락 · products · 2건 (18청크) · ['https://www.remotecall.com/kr/products/remotecall-face/', 'https://www.remotecall.com/kr/products/remotecall/']
- [ ] ack: GAP-내용 페이지 누락 · footer · 1건 (6청크) · ['https://www.remotecall.com/kr/footer/contact-us/']
- [ ] ack: GAP-내용 페이지 누락 · notices · 1건 (5청크) · ['https://www.remotecall.com/kr/notices/promotion/free-remotecall-and-free-coffee/']
- [ ] ack: GAP-내용 페이지 누락 · store · 1건 (4청크) · ['https://www.remotecall.com/kr/store/product/?prd=mpack']
- [ ] ack: GAP-내용 페이지 누락 · update-history · 1건 (6청크) · ['https://www.remotecall.com/kr/update-history/update-20231116/']
- [ ] ack: GAP-내용 페이지 누락 · use-cases · 1건 (7청크) · ['https://www.remotecall.com/kr/use-cases/success-stories/finance/yuanta-securities']

## 기계 권고 (참고용 — 판단은 사람)
무해 추정(목록·넘김)은 묶음 ack, 내용 페이지 누락은 섹션별 검토 후 승인 → ④ 진입

## 재개
- 승인: `python3 tools/pipeline.py approve COVMAP_RC2`
- 반려: `python3 tools/pipeline.py reject COVMAP_RC2 --reason "..."` (사유 필수)

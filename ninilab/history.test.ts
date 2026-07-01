/**
 * M2-3 테스트: 커밋·되돌리기 검증
 */

import {
  createHistory,
  commit,
  undo,
  redo,
  checkout,
  getCurrentPage,
  getCommitLog,
  diffCommits,
  getHistoryStats,
  getLastCommit,
} from "./history.ts";

import { createProject, addPage } from "./project.ts";
import { createText } from "./tree.ts";

// ============================================================
// 테스트 유틸리티
// ============================================================

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    testsFailed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(message || `Expected ${expectedStr}, got ${actualStr}`);
  }
}

console.log("\n========================================");
console.log("M2-3 테스트 시작");
console.log("========================================\n");

// ============================================================
// 테스트 케이스
// ============================================================

// 테스트 1: DOM 없이 동작
test("DOM 없이 동작 - document/window 안 씀", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  assert(history.pageId === page.id, "pageId 설정");
  assertEquals(history.commits, [], "빈 커밋 목록");
  assertEquals(history.currentIndex, -1, "초기 인덱스 -1");
});

// 테스트 2: 이력 생성
test("createHistory로 이력 객체 생성", () => {
  const history = createHistory("page_123");
  
  assertEquals(history.pageId, "page_123", "pageId 일치");
  assertEquals(history.commits.length, 0, "커밋 없음");
  assertEquals(history.currentIndex, -1, "초기 인덱스 -1");
});

// 테스트 3: 커밋 저장
test("commit으로 현재 페이지 상태 저장", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  const commit1 = commit(history, page, "초기 커밋", "작성자A");
  
  assert(commit1.id.startsWith("commit_"), "커밋 ID 생성");
  assertEquals(commit1.message, "초기 커밋", "메시지 저장");
  assertEquals(commit1.author, "작성자A", "작성자 저장");
  assert(typeof commit1.timestamp === "number", "타임스탬프 생성");
  assert(commit1.snapshot.id === page.id, "스냅샷 저장");
  
  assertEquals(history.commits.length, 1, "커밋 1개");
  assertEquals(history.currentIndex, 0, "HEAD가 0");
});

// 테스트 4: 여러 커밋
test("여러 커밋 저장", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  commit(history, page, "첫 커밋");
  commit(history, page, "두 번째 커밋");
  commit(history, page, "세 번째 커밋");
  
  assertEquals(history.commits.length, 3, "커밋 3개");
  assertEquals(history.currentIndex, 2, "HEAD가 2 (최신)");
});

// 테스트 5: 되돌리기 (undo)
test("undo로 이전 커밋 상태 복원", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  commit(history, page, "첫 커밋");
  const commit2 = commit(history, page, "두 번째 커밋");
  
  const previousPage = undo(history);
  
  assert(previousPage !== null, "undo 성공");
  assertEquals(history.currentIndex, 0, "HEAD가 0으로 이동");
});

// 테스트 6: 앞으로 (redo)
test("redo로 앞 커밋 상태 복원", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  commit(history, page, "첫 커밋");
  commit(history, page, "두 번째 커밋");
  
  undo(history);
  assertEquals(history.currentIndex, 0, "undo 후 HEAD 0");
  
  const nextPage = redo(history);
  
  assert(nextPage !== null, "redo 성공");
  assertEquals(history.currentIndex, 1, "redo 후 HEAD 1");
});

// 테스트 7: undo 후 새 커밋 시 앞 커밋 버려짐
test("undo 후 새 커밋 시 앞 커밋들 버려짐", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  commit(history, page, "A");
  commit(history, page, "B");
  commit(history, page, "C");
  assertEquals(history.commits.length, 3, "커밋 3개");
  
  undo(history, 2); // A로 돌아감
  assertEquals(history.currentIndex, 0, "HEAD가 0 (A)");
  
  commit(history, page, "D"); // 새 커밋
  
  assertEquals(history.commits.length, 2, "B, C는 버려지고 A, D만 남음");
  assertEquals(history.commits[0].message, "A", "첫 커밋은 A");
  assertEquals(history.commits[1].message, "D", "두 번째는 D");
  assertEquals(history.currentIndex, 1, "HEAD는 D");
});

// 테스트 8: checkout 특정 커밋
test("checkout으로 특정 커밋으로 이동", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  const commit1 = commit(history, page, "첫 커밋");
  commit(history, page, "두 번째");
  commit(history, page, "세 번째");
  
  const checkedOut = checkout(history, commit1.id);
  
  assert(checkedOut !== null, "checkout 성공");
  assertEquals(history.currentIndex, 0, "HEAD가 첫 커밋으로");
});

// 테스트 9: 없는 커밋 checkout
test("없는 커밋 checkout은 null", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  const result = checkout(history, "없는ID");
  assertEquals(result, null, "없는 커밋은 null");
});

// 테스트 10: getCurrentPage
test("getCurrentPage로 현재 HEAD 상태 얻기", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  assertEquals(getCurrentPage(history), null, "커밋 없으면 null");
  
  commit(history, page, "커밋");
  const current = getCurrentPage(history);
  
  assert(current !== null, "현재 페이지 있음");
  assert(current.id === page.id, "페이지 ID 일치");
});

// 테스트 11: getCommitLog 최신순
test("getCommitLog는 최신 커밋이 앞", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  commit(history, page, "첫");
  commit(history, page, "둘째");
  commit(history, page, "셋째");
  
  const log = getCommitLog(history);
  assertEquals(log[0].message, "셋째", "최신이 첫째");
  assertEquals(log[1].message, "둘째", "두 번째");
  assertEquals(log[2].message, "첫", "마지막");
});

// 테스트 12: diffCommits 두 커밋 비교
test("diffCommits로 두 커밋 간 차이 분석", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  // 첫 커밋
  const commit1 = commit(history, page, "첫");
  
  // 텍스트 추가 후 두 번째 커밋
  const text = createText("제목", "Hello");
  page.root.children.push(text as any);
  const commit2 = commit(history, page, "둘째");
  
  const changes = diffCommits(history, commit1.id, commit2.id);
  
  assert(changes.length > 0, "변경 감지");
  assert(changes.some((c: any) => c.kind === "added"), "추가 변경 있음");
});

// 테스트 13: getHistoryStats
test("getHistoryStats로 통계 조회", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  commit(history, page, "A");
  commit(history, page, "B");
  
  const stats = getHistoryStats(history);
  assertEquals(stats.totalCommits, 2, "총 2개");
  assertEquals(stats.currentPosition, 1, "현재 1");
  assertEquals(stats.canUndo, true, "undo 가능");
  assertEquals(stats.canRedo, false, "redo 불가 (최신)");
  
  undo(history);
  const stats2 = getHistoryStats(history);
  assertEquals(stats2.currentPosition, 0, "HEAD가 0 (첫 커밋)");
  assertEquals(stats2.canUndo, false, "undo 불가 (첫 커밋)");
  assertEquals(stats2.canRedo, true, "redo 가능");
});

// 테스트 14: 더 이상 undo 불가
test("처음에서 undo하면 null", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  commit(history, page, "A");
  undo(history); // HEAD: 0
  
  const result = undo(history); // 더 이상 불가
  assertEquals(result, null, "불가능");
});

// 테스트 15: 더 이상 redo 불가
test("최신에서 redo하면 null", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  commit(history, page, "A");
  commit(history, page, "B");
  
  const result = redo(history); // 이미 최신
  assertEquals(result, null, "불가능");
});

// 테스트 16: getLastCommit
test("getLastCommit으로 마지막 커밋 조회", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  assertEquals(getLastCommit(history), null, "커밋 없음");
  
  commit(history, page, "마지막");
  const last = getLastCommit(history);
  
  assert(last !== null, "마지막 커밋 있음");
  assertEquals(last.message, "마지막", "메시지 일치");
});

// 테스트 17: snapshot은 깊은 복사
test("snapshot은 깊은 복사 - 원본 변경不影响", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지");
  const history = createHistory(page.id);
  
  const originalName = page.name;
  commit(history, page, "커밋");
  
  // 원본 변경
  page.name = "변경됨";
  
  const snapshot = history.commits[0].snapshot;
  assertEquals(snapshot.name, originalName, "스냅샷은 변경 안 됨");
});

// 테스트 18: 같은 입력 -> 같은 출력 (결정적)
test("같은 입력 -> 같은 출력 (결정적)", () => {
  const project1 = createProject("테스트");
  const page1 = addPage(project1, "페이지");
  const history1 = createHistory(page1.id);
  commit(history1, page1, "A");
  
  const project2 = createProject("테스트");
  const page2 = addPage(project2, "페이지");
  const history2 = createHistory(page2.id);
  commit(history2, page2, "A");
  
  // ID는 다르지만 구조는 동일
  assertEquals(history1.commits.length, history2.commits.length, "커밋 수 동일");
  assertEquals(history1.currentIndex, history2.currentIndex, "HEAD 동일");
});

// ============================================================
// 테스트 결과
// ============================================================

console.log("\n========================================");
console.log("테스트 결과 요약");
console.log("========================================");
console.log(`✅ 통과: ${testsPassed}`);
console.log(`❌ 실패: ${testsFailed}`);
console.log(`총 테스트: ${testsPassed + testsFailed}`);

if (testsFailed === 0) {
  console.log("\n🎉 모든 테스트 통과! M2-3 완료!");
} else {
  console.log("\n⚠️ 일부 테스트 실패");
  process.exit(1);
}

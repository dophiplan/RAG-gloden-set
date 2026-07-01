/**
 * M2-2 테스트: 자연어 뷰 검증
 */

import { describeChanges, summarizeChanges, formatChangeDescription } from "./describe.ts";
import type { Change } from "./diff.ts";

// 테스트 유틸리티
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
console.log("M2-2 테스트 시작");
console.log("========================================\n");

// 테스트 1: 변경 없음
test("변경 없으면 빈 배열", () => {
  const result = describeChanges([]);
  assertEquals(result, [], "빈 배열");
});

// 테스트 2: added 문장
test("added -> 한국어 문장", () => {
  const changes: Change[] = [
    { kind: "added", id: "b1", eleme[기밀마스킹]ype: "input", name: "로그인버튼", parentId: null },
  ];
  const result = describeChanges(changes);
  // "입력요소"는 받침이 없으므로 "를" 사용
  assertEquals(result, ["로그인버튼 입력요소를 추가했습니다"]);
});

// 테스트 3: removed 문장
test("removed -> 한국어 문장", () => {
  const changes: Change[] = [
    { kind: "removed", id: "t1", eleme[기밀마스킹]ype: "text", name: "제목", parentId: null },
  ];
  const result = describeChanges(changes);
  // "제목"은 받침(ㅁ)이 있으므로 "을" 사용
  assertEquals(result, ["제목을 삭제했습니다"]);
});

// 테스트 4: modified content
test("modified content -> 한국어 문장", () => {
  const changes: Change[] = [
    { kind: "modified", id: "t1", name: "제목", property: "content", before: "Hello", after: "World" },
  ];
  const result = describeChanges(changes);
  assertEquals(result, ["제목의 글자를 'Hello'에서 'World'로 바꿨습니다"]);
});

// 테스트 5: modified label
test("modified label -> 한국어 문장", () => {
  const changes: Change[] = [
    { kind: "modified", id: "b1", name: "버튼", property: "label", before: "로그인", after: "시작하기" },
  ];
  const result = describeChanges(changes);
  assertEquals(result, ["버튼의 라벨을 '로그인'에서 '시작하기'로 바꿨습니다"]);
});

// 테스트 6: modified layout.direction
test("modified layout.direction -> 세로/가로", () => {
  const changes: Change[] = [
    { kind: "modified", id: "c1", name: "상자", property: "layout.direction", before: "vertical", after: "horizontal" },
  ];
  const result = describeChanges(changes);
  assertEquals(result, ["상자의 배치를 가로로 바꿨습니다"]);
});

// 테스트 7: modified width (SizeMode)
test("modified width (SizeMode) -> 한국어", () => {
  const changes: Change[] = [
    { kind: "modified", id: "c1", name: "상자", property: "width", before: { mode: "고정", px: 200 }, after: { mode: "비율", percent: 50 } },
  ];
  const result = describeChanges(changes);
  assert(result[0].includes("가로 크기"), "가로 크기 포함");
  assert(result[0].includes("고정 200px"), "고정 200px 포함");
  assert(result[0].includes("비율 50%"), "비율 50% 포함");
});

// 테스트 8: modified bold true
test("modified bold true -> 굵게 했습니다", () => {
  const changes: Change[] = [
    { kind: "modified", id: "t1", name: "제목", property: "bold", before: false, after: true },
  ];
  const result = describeChanges(changes);
  assertEquals(result, ["제목을(를) 굵게 했습니다"]);
});

// 테스트 9: modified bold false
test("modified bold false -> 굵게 해제", () => {
  const changes: Change[] = [
    { kind: "modified", id: "t1", name: "제목", property: "bold", before: true, after: false },
  ];
  const result = describeChanges(changes);
  assertEquals(result, ["제목의 굵게를 해제했습니다"]);
});

// 테스트 10: 묶기 - 부모 삭제시 자식은 제거
test("묶기: 부모 삭제시 자식 삭제는 제거", () => {
  const changes: Change[] = [
    { kind: "removed", id: "parent", eleme[기밀마스킹]ype: "container", name: "카드", parentId: null },
    { kind: "removed", id: "child1", eleme[기밀마스킹]ype: "text", name: "자식1", parentId: "parent" },
    { kind: "removed", id: "child2", eleme[기밀마스킹]ype: "text", name: "자식2", parentId: "parent" },
  ];
  const result = describeChanges(changes);
  assertEquals(result.length, 1, "문장 1개만");
  // "카드"는 받침(ㄷ)이 있으므로 "를"이 아닌 "을" 사용
  assertEquals(result[0], "카드를 삭제했습니다");
});

// 테스트 11: 묶기 - 부모 추가시 자식은 제거
test("묶기: 부모 추가시 자식 추가는 제거", () => {
  const changes: Change[] = [
    { kind: "added", id: "parent", eleme[기밀마스킹]ype: "container", name: "카드", parentId: null },
    { kind: "added", id: "child1", eleme[기밀마스킹]ype: "text", name: "자식1", parentId: "parent" },
    { kind: "added", id: "child2", eleme[기밀마스킹]ype: "button", name: "버튼", parentId: "parent" },
  ];
  const result = describeChanges(changes);
  assertEquals(result.length, 1, "문장 1개만");
  // "상자"는 받침이 없으므로 "를" 사용
  assertEquals(result[0], "카드 상자를 추가했습니다");
});

// 테스트 12: moved 같은 부모
test("moved 같은 부모 -> 순서 변경", () => {
  const changes: Change[] = [
    { kind: "moved", id: "item", name: "아이템", fromParentId: "p1", toParentId: "p1", fromIndex: 0, toIndex: 2 },
  ];
  const result = describeChanges(changes);
  assertEquals(result, ["아이템의 순서를 1번째에서 3번째로 옮겼습니다"]);
});

// 테스트 13: moved 다른 부모
test("moved 다른 부모 -> 다른 위치로", () => {
  const changes: Change[] = [
    { kind: "moved", id: "item", name: "아이템", fromParentId: "p1", toParentId: "p2", fromIndex: 0, toIndex: 0 },
  ];
  const result = describeChanges(changes);
  assertEquals(result, ["아이템을(를) 다른 위치로 옮겼습니다"]);
});

// 테스트 14: summarizeChanges
test("summarizeChanges -> 요약 문자열", () => {
  const changes: Change[] = [
    { kind: "added", id: "a1", eleme[기밀마스킹]ype: "text", name: "추가1", parentId: null },
    { kind: "modified", id: "m1", name: "수정1", property: "content", before: "A", after: "B" },
    { kind: "modified", id: "m2", name: "수정2", property: "label", before: "X", after: "Y" },
  ];
  const result = summarizeChanges(changes);
  assert(result.includes("3건 변경"), "3건 변경 포함");
  assert(result.includes("추가 1"), "추가 1 포함");
  assert(result.includes("수정 2"), "수정 2 포함");
});

// 테스트 15: 결정적 출력
test("같은 입력 -> 같은 출력 (결정적)", () => {
  const changes: Change[] = [
    { kind: "modified", id: "t1", name: "제목", property: "content", before: "A", after: "B" },
  ];
  const result1 = describeChanges(changes);
  const result2 = describeChanges(changes);
  assertEquals(JSON.stringify(result1), JSON.stringify(result2));
});

console.log("\n========================================");
console.log("테스트 결과 요약");
console.log("========================================");
console.log(`✅ 통과: ${testsPassed}`);
console.log(`❌ 실패: ${testsFailed}`);
console.log(`총 테스트: ${testsPassed + testsFailed}`);

if (testsFailed === 0) {
  console.log("\n🎉 모든 테스트 통과! M2-2 완료!");
} else {
  console.log("\n⚠️ 일부 테스트 실패");
  process.exit(1);
}

/**
 * M2-1 테스트: Diff 엔진 검증
 */

import {
  createContainer,
  createText,
  createImage,
  createInput,
  addChild,
} from "./tree.ts";

import {
  diffTrees,
  formatChanges,
  hasChanges,
  filterChangesByKind,
  type Change,
} from "./diff.ts";

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
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual: unknown, expected: unknown, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(message || `Expected ${expectedStr}, got ${actualStr}`);
  }
}

function findChange(changes: Change[], kind: Change["kind"], id: string): Change | undefined {
  return changes.find((c) => c.kind === kind && c.id === id);
}

// ============================================================
// 테스트 케이스
// ============================================================

console.log("\n========================================");
console.log("M2-1 테스트 시작");
console.log("========================================\n");

// --------------------------------------------------------
// 테스트 1: DOM 없이 동작
// --------------------------------------------------------
test("DOM 없이 동작 - document/window 안 씀", () => {
  const oldTree = createContainer("old", { direction: "vertical" });
  const newTree = createContainer("new", { direction: "vertical" });

  const changes = diffTrees(oldTree, newTree);
  
  assert(Array.isArray(changes), "결과는 배열");
});

// --------------------------------------------------------
// 테스트 2: 변경 없음 (빈 배열)
// --------------------------------------------------------
test("같은 트리면 빈 배열 반환", () => {
  const tree = createContainer("루트");
  const text = createText("텍스트", "Hello");
  addChild(tree, text);

  // 깊은 복사
  const treeCopy = JSON.parse(JSON.stringify(tree));

  const changes = diffTrees(tree, treeCopy);
  
  assertEquals(changes.length, 0, "변경 없음");
  assert(!hasChanges(changes), "hasChanges가 false");
});

// --------------------------------------------------------
// 테스트 3: 속성 수정 (modified)
// --------------------------------------------------------
test("속성 1개 변경 → modified 1건", () => {
  const oldTree = createContainer("루트");
  const oldText = createText("텍스트", "Hello");
  addChild(oldTree, oldText);

  // 깊은 복사 후 수정
  const newTree = JSON.parse(JSON.stringify(oldTree));
  newTree.children[0].content = "World"; // content 변경

  const changes = diffTrees(oldTree, newTree);

  // 루트는 같으므로 text 변경만 감지
  const modifiedChanges = filterChangesByKind(changes, "modified");
  assertEquals(modifiedChanges.length, 1, "modified 1건");
  assertEquals(modifiedChanges[0].kind, "modified", "modified 종류");
  assertEquals(modifiedChanges[0].property, "content", "content 속성");
  assertEquals((modifiedChanges[0] as { before: string }).before, "Hello", "before 값");
  assertEquals((modifiedChanges[0] as { after: string }).after, "World", "after 값");
});

// --------------------------------------------------------
// 테스트 4: 속성 여러 개 변경 → 각각 별도 modified
// --------------------------------------------------------
test("속성 여러 개 변경 → 각각 별도 modified", () => {
  const oldTree = createContainer("루트");
  const oldText = createText("텍스트", "Hello");
  oldText.fontSize = 16;
  addChild(oldTree, oldText);

  const newTree = createContainer("루트");
  const newText = createText("텍스트", "World"); // content 변경
  newText.id = oldText.id;
  newText.fontSize = 20; // fontSize도 변경
  addChild(newTree, newText);

  const changes = diffTrees(oldTree, newTree);

  const contentChange = findChange(changes, "modified", oldText.id);
  assert(contentChange, "content 변경 있음");
  
  // 2개의 modified 변경이 있어야 함
  const modifiedChanges = filterChangesByKind(changes, "modified");
  assertEquals(modifiedChanges.length, 2, "modified 2건");
});

// --------------------------------------------------------
// 테스트 5: 자식 추가 → added
// --------------------------------------------------------
test("자식 추가 → added", () => {
  const oldTree = createContainer("루트");

  // 깊은 복사 후 자식 추가
  const newTree = JSON.parse(JSON.stringify(oldTree));
  const newButton = createInput("버튼", "button", "클릭");
  newTree.children.push(newButton);

  const changes = diffTrees(oldTree, newTree);

  const addedChanges = filterChangesByKind(changes, "added");
  assertEquals(addedChanges.length, 1, "added 1건");
  assertEquals(addedChanges[0].kind, "added", "added 종류");
  assertEquals((addedChanges[0] as { eleme[기밀마스킹]ype: string }).eleme[기밀마스킹]ype, "input", "input 타입");
  assertEquals((addedChanges[0] as { parentId: string }).parentId, newTree.id, "parentId는 루트");
});

// --------------------------------------------------------
// 테스트 6: 자식 삭제 → removed
// --------------------------------------------------------
test("자식 삭제 → removed", () => {
  const oldTree = createContainer("루트");
  const oldButton = createInput("버튼", "button", "클릭");
  addChild(oldTree, oldButton);

  // 깊은 복사 후 자식 삭제
  const newTree = JSON.parse(JSON.stringify(oldTree));
  newTree.children = [];

  const changes = diffTrees(oldTree, newTree);

  const removedChanges = filterChangesByKind(changes, "removed");
  assertEquals(removedChanges.length, 1, "removed 1건");
  assertEquals(removedChanges[0].kind, "removed", "removed 종류");
  assertEquals((removedChanges[0] as { eleme[기밀마스킹]ype: string }).eleme[기밀마스킹]ype, "input", "input 타입");
});

// --------------------------------------------------------
// 테스트 7: 같은 부모 내 순서 변경 → moved
// --------------------------------------------------------
test("같은 부모 내 순서 변경 → moved", () => {
  const oldTree = createContainer("루트");
  const email = createInput("이메일", "textfield", "이메일");
  const password = createInput("비밀번호", "textfield", "비밀번호");
  addChild(oldTree, email);    // index 0
  addChild(oldTree, password); // index 1

  const newTree = createContainer("루트");
  const email2 = createInput("이메일", "textfield", "이메일");
  const password2 = createInput("비밀번호", "textfield", "비밀번호");
  email2.id = email.id;
  password2.id = password.id;
  addChild(newTree, password2); // index 0
  addChild(newTree, email2);    // index 1

  const changes = diffTrees(oldTree, newTree);

  const movedChanges = filterChangesByKind(changes, "moved");
  assertEquals(movedChanges.length, 2, "moved 2건 (둘 다 움직임)");

  const emailMove = findChange(changes, "moved", email.id) as { fromIndex: number; toIndex: number };
  assert(emailMove, "이메일 이동 있음");
  assertEquals(emailMove.fromIndex, 0, "이메일 from 0");
  assertEquals(emailMove.toIndex, 1, "이메일 to 1");
});

// --------------------------------------------------------
// 테스트 8: 다른 부모로 이동 → moved (fromParentId/toParentId)
// --------------------------------------------------------
test("다른 부모로 이동 → moved (fromParentId/toParentId)", () => {
  const oldTree = createContainer("루트");
  const oldBox1 = createContainer("상자1");
  const oldBox2 = createContainer("상자2");
  const text = createText("텍스트", "Hello");
  addChild(oldBox1, text);
  addChild(oldTree, oldBox1);
  addChild(oldTree, oldBox2);

  const newTree = createContainer("루트");
  const newBox1 = createContainer("상자1");
  const newBox2 = createContainer("상자2");
  const text2 = createText("텍스트", "Hello");
  text2.id = text.id;
  addChild(newBox2, text2); // 상자2로 이동
  newBox1.id = oldBox1.id;
  newBox2.id = oldBox2.id;
  addChild(newTree, newBox1);
  addChild(newTree, newBox2);

  const changes = diffTrees(oldTree, newTree);

  const moveChange = findChange(changes, "moved", text.id) as { fromParentId: string; toParentId: string };
  assert(moveChange, "이동 변경 있음");
  assertEquals(moveChange.fromParentId, oldBox1.id, "fromParentId는 상자1");
  assertEquals(moveChange.toParentId, oldBox2.id, "toParentId는 상자2");
});

// --------------------------------------------------------
// 테스트 9: 중첩 깊은 곳의 변경도 잡힘
// --------------------------------------------------------
test("중첩 깊은 곳의 변경도 감지됨", () => {
  const oldTree = createContainer("루트");
  const level1 = createContainer("레벨1");
  const level2 = createContainer("레벨2");
  const deepText = createText("깊은텍스트", "Old");
  addChild(level2, deepText);
  addChild(level1, level2);
  addChild(oldTree, level1);

  const newTree = createContainer("루트");
  const level1n = createContainer("레벨1");
  const level2n = createContainer("레벨2");
  const deepText2 = createText("깊은텍스트", "New");
  deepText2.id = deepText.id;
  addChild(level2n, deepText2);
  level1n.id = level1.id;
  level2n.id = level2.id;
  addChild(level1n, level2n);
  addChild(newTree, level1n);

  const changes = diffTrees(oldTree, newTree);

  const modifiedChanges = filterChangesByKind(changes, "modified");
  assertEquals(modifiedChanges.length, 1, "깊은 곳의 수정 감지");
  assertEquals((modifiedChanges[0] as { after: string }).after, "New", "내용 변경 확인");
});

// --------------------------------------------------------
// 테스트 10: SizeMode 변경 감지
// --------------------------------------------------------
test("SizeMode 변경 감지 - 고정 200px→300px", () => {
  const oldTree = createContainer("루트", {}, { width: { mode: "고정", px: 200 } });
  const newTree = createContainer("루트", {}, { width: { mode: "고정", px: 300 } });
  newTree.id = oldTree.id;

  const changes = diffTrees(oldTree, newTree);

  const modifiedChanges = filterChangesByKind(changes, "modified");
  assertEquals(modifiedChanges.length, 1, "SizeMode 변경 감지");
  const change = modifiedChanges[0] as { property: string; after: { mode: string; px: number } };
  assertEquals(change.property, "width", "width 속성");
  assertEquals(change.after.px, 300, "300px로 변경");
});

// --------------------------------------------------------
// 테스트 11: SizeMode 변경 - 비율 30%→50%
// --------------------------------------------------------
test("SizeMode 변경 감지 - 비율 30%→50%", () => {
  const oldTree = createContainer("루트", {}, { width: { mode: "비율", percent: 30 } });
  const newTree = createContainer("루트", {}, { width: { mode: "비율", percent: 50 } });
  newTree.id = oldTree.id;

  const changes = diffTrees(oldTree, newTree);

  const modifiedChanges = filterChangesByKind(changes, "modified");
  assertEquals(modifiedChanges.length, 1, "비율 변경 감지");
  const change = modifiedChanges[0] as { after: { mode: string; percent: number } };
  assertEquals(change.after.percent, 50, "50%로 변경");
});

// --------------------------------------------------------
// 테스트 12: SizeMode 변경 - 꽉채움↔고정
// --------------------------------------------------------
test("SizeMode 변경 감지 - 꽉채움↔고정", () => {
  const oldTree = createContainer("루트", {}, { width: { mode: "꽉채움" } });
  const newTree = createContainer("루트", {}, { width: { mode: "고정", px: 100 } });
  newTree.id = oldTree.id;

  const changes = diffTrees(oldTree, newTree);

  const modifiedChanges = filterChangesByKind(changes, "modified");
  assertEquals(modifiedChanges.length, 1, "모드 변경 감지");
  const change = modifiedChanges[0] as { after: { mode: string } };
  assertEquals(change.after.mode, "고정", "고정 모드로 변경");
});

// --------------------------------------------------------
// 테스트 13: 결정적 출력 (같은 입력 → 같은 출력)
// --------------------------------------------------------
test("같은 입력 → 같은 출력 (결정적)", () => {
  const oldTree = createContainer("old");
  const newTree = createContainer("new");
  const text = createText("텍스트", "Hello");
  addChild(newTree, text);

  const changes1 = diffTrees(oldTree, newTree);
  const changes2 = diffTrees(oldTree, newTree);

  assertEquals(JSON.stringify(changes1), JSON.stringify(changes2), "결과 동일");
});

// --------------------------------------------------------
// 테스트 14: layout 속성 변경 감지
// --------------------------------------------------------
test("layout 속성 변경 감지", () => {
  const oldTree = createContainer("루트", {
    direction: "vertical",
    align: "start",
    gap: 8,
    padding: 16,
  });

  const newTree = createContainer("루트", {
    direction: "horizontal",
    align: "center",
    gap: 20,
    padding: 32,
  });
  newTree.id = oldTree.id;

  const changes = diffTrees(oldTree, newTree);

  const modifiedChanges = filterChangesByKind(changes, "modified");
  // direction, align, gap, padding = 4개 변경
  assertEquals(modifiedChanges.length, 4, "layout 변경 4건");

  const directionChange = modifiedChanges.find((c) => (c as { property: string }).property === "layout.direction");
  assert(directionChange, "direction 변경 있음");
});

// --------------------------------------------------------
// 테스트 15: formatChanges 함수
// --------------------------------------------------------
test("formatChanges가 문자열로 변환", () => {
  const oldTree = createContainer("루트");
  const newTree = createContainer("루트");
  const text = createText("텍스트", "Hello");
  addChild(newTree, text);

  const changes = diffTrees(oldTree, newTree);
  const formatted = formatChanges(changes);

  assert(typeof formatted === "string", "문자열 반환");
  assert(formatted.includes("+"), "추가 표시");
});

// ============================================================
// 테스트 결과 요약
// ============================================================

console.log("\n========================================");
console.log("테스트 결과 요약");
console.log("========================================");
console.log(`✅ 통과: ${testsPassed}`);
console.log(`❌ 실패: ${testsFailed}`);
console.log(`총 테스트: ${testsPassed + testsFailed}`);

if (testsFailed === 0) {
  console.log("\n🎉 모든 테스트 통과! M2-1 완료!");
} else {
  console.log("\n⚠️ 일부 테스트 실패");
  process.exit(1);
}

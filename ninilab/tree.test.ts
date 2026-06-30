/**
 * M0-1 테스트 스위트
 * 모든 테스트가 통과해야 M0-1 완료
 */

import {
  createContainer,
  createText,
  createImage,
  createInput,
  addChild,
  removeChild,
  findById,
  collectAllIds,
  countNodes,
  type Element,
  type ContainerElement,
} from "./tree.ts";

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

// ============================================================
// 테스트 케이스
// ============================================================

console.log("\n========================================");
console.log("M0-1 테스트 시작");
console.log("========================================\n");

// --------------------------------------------------------
// 테스트 1: 상자를 만들고 그 안에 text를 addChild하면, 
// 상자의 children에 그 text가 들어있다.
// --------------------------------------------------------
test("상자에 text 추가하면 children에 들어간다", () => {
  const root = createContainer("로그인 화면", {
    direction: "vertical",
    align: "center",
    gap: 20,
    padding: 40,
  });
  const title = createText("제목", "로그인");
  const btn = createInput("로그인버튼", "button", "로그인");

  addChild(root, title);
  addChild(root, btn);

  assertEquals(root.children.length, 2, "children 개수가 2여야 함");
  assertEquals(root.children[0].type, "text", "첫 번째 자식은 text 타입");
  assertEquals(root.children[1].type, "input", "두 번째 자식은 input 타입");
  assertEquals((root.children[0] as { content: string }).content, "로그인", "text 내용 확인");
});

// --------------------------------------------------------
// 테스트 2: 상자 안에 상자를 넣을 수 있다 (중첩).
// 2단계 중첩한 뒤 findById로 제일 안쪽 노드를 찾을 수 있다.
// --------------------------------------------------------
test("상자 안에 상자 중첩 가능, findById로 찾을 수 있다", () => {
  const outer = createContainer("바깥 상자");
  const middle = createContainer("중간 상자");
  const inner = createText("안쪽 텍스트", "안녕");

  addChild(outer, middle);
  addChild(middle, inner);

  // 중첩 구조 확인
  assertEquals(outer.children.length, 1, "outer의 children 개수");
  assertEquals(outer.children[0], middle, "outer의 첫 번째 자식은 middle");
  
  const middleContainer = outer.children[0] as ContainerElement;
  assertEquals(middleContainer.children.length, 1, "middle의 children 개수");
  assertEquals(middleContainer.children[0], inner, "middle의 첫 번째 자식은 inner");

  // findById로 안쪽 노드 찾기
  const foundInner = findById(outer, inner.id);
  assert(foundInner !== null, "inner를 찾아야 함");
  assertEquals(foundInner?.id, inner.id, "찾은 노드의 id가 일치해야 함");
  assertEquals((foundInner as { content: string }).content, "안녕", "찾은 노드의 content 확인");

  // findById로 중간 노드 찾기
  const foundMiddle = findById(outer, middle.id);
  assert(foundMiddle !== null, "middle을 찾아야 함");
  assertEquals(foundMiddle?.type, "container", "찾은 노드는 container 타입");
});

// --------------------------------------------------------
// 테스트 3: text 노드에 addChild를 시도하면 에러가 난다
// (잎은 자식을 못 가짐)
// --------------------------------------------------------
test("text 노드에 addChild 시도하면 에러가 발생한다", () => {
  const textNode = createText("텍스트", "내용");
  const anotherText = createText("추가텍스트", "추가");

  let errorThrown = false;
  let errorMessage = "";

  try {
    addChild(textNode, anotherText);
  } catch (error) {
    errorThrown = true;
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  assert(errorThrown, "에러가 발생해야 함");
  assert(errorMessage.includes("Cannot add child"), "에러 메시지 확인");
});

// --------------------------------------------------------
// 테스트 4: removeChild로 자식을 빼면 children에서 사라진다
// --------------------------------------------------------
test("removeChild로 자식을 제거하면 children에서 사라진다", () => {
  const container = createContainer("컨테이너");
  const child1 = createText("자식1", "내용1");
  const child2 = createText("자식2", "내용2");
  const child3 = createText("자식3", "내용3");

  addChild(container, child1);
  addChild(container, child2);
  addChild(container, child3);

  assertEquals(container.children.length, 3, "초기 children 개수는 3");

  // 중간 자식 제거
  const removed = removeChild(container, child2.id);
  
  assert(removed, "제거 성공 시 true 반환");
  assertEquals(container.children.length, 2, "제거 후 children 개수는 2");
  assertEquals(container.children[0].id, child1.id, "첫 번째 자식은 그대로");
  assertEquals(container.children[1].id, child3.id, "두 번째 자식은 child3 (child2가 제거됨)");

  // 없는 id로 제거 시도
  const notFound = removeChild(container, "non-existent-id");
  assert(!notFound, "없는 id 제거 시 false 반환");
});

// --------------------------------------------------------
// 테스트 5: 모든 노드의 id가 서로 다르다 (중복 없음)
// --------------------------------------------------------
test("모든 노드의 id가 고유하다 (중복 없음)", () => {
  const root = createContainer("루트");
  const container1 = createContainer("상자1");
  const container2 = createContainer("상자2");
  const text1 = createText("텍스트1", "내용1");
  const text2 = createText("텍스트2", "내용2");
  const image = createImage("이미지", "img.png");
  const input = createInput("버튼", "button", "클릭");

  addChild(root, container1);
  addChild(root, container2);
  addChild(container1, text1);
  addChild(container1, image);
  addChild(container2, text2);
  addChild(container2, input);

  const allIds = collectAllIds(root);
  const totalNodes = countNodes(root);

  assertEquals(allIds.size, totalNodes, "ID 개수가 노드 개수와 같아야 함 (중복 없음)");
  assertEquals(totalNodes, 7, "총 7개 노드");
});

// --------------------------------------------------------
// 테스트 6: 출력된 JSON 어디에도 x, y, top, left 같은 
// 좌표 필드가 없다
// --------------------------------------------------------
test("JSON 출력에 좌표 필드(x, y, top, left)가 없다", () => {
  const root = createContainer("로그인 화면", {
    direction: "vertical",
    align: "center",
    gap: 20,
    padding: 40,
  });
  const title = createText("제목", "로그인");
  const innerBox = createContainer("내부상자");
  const btn = createInput("로그인버튼", "button", "로그인");

  addChild(root, title);
  addChild(root, innerBox);
  addChild(innerBox, btn);

  const jsonStr = JSON.stringify(root, null, 2);

  // 좌표 관련 필드가 없는지 확인
  const forbiddenFields = ["x", "y", "top", "left", "right", "bottom", "width", "height", "position"];
  
  for (const field of forbiddenFields) {
    // "xxx": 패턴을 찾아서 필드명이 키로 사용되는지 확인
    const regex = new RegExp(`"${field}"\\s*:`);
    assert(!regex.test(jsonStr), `JSON에 '${field}' 필드가 없어야 함`);
  }

  console.log("   📄 생성된 JSON 구조:");
  console.log(jsonStr.split("\n").map(l => "   " + l).join("\n"));
});

// --------------------------------------------------------
// 추가 테스트: createImage 동작 확인
// --------------------------------------------------------
test("createImage가 올바르게 동작한다", () => {
  const img = createImage("로고", "logo.png", "회사 로고");
  
  assertEquals(img.type, "image", "타입은 image");
  assertEquals(img.src, "logo.png", "src 확인");
  assertEquals(img.alt, "회사 로고", "alt 확인");
  assert(img.id.startsWith("el_"), "id는 el_로 시작");
});

// --------------------------------------------------------
// 추가 테스트: createInput의 inputType 확인
// --------------------------------------------------------
test("createInput의 inputType이 올바르게 설정된다", () => {
  const button = createInput("확인버튼", "button", "확인");
  const textfield = createInput("입력창", "textfield", "이메일 입력");
  
  assertEquals(button.inputType, "button", "button 타입 확인");
  assertEquals(textfield.inputType, "textfield", "textfield 타입 확인");
  assertEquals(button.label, "확인", "button 라벨 확인");
  assertEquals(textfield.label, "이메일 입력", "textfield 라벨 확인");
});

// --------------------------------------------------------
// 추가 테스트: findById로 존재하지 않는 id 검색 시 null 반환
// --------------------------------------------------------
test("findById는 없는 id에 대해 null을 반환한다", () => {
  const root = createContainer("루트");
  const child = createText("자식", "내용");
  addChild(root, child);

  const notFound = findById(root, "non-existent-id");
  assertEquals(notFound, null, "없는 id는 null 반환");
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
  console.log("\n🎉 모든 테스트 통과! M0-1 완료!");
} else {
  console.log("\n⚠️ 일부 테스트 실패");
  Deno.exit(1);
}

/**
 * M3-1 테스트: 프로젝트/페이지/토큰 검증
 */

import {
  createProject,
  addPage,
  removePage,
  findPage,
  findPageByName,
  setTokenValue,
  setTokenComponent,
  removeTokenValue,
  resolveToken,
  resolveCompone[기밀마스킹]oken,
  resolveStyle,
  getProjectStats,
  serializeProject,
  deserializeProject,
} from "./project.ts";

import { createContainer, createText } from "./tree.ts";

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
console.log("M3-1 테스트 시작");
console.log("========================================\n");

// ============================================================
// 테스트 케이스
// ============================================================

// 테스트 1: DOM 없이 동작
test("DOM 없이 동작 - document/window 안 씀", () => {
  const project = createProject("테스트");
  assert(typeof project.id === "string", "프로젝트 ID는 문자열");
  assert(project.pages.length === 0, "페이지 없음");
});

// 테스트 2: 프로젝트 생성
test("createProject가 유효한 Project 객체 생성", () => {
  const project = createProject("로그인 앱");
  
  assert(project.id.startsWith("proj_"), "ID는 proj_로 시작");
  assertEquals(project.name, "로그인 앱", "이름 일치");
  assertEquals(project.tokens.values, {}, "빈 값 토큰");
  assertEquals(project.tokens.components, {}, "빈 컴포넌트 토큰");
  assertEquals(project.pages, [], "빈 페이지 배열");
});

// 테스트 3: 페이지 추가
test("addPage로 페이지 추가, pages 배열에 들어감", () => {
  const project = createProject("테스트");
  const page = addPage(project, "로그인 화면");
  
  assert(page.id.startsWith("page_"), "페이지 ID는 page_로 시작");
  assertEquals(page.name, "로그인 화면", "페이지 이름");
  assert(page.root.type === "container", "루트는 container");
  assertEquals(project.pages.length, 1, "페이지 1개");
  assert(project.pages[0] === page, "pages 배열에 추가됨");
});

// 테스트 4: 페이지 추가 시 루트 지정
test("addPage시 기존 트리를 루트로 지정", () => {
  const project = createProject("테스트");
  const customRoot = createContainer("커스텀", { direction: "horizontal" });
  const page = addPage(project, "회원가입", customRoot);
  
  assert(page.root === customRoot, "지정한 루트 사용");
  assertEquals(page.root.layout.direction, "horizontal", "루트 설정 유지");
});

// 테스트 5: 페이지 삭제
test("removePage로 페이지 삭제, pages 배열에서 제거", () => {
  const project = createProject("테스트");
  const page = addPage(project, "페이지1");
  const page2 = addPage(project, "페이지2");
  
  assertEquals(project.pages.length, 2, "삭제 전 2개");
  
  const removed = removePage(project, page.id);
  assert(removed, "삭제 성공");
  assertEquals(project.pages.length, 1, "삭제 후 1개");
  assert(project.pages[0].id === page2.id, "남은 페이지 확인");
});

// 테스트 6: 페이지 찾기
test("findPage로 페이지 찾기", () => {
  const project = createProject("테스트");
  const page = addPage(project, "타겟페이지");
  addPage(project, "다른페이지");
  
  const found = findPage(project, page.id);
  assert(found !== null, "페이지 찾음");
  assert(found?.id === page.id, "ID 일치");
  
  const notFound = findPage(project, "없는ID");
  assert(notFound === null, "없는 ID는 null");
});

// 테스트 7: 페이지 이름으로 찾기
test("findPageByName으로 이름으로 찾기", () => {
  const project = createProject("테스트");
  addPage(project, "페이지A");
  addPage(project, "페이지B");
  
  const found = findPageByName(project, "페이지B");
  assert(found !== null, "이름으로 찾음");
  assertEquals(found?.name, "페이지B", "이름 일치");
});

// 테스트 8: 토큰 등록
test("setTokenValue로 값 토큰 등록", () => {
  const project = createProject("테스트");
  setTokenValue(project, "basic-color", "#f8f9fa");
  setTokenValue(project, "gap-md", 16);
  
  assertEquals(project.tokens.values["basic-color"], "#f8f9fa", "색상 토큰");
  assertEquals(project.tokens.values["gap-md"], 16, "숫자 토큰");
});

// 테스트 9: 토큰 값 조회
test("resolveToken으로 토큰 값 조회", () => {
  const project = createProject("테스트");
  setTokenValue(project, "primary-color", "#2D6CDF");
  
  const value = resolveToken(project.tokens, "primary-color");
  assertEquals(value, "#2D6CDF", "토큰 값 조회");
  
  const notFound = resolveToken(project.tokens, "없는토큰");
  assertEquals(notFound, null, "없는 토큰은 null");
});

// 테스트 10: resolveStyle - 값 직접 지정
test("resolveStyle - 값 직접 지정은 그대로 반환", () => {
  const project = createProject("테스트");
  
  const result = resolveStyle("#ffffff", project.tokens);
  assertEquals(result, "#ffffff", "값 직접 지정");
});

// 테스트 11: resolveStyle - 토큰 참조
test("resolveStyle - 토큰 참조는 토큰표에서 조회", () => {
  const project = createProject("테스트");
  setTokenValue(project, "bg-color", "#f0f0f0");
  
  const result = resolveStyle({ token: "bg-color" }, project.tokens);
  assertEquals(result, "#f0f0f0", "토큰 값 해석");
});

// 테스트 12: resolveStyle - 없는 토큰은 null
test("resolveStyle - 없는 토큰은 null (에러 아님)", () => {
  const project = createProject("테스트");
  
  const result = resolveStyle({ token: "없는토큰" }, project.tokens);
  assertEquals(result, null, "없는 토큰은 null");
});

// 테스트 13: 컴포넌트 토큰 등록/조회
test("컴포넌트 토큰 등록 및 조회", () => {
  const project = createProject("테스트");
  const buttonComponent = createContainer("버튼컴포넌트", { direction: "horizontal" });
  
  setTokenComponent(project, "primary-button", buttonComponent);
  
  const found = project.tokens.components["primary-button"];
  assert(found === buttonComponent, "컴포넌트 토큰 저장");
  
  const resolved = resolveCompone[기밀마스킹]oken(project.tokens, "primary-button");
  assert(resolved === buttonComponent, "컴포넌트 토큰 조회");
});

// 테스트 14: 토큰 삭제
test("removeTokenValue로 토큰 삭제", () => {
  const project = createProject("테스트");
  setTokenValue(project, "temp-color", "#ff0000");
  
  const removed = removeTokenValue(project, "temp-color");
  assert(removed, "삭제 성공");
  assert(!("temp-color" in project.tokens.values), "토큰 삭제 확인");
  
  const notRemoved = removeTokenValue(project, "없는토큰");
  assert(!notRemoved, "없는 토큰 삭제는 false");
});

// 테스트 15: 프로젝트 통계
test("getProjectStats로 통계 조회", () => {
  const project = createProject("테스트");
  addPage(project, "페이지1");
  addPage(project, "페이지2");
  setTokenValue(project, "color1", "#fff");
  setTokenValue(project, "color2", "#000");
  
  const stats = getProjectStats(project);
  assertEquals(stats.pageCount, 2, "페이지 2개");
  assertEquals(stats.valueTokenCount, 2, "값 토큰 2개");
  assertEquals(stats.compone[기밀마스킹]okenCount, 0, "컴포넌트 토큰 0개");
});

// 테스트 16: 직렬화/역직렬화
test("serializeProject/deserializeProject", () => {
  const project = createProject("직렬화테스트");
  addPage(project, "페이지1");
  setTokenValue(project, "test-color", "#123456");
  
  const json = serializeProject(project);
  assert(json.includes("직렬화테스트"), "JSON에 이름 포함");
  assert(json.includes("test-color"), "JSON에 토큰 포함");
  
  const restored = deserializeProject(json);
  assertEquals(restored.name, "직렬화테스트", "이름 복원");
  assertEquals(restored.pages.length, 1, "페이지 복원");
  assertEquals(restored.tokens.values["test-color"], "#123456", "토큰 복원");
});

// 테스트 17: 페이지별 독립적인 루트
test("페이지별 root는 독립적인 ContainerElement", () => {
  const project = createProject("테스트");
  const page1 = addPage(project, "페이지1");
  const page2 = addPage(project, "페이지2");
  
  assert(page1.root !== page2.root, "다른 루트 객체");
  assert(page1.root.id !== page2.root.id, "다른 루트 ID");
});

// 테스트 18: 같은 입력 → 같은 출력 (결정적)
test("같은 입력 -> 같은 출력 (결정적)", () => {
  const project1 = createProject("테스트");
  const project2 = createProject("테스트");
  
  // ID는 다르지만 구조는 동일
  assertEquals(project1.name, project2.name, "이름 동일");
  assertEquals(project1.pages.length, project2.pages.length, "페이지 수 동일");
  assertEquals(
    Object.keys(project1.tokens.values).length,
    Object.keys(project2.tokens.values).length,
    "토큰 수 동일"
  );
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
  console.log("\n🎉 모든 테스트 통과! M3-1 완료!");
} else {
  console.log("\n⚠️ 일부 테스트 실패");
  process.exit(1);
}

/**
 * M1-1 테스트: exportHtmlCss 함수 검증
 */

import {
  createContainer,
  createText,
  createImage,
  createInput,
  addChild,
} from "./tree.ts";

import {
  exportHtmlCss,
  exportFullHtml,
  exportSeparateFiles,
} from "./export.ts";

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

function assertContains(haystack: string, needle: string, message?: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(message || `Expected to contain "${needle}"`);
  }
}

function assertNotContains(haystack: string, needle: string, message?: string): void {
  if (haystack.includes(needle)) {
    throw new Error(message || `Expected NOT to contain "${needle}"`);
  }
}

// ============================================================
// 테스트 케이스
// ============================================================

console.log("\n========================================");
console.log("M1-1 테스트 시작");
console.log("========================================\n");

// --------------------------------------------------------
// 테스트 1: DOM 없이 동작 (Node/Deno에서 그냥 돈다)
// --------------------------------------------------------
test("DOM 없이 동작 - document/window 안 씀", () => {
  const root = createContainer("테스트", { direction: "vertical" });
  const text = createText("텍스트", "Hello");
  addChild(root, text);

  const result = exportHtmlCss(root);
  
  assert(typeof result.html === "string", "HTML은 문자열");
  assert(typeof result.css === "string", "CSS는 문자열");
  assert(result.html.length > 0, "HTML이 비어있지 않음");
  assert(result.css.length > 0, "CSS가 비어있지 않음");
});

// --------------------------------------------------------
// 테스트 2: 중첩 상자 트리가 중첩 <div>로 변환
// --------------------------------------------------------
test("중첩 상자가 중첩 div로 변환된다", () => {
  const root = createContainer("루트");
  const child = createContainer("자식");
  const grandchild = createText("손자", "내용");
  
  addChild(root, child);
  addChild(child, grandchild);

  const result = exportHtmlCss(root);
  
  assertContains(result.html, "<div", "div 태그 있음");
  assertContains(result.html, "</div>", "닫는 div 태그 있음");
  // 중첩 구조 확인 (들여쓰기로 구분)
  const lines = result.html.split("\n");
  const divLines = lines.filter((l) => l.includes("<div"));
  assert(divLines.length >= 2, "최소 2개의 div 있음");
});

// --------------------------------------------------------
// 테스트 3: 요소 타입 매핑 검증
// --------------------------------------------------------
test("요소 타입이 올바른 HTML 태그로 매핑된다", () => {
  const root = createContainer("루트");
  const text = createText("텍스트", "Hello");
  const image = createImage("이미지", "img.png", "설명");
  const button = createInput("버튼", "button", "클릭");
  const input = createInput("입력", "textfield", "입력하세요");

  addChild(root, text);
  addChild(root, image);
  addChild(root, button);
  addChild(root, input);

  const result = exportHtmlCss(root);
  
  // container → div
  assertContains(result.html, "<div", "container는 div");
  // text → span
  assertContains(result.html, "<span", "text는 span");
  assertContains(result.html, "</span>", "text는 span (닫는 태그)");
  // image → img
  assertContains(result.html, "<img", "image는 img");
  // input(button) → button
  assertContains(result.html, "<button", "input(button)은 button");
  assertContains(result.html, "</button>", "button 닫는 태그");
  // input(textfield) → input
  assertContains(result.html, '<input', "input(textfield)은 input");
});

// --------------------------------------------------------
// 테스트 4: flex-direction 변환
// --------------------------------------------------------
test("direction이 flex-direction으로 변환된다", () => {
  const vertical = createContainer("세로", { direction: "vertical" });
  const horizontal = createContainer("가로", { direction: "horizontal" });

  const resultV = exportHtmlCss(vertical);
  const resultH = exportHtmlCss(horizontal);

  assertContains(resultV.css, "flex-direction: column", "vertical은 column");
  assertContains(resultH.css, "flex-direction: row", "horizontal은 row");
});

// --------------------------------------------------------
// 테스트 5: gap/padding/align 반영
// --------------------------------------------------------
test("gap, padding, align이 CSS에 반영된다", () => {
  const root = createContainer("테스트", {
    direction: "vertical",
    align: "center",
    gap: 20,
    padding: 32,
  });

  const result = exportHtmlCss(root);

  assertContains(result.css, "gap: 20px", "gap 반영");
  assertContains(result.css, "padding: 32px", "padding 반영");
  assertContains(result.css, "align-items: center", "align 반영");
  assertContains(result.css, "justify-content: center", "align 반영 (justify-content)");
});

// --------------------------------------------------------
// 테스트 6: 크기 설정 변환 (고정/꽉채움/비율)
// --------------------------------------------------------
test("크기 설정이 올바른 CSS로 변환된다", () => {
  // 고정 크기
  const fixed = createContainer("고정", {}, { width: { mode: "고정", px: 200 } });
  const resultF = exportHtmlCss(fixed);
  assertContains(resultF.css, "width: 200px", "고정 크기는 px");

  // 꽉채움
  const fill = createContainer("꽉채움", {}, { width: { mode: "꽉채움" } });
  const resultFi = exportHtmlCss(fill);
  assertContains(resultFi.css, "flex: 1", "꽉채움은 flex: 1");

  // 비율
  const ratio = createContainer("비율", {}, { width: { mode: "비율", percent: 30 } });
  const resultR = exportHtmlCss(ratio);
  assertContains(resultR.css, "width: 30%", "비율은 %");
});

// --------------------------------------------------------
// 테스트 7: 절대좌표가 출력에 없음
// --------------------------------------------------------
test("출력에 절대좌표(x/y/top/left/position)가 없다", () => {
  const root = createContainer("테스트", {
    direction: "vertical",
    align: "center",
    gap: 20,
    padding: 32,
  });
  const child = createText("텍스트", "Hello");
  addChild(root, child);

  const result = exportHtmlCss(root);
  const output = result.html + result.css;

  assertNotContains(output, "position:", "position 없음");
  assertNotContains(output, "position: absolute", "absolute 없음");
  assertNotContains(output, "position: relative", "relative 없음");
  assertNotContains(output, "left:", "left 없음");
  assertNotContains(output, "top:", "top 없음");
  assertNotContains(output, "right:", "right 없음");
  assertNotContains(output, "bottom:", "bottom 없음");
  assertNotContains(output, "x:", "x 좌표 없음");
  // "y:" 만 체크하면 type:"text"에서 오탐지됨. CSS 속성으로서의 y는 없음
});

// --------------------------------------------------------
// 테스트 8: 스타일이 클래스로 분리됨 (인라인 ❌)
// --------------------------------------------------------
test("스타일이 클래스로 분리되어 있다 (인라인 style 없음)", () => {
  const root = createContainer("테스트", {
    direction: "vertical",
    gap: 20,
  });
  const text = createText("텍스트", "Hello");
  text.fontSize = 16;
  addChild(root, text);

  const result = exportHtmlCss(root);

  // 인라인 style 없음
  assertNotContains(result.html, 'style="', "인라인 style 없음");
  assertNotContains(result.html, "style='", "인라인 style 없음 (작은따옴표)");

  // 클래스로 스타일 분리됨
  assertContains(result.html, 'class="', "class 속성 있음");
  assertContains(result.css, ".el-", "CSS 클래스 규칙 있음");
});

// --------------------------------------------------------
// 테스트 9: 결정적 출력 (같은 입력 → 같은 출력)
// --------------------------------------------------------
test("같은 트리를 두 번 넣으면 같은 출력이 나온다", () => {
  const root = createContainer("테스트", { direction: "vertical" });
  const text = createText("텍스트", "Hello");
  addChild(root, text);

  const result1 = exportHtmlCss(root);
  const result2 = exportHtmlCss(root);

  assert(result1.html === result2.html, "HTML 동일");
  assert(result1.css === result2.css, "CSS 동일");
});

// --------------------------------------------------------
// 테스트 10: HTML 이스케이프 (XSS 방지)
// --------------------------------------------------------
test("HTML 특수문자가 이스케이프된다", () => {
  const root = createContainer("루트");
  const text = createText("텍스트", '<script>alert("xss")</script>');
  addChild(root, text);

  const result = exportHtmlCss(root);

  assertNotContains(result.html, "<script>", "script 태그 이스케이프");
  assertContains(result.html, "&lt;script&gt;", "script가 이스케이프됨");
});

// --------------------------------------------------------
// 테스트 11: exportFullHtml이 완성된 문서 생성
// --------------------------------------------------------
test("exportFullHtml이 브라우저에서 열리는 완성 HTML을 만든다", () => {
  const root = createContainer("테스트");
  const text = createText("텍스트", "Hello");
  addChild(root, text);

  const fullHtml = exportFullHtml(root);

  assertContains(fullHtml, "<!DOCTYPE html>", "DOCTYPE 있음");
  assertContains(fullHtml, "<html", "html 태그 있음");
  assertContains(fullHtml, "<head>", "head 태그 있음");
  assertContains(fullHtml, "<style>", "style 태그 있음");
  assertContains(fullHtml, "</style>", "닫는 style 태그 있음");
  assertContains(fullHtml, "<body>", "body 태그 있음");
  assertContains(fullHtml, "</html>", "닫는 html 태그 있음");
});

// --------------------------------------------------------
// 테스트 12: 이미지 alt 속성
// --------------------------------------------------------
test("이미지 alt 속성이 올바르게 처리된다", () => {
  const root = createContainer("루트");
  const imageWithAlt = createImage("이미지1", "img.png", "설명 텍스트");
  const imageWithoutAlt = createImage("이미지2", "img2.png");

  addChild(root, imageWithAlt);
  addChild(root, imageWithoutAlt);

  const result = exportHtmlCss(root);

  assertContains(result.html, 'alt="설명 텍스트"', "alt 속성 있음");
});

// --------------------------------------------------------
// 테스트 13: 입력 요소 placeholder
// --------------------------------------------------------
test("입력 요소 placeholder가 올바르게 처리된다", () => {
  const root = createContainer("루트");
  const input = createInput("입력", "textfield", "이메일을 입력하세요");
  addChild(root, input);

  const result = exportHtmlCss(root);

  assertContains(result.html, 'placeholder="이메일을 입력하세요"', "placeholder 있음");
});

// --------------------------------------------------------
// 테스트 14: 복잡한 중첩 구조
// --------------------------------------------------------
test("복잡한 중첩 구조가 올바르게 변환된다", () => {
  // 사이드바 레이아웃 시뮬레이션
  const root = createContainer("전체", { direction: "horizontal" });
  
  const sidebar = createContainer("사이드바", { direction: "vertical" }, { width: { mode: "비율", percent: 30 } });
  sidebar.background = "#e3f2fd";
  const sidebarTitle = createText("메뉴", "사이드바");
  sidebarTitle.fontSize = 18;
  sidebarTitle.bold = true;
  addChild(sidebar, sidebarTitle);
  
  const content = createContainer("콘텐츠", { direction: "vertical" }, { width: { mode: "꽉채움" } });
  const contentTitle = createText("제목", "본문");
  contentTitle.fontSize = 20;
  contentTitle.bold = true;
  const button = createInput("버튼", "button", "클릭");
  addChild(content, contentTitle);
  addChild(content, button);
  
  addChild(root, sidebar);
  addChild(root, content);

  const result = exportHtmlCss(root);

  // 전체 구조 확인
  assertContains(result.css, "flex-direction: row", "루트는 row");
  assertContains(result.css, "width: 30%", "사이드바는 30%");
  assertContains(result.css, "flex: 1", "콘텐츠는 flex:1");
  assertContains(result.css, "background-color: #e3f2fd", "배경색 있음");
  assertContains(result.css, "font-size: 18px", "글자 크기 있음");
  assertContains(result.css, "font-weight: bold", "굵게 있음");
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
  console.log("\n🎉 모든 테스트 통과! M1-1 완료!");
} else {
  console.log("\n⚠️ 일부 테스트 실패");
  process.exit(1);
}

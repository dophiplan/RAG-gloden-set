/**
 * M1-1: 트리 → 깨끗한 HTML/CSS 출력
 * DOM 없이 동작하는 순수 함수
 */

import type {
  Element,
  ContainerElement,
  TextElement,
  ImageElement,
  InputElement,
  SizeMode,
} from "./tree.ts";

// ============================================================
// 타입 정의
// ============================================================

export interface ExportResult {
  html: string;   // <div class="...">...</div>
  css: string;    // .cls-1 { display:flex; ... }
}

interface CSSRule {
  selector: string;
  properties: Record<string, string>;
}

// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * CSS 클래스명 생성 (안전한 형식)
 */
function makeClassName(id: string): string {
  // ID에서 특수문자 제거하고 el- 접두사 추가
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `el-${safeId}`;
}

/**
 * CSS 속성 값을 문자열로 변환
 */
function cssProperty(key: string, value: string | number): string {
  return `${key}: ${value};`;
}

/**
 * SizeMode를 CSS 속성으로 변환
 */
function sizeModeToCss(
  size: SizeMode | undefined,
  property: "width" | "height",
  isMainAxis: boolean
): Record<string, string> {
  if (!size || size.mode === "내용맞춤") {
    return {};
  }

  switch (size.mode) {
    case "고정":
      return { [property]: `${size.px}px` };
    case "꽉채움":
      return { flex: "1" };
    case "비율":
      return { [property]: `${size.percent}%` };
    default:
      return {};
  }
}

// ============================================================
// HTML 생성
// ============================================================

/**
 * 텍스트 이스케이프 (XSS 방지)
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 들여쓰기 생성
 */
function indent(level: number): string {
  return "  ".repeat(level);
}

// ============================================================
// CSS 규칙 수집기
// ============================================================

class CSSCollector {
  private rules: CSSRule[] = [];

  addRule(selector: string, properties: Record<string, string>): void {
    // 중복 체크: 같은 selector가 있으면 병합
    const existing = this.rules.find((r) => r.selector === selector);
    if (existing) {
      Object.assign(existing.properties, properties);
    } else {
      this.rules.push({ selector, properties: { ...properties } });
    }
  }

  toString(): string {
    return this.rules
      .map((rule) => {
        const props = Object.entries(rule.properties)
          .map(([key, value]) => `  ${key}: ${value};`)
          .join("\n");
        return `${rule.selector} {\n${props}\n}`;
      })
      .join("\n\n");
  }
}

// ============================================================
// 요소별 변환
// ============================================================

/**
 * ContainerElement를 HTML/CSS로 변환
 */
function exportContainer(
  element: ContainerElement,
  css: CSSCollector,
  indentLevel: number
): string {
  const className = makeClassName(element.id);
  const isHorizontal = element.layout.direction === "horizontal";

  // CSS 속성 수집
  const styles: Record<string, string> = {
    display: "flex",
    "flex-direction": isHorizontal ? "row" : "column",
  };

  // align 처리
  const alignValue =
    element.layout.align === "start"
      ? "flex-start"
      : element.layout.align === "end"
      ? "flex-end"
      : "center";
  styles["align-items"] = alignValue;
  styles["justify-content"] = alignValue;

  // gap과 padding
  if (element.layout.gap !== 0) {
    styles["gap"] = `${element.layout.gap}px`;
  }
  if (element.layout.padding !== 0) {
    styles["padding"] = `${element.layout.padding}px`;
  }

  // background
  if (element.background) {
    styles["background-color"] = element.background;
  }

  // 크기 설정
  Object.assign(
    styles,
    sizeModeToCss(element.width, "width", isHorizontal)
  );
  Object.assign(
    styles,
    sizeModeToCss(element.height, "height", !isHorizontal)
  );

  css.addRule(`.${className}`, styles);

  // 자식 HTML 생성
  const childrenHtml = element.children
    .map((child) => exportElement(child, css, indentLevel + 1))
    .join("\n");

  return `${indent(indentLevel)}<div class="${className}">\n${childrenHtml}\n${indent(indentLevel)}</div>`;
}

/**
 * TextElement를 HTML/CSS로 변환
 */
function exportText(
  element: TextElement,
  css: CSSCollector,
  indentLevel: number
): string {
  const className = makeClassName(element.id);
  const styles: Record<string, string> = {};

  if (element.fontSize) {
    styles["font-size"] = `${element.fontSize}px`;
  }
  if (element.bold) {
    styles["font-weight"] = "bold";
  }

  // 크기 설정
  Object.assign(styles, sizeModeToCss(element.width, "width", false));
  Object.assign(styles, sizeModeToCss(element.height, "height", false));

  if (Object.keys(styles).length > 0) {
    css.addRule(`.${className}`, styles);
  }

  const classAttr = Object.keys(styles).length > 0 ? ` class="${className}"` : "";
  return `${indent(indentLevel)}<span${classAttr}>${escapeHtml(element.content)}</span>`;
}

/**
 * ImageElement를 HTML/CSS로 변환
 */
function exportImage(
  element: ImageElement,
  css: CSSCollector,
  indentLevel: number
): string {
  const className = makeClassName(element.id);
  const styles: Record<string, string> = {
    "max-width": "100%",
    "height": "auto",
  };

  // 크기 설정
  Object.assign(styles, sizeModeToCss(element.width, "width", false));
  Object.assign(styles, sizeModeToCss(element.height, "height", false));

  css.addRule(`.${className}`, styles);

  const altAttr = element.alt ? ` alt="${escapeHtml(element.alt)}"` : "";
  return `${indent(indentLevel)}<img class="${className}" src="${escapeHtml(element.src)}"${altAttr}>`;
}

/**
 * InputElement를 HTML/CSS로 변환
 */
function exportInput(
  element: InputElement,
  css: CSSCollector,
  indentLevel: number
): string {
  const className = makeClassName(element.id);
  const styles: Record<string, string> = {};

  // 크기 설정
  Object.assign(styles, sizeModeToCss(element.width, "width", false));
  Object.assign(styles, sizeModeToCss(element.height, "height", false));

  if (Object.keys(styles).length > 0) {
    css.addRule(`.${className}`, styles);
  }

  const classAttr = ` class="${className}"`;

  if (element.inputType === "button") {
    return `${indent(indentLevel)}<button${classAttr}>${escapeHtml(element.label)}</button>`;
  } else {
    // textfield
    const placeholderAttr = ` placeholder="${escapeHtml(element.label)}"`;
    return `${indent(indentLevel)}<input${classAttr} type="text"${placeholderAttr}>`;
  }
}

/**
 * Element를 HTML/CSS로 변환 (분기)
 */
function exportElement(
  element: Element,
  css: CSSCollector,
  indentLevel: number
): string {
  switch (element.type) {
    case "container":
      return exportContainer(element, css, indentLevel);
    case "text":
      return exportText(element, css, indentLevel);
    case "image":
      return exportImage(element, css, indentLevel);
    case "input":
      return exportInput(element, css, indentLevel);
    default:
      throw new Error(`Unknown element type: ${(element as Element).type}`);
  }
}

// ============================================================
// 메인 export 함수
// ============================================================

/**
 * 트리를 HTML/CSS로 변환
 * DOM을 사용하지 않는 순수 함수
 */
export function exportHtmlCss(root: Element): ExportResult {
  const css = new CSSCollector();
  const html = exportElement(root, css, 0);

  return {
    html,
    css: css.toString(),
  };
}

/**
 * 완성된 HTML 문서 생성
 * 브라우저에서 바로 열 수 있는 형태
 */
export function exportFullHtml(root: Element): string {
  const { html, css } = exportHtmlCss(root);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exported Design</title>
  <style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  min-height: 100vh;
}

${css}
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * 개별 파일 형태로 export (HTML 파일과 CSS 파일 분리)
 */
export function exportSeparateFiles(root: Element): {
  htmlFile: string;
  cssFile: string;
  htmlFileName: string;
  cssFileName: string;
} {
  const { html, css } = exportHtmlCss(root);

  const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exported Design</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
${html}
</body>
</html>`;

  return {
    htmlFile: htmlContent,
    cssFile: css,
    htmlFileName: "index.html",
    cssFileName: "style.css",
  };
}

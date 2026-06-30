/**
 * M0-3: 편집 가능한 어댑터
 * CanvasAdapter 인터페이스 + DomAdapter 구현
 * onChange, onSelect 콜백 + SizeMode 렌더링 추가
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
// CanvasAdapter 인터페이스 (M0-3)
// ============================================================

/**
 * 트리를 화면에 그리고 상호작용하는 어댑터 인터페이스
 */
export interface CanvasAdapter {
  /**
   * 트리를 받아 화면에 그린다
   */
  render(tree: Element, container?: HTMLElement): void;
  
  /**
   * 트리가 변경되면 호출될 콜백 등록
   */
  onChange(cb: (newTree: Element) => void): void;
  
  /**
   * 요소가 선택되면 호출될 콜백 등록
   */
  onSelect(cb: (selectedId: string | null) => void): void;
  
  /**
   * 현재 선택된 요소의 ID 반환
   */
  getSelectedId(): string | null;
  
  /**
   * 특정 요소를 선택
   */
  select(id: string | null): void;
}

// ============================================================
// SizeMode → CSS 변환 유틸리티 (M0-3 보강)
// ============================================================

/**
 * SizeMode를 CSS 스타일로 변환
 * @param size 크기 모드
 * @param isMainAxis 주축 방향인지 (horizontal이면 width가 주축, vertical이면 height가 주축)
 * @returns CSS 속성 객체
 */
function sizeModeToCss(
  size: SizeMode | undefined,
  isMainAxis: boolean
): Record<string, string> {
  // 기본값: 내용맞춤 (auto)
  if (!size || size.mode === "내용맞춤") {
    return {};
  }

  switch (size.mode) {
    case "고정":
      return isMainAxis
        ? { flex: "0 0 auto" } // 주축에서 고정 크기는 flex-basis 대신 사용
        : {};
    
    case "꽉채움":
      return { flex: "1 1 auto" };
    
    case "비율":
      return { flex: `0 0 ${size.percent}%` };
    
    default:
      return {};
  }
}

/**
 * SizeMode에서 고정 픽셀값 추출
 */
function getFixedSize(size: SizeMode | undefined): number | null {
  if (size?.mode === "고정") {
    return size.px;
  }
  return null;
}

// ============================================================
// DOM/Flexbox 어댑터 구현
// ============================================================

export class DomAdapter implements CanvasAdapter {
  private rootElement: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  private currentTree: Element | null = null;
  private selectedId: string | null = null;
  private changeCallback: ((newTree: Element) => void) | null = null;
  private selectCallback: ((selectedId: string | null) => void) | null = null;
  private elementMap: Map<string, HTMLElement> = new Map();

  onChange(cb: (newTree: Element) => void): void {
    this.changeCallback = cb;
  }

  onSelect(cb: (selectedId: string | null) => void): void {
    this.selectCallback = cb;
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  select(id: string | null): void {
    // 이전 선택 해제
    if (this.selectedId) {
      const prevElement = this.elementMap.get(this.selectedId);
      if (prevElement) {
        this.updateSelectionStyle(prevElement, false);
      }
    }
    
    this.selectedId = id;
    
    // 새 선택 표시
    if (id) {
      const element = this.elementMap.get(id);
      if (element) {
        this.updateSelectionStyle(element, true);
      }
    }
    
    if (this.selectCallback) {
      this.selectCallback(id);
    }
  }

  private updateSelectionStyle(element: HTMLElement, isSelected: boolean): void {
    if (isSelected) {
      element.style.outline = "3px solid #007bff";
      element.style.outlineOffset = "-2px";
    } else {
      element.style.outline = "";
      element.style.outlineOffset = "";
    }
  }

  render(tree: Element, container: HTMLElement = document.body): void {
    this.currentTree = tree;
    this.container = container;
    this.elementMap.clear();
    
    // 기존 내용 초기화
    container.innerHTML = "";
    
    // 트리를 DOM으로 변환
    this.rootElement = this.createElement(tree);
    
    // 컨테이너에 추가
    container.appendChild(this.rootElement);
    
    // 선택 상태 복원
    if (this.selectedId) {
      this.select(this.selectedId);
    }
  }

  /**
   * Element를 DOM HTMLElement로 변환
   */
  private createElement(element: Element): HTMLElement {
    let domElement: HTMLElement;
    
    switch (element.type) {
      case "container":
        domElement = this.createContainerElement(element);
        break;
      case "text":
        domElement = this.createTextElement(element);
        break;
      case "image":
        domElement = this.createImageElement(element);
        break;
      case "input":
        domElement = this.createInputElement(element);
        break;
      default:
        throw new Error(`Unknown element type: ${(element as Element).type}`);
    }
    
    // ID 매핑 저장
    this.elementMap.set(element.id, domElement);
    
    // 클릭 이벤트 핸들러 추가 (선택)
    domElement.addEventListener("click", (e) => {
      e.stopPropagation(); // 버블링 방지
      this.select(element.id);
    });
    
    // 커서 스타일
    domElement.style.cursor = "pointer";
    
    return domElement;
  }

  /**
   * ContainerElement를 div로 변환
   */
  private createContainerElement(element: ContainerElement): HTMLElement {
    const div = document.createElement("div");
    
    // Flexbox 설정
    div.style.display = "flex";
    
    // Direction 설정
    const isHorizontal = element.layout.direction === "horizontal";
    div.style.flexDirection = isHorizontal ? "row" : "column";
    
    // Align 설정
    const alignMap = {
      start: "flex-start",
      center: "center",
      end: "flex-end",
    };
    div.style.alignItems = alignMap[element.layout.align];
    div.style.justifyContent = alignMap[element.layout.align];
    
    // Gap 설정
    div.style.gap = `${element.layout.gap}px`;
    
    // Padding 설정
    div.style.padding = `${element.layout.padding}px`;
    
    // Background 설정
    if (element.background) {
      div.style.backgroundColor = element.background;
    }
    
    // 기본 스타일 (시각적으로 구분되도록)
    div.style.border = "1px solid #ddd";
    div.style.minHeight = "20px";
    div.style.minWidth = "20px";
    
    // ===== M0-3 보강: 크기 설정 =====
    // 주축 방향 확인
    const isWidthMain = isHorizontal;
    const isHeightMain = !isHorizontal;
    
    // width 적용
    if (element.width) {
      const widthCss = sizeModeToCss(element.width, isWidthMain);
      Object.assign(div.style, widthCss);
      
      // 고정 크기는 명시적 width/height로
      const fixedWidth = getFixedSize(element.width);
      if (fixedWidth !== null) {
        div.style.width = `${fixedWidth}px`;
      }
      
      // 비율은 명시적 %로
      if (element.width.mode === "비율") {
        div.style.width = `${element.width.percent}%`;
      }
    }
    
    // height 적용
    if (element.height) {
      const heightCss = sizeModeToCss(element.height, isHeightMain);
      Object.assign(div.style, heightCss);
      
      // 고정 크기는 명시적 height로
      const fixedHeight = getFixedSize(element.height);
      if (fixedHeight !== null) {
        div.style.height = `${fixedHeight}px`;
      }
      
      // 비율은 명시적 %로
      if (element.height.mode === "비율") {
        div.style.height = `${element.height.percent}%`;
      }
    }
    // ================================
    
    // 자식들을 재귀적으로 추가
    for (const child of element.children) {
      const childElement = this.createElement(child);
      div.appendChild(childElement);
    }
    
    return div;
  }

  /**
   * TextElement를 span으로 변환
   */
  private createTextElement(element: TextElement): HTMLElement {
    const span = document.createElement("span");
    span.textContent = element.content;
    
    // 폰트 크기 설정
    if (element.fontSize) {
      span.style.fontSize = `${element.fontSize}px`;
    }
    
    // 볼드 설정
    if (element.bold) {
      span.style.fontWeight = "bold";
    }
    
    // ===== M0-3 보강: 크기 설정 =====
    if (element.width?.mode === "고정") {
      span.style.width = `${element.width.px}px`;
    }
    if (element.height?.mode === "고정") {
      span.style.height = `${element.height.px}px`;
    }
    // ================================
    
    return span;
  }

  /**
   * ImageElement를 img로 변환
   */
  private createImageElement(element: ImageElement): HTMLElement {
    const img = document.createElement("img");
    img.src = element.src;
    img.alt = element.alt || "";
    
    // 기본 스타일
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    
    // ===== M0-3 보강: 크기 설정 =====
    if (element.width?.mode === "고정") {
      img.style.width = `${element.width.px}px`;
    } else if (element.width?.mode === "비율") {
      img.style.width = `${element.width.percent}%`;
    }
    
    if (element.height?.mode === "고정") {
      img.style.height = `${element.height.px}px`;
    }
    // ================================
    
    return img;
  }

  /**
   * InputElement를 button 또는 input으로 변환
   */
  private createInputElement(element: InputElement): HTMLElement {
    let dom: HTMLElement;
    
    if (element.inputType === "button") {
      const button = document.createElement("button");
      button.textContent = element.label;
      
      // 기본 버튼 스타일
      button.style.padding = "8px 16px";
      button.style.cursor = "pointer";
      
      dom = button;
    } else {
      // textfield
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = element.label;
      
      // 기본 입력창 스타일
      input.style.padding = "8px";
      input.style.border = "1px solid #ccc";
      input.style.borderRadius = "4px";
      
      dom = input;
    }
    
    // ===== M0-3 보강: 크기 설정 =====
    if (element.width?.mode === "고정") {
      dom.style.width = `${element.width.px}px`;
    } else if (element.width?.mode === "비율") {
      dom.style.width = `${element.width.percent}%`;
    }
    
    if (element.height?.mode === "고정") {
      dom.style.height = `${element.height.px}px`;
    }
    // ================================
    
    return dom;
  }
}

// ============================================================
// 유틸리티: 트리 → HTML 문자열
// ============================================================

/**
 * 트리를 HTML 문자열로 변환 (정적 HTML 출력용)
 */
export function treeToHtml(element: Element): string {
  const adapter = new DomAdapter();
  
  // 임시 컨테이너 생성
  const tempDiv = document.createElement("div");
  adapter.render(element, tempDiv);
  
  return tempDiv.innerHTML;
}

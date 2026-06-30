/**
 * M0-3: 편집 도구 (Editor Controller)
 * 트리 조작 기능 + 크기 설정 (M0-3 보강)
 */

import type {
  Element,
  ContainerElement,
  TextElement,
  InputElement,
  SizeMode,
} from "./tree.ts";

import {
  createContainer,
  createText,
  createImage,
  createInput,
  addChild,
  removeChild,
  findById,
  findWithParent,
  findChildIndex,
  moveChildUp,
  moveChildDown,
  setWidth,
  setHeight,
} from "./tree.ts";

// ============================================================
// 속성 업데이트 함수들
// ============================================================

/**
 * TextElement의 내용 업데이트
 */
export function updateTextContent(element: TextElement, content: string): void {
  element.content = content;
}

/**
 * TextElement의 스타일 업데이트
 */
export function updateTextStyle(
  element: TextElement,
  styles: { fontSize?: number; bold?: boolean }
): void {
  if (styles.fontSize !== undefined) element.fontSize = styles.fontSize;
  if (styles.bold !== undefined) element.bold = styles.bold;
}

/**
 * InputElement의 라벨 업데이트
 */
export function updateInputLabel(element: InputElement, label: string): void {
  element.label = label;
}

/**
 * ContainerElement의 layout 업데이트
 */
export function updateContainerLayout(
  element: ContainerElement,
  layout: Partial<ContainerElement["layout"]>
): void {
  element.layout = { ...element.layout, ...layout };
}

/**
 * ContainerElement의 배경색 업데이트
 */
export function updateContainerBackground(
  element: ContainerElement,
  background: string | undefined
): void {
  element.background = background;
}

// ============================================================
// Editor 클래스 (통합 편집 인터페이스)
// ============================================================

export interface EditorOptions {
  onTreeChange?: (tree: Element) => void;
  onSelect?: (id: string | null) => void;
}

export class Editor {
  private tree: Element | null = null;
  private selectedId: string | null = null;
  private onTreeChange: ((tree: Element) => void) | null = null;
  private onSelect: ((id: string | null) => void) | null = null;

  constructor(options: EditorOptions = {}) {
    this.onTreeChange = options.onTreeChange || null;
    this.onSelect = options.onSelect || null;
  }

  /**
   * 편집할 트리 설정
   */
  setTree(tree: Element): void {
    this.tree = tree;
    this.notifyChange();
  }

  /**
   * 현재 트리 반환
   */
  getTree(): Element | null {
    return this.tree;
  }

  /**
   * 현재 선택된 ID 반환
   */
  getSelectedId(): string | null {
    return this.selectedId;
  }

  /**
   * 요소 선택
   */
  select(id: string | null): void {
    this.selectedId = id;
    if (this.onSelect) {
      this.onSelect(id);
    }
  }

  /**
   * 현재 선택된 요소 반환
   */
  getSelectedElement(): Element | null {
    if (!this.tree || !this.selectedId) return null;
    return findById(this.tree, this.selectedId);
  }

  /**
   * 현재 선택된 요소의 부모 반환
   */
  getSelectedParent(): ContainerElement | null {
    if (!this.tree || !this.selectedId) return null;
    const result = findWithParent(this.tree, this.selectedId);
    return result?.parent || null;
  }

  /**
   * 현재 선택된 것이 container인지 확인
   */
  isSelectedContainer(): boolean {
    const selected = this.getSelectedElement();
    return selected?.type === "container";
  }

  // --------------------------------------------------------
  // 트리 조작 명령들
  // --------------------------------------------------------

  /**
   * 새로운 빈 상자 추가
   * - 선택된 상자가 있으면 그 안에 추가
   * - 없으면 루트에 추가 (루트가 container인 경우)
   */
  addEmptyContainer(name?: string): boolean {
    if (!this.tree) return false;

    const newContainer = createContainer(name || "새 상자");

    // 선택된 container가 있으면 그 안에 추가
    const targetContainer = this.getSelectedContainer();

    if (targetContainer) {
      addChild(targetContainer, newContainer);
      this.notifyChange();
      return true;
    }

    // 선택된 게 없거나 container가 아니면 루트에 추가 (루트가 container면)
    if (this.tree.type === "container") {
      addChild(this.tree, newContainer);
      this.notifyChange();
      return true;
    }

    return false;
  }

  /**
   * 선택된 상자 안에 텍스트 추가
   */
  addText(content: string): boolean {
    const target = this.getSelectedContainer();
    if (!target) return false;

    const text = createText("텍스트", content);
    addChild(target, text);
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 상자 안에 이미지 추가
   */
  addImage(src: string, alt?: string): boolean {
    const target = this.getSelectedContainer();
    if (!target) return false;

    const image = createImage("이미지", src, alt);
    addChild(target, image);
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 상자 안에 입력 요소 추가
   */
  addInput(inputType: "button" | "textfield", label: string): boolean {
    const target = this.getSelectedContainer();
    if (!target) return false;

    const input = createInput(label, inputType, label);
    addChild(target, input);
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 요소 삭제
   */
  deleteSelected(): boolean {
    if (!this.tree || !this.selectedId) return false;

    // 루트는 삭제 불가
    if (this.selectedId === this.tree.id) return false;

    const result = findWithParent(this.tree, this.selectedId);
    if (!result || !result.parent) return false;

    removeChild(result.parent, this.selectedId);
    this.select(null);
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 요소를 위로 이동
   */
  moveSelectedUp(): boolean {
    if (!this.tree || !this.selectedId) return false;

    const result = findWithParent(this.tree, this.selectedId);
    if (!result || !result.parent) return false;

    const success = moveChildUp(result.parent, this.selectedId);
    if (success) {
      this.notifyChange();
    }
    return success;
  }

  /**
   * 선택된 요소를 아래로 이동
   */
  moveSelectedDown(): boolean {
    if (!this.tree || !this.selectedId) return false;

    const result = findWithParent(this.tree, this.selectedId);
    if (!result || !result.parent) return false;

    const success = moveChildDown(result.parent, this.selectedId);
    if (success) {
      this.notifyChange();
    }
    return success;
  }

  // --------------------------------------------------------
  // 속성 업데이트
  // --------------------------------------------------------

  /**
   * 선택된 요소의 이름 변경 (모든 타입 공통)
   */
  renameSelected(name: string): boolean {
    const selected = this.getSelectedElement();
    if (!selected) return false;

    selected.name = name;
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 텍스트의 내용 변경
   */
  updateSelectedText(content: string): boolean {
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "text") return false;

    updateTextContent(selected, content);
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 텍스트의 스타일 변경
   */
  updateSelectedTextStyle(styles: { fontSize?: number; bold?: boolean }): boolean {
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "text") return false;

    updateTextStyle(selected, styles);
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 입력 요소의 라벨 변경
   */
  updateSelectedInputLabel(label: string): boolean {
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "input") return false;

    updateInputLabel(selected, label);
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 컨테이너의 layout 변경
   */
  updateSelectedContainerLayout(layout: Partial<ContainerElement["layout"]>): boolean {
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "container") return false;

    updateContainerLayout(selected, layout);
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 컨테이너의 배경색 변경
   */
  updateSelectedContainerBackground(background: string | undefined): boolean {
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "container") return false;

    updateContainerBackground(selected, background);
    this.notifyChange();
    return true;
  }

  // --------------------------------------------------------
  // 크기 설정 (M0-3 보강)
  // --------------------------------------------------------

  /**
   * 선택된 요소의 가로 크기 설정
   */
  setSelectedWidth(size: SizeMode | undefined): boolean {
    const selected = this.getSelectedElement();
    if (!selected) return false;

    setWidth(selected, size);
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 요소의 세로 크기 설정
   */
  setSelectedHeight(size: SizeMode | undefined): boolean {
    const selected = this.getSelectedElement();
    if (!selected) return false;

    setHeight(selected, size);
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 요소의 크기를 고정 픽셀로 설정
   */
  setSelectedFixedSize(widthPx?: number, heightPx?: number): boolean {
    const selected = this.getSelectedElement();
    if (!selected) return false;

    if (widthPx !== undefined) {
      setWidth(selected, { mode: "고정", px: widthPx });
    }
    if (heightPx !== undefined) {
      setHeight(selected, { mode: "고정", px: heightPx });
    }
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 요소의 크기를 비율(%)로 설정
   */
  setSelectedRatioSize(widthPercent?: number, heightPercent?: number): boolean {
    const selected = this.getSelectedElement();
    if (!selected) return false;

    if (widthPercent !== undefined) {
      setWidth(selected, { mode: "비율", percent: widthPercent });
    }
    if (heightPercent !== undefined) {
      setHeight(selected, { mode: "비율", percent: heightPercent });
    }
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 요소의 크기를 "꽉채움"으로 설정
   */
  setSelectedFillSize(width?: boolean, height?: boolean): boolean {
    const selected = this.getSelectedElement();
    if (!selected) return false;

    if (width) {
      setWidth(selected, { mode: "꽉채움" });
    }
    if (height) {
      setHeight(selected, { mode: "꽉채움" });
    }
    this.notifyChange();
    return true;
  }

  /**
   * 선택된 요소의 크기를 "내용맞춤"으로 설정 (기본값)
   */
  setSelectedAutoSize(width?: boolean, height?: boolean): boolean {
    const selected = this.getSelectedElement();
    if (!selected) return false;

    if (width) {
      setWidth(selected, { mode: "내용맞춤" });
    }
    if (height) {
      setHeight(selected, { mode: "내용맞춤" });
    }
    this.notifyChange();
    return true;
  }

  // --------------------------------------------------------
  // 유틸리티
  // --------------------------------------------------------

  /**
   * 트리 변경 알림
   */
  private notifyChange(): void {
    if (this.tree && this.onTreeChange) {
      // 깊은 복사본을 전달하여 외부에서 직접 수정하지 않도록
      this.onTreeChange(JSON.parse(JSON.stringify(this.tree)));
    }
  }

  /**
   * 현재 선택된 container 반환 (선택된 게 container가 아니면 null)
   */
  private getSelectedContainer(): ContainerElement | null {
    const selected = this.getSelectedElement();
    if (selected?.type === "container") {
      return selected;
    }
    return null;
  }
}

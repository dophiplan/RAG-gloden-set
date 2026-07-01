/**
 * M0-1 + M0-3 보강: 디자인 트리 자료구조와 조작 함수
 * M0-3 보강: 크기/비율(레고식 자유) 추가
 */

// ============================================================
// 타입 정의
// ============================================================

export type Eleme[기밀마스킹]ype = "container" | "text" | "image" | "input";

// 크기 지정 방식 (M0-3 보강)
export type SizeMode =
  | { mode: "고정"; px: number }      // 고정 픽셀 (예: 높이 64px 헤더)
  | { mode: "꽉채움" }                // 부모의 남은 공간을 채움 (flex-grow)
  | { mode: "비율"; percent: number } // 부모 대비 비율 (예: 사이드바 30%)
  | { mode: "내용맞춤" };             // 내용 크기에 맞춤 (기본값)

export interface BaseElement {
  id: string;          // 고유 식별자 (필수)
  type: Eleme[기밀마스킹]ype;
  name: string;        // 사람이 읽는 이름
  owner?: string;      // 소유자 (지금은 안 씀, 자리만 예약. 기본 "local")
  width?: SizeMode;    // 가로 크기 (없으면 "내용맞춤"으로 간주) - M0-3 보강
  height?: SizeMode;   // 세로 크기 (없으면 "내용맞춤"으로 간주) - M0-3 보강
}

export interface Layout {
  direction: "vertical" | "horizontal";  // 세로 쌓기 / 가로 쌓기
  align: "start" | "center" | "end";
  gap: number;        // 간격(px)
  padding: number;    // 안쪽 여백(px)
}

export interface ContainerElement extends BaseElement {
  type: "container";
  layout: Layout;
  background?: string;  // 배경색
  children: Element[];  // 자식들 (순서가 곧 화면 순서)
}

export interface TextElement extends BaseElement {
  type: "text";
  content: string;
  fontSize?: number;
  bold?: boolean;
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string;
  alt?: string;
}

export interface InputElement extends BaseElement {
  type: "input";
  inputType: "button" | "textfield";
  label: string;
  action?: { onClick: "goToPage"; target: string }; // M3: 버튼 클릭 시 이동할 페이지
}

export type Element = ContainerElement | TextElement | ImageElement | InputElement;

// ============================================================
// ID 생성기
// ============================================================

let idCounter = 0;

function generateId(): string {
  const randomPart = Math.random().toString(36).substring(2, 8);
  const counterPart = (++idCounter).toString(36);
  return `el_${randomPart}${counterPart}`;
}

// ============================================================
// 엘리먼트 생성 함수들
// ============================================================

const defaultLayout: Layout = {
  direction: "vertical",
  align: "start",
  gap: 8,
  padding: 16,  // 빈 상자도 보이도록 기본 패딩 증가
};

export function createContainer(
  name: string, 
  layout?: Partial<Layout>,
  size?: { width?: SizeMode; height?: SizeMode }
): ContainerElement {
  return {
    id: generateId(),
    type: "container",
    name,
    layout: { ...defaultLayout, ...layout },
    children: [],
    width: size?.width,
    height: size?.height,
    background: "#f8f9fa",  // 빈 상자도 보이도록 기본 배경색
  };
}

export function createText(
  name: string, 
  content: string,
  size?: { width?: SizeMode; height?: SizeMode }
): TextElement {
  return {
    id: generateId(),
    type: "text",
    name,
    content,
    width: size?.width,
    height: size?.height,
  };
}

export function createImage(
  name: string, 
  src: string, 
  alt?: string,
  size?: { width?: SizeMode; height?: SizeMode }
): ImageElement {
  return {
    id: generateId(),
    type: "image",
    name,
    src,
    alt,
    width: size?.width,
    height: size?.height,
  };
}

export function createInput(
  name: string,
  inputType: "button" | "textfield",
  label: string,
  size?: { width?: SizeMode; height?: SizeMode }
): InputElement {
  return {
    id: generateId(),
    type: "input",
    name,
    inputType,
    label,
    width: size?.width,
    height: size?.height,
  };
}

// ============================================================
// 트리 조작 함수들
// ============================================================

/**
 * parent(상자)의 children 끝에 child 추가
 * parent가 container가 아니면 에러를 던짐
 */
export function addChild(parent: Element, child: Element): void {
  if (parent.type !== "container") {
    throw new Error(
      `Cannot add child to '${parent.name}' (${parent.type}): only containers can have children`
    );
  }
  parent.children.push(child);
}

/**
 * parent의 children에서 해당 id를 가진 자식 제거
 */
export function removeChild(parent: Element, childId: string): boolean {
  if (parent.type !== "container") {
    throw new Error(
      `Cannot remove child from '${parent.name}' (${parent.type}): only containers have children`
    );
  }
  const index = parent.children.findIndex((child) => child.id === childId);
  if (index === -1) {
    return false;
  }
  parent.children.splice(index, 1);
  return true;
}

/**
 * 트리 전체에서 id로 노드 찾기 (없으면 null)
 */
export function findById(root: Element, id: string): Element | null {
  if (root.id === id) {
    return root;
  }
  if (root.type === "container") {
    for (const child of root.children) {
      const found = findById(child, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * 트리에서 특정 요소를 찾아 그 부모도 함께 반환 (M0-3)
 */
export function findWithParent(
  root: Element,
  targetId: string
): { element: Element; parent: ContainerElement | null } | null {
  if (root.id === targetId) {
    return { element: root, parent: null };
  }
  if (root.type === "container") {
    for (const child of root.children) {
      if (child.id === targetId) {
        return { element: child, parent: root };
      }
      const found = findWithParent(child, targetId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 부모 컨테이너에서 자식의 인덱스를 찾는다 (M0-3)
 */
export function findChildIndex(parent: ContainerElement, childId: string): number {
  return parent.children.findIndex((child) => child.id === childId);
}

/**
 * 부모 컨테이너 안에서 자식의 순서를 위로 이동 (M0-3)
 */
export function moveChildUp(parent: ContainerElement, childId: string): boolean {
  const index = findChildIndex(parent, childId);
  if (index <= 0) return false;

  const temp = parent.children[index - 1];
  parent.children[index - 1] = parent.children[index];
  parent.children[index] = temp;
  return true;
}

/**
 * 부모 컨테이너 안에서 자식의 순서를 아래로 이동 (M0-3)
 */
export function moveChildDown(parent: ContainerElement, childId: string): boolean {
  const index = findChildIndex(parent, childId);
  if (index === -1 || index >= parent.children.length - 1) return false;

  const temp = parent.children[index + 1];
  parent.children[index + 1] = parent.children[index];
  parent.children[index] = temp;
  return true;
}

// ============================================================
// 유틸리티 함수들
// ============================================================

/**
 * 트리의 모든 노드에서 사용된 ID 수집 (중복 체크용)
 */
export function collectAllIds(root: Element): Set<string> {
  const ids = new Set<string>();

  function traverse(node: Element): void {
    ids.add(node.id);
    if (node.type === "container") {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(root);
  return ids;
}

/**
 * 트리의 모든 노드 수 계산
 */
export function countNodes(root: Element): number {
  let count = 1;
  if (root.type === "container") {
    for (const child of root.children) {
      count += countNodes(child);
    }
  }
  return count;
}

/**
 * 루트에서 시작하여 모든 container를 찾는다 (M0-3)
 */
export function findAllContainers(root: Element): ContainerElement[] {
  const containers: ContainerElement[] = [];

  function traverse(element: Element): void {
    if (element.type === "container") {
      containers.push(element);
      for (const child of element.children) {
        traverse(child);
      }
    }
  }

  traverse(root);
  return containers;
}

// ============================================================
// 크기 설정 유틸리티 (M0-3 보강)
// ============================================================

/**
 * 요소의 width 설정
 */
export function setWidth(element: Element, width: SizeMode | undefined): void {
  element.width = width;
}

/**
 * 요소의 height 설정
 */
export function setHeight(element: Element, height: SizeMode | undefined): void {
  element.height = height;
}

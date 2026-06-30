/**
 * M2-1: Diff 엔진 (두 트리 → 의미 단위 변경 목록)
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

export type Change =
  | {
      kind: "added";
      id: string;
      elementType: string;
      name: string;
      parentId: string | null;
    }
  | {
      kind: "removed";
      id: string;
      elementType: string;
      name: string;
      parentId: string | null;
    }
  | {
      kind: "moved";
      id: string;
      name: string;
      fromParentId: string | null;
      toParentId: string | null;
      fromIndex: number;
      toIndex: number;
    }
  | {
      kind: "modified";
      id: string;
      name: string;
      property: string;
      before: unknown;
      after: unknown;
    };

// ============================================================
// 남전 타입
// ============================================================

interface FlattenedNode {
  element: Element;
  parentId: string | null;
  index: number;
}

type FlattenedMap = Map<string, FlattenedNode>;

// ============================================================
// 트리 평탄화
// ============================================================

/**
 * 트리를 id 기반 Map으로 평탄화
 */
function flattenTree(root: Element): FlattenedMap {
  const map: FlattenedMap = new Map();

  function traverse(
    element: Element,
    parentId: string | null,
    index: number
  ): void {
    map.set(element.id, {
      element,
      parentId,
      index,
    });

    if (element.type === "container") {
      element.children.forEach((child, childIndex) => {
        traverse(child, element.id, childIndex);
      });
    }
  }

  traverse(root, null, 0);
  return map;
}

// ============================================================
// 속성 비교 유틸리티
// ============================================================

/**
 * 두 값이 같은지 비교 (깊은 비교 for SizeMode)
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  // SizeMode 비교
  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every((key) => isEqual(aObj[key], bObj[key]));
  }

  return false;
}

/**
 * SizeMode를 비교 가능한 형태로 변환
 */
function sizeModeToValue(size: SizeMode | undefined): unknown {
  if (!size) return undefined;
  return { mode: size.mode, value: (size as { px?: number; percent?: number }).px ?? (size as { px?: number; percent?: number }).percent };
}

// ============================================================
// 요소별 속성 비교
// ============================================================

/**
 * 두 요소의 속성 차이를 찾아 modified 변경 목록 생성
 */
function findPropertyChanges(
  oldElement: Element,
  newElement: Element
): Change[] {
  const changes: Change[] = [];

  // 공통 속성: name
  if (oldElement.name !== newElement.name) {
    changes.push({
      kind: "modified",
      id: oldElement.id,
      name: newElement.name,
      property: "name",
      before: oldElement.name,
      after: newElement.name,
    });
  }

  // 공통 속성: width (SizeMode)
  if (!isEqual(oldElement.width, newElement.width)) {
    changes.push({
      kind: "modified",
      id: oldElement.id,
      name: newElement.name,
      property: "width",
      before: oldElement.width,
      after: newElement.width,
    });
  }

  // 공통 속성: height (SizeMode)
  if (!isEqual(oldElement.height, newElement.height)) {
    changes.push({
      kind: "modified",
      id: oldElement.id,
      name: newElement.name,
      property: "height",
      before: oldElement.height,
      after: newElement.height,
    });
  }

  // 타입별 속성 비교
  if (oldElement.type === "container" && newElement.type === "container") {
    changes.push(...findContainerChanges(oldElement, newElement));
  } else if (oldElement.type === "text" && newElement.type === "text") {
    changes.push(...findTextChanges(oldElement, newElement));
  } else if (oldElement.type === "image" && newElement.type === "image") {
    changes.push(...findImageChanges(oldElement, newElement));
  } else if (oldElement.type === "input" && newElement.type === "input") {
    changes.push(...findInputChanges(oldElement, newElement));
  }

  return changes;
}

function findContainerChanges(
  oldEl: ContainerElement,
  newEl: ContainerElement
): Change[] {
  const changes: Change[] = [];

  // layout.direction
  if (oldEl.layout.direction !== newEl.layout.direction) {
    changes.push({
      kind: "modified",
      id: oldEl.id,
      name: newEl.name,
      property: "layout.direction",
      before: oldEl.layout.direction,
      after: newEl.layout.direction,
    });
  }

  // layout.align
  if (oldEl.layout.align !== newEl.layout.align) {
    changes.push({
      kind: "modified",
      id: oldEl.id,
      name: newEl.name,
      property: "layout.align",
      before: oldEl.layout.align,
      after: newEl.layout.align,
    });
  }

  // layout.gap
  if (oldEl.layout.gap !== newEl.layout.gap) {
    changes.push({
      kind: "modified",
      id: oldEl.id,
      name: newEl.name,
      property: "layout.gap",
      before: oldEl.layout.gap,
      after: newEl.layout.gap,
    });
  }

  // layout.padding
  if (oldEl.layout.padding !== newEl.layout.padding) {
    changes.push({
      kind: "modified",
      id: oldEl.id,
      name: newEl.name,
      property: "layout.padding",
      before: oldEl.layout.padding,
      after: newEl.layout.padding,
    });
  }

  // background
  if (oldEl.background !== newEl.background) {
    changes.push({
      kind: "modified",
      id: oldEl.id,
      name: newEl.name,
      property: "background",
      before: oldEl.background,
      after: newEl.background,
    });
  }

  return changes;
}

function findTextChanges(oldEl: TextElement, newEl: TextElement): Change[] {
  const changes: Change[] = [];

  // content
  if (oldEl.content !== newEl.content) {
    changes.push({
      kind: "modified",
      id: oldEl.id,
      name: newEl.name,
      property: "content",
      before: oldEl.content,
      after: newEl.content,
    });
  }

  // fontSize
  if (oldEl.fontSize !== newEl.fontSize) {
    changes.push({
      kind: "modified",
      id: oldEl.id,
      name: newEl.name,
      property: "fontSize",
      before: oldEl.fontSize,
      after: newEl.fontSize,
    });
  }

  // bold
  if (oldEl.bold !== newEl.bold) {
    changes.push({
      kind: "modified",
      id: oldEl.id,
      name: newEl.name,
      property: "bold",
      before: oldEl.bold,
      after: newEl.bold,
    });
  }

  return changes;
}

function findImageChanges(oldEl: ImageElement, newEl: ImageElement): Change[] {
  const changes: Change[] = [];

  // src
  if (oldEl.src !== newEl.src) {
    changes.push({
      kind: "modified",
      id: oldEl.id,
      name: newEl.name,
      property: "src",
      before: oldEl.src,
      after: newEl.src,
    });
  }

  // alt
  if (oldEl.alt !== newEl.alt) {
    changes.push({
      kind: "modified",
      id: oldEl.id,
      name: newEl.name,
      property: "alt",
      before: oldEl.alt,
      after: newEl.alt,
    });
  }

  return changes;
}

function findInputChanges(oldEl: InputElement, newEl: InputElement): Change[] {
  const changes: Change[] = [];

  // inputType
  if (oldEl.inputType !== newEl.inputType) {
    changes.push({
      kind: "modified",
      id: oldEl.id,
      name: newEl.name,
      property: "inputType",
      before: oldEl.inputType,
      after: newEl.inputType,
    });
  }

  // label
  if (oldEl.label !== newEl.label) {
    changes.push({
      kind: "modified",
      id: oldEl.id,
      name: newEl.name,
      property: "label",
      before: oldEl.label,
      after: newEl.label,
    });
  }

  return changes;
}

// ============================================================
// 메인 Diff 함수
// ============================================================

/**
 * 두 트리를 비교하여 변경 목록 생성
 * DOM 없이 동작하는 순수 함수
 */
export function diffTrees(oldTree: Element, newTree: Element): Change[] {
  const oldMap = flattenTree(oldTree);
  const newMap = flattenTree(newTree);

  const changes: Change[] = [];

  const oldIds = new Set(oldMap.keys());
  const newIds = new Set(newMap.keys());

  // 1. 추가된 요소 (new에만 있는 id)
  for (const id of newIds) {
    if (!oldIds.has(id)) {
      const node = newMap.get(id)!;
      changes.push({
        kind: "added",
        id,
        elementType: node.element.type,
        name: node.element.name,
        parentId: node.parentId,
      });
    }
  }

  // 2. 삭제된 요소 (old에만 있는 id)
  for (const id of oldIds) {
    if (!newIds.has(id)) {
      const node = oldMap.get(id)!;
      changes.push({
        kind: "removed",
        id,
        elementType: node.element.type,
        name: node.element.name,
        parentId: node.parentId,
      });
    }
  }

  // 3. 양쪽에 있는 요소: 이동 또는 수정
  for (const id of oldIds) {
    if (!newIds.has(id)) continue;

    const oldNode = oldMap.get(id)!;
    const newNode = newMap.get(id)!;

    // 이동 여부 확인 (parentId 또는 index가 다름)
    const isMoved =
      oldNode.parentId !== newNode.parentId ||
      oldNode.index !== newNode.index;

    if (isMoved) {
      changes.push({
        kind: "moved",
        id,
        name: newNode.element.name,
        fromParentId: oldNode.parentId,
        toParentId: newNode.parentId,
        fromIndex: oldNode.index,
        toIndex: newNode.index,
      });
    }

    // 수정 여부 확인 (속성 변경)
    const propertyChanges = findPropertyChanges(
      oldNode.element,
      newNode.element
    );
    changes.push(...propertyChanges);
  }

  // 안정적 순서로 정렬 (id 기준, 변경 종류 기준)
  changes.sort((a, b) => {
    // 먼저 id로 정렬
    if (a.id !== b.id) return a.id.localeCompare(b.id);
    // 같은 id면 변경 종류 순서: removed → added → moved → modified
    const kindOrder = { removed: 0, added: 1, moved: 2, modified: 3 };
    return kindOrder[a.kind] - kindOrder[b.kind];
  });

  return changes;
}

// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * 변경 목록을 사람이 읽기 좋은 문자열로 변환 (디버그용)
 */
export function formatChanges(changes: Change[]): string {
  if (changes.length === 0) return "변경 없음";

  return changes
    .map((change) => {
      switch (change.kind) {
        case "added":
          return `[+] ${change.elementType} "${change.name}" (parent: ${change.parentId ?? "root"})`;
        case "removed":
          return `[-] ${change.elementType} "${change.name}" (parent: ${change.parentId ?? "root"})`;
        case "moved":
          return `[→] "${change.name}" ${change.fromParentId ?? "root"}[${change.fromIndex}] → ${change.toParentId ?? "root"}[${change.toIndex}]`;
        case "modified":
          return `[~] "${change.name}".${change.property}: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`;
      }
    })
    .join("\n");
}

/**
 * 변경이 있는지 확인
 */
export function hasChanges(changes: Change[]): boolean {
  return changes.length > 0;
}

/**
 * 특정 종류의 변경만 필터링
 */
export function filterChangesByKind(
  changes: Change[],
  kind: Change["kind"]
): Change[] {
  return changes.filter((c) => c.kind === kind);
}

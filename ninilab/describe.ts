/**
 * M2-2: 자연어 뷰 (변경 목록 → 사람 말)
 * AI 없이 100% 규칙으로
 */

import type { Change } from "./diff.ts";
import type { SizeMode } from "./tree.ts";

// 타입 한글 매핑
const typeToKorean: Record<string, string> = {
  container: "상자",
  text: "텍스트",
  image: "이미지",
  input: "입력요소",
};

// SizeMode 표현 변환
function sizeModeToString(size: SizeMode | undefined): string {
  if (!size || size.mode === "내용맞춤") {
    return "내용맞춤";
  }
  switch (size.mode) {
    case "고정":
      return `고정 ${size.px}px`;
    case "비율":
      return `비율 ${size.percent}%`;
    case "꽉채움":
      return "꽉채움";
    default:
      return "내용맞춤";
  }
}

// 묶기 (필수): 부모가 삭제/추가되면 자식은 제거
function groupChanges(changes: Change[]): Change[] {
  const parentMap = new Map<string, string | null>();

  for (const change of changes) {
    if (change.kind === "added" || change.kind === "removed") {
      parentMap.set(change.id, change.parentId);
    } else if (change.kind === "moved") {
      parentMap.set(change.id, change.toParentId);
    }
  }

  const getParentId = (id: string): string | null => {
    return parentMap.get(id) ?? null;
  };

  const addedIds = new Set(
    changes.filter((c) => c.kind === "added").map((c) => c.id)
  );
  const removedIds = new Set(
    changes.filter((c) => c.kind === "removed").map((c) => c.id)
  );

  return changes.filter((change) => {
    if (change.kind === "added") {
      let currentId: string | null = change.parentId;
      while (currentId) {
        if (addedIds.has(currentId)) return false;
        currentId = getParentId(currentId);
      }
      return true;
    }
    if (change.kind === "removed") {
      let currentId: string | null = change.parentId;
      while (currentId) {
        if (removedIds.has(currentId)) return false;
        currentId = getParentId(currentId);
      }
      return true;
    }
    return true;
  });
}

// 한국어 조사 선택 (받침 있으면 '을/이', 없으면 '를/가')
function getParticle(word: string, particle: "을를" | "이가"): string {
  // 마지막 글자의 유니코드 확인
  const lastChar = word.charCodeAt(word.length - 1);
  // 한글 범위: 0xAC00 ~ 0xD7A3
  if (lastChar < 0xAC00 || lastChar > 0xD7A3) {
    return particle === "을를" ? "을(를)" : "이(가)";
  }
  // 받침 여부: (유니코드 - 0xAC00) % 28 > 0 이면 받침 있음
  const hasBatchim = (lastChar - 0xAC00) % 28 > 0;
  if (particle === "을를") {
    return hasBatchim ? "을" : "를";
  } else {
    return hasBatchim ? "이" : "가";
  }
}

// 개별 변경 문장 생성
function describeAdded(change: Change & { kind: "added" }): string {
  const typeKorean = typeToKorean[change.elementType] || change.elementType;
  return `${change.name} ${typeKorean}${getParticle(typeKorean, "을를")} 추가했습니다`;
}

function describeRemoved(change: Change & { kind: "removed" }): string {
  return `${change.name}${getParticle(change.name, "을를")} 삭제했습니다`;
}

function describeMoved(change: Change & { kind: "moved" }): string {
  if (change.fromParentId === change.toParentId) {
    return `${change.name}의 순서를 ${change.fromIndex + 1}번째에서 ${
      change.toIndex + 1
    }번째로 옮겼습니다`;
  } else {
    return `${change.name}을(를) 다른 위치로 옮겼습니다`;
  }
}

// 값 표시 (undefined/null이면 "없음")
function fmt(v: unknown): string {
  if (v === undefined || v === null || v === "") return "없음";
  return String(v);
}

function describeModified(change: Change & { kind: "modified" }): string {
  const { name, property, before, after } = change;

  switch (property) {
    case "content":
      return `${name}의 글자를 '${before}'에서 '${after}'로 바꿨습니다`;
    case "label":
      return `${name}의 라벨을 '${before}'에서 '${after}'로 바꿨습니다`;
    case "name":
      return `이름을 '${before}'에서 '${after}'로 바꿨습니다`;
    case "background":
      return `${name}의 배경색을 바꿨습니다 (${fmt(before)} → ${fmt(after)})`;
    case "fontSize":
      return `${name}의 글자 크기를 ${fmt(before)}에서 ${fmt(after)}로 바꿨습니다`;
    case "bold":
      if (after === true) {
        return `${name}을(를) 굵게 했습니다`;
      } else {
        return `${name}의 굵게를 해제했습니다`;
      }
    case "layout.direction": {
      const afterDir = after === "vertical" ? "세로" : "가로";
      return `${name}의 배치를 ${afterDir}로 바꿨습니다`;
    }
    case "layout.align":
      return `${name}의 정렬을 바꿨습니다 (${fmt(before)} → ${fmt(after)})`;
    case "layout.gap":
      return `${name}의 간격을 ${fmt(before)}에서 ${fmt(after)}로 바꿨습니다`;
    case "layout.padding":
      return `${name}의 안쪽 여백을 ${fmt(before)}에서 ${fmt(after)}로 바꿨습니다`;
    case "width": {
      const beforeStr = sizeModeToString(before as SizeMode);
      const afterStr = sizeModeToString(after as SizeMode);
      return `${name}의 가로 크기를 ${beforeStr}에서 ${afterStr}로 바꿨습니다`;
    }
    case "height": {
      const beforeStr = sizeModeToString(before as SizeMode);
      const afterStr = sizeModeToString(after as SizeMode);
      return `${name}의 세로 크기를 ${beforeStr}에서 ${afterStr}로 바꿨습니다`;
    }
    case "src":
    case "alt":
      return `${name}의 이미지를 바꿨습니다`;
    case "inputType":
      return `${name}의 입력 타입을 '${before}'에서 '${after}'로 바꿨습니다`;
    default:
      return `${name}의 ${property}를(을) 바꿨습니다 (${fmt(before)} → ${fmt(after)})`;
  }
}

function describeChange(change: Change): string {
  switch (change.kind) {
    case "added":
      return describeAdded(change);
    case "removed":
      return describeRemoved(change);
    case "moved":
      return describeMoved(change);
    case "modified":
      return describeModified(change);
  }
}

// 변경 목록을 사람이 읽는 한국어 문장 배열로 변환
export function describeChanges(changes: Change[]): string[] {
  if (changes.length === 0) {
    return [];
  }

  const grouped = groupChanges(changes);
  const descriptions = grouped.map(describeChange);
  const unique = [...new Set(descriptions)];

  return unique;
}

// 변경 목록을 한 줄 요약
export function summarizeChanges(changes: Change[]): string {
  if (changes.length === 0) {
    return "변경 없음";
  }

  const grouped = groupChanges(changes);

  const counts = {
    added: 0,
    removed: 0,
    moved: 0,
    modified: 0,
  };

  for (const change of grouped) {
    counts[change.kind]++;
  }

  const parts: string[] = [];
  if (counts.added > 0) parts.push(`추가 ${counts.added}`);
  if (counts.removed > 0) parts.push(`삭제 ${counts.removed}`);
  if (counts.moved > 0) parts.push(`이동 ${counts.moved}`);
  if (counts.modified > 0) parts.push(`수정 ${counts.modified}`);

  return `${grouped.length}건 변경 (${parts.join(", ")})`;
}

// 변경 목록을 사람이 읽기 좋은 전체 문자열로 변환
export function formatChangeDescription(changes: Change[]): string {
  if (changes.length === 0) {
    return "변경 사항이 없습니다.";
  }

  const summary = summarizeChanges(changes);
  const descriptions = describeChanges(changes);

  return `${summary}\n\n${descriptions.map((d) => `• ${d}`).join("\n")}`;
}

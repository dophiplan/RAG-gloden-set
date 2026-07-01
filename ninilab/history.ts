/**
 * M2-3: 커밋·되돌리기 (이력 저장/복원)
 * Page별 이력 관리
 */

import type { Page } from "./project.ts";
import type { Change } from "./diff.ts";
import { diffTrees } from "./diff.ts";

// ============================================================
// 타입 정의
// ============================================================

/**
 * 커밋 = 한 시점의 스냅샷
 */
export interface Commit {
  /** 커밋 고유 ID */
  id: string;
  /** 커밋 메시지 */
  message: string;
  /** 생성 시간 (Date.now()) */
  timestamp: number;
  /** 페이지의 깊은 복사본 */
  snapshot: Page;
  /** 작성자 (선택) */
  author?: string;
}

/**
 * 페이지별 이력 관리
 */
export interface PageHistory {
  /** 페이지 ID */
  pageId: string;
  /** 커밋 목록 */
  commits: Commit[];
  /** 현재 HEAD 위치 (되돌리기 지원) */
  currentIndex: number;
}

// ============================================================
// ID 생성기
// ============================================================

let idCounter = 0;

function generateCommitId(): string {
  const randomPart = Math.random().toString(36).substring(2, 8);
  const counterPart = (++idCounter).toString(36);
  return `commit_${randomPart}${counterPart}`;
}

// ============================================================
// 이력 생성
// ============================================================

/**
 * 새 이력 생성
 */
export function createHistory(pageId: string): PageHistory {
  return {
    pageId,
    commits: [],
    currentIndex: -1, // 아직 커밋 없음
  };
}

// ============================================================
// 커밋
// ============================================================

/**
 * 현재 페이지 상태를 커밋으로 저장
 * @param history 대상 이력
 * @param page 현재 페이지 상태
 * @param message 커밋 메시지
 * @param author 작성자 (선택)
 * @returns 생성된 Commit
 */
export function commit(
  history: PageHistory,
  page: Page,
  message: string,
  author?: string
): Commit {
  // 깊은 복사로 snapshot 생성
  const snapshot = JSON.parse(JSON.stringify(page)) as Page;

  const newCommit: Commit = {
    id: generateCommitId(),
    message,
    timestamp: Date.now(),
    snapshot,
    author,
  };

  // undo 후 새 커밋하면 앞의 커밋들은 버려짐
  // currentIndex 이후의 커밋들 제거
  if (history.currentIndex < history.commits.length - 1) {
    history.commits = history.commits.slice(0, history.currentIndex + 1);
  }

  // 새 커밋 추가
  history.commits.push(newCommit);
  history.currentIndex = history.commits.length - 1;

  return newCommit;
}

// ============================================================
// 되돌리기 / 앞으로
// ============================================================

/**
 * n단계 되돌리기 (undo)
 * @param history 대상 이력
 * @param steps 되돌릴 단계 (기본: 1)
 * @returns 되돌린 상태의 Page 또는 null (더 이상 되돌릴 수 없음)
 */
export function undo(history: PageHistory, steps: number = 1): Page | null {
  const newIndex = history.currentIndex - steps;

  if (newIndex < 0) {
    return null; // 더 이상 되돌릴 수 없음
  }

  history.currentIndex = newIndex;
  return JSON.parse(JSON.stringify(history.commits[newIndex].snapshot)) as Page;
}

/**
 * n단계 앞으로 (redo)
 * @param history 대상 이력
 * @param steps 앞으로 갈 단계 (기본: 1)
 * @returns 앞으로 간 상태의 Page 또는 null (더 이상 앞으로 갈 수 없음)
 */
export function redo(history: PageHistory, steps: number = 1): Page | null {
  const newIndex = history.currentIndex + steps;

  if (newIndex >= history.commits.length) {
    return null; // 더 이상 앞으로 갈 수 없음
  }

  history.currentIndex = newIndex;
  return JSON.parse(JSON.stringify(history.commits[newIndex].snapshot)) as Page;
}

// ============================================================
// 특정 커밋으로 이동
// ============================================================

/**
 * 특정 커밋으로 이동 (checkout)
 * @param history 대상 이력
 * @param commitId 이동할 커밋 ID
 * @returns 해당 커밋 상태의 Page 또는 null (없는 커밋)
 */
export function checkout(history: PageHistory, commitId: string): Page | null {
  const index = history.commits.findIndex((c) => c.id === commitId);

  if (index === -1) {
    return null; // 없는 커밋
  }

  history.currentIndex = index;
  return JSON.parse(JSON.stringify(history.commits[index].snapshot)) as Page;
}

// ============================================================
// 조회
// ============================================================

/**
 * 현재 HEAD의 페이지 상태 얻기
 * @returns 현재 상태의 Page 또는 null (커밋 없음)
 */
export function getCurrentPage(history: PageHistory): Page | null {
  if (history.currentIndex < 0 || history.currentIndex >= history.commits.length) {
    return null;
  }

  return JSON.parse(
    JSON.stringify(history.commits[history.currentIndex].snapshot)
  ) as Page;
}

/**
 * 커밋 목록 조회 (최신순)
 * @returns Commit 배열 (최신 커밋이 앞)
 */
export function getCommitLog(history: PageHistory): Commit[] {
  return [...history.commits].reverse();
}

/**
 * 특정 커밋 조회
 */
export function getCommit(history: PageHistory, commitId: string): Commit | null {
  return history.commits.find((c) => c.id === commitId) ?? null;
}

// ============================================================
// 비교 (diff)
// ============================================================

/**
 * 두 커밋 비교
 * @param history 대상 이력
 * @param fromId 기준 커밋 ID
 * @param toId 비교 대상 커밋 ID
 * @returns 변경 목록 (Change[])
 */
export function diffCommits(
  history: PageHistory,
  fromId: string,
  toId: string
): Change[] {
  const fromCommit = getCommit(history, fromId);
  const toCommit = getCommit(history, toId);

  if (!fromCommit || !toCommit) {
    return [];
  }

  return diffTrees(fromCommit.snapshot.root, toCommit.snapshot.root);
}

// ============================================================
// 유틸리티
// ============================================================

/**
 * 이력 통계
 */
export function getHistoryStats(history: PageHistory): {
  totalCommits: number;
  currentPosition: number;
  canUndo: boolean;
  canRedo: boolean;
} {
  return {
    totalCommits: history.commits.length,
    currentPosition: history.currentIndex,
    canUndo: history.currentIndex > 0,
    canRedo: history.currentIndex < history.commits.length - 1,
  };
}

/**
 * 이력 초기화 (모든 커밋 삭제)
 */
export function clearHistory(history: PageHistory): void {
  history.commits = [];
  history.currentIndex = -1;
}

/**
 * 마지막 커밋 정보
 */
export function getLastCommit(history: PageHistory): Commit | null {
  if (history.commits.length === 0) {
    return null;
  }
  return history.commits[history.commits.length - 1];
}

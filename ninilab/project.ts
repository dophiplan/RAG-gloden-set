/**
 * M3-1: 프로젝트/페이지 구조 + 디자인 토큰
 * tree.ts를 확장한 프로젝트 레벨 데이터 모델
 */

import type { ContainerElement, Element } from "./tree.ts";
import { createContainer } from "./tree.ts";

// ============================================================
// 타입 정의
// ============================================================

/**
 * 토큰표 (디자인 시스템)
 * 프로젝트 전체가 공유
 */
export interface TokenTable {
  /** 값 토큰: 색상, 간격, 폰트 크기 등 */
  values: Record<string, string | number>;
  /** 컴포넌트 토큰: 재사용 가능한 트리 조각 */
  components: Record<string, ContainerElement>;
}

/**
 * 스타일 값 - 직접 값 또는 토큰 참조
 */
export type StyleValue = string | { token: string };

/**
 * 페이지 (화면 하나)
 */
export interface Page {
  id: string;
  name: string;
  /** 페이지의 루트 컨테이너 (화면 트리) */
  root: ContainerElement;
}

/**
 * 프로젝트 (최상위)
 */
export interface Project {
  id: string;
  name: string;
  /** 프로젝트 전체 공유 토큰표 */
  tokens: TokenTable;
  /** 페이지 목록 */
  pages: Page[];
}

// ============================================================
// ID 생성기
// ============================================================

let idCounter = 0;

function generateId(prefix: string): string {
  const randomPart = Math.random().toString(36).substring(2, 8);
  const counterPart = (++idCounter).toString(36);
  return `${prefix}_${randomPart}${counterPart}`;
}

// ============================================================
// 프로젝트 생성/조작
// ============================================================

/**
 * 새 프로젝트 생성
 */
export function createProject(name: string): Project {
  return {
    id: generateId("proj"),
    name,
    tokens: {
      values: {},
      components: {},
    },
    pages: [],
  };
}

/**
 * 프로젝트에 페이지 추가
 * @param project 대상 프로젝트
 * @param name 페이지 이름
 * @param root 루트 컨테이너 (생략 시 빈 container 생성)
 * @returns 생성된 Page
 */
export function addPage(
  project: Project,
  name: string,
  root?: ContainerElement
): Page {
  const page: Page = {
    id: generateId("page"),
    name,
    root: root ?? createContainer(name, { direction: "vertical" }),
  };

  project.pages.push(page);
  return page;
}

/**
 * 프로젝트에서 페이지 삭제
 * @param project 대상 프로젝트
 * @param pageId 삭제할 페이지 ID
 * @returns 성공 여부
 */
export function removePage(project: Project, pageId: string): boolean {
  const index = project.pages.findIndex((p) => p.id === pageId);
  if (index === -1) return false;

  project.pages.splice(index, 1);
  return true;
}

/**
 * 페이지 찾기
 */
export function findPage(project: Project, pageId: string): Page | null {
  return project.pages.find((p) => p.id === pageId) ?? null;
}

/**
 * 페이지 이름으로 찾기 (첫 번째 일치)
 */
export function findPageByName(project: Project, name: string): Page | null {
  return project.pages.find((p) => p.name === name) ?? null;
}

// ============================================================
// 토큰 조작
// ============================================================

/**
 * 값 토큰 등록/수정
 */
export function setTokenValue(
  project: Project,
  name: string,
  value: string | number
): void {
  project.tokens.values[name] = value;
}

/**
 * 컴포넌트 토큰 등록/수정
 */
export function setTokenComponent(
  project: Project,
  name: string,
  component: ContainerElement
): void {
  project.tokens.components[name] = component;
}

/**
 * 값 토큰 삭제
 */
export function removeTokenValue(project: Project, name: string): boolean {
  if (!(name in project.tokens.values)) return false;
  delete project.tokens.values[name];
  return true;
}

/**
 * 컴포넌트 토큰 삭제
 */
export function removeTokenComponent(project: Project, name: string): boolean {
  if (!(name in project.tokens.components)) return false;
  delete project.tokens.components[name];
  return true;
}

// ============================================================
// 토큰 해석 (값 조회)
// ============================================================

/**
 * 토큰 이름으로 실제 값 조회
 * @returns 토큰 값 또는 null (없을 경우)
 */
export function resolveToken(
  tokenTable: TokenTable,
  tokenName: string
): string | number | null {
  return tokenTable.values[tokenName] ?? null;
}

/**
 * 컴포넌트 토큰 이름으로 실제 컴포넌트 조회
 */
export function resolveCompone[기밀마스킹]oken(
  tokenTable: TokenTable,
  tokenName: string
): ContainerElement | null {
  return tokenTable.components[tokenName] ?? null;
}

/**
 * 스타일 값 해석
 * - 값 직접 지정: 그대로 반환
 * - 토큰 참조: 토큰표에서 조회
 * - 없는 토큰: null 반환 (에러 아님)
 */
export function resolveStyle(
  value: StyleValue | undefined,
  tokenTable: TokenTable
): string | number | null {
  if (value === undefined) return null;

  // 값 직접 지정
  if (typeof value === "string") return value;

  // 토큰 참조
  if (typeof value === "object" && "token" in value) {
    return resolveToken(tokenTable, value.token);
  }

  return null;
}

// ============================================================
// 유틸리티
// ============================================================

/**
 * 프로젝트 통계
 */
export function getProjectStats(project: Project): {
  pageCount: number;
  valueTokenCount: number;
  compone[기밀마스킹]okenCount: number;
} {
  return {
    pageCount: project.pages.length,
    valueTokenCount: Object.keys(project.tokens.values).length,
    compone[기밀마스킹]okenCount: Object.keys(project.tokens.components).length,
  };
}

/**
 * 프로젝트를 JSON으로 직렬화 (저장용)
 */
export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/**
 * JSON에서 프로젝트 복원
 */
export function deserializeProject(json: string): Project {
  return JSON.parse(json) as Project;
}

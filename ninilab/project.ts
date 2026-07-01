/**
 * M3: 프로젝트/페이지 구조
 * 여러 페이지를 담는 그릇
 */

import type { ContainerElement, Element } from "./tree.ts";
import { createContainer } from "./tree.ts";

// ============================================================
// 타입 정의
// ============================================================

/**
 * 페이지 (화면 하나)
 */
export interface Page {
  id: string;              // 고유 id (el_ 형식 재사용)
  name: string;            // "로그인 페이지" 등
  root: ContainerElement;  // 이 페이지의 화면 트리
}

/**
 * 프로젝트 (최상위)
 */
export interface Project {
  id: string;
  name: string;
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
 * 빈 페이지 1개로 시작
 */
export function createProject(name: string): Project {
  const project: Project = {
    id: generateId("proj"),
    name,
    pages: [],
  };
  
  // 빈 페이지 1개로 시작
  addPage(project, "페이지 1");
  
  return project;
}

/**
 * 프로젝트에 페이지 추가
 * @param project 대상 프로젝트
 * @param name 페이지 이름 (생략 시 "새 페이지")
 * @param root 루트 컨테이너 (생략 시 빈 container 생성)
 * @returns 생성된 Page
 */
export function addPage(
  project: Project,
  name?: string,
  root?: ContainerElement
): Page {
  const page: Page = {
    id: generateId("page"),
    name: name ?? `페이지 ${project.pages.length + 1}`,
    root: root ?? createContainer(name ?? "루트", { direction: "vertical" }),
  };

  project.pages.push(page);
  return page;
}

/**
 * 프로젝트에서 페이지 삭제
 * @param project 대상 프로젝트
 * @param pageId 삭제할 페이지 ID
 * @returns 성공 여부 (최소 1개는 남김)
 */
export function removePage(project: Project, pageId: string): boolean {
  // 최소 1개는 남겨야 함
  if (project.pages.length <= 1) {
    return false;
  }
  
  const index = project.pages.findIndex((p) => p.id === pageId);
  if (index === -1) {
    return false;
  }

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
 * 페이지 이름 변경
 */
export function renamePage(
  project: Project,
  pageId: string,
  name: string
): boolean {
  const page = findPage(project, pageId);
  if (!page) return false;
  
  page.name = name;
  return true;
}

// ============================================================
// 유틸리티
// ============================================================

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

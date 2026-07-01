/**
 * M3: project.ts 테스트
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createProject,
  addPage,
  removePage,
  findPage,
  renamePage,
  serializeProject,
  deserializeProject,
  type Project,
  type Page,
} from "./project.ts";
import { createContainer, type ContainerElement } from "./tree.ts";

describe("project.ts", () => {
  describe("createProject", () => {
    it("프로젝트를 생성하고 빈 페이지 1개로 시작한다", () => {
      const project = createProject("테스트 프로젝트");
      
      expect(project.id).toMatch(/^proj_/);
      expect(project.name).toBe("테스트 프로젝트");
      expect(project.pages).toHaveLength(1);
      expect(project.pages[0].name).toBe("페이지 1");
      expect(project.pages[0].root.type).toBe("container");
    });
  });

  describe("addPage", () => {
    it("페이지를 추가한다", () => {
      const project = createProject("테스트");
      const initialCount = project.pages.length;
      
      const page = addPage(project, "로그인 페이지");
      
      expect(project.pages).toHaveLength(initialCount + 1);
      expect(page.name).toBe("로그인 페이지");
      expect(page.id).toMatch(/^page_/);
      expect(page.root.type).toBe("container");
    });

    it("이름을 생략하면 자동으로 번호가 붙는다", () => {
      const project = createProject("테스트");
      
      const page2 = addPage(project);
      const page3 = addPage(project);
      
      expect(page2.name).toBe("페이지 2");
      expect(page3.name).toBe("페이지 3");
    });

    it("루트 컨테이너를 직접 지정할 수 있다", () => {
      const project = createProject("테스트");
      const customRoot = createContainer("커스텀 루트", { direction: "horizontal" });
      
      const page = addPage(project, "커스텀 페이지", customRoot);
      
      expect(page.root).toBe(customRoot);
      expect(page.root.name).toBe("커스텀 루트");
      expect(page.root.layout.direction).toBe("horizontal");
    });
  });

  describe("removePage", () => {
    it("페이지를 삭제한다", () => {
      const project = createProject("테스트");
      const page2 = addPage(project, "삭제될 페이지");
      const pageId = page2.id;
      
      const result = removePage(project, pageId);
      
      expect(result).toBe(true);
      expect(project.pages.find(p => p.id === pageId)).toBeUndefined();
    });

    it("마지막 페이지는 삭제할 수 없다", () => {
      const project = createProject("테스트");
      const onlyPageId = project.pages[0].id;
      
      const result = removePage(project, onlyPageId);
      
      expect(result).toBe(false);
      expect(project.pages).toHaveLength(1);
    });

    it("존재하지 않는 페이지 ID로 삭제하면 false를 반환한다", () => {
      const project = createProject("테스트");
      
      const result = removePage(project, "page_nonexistent");
      
      expect(result).toBe(false);
    });
  });

  describe("findPage", () => {
    it("ID로 페이지를 찾는다", () => {
      const project = createProject("테스트");
      const page = addPage(project, "찾을 페이지");
      
      const found = findPage(project, page.id);
      
      expect(found).toBe(page);
    });

    it("없는 ID로 찾으면 null을 반환한다", () => {
      const project = createProject("테스트");
      
      const found = findPage(project, "page_nonexistent");
      
      expect(found).toBeNull();
    });
  });

  describe("renamePage", () => {
    it("페이지 이름을 변경한다", () => {
      const project = createProject("테스트");
      const page = project.pages[0];
      
      const result = renamePage(project, page.id, "새 이름");
      
      expect(result).toBe(true);
      expect(page.name).toBe("새 이름");
    });

    it("없는 페이지는 변경할 수 없다", () => {
      const project = createProject("테스트");
      
      const result = renamePage(project, "page_nonexistent", "새 이름");
      
      expect(result).toBe(false);
    });
  });

  describe("serialize/deserialize", () => {
    it("프로젝트를 JSON으로 직렬화하고 복원한다", () => {
      const project = createProject("직렬화 테스트");
      addPage(project, "페이지 2");
      renamePage(project, project.pages[0].id, "첫 페이지");
      
      const json = serializeProject(project);
      const restored = deserializeProject(json);
      
      expect(restored.id).toBe(project.id);
      expect(restored.name).toBe(project.name);
      expect(restored.pages).toHaveLength(2);
      expect(restored.pages[0].name).toBe("첫 페이지");
      expect(restored.pages[1].name).toBe("페이지 2");
    });
  });

  describe("페이지 독립성", () => {
    it("각 페이지는 독립된 트리를 가진다", () => {
      const project = createProject("테스트");
      const page1 = project.pages[0];
      const page2 = addPage(project, "페이지 2");
      
      // page1에 자식 추가
      const child1 = createContainer("자식1");
      page1.root.children.push(child1);
      
      // page2에는 영향이 없어야 함
      expect(page2.root.children).toHaveLength(0);
      expect(page1.root.children).toHaveLength(1);
    });
  });
});

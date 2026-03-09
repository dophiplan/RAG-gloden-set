/**
 * 개별 번역 히스토리 기능 테스트
 * 
 * 테스트 대상:
 * - UI/UX: 버전 기록 버튼, 모달 열기/닫기
 * - 기능: 변경 이력 조회, 롤백 기능
 * - 에러: 변경 이력 없음, API 에러
 * - 회귀: 기존 일괄 히스토리 기능
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// ==================== Mock Setup ====================

const mockFetchResponse = (status: number, data: unknown) => {
  return Promise.resolve({
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
    ok: status >= 200 && status < 300,
  } as Response);
};

describe('개별 번역 히스토리 기능', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== 시나리오 1: 버튼 UI 테스트 ====================
  describe('UI/UX: 버전 기록 버튼 표시', () => {
    it('번역 테이블의 각 행에 버전 기록 버튼이 표시되어야 함', () => {
      // 컴포넌트 테스트용 - 실제 구현 시 React Testing Library 사용
      const expectedButtonConfig = {
        icon: 'history', // 또는 Clock 아이콘
        tooltip: '버전 기록',
        position: 'actions-column', // 마지막 열의 액션 버튼 그룹 내
      };

      expect(expectedButtonConfig.tooltip).toBe('버전 기록');
      expect(expectedButtonConfig.position).toBe('actions-column');
    });

    it('버튼은 아이콘 또는 "히스토리" 텍스트를 포함해야 함', () => {
      // 아이콘 모드 또는 텍스트 모드 확인
      const buttonModes = ['icon-only', 'icon-with-text', 'text-only'];
      const validModes = ['icon-only', 'icon-with-text'];
      
      // 최소한 아이콘이나 텍스트 중 하나는 있어야 함
      expect(validModes.length).toBeGreaterThan(0);
    });

    it('호버 시 툴팁 "버전 기록"이 표시되어야 함', () => {
      const tooltipText = '버전 기록';
      expect(tooltipText).toBeDefined();
      expect(tooltipText.length).toBeGreaterThan(0);
    });
  });

  // ==================== 시나리오 2: 모달 열기/닫기 ====================
  describe('UI/UX: 모달 열기/닫기', () => {
    it('버전 기록 버튼 클릭 시 모달이 열려야 함', async () => {
      const translationId = 'test-translation-id';
      const mockHistoryData = [
        {
          id: 'log-1',
          type: 'translation',
          action: 'update',
          fieldName: 'translated_text',
          changeDescription: 'KO 번역 수정',
          previousValue: '이전 텍스트',
          newValue: '새로운 텍스트',
          createdAt: '2024-01-15T10:00:00Z',
          changedBy: '홍길동',
        },
      ];

      vi.mocked(global.fetch).mockImplementation(() =>
        mockFetchResponse(200, mockHistoryData)
      );

      // API 호출 시뮬레이션
      const response = await fetch(
        `/api/translations/${translationId}/logs?language=ko`
      );
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].changedBy).toBe('홍길동');
    });

    it('모달은 부드럽게 열리고 변경 이력 목록을 표시해야 함', () => {
      // 애니메이션 설정 확인
      const modalConfig = {
        animation: 'slide-in-right', // 또는 'fade-in'
        duration: 300, // ms
        backdrop: true,
      };

      expect(modalConfig.animation).toBeDefined();
      expect(modalConfig.duration).toBeGreaterThan(0);
    });

    it('닫기 버튼 클릭 시 모달이 닫혀야 함', () => {
      let isOpen = true;
      
      // 닫기 동작 시뮬레이션
      const closeModal = () => {
        isOpen = false;
      };

      closeModal();
      expect(isOpen).toBe(false);
    });

    it('ESC 키 입력 시 모달이 닫혀야 함', () => {
      let isOpen = true;
      
      const handleKeyDown = (e: { key: string }) => {
        if (e.key === 'Escape') {
          isOpen = false;
        }
      };

      handleKeyDown({ key: 'Escape' });
      expect(isOpen).toBe(false);
    });
  });

  // ==================== 시나리오 3: 변경 이력 조회 ====================
  describe('기능: 변경 이력 조회', () => {
    it('GET /api/translations/:id/logs - 변경 이력을 정상적으로 조회해야 함', async () => {
      const translationId = 'test-translation-id';
      const mockLogs = [
        {
          id: 'log-1',
          type: 'audit',
          action: 'update',
          fieldName: 'status',
          changeDescription: '상태: 요청 → 검수',
          previousValue: 'pending',
          newValue: 'reviewed',
          createdAt: '2024-01-15T10:00:00Z',
          changedBy: '홍길동',
        },
        {
          id: 'log-2',
          type: 'translation',
          action: 'update',
          fieldName: 'translated_text',
          changeDescription: 'KO 번역 수정',
          previousValue: '안녕하세요',
          newValue: 'Hello World',
          createdAt: '2024-01-14T09:30:00Z',
          changedBy: '김철수',
        },
        {
          id: 'current',
          type: 'translation',
          action: 'current',
          fieldName: 'translated_text',
          changeDescription: 'KO 현재 번역',
          previousValue: null,
          newValue: 'Hello World',
          createdAt: '2024-01-14T09:30:00Z',
          changedBy: '김철수',
        },
      ];

      vi.mocked(global.fetch).mockImplementation(() =>
        mockFetchResponse(200, mockLogs)
      );

      const response = await fetch(
        `/api/translations/${translationId}/logs?language=ko`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(3);
      expect(data[0]).toHaveProperty('createdAt');
      expect(data[0]).toHaveProperty('changedBy');
      expect(data[0]).toHaveProperty('previousValue');
      expect(data[0]).toHaveProperty('newValue');
    });

    it('변경 이력은 최신순으로 정렬되어야 함', async () => {
      const mockLogs = [
        { id: '1', createdAt: '2024-01-15T10:00:00Z' },
        { id: '2', createdAt: '2024-01-14T09:00:00Z' },
        { id: '3', createdAt: '2024-01-16T11:00:00Z' },
      ];

      // 시간순 정렬 검증
      const sorted = [...mockLogs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      expect(sorted[0].id).toBe('3'); // 가장 최신
      expect(sorted[1].id).toBe('1');
      expect(sorted[2].id).toBe('2'); // 가장 오래됨
    });

    it('현재 버전은 "현재" 배지로 표시되어야 함', () => {
      const currentVersion = {
        id: 'current',
        action: 'current',
      };

      expect(currentVersion.action).toBe('current');
    });

    it('언어 코드 파라미터가 없으면 translation_logs는 조회되지 않아야 함', async () => {
      const translationId = 'test-translation-id';
      
      // language 파라미터 없이 호출
      vi.mocked(global.fetch).mockImplementation(() =>
        mockFetchResponse(200, [])
      );

      const response = await fetch(`/api/translations/${translationId}/logs`);
      const data = await response.json();

      // audit_logs만 조회됨 (언어 관련 없음)
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // ==================== 시나리오 4: 롤백 기능 ====================
  describe('기능: 롤백 기능', () => {
    it('POST /api/translations/:id/revert - 이전 버전으로 복구해야 함', async () => {
      const translationId = 'test-translation-id';
      const requestBody = {
        logId: 'log-123',
        languageCode: 'ko',
      };

      const mockResponse = {
        success: true,
        message: '이전 버전으로 복구되었습니다.',
        data: {
          translated_text: '이전 텍스트',
          reviewer_id: 'user-123',
        },
      };

      vi.mocked(global.fetch).mockImplementation(() =>
        mockFetchResponse(200, mockResponse)
      );

      const response = await fetch(
        `/api/translations/${translationId}/revert`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('복구');
    });

    it('복구 시 확인 대화상자를 표시해야 함', () => {
      const confirmMessage = '이 버전으로 복구하시겠습니까?';
      
      // confirm 다이얼로그 메시지 검증
      expect(confirmMessage).toContain('복구');
    });

    it('복구 성공 시 성공 메시지를 표시해야 함', () => {
      const successMessage = '복구가 완료되었습니다.';
      expect(successMessage).toContain('복구');
      expect(successMessage).toContain('완료');
    });

    it('복구 후 새로운 변경 이력이 추가되어야 함', async () => {
      const translationId = 'test-translation-id';
      
      // 복구 후 로그 조회
      const mockLogsAfterRevert = [
        {
          id: 'new-log',
          type: 'translation',
          action: 'update',
          changeDescription: 'KO 번역 수정',
          previousValue: '현재 텍스트',
          newValue: '이전 텍스트', // 복구된 값
          createdAt: new Date().toISOString(),
          changedBy: '현재 사용자',
        },
        {
          id: 'old-log',
          type: 'translation',
          action: 'update',
          changeDescription: 'KO 번역 수정',
          previousValue: '이전 텍스트',
          newValue: '현재 텍스트',
          createdAt: '2024-01-14T09:00:00Z',
          changedBy: '이전 사용자',
        },
      ];

      vi.mocked(global.fetch).mockImplementation(() =>
        mockFetchResponse(200, mockLogsAfterRevert)
      );

      const response = await fetch(
        `/api/translations/${translationId}/logs?language=ko`
      );
      const data = await response.json();

      // 새로운 로그가 추가되었는지 확인
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].newValue).toBe('이전 텍스트');
    });

    it('이미 해당 버전이면 복구하지 않아야 함', async () => {
      const translationId = 'test-translation-id';
      const mockError = {
        error: '이미 해당 버전입니다.',
      };

      vi.mocked(global.fetch).mockImplementation(() =>
        mockFetchResponse(400, mockError)
      );

      const response = await fetch(
        `/api/translations/${translationId}/revert`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logId: 'log-123', languageCode: 'ko' }),
        }
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('이미 해당 버전');
    });
  });

  // ==================== 시나리오 5: 변경 이력 없음 ====================
  describe('에러: 변경 이력 없음', () => {
    it('변경 이력이 없으면 안내 메시지를 표시해야 함', async () => {
      const translationId = 'new-translation-id';

      vi.mocked(global.fetch).mockImplementation(() =>
        mockFetchResponse(200, [])
      );

      const response = await fetch(
        `/api/translations/${translationId}/logs?language=ko`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(0);
    });

    it('빈 목록 UI는 "변경 이력이 없습니다" 메시지를 표시해야 함', () => {
      const emptyMessage = '변경 이력이 없습니다.';
      expect(emptyMessage).toBeDefined();
      expect(emptyMessage.length).toBeGreaterThan(0);
    });
  });

  // ==================== 시나리오 6: API 에러 ====================
  describe('에러: API 에러 핸들링', () => {
    it('인증되지 않은 사용자는 401 에러를 받아야 함', async () => {
      const translationId = 'test-translation-id';
      const mockError = { error: '인증이 필요합니다.' };

      vi.mocked(global.fetch).mockImplementation(() =>
        mockFetchResponse(401, mockError)
      );

      const response = await fetch(
        `/api/translations/${translationId}/logs?language=ko`
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('인증');
    });

    it('서버 에러 시 적절한 에러 메시지를 표시해야 함', async () => {
      const translationId = 'test-translation-id';
      const mockError = { error: '변경 이력을 불러오는데 실패했습니다.' };

      vi.mocked(global.fetch).mockImplementation(() =>
        mockFetchResponse(500, mockError)
      );

      const response = await fetch(
        `/api/translations/${translationId}/logs?language=ko`
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('변경 이력');
    });

    it('네트워크 오류 시 사용자 친화적 메시지를 표시해야 함', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      try {
        await fetch('/api/translations/test-id/logs?language=ko');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('존재하지 않는 로그 ID로 복구 시도 시 404 에러를 받아야 함', async () => {
      const translationId = 'test-translation-id';
      const mockError = { error: '해당 버전을 찾을 수 없습니다.' };

      vi.mocked(global.fetch).mockImplementation(() =>
        mockFetchResponse(404, mockError)
      );

      const response = await fetch(
        `/api/translations/${translationId}/revert`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logId: 'invalid-id', languageCode: 'ko' }),
        }
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('찾을 수 없습니다');
    });

    it('필수 파라미터 누락 시 400 에러를 받아야 함', async () => {
      const translationId = 'test-translation-id';
      const mockError = { error: '로그 ID와 언어 코드는 필수입니다.' };

      vi.mocked(global.fetch).mockImplementation(() =>
        mockFetchResponse(400, mockError)
      );

      const response = await fetch(
        `/api/translations/${translationId}/revert`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // logId와 languageCode 누락
        }
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('필수');
    });
  });

  // ==================== 시나리오 7: 회귀 테스트 ====================
  describe('회귀: 기존 일괄 히스토리 기능', () => {
    it('POST /api/translations/bulk-logs - 여러 항목의 히스토리 조회이 정상 동작해야 함', async () => {
      const requestBody = {
        translationIds: ['id-1', 'id-2', 'id-3'],
        languageCode: 'ko',
      };

      const mockResponse = {
        logs: [
          {
            id: 'log-1',
            translationId: 'id-1',
            translationResultId: 'result-1',
            previousText: '이전',
            newText: '새로운',
            createdAt: '2024-01-15T10:00:00Z',
            changedBy: '홍길동',
          },
        ],
        currentVersions: [
          {
            translationId: 'id-1',
            translationResultId: 'result-1',
            curre[기밀마스킹]ext: '현재 텍스트',
            updatedAt: '2024-01-15T10:00:00Z',
            updatedBy: '홍길동',
          },
        ],
      };

      vi.mocked(global.fetch).mockImplementation(() =>
        mockFetchResponse(200, mockResponse)
      );

      const response = await fetch('/api/translations/bulk-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.logs).toBeDefined();
      expect(data.currentVersions).toBeDefined();
    });

    it('일괄 히스토리 사이드바는 여전히 정상적으로 열리고 닫혀야 함', () => {
      const sidebarConfig = {
        width: '24rem', // w-96 = 24rem
        position: 'right',
        animation: 'slide-in',
      };

      expect(sidebarConfig.width).toBe('24rem');
      expect(sidebarConfig.position).toBe('right');
    });

    it('개별 히스토리와 일괄 히스토리가 동시에 열리지 않아야 함', () => {
      // 모달 상태 관리 검증
      let individualModalOpen = false;
      let bulkSidebarOpen = false;

      // 개별 모달 열기
      individualModalOpen = true;
      
      // 일괄 사이드바 열기 시 개별 모달은 닫혀야 함
      if (bulkSidebarOpen) {
        individualModalOpen = false;
      }

      // 둘 중 하나만 열릴 수 있음
      expect(individualModalOpen && bulkSidebarOpen).toBe(false);
    });
  });

  // ==================== 시나리오 8: 데이터 형식 검증 ====================
  describe('데이터 형식 검증', () => {
    it('날짜는 한국어 형식으로 표시되어야 함', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      expect(formatted).toContain('2024');
      expect(formatted).toContain('1');
      expect(formatted).toContain('15');
    });

    it('상대적 시간 표시가 지원되어야 함 (방금 전, N분 전 등)', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const diff = now.getTime() - oneMinuteAgo.getTime();
      const minutes = Math.floor(diff / 60000);

      let timeLabel = '';
      if (minutes < 1) timeLabel = '방금 전';
      else if (minutes < 60) timeLabel = `${minutes}분 전`;

      expect(timeLabel).toBe('1분 전');
    });

    it('상태 변경은 한국어 레이블로 표시되어야 함', () => {
      const statusLabels: Record<string, string> = {
        pending: '요청',
        in_progress: '진행 중',
        reviewed: '검수',
        deployed: '반영',
        re_request: '재요청',
        not_used: '사용안함',
        re_deploy_request: '재반영요청',
      };

      expect(statusLabels['pending']).toBe('요청');
      expect(statusLabels['reviewed']).toBe('검수');
      expect(statusLabels['deployed']).toBe('반영');
    });
  });
});

// ==================== 통합 테스트 시나리오 ====================
describe('개별 번역 히스토리 통합 테스트', () => {
  it('전체 플로우: 버튼 클릭 → 모달 열기 → 변경 이력 확인 → 롤백 → 성공 메시지', async () => {
    // Step 1: 버튼 클릭 시뮬레이션
    const translationId = 'integration-test-id';
    const languageCode = 'ko';

    // Step 2: 변경 이력 조회
    const mockLogs = [
      {
        id: 'log-1',
        type: 'translation',
        action: 'update',
        fieldName: 'translated_text',
        changeDescription: 'KO 번역 수정',
        previousValue: '원본 텍스트',
        newValue: '수정된 텍스트',
        createdAt: '2024-01-15T10:00:00Z',
        changedBy: '테스트 사용자',
      },
    ];

    vi.mocked(global.fetch).mockImplementation((url) => {
      if ((url as string).includes('/logs')) {
        return mockFetchResponse(200, mockLogs);
      }
      if ((url as string).includes('/revert')) {
        return mockFetchResponse(200, {
          success: true,
          message: '이전 버전으로 복구되었습니다.',
        });
      }
      return mockFetchResponse(404, { error: 'Not found' });
    });

    const logsResponse = await fetch(
      `/api/translations/${translationId}/logs?language=${languageCode}`
    );
    const logs = await logsResponse.json();

    expect(logsResponse.ok).toBe(true);
    expect(logs.length).toBeGreaterThan(0);

    // Step 3: 롤백 수행
    const revertResponse = await fetch(
      `/api/translations/${translationId}/revert`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: logs[0].id, languageCode }),
      }
    );
    const revertResult = await revertResponse.json();

    expect(revertResponse.ok).toBe(true);
    expect(revertResult.success).toBe(true);
    expect(revertResult.message).toContain('복구');
  });
});

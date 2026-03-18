-- Migration: Add work_platforms column to users table
-- Created: 2026-03-18
-- Description: Change 'work_scope' to 'work_platforms' and link with platforms table

-- ============================================================================
-- Step 1: Add new work_platforms column
-- ============================================================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS work_platforms TEXT[] DEFAULT '{}';

COMMENT ON COLUMN users.work_platforms IS '담당 플랫폼 (platforms.code 참조)';

-- ============================================================================
-- Step 2: Migrate existing data from work_scope
-- ============================================================================

-- work_scope에서 플랫폼 관련 값만 추출하여 work_platforms에 설정
UPDATE users 
SET work_platforms = ARRAY(
  SELECT UNNEST(work_scope) 
  WHERE UNNEST(work_scope) IN (
    'Android', 'Back', 'core', 'Email', 'Error', 'etc', 
    'Flutter', 'Front', 'iOS', 'Mac', 'Win',
    '스토어(android)', '스토어(iOS)'
  )
)
WHERE work_scope IS NOT NULL 
  AND work_scope <> '{}';

-- ============================================================================
-- Step 3: Add validation trigger (optional)
-- ============================================================================

-- platforms 테이블의 code를 참조하는 유효성 검사 함수
CREATE OR REPLACE FUNCTION validate_user_platforms()
RETURNS TRIGGER AS $$
DECLARE
  invalid_platforms TEXT[];
BEGIN
  -- NULL 또는 빈 배열은 허용
  IF NEW.work_platforms IS NULL OR NEW.work_platforms = '{}' THEN
    RETURN NEW;
  END IF;
  
  -- 유효하지 않은 플랫폼 코드 확인
  SELECT ARRAY(
    SELECT UNNEST(NEW.work_platforms)
    EXCEPT
    SELECT code FROM platforms
  ) INTO invalid_platforms;
  
  IF array_length(invalid_platforms, 1) > 0 THEN
    RAISE EXCEPTION 'Invalid platform codes: %', invalid_platforms
      USING HINT = 'Platform codes must exist in the platforms table';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (선택사항 - 성능 고려 시 제거)
-- DROP TRIGGER IF EXISTS validate_user_platforms_trigger ON users;
-- CREATE TRIGGER validate_user_platforms_trigger
--   BEFORE INSERT OR UPDATE ON users
--   FOR EACH ROW
--   EXECUTE FUNCTION validate_user_platforms();

-- ============================================================================
-- Step 4: Create index for better query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_work_platforms 
ON users USING GIN(work_platforms);

-- ============================================================================
-- Step 5: Update views or functions if needed
-- ============================================================================

-- user_view가 있다면 업데이트
-- CREATE OR REPLACE VIEW user_view AS ...

-- ============================================================================
-- Rollback Instructions (주석으로 보존)
-- ============================================================================
/*
롤백이 필요한 경우:

1. 트리거 제거 (생성한 경우)
   DROP TRIGGER IF EXISTS validate_user_platforms_trigger ON users;
   DROP FUNCTION IF EXISTS validate_user_platforms();

2. 인덱스 제거
   DROP INDEX IF EXISTS idx_users_work_platforms;

3. 컬럼 제거 (주의: 데이터 영구 삭제)
   ALTER TABLE users DROP COLUMN IF EXISTS work_platforms;

4. work_scope 복원 (백업 필요)
   -- 백업 테이블에서 복원
*/

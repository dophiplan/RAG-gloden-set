-- 번역 버전 히스토리(로그) 테이블 생성
CREATE TABLE IF NOT EXISTS public.translation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  translation_result_id UUID NOT NULL REFERENCES public.translation_results(id) ON DELETE CASCADE,
  previous_text TEXT NOT NULL,
  new_text TEXT NOT NULL,
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_translation_logs_result_id ON public.translation_logs(translation_result_id);
CREATE INDEX IF NOT EXISTS idx_translation_logs_created_at ON public.translation_logs(created_at);

-- RLS 활성화
ALTER TABLE public.translation_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 팀 멤버만 조회 가능
CREATE POLICY "Team members can view translation logs" ON public.translation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.translation_results tr
      JOIN public.translations t ON tr.translation_id = t.id
      JOIN public.team_members tm ON t.team_id = tm.team_id
      WHERE tr.id = translation_logs.translation_result_id
      AND tm.user_id = auth.uid()
    )
  );

-- RLS 정책: 인증된 사용자만 생성 가능
CREATE POLICY "Authenticated users can create translation logs" ON public.translation_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

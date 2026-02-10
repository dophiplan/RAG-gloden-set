# Claude Code와 함께 만드는 번역 관리 시스템 (2) - 고급 기능 구현과 기술적 도전

> **"PDF에서 텍스트를 추출하고, AI가 번역을 제안하며, 대량 데이터를 실시간으로 처리한다면?"**
> 복잡한 기능들을 하나씩 정복해 나간 개발 여정 두 번째 이야기

---

## 🎯 들어가며: 기본을 넘어서

Story 1에서 기본 CRUD 기능을 완성했다면, 이제는 진짜 도전이 시작됩니다. 사용자들이 실제로 "와, 이거 정말 유용하네!"라고 말하게 만드는 기능들을 구현할 차례입니다.

이번 스토리에서는 다음과 같은 고급 기능들을 다룹니다:
- PDF/이미지에서 텍스트 자동 추출
- OpenAI/Claude API를 활용한 AI 번역 제안
- 수백 개의 번역을 동시에 처리하는 벌크 시스템
- 실시간 협업을 위한 상태 관리
- 복잡한 필터링과 정렬 로직

---

## 📄 도전 1: PDF 텍스트 추출 시스템

### 문제 상황

사용자들은 매번 텍스트를 복사-붙여넣기하기 싫어합니다. 특히 100개가 넘는 UI 텍스트를 번역 요청할 때는 더욱 그렇죠.

"PDF나 스크린샷을 업로드하면 자동으로 텍스트를 추출해서 번역 요청을 만들어주면 안 될까요?"

### 기술 선택: unpdf + 파일 업로드

```typescript
// lib/pdf-parser.ts
import { getTextFromPDF } from 'unpdf'

export async function extractTextFromPDF(file: File): Promise<string[]> {
  try {
    // PDF를 ArrayBuffer로 읽기
    const arrayBuffer = await file.arrayBuffer()

    // unpdf로 텍스트 추출
    const { text } = await getTextFromPDF(arrayBuffer)

    // 줄바꿈으로 분리하고 빈 줄 제거
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    // 중복 제거
    const uniqueLines = [...new Set(lines)]

    return uniqueLines
  } catch (error) {
    console.error('PDF parsing error:', error)
    throw new Error('PDF 파싱에 실패했습니다.')
  }
}
```

### 파일 업로드 컴포넌트

```typescript
// components/FileUploader.tsx
'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

export interface UploadedFile {
  file: File
  id: string
}

interface FileUploaderProps {
  onFilesChange: (files: UploadedFile[]) => void
  maxFiles?: number
  accept?: Record<string, string[]>
}

export default function FileUploader({
  onFilesChange,
  maxFiles = 5,
  accept = {
    'application/pdf': ['.pdf'],
    'image/*': ['.png', '.jpg', '.jpeg']
  }
}: FileUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: `${file.name}-${Date.now()}`
    }))

    const updated = [...files, ...newFiles].slice(0, maxFiles)
    setFiles(updated)
    onFilesChange(updated)
  }, [files, maxFiles, onFilesChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    multiple: true
  })

  const removeFile = (id: string) => {
    const updated = files.filter(f => f.id !== id)
    setFiles(updated)
    onFilesChange(updated)
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <svg className="mx-auto w-12 h-12 text-gray-400" /* ... */ />
          {isDragActive ? (
            <p className="text-blue-600 font-medium">파일을 여기에 놓으세요</p>
          ) : (
            <>
              <p className="text-gray-600">
                클릭하거나 드래그하여 파일 업로드
              </p>
              <p className="text-sm text-gray-500">
                PDF, PNG, JPG 지원 (최대 {maxFiles}개)
              </p>
            </>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map(({ file, id }) => (
            <div
              key={id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <FileIcon type={file.type} />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(id)}
                className="text-red-600 hover:text-red-700"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### API 엔드포인트: 파일 파싱

```typescript
// app/api/files/parse/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromPDF } from '@/lib/pdf-parser'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json(
        { error: '파일을 업로드해주세요.' },
        { status: 400 }
      )
    }

    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const texts = await extractTextFromPDF(file)

          return {
            fileName: file.name,
            success: true,
            texts,
            count: texts.length
          }
        } catch (error) {
          return {
            fileName: file.name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })
    )

    const allTexts = results
      .filter(r => r.success)
      .flatMap(r => r.texts || [])

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: files.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        totalTexts: allTexts.length
      },
      extracted_texts: allTexts
    })
  } catch (error) {
    console.error('File parsing error:', error)
    return NextResponse.json(
      { error: '파일 파싱 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
```

### 사용자 경험 개선: 3단계 업로드 플로우

```typescript
// app/(dashboard)/upload/page.tsx
'use client'

import { useState } from 'react'
import FileUploader from '@/components/FileUploader'
import { showSuccess, showError } from '@/lib/notifications'

export default function UploadPage() {
  const [currentStep, setCurrentStep] = useState(1) // 1: 업로드, 2: 정보입력, 3: 확인
  const [files, setFiles] = useState([])
  const [parsedTexts, setParsedTexts] = useState([])
  const [selectedTexts, setSelectedTexts] = useState(new Set())

  const handleParse = async () => {
    const formData = new FormData()
    files.forEach(({ file }) => formData.append('files', file))

    const response = await fetch('/api/files/parse', {
      method: 'POST',
      body: formData
    })

    const data = await response.json()

    if (data.success) {
      setParsedTexts(data.extracted_texts)
      setSelectedTexts(new Set(data.extracted_texts.map((_, i) => i)))
      setCurrentStep(3)
      showSuccess(`${data.summary.totalTexts}개의 텍스트가 추출되었습니다!`)
    } else {
      showError('파일 파싱에 실패했습니다.')
    }
  }

  const handleCreateTranslations = async () => {
    const selectedTextArray = parsedTexts.filter((_, i) => selectedTexts.has(i))

    const response = await fetch('/api/translations/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: selectedTextArray,
        // ... 기타 메타데이터
      })
    })

    if (response.ok) {
      showSuccess('번역 요청이 생성되었습니다!')
      router.push('/translations')
    }
  }

  return (
    <div>
      <StepIndicator currentStep={currentStep} />

      {currentStep === 1 && (
        <FileUploader
          onFilesChange={setFiles}
          maxFiles={5}
        />
      )}

      {currentStep === 2 && (
        <MetadataForm onNext={() => handleParse()} />
      )}

      {currentStep === 3 && (
        <TextSelector
          texts={parsedTexts}
          selected={selectedTexts}
          onChange={setSelectedTexts}
          onConfirm={handleCreateTranslations}
        />
      )}
    </div>
  )
}
```

---

## 🤖 도전 2: AI 기반 자동 번역 제안

### OpenAI GPT-4 통합

```typescript
// lib/ai/openai.ts
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function translateWithOpenAI(
  sourceText: string,
  targetLanguage: string,
  context?: string
): Promise<string> {
  const languageNames = {
    en: 'English',
    ja: 'Japanese',
    ko: 'Korean',
    'zh-CN': 'Simplified Chinese',
    'zh-TW': 'Traditional Chinese'
  }

  const systemPrompt = `You are a professional translator specializing in software UI/UX translation.
Translate the given text to ${languageNames[targetLanguage]}.
Maintain the tone, context, and technical accuracy.
${context ? `Context: ${context}` : ''}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: sourceText }
      ],
      temperature: 0.3,
      max_tokens: 500
    })

    return completion.choices[0]?.message?.content || ''
  } catch (error) {
    console.error('OpenAI translation error:', error)
    throw error
  }
}
```

### Claude API 통합 (대안)

```typescript
// lib/ai/anthropic.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function translateWithClaude(
  sourceText: string,
  targetLanguage: string,
  context?: string
): Promise<string> {
  const prompt = `Translate the following text to ${targetLanguage}.
${context ? `Context: ${context}` : ''}

Text to translate:
${sourceText}

Translation:`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt }
      ]
    })

    const content = message.content[0]
    return content.type === 'text' ? content.text : ''
  } catch (error) {
    console.error('Claude translation error:', error)
    throw error
  }
}
```

### API 엔드포인트: AI 번역 제안

```typescript
// app/api/ai/translate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { translateWithOpenAI } from '@/lib/ai/openai'
import { translateWithClaude } from '@/lib/ai/anthropic'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { translationId, languageCode, provider = 'openai' } = body

  try {
    // 원문과 문맥 조회
    const { data: translation } = await supabase
      .from('translations')
      .select('source_text, context')
      .eq('id', translationId)
      .single()

    if (!translation) {
      return NextResponse.json({ error: 'Translation not found' }, { status: 404 })
    }

    // AI 번역 실행
    const translatedText = provider === 'openai'
      ? await translateWithOpenAI(
          translation.source_text,
          languageCode,
          translation.context
        )
      : await translateWithClaude(
          translation.source_text,
          languageCode,
          translation.context
        )

    // AI 제안을 translation_results에 저장
    const { data: result } = await supabase
      .from('translation_results')
      .update({
        ai_suggested_text: translatedText
      })
      .eq('translation_id', translationId)
      .eq('language_code', languageCode)
      .select()
      .single()

    return NextResponse.json({
      success: true,
      suggestion: translatedText,
      result
    })
  } catch (error) {
    console.error('AI translation error:', error)
    return NextResponse.json(
      { error: 'AI 번역 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
```

### UI: AI 번역 제안 버튼

```typescript
// components/translations/AITranslateButton.tsx
'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { showSuccess, showError } from '@/lib/notifications'

interface AITranslateButtonProps {
  translationId: string
  languageCode: string
  onSuggestion: (text: string) => void
}

export default function AITranslateButton({
  translationId,
  languageCode,
  onSuggestion
}: AITranslateButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleAITranslate = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          translationId,
          languageCode,
          provider: 'openai'
        })
      })

      const data = await response.json()

      if (data.success) {
        onSuggestion(data.suggestion)
        showSuccess('AI 번역이 생성되었습니다!')
      } else {
        showError('AI 번역 생성에 실패했습니다.')
      }
    } catch (error) {
      showError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleAITranslate}
      loading={loading}
      className="flex items-center gap-2"
    >
      <SparklesIcon className="w-4 h-4" />
      AI 제안 받기
    </Button>
  )
}
```

---

## 📊 도전 3: 대량 데이터 처리 시스템

### 문제: 100개 이상의 번역을 동시에 생성

단순히 반복문으로 API를 100번 호출하면:
- ❌ 너무 느림 (각 요청마다 네트워크 왕복)
- ❌ 데이터베이스 부하
- ❌ 타임아웃 발생 가능

### 해결: 벌크 생성 API

```typescript
// app/api/translations/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { texts, product_codes, scope, priority, languages } = body

  try {
    // 1단계: 모든 번역 레코드 생성 (배치 삽입)
    const translations = texts.map((text: string) => ({
      source_text: text,
      product_codes,
      scope,
      priority,
      requester_id: user.id,
      status: '요청됨'
    }))

    const { data: createdTranslations, error: translationError } = await supabase
      .from('translations')
      .insert(translations)
      .select('id')

    if (translationError) throw translationError

    // 2단계: 각 번역에 대해 언어별 결과 레코드 생성
    const results = createdTranslations.flatMap((translation) =>
      languages.map((lang: string) => ({
        translation_id: translation.id,
        language_code: lang,
        status: 'pending'
      }))
    )

    const { error: resultsError } = await supabase
      .from('translation_results')
      .insert(results)

    if (resultsError) throw resultsError

    return NextResponse.json({
      success: true,
      created: createdTranslations.length,
      totalResults: results.length
    })
  } catch (error) {
    console.error('Bulk creation error:', error)
    return NextResponse.json(
      { error: '대량 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
```

### 최적화: 트랜잭션과 배치 처리

```typescript
// 개선된 버전: 트랜잭션 사용
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient() // 서비스 역할로 승격

  try {
    // Supabase는 자동 트랜잭션을 제공하지 않으므로
    // RPC 함수를 사용한 트랜잭션 처리
    const { data, error } = await adminClient.rpc('create_translations_bulk', {
      p_texts: texts,
      p_product_codes: product_codes,
      p_scope: scope,
      p_priority: priority,
      p_languages: languages,
      p_requester_id: user.id
    })

    if (error) throw error

    return NextResponse.json({
      success: true,
      created: data.translations_created,
      totalResults: data.results_created
    })
  } catch (error) {
    console.error('Bulk creation error:', error)
    return NextResponse.json(
      { error: '대량 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
```

### PostgreSQL 함수: 벌크 생성 최적화

```sql
-- Supabase SQL Editor에서 실행
CREATE OR REPLACE FUNCTION create_translations_bulk(
  p_texts TEXT[],
  p_product_codes TEXT[],
  p_scope TEXT,
  p_priority TEXT,
  p_languages TEXT[],
  p_requester_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_translation_id UUID;
  v_text TEXT;
  v_lang TEXT;
  v_translations_created INT := 0;
  v_results_created INT := 0;
BEGIN
  -- 각 텍스트에 대해 반복
  FOREACH v_text IN ARRAY p_texts LOOP
    -- 번역 생성
    INSERT INTO translations (
      source_text,
      product_codes,
      scope,
      priority,
      requester_id,
      status
    ) VALUES (
      v_text,
      p_product_codes,
      p_scope,
      p_priority,
      p_requester_id,
      '요청됨'
    ) RETURNING id INTO v_translation_id;

    v_translations_created := v_translations_created + 1;

    -- 각 언어에 대한 결과 생성
    FOREACH v_lang IN ARRAY p_languages LOOP
      INSERT INTO translation_results (
        translation_id,
        language_code,
        status
      ) VALUES (
        v_translation_id,
        v_lang,
        'pending'
      );

      v_results_created := v_results_created + 1;
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'translations_created', v_translations_created,
    'results_created', v_results_created
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🔍 도전 4: 고급 필터링과 검색

### 다중 필터 조합

```typescript
// hooks/useTranslationFilters.ts
import { useState, useMemo } from 'react'

export function useTranslationFilters(translations: Translation[]) {
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<[Date?, Date?]>([])

  const filteredTranslations = useMemo(() => {
    return translations.filter(translation => {
      // 제품 필터
      if (selectedProduct && !translation.product_codes?.includes(selectedProduct)) {
        return false
      }

      // 상태 필터
      if (selectedStatus && translation.status !== selectedStatus) {
        return false
      }

      // 언어 필터
      if (selectedLanguage) {
        const hasLanguage = translation.results?.some(
          r => r.language_code === selectedLanguage
        )
        if (!hasLanguage) return false
      }

      // 검색 쿼리
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSource = translation.source_text.toLowerCase().includes(query)
        const matchesContext = translation.context?.toLowerCase().includes(query)
        if (!matchesSource && !matchesContext) return false
      }

      // 날짜 범위
      if (dateRange[0] || dateRange[1]) {
        const created = new Date(translation.created_at)
        if (dateRange[0] && created < dateRange[0]) return false
        if (dateRange[1] && created > dateRange[1]) return false
      }

      return true
    })
  }, [translations, selectedProduct, selectedStatus, selectedLanguage, searchQuery, dateRange])

  return {
    filteredTranslations,
    filters: {
      selectedProduct,
      setSelectedProduct,
      selectedStatus,
      setSelectedStatus,
      selectedLanguage,
      setSelectedLanguage,
      searchQuery,
      setSearchQuery,
      dateRange,
      setDateRange
    },
    clearFilters: () => {
      setSelectedProduct('')
      setSelectedStatus('')
      setSelectedLanguage('')
      setSearchQuery('')
      setDateRange([])
    }
  }
}
```

### 정렬 기능

```typescript
// hooks/useTranslationSort.ts
import { useState, useMemo } from 'react'

type SortField = 'created_at' | 'priority' | 'status' | 'source_text'
type SortDirection = 'asc' | 'desc'

export function useTranslationSort(translations: Translation[]) {
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const sortedTranslations = useMemo(() => {
    return [...translations].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'priority':
          const priorityOrder = { '상': 3, '중': 2, '하': 1 }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'source_text':
          comparison = a.source_text.localeCompare(b.source_text)
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [translations, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  return {
    sortedTranslations,
    sortField,
    sortDirection,
    handleSort
  }
}
```

---

## 🎨 도전 5: 복잡한 UI 상태 관리

### Custom Hooks로 상태 분리

```typescript
// hooks/useTranslationData.ts
import { useState, useEffect } from 'react'

export function useTranslationData(initialFilters = {}) {
  const [translations, setTranslations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTranslations = async (filters = {}) => {
    setLoading(true)
    try {
      const params = new URLSearchParams(filters)
      const response = await fetch(`/api/translations?${params}`)
      const data = await response.json()

      if (data.error) throw new Error(data.error)

      setTranslations(data.translations)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTranslations(initialFilters)
  }, [])

  return {
    translations,
    loading,
    error,
    refetch: fetchTranslations
  }
}
```

### 낙관적 업데이트 (Optimistic Update)

```typescript
// hooks/useTranslationMutations.ts
import { useState } from 'react'
import { showSuccess, showError } from '@/lib/notifications'

export function useTranslationMutations(onSuccess?: () => void) {
  const [updating, setUpdating] = useState(false)

  const updateTranslation = async (id: string, updates: any) => {
    setUpdating(true)

    // 낙관적 업데이트: UI를 먼저 변경
    const optimisticUpdate = new CustomEvent('optimistic-update', {
      detail: { id, updates }
    })
    window.dispatchEvent(optimisticUpdate)

    try {
      const response = await fetch(`/api/translations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      const data = await response.json()

      if (data.error) throw new Error(data.error)

      showSuccess('변경사항이 저장되었습니다.')
      onSuccess?.()

      return data.translation
    } catch (error) {
      // 실패 시 롤백
      const rollback = new CustomEvent('optimistic-rollback', {
        detail: { id }
      })
      window.dispatchEvent(rollback)

      showError('저장에 실패했습니다.')
      throw error
    } finally {
      setUpdating(false)
    }
  }

  return {
    updateTranslation,
    updating
  }
}
```

---

## 📈 2-3일차 성과와 배운 점

### 완성된 고급 기능
- ✅ PDF/이미지 텍스트 추출 시스템
- ✅ AI 기반 자동 번역 제안 (OpenAI/Claude)
- ✅ 대량 번역 생성 및 처리
- ✅ 고급 필터링과 검색
- ✅ 정렬 및 페이지네이션
- ✅ 낙관적 업데이트로 빠른 UX

### 기술적 도전과 해결

**1. 파일 처리 성능**
- 문제: 큰 PDF 파일 처리 시 타임아웃
- 해결: 청크 단위 처리 + Worker 스레드 활용

**2. AI API 비용 관리**
- 문제: 무분별한 AI 호출로 비용 증가
- 해결: 캐싱 + 사용자당 일일 할당량 설정

**3. 대량 데이터 처리**
- 문제: 100개 이상 번역 생성 시 느림
- 해결: PostgreSQL 함수로 배치 처리

**4. 복잡한 필터 조합**
- 문제: 여러 필터 조합 시 성능 저하
- 해결: useMemo로 메모이제이션 + 인덱스 최적화

### Claude Code와의 협업 하이라이트

**"이거 가능할까?" → "됩니다!"**

복잡한 기능을 구현할 때마다 Claude Code는:
- 최선의 라이브러리 추천
- 보일러플레이트 자동 생성
- 엣지 케이스 미리 고려
- 성능 최적화 제안

### 다음 스토리 예고

Story 3에서는 가장 드라마틱한 순간을 다룹니다:
- 🚀 Railway 배포 도전
- 🔥 연속되는 빌드 실패
- 💪 TypeScript 타입 에러와의 전쟁
- 🎉 최종 배포 성공과 환호

마지막 스토리에서 어떻게 모든 장애물을 극복하고 프로덕션에 성공적으로 배포했는지 만나보세요!

---

**Keywords:** PDF 텍스트 추출, OpenAI API, Claude API, AI 번역, 대량 데이터 처리, PostgreSQL 최적화, React Hooks, 낙관적 업데이트, 파일 업로드, unpdf, 벌크 생성, 트랜잭션, 필터링, 정렬, 상태 관리, useMemo, Custom Hooks, 성능 최적화

**Total Words:** 3,124 단어

# Language Monster Design System

> **버전**: 1.0  
> **마지막 업데이트**: 2026-03-12  
> **기준 해상도**: 1920x1080 (FHD) ~ 3840x2160 (4K UHD)

---

## 📋 목차

1. [Color System](#1-color-system)
2. [Typography](#2-typography)
3. [Spacing & Layout](#3-spacing--layout)
4. [Components](#4-components)
5. [Responsive Guidelines](#5-responsive-guidelines)
6. [Accessibility](#6-accessibility)

---

## 1. Color System

### 1.1 Primary Colors

| 이름 | Blue Theme | White Theme | 사용처 |
|------|------------|-------------|--------|
| Primary | `#818CF8` | `#3B82F6` | 주요 버튼, 활성 상태 |
| Primary Hover | `#6366F1` | `#2563EB` | 호버 상태 |
| Primary Active | `#4F46E5` | `#1D4ED8` | 클릭/활성 상태 |
| Primary Light | `#E0E7FF` | `#DBEAFE` | 배경, 라이트 톤 |
| Primary Lighter | `#C7D2FE` | `#EFF6FF` | 매우 밝은 배경 |

### 1.2 Text Colors

| 이름 | Blue Theme | White Theme | 사용처 |
|------|------------|-------------|--------|
| Text Main | `#2C3E50` | `#111827` | 본문, 제목 |
| Text Secondary | `#546E7A` | `#6B7280` | 부제목, 설명 |
| Text Muted | `#90A4AE` | `#9CA3AF` | 비활성, 힌트 |

### 1.3 Background & Surface

| 이름 | Blue Theme | White Theme | 사용처 |
|------|------------|-------------|--------|
| Background | `#FAFAFA` | `#FFFFFF` | 페이지 배경 |
| Background Secondary | `#F5F5F5` | `#F9FAFB` | 카드 배경, 구분 영역 |
| Surface | `#FFFFFF` | `#FFFFFF` | 카드, 모달, 팝업 |

### 1.4 Border Colors

| 이름 | Blue Theme | White Theme | 사용처 |
|------|------------|-------------|--------|
| Border | `#C7D2FE` | `#E5E7EB` | 기본 복더 |
| Border Light | `#E0E7FF` | `#F3F4F6` | 밝은 복더, 디바이더 |
| Border Divider | `#D4E3FC` | `#E5E7EB` | 구분선 |

### 1.5 Accent Colors

| 이름 | HEX | 사용처 |
|------|-----|--------|
| Success (Green) | `#10B981` / `#22C55E` | 성공 상태, 완료 |
| Warning (Orange) | `#F59E0B` | 경고, 주의 |
| Danger (Red) | `#EF4444` | 에러, 삭제 |

### 1.6 CSS Variables 사용법

```css
/* CSS 변수로 접근 */
.element {
  color: var(--primary);
  background: var(--background);
  border-color: var(--border);
}
```

```tsx
// Tailwind 클래스로 접근
text-primary bg-background border-border
```

---

## 2. Typography

### 2.1 Font Family

```css
--font-sans: 'Noto Sans KR', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

### 2.2 Type Scale

| 레벨 | 크기 | 행 높이 | 굵기 | 사용처 |
|------|------|---------|------|--------|
| H1 | 24px | 32px | 700 (Bold) | 페이지 제목 |
| H2 | 20px | 28px | 700 (Bold) | 섹션 제목 |
| H3 | 18px | 26px | 600 (Semibold) | 서브 섹션 |
| Body Large | 16px | 24px | 400 (Regular) | 중요 본문 |
| Body | 14px | 22px | 400 (Regular) | 일반 본문 |
| Body Small | 13px | 20px | 400 (Regular) | 부가 설명 |
| Caption | 12px | 18px | 400 (Regular) | 캡션, 힌트 |
| Overline | 11px | 16px | 500 (Medium) | 라벨, 태그 |

### 2.3 Font Weight

| 이름 | 값 | 사용처 |
|------|-----|--------|
| Regular | 400 | 본문 |
| Medium | 500 | 강조 텍스트 |
| Semibold | 600 | 서브 제목 |
| Bold | 700 | 제목, 버튼 |

---

## 3. Spacing & Layout

### 3.1 Spacing Scale

| 토큰 | 값 | 사용처 |
|------|-----|--------|
| space-1 | 4px | 아이콘-텍스트 간격 |
| space-2 | 8px | 작은 여백 |
| space-3 | 12px | 버튼 낮은 여백 |
| space-4 | 16px | 기본 여백 |
| space-6 | 24px | 섹션 간 여백 |
| space-8 | 32px | 큰 여백 |

### 3.2 Border Radius

| 토큰 | Blue Theme | White Theme | 사용처 |
|------|------------|-------------|--------|
| radius-sm | 12px | 6px | 작은 컴포넌트 |
| radius-md | 16px | 8px | 버튼, 인풋 |
| radius-lg | 20px | 12px | 카드 |
| radius-xl | 24px | 16px | 모달, 팝업 |

### 3.3 Shadows

| 토큰 | Blue Theme | White Theme | 사용처 |
|------|------------|-------------|--------|
| shadow-sm | `0 2px 8px rgba(129, 140, 248, 0.08)` | `0 1px 3px rgba(0,0,0,0.1)` | 작은 컴포넌트 |
| shadow-md | `0 4px 16px rgba(129, 140, 248, 0.12)` | `0 4px 6px rgba(0,0,0,0.07)` | 카드, 버튼 |
| shadow-lg | `0 8px 24px rgba(129, 140, 248, 0.15)` | `0 10px 15px rgba(0,0,0,0.05)` | 모달, 드롭다운 |

### 3.4 Layout Grid

- **Container Max Width**: 1440px
- **Grid System**: CSS Flexbox 기반
- **Gutter**: 24px

---

## 4. Components

### 4.1 Button

#### Specs
| 속성 | 값 |
|------|-----|
| Height (sm) | 32px |
| Height (md) | 40px |
| Height (lg) | 48px |
| Padding | px-3~6 (사이즈별) |
| Border Radius | rounded-lg (8px~12px 테마별) |
| Font Size | text-xs ~ text-base |
| Font Weight | font-medium |

#### Variants
```tsx
// Primary - 주요 액션
<Button variant="primary">저장</Button>

// Secondary - 보조 액션
<Button variant="secondary">취소</Button>

// Danger - 위험한 액션
<Button variant="danger">삭제</Button>

// Ghost - 미세한 액션
<Button variant="ghost">더보기</Button>
```

#### Usage Guidelines
- **Primary**: 한 화면에 1개만 사용 (주요 CTA)
- **Secondary**: 취소, 뒤로가기 등 보조 액션
- **Danger**: 삭제, 해제 등 되돌릴 수 없는 액션
- **Ghost**: 아이콘 버튼, 툴바 액션

---

### 4.2 Tabs (ProductTabs / StatusTabs)

#### Specs
| 속성 | 값 |
|------|-----|
| Height | 48px (py-3) |
| Padding | px-4 md:px-6 (반응형) |
| Border Width | border-b-3 (활성), border-b-2 (기본) |
| Border Radius | rounded-t-xl |
| Gap | space-x-1 (4px) |
| Font Weight | font-bold |
| Font Size | text-sm |

#### Active State Style
```css
/* 활성 탭 */
border-primary
text-primary-active
bg-gradient-to-t from-primary-light to-white
shadow-lg
transform translate-y-0.5
box-shadow: 0 -2px 8px rgba(123, 201, 111, 0.2)
```

#### Responsive Behavior
- **< 768px**: `px-4`, 가로 스크롤 가능
- **>= 768px**: `px-6`, 전체 표시
- **4K**: 동일한 비율 유지, 컨테이너 max-width 제한

#### Usage Guidelines
- **ProductTabs**: 제품 선택, 메인 네비게이션
- **StatusTabs**: 상태 필터, 서브 네비게이션
- 빈 탭(count=0): `disabled` + `text-gray-300`

---

### 4.3 Card

#### Specs
| 속성 | 값 |
|------|-----|
| Background | bg-surface |
| Border Radius | rounded-lg ~ rounded-xl |
| Shadow | shadow-sm ~ shadow-md |
| Padding | p-4 ~ p-6 |

---

### 4.4 Input / Select

#### Specs
| 속성 | 값 |
|------|-----|
| Height | 40px |
| Padding | px-4 py-2 |
| Border Radius | rounded-lg |
| Border | border-2 border-border |
| Focus | focus:ring-2 focus:ring-primary |

---

## 5. Responsive Guidelines

### 5.1 Breakpoints

```typescript
// tailwind.config.ts
screens: {
  'sm': '640px',   // 모바일
  'md': '768px',   // 태블릿
  'lg': '1024px',  // 작은 데스크톱
  'xl': '1280px',  // 데스크톱
  '2xl': '1536px', // 큰 데스크톱
  '4k': '3840px',  // 4K
}
```

### 5.2 Resolution Guidelines

| 해상도 | 권장 설정 | 비고 |
|--------|----------|------|
| 1920x1080 (FHD) | 기준 디자인 | 100% 스케일 |
| 2560x1440 (QHD) | 125% 스케일 | 같은 레이아웃 |
| 3840x2160 (4K) | 150-200% 스케일 | OS DPI 설정 활용 |

### 5.3 Component Responsive Rules

#### Tabs
```tsx
// 기본 (모바일)
px-4 py-3 text-sm

// 태블릿 이상
md:px-6 md:py-3
```

#### Container
```tsx
// 모든 해상도에서 중앙 정렬, 최대 너비 제한
max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8
```

---

## 6. Accessibility

### 6.1 ARIA Attributes

#### Tabs
```tsx
<div role="tablist" aria-label="탭 설명">
  <button 
    role="tab"
    aria-selected={isActive}
    aria-controls="panel-id"
    tabIndex={isActive ? 0 : -1}
  >
    탭 라벨
  </button>
</div>
```

#### Button
```tsx
<button 
  aria-disabled={isDisabled}
  aria-busy={isLoading}
>
  라벨
</button>
```

### 6.2 Keyboard Navigation

| 컴포넌트 | 키 | 동작 |
|----------|-----|------|
| Tabs | ← → | 이전/다음 탭 |
| Tabs | Home/End | 첫/마지막 탭 |
| Button | Enter/Space | 클릭 |
| Modal | Esc | 닫기 |

### 6.3 Focus Visible

```css
/* 모든 인터랙티브 요소에 적용 */
focus:outline-none 
focus-visible:ring-2 
focus-visible:ring-primary 
focus-visible:ring-offset-2
```

### 6.4 Color Contrast

- **Normal Text**: 4.5:1 이상
- **Large Text**: 3:1 이상
- **UI Components**: 3:1 이상

---

## 7. Best Practices

### 7.1 Do's
- ✅ CSS 변수와 Tailwind 클래스 혼합 사용
- ✅ 모든 인터랙티브 요소에 `focus-visible` 스타일 적용
- ✅ 반응형 클래스 사용 (`md:`, `lg:`)
- ✅ `min-width`, `flex-shrink-0`로 레이아웃 깨짐 방지

### 7.2 Don'ts
- ❌ 하드코딩된 색상 직접 사용 (예: `text-blue-500`)
- ❌ `!important` 남용
- ❌ 해상도별로 다른 레이아웃 구성
- ❌ 빈 탭에 클릭 가능한 스타일 적용

---

## 8. Change Log

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-03-12 | 1.0 | 초안 작성 - Color, Typography, Spacing, Components 정의 |

---

**참고 문서**
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

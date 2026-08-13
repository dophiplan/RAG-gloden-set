---
name: 3-build
description: Generate code scaffolding and architecture from specs. Triggers: 아키텍처, 3단계, 구조 생성, 코드 뼈대, 스캐폴드. Use for creating file structure, component mapping, and implementation skeletons.
---

# Spec Scaffolding

Generate implementation-ready code structure and scaffolding from technical specifications.

## When to Apply

- Technical specification is finalized
- Need to create initial file/project structure
- Breaking down spec into implementable units
- Defining component/module boundaries
- Creating API contracts before implementation

## Output Format

**Always start output with:** `[아키텍처 스킬]` or `[3-build]`

Then produce a scaffolding plan with this structure:

```markdown
# Implementation Scaffold: [Feature Name]

## Architecture Overview
```
[Diagram or text description of component relationships]
```

## Directory Structure
```
project/
├── src/
│   ├── components/          # UI components
│   ├── services/            # Business logic
│   ├── api/                 # API routes/handlers
│   └── utils/               # Shared utilities
├── tests/
│   ├── unit/
│   └── integration/
└── types/                   # Shared type definitions
```

## Component Breakdown

### [Component Name]
- **Purpose**: [Single responsibility]
- **Spec Mapping**: Links to FR-XX, FR-YY
- **File**: `src/components/[Component].tsx`
- **Interface**:
```typescript
interface [Component]Props {
  // Properties derived from spec requirements
}
```
- **Dependencies**: [List of other components/services]

## API Contracts

### [Endpoint Name]
- **Method/Path**: `GET /api/resource`
- **Spec Mapping**: FR-XX
- **Request**:
```typescript
interface [Request] {
  // Parameters
}
```
- **Response**:
```typescript
interface [Response] {
  // Return structure
}
```
- **Error Cases**: [List expected error scenarios]

## Implementation Order
1. [Phase 1]: [Files/components to create]
2. [Phase 2]: [Next set of components]
3. [Phase 3]: [Final integration]

## File Templates

### [template-name].[ext]
```[language]
// Template content with TODOs for implementation
```
```

## Workflow

### Step 1: Spec Analysis
Parse the specification:
- Extract all functional requirements (FRs)
- Identify data entities and relationships
- Note integration points
- Recognize UI flows and states

### Step 2: Architecture Decision
Determine:
- Project structure pattern (MVC, feature-based, etc.)
- Technology stack constraints
- Shared vs. isolated modules
- State management approach

### Step 3: Component Mapping
Map each requirement to implementation:
| Requirement | Component | File Path | Notes |
|-------------|-----------|-----------|-------|
| FR-01 | UserList | `src/components/UserList.tsx` | Uses API X |

### Step 4: Interface Definition
Define contracts:
- Component props/interfaces
- API request/response types
- Service method signatures
- Database schema (if applicable)

### Step 5: Dependency Graph
Identify:
- Component hierarchy (parent/child)
- Service dependencies
- API dependencies
- External library requirements

### Step 6: Sequencing
Order implementation by:
1. Foundation (types, utilities, base components)
2. Core features (independent components)
3. Integration (connected features)
4. Polish (error handling, loading states)

## Scaffolding Patterns

### Frontend Component
```typescript
// [ComponentName].tsx
interface [ComponentName]Props {
  // From spec: data requirements
}

export function [ComponentName](props: [ComponentName]Props) {
  // TODO: Implement based on FR-XX
  return (
    <div>
      {/* Structure from spec */}
    </div>
  );
}
```

### API Handler
```typescript
// [endpoint].ts
export async function handler(req: Request) {
  // TODO: Validate request (FR-XX input validation)
  
  // TODO: Call service layer
  
  // TODO: Return response matching spec
  // TODO: Handle errors per spec
}
```

### Service Module
```typescript
// [service].ts
export class [ServiceName] {
  // TODO: Implement business logic per FR-XX, FR-YY
  
  async [methodName](): Promise<[ReturnType]> {
    throw new Error('TODO: Implement');
  }
}
```

## Validation Checklist

- [ ] Every P0 requirement maps to a component/function
- [ ] All interfaces match spec data requirements
- [ ] Error cases have handling paths
- [ ] No circular dependencies in component graph
- [ ] File naming follows project conventions

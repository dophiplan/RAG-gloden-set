---
name: 1-plan
description: Transform vague requirements into clear technical specifications. Triggers: 기획, 1단계, 요구사항 정리, 스펙 정의, PRD 변환. Use for incomplete requirements, scope clarification, or feature request refinement.
---

# Spec Refinement

Transform ambiguous or high-level requirements into precise, implementable technical specifications.

## When to Apply

- Requirements are vague, incomplete, or conflicting
- PRD exists but needs technical translation
- Scope boundaries are unclear
- Multiple interpretations possible
- Need to identify hidden assumptions or edge cases

## Output Format

**Always start output with:** `[기획 스킬]` or `[1-plan]`

Then produce specifications in this structure:

```markdown
# Technical Specification: [Feature Name]

## Overview
- Goal: One-sentence objective
- Success Criteria: 2-3 measurable outcomes

## Functional Requirements
| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-01 | [Clear description] | P0/P1/P2 | [Edge cases, constraints] |

## Non-Functional Requirements
| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-01 | Performance | [Metric] | [Target value] |

## Scope
### In Scope
- [ ] Specific item 1

### Out of Scope
- [ ] Excluded item 1

## Open Questions
1. [Question] → [Recommended resolution]

## Dependencies
- [Dependency]: [Impact]
```

## Workflow

### Step 1: Requirement Analysis
Read and analyze the input:
- Identify the core user need or business goal
- Extract explicit requirements
- Note implied requirements from context
- Flag ambiguities and contradictions

### Step 2: Clarification Questions
If requirements are incomplete, ask:
- What problem does this solve for users?
- Are there specific performance/latency requirements?
- What platforms/environments must be supported?
- What are the critical user journeys?
- What data volumes are expected?

### Step 3: Structure Translation
Convert the clarified requirements into the output format:
- Group related requirements logically
- Assign priorities (P0=critical, P1=important, P2=nice-to-have)
- Define measurable acceptance criteria
- Explicitly state assumptions

### Step 4: Gap Identification
Identify and document:
- Missing requirements that block implementation
- Technical constraints not mentioned
- Integration points requiring coordination
- Edge cases not covered

## Priority Guidelines

- **P0 (Critical)**: Feature cannot ship without this. Blocks user core workflow.
- **P1 (Important)**: Significantly impacts user experience. Should be in MVP.
- **P2 (Nice-to-have)**: Enhancement. Can be deferred to future iterations.

## Common Patterns

### From User Story to Spec
Input: "As a user, I want to reset my password"

Translation:
1. Identify actors: User, System, Email Service
2. Define flow: Request → Verify identity → Send token → Reset → Confirm
3. Edge cases: Invalid email, expired token, rate limiting
4. Output: Structured FRs covering each step with validation rules

### From PRD to Dev Spec
1. Extract user-facing features from PRD
2. Map to technical components (API, UI, DB, etc.)
3. Define data models and interfaces
4. Specify error handling and state management

## Validation Checklist

Before finalizing, verify:
- [ ] Each requirement is testable
- [ ] Acceptance criteria are measurable
- [ ] Scope boundaries are explicit
- [ ] Dependencies are identified
- [ ] No ambiguous pronouns ("this", "that", "it")
- [ ] Edge cases are covered or explicitly deferred

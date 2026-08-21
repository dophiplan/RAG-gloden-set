---
name: 5-test
description: Create test cases and testing strategies. Triggers: 테스트, 5단계, 테스트작성, 테스트케이스, E2E. Use for unit tests, integration tests, and test coverage.
---

# Test Authoring

Generate comprehensive test cases and testing strategies from specifications.

## When to Apply

- Specification needs test coverage
- Writing unit tests for new features
- Creating integration test scenarios
- Building E2E test flows
- Establishing acceptance criteria
- Generating test data requirements
- Planning regression test suites

## Output Formats

**Always start output with:** `[테스트 스킬]` or `[5-test]`

### 1. Test Plan

```markdown
# Test Plan: [Feature Name]

## Scope
- **Features Under Test**: [List]
- **Test Levels**: [Unit / Integration / E2E]
- **Out of Scope**: [Explicit exclusions]

## Test Strategy
- **Unit Tests**: Focus on business logic, pure functions
- **Integration Tests**: API contracts, database interactions
- **E2E Tests**: Critical user journeys

## Test Cases Summary
| Category | Count | Priority |
|----------|-------|----------|
| Positive | [N] | P0 |
| Negative | [N] | P0 |
| Edge Cases | [N] | P1 |
| Error Handling | [N] | P0 |

## Risk Areas
1. [High-risk area] → [Mitigation test approach]
```

### 2. Test Case Specification

```markdown
## Test Case: [TC-XXX] [Title]

**Requirement**: Links to FR-XX
**Priority**: P0/P1/P2
**Type**: Unit / Integration / E2E

### Preconditions
- [State requirements before test]

### Test Data
```json
{
  "input": { ... },
  "expected": { ... }
}
```

### Steps
1. [Action step]
2. [Action step]
3. [Action step]

### Expected Results
- [Observable outcome 1]
- [Observable outcome 2]

### Post-conditions
- [System state after test]

### Notes
- [Special considerations]
```

### 3. Test Suite Structure

```markdown
## Test Suite: [Module Name]

```[language]
describe('[Feature]', () => {
  describe('Happy Path', () => {
    it('should [expected behavior]', () => {
      // Arrange
      
      // Act
      
      // Assert
    });
  });
  
  describe('Error Cases', () => {
    it('should [error behavior]', () => {
      // Test implementation
    });
  });
  
  describe('Edge Cases', () => {
    it('should [edge behavior]', () => {
      // Test implementation
    });
  });
});
```
```

## Test Categories

### Unit Tests
Focus: Individual functions/components in isolation
- Business logic functions
- Utility functions
- Component rendering (UI)
- State management

### Integration Tests
Focus: Component interactions
- API endpoint behavior
- Database operations
- Service-to-service calls
- Module integration

### E2E Tests
Focus: Complete user flows
- Critical user journeys
- Cross-page navigation
- Third-party integration
- End-to-end workflows

## Test Case Patterns

### Positive Test Template
```
Given: [Valid preconditions]
When: [Valid action]
Then: [Expected successful outcome]
```

### Negative Test Template
```
Given: [Preconditions]
When: [Invalid action / Error condition]
Then: [Expected error handling]
```

### Boundary Test Template
```
Given: [At boundary condition]
When: [Action at boundary]
Then: [Correct boundary behavior]
```

### State Transition Template
```
Given: [Initial state]
When: [Trigger event]
Then: [Target state achieved]
And: [Side effects occurred]
```

## Workflow

### Step 1: Requirement Analysis
For each functional requirement:
1. Identify testable behaviors
2. Determine test level (unit/integration/E2E)
3. Note dependencies and setup needs

### Step 2: Test Case Identification
Generate cases for:
- **Happy Path**: Normal, expected usage
- **Alternative Paths**: Valid variations
- **Error Cases**: Invalid inputs, failures
- **Edge Cases**: Boundaries, extremes
- **State Cases**: Different starting states

### Step 3: Test Data Design
Define:
- Input values (valid and invalid)
- Expected outputs
- Mock dependencies
- Database states
- Environment conditions

### Step 4: Test Structure
Organize as:
```
[Feature]
├── [Sub-feature/Component]
│   ├── Happy Path
│   │   ├── [Test case 1]
│   │   └── [Test case 2]
│   ├── Error Cases
│   │   ├── [Test case 1]
│   │   └── [Test case 2]
│   └── Edge Cases
│       └── [Test case 1]
```

### Step 5: Priority Assignment
- **P0**: Critical functionality, must pass
- **P1**: Important functionality
- **P2**: Nice-to-have coverage

## Test Data Guidelines

### Valid Inputs
- Typical values
- Minimum valid values
- Maximum valid values
- Valid format variations

### Invalid Inputs
- Null/undefined/empty
- Wrong types
- Malformed data
- Out-of-range values
- Special characters
- Injection attempts

### Boundary Values
- Exact minimum
- Exact maximum
- Just below minimum
- Just above maximum

## Coverage Targets

| Level | Target | Focus |
|-------|--------|-------|
| Unit | 80%+ | Business logic, utilities |
| Integration | 70%+ | APIs, DB, services |
| E2E | Critical paths | User journeys |

## Common Testing Scenarios

### API Testing
- Valid request/response
- Invalid request formats
- Authentication failures
- Rate limiting
- Error responses
- Timeout handling

### UI Component Testing
- Rendering with props
- User interactions
- State changes
- Accessibility attributes
- Responsive behavior
- Error states

### Database Testing
- CRUD operations
- Constraint validation
- Transaction handling
- Migration correctness
- Query performance

### Integration Testing
- Service communication
- Event handling
- Circuit breaker behavior
- Retry logic
- Timeout handling

## Test Naming Conventions

```
[Unit] should [expected behavior] when [condition]
[Integration] should [outcome] when [action] with [dependency]
[E2E] User should [accomplish goal] via [flow]
```

Examples:
- `should return user when valid ID provided`
- `should throw error when database unavailable`
- `User should complete checkout via payment flow`

## Validation Checklist

- [ ] All P0 requirements have test cases
- [ ] Happy paths covered
- [ ] Error cases identified
- [ ] Edge cases documented
- [ ] Test data defined
- [ ] Preconditions specified
- [ ] Expected results measurable
- [ ] Test independence maintained
- [ ] Flaky test factors minimized

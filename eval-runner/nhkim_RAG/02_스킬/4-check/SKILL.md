---
name: 4-check
description: Verify code quality and spec compliance. Triggers: 코드확인, 4단계, 코드검증, 코드리뷰, 품질체크. Use for reviewing code, checking bugs, security audit, and validation.
---

# Code Verification

Systematically verify that code meets quality standards and specification requirements.

## When to Apply

- Code review before merge/PR
- Validating implementation against spec
- Checking for security vulnerabilities
- Verifying performance requirements
- Ensuring test coverage adequacy
- Validating architectural compliance

## Verification Types

### 1. Spec Compliance Check
Verify code implements requirements correctly.

### 2. Code Quality Review
Check readability, maintainability, and best practices.

### 3. Security Audit
Identify potential vulnerabilities.

### 4. Performance Review
Validate efficiency and resource usage.

### 5. Test Validation
Verify test coverage and quality.

## Output Format

**Always start output with:** `[코드확인 스킬]` or `[4-check]`

```markdown
# Code Verification Report: [Feature/Component]

## Summary
- **Files Reviewed**: [N]
- **Overall Status**: ✅ PASS / ⚠️ CONDITIONAL / ❌ FAIL
- **Critical Issues**: [N]
- **Warnings**: [N]
- **Suggestions**: [N]

## Spec Compliance Matrix

| Req ID | Requirement | Status | Location | Notes |
|--------|-------------|--------|----------|-------|
| FR-01 | User can login | ✅ | `auth.ts:45` | Correctly implemented |
| FR-02 | Password validation | ⚠️ | `auth.ts:67` | Missing special char check |

## Issues Found

### Critical (Must Fix)

#### [ISSUE-001] [Title]
- **Severity**: Critical
- **File**: `path/to/file.ts:42`
- **Issue**: [Description]
- **Impact**: [What could go wrong]
- **Recommendation**: [How to fix]

### Warnings (Should Fix)

#### [ISSUE-XX] [Title]
- **Severity**: Warning
- **File**: `path/to/file.ts`
- **Issue**: [Description]
- **Recommendation**: [Suggested improvement]

### Suggestions (Nice to Have)

#### [SUG-XX] [Title]
- **File**: `path/to/file.ts`
- **Suggestion**: [Description]
- **Rationale**: [Why this helps]

## Quality Metrics

| Metric | Score | Target | Notes |
|--------|-------|--------|-------|
| Test Coverage | 85% | >80% | ✅ Meets target |
| Cyclomatic Complexity | 12 | <10 | ⚠️ Slightly high in `processOrder` |
| Duplication | 2% | <5% | ✅ Good |

## Security Checklist
- [ ] Input validation implemented
- [ ] SQL injection prevented
- [ ] XSS vulnerabilities checked
- [ ] Authentication/authorization correct
- [ ] Secrets not hardcoded
- [ ] Dependencies audited

## Performance Notes
- [Identified bottlenecks]
- [Resource usage observations]
- [Optimization suggestions]
```

## Verification Checklist

### Functional Correctness
- [ ] All P0 requirements implemented
- [ ] Business logic matches spec
- [ ] Edge cases handled
- [ ] Error scenarios covered
- [ ] State management correct
- [ ] Data flow is sound

### Code Quality
- [ ] Naming is clear and consistent
- [ ] Functions are focused (SRP)
- [ ] No code duplication
- [ ] Comments explain "why", not "what"
- [ ] Complexity is appropriate
- [ ] File organization is logical

### Security
- [ ] All inputs validated/sanitized
- [ ] No injection vulnerabilities
- [ ] Proper access controls
- [ ] Secrets externalized
- [ ] CORS configured correctly
- [ ] Dependencies up to date

### Performance
- [ ] No N+1 queries
- [ ] Efficient data structures
- [ ] Unnecessary re-renders avoided
- [ ] Bundle size acceptable
- [ ] Memory leaks checked

### Testing
- [ ] Unit tests for business logic
- [ ] Integration tests for flows
- [ ] Edge cases tested
- [ ] Error paths tested
- [ ] Coverage meets threshold

## Review Workflow

### Step 1: Preparation
1. Read the specification being implemented
2. Identify the code scope to review
3. Note any specific concerns or focus areas

### Step 2: Static Analysis
1. Check file structure and organization
2. Review interfaces and types
3. Identify dependencies
4. Look for obvious issues (syntax, imports, etc.)

### Step 3: Logic Verification
1. Trace through critical paths
2. Verify algorithm correctness
3. Check state transitions
4. Validate error handling

### Step 4: Spec Compliance
For each requirement:
1. Locate implementation
2. Verify behavior matches spec
3. Note deviations or gaps

### Step 5: Issue Triage
Classify findings:
- **Critical**: Security risk, data loss, crash, or wrong behavior
- **Warning**: Maintainability issue, potential bug, performance concern
- **Suggestion**: Improvement opportunity, not blocking

### Step 6: Report Generation
Compile findings into the output format with:
- Clear issue descriptions
- File locations
- Recommended fixes
- Severity levels

## Common Issues

### Logic Errors
- Off-by-one errors in loops
- Incorrect boolean logic (&& vs ||)
- Null/undefined not handled
- Race conditions
- State mutation bugs

### Security Issues
- Unvalidated user input
- SQL injection via string concatenation
- XSS via unescaped output
- Insecure direct object references
- Missing authentication checks

### Performance Issues
- Nested loops over large datasets
- Synchronous I/O in async contexts
- Memory leaks from subscriptions
- Unnecessary re-renders
- Loading entire datasets into memory

### Maintainability Issues
- Magic numbers/strings
- Functions with many parameters
- Deep nesting
- Large files/classes
- Tight coupling

## Review Principles

1. **Be Constructive**: Focus on the code, not the author
2. **Explain Why**: Provide rationale for suggestions
3. **Prioritize**: Distinguish critical from nice-to-have
4. **Be Specific**: Give exact file locations and line numbers
5. **Suggest Fixes**: Don't just point out problems

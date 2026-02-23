import { describe, it, expect } from 'vitest';

describe('Sample Test Suite', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should verify test infrastructure is working', () => {
    const testObject = { name: 'Test', value: 123 };
    expect(testObject).toHaveProperty('name');
    expect(testObject.value).toBe(123);
  });
});

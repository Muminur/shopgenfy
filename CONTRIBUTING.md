# Contributing Guide

Thank you for considering contributing to the Shopify App Store Submission Assistant! This document provides guidelines and instructions for contributing.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [TDD Requirements](#tdd-requirements)
5. [Code Style](#code-style)
6. [Commit Guidelines](#commit-guidelines)
7. [Pull Request Process](#pull-request-process)
8. [Testing](#testing)
9. [Documentation](#documentation)

---

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

---

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Git
- MongoDB (local or Atlas for development)

### Setup

```bash
# Fork the repository on GitHub

# Clone your fork
git clone https://github.com/YOUR-USERNAME/shopgenfy.git
cd shopgenfy

# Add upstream remote
git remote add upstream https://github.com/Muminur/shopgenfy.git

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Setup

1. Copy `.env.example` to `.env.local`
2. Get a Gemini API key from https://makersuite.google.com/app/apikey
3. Set up local MongoDB or use MongoDB Atlas
4. Configure all required environment variables

---

## Development Workflow

### Branch Strategy

We follow a feature branch workflow:

```
main
└── milestone<N>/<task-name>
    Example: milestone5/add-form-components
```

### Creating a Feature Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b milestone<N>/<task-name>
```

### Development Cycle

1. **Read TASKS.md** - Identify the task you're working on
2. **Write Tests First** - TDD is mandatory (see below)
3. **Implement Minimum Code** - Only what's needed to pass tests
4. **Run All Tests** - Ensure nothing is broken
5. **Run Linting** - Fix any issues
6. **Commit** - Using conventional commit format
7. **Push** - To your fork
8. **Open PR** - Against main branch

---

## TDD Requirements

**Test-Driven Development is mandatory for all contributions.**

### TDD Workflow

1. **Write failing tests first**
   ```bash
   # Run tests to verify they fail
   npm run test -- path/to/your/test.ts
   ```

2. **Implement minimum code to pass**
   ```bash
   # Run tests to verify they pass
   npm run test -- path/to/your/test.ts
   ```

3. **Refactor if needed**
   ```bash
   # Run all tests to ensure nothing broke
   npm run test
   ```

### Test Types

| Type | Location | Purpose |
|------|----------|---------|
| Unit | `__tests__/unit/` | Test individual functions/components |
| Integration | `__tests__/integration/` | Test API routes and database |
| E2E | `__tests__/e2e/` | Test full user workflows (Playwright) |

### Test File Naming

```
__tests__/
├── unit/
│   ├── lib/
│   │   └── my-utility.test.ts
│   └── components/
│       └── my-component.test.tsx
├── integration/
│   └── api/
│       └── my-route.test.ts
└── e2e/
    └── my-flow.spec.ts
```

### Writing Good Tests

```typescript
// Good test example
describe('MyFunction', () => {
  it('should return expected result for valid input', () => {
    const result = myFunction('valid input');
    expect(result).toBe('expected output');
  });

  it('should throw error for invalid input', () => {
    expect(() => myFunction('')).toThrow('Invalid input');
  });

  it('should handle edge cases', () => {
    expect(myFunction(null)).toBeNull();
  });
});
```

---

## Code Style

### TypeScript

- Use TypeScript for all code
- Avoid `any` type - use proper types or `unknown`
- Export types from `src/types/index.ts`

### Formatting

We use Prettier for formatting:

```bash
# Check formatting
npm run format:check

# Fix formatting
npm run format
```

### Linting

We use ESLint:

```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### Import Order

```typescript
// 1. React/Next.js
import React from 'react';
import { NextResponse } from 'next/server';

// 2. External libraries
import { z } from 'zod';

// 3. Internal modules (absolute imports)
import { MyComponent } from '@/components/MyComponent';
import { myUtil } from '@/lib/utils';

// 4. Types
import type { MyType } from '@/types';

// 5. Styles (if any)
import './styles.css';
```

### Component Structure

```typescript
// MyComponent.tsx
import React from 'react';
import type { MyComponentProps } from './types';

export function MyComponent({ prop1, prop2 }: MyComponentProps) {
  // Hooks first
  const [state, setState] = React.useState(null);

  // Event handlers
  const handleClick = () => {
    // ...
  };

  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

---

## Commit Guidelines

### Conventional Commits

We use conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, etc.) |
| `refactor` | Code refactoring |
| `test` | Adding/updating tests |
| `chore` | Maintenance tasks |

### Examples

```bash
feat(api): add rate limiting to gemini endpoints

fix(dashboard): resolve form validation error on submit

test(validators): add unit tests for submission schema

chore(deps): update next.js to 14.2.0
```

### Forbidden in Commits

**NEVER include these in commits:**
- References to AI assistance (Claude, GPT, etc.)
- "AI-generated" or "AI-assisted"
- Secrets or API keys

---

## Pull Request Process

### Before Opening PR

1. **Run all checks locally:**
   ```bash
   npm run lint
   npm run type-check
   npm run test
   npm run build
   ```

2. **Ensure tests pass:**
   ```bash
   npm run test -- --run
   ```

3. **Update documentation if needed**

### PR Title Format

Same as commit format:
```
feat(api): add new endpoint for image regeneration
```

### PR Description Template

```markdown
## Summary
- Brief description of changes

## Changes
- List of specific changes made

## Test Plan
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Screenshots (if UI changes)
[Add screenshots here]

## Checklist
- [ ] Tests pass locally
- [ ] Linting passes
- [ ] TypeScript compiles
- [ ] Documentation updated
```

### Review Process

1. Automated CI checks must pass
2. Code review by maintainers
3. Address feedback
4. Merge when approved

---

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run with watch mode
npm run test -- --watch

# Run specific file
npm run test -- path/to/test.ts

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

### Writing Tests

#### Unit Tests (Vitest)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { myFunction } from '@/lib/my-module';

describe('myFunction', () => {
  it('should work correctly', () => {
    expect(myFunction('input')).toBe('output');
  });
});
```

#### Integration Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external dependencies
vi.mock('@/lib/mongodb', () => ({
  getDatabase: vi.fn(),
}));

describe('API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return data', async () => {
    // Test implementation
  });
});
```

#### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('user can submit form', async ({ page }) => {
  await page.goto('/dashboard');
  await page.fill('[name="appName"]', 'Test App');
  await page.click('button[type="submit"]');
  await expect(page.locator('.success-message')).toBeVisible();
});
```

---

## Documentation

### Code Comments

- Use JSDoc for public functions
- Comment complex logic
- Don't over-comment obvious code

```typescript
/**
 * Validates a Shopify submission against store requirements.
 * @param submission - The submission data to validate
 * @returns Validation result with errors if any
 */
export function validateSubmission(submission: Submission): ValidationResult {
  // Implementation
}
```

### README Updates

When adding new features:
1. Update feature list if applicable
2. Update API documentation
3. Update environment variables if new ones added

---

## Questions?

- Open an issue for questions
- Check existing issues and PRs
- Review TASKS.md for current priorities

Thank you for contributing!

# Backend Tests

This folder is split by test intent:

- `unit/`: fast tests for controller/service behavior in isolation.
- `integration/`: HTTP route tests (Nest app + supertest + mocked services/guards).

## Commands

From `apps/backend`:

- `npm run test:unit`
- `npm run test:integration`

These are designed to be easy to plug into CI/CD pipelines later.

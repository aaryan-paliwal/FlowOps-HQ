# Contributing to FlowOps HQ

Thank you for your interest in contributing to **FlowOps HQ — The AI Control Plane**! We welcome contributions of all kinds: bug fixes, new features, documentation improvements, and more.

---

## 🚀 Getting Started

### 1. Fork & Clone

```bash
git fork https://github.com/aaryan-paliwal/FlowOps-HQ
git clone https://github.com/<your-username>/FlowOps-HQ.git
cd FlowOps-HQ
```

### 2. Install Dependencies

```bash
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd worker && npm install && cd ..
```

### 3. Set Up Environment

```bash
cp .env.example .env
cp .env.example backend/.env
```

Fill in the required values (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`).

### 4. Run the Database

```bash
cd backend
npx prisma migrate dev
cd ..
```

### 5. Start Development

```bash
npm run dev:local
```

---

## 📋 Development Guidelines

### Code Style

- Use **ES6+** syntax (CommonJS `require` in backend, ESM `import` in frontend)
- Follow existing code patterns and naming conventions
- Use meaningful variable and function names
- Add JSDoc comments for exported functions

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add semantic caching middleware
fix: resolve rate limiter token count overflow
docs: update API documentation
refactor: extract provider logic into separate modules
test: add unit tests for universalRouter
```

### Branch Naming

```
feature/prompt-optimizer
fix/rate-limiter-bug
docs/api-reference
```

---

## 🔀 Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** with clear, focused commits
3. **Test your changes** locally with `npm test`
4. **Update documentation** if you've changed any APIs or added features
5. **Submit a PR** with a clear description of what changed and why

### PR Template

```markdown
## What does this PR do?
Brief description of the changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactor
- [ ] Performance improvement

## Testing
Describe how you tested these changes.

## Screenshots (if applicable)
Add screenshots for UI changes.
```

---

## 🏗️ Architecture Overview

Before contributing, familiarize yourself with the architecture:

- **Gateway Engine** (`backend/src/gateway/`) — The core proxy that routes LLM traffic
- **Core Modules** (`backend/src/gateway/core/`) — Universal router, token counter, observability, alerts
- **REST API** (`backend/src/modules/`) — User, API, analytics modules
- **Frontend** (`frontend/src/`) — React + Vite dashboard
- **Worker** (`worker/`) — BullMQ background job processor

---

## 🐛 Reporting Bugs

Open an issue with:

- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node.js version, Docker version)
- Relevant logs or screenshots

---

## 💡 Feature Requests

We love new ideas! Open an issue with the `enhancement` label and include:

- Problem statement
- Proposed solution
- Alternative approaches considered

---

## 📜 Code of Conduct

Be respectful, inclusive, and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/) code of conduct.

---

## 📄 License

By contributing to FlowOps HQ, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

<div align="center">

**Thank you for helping make FlowOps HQ better! ⚡**

</div>

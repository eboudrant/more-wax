# Contributing to More'Wax

Thanks for your interest in contributing! This guide will help you get started.

## Dev Environment Setup

1. Fork and clone the repo:
   ```bash
   git clone https://github.com/<your-username>/more-wax.git
   cd more-wax
   ```

2. Copy the environment config and adjust as needed:
   ```bash
   cp .env.example .env
   ```

3. Start the backend server:
   ```bash
   python3 server.py
   ```
   The server runs at `http://localhost:8765`.

## Running Tests

**Backend tests:**
```bash
python3 -m pytest tests/
```

**Screenshot tests:**
```bash
npx playwright test
```

## Linting

We use [ruff](https://docs.astral.sh/ruff/) for Python linting and formatting:

```bash
ruff check server/ tests/ server.py
ruff format
```

## Code Style

- **Python** follows ruff defaults. Run `ruff format` before committing.
- **JavaScript** is vanilla with no framework and no build step. Keep it simple.

## Pull Request Process

1. Fork the repository.
2. Create a feature branch from `main`.
3. Make your changes and commit with a clear message.
4. Push to your fork and open a pull request against `main`.

CI checks will run automatically on your PR, including linting and tests. Please make sure they pass before requesting review.

## Questions?

Open an issue if something is unclear. We are happy to help.

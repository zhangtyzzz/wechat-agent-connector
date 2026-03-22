# Contributing

## Development

Requirements:

- Node.js 22+
- npm

Install and validate:

```bash
npm install
npm run typecheck
npm run build
npm test
```

## Project Rules

- keep `packages/weixin-core` free of OpenClaw runtime dependencies
- preserve the generic shell adapter contract
- update both READMEs when user-facing behavior changes
- keep the Skill concise and operational

## Pull Requests

Include:

- the problem statement
- the behavior change
- config or migration impact
- validation steps


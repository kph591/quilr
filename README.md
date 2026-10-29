# MCP & LLM Gateway Assessment

Complete implementation of 4 assessment tasks covering MCP servers, security gateways, streaming guardrails, and rate limiting.

## Setup

Install dependencies:
```bash
npm install
```

Verify installation:
```bash
node verify.js
```

## Task 1: MCP Server with Validation

Custom MCP server with strict Zod validation and stdio transport.

**Run server:**
```bash
npm run task1
```

**Test:**
```bash
cd task1-mcp-server
node test-client.js
```

## Task 2: MCP Security Gateway

HTTP proxy with role-based tool filtering and authorization.

**Run gateway:**
```bash
npm run task2
```

**Test (in new terminal):**
```bash
cd task2-mcp-gateway
node test-gateway.js
```

## Task 3: LLM Streaming Guardrail

Real-time PII redaction in streaming responses.

**Run gateway:**
```bash
npm run task3
```

**Test (in new terminal):**
```bash
cd task3-llm-streaming
node test-streaming.js
```

## Task 4: Rate Limiter & Fallback Router

Token-based rate limiting with automatic model fallback.

**Run router:**
```bash
npm run task4
```

**Test (in new terminal):**
```bash
cd task4-rate-limiter
node test-router.js
```

## Features

- **Task 1**: Zod schemas, JSON-RPC error codes, pure stdio transport
- **Task 2**: Bearer token auth, method-level filtering, proxy forwarding
- **Task 3**: Stream-based PII detection (email, SSN, credit card)
- **Task 4**: SQLite-backed rate limiter, 3s timeout, fallback routing

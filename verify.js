import { existsSync } from "fs";
import { readFile } from "fs/promises";

const requiredFiles = [
  "package.json",
  "task1-mcp-server/server.js",
  "task1-mcp-server/test-client.js",
  "task2-mcp-gateway/gateway.js",
  "task2-mcp-gateway/test-gateway.js",
  "task3-llm-streaming/gateway.js",
  "task3-llm-streaming/test-streaming.js",
  "task4-rate-limiter/router.js",
  "task4-rate-limiter/test-router.js",
  "README.md"
];

const checks = [
  {
    name: "Task 1: MCP Server Validation",
    file: "task1-mcp-server/server.js",
    patterns: [
      /import.*zod/i,
      /StdioServerTransport/,
      /customerRecordSchema/,
      /triggerRefundSchema/,
      /console\.error/
    ]
  },
  {
    name: "Task 2: MCP Gateway Auth",
    file: "task2-mcp-gateway/gateway.js",
    patterns: [
      /Bearer/,
      /admin_/,
      /role.*admin/,
      /-32001/,
      /sendToDownstream/
    ]
  },
  {
    name: "Task 3: LLM Streaming PII Redaction",
    file: "task3-llm-streaming/gateway.js",
    patterns: [
      /\[REDACTED\]/,
      /email|ssn|credit_card/i,
      /StreamBuffer/,
      /text\/event-stream/,
      /asyncIterator/
    ]
  },
  {
    name: "Task 4: Rate Limiter & Fallback",
    file: "task4-rate-limiter/router.js",
    patterns: [
      /better-sqlite3/,
      /rate_limits/,
      /50000/,
      /PRIMARY_TIMEOUT/,
      /callFallbackModel/
    ]
  }
];

console.log("=== File Structure Verification ===\n");

let allFilesExist = true;
for (const file of requiredFiles) {
  const exists = existsSync(file);
  console.log(`${exists ? "✓" : "✗"} ${file}`);
  if (!exists) allFilesExist = false;
}

console.log("\n=== Implementation Verification ===\n");

let allChecksPass = true;
for (const check of checks) {
  console.log(`Checking: ${check.name}`);
  try {
    const content = await readFile(check.file, "utf-8");
    let passed = true;
    
    for (const pattern of check.patterns) {
      if (!pattern.test(content)) {
        console.log(`  ✗ Missing: ${pattern}`);
        passed = false;
        allChecksPass = false;
      }
    }
    
    if (passed) {
      console.log(`  ✓ All patterns found`);
    }
  } catch (error) {
    console.log(`  ✗ Error reading file: ${error.message}`);
    allChecksPass = false;
  }
  console.log();
}

console.log("=== Summary ===");
console.log(`Files: ${allFilesExist ? "✓ All present" : "✗ Missing files"}`);
console.log(`Implementation: ${allChecksPass ? "✓ All checks passed" : "✗ Some checks failed"}`);

if (allFilesExist && allChecksPass) {
  console.log("\n✓ Project is ready! Run 'npm install' to install dependencies.");
  process.exit(0);
} else {
  console.log("\n✗ Verification failed");
  process.exit(1);
}

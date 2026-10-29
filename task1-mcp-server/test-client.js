import { spawn } from "child_process";
import { createInterface } from "readline";

const server = spawn("node", ["server.js"], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "inherit"]
});

let messageId = 1;

function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: "2.0",
    id: messageId++,
    method,
    params
  };
  server.stdin.write(JSON.stringify(request) + "\n");
}

const rl = createInterface({
  input: server.stdout,
  crlfDelay: Infinity
});

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    console.log("Response:", JSON.stringify(response, null, 2));
  } catch (e) {
    console.log("Raw:", line);
  }
});

setTimeout(() => {
  console.log("\n=== Test 1: List Tools ===");
  sendRequest("tools/list");
}, 500);

setTimeout(() => {
  console.log("\n=== Test 2: Valid Get Customer Record ===");
  sendRequest("tools/call", {
    name: "get_customer_record",
    arguments: { customer_id: "CUST-12345" }
  });
}, 1000);

setTimeout(() => {
  console.log("\n=== Test 3: Invalid Customer ID Format ===");
  sendRequest("tools/call", {
    name: "get_customer_record",
    arguments: { customer_id: "INVALID" }
  });
}, 1500);

setTimeout(() => {
  console.log("\n=== Test 4: Valid Trigger Refund ===");
  sendRequest("tools/call", {
    name: "trigger_refund",
    arguments: {
      customer_id: "CUST-12345",
      amount: 50.00,
      reason: "Product was defective"
    }
  });
}, 2000);

setTimeout(() => {
  console.log("\n=== Test 5: Invalid Refund (short reason) ===");
  sendRequest("tools/call", {
    name: "trigger_refund",
    arguments: {
      customer_id: "CUST-12345",
      amount: 50.00,
      reason: "Bad"
    }
  });
}, 2500);

setTimeout(() => {
  console.log("\n=== Test 6: Invalid Refund (negative amount) ===");
  sendRequest("tools/call", {
    name: "trigger_refund",
    arguments: {
      customer_id: "CUST-12345",
      amount: -10.00,
      reason: "Testing negative"
    }
  });
}, 3000);

setTimeout(() => {
  server.kill();
  process.exit(0);
}, 3500);

async function testGateway(token, testName, method, params) {
  console.log(`\n=== ${testName} ===`);
  
  const response = await fetch("http://localhost:3001", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    })
  });

  const result = await response.json();
  console.log(`Status: ${response.status}`);
  console.log("Response:", JSON.stringify(result, null, 2));
}

async function runTests() {
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testGateway(
    "admin-token-123",
    "Admin: List Tools",
    "tools/list",
    {}
  );

  await testGateway(
    "viewer-token-456",
    "Viewer: List Tools",
    "tools/list",
    {}
  );

  await testGateway(
    "admin-token-123",
    "Admin: Call Regular Tool",
    "tools/call",
    { name: "get_customer_record", arguments: { customer_id: "CUST-12345" } }
  );

  await testGateway(
    "viewer-token-456",
    "Viewer: Call Regular Tool",
    "tools/call",
    { name: "get_customer_record", arguments: { customer_id: "CUST-12345" } }
  );

  await testGateway(
    "admin-token-123",
    "Admin: Call Admin Tool (Allowed)",
    "tools/call",
    { name: "admin_reset_key", arguments: { key_id: "key-123" } }
  );

  await testGateway(
    "viewer-token-456",
    "Viewer: Call Admin Tool (Blocked)",
    "tools/call",
    { name: "admin_reset_key", arguments: { key_id: "key-123" } }
  );

  await testGateway(
    "invalid-token",
    "Invalid Token",
    "tools/list",
    {}
  );

  console.log("\n=== All tests completed ===");
  process.exit(0);
}

runTests().catch(console.error);

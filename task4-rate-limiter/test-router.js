async function testRouter(apiKey, testName, messages) {
  console.log(`\n=== ${testName} ===`);

  try {
    const response = await fetch("http://localhost:3003/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages
      })
    });

    const result = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Rate Limit: ${response.headers.get("X-RateLimit-Remaining")}/${response.headers.get("X-RateLimit-Limit")}`);
    
    if (result.error) {
      console.log("Error:", result.error.message);
    } else {
      console.log("Model:", result.model);
      console.log("Fallback used:", result.fallback || false);
      console.log("Response:", result.choices[0].message.content.substring(0, 50) + "...");
    }
  } catch (error) {
    console.log("Request failed:", error.message);
  }
}

async function runTests() {
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testRouter(
    "test-key-1",
    "Test 1: Normal Request",
    [{ role: "user", content: "Hello" }]
  );

  await testRouter(
    "test-key-1",
    "Test 2: Another Request (Same Key)",
    [{ role: "user", content: "How are you?" }]
  );

  await testRouter(
    "test-key-2",
    "Test 3: Different Key",
    [{ role: "user", content: "Tell me a joke" }]
  );

  console.log("\n=== Testing Rate Limit (Sending Multiple Requests) ===");
  for (let i = 0; i < 5; i++) {
    await testRouter(
      "test-key-3",
      `Bulk Request ${i + 1}`,
      [{ role: "user", content: "A".repeat(10000) }]
    );
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  await testRouter(
    "test-key-1",
    "Test 4: Primary/Fallback (Random)",
    [{ role: "user", content: "This might trigger fallback" }]
  );

  console.log("\n=== All tests completed ===");
  process.exit(0);
}

runTests().catch(console.error);

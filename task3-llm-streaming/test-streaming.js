async function testStreaming() {
  console.log("=== Testing LLM Streaming Gateway with PII Redaction ===\n");

  const response = await fetch("http://localhost:3002/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "mock-model",
      messages: [
        { role: "user", content: "Tell me about yourself" }
      ],
      stream: true
    })
  });

  console.log("Streaming response (PII should be redacted):\n");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.substring(6);
        if (data === "[DONE]") {
          console.log("\n[Stream completed]");
          continue;
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            process.stdout.write(content);
          }
        } catch (e) {
        }
      }
    }
  }

  console.log("\n\n=== Test completed ===");
  console.log("Expected redactions: emails, SSN, credit card numbers");
  process.exit(0);
}

testStreaming().catch(console.error);

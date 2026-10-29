import http from "http";

const PII_PATTERNS = [
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: "email" },
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, type: "ssn" },
  { regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, type: "credit_card" }
];

class StreamBuffer {
  constructor() {
    this.buffer = "";
    this.windowSize = 100;
  }

  addChunk(chunk) {
    this.buffer += chunk;
    if (this.buffer.length > this.windowSize * 2) {
      this.buffer = this.buffer.slice(-this.windowSize);
    }
  }

  redactPII(newChunk) {
    const tempBuffer = this.buffer + newChunk;
    let redactedChunk = newChunk;

    for (const { regex } of PII_PATTERNS) {
      const matches = [...tempBuffer.matchAll(regex)];
      
      for (const match of matches) {
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;
        const chunkStart = this.buffer.length;
        const chunkEnd = tempBuffer.length;

        if (matchEnd > chunkStart && matchStart < chunkEnd) {
          const overlapStart = Math.max(0, matchStart - chunkStart);
          const overlapEnd = Math.min(newChunk.length, matchEnd - chunkStart);
          
          if (overlapStart < overlapEnd) {
            const before = redactedChunk.substring(0, overlapStart);
            const after = redactedChunk.substring(overlapEnd);
            const replacement = "[REDACTED]";
            redactedChunk = before + replacement + after;
          }
        }
      }
    }

    this.addChunk(newChunk);
    return redactedChunk;
  }
}

function createMockLLMStream(prompt) {
  const responses = [
    "Hello! I can help you with that. ",
    "My email is john.doe@example.com and ",
    "you can reach me at jane@test.org. ",
    "For verification, my SSN is 123-45-6789. ",
    "You can charge my card 4532-1234-5678-9010. ",
    "Let me know if you need anything else!"
  ];

  let index = 0;
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of responses) {
        await new Promise(resolve => setTimeout(resolve, 100));
        yield chunk;
        index++;
      }
    }
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", async () => {
    try {
      const request = JSON.parse(body);
      const { messages, stream = false } = request;

      if (!stream) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          id: "chatcmpl-" + Date.now(),
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: "mock-model",
          choices: [{
            index: 0,
            message: {
              role: "assistant",
              content: "Non-streaming response without PII redaction"
            },
            finish_reason: "stop"
          }]
        }));
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });

      const prompt = messages[messages.length - 1]?.content || "";
      const mockStream = createMockLLMStream(prompt);
      const buffer = new StreamBuffer();

      for await (const chunk of mockStream) {
        const redactedChunk = buffer.redactPII(chunk);

        const sseData = {
          id: "chatcmpl-" + Date.now(),
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: "mock-model",
          choices: [{
            index: 0,
            delta: { content: redactedChunk },
            finish_reason: null
          }]
        };

        res.write(`data: ${JSON.stringify(sseData)}\n\n`);
      }

      const finalData = {
        id: "chatcmpl-" + Date.now(),
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "mock-model",
        choices: [{
          index: 0,
          delta: {},
          finish_reason: "stop"
        }]
      };

      res.write(`data: ${JSON.stringify(finalData)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();

    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bad request" }));
    }
  });
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`LLM Streaming Gateway running on http://localhost:${PORT}`);
  console.log("Test with: node test-streaming.js");
});

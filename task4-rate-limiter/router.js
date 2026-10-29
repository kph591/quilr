import http from "http";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = "./task4-rate-limiter/rate_limiter.db";
if (!existsSync(dirname(dbPath))) {
  mkdirSync(dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS rate_limits (
    api_key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    tokens_used INTEGER NOT NULL DEFAULT 0
  )
`);

const RATE_LIMIT_TOKENS = 50000;
const WINDOW_MS = 60000;
const PRIMARY_TIMEOUT_MS = 3000;

class RateLimiter {
  checkAndUpdate(apiKey, tokensNeeded) {
    const now = Date.now();
    const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;

    const stmt = db.prepare(`
      INSERT INTO rate_limits (api_key, window_start, tokens_used)
      VALUES (?, ?, ?)
      ON CONFLICT(api_key) DO UPDATE SET
        window_start = CASE
          WHEN window_start < ? THEN ?
          ELSE window_start
        END,
        tokens_used = CASE
          WHEN window_start < ? THEN ?
          ELSE tokens_used + ?
        END
    `);

    stmt.run(apiKey, windowStart, tokensNeeded, windowStart, windowStart, windowStart, tokensNeeded, tokensNeeded);

    const row = db.prepare("SELECT tokens_used, window_start FROM rate_limits WHERE api_key = ?").get(apiKey);

    if (row.window_start < windowStart) {
      db.prepare("UPDATE rate_limits SET window_start = ?, tokens_used = ? WHERE api_key = ?")
        .run(windowStart, tokensNeeded, apiKey);
      return { allowed: true, tokensUsed: tokensNeeded, limit: RATE_LIMIT_TOKENS };
    }

    if (row.tokens_used > RATE_LIMIT_TOKENS) {
      return { allowed: false, tokensUsed: row.tokens_used, limit: RATE_LIMIT_TOKENS };
    }

    return { allowed: true, tokensUsed: row.tokens_used, limit: RATE_LIMIT_TOKENS };
  }
}

const rateLimiter = new RateLimiter();

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

async function callPrimaryModel(messages) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("PRIMARY_TIMEOUT"));
    }, PRIMARY_TIMEOUT_MS);

    setTimeout(() => {
      clearTimeout(timeout);
      
      if (Math.random() < 0.3) {
        reject(new Error("PRIMARY_429"));
        return;
      }

      const response = "This is a response from the primary model.";
      resolve({
        id: "chatcmpl-primary-" + Date.now(),
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "primary-model",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: response
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: estimateTokens(JSON.stringify(messages)),
          completion_tokens: estimateTokens(response),
          total_tokens: estimateTokens(JSON.stringify(messages) + response)
        }
      });
    }, Math.random() * 1000);
  });
}

async function callFallbackModel(messages) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const response = "This is a response from the fallback model.";
      resolve({
        id: "chatcmpl-fallback-" + Date.now(),
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "fallback-model",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: response
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: estimateTokens(JSON.stringify(messages)),
          completion_tokens: estimateTokens(response),
          total_tokens: estimateTokens(JSON.stringify(messages) + response)
        }
      });
    }, 200);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      error: {
        message: "Not found",
        type: "invalid_request_error"
      }
    }));
    return;
  }

  const apiKey = req.headers["x-api-key"];
  if (!apiKey) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: {
        message: "Missing API key",
        type: "authentication_error"
      }
    }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", async () => {
    try {
      const request = JSON.parse(body);
      const { messages } = request;

      if (!messages || !Array.isArray(messages)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: {
            message: "Invalid request: messages required",
            type: "invalid_request_error"
          }
        }));
        return;
      }

      const estimatedTokens = estimateTokens(JSON.stringify(messages)) + 100;

      const rateLimitCheck = rateLimiter.checkAndUpdate(apiKey, estimatedTokens);

      if (!rateLimitCheck.allowed) {
        res.writeHead(429, { 
          "Content-Type": "application/json",
          "X-RateLimit-Limit": RATE_LIMIT_TOKENS.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": Math.ceil((Date.now() + WINDOW_MS) / 1000).toString()
        });
        res.end(JSON.stringify({
          error: {
            message: "Rate limit exceeded",
            type: "rate_limit_error"
          }
        }));
        return;
      }

      let result;
      let usedFallback = false;

      try {
        result = await callPrimaryModel(messages);
      } catch (error) {
        console.error(`Primary model failed (${error.message}), using fallback`);
        usedFallback = true;
        result = await callFallbackModel(messages);
      }

      if (usedFallback) {
        result.fallback = true;
      }

      res.writeHead(200, { 
        "Content-Type": "application/json",
        "X-RateLimit-Limit": RATE_LIMIT_TOKENS.toString(),
        "X-RateLimit-Remaining": Math.max(0, RATE_LIMIT_TOKENS - rateLimitCheck.tokensUsed).toString()
      });
      res.end(JSON.stringify(result));

    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: {
          message: "Bad request",
          type: "invalid_request_error"
        }
      }));
    }
  });
});

const PORT = 3003;
server.listen(PORT, () => {
  console.log(`Rate-Limiting Router running on http://localhost:${PORT}`);
  console.log("Test with: node test-router.js");
});

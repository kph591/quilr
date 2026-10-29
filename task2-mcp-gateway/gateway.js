import http from "http";
import { spawn } from "child_process";
import { createInterface } from "readline";

const mockTokens = {
  "admin-token-123": { role: "admin" },
  "viewer-token-456": { role: "viewer" }
};

let downstreamServer = null;
let messageId = 1;
const pendingRequests = new Map();

function startDownstreamServer() {
  downstreamServer = spawn("node", ["../task1-mcp-server/server.js"], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "inherit"]
  });

  const rl = createInterface({
    input: downstreamServer.stdout,
    crlfDelay: Infinity
  });

  rl.on("line", (line) => {
    try {
      const response = JSON.parse(line);
      const callback = pendingRequests.get(response.id);
      if (callback) {
        pendingRequests.delete(response.id);
        callback(response);
      }
    } catch (e) {
      console.error("Failed to parse downstream response:", e);
    }
  });

  return new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
}

function sendToDownstream(method, params) {
  return new Promise((resolve, reject) => {
    const id = messageId++;
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    pendingRequests.set(id, resolve);
    downstreamServer.stdin.write(JSON.stringify(request) + "\n");

    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error("Downstream timeout"));
      }
    }, 5000);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32001,
        message: "Missing or invalid authorization header"
      }
    }));
    return;
  }

  const token = authHeader.substring(7);
  const userAuth = mockTokens[token];

  if (!userAuth) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32001,
        message: "Invalid token"
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
      const jsonRpcRequest = JSON.parse(body);
      const { method, params } = jsonRpcRequest;

      if (method === "tools/list") {
        const response = await sendToDownstream(method, params);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
        return;
      }

      if (method === "tools/call") {
        const toolName = params?.name;

        if (toolName && toolName.startsWith("admin_")) {
          if (userAuth.role !== "admin") {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              jsonrpc: "2.0",
              id: jsonRpcRequest.id,
              error: {
                code: -32001,
                message: "Unauthorized Tool Call"
              }
            }));
            return;
          }
        }

        const response = await sendToDownstream(method, params);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        id: jsonRpcRequest.id,
        error: {
          code: -32601,
          message: "Method not found"
        }
      }));
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error"
        }
      }));
    }
  });
});

async function main() {
  await startDownstreamServer();
  const PORT = 3001;
  server.listen(PORT, () => {
    console.log(`MCP Gateway running on http://localhost:${PORT}`);
    console.log("Test with: node test-gateway.js");
  });
}

main();

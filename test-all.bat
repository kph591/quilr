@echo off
echo ========================================
echo Testing Task 1: MCP Server
echo ========================================
cd task1-mcp-server
start /B node test-client.js
timeout /t 5 /nobreak > nul
cd ..

echo.
echo ========================================
echo Testing Task 2: MCP Gateway
echo ========================================
start /B node task2-mcp-gateway/gateway.js
timeout /t 2 /nobreak > nul
node task2-mcp-gateway/test-gateway.js
taskkill /F /IM node.exe > nul 2>&1

echo.
echo ========================================
echo Testing Task 3: LLM Streaming
echo ========================================
start /B node task3-llm-streaming/gateway.js
timeout /t 2 /nobreak > nul
node task3-llm-streaming/test-streaming.js
taskkill /F /IM node.exe > nul 2>&1

echo.
echo ========================================
echo Testing Task 4: Rate Limiter
echo ========================================
start /B node task4-rate-limiter/router.js
timeout /t 2 /nobreak > nul
node task4-rate-limiter/test-router.js
taskkill /F /IM node.exe > nul 2>&1

echo.
echo ========================================
echo All tests completed
echo ========================================

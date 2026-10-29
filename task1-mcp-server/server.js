import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const customerRecordSchema = z.object({
  customer_id: z.string().regex(/^CUST-\d{5}$/, "customer_id must match CUST-XXXXX format")
});

const triggerRefundSchema = z.object({
  customer_id: z.string().regex(/^CUST-\d{5}$/, "customer_id must match CUST-XXXXX format"),
  amount: z.number().positive("amount must be positive"),
  reason: z.string().min(10, "reason must be at least 10 characters")
});

const mockCustomerDb = {
  "CUST-12345": { name: "John Doe", email: "john@example.com", balance: 1500.00 },
  "CUST-67890": { name: "Jane Smith", email: "jane@example.com", balance: 2300.50 }
};

const server = new Server(
  {
    name: "customer-service-mcp",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      {
        name: "get_customer_record",
        description: "Retrieve customer record by customer ID",
        inputSchema: {
          type: "object",
          properties: {
            customer_id: {
              type: "string",
              description: "Customer ID in format CUST-XXXXX",
              pattern: "^CUST-\\d{5}$"
            }
          },
          required: ["customer_id"]
        }
      },
      {
        name: "trigger_refund",
        description: "Process a refund for a customer",
        inputSchema: {
          type: "object",
          properties: {
            customer_id: {
              type: "string",
              description: "Customer ID in format CUST-XXXXX",
              pattern: "^CUST-\\d{5}$"
            },
            amount: {
              type: "number",
              description: "Refund amount (must be positive)",
              minimum: 0,
              exclusiveMinimum: true
            },
            reason: {
              type: "string",
              description: "Reason for refund (minimum 10 characters)",
              minLength: 10
            }
          },
          required: ["customer_id", "amount", "reason"]
        }
      }
    ]
  };
});

server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_customer_record") {
      const validated = customerRecordSchema.parse(args);
      const customer = mockCustomerDb[validated.customer_id];
      
      if (!customer) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Customer not found" })
            }
          ],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(customer)
          }
        ]
      };
    }

    if (name === "trigger_refund") {
      const validated = triggerRefundSchema.parse(args);
      const customer = mockCustomerDb[validated.customer_id];

      if (!customer) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Customer not found" })
            }
          ],
          isError: true
        };
      }

      const refundId = `REF-${Date.now()}`;
      const result = {
        refund_id: refundId,
        customer_id: validated.customer_id,
        amount: validated.amount,
        reason: validated.reason,
        status: "processed",
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result)
          }
        ]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw {
        code: -32602,
        message: `Invalid params: ${message}`
      };
    }
    throw {
      code: -32603,
      message: error.message
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});

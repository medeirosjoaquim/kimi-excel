/**
 * Test script for Excel Export functionality
 * Run with: bun run test-excel-export.ts
 */

import { getExcelExportService } from "./src/services/excel-export.service.js";
import type { ChatMessage } from "@kimi-excel/shared";

async function testExcelExport() {
  console.log("Testing Excel Export Service...\n");

  const exportService = getExcelExportService();

  // Test 1: Export custom data
  console.log("Test 1: Export custom data");
  const customData = [
    ["Product", "Price", "Quantity"],
    ["Apple", 1.99, 50],
    ["Banana", 0.99, 100],
    ["Orange", 2.49, 75],
  ];

  try {
    const filePath = await exportService.exportCustomData(
      customData.slice(1), // Data rows
      customData[0] as string[], // Headers
      "test-products"
    );
    console.log("[PASS] Custom data exported successfully:", filePath);
    await exportService.cleanupTempFile(filePath);
  } catch (error) {
    console.error("[FAIL] Custom data export failed:", error);
  }

  console.log();

  // Test 2: Export conversation
  console.log("Test 2: Export conversation");
  const messages: ChatMessage[] = [
    {
      id: "msg1",
      conversationId: "conv123",
      role: "user",
      content: "What is the total sales?",
      createdAt: Date.now() - 60000,
    },
    {
      id: "msg2",
      conversationId: "conv123",
      role: "assistant",
      content: "The total sales are $1,234.56",
      createdAt: Date.now() - 30000,
    },
    {
      id: "msg3",
      conversationId: "conv123",
      role: "user",
      content: "Can you export this to Excel?",
      createdAt: Date.now(),
    },
  ];

  try {
    const filePath = await exportService.exportConversation("conv123", messages);
    console.log("[PASS] Conversation exported successfully:", filePath);
    await exportService.cleanupTempFile(filePath);
  } catch (error) {
    console.error("[FAIL] Conversation export failed:", error);
  }

  console.log();

  // Test 3: Export analysis result
  console.log("Test 3: Export analysis result");
  const toolCall = {
    index: 0,
    id: "call123",
    type: "_plugin" as const,
    _plugin: {
      name: "excel.describe",
      arguments: JSON.stringify({ file_id: "file123", sheet_name: "Sheet1" }),
    },
  };

  try {
    const filePath = await exportService.exportAnalysisResult("file123", toolCall);
    console.log("[PASS] Analysis result exported successfully:", filePath);
    await exportService.cleanupTempFile(filePath);
  } catch (error) {
    console.error("[FAIL] Analysis result export failed:", error);
  }

  console.log("\nAll tests completed!");
}

testExcelExport();

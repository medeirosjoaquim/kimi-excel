#!/usr/bin/env bun

import "dotenv/config";
import { Command } from "commander";
import { KimiClient } from "./client/kimi-client.js";

function getApiKey(): string {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) {
    console.error("Error: MOONSHOT_API_KEY environment variable is required");
    console.error("Get your API key from: https://platform.moonshot.cn/console/api-keys");
    process.exit(1);
  }
  return apiKey;
}

const program = new Command();

program
  .name("kimi-excel")
  .description("CLI tool to analyze Excel and CSV files using Kimi (Moonshot AI)")
  .version("1.0.0");

program
  .command("upload")
  .description("Upload an Excel or CSV file to Kimi")
  .argument("<file>", "Path to the Excel or CSV file")
  .action(async (file: string) => {
    try {
      const client = new KimiClient(getApiKey());
      console.log(`Uploading ${file}...`);
      const result = await client.uploadFile(file);
      console.log("\nFile uploaded successfully:");
      console.log(`  ID: ${result.id}`);
      console.log(`  Filename: ${result.filename}`);
      console.log(`  Size: ${result.bytes} bytes`);
      console.log(`  Status: ${result.status}`);
    } catch (error) {
      console.error("Upload failed:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List all uploaded files")
  .action(async () => {
    try {
      const client = new KimiClient(getApiKey());
      const files = await client.listFiles();

      if (files.length === 0) {
        console.log("No files uploaded yet.");
        return;
      }

      console.log("Uploaded files:\n");
      for (const file of files) {
        console.log(`  ${file.id}`);
        console.log(`    Filename: ${file.filename}`);
        console.log(`    Status: ${file.status ?? "unknown"}`);
        console.log("");
      }
    } catch (error) {
      console.error("Failed to list files:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("delete")
  .description("Delete an uploaded file")
  .argument("<file-id>", "ID of the file to delete")
  .action(async (fileId: string) => {
    try {
      const client = new KimiClient(getApiKey());
      await client.deleteFile(fileId);
      console.log(`File ${fileId} deleted successfully.`);
    } catch (error) {
      console.error("Delete failed:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("analyze")
  .description("Analyze an uploaded file with a question")
  .argument("<file-id>", "ID of the uploaded file")
  .argument("<question>", "Question to ask about the file")
  .option("-m, --model <model>", "Model to use", "kimi-k2-0905-preview")
  .option("--no-stream", "Disable streaming output")
  .action(async (fileId: string, question: string, options: { model: string; stream: boolean }) => {
    try {
      const client = new KimiClient(getApiKey());

      console.log("Analyzing file...\n");

      const result = await client.analyzeFile(fileId, question, {
        model: options.model,
        stream: options.stream,
        onChunk: options.stream ? (chunk) => process.stdout.write(chunk) : undefined,
      });

      if (options.stream) {
        console.log("\n");
      } else {
        console.log(result.content);
      }

      if (result.toolCalls.length > 0) {
        console.log("\nTool calls made:");
        for (const tc of result.toolCalls) {
          console.log(`  - ${tc._plugin.name}: ${tc._plugin.arguments}`);
        }
      }
    } catch (error) {
      console.error("Analysis failed:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("quick")
  .description("Upload a file and analyze it in one step")
  .argument("<file>", "Path to the Excel or CSV file")
  .argument("<question>", "Question to ask about the file")
  .option("-m, --model <model>", "Model to use", "kimi-k2-0905-preview")
  .option("--no-stream", "Disable streaming output")
  .option("--keep", "Keep the file after analysis (don't delete)")
  .action(async (file: string, question: string, options: { model: string; stream: boolean; keep: boolean }) => {
    let fileId: string | null = null;

    try {
      const client = new KimiClient(getApiKey());

      console.log(`Uploading ${file}...`);
      const uploadResult = await client.uploadFile(file);
      fileId = uploadResult.id;
      console.log(`File uploaded (ID: ${fileId})\n`);

      console.log("Analyzing...\n");

      const result = await client.analyzeFile(fileId, question, {
        model: options.model,
        stream: options.stream,
        onChunk: options.stream ? (chunk) => process.stdout.write(chunk) : undefined,
      });

      if (options.stream) {
        console.log("\n");
      } else {
        console.log(result.content);
      }

      if (!options.keep && fileId) {
        await client.deleteFile(fileId);
        console.log("\nFile cleaned up.");
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);

      if (fileId && !options.keep) {
        try {
          const client = new KimiClient(getApiKey());
          await client.deleteFile(fileId);
        } catch {
          // Ignore cleanup errors
        }
      }

      process.exit(1);
    }
  });

program.parse();

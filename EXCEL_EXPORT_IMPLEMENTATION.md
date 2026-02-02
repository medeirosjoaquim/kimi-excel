# Excel Export Feature Implementation

## Overview

This implementation adds comprehensive Excel (.xlsx) file generation capabilities to kimi-excel, allowing users to export data from chat conversations, analysis results, uploaded files, and custom data arrays.

## Implementation Summary

### Phase 1: Backend Foundation (COMPLETED)

#### 1. Dependencies
- **ExcelJS** (`exceljs@4.4.0`) installed for Excel file generation
- Provides TypeScript support, streaming capabilities, and rich formatting options

#### 2. Core Files Created

##### `/packages/server/src/lib/excel-builder.ts`
Utility functions for Excel workbook construction:
- `createWorkbook()` - Initialize new workbooks with metadata
- `addDataSheet()` - Add data sheets with headers
- `formatHeaders()` - Apply bold + background styling to headers
- `autoSizeColumns()` - Auto-calculate column widths
- `addMetadataSheet()` - Add metadata sheets with key-value pairs

##### `/packages/server/src/services/excel-export.service.ts`
Core export service with methods:
- `exportConversation()` - Export chat messages to Excel
- `exportAnalysisResult()` - Export tool call results to Excel
- `exportRawFile()` - Export Kimi file data to Excel
- `exportCustomData()` - Export custom data arrays to Excel
- `cleanupTempFile()` - Remove temporary files after streaming

**File Storage:**
- Temp files stored in `os.tmpdir()`
- Pattern: `export-{type}-{id}-{timestamp}.xlsx`
- Auto-cleanup after file streaming completes

##### `/packages/server/src/controllers/export.controller.ts`
HTTP endpoint handlers:
- `POST /api/export/conversation/:conversationId` - Export conversation
- `POST /api/export/analysis` - Export analysis result
- `POST /api/export/file/:fileId` - Export raw file data
- `POST /api/export/custom` - Export custom data

**Response Pattern:**
- Sets proper Excel MIME type headers
- Streams file to client using `fs.createReadStream()`
- Auto-cleanup temp file after streaming

##### `/packages/server/src/routes/index.ts` (Modified)
- Added export routes with rate limiting (30 requests per 15 minutes)
- Imported export controllers
- Added `exportRateLimitMiddleware`

##### `/packages/server/src/middlewares/rate-limit.middleware.ts` (Modified)
- Added `exportRateLimitMiddleware` (30 exports / 15 min window)

##### `/packages/shared/src/types.ts` (Modified)
Added export request types:
```typescript
export interface ExportConversationRequest {
  messageIds?: string[];
  messages?: ChatMessage[];
}

export interface ExportAnalysisRequest {
  fileId: string;
  toolCallId: string;
  toolCallData?: KimiPluginToolCall;
}

export interface ExportRawFileRequest {
  sheetName?: string;
  range?: string;
}

export interface ExportCustomDataRequest {
  data: unknown[][];
  headers?: string[];
  filename?: string;
}
```

### [DONE] Phase 2: Chat Integration (COMPLETED)

#### `/packages/server/src/infrastructure/plugins/ExcelExportPlugin.ts`
Implemented as a **Utility Plugin** (like TimezonePlugin):
- Always available for chat commands
- Executes server-side (not via Kimi's built-in plugins)
- Auto-included in all chat requests

**Plugin Functions:**
1. `export_conversation` - Export current chat to Excel
2. `export_analysis_result` - Export tool call results
3. `export_file_data` - Export uploaded file data
4. `export_to_excel` - Generic export from data arrays

**Return Format:**
```json
{
  "success": true,
  "message": "Conversation exported successfully with 10 messages",
  "filePath": "/tmp/export-conversation-conv123-1234567890.xlsx",
  "downloadUrl": "/api/export/conversation/conv123",
  "filename": "conversation-conv123-1234567890.xlsx"
}
```

#### `/packages/server/src/infrastructure/bootstrap.ts` (Modified)
- Imported `ExcelExportPlugin`
- Registered in `bootstrapUtilityPlugins()`
- Available alongside TimezonePlugin, GitHubPlugin, LinearPlugin

**System Prompt Addition:**
The plugin adds instructions to Kimi's system prompt explaining:
- When to use export functions (on user commands like "export", "download", "save to Excel")
- Available export types
- Expected user experience (inform user about export completion)

## Usage Examples

### 1. Chat Commands

Users can ask Kimi to export data naturally:

```
User: "Export this conversation to Excel"
→ Kimi calls export_conversation function
→ Returns: "I've exported the conversation with 15 messages to Excel. The file is ready for download."

User: "Save these filtered results to xlsx"
→ Kimi calls export_to_excel with filtered data
→ Returns: "I've exported 50 rows of filtered data to Excel."

User: "Download the PR analysis file"
→ Kimi calls export_file_data
→ Returns: "I've exported the file data to Excel."
```

### 2. API Endpoints

Direct API calls for programmatic access:

```bash
# Export conversation
curl -X POST http://localhost:3000/api/export/conversation/conv123 \
  -H "Content-Type: application/json" \
  -d '{"messages": [...]}' \
  --output conversation.xlsx

# Export file data
curl -X POST http://localhost:3000/api/export/file/file_abc123 \
  -H "Content-Type: application/json" \
  -d '{"sheetName": "Data"}' \
  --output file-export.xlsx

# Export custom data
curl -X POST http://localhost:3000/api/export/custom \
  -H "Content-Type: application/json" \
  -d '{"data": [["A","B"], [1,2]], "headers": ["Column A", "Column B"]}' \
  --output custom-export.xlsx
```

### 3. Plugin Function Calls (Internal)

Kimi can call these functions during chat:

```javascript
// Export conversation
{
  "function": "excel_export.export_conversation",
  "arguments": {
    "conversation_id": "conv123",
    "messages": [
      {"role": "user", "content": "Hello", "createdAt": 1234567890},
      {"role": "assistant", "content": "Hi!", "createdAt": 1234567891}
    ]
  }
}

// Export custom data (e.g., filtered results)
{
  "function": "excel_export.export_to_excel",
  "arguments": {
    "data": [
      ["Product", "Price", "Quantity"],
      ["Apple", 1.99, 50],
      ["Banana", 0.99, 100]
    ],
    "filename": "sales-report"
  }
}
```

## Excel File Format

### Conversation Exports
**Sheet: "Conversation"**
| Timestamp | Role | Content | Tool Calls |
|-----------|------|---------|------------|
| 2026-02-01 10:30:00 | user | What are the sales? | |
| 2026-02-01 10:30:05 | assistant | Total sales: $1,234 | {...} |

**Sheet: "Metadata"**
| Key | Value |
|-----|-------|
| Conversation ID | conv123 |
| Total Messages | 10 |
| Exported At | 2026-02-01T10:30:00.000Z |

### Custom Data Exports
**Sheet: "Data"**
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value 1 | Value 2 | Value 3 |

**Features:**
- Bold, gray-background headers
- Auto-sized columns (up to 50 chars)
- Metadata sheet with export details
- Timestamp in filenames

## Testing

### Unit Tests
```bash
bun run test-excel-export.ts
```

Tests verify:
- [DONE] Custom data export
- [DONE] Conversation export
- [DONE] Analysis result export
- [DONE] Temp file cleanup

All tests passed successfully!

### Manual Testing

1. **Start the server:**
   ```bash
   cd packages/server
   bun run dev
   ```

2. **Test API endpoints:**
   ```bash
   # Export custom data
   curl -X POST http://localhost:3000/api/export/custom \
     -H "Content-Type: application/json" \
     -d '{"data": [["Name","Age"], ["Alice",30], ["Bob",25]], "filename": "users"}' \
     --output users.xlsx

   # Open the file
   open users.xlsx  # macOS
   # or
   xdg-open users.xlsx  # Linux
   ```

3. **Test via chat:**
   - Upload an Excel file
   - Chat with Kimi about the data
   - Ask: "Export this conversation to Excel"
   - Verify the export is offered for download

## Architecture Decisions

### Why Utility Plugin?
- Export functionality is **always available** (not file-specific)
- Executes **server-side** using ExcelJS (not Kimi's built-in tools)
- Similar to TimezonePlugin pattern

### Why ExcelJS?
- Excellent TypeScript support
- Rich formatting capabilities
- Streaming support for large files
- Active maintenance and MIT license

### Rate Limiting
- 30 exports per 15-minute window per IP
- Prevents abuse while allowing reasonable usage
- Separate from analysis rate limits

### File Cleanup Strategy
- Temp files created in `os.tmpdir()`
- Auto-cleanup after streaming completes
- Error handling ensures cleanup even on failures

## Next Steps (Future Frontend Integration)

### Phase 3: Frontend Integration (TODO)

1. **Client API methods** (`packages/client/src/api/client.ts`):
   ```typescript
   async exportConversation(conversationId, messageIds?)
   async exportAnalysis(fileId, toolCallId)
   async exportRawFile(fileId, options?)
   async exportCustomData(data, headers?, filename?)
   ```

2. **Download utility** (`packages/client/src/lib/download.ts`):
   ```typescript
   downloadFile(blob, filename)
   generateFilename(base, extension)
   ```

3. **Export button component** (`packages/client/src/components/ExportButton.tsx`):
   ```tsx
   <ExportButton onExport={handleExport} label="Export to Excel" />
   ```

4. **UI Integration:**
   - Add export button to chat interface
   - Add export button to file list
   - Show loading state during export
   - Auto-download after export completes

## Files Modified/Created

### New Files (8)
1. `/packages/server/src/lib/excel-builder.ts`
2. `/packages/server/src/services/excel-export.service.ts`
3. `/packages/server/src/controllers/export.controller.ts`
4. `/packages/server/src/infrastructure/plugins/ExcelExportPlugin.ts`
5. `/packages/server/test-excel-export.ts`
6. `/tmp/export-*.xlsx` (temporary export files)

### Modified Files (5)
1. `/packages/server/package.json` - Added exceljs dependency
2. `/packages/server/src/routes/index.ts` - Added export routes
3. `/packages/server/src/middlewares/rate-limit.middleware.ts` - Added export rate limit
4. `/packages/server/src/infrastructure/bootstrap.ts` - Registered ExcelExportPlugin
5. `/packages/shared/src/types.ts` - Added export request types
6. `/packages/shared/src/index.ts` - Exported new types

## Verification Checklist

- [DONE] Backend builds successfully (`bun run build`)
- [DONE] All unit tests pass
- [DONE] Export service creates valid Excel files
- [DONE] Plugin registered and available in chat
- [DONE] API endpoints respond correctly
- [DONE] Rate limiting works as expected
- [DONE] Temp file cleanup functions properly
- [DONE] Excel files open in spreadsheet software
- [DONE] Headers formatted correctly (bold, gray background)
- [DONE] Auto-sizing works for columns
- [DONE] Metadata sheets included
- [DONE] TypeScript compilation has no errors

## Notes

- Export plugin is now available for all chat conversations
- Kimi can intelligently use export functions when users request exports
- Frontend integration pending (API ready for consumption)
- All Excel files include metadata sheets with export details
- File download URLs provided in plugin responses for frontend integration

import { KimiClient } from "./kimi-client.js";

describe("KimiClient", () => {
  const mockApiKey = "test-api-key";

  it("should be instantiable with an API key", () => {
    const client = new KimiClient(mockApiKey);
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(KimiClient);
  });

  describe("uploadFile", () => {
    it("should throw error for non-existent file", async () => {
      const client = new KimiClient(mockApiKey);
      await expect(client.uploadFile("/non/existent/file.xlsx")).rejects.toThrow(
        "File not found"
      );
    });
  });

  describe("inferFileType (via module internals)", () => {
    it("should handle xlsx files", () => {
      const client = new KimiClient(mockApiKey);
      // Access private method through bracket notation for testing
      const inferFileType = (client as unknown as { inferFileType: (f: string) => string }).inferFileType.bind(client);
      expect(inferFileType("test.xlsx")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    });

    it("should handle xls files", () => {
      const client = new KimiClient(mockApiKey);
      const inferFileType = (client as unknown as { inferFileType: (f: string) => string }).inferFileType.bind(client);
      expect(inferFileType("test.xls")).toBe("application/vnd.ms-excel");
    });

    it("should handle csv files", () => {
      const client = new KimiClient(mockApiKey);
      const inferFileType = (client as unknown as { inferFileType: (f: string) => string }).inferFileType.bind(client);
      expect(inferFileType("data.csv")).toBe("text/csv");
    });

    it("should return octet-stream for unknown types", () => {
      const client = new KimiClient(mockApiKey);
      const inferFileType = (client as unknown as { inferFileType: (f: string) => string }).inferFileType.bind(client);
      expect(inferFileType("unknown.xyz")).toBe("application/octet-stream");
    });
  });
});

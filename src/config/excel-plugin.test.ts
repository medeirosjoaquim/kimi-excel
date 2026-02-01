import { excelPlugin } from "./excel-plugin.js";

describe("excelPlugin", () => {
  it("should have the correct plugin structure", () => {
    expect(excelPlugin.type).toBe("_plugin");
    expect(excelPlugin._plugin.name).toBe("excel");
    expect(excelPlugin._plugin.description).toBeTruthy();
    expect(Array.isArray(excelPlugin._plugin.functions)).toBe(true);
  });

  it("should have required functions", () => {
    const functionNames = excelPlugin._plugin.functions.map((f) => f.name);
    expect(functionNames).toContain("read_file");
    expect(functionNames).toContain("head");
    expect(functionNames).toContain("tail");
    expect(functionNames).toContain("describe");
    expect(functionNames).toContain("groupby");
    expect(functionNames).toContain("filter");
    expect(functionNames).toContain("sort");
    expect(functionNames).toContain("value_counts");
  });

  it("should have file_id as required parameter for all functions", () => {
    for (const func of excelPlugin._plugin.functions) {
      expect(func.parameters.required).toContain("file_id");
      expect(func.parameters.properties.file_id).toBeDefined();
      expect(func.parameters.properties.file_id.type).toBe("string");
    }
  });

  describe("read_file function", () => {
    it("should have correct parameters", () => {
      const readFile = excelPlugin._plugin.functions.find((f) => f.name === "read_file");
      expect(readFile).toBeDefined();
      expect(readFile?.parameters.properties).toHaveProperty("file_id");
      expect(readFile?.parameters.properties).toHaveProperty("sheet_name");
      expect(readFile?.parameters.required).toEqual(["file_id"]);
    });
  });

  describe("groupby function", () => {
    it("should have correct required parameters", () => {
      const groupby = excelPlugin._plugin.functions.find((f) => f.name === "groupby");
      expect(groupby).toBeDefined();
      expect(groupby?.parameters.required).toContain("file_id");
      expect(groupby?.parameters.required).toContain("by");
      expect(groupby?.parameters.required).toContain("agg");
    });
  });

  describe("filter function", () => {
    it("should have conditions as required parameter", () => {
      const filter = excelPlugin._plugin.functions.find((f) => f.name === "filter");
      expect(filter).toBeDefined();
      expect(filter?.parameters.required).toContain("conditions");
    });
  });
});

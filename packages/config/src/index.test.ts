import { describe, expect, it } from "vitest";
import { loadEnv } from "./index";

describe("loadEnv", () => {
  it("throws when required variables are missing", () => {
    expect(() => loadEnv({ path: ".env.nonexistent" })).toThrowError();
  });
});

import { describe, expect, it } from "vitest";
import { emailProblem, normaliseNigerianPhone } from "./validation";

describe("Nigerian phone numbers", () => {
  it("accepts an 11-digit local number", () => {
    expect(normaliseNigerianPhone("0803 123 4567")).toBe("08031234567");
  });
  it("accepts +234 form and normalises it", () => {
    expect(normaliseNigerianPhone("+2348031234567")).toBe("08031234567");
  });
  it("rejects more than 11 digits", () => {
    expect(normaliseNigerianPhone("080312345678")).toBeNull();
  });
  it("rejects fewer than 11 digits", () => {
    expect(normaliseNigerianPhone("0803123456")).toBeNull();
  });
  it("rejects non-mobile prefixes", () => {
    expect(normaliseNigerianPhone("01234567890")).toBeNull();
  });
  it("rejects repeated-digit fakes", () => {
    expect(normaliseNigerianPhone("08000000000")).toBeNull();
  });
});

describe("email", () => {
  it("accepts a normal address", () => {
    expect(emailProblem("ada@gmail.com")).toBeNull();
  });
  it("rejects malformed addresses", () => {
    expect(emailProblem("ada@gmail")).not.toBeNull();
  });
  it("rejects throwaway domains", () => {
    expect(emailProblem("x@mailinator.com")).not.toBeNull();
  });
});

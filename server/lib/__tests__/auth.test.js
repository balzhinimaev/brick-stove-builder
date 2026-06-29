import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../password.js";
import { signToken, verifyToken } from "../token.js";

const SECRET = "test-secret-test-secret";

describe("password hashing", () => {
  it("verifies a correct password", () => {
    const stored = hashPassword("hunter2!");
    expect(verifyPassword("hunter2!", stored)).toBe(true);
  });
  it("rejects a wrong password", () => {
    const stored = hashPassword("hunter2!");
    expect(verifyPassword("nope", stored)).toBe(false);
  });
  it("uses a unique salt per hash", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });
  it("rejects malformed stored values", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "nosalt")).toBe(false);
  });
});

describe("token signing", () => {
  it("round-trips the login for a valid token", () => {
    const token = signToken("alice", SECRET);
    expect(verifyToken(token, SECRET)).toEqual({ login: "alice" });
  });
  it("rejects a token signed with a different secret", () => {
    const token = signToken("alice", SECRET);
    expect(verifyToken(token, "other-secret-other-secret")).toBeNull();
  });
  it("rejects a tampered payload", () => {
    const token = signToken("alice", SECRET);
    const [, sig] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ login: "admin", exp: Date.now() + 10000 })).toString("base64url")}.${sig}`;
    expect(verifyToken(forged, SECRET)).toBeNull();
  });
  it("rejects an expired token", () => {
    const past = Date.now() - 1000;
    const token = signToken("alice", SECRET, -1, past);
    expect(verifyToken(token, SECRET)).toBeNull();
  });
  it("rejects junk", () => {
    expect(verifyToken("", SECRET)).toBeNull();
    expect(verifyToken("a.b.c", SECRET)).toBeNull();
    expect(verifyToken(undefined, SECRET)).toBeNull();
  });
});

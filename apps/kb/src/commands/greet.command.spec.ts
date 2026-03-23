import { expect, describe, it } from "bun:test";
import { greet } from "./greet.command";

describe("greet()", () => {
  it.each([
    ["World", 1, 'Hello "World" via Bun!'],
    ["TypeScript", 2, 'Hello "TypeScript" via Bun!\n\nHello "TypeScript" via Bun!'],
  ])("greets '%s' %d time(s)", (name, times, expected) => {
    expect(greet(name, times)).toBe(expected);
  });
});
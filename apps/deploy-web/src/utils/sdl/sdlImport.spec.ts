import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { buildCommand } from "./sdlGenerator";
import { importSimpleSdl, parseSvcCommand } from "./sdlImport";

describe("sdlImport", () => {
  describe("parseSvcCommand", () => {
    it("returns empty string if command is not provided", () => {
      expect(parseSvcCommand()).toEqual("");
    });

    it("returns empty string if command is empty string", () => {
      expect(parseSvcCommand("")).toEqual("");
    });

    it("returns empty string if command is empty array", () => {
      expect(parseSvcCommand([])).toEqual("");
    });

    it("returns command as string if command is string", () => {
      expect(parseSvcCommand("echo 'foo'")).toEqual("echo 'foo'");
    });

    it("returns command as string if command is array of string", () => {
      expect(parseSvcCommand(["echo", "foo"])).toEqual("echo\nfoo");
    });

    it("returns command as string if command is array of string, drops empty lines", () => {
      expect(parseSvcCommand(["echo", "", "foo"])).toEqual("echo\nfoo");
    });

    it("preserves a leading sh -c instead of stripping it", () => {
      expect(parseSvcCommand(["sh", "-c", "echo 'foo'"])).toEqual("sh\n-c\necho 'foo'");
    });

    it("joins every command element with a newline", () => {
      expect(parseSvcCommand(["sh", "-c", "echo 'foo'", "echo 'bar'"])).toEqual("sh\n-c\necho 'foo'\necho 'bar'");
    });

    it("joins every command element with a newline, dropping empty lines", () => {
      expect(parseSvcCommand(["sh", "-c", "echo 'foo'", "", "echo 'bar'"])).toEqual("sh\n-c\necho 'foo'\necho 'bar'");
    });
  });

  describe("command round-trip", () => {
    it.each([
      { command: ["bash", "-lc"], args: ["./run.sh"] },
      { command: ["sh", "-c"], args: ["echo hi"] },
      { command: ["sh", "-c", "echo foo"], args: undefined },
      { command: ["bash", "-c"], args: ["run"] }
    ])("preserves command $command and args $args without forcing a shell wrapper", ({ command, args }) => {
      const formCommand = parseSvcCommand(command);
      const formArg = args ? args[0] : "";

      const rebuiltCommand = buildCommand(formCommand.trim());
      const rebuiltArgs = formArg ? [formArg] : undefined;

      expect(rebuiltCommand).toEqual(command);
      expect(rebuiltArgs).toEqual(args);
    });
  });

  describe("importSimpleSdl", () => {
    it("returns services in the same order as in the SDL YAML", () => {
      const yml = fs.readFileSync(path.resolve(__dirname, "../../../tests/mocks/two-services-sdl.yml"), "utf8");

      const services = importSimpleSdl(yml);

      expect(services.map(service => service.title)).toEqual(["web", "service-2"]);
    });
  });
});

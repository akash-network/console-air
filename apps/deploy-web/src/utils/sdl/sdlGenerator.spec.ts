import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import type { ServiceType } from "@src/types";
import { buildCommand, generateSdl } from "./sdlGenerator";

describe("sdlGenerator", () => {
  describe(generateSdl.name, () => {
    it("includes permissions params for log-collector services", () => {
      const result = generateSdl([createLogCollectorService()]);
      const parsed = yaml.load(result) as { services: Record<string, ServiceType> };

      expect(parsed.services["web-log-collector"].params).toEqual({
        permissions: {
          read: ["deployment", "logs"]
        }
      });
    });

    it("does not include permissions params for non-log-collector services", () => {
      const result = generateSdl([createLogCollectorService({ title: "web", image: "nginx:latest" })]);
      const parsed = yaml.load(result) as { services: Record<string, { params?: unknown }> };

      expect(parsed.services["web"].params).toBeUndefined();
    });

    it("preserves the command verbatim without forcing a sh -c wrapper", () => {
      const result = generateSdl([createLogCollectorService({ title: "web", image: "nginx:latest", command: { command: "bash\n-lc", arg: "./run.sh" } })]);
      const parsed = yaml.load(result) as { services: Record<string, { command?: unknown; args?: unknown }> };

      expect(parsed.services.web.command).toEqual(["bash", "-lc"]);
      expect(parsed.services.web.args).toEqual(["./run.sh"]);
    });

    it("does not emit an args key when a service has a command but no arg", () => {
      const result = generateSdl([createLogCollectorService({ title: "web", image: "nginx:latest", command: { command: "sh\n-c\necho hello", arg: "" } })]);
      const parsed = yaml.load(result) as { services: Record<string, { command?: unknown }> };

      expect(parsed.services.web.command).toEqual(["sh", "-c", "echo hello"]);
      expect(parsed.services.web).not.toHaveProperty("args");
    });

    function createLogCollectorService(overrides?: Partial<ServiceType>): ServiceType {
      return {
        id: "web-log-collector",
        title: "web-log-collector",
        image: LOG_COLLECTOR_IMAGE,
        profile: {
          cpu: 0.1,
          ram: 256,
          ramUnit: "Mi",
          storage: [{ size: 512, unit: "Mi", isPersistent: false }],
          hasGpu: false,
          gpu: 0
        },
        expose: [{ port: 80, as: 80, global: true, to: [] }],
        placement: {
          name: "dcloud",
          pricing: { amount: 1000, denom: "uakt" }
        },
        count: 1,
        ...overrides
      } as ServiceType;
    }
  });

  describe(buildCommand.name, () => {
    it("returns an empty array for an empty string", () => {
      expect(buildCommand("")).toEqual([]);
    });

    it("returns a single-element array for a single line", () => {
      expect(buildCommand("echo 'foo'")).toEqual(["echo 'foo'"]);
    });

    it("splits newline-separated tokens into an array", () => {
      expect(buildCommand("sh\n-c")).toEqual(["sh", "-c"]);
    });

    it("keeps a script token as its own array element", () => {
      expect(buildCommand("sh\n-c\nfoo")).toEqual(["sh", "-c", "foo"]);
    });

    it("does not force a sh -c wrapper for multi-token commands", () => {
      expect(buildCommand("bash\n-lc")).toEqual(["bash", "-lc"]);
    });

    it("drops empty lines and trailing newlines", () => {
      expect(buildCommand("foo\nbar\n")).toEqual(["foo", "bar"]);
      expect(buildCommand("foo\nbar\n\n")).toEqual(["foo", "bar"]);
    });

    it("trims whitespace around each token", () => {
      expect(buildCommand(" foo \n bar ")).toEqual(["foo", "bar"]);
    });
  });
});

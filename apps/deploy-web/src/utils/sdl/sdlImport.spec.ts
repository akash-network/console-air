import yaml from "js-yaml";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { buildCommand, generateSdl } from "./sdlGenerator";
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

    it("captures params.tee onto the service model", () => {
      const services = importSimpleSdl(teeSdl("cpu-gpu"));

      expect(services[0].params?.tee).toBe("cpu-gpu");
    });

    it("leaves params undefined when the service has no tee param", () => {
      const yml = fs.readFileSync(path.resolve(__dirname, "../../../tests/mocks/two-services-sdl.yml"), "utf8");

      const services = importSimpleSdl(yml);

      expect(services[0].params).toBeUndefined();
    });
  });

  describe("tee round-trip", () => {
    it("preserves params.tee when importing then regenerating the SDL", () => {
      const services = importSimpleSdl(teeSdl("cpu"));
      const regenerated = yaml.load(generateSdl(services)) as { services: Record<string, { params?: { tee?: string } }> };

      expect(regenerated.services.web.params?.tee).toBe("cpu");
    });
  });

  describe("http_options.proxy", () => {
    it("imports all six http_options.proxy fields onto httpOptions.proxy in camelCase", () => {
      const services = importSimpleSdl(proxySdl(fullProxyYamlLines));

      expect(services[0].expose[0].httpOptions?.proxy).toEqual({
        bufferingDisable: true,
        bufferSize: 8192,
        buffersNumber: 4,
        buffersSize: 4096,
        busyBuffersSize: 16384,
        connectTimeout: 5000
      });
    });

    it("imports an empty http_options.proxy block as undefined", () => {
      const services = importSimpleSdl(proxySdl([]));

      expect(services[0].expose[0].httpOptions?.proxy).toBeUndefined();
    });

    it("preserves proxy options when importing then regenerating the SDL", () => {
      const services = importSimpleSdl(proxySdl(fullProxyYamlLines));
      const regenerated = yaml.load(generateSdl(services)) as {
        services: Record<string, { expose: { http_options?: { proxy?: Record<string, unknown> } }[] }>;
      };

      expect(regenerated.services.web.expose[0].http_options?.proxy).toEqual({
        buffering_disable: true,
        buffer_size: 8192,
        buffers_number: 4,
        buffers_size: 4096,
        busy_buffers_size: 16384,
        connect_timeout: 5000
      });
    });
  });

  describe("cpu architecture", () => {
    it("imports the architecture an SDL requests", () => {
      const services = importSimpleSdl(archSdl("arm64"));

      expect(services[0].profile.arch).toBe("arm64");
    });

    it("leaves the architecture unset when the SDL declares no cpu attributes", () => {
      const services = importSimpleSdl(archSdl(undefined));

      expect(services[0].profile.arch).toBeUndefined();
    });

    it.each(["amd64", "arm64"] as const)("round-trips an explicit %s without changing it", arch => {
      const regenerated = yaml.load(generateSdl(importSimpleSdl(archSdl(arch)))) as ComputeYaml;

      expect(regenerated.profiles.compute.web.resources.cpu.attributes).toEqual({ arch });
    });

    it("writes no cpu attributes when round-tripping an SDL that declared none", () => {
      const regenerated = yaml.load(generateSdl(importSimpleSdl(archSdl(undefined)))) as ComputeYaml;

      expect(regenerated.profiles.compute.web.resources.cpu).not.toHaveProperty("attributes");
    });

    it("rejects an architecture no provider could serve", () => {
      expect(() => importSimpleSdl(archSdl("sparc64"))).toThrow('Unsupported CPU architecture "sparc64"');
    });

    type ComputeYaml = { profiles: { compute: Record<string, { resources: { cpu: { units: number; attributes?: { arch: string } } } }> } };
  });
});

function archSdl(arch: string | undefined): string {
  const cpuAttributes = arch ? ["          attributes:", `            arch: ${arch}`] : [];
  return [
    "---",
    'version: "2.0"',
    "services:",
    "  web:",
    "    image: nginx",
    "    expose:",
    "      - port: 80",
    "        to:",
    "          - global: true",
    "profiles:",
    "  compute:",
    "    web:",
    "      resources:",
    "        cpu:",
    "          units: 0.5",
    ...cpuAttributes,
    "        memory:",
    "          size: 512Mi",
    "        storage:",
    "          - size: 512Mi",
    "  placement:",
    "    dcloud:",
    "      pricing:",
    "        web:",
    "          denom: uakt",
    "          amount: 1000",
    "deployment:",
    "  web:",
    "    dcloud:",
    "      profile: web",
    "      count: 1",
    ""
  ].join("\n");
}

const fullProxyYamlLines = [
  "            buffering_disable: true",
  "            buffer_size: 8192",
  "            buffers_number: 4",
  "            buffers_size: 4096",
  "            busy_buffers_size: 16384",
  "            connect_timeout: 5000"
];

/** Single-service SDL whose `expose[0].http_options.proxy` block holds the given lines. */
const proxySdl = (proxyLines: string[]) =>
  [
    "version: '2.0'",
    "services:",
    "  web:",
    "    image: nginx:1.0",
    "    expose:",
    "      - port: 80",
    "        as: 80",
    "        to:",
    "          - global: true",
    "        http_options:",
    "          max_body_size: 1048576",
    "          read_timeout: 60000",
    "          send_timeout: 60000",
    "          next_tries: 3",
    "          next_timeout: 60000",
    "          next_cases:",
    "            - error",
    "          proxy:",
    ...(proxyLines.length ? proxyLines : ["            {}"]),
    "profiles:",
    "  compute:",
    "    web:",
    "      resources:",
    "        cpu:",
    "          units: 0.5",
    "        memory:",
    "          size: 512Mi",
    "        storage:",
    "          - size: 512Mi",
    "  placement:",
    "    dcloud:",
    "      pricing:",
    "        web:",
    "          denom: uakt",
    "          amount: 1000",
    "deployment:",
    "  web:",
    "    dcloud:",
    "      profile: web",
    "      count: 1"
  ].join("\n");

const teeSdl = (tee: "cpu" | "cpu-gpu") => `---
version: "2.1"
services:
  web:
    image: nginx:latest
    expose:
      - port: 80
        as: 80
        to:
          - global: true
    params:
      tee: ${tee}
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 512Mi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

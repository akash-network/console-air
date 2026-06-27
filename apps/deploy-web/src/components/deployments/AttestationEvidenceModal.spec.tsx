import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";

import type { AttestationValidationResult } from "@src/queries/useAttestationValidationMutation";
import type { AttestationQuote } from "@src/utils/confidentialCompute";
import type { DEPENDENCIES } from "./AttestationEvidenceModal";
import { AttestationEvidenceModal } from "./AttestationEvidenceModal";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(AttestationEvidenceModal.name, () => {
  it("fetches the evidence when opened", () => {
    const { mutate } = setup({});
    expect(mutate).toHaveBeenCalled();
  });

  it("keeps each report row collapsed until it is expanded", async () => {
    setup({ quote: { report: "cpu-report-base64", tee_platform: "snp" } });

    expect(screen.queryByText("cpu-report-base64")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /CPU/ }));

    expect(screen.getByText("cpu-report-base64")).toBeInTheDocument();
  });

  it("lists one collapsible row per GPU with 1-based labels for a cpu-gpu platform", async () => {
    setup({
      quote: {
        report: "cpu-report",
        tee_platform: "snp-gpu",
        gpu_reports: [
          { device_index: 0, report: "gpu-0-report" },
          { device_index: 1, report: "gpu-1-report" }
        ]
      }
    });

    expect(screen.getByRole("button", { name: /GPU 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GPU 2/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /GPU 1/ }));
    await userEvent.click(screen.getByRole("button", { name: /GPU 2/ }));

    // device_index 0 is labelled "GPU 1", so its report shows when that row is expanded.
    expect(screen.getByText("gpu-0-report")).toBeInTheDocument();
    expect(screen.getByText("gpu-1-report")).toBeInTheDocument();
  });

  it("does not render any GPU rows for a CPU-only platform", () => {
    setup({ quote: { report: "cpu-report", tee_platform: "snp" } });
    expect(screen.queryByRole("button", { name: /GPU/ })).not.toBeInTheDocument();
  });

  it("downloads the full bundle including the nonce and cert material as JSON when the download action is clicked", async () => {
    const { saveFile } = setup({
      nonce: "nonce-base64",
      quote: { report: "cpu-report", tee_platform: "snp", cert_chain: "cpu-cert-chain", auxblob: "aux" }
    });

    await userEvent.click(screen.getByRole("button", { name: "Download JSON" }));

    expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), "attestation-123-1-2.json");
    const [blob] = (saveFile as Mock).mock.calls[0];
    expect(JSON.parse(await blob.text())).toMatchObject({
      nonce: "nonce-base64",
      report: "cpu-report",
      tee_platform: "snp",
      cert_chain: "cpu-cert-chain",
      auxblob: "aux"
    });
  });

  it("shows an error and offers a retry when the fetch fails", () => {
    setup({ error: new Error("provider unreachable") });
    expect(screen.getByText(/provider unreachable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("validates the fetched evidence when the validate action is clicked", async () => {
    const { validate } = setup({ nonce: "nonce-base64", quote: { report: "cpu-report", tee_platform: "snp" } });

    await userEvent.click(screen.getByRole("button", { name: "Validate" }));

    expect(validate).toHaveBeenCalledWith({ evidence: { nonce: "nonce-base64", quote: { report: "cpu-report", tee_platform: "snp" } } });
  });

  it("disables validation until the evidence is loaded", () => {
    setup({});
    expect(screen.getByRole("button", { name: "Validate" })).toBeDisabled();
  });

  it("shows a verdict per report and keeps the CPU verdict when a GPU report is unverifiable", async () => {
    setup({
      quote: { report: "cpu-report", tee_platform: "snp-gpu", gpu_reports: [{ device_index: 0, report: "gpu-0-report" }] },
      validation: {
        data: {
          overall: "unverifiable",
          nonce: "nonce-base64",
          reports: [
            { kind: "cpu", vendor: "amd-sev-snp", status: "valid", detail: "Genuine AMD SEV-SNP hardware" },
            { kind: "gpu", device_index: 0, vendor: "nvidia", status: "unverifiable", detail: "NVIDIA NRAS unreachable" }
          ]
        }
      }
    });

    // Badges live in the always-visible row header, so they show without expanding.
    expect(screen.getByText("Valid")).toBeInTheDocument();
    expect(screen.getByText("Unverifiable")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /CPU/ }));
    await userEvent.click(screen.getByRole("button", { name: /GPU 1/ }));

    // Per-report isolation: the CPU verdict detail stands even though the GPU report is unverifiable.
    expect(screen.getByText("Genuine AMD SEV-SNP hardware")).toBeInTheDocument();
    expect(screen.getByText("NVIDIA NRAS unreachable")).toBeInTheDocument();
  });

  it("shows an invalid verdict for a report that fails verification", async () => {
    setup({
      quote: { report: "cpu-report", tee_platform: "snp" },
      validation: {
        data: {
          overall: "invalid",
          nonce: "nonce-base64",
          reports: [{ kind: "cpu", vendor: "amd-sev-snp", status: "invalid", detail: "signature did not verify" }]
        }
      }
    });

    expect(screen.getByText("Invalid")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /CPU/ }));

    expect(screen.getByText("signature did not verify")).toBeInTheDocument();
  });

  it("surfaces a non-blocking validation error while still rendering the evidence", async () => {
    setup({
      quote: { report: "cpu-report", tee_platform: "snp" },
      validation: { error: new Error("validation service unavailable") }
    });

    expect(screen.getByText(/validation service unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate" })).toBeEnabled();

    // The raw report still renders once its row is expanded, so the rest of the view is intact.
    await userEvent.click(screen.getByRole("button", { name: /CPU/ }));
    expect(screen.getByText("cpu-report")).toBeInTheDocument();
  });

  function setup(input: {
    nonce?: string;
    quote?: AttestationQuote;
    error?: Error;
    validation?: { data?: AttestationValidationResult; error?: Error; isPending?: boolean };
  }) {
    const mutate = vi.fn();
    const validate = vi.fn();
    const saveFile = vi.fn();
    const data = input.quote ? { nonce: input.nonce ?? "nonce-base64", quote: input.quote } : undefined;
    const useAttestationQuoteMutation = vi.fn(
      () => ({ mutate, data, error: input.error ?? null, isPending: false }) as unknown as ReturnType<typeof DEPENDENCIES.useAttestationQuoteMutation>
    );
    const useAttestationValidationMutation = vi.fn(
      () =>
        ({
          mutate: validate,
          data: input.validation?.data,
          error: input.validation?.error ?? null,
          isPending: input.validation?.isPending ?? false
        }) as unknown as ReturnType<typeof DEPENDENCIES.useAttestationValidationMutation>
    );

    render(
      <AttestationEvidenceModal
        provider={{ owner: "akash1provider", hostUri: "https://provider.test" }}
        lease={{ dseq: "123", gseq: 1, oseq: 2 }}
        onClose={vi.fn()}
        dependencies={{ useAttestationQuoteMutation, useAttestationValidationMutation, saveFile }}
      />
    );

    return { mutate, validate, saveFile };
  }
});

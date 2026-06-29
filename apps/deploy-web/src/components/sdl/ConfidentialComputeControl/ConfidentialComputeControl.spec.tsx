import { FormProvider, useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { ConfidentialComputeControl } from "./ConfidentialComputeControl";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildSDLService } from "@tests/seeders/sdlService";

describe(ConfidentialComputeControl.name, () => {
  it("is disabled by default and shows no TEE type selector", async () => {
    await setup({ hasGpu: false });

    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.queryByLabelText("TEE type")).not.toBeInTheDocument();
  });

  it("never renders a second toggle (no attestation toggle)", async () => {
    await setup({ tee: "cpu", hasGpu: false });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("enables with the cpu type when the service has no GPU profile", async () => {
    const { user, form } = await setup({ hasGpu: false });

    await user.click(screen.getByRole("checkbox"));

    expect(form.getValues("services.0.params.tee")).toBe("cpu");
    expect(await screen.findByLabelText("TEE type")).toBeInTheDocument();
  });

  it("enables with the cpu-gpu type when the service already has a GPU profile", async () => {
    const { user, form } = await setup({ hasGpu: true });

    await user.click(screen.getByRole("checkbox"));

    expect(form.getValues("services.0.params.tee")).toBe("cpu-gpu");
  });

  it("clears params.tee when Confidential Compute is disabled", async () => {
    const { user, form } = await setup({ tee: "cpu", hasGpu: false });

    await user.click(screen.getByRole("checkbox"));

    expect(form.getValues("services.0.params.tee")).toBeUndefined();
  });

  it("offers exactly two TEE types: cpu and cpu-gpu", async () => {
    const { user } = await setup({ tee: "cpu-gpu", hasGpu: true });

    await user.click(screen.getByLabelText("TEE type"));

    await vi.waitFor(() => {
      expect(screen.getByRole("option", { name: "CPU" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "CPU + GPU" })).toBeInTheDocument();
    });
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("disables the cpu-gpu option and shows a hint when the service has no GPU profile", async () => {
    const { user } = await setup({ tee: "cpu", hasGpu: false });

    expect(screen.getByText(/requires a GPU profile/i)).toBeInTheDocument();

    await user.click(screen.getByLabelText("TEE type"));
    await vi.waitFor(() => {
      expect(screen.getByRole("option", { name: "CPU + GPU" })).toHaveAttribute("data-disabled");
    });
  });

  it("warns when cpu-gpu is selected but the service has no GPU profile", async () => {
    await setup({ tee: "cpu-gpu", hasGpu: false });
    expect(screen.getByText(/CPU \+ GPU Confidential Compute requires a GPU profile/i)).toBeInTheDocument();
  });

  it("shows the attestation sidecar resource carve-out when enabled", async () => {
    await setup({ tee: "cpu", hasGpu: false });

    expect(screen.getByText("Attestation sidecar")).toBeInTheDocument();
    expect(screen.getByText("Available to your container")).toBeInTheDocument();
  });

  async function setup(input: { tee?: "cpu" | "cpu-gpu"; hasGpu?: boolean } = {}) {
    const hasGpu = !!input.hasGpu;
    const service = buildSDLService({
      profile: {
        cpu: 0.5,
        ram: 256,
        ramUnit: "Mi",
        storage: [{ size: 1, unit: "Gi", isPersistent: false }],
        hasGpu,
        gpu: hasGpu ? 1 : 0
      },
      ...(input.tee ? { params: { tee: input.tee } } : {})
    });

    let maybeForm: ReturnType<typeof useForm<SdlBuilderFormValuesType>>;

    const TestWrapper = () => {
      const methods = useForm<SdlBuilderFormValuesType>({ defaultValues: { services: [service] } });
      maybeForm = methods;
      // Watch the live service so the controlled `currentService` prop reflects form updates, like the real form does.
      const services = methods.watch("services");

      return (
        <FormProvider {...methods}>
          <TooltipProvider>
            <ConfidentialComputeControl serviceIndex={0} currentService={services[0] as ServiceType} />
          </TooltipProvider>
        </FormProvider>
      );
    };

    const user = userEvent.setup();
    const result = render(<TestWrapper />);

    return { ...result, user, form: await vi.waitFor(() => maybeForm), service };
  }
});

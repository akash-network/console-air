import { FormProvider, useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { CpuFormControl } from "./CpuFormControl";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildSDLService } from "@tests/seeders/sdlService";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(CpuFormControl.name, () => {
  it("shows the default option when the service names no architecture", async () => {
    await setup({});

    expect(screen.getByLabelText("CPU Architecture")).toHaveTextContent("Default (amd64)");
  });

  it("shows the architecture an imported SDL carried in", async () => {
    await setup({ arch: "arm64" });

    expect(screen.getByLabelText("CPU Architecture")).toHaveTextContent("arm64");
  });

  it("offers the default plus the two architectures an SDL may request", async () => {
    const { user } = await setup({});

    await user.click(screen.getByLabelText("CPU Architecture"));

    await vi.waitFor(() => {
      expect(screen.getByRole("option", { name: "Default (amd64)" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "amd64" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "arm64" })).toBeInTheDocument();
    });
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("writes the chosen architecture onto the profile and tracks the change", async () => {
    const { user, form, analyticsService } = await setup({});

    await user.click(screen.getByLabelText("CPU Architecture"));
    await user.click(await screen.findByRole("option", { name: "arm64" }));

    expect(form.getValues("services.0.profile.arch")).toBe("arm64");
    expect(analyticsService.track).toHaveBeenCalledWith("configure_cpu_arch_changed", { category: "sdl_builder", arch: "arm64" });
  });

  it("clears the architecture when the default is chosen again", async () => {
    const { user, form } = await setup({ arch: "arm64" });

    await user.click(screen.getByLabelText("CPU Architecture"));
    await user.click(await screen.findByRole("option", { name: "Default (amd64)" }));

    expect(form.getValues("services.0.profile.arch")).toBeUndefined();
  });

  it("hides the architecture select when asked to", async () => {
    await setup({ showArchitecture: false });

    expect(screen.queryByLabelText("CPU Architecture")).not.toBeInTheDocument();
  });

  async function setup(input: { arch?: "amd64" | "arm64"; showArchitecture?: boolean }) {
    const service = buildSDLService({
      profile: {
        cpu: 0.5,
        ...(input.arch ? { arch: input.arch } : {}),
        ram: 256,
        ramUnit: "Mi",
        storage: [{ size: 1, unit: "Gi", isPersistent: false }],
        hasGpu: false,
        gpu: 0
      }
    });
    const analyticsService = mock<AnalyticsService>();

    let maybeForm: ReturnType<typeof useForm<SdlBuilderFormValuesType>>;

    const TestWrapper = () => {
      const methods = useForm<SdlBuilderFormValuesType>({ defaultValues: { services: [service] } });
      maybeForm = methods;
      const services = methods.watch("services");

      return (
        <FormProvider {...methods}>
          <TooltipProvider>
            <CpuFormControl control={methods.control} serviceIndex={0} currentService={services[0] as ServiceType} showArchitecture={input.showArchitecture} />
          </TooltipProvider>
        </FormProvider>
      );
    };

    const user = userEvent.setup();
    const result = render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <TestWrapper />
      </TestContainerProvider>
    );

    return { ...result, user, form: await vi.waitFor(() => maybeForm), analyticsService };
  }
});

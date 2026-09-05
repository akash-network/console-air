"use client";
import type { ReactNode } from "react";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { MdSpeed } from "react-icons/md";
import {
  CustomTooltip,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { InfoCircle } from "iconoir-react";

import { useServices } from "@src/context/ServicesProvider";
import type { CpuArchType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { validationConfig } from "@src/utils/akash/units";
import { FormPaper } from "./FormPaper";

/** Stands in for "write no architecture at all", which a Select cannot express as an empty string. */
const DEFAULT_ARCH_OPTION = "default";

const ARCH_OPTIONS: readonly { value: CpuArchType | typeof DEFAULT_ARCH_OPTION; label: string }[] = [
  { value: DEFAULT_ARCH_OPTION, label: "Default (amd64)" },
  { value: "amd64", label: "amd64" },
  { value: "arm64", label: "arm64" }
];

type Props = {
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValuesType, any>;
  currentService: ServiceType;
  showArchitecture?: boolean;
};

export const CpuFormControl: React.FunctionComponent<Props> = ({ control, serviceIndex, showArchitecture = true }) => {
  const { analyticsService } = useServices();

  return (
    <FormField
      control={control}
      name={`services.${serviceIndex}.profile.cpu`}
      render={({ field, fieldState }) => (
        <FormPaper>
          <FormItem>
            <div className="flex items-center">
              <div className="flex items-center">
                <MdSpeed className="mr-2 text-2xl text-muted-foreground" />
                <strong className="text-sm">CPU</strong>

                <CustomTooltip
                  title={
                    <>
                      The amount of vCPU&apos;s required for this workload.
                      <br />
                      <br />
                      The maximum for a single instance is {validationConfig.maxCpuAmount} vCPU&apos;s.
                      <br />
                      <br />
                      The maximum total multiplied by the count of instances is 512 vCPU&apos;s.
                    </>
                  }
                >
                  <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                </CustomTooltip>
              </div>
              <Input
                type="number"
                color="secondary"
                error={!!fieldState.error}
                value={field.value || ""}
                onChange={event => field.onChange(parseFloat(event.target.value))}
                min={0.1}
                step={0.1}
                max={validationConfig.maxCpuAmount}
                inputClassName="ml-4 w-[100px]"
              />
            </div>

            <div className="pt-2">
              <Slider
                value={[field.value || 0]}
                min={0.1}
                max={validationConfig.maxCpuAmount}
                step={1}
                color="secondary"
                aria-label="CPU"
                onValueChange={newValue => field.onChange(newValue[0])}
              />
            </div>

            <FormMessage className={cn({ "pt-2": !!fieldState.error })} />

            {showArchitecture && (
              <div className="pt-4">
                <FormLabel htmlFor={`cpu-arch-${serviceIndex}`} className="mb-2 block">
                  CPU Architecture
                </FormLabel>
                <Controller
                  control={control}
                  name={`services.${serviceIndex}.profile.arch`}
                  render={({ field: archField }) => (
                    <Select
                      value={archField.value ?? DEFAULT_ARCH_OPTION}
                      onValueChange={value => {
                        archField.onChange(value === DEFAULT_ARCH_OPTION ? undefined : value);
                        analyticsService.track("configure_cpu_arch_changed", { category: "sdl_builder", arch: value });
                      }}
                    >
                      <SelectTrigger id={`cpu-arch-${serviceIndex}`} className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {ARCH_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
          </FormItem>
        </FormPaper>
      )}
    />
  );
};

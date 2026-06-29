"use client";
import { Controller, useFormContext } from "react-hook-form";
import {
  Alert,
  CheckboxWithLabel,
  CustomTooltip,
  FormLabel,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { ConfidentialComputeResources } from "@src/components/deployments/ConfidentialComputeResources";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import type { TeeType } from "@src/utils/confidentialCompute";
import { buildFormTeeCarveout, CONFIDENTIAL_COMPUTE_DOCS_URL, formatTeeTypeLabel } from "@src/utils/confidentialCompute";
import { FormPaper } from "../FormPaper";

const TEE_TYPE_OPTIONS: readonly TeeType[] = ["cpu", "cpu-gpu"];

type Props = {
  serviceIndex: number;
  currentService: ServiceType;
};

export const ConfidentialComputeControl: React.FunctionComponent<Props> = ({ serviceIndex, currentService }) => {
  const { control, setValue } = useFormContext<SdlBuilderFormValuesType>();

  const teeType = currentService.params?.tee;
  const isEnabled = !!teeType;
  const hasGpu = !!currentService.profile.hasGpu;
  // A cpu-gpu enclave needs GPU resources; surface the mismatch (e.g. GPU removed after picking cpu-gpu) without
  // rewriting the choice. The blocking validation + GPU coupling is CON-456.
  const gpuMismatch = teeType === "cpu-gpu" && !hasGpu;

  const setTeeType = (next: TeeType | undefined) => {
    // Write the whole params object so we never write through an undefined `params` parent.
    setValue(`services.${serviceIndex}.params`, { ...currentService.params, tee: next }, { shouldValidate: true, shouldDirty: true });
  };

  const carveout =
    isEnabled && teeType
      ? buildFormTeeCarveout({
          id: currentService.id ?? currentService.title,
          cpu: currentService.profile.cpu,
          ram: currentService.profile.ram,
          ramUnit: currentService.profile.ramUnit,
          count: currentService.count,
          gpu: currentService.profile.gpu,
          teeType
        })
      : undefined;

  return (
    <FormPaper>
      <div className="mb-2 flex items-center">
        <strong className="text-sm">Confidential Compute (TEE)</strong>
        <CustomTooltip
          title={
            <>
              Run this service inside a Trusted Execution Environment so its memory stays encrypted and attestable. Choose <strong>CPU</strong> for a CPU-only
              enclave or <strong>CPU + GPU</strong> for a CPU + GPU enclave (requires a GPU profile). The provider selects the underlying hardware platform and
              injects the attestation sidecar automatically.
              <br />
              <br />
              <a href={CONFIDENTIAL_COMPUTE_DOCS_URL} target="_blank" rel="noopener noreferrer">
                View Confidential Compute documentation.
              </a>
            </>
          }
        >
          <InfoCircle className="ml-2 text-xs text-muted-foreground" />
        </CustomTooltip>
      </div>

      <CheckboxWithLabel
        checked={isEnabled}
        onCheckedChange={state => {
          const enabled = state === "indeterminate" ? false : state;
          // Default to the type that matches the current GPU profile; clear the selection when disabled.
          setTeeType(enabled ? (hasGpu ? "cpu-gpu" : "cpu") : undefined);
        }}
        label="Enable Confidential Compute for this service"
      />

      {isEnabled && (
        <div className="mt-4 space-y-4">
          <div>
            <FormLabel htmlFor={`tee-type-${serviceIndex}`} className="mb-2 block">
              TEE type
            </FormLabel>
            <Controller
              control={control}
              name={`services.${serviceIndex}.params.tee`}
              render={({ field }) => (
                <Select value={field.value} onValueChange={value => field.onChange(value as TeeType)}>
                  <SelectTrigger id={`tee-type-${serviceIndex}`}>
                    <SelectValue placeholder="Select TEE type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {TEE_TYPE_OPTIONS.map(option => (
                        <SelectItem key={option} value={option} disabled={option === "cpu-gpu" && !hasGpu}>
                          {formatTeeTypeLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {!hasGpu && !gpuMismatch && <p className="mt-2 text-xs text-muted-foreground">CPU + GPU requires a GPU profile on this service.</p>}
          </div>

          {gpuMismatch && (
            <Alert variant="warning">
              CPU + GPU Confidential Compute requires a GPU profile on this service. Enable GPU above so providers with confidential-compute GPUs can bid.
            </Alert>
          )}

          {carveout && <ConfidentialComputeResources carveouts={[carveout]} />}
        </div>
      )}
    </FormPaper>
  );
};

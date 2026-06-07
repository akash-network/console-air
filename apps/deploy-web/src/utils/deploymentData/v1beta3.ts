import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Manifest as AkashManifest, SDLInput } from "@akashnetwork/chain-sdk/web";
import { generateManifestVersion } from "@akashnetwork/chain-sdk/web";
import type { HttpClient } from "@akashnetwork/http-sdk";
import yaml from "js-yaml";

import { browserEnvConfig } from "@src/config/browser-env.config";
import type { DepositParams } from "@src/types/deployment";
import { buildManifest, CustomValidationError, Manifest, ManifestVersion, parseSdlInput } from "./helpers";

export const ENDPOINT_NAME_VALIDATION_REGEX = /^[a-z]+[-_\da-z]+$/;
export const AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

export function getManifest(yamlJson: any, asString: boolean): AkashManifest {
  return Manifest(yamlJson, asString);
}

export async function getManifestVersion(yamlJson: any) {
  const version = await ManifestVersion(yamlJson);

  return Buffer.from(version).toString("base64");
}

const getDenomFromSdl = (groups: GroupSpec[]): string => {
  const denoms = groups.flatMap(g => g.resources).map(resource => resource.price?.denom);

  // TODO handle multiple denoms in an sdl? (different denom for each service?)
  return denoms.find(d => !!d)!;
};

export function replaceSdlDenom(yamlStr: string, denom: string): string {
  const sdlData = yaml.load(yamlStr) as SDLInput;
  const placementData = sdlData?.profiles?.placement || {};

  for (const [, placement] of Object.entries(placementData)) {
    const pricing = placement.pricing || {};
    for (const [, price] of Object.entries(pricing)) {
      if (price.denom) {
        (price as { denom: string }).denom = denom;
      }
    }
  }

  const result = yaml.dump(sdlData, {
    indent: 2,
    quotingType: '"',
    styles: {
      "!!null": "empty"
    }
  });

  return `---
${result}`;
}

export async function NewDeploymentData(
  chainApiHttpClient: HttpClient,
  yamlStr: string,
  dseq: string | null,
  fromAddress: string,
  deposit: number | DepositParams[] = browserEnvConfig.NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT
) {
  try {
    const sdlInput = parseSdlInput(yamlStr);
    const manifest = buildManifest(sdlInput);
    const groups = manifest.groupSpecs;
    const mani = manifest.groups;
    const denom = getDenomFromSdl(groups);
    const version = await generateManifestVersion(manifest.groups);
    const _deposit = (Array.isArray(deposit) && deposit.find(d => d.denom === denom)) || { denom, amount: deposit.toString() };

    let finalDseq: string = dseq || "";
    if (!finalDseq) {
      const response = await chainApiHttpClient.get("/cosmos/base/tendermint/v1beta1/blocks/latest");
      const height = response?.data?.block?.header?.height;
      if (height === undefined || height === null) {
        throw new CustomValidationError("Unable to fetch the latest block height from the chain. Please retry or switch RPC node in Settings.");
      }
      finalDseq = String(height);
    }

    return {
      sdl: sdlInput,
      manifest: mani,
      groups: groups,
      deploymentId: {
        owner: fromAddress,
        dseq: finalDseq
      },
      orderId: [],
      leaseId: [],
      hash: version,
      deposit: _deposit
    };
  } catch (e: any) {
    const error = new CustomValidationError(e.message);
    error.stack = e.stack;
    throw error;
  }
}

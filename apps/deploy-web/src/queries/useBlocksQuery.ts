import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { Block } from "@src/types";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

// The /cosmos/base/tendermint/v1beta1/blocks/{id} endpoint returns
// `{ block_id, block: { header: { height, time, ... } } }` when the chain is
// reachable, but a degraded chain proxy hop can return an empty / partial /
// non-JSON body that still resolves to a truthy value — in which case the
// nested deref throws "Cannot read properties of undefined (reading 'header')"
// and brings down the whole page. These helpers walk the path safely and
// return null when any segment is missing, so consumers can early-return.
type RawBlock = { block?: { header?: { height?: string | number; time?: string } } } | null | undefined;

export function getBlockHeight(block: unknown): number | null {
  const height = (block as RawBlock)?.block?.header?.height;
  if (height === undefined || height === null) return null;
  const parsed = typeof height === "number" ? height : parseInt(height, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getBlockTime(block: unknown): Date | null {
  const time = (block as RawBlock)?.block?.header?.time;
  if (!time) return null;
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function useBlock(id: string, options: Omit<UseQueryOptions<Block, Error, any, QueryKey>, "queryKey" | "queryFn"> = {}) {
  const { chainApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getBlockKey(id),
    queryFn: () => chainApiHttpClient.get(ApiUrlService.block("", id)).then(response => response.data),
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...options,
    enabled: options.enabled !== false && !!chainApiHttpClient.defaults.baseURL && !chainApiHttpClient.isFallbackEnabled
  });
}

export function useBlocks(limit: number, options?: Omit<UseQueryOptions<Block[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  const { publicConsoleApiHttpClient } = useServices();
  return useQuery<Block[], Error>({
    queryKey: QueryKeys.getBlocksKey(limit),
    queryFn: () => publicConsoleApiHttpClient.get(ApiUrlService.blocks(limit)).then(response => response.data),
    ...options
  });
}

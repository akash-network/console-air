import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ApiUrlService } from "@src/utils/apiUtils";
import { MAX_PROVIDERS_PER_ADDRESS_LOOKUP, useProvidersByAddress } from "./useProvidersQuery";

import { setupQuery } from "@tests/unit/query-client";

describe(useProvidersByAddress.name, () => {
  it("looks providers up by their sorted, deduplicated addresses", async () => {
    const { result, publicConsoleApiHttpClient } = setup({ addresses: ["akash1bbb", "akash1aaa", "akash1bbb"], providers: [{ owner: "akash1aaa" }] });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(publicConsoleApiHttpClient.get).toHaveBeenCalledWith(ApiUrlService.providerList(), { params: { addresses: "akash1aaa,akash1bbb" } });
    expect(result.current.data).toEqual([{ owner: "akash1aaa" }]);
  });

  it("caps a lookup at the api's address limit", async () => {
    const addresses = Array.from({ length: MAX_PROVIDERS_PER_ADDRESS_LOOKUP + 5 }, (_, index) => `akash1${String(index).padStart(3, "0")}`);
    const { publicConsoleApiHttpClient } = setup({ addresses });

    await vi.waitFor(() => {
      expect(publicConsoleApiHttpClient.get).toHaveBeenCalledWith(ApiUrlService.providerList(), {
        params: { addresses: addresses.slice(0, MAX_PROVIDERS_PER_ADDRESS_LOOKUP).join(",") }
      });
    });
  });

  it("does not look anything up without an address", () => {
    const { result, publicConsoleApiHttpClient } = setup({ addresses: [] });

    expect(result.current.fetchStatus).toBe("idle");
    expect(publicConsoleApiHttpClient.get).not.toHaveBeenCalled();
  });

  function setup(input: { addresses: string[]; providers?: Array<{ owner: string }> }) {
    const publicConsoleApiHttpClient = mock<AxiosInstance>();
    publicConsoleApiHttpClient.get.mockResolvedValue({ data: input.providers ?? [] });
    const view = setupQuery(() => useProvidersByAddress(input.addresses), {
      services: { publicConsoleApiHttpClient: () => publicConsoleApiHttpClient }
    });
    return { ...view, publicConsoleApiHttpClient };
  }
});

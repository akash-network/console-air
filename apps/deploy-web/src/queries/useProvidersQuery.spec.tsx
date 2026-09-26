import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ApiUrlService } from "@src/utils/apiUtils";
import { useProvidersByAddress } from "./useProvidersQuery";

import { setupQuery } from "@tests/unit/query-client";

describe(useProvidersByAddress.name, () => {
  it("looks every distinct address up and merges the answers", async () => {
    const { result, publicConsoleApiHttpClient } = setup({ addresses: ["akash1bbb", "akash1aaa", "akash1bbb"] });

    await vi.waitFor(() => {
      expect(result.current).toEqual(expect.arrayContaining([{ owner: "akash1aaa" }, { owner: "akash1bbb" }]));
    });
    expect(publicConsoleApiHttpClient.get).toHaveBeenCalledTimes(2);
    expect(publicConsoleApiHttpClient.get).toHaveBeenCalledWith(ApiUrlService.providerList(), { params: { addresses: "akash1aaa" } });
    expect(publicConsoleApiHttpClient.get).toHaveBeenCalledWith(ApiUrlService.providerList(), { params: { addresses: "akash1bbb" } });
  });

  it("looks up more addresses than the api accepts in a single lookup", async () => {
    const addresses = Array.from({ length: 25 }, (_, index) => `akash1${String(index).padStart(3, "0")}`);
    const { result } = setup({ addresses });

    await vi.waitFor(() => {
      expect(result.current.map(provider => provider.owner).sort()).toEqual(addresses);
    });
  });

  it("keeps an answered address when another address is added", async () => {
    const { result, publicConsoleApiHttpClient, lookUp } = setup({ addresses: ["akash1aaa"] });
    await vi.waitFor(() => {
      expect(result.current).toEqual([{ owner: "akash1aaa" }]);
    });

    lookUp(["akash1aaa", "akash1bbb"]);

    await vi.waitFor(() => {
      expect(result.current).toEqual(expect.arrayContaining([{ owner: "akash1aaa" }, { owner: "akash1bbb" }]));
    });
    expect(publicConsoleApiHttpClient.get).toHaveBeenCalledTimes(2);
  });

  it("does not look anything up without an address", () => {
    const { result, publicConsoleApiHttpClient } = setup({ addresses: [] });

    expect(result.current).toEqual([]);
    expect(publicConsoleApiHttpClient.get).not.toHaveBeenCalled();
  });

  function setup(input: { addresses: string[] }) {
    let addresses = input.addresses;
    const publicConsoleApiHttpClient = mock<AxiosInstance>();
    publicConsoleApiHttpClient.get.mockImplementation(async (_url, config) => ({ data: [{ owner: config?.params?.addresses }] }));
    const view = setupQuery(() => useProvidersByAddress(addresses), {
      services: { publicConsoleApiHttpClient: () => publicConsoleApiHttpClient }
    });
    const lookUp = (nextAddresses: string[]) => {
      addresses = nextAddresses;
      view.rerender();
    };
    return { ...view, publicConsoleApiHttpClient, lookUp };
  }
});

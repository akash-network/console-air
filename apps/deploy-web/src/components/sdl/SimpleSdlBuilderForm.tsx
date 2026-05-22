"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, Button, Form, Snackbar, Spinner } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { NavArrowRight } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";

import { SimpleServiceFormControl } from "@src/components/sdl/SimpleServiceFormControl";
import { USER_TEMPLATE_CODE } from "@src/config/deploy.config";
import { useServices } from "@src/context/ServicesProvider";
import useFormPersist from "@src/hooks/useFormPersist";
import { useSdlServiceManager } from "@src/hooks/useSdlServiceManager/useSdlServiceManager";
import { useGpuModels } from "@src/queries/useGpuQuery";
import sdlStore from "@src/store/sdlStore";
import type { ITemplate, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { RouteStep } from "@src/types/route-steps.type";
import { memoryUnits, storageUnits } from "@src/utils/akash/units";
import { getDefaultService } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { UrlService } from "@src/utils/urlUtils";
import { ImportSdlModal } from "./ImportSdlModal";
import { PreviewSdl } from "./PreviewSdl";

export const SimpleSDLBuilderForm: React.FunctionComponent = () => {
  const { consoleApiHttpClient, analyticsService } = useServices();
  const [error, setError] = useState(null);
  const [templateMetadata, setTemplateMetadata] = useState<ITemplate | null>(null);
  const [serviceCollapsed, setServiceCollapsed] = useState<number[]>([]);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);


  const [isImportingSdl, setIsImportingSdl] = useState(false);
  const [isPreviewingSdl, setIsPreviewingSdl] = useState(false);
  const [sdlResult, setSdlResult] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const [sdlBuilderSdl, setSdlBuilderSdl] = useAtom(sdlStore.sdlBuilderSdl);
  const { data: gpuModels } = useGpuModels();
  const { enqueueSnackbar } = useSnackbar();
  const defaultServices = useMemo(() => ({ services: [getDefaultService()] }), []);
  const form = useForm<SdlBuilderFormValuesType>({
    resolver: zodResolver(SdlBuilderFormValuesSchema),
    defaultValues: defaultServices
  });
  const { handleSubmit, reset, control, trigger, watch, setValue } = form;
  const { clear: clearFormStorage } = useFormPersist("sdl-builder-form", {
    watch,
    setValue,
    defaultValues: defaultServices,
    storage: typeof window === "undefined" ? undefined : window.localStorage
  });
  const { services: _services } = watch();
  const serviceManager = useSdlServiceManager({ control });
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateQueryId = searchParams?.get("id");

  useEffect(() => {
    if (sdlBuilderSdl && sdlBuilderSdl.services) {
      setValue("services", sdlBuilderSdl.services);
    }
  }, []);

  // Load the template from query string on mount
  useEffect(() => {
    if ((templateQueryId && !templateMetadata) || (templateQueryId && templateMetadata?.id !== templateQueryId)) {
      // Load user template
      loadTemplate(templateQueryId as string);
    } else if (!templateQueryId && templateMetadata) {
      // Navigating back to plain SDL builder - clear storage and reset to defaults
      setTemplateMetadata(null);
      setSdlBuilderSdl(null);
      clearFormStorage();
      setServiceCollapsed([]);
      reset();
    }
  }, [templateQueryId, templateMetadata, clearFormStorage, setSdlBuilderSdl, reset]);

  useEffect(() => {
    if (_services) {
      setSdlBuilderSdl({ services: _services as ServiceType[] });
    }
  }, [_services]);

  const loadTemplate = async (id: string) => {
    try {
      setIsLoadingTemplate(true);
      const response = await consoleApiHttpClient.get(`/v1/user/template/${id}`);
      const template: ITemplate = response.data;

      const services = importSimpleSdl(template.sdl);

      setIsLoadingTemplate(false);

      reset();
      setValue("services", services as ServiceType[]);
      setServiceCollapsed(services.map((x, i) => i));
      setTemplateMetadata(template);
    } catch (error) {
      // Console Air's `/api/proxy/{network}` route forwards to the upstream Console API
      // anonymously — saved user templates require an authenticated session that this
      // build doesn't carry, so the upstream replies 401/403/404. Surface a clear message
      // (and keep the existing form state intact) instead of a vague "Error fetching template".
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const isUnavailable = status === 401 || status === 403 || status === 404;
      enqueueSnackbar(
        <Snackbar
          title={isUnavailable ? "Saved templates aren't available in Console Air." : "Error fetching template."}
          subTitle={isUnavailable ? "Use the YAML or Upload tab to bring your own SDL." : undefined}
          iconVariant="error"
        />,
        { variant: "error" }
      );

      setIsLoadingTemplate(false);
    }
  };

  const onSubmit = async (data: SdlBuilderFormValuesType) => {
    setError(null);

    try {
      const sdl = generateSdl(data.services);

      setDeploySdl({
        title: "",
        category: "",
        code: USER_TEMPLATE_CODE,
        description: "",
        content: sdl
      });

      router.push(UrlService.newDeployment({ step: RouteStep.editDeployment }));

      analyticsService.track("deploy_sdl", {
        category: "sdl_builder",
        label: "Deploy SDL from create page"
      });
    } catch (error: any) {
      setError(error.message);
    }
  };

  const onPreviewSdlClick = () => {
    setError(null);

    try {
      const sdl = generateSdl(_services as ServiceType[]);
      setSdlResult(sdl);
      setIsPreviewingSdl(true);

      analyticsService.track("preview_sdl", {
        category: "sdl_builder",
        label: "Preview SDL from create page"
      });
    } catch (error: any) {
      setError(error.message);
    }
  };

  return (
    <>
      {isImportingSdl && <ImportSdlModal onClose={() => setIsImportingSdl(false)} setValue={setValue} />}
      {isPreviewingSdl && <PreviewSdl onClose={() => setIsPreviewingSdl(false)} sdl={sdlResult || ""} />}

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
          {templateMetadata && (
            <div className="flex items-center">
              <p>
                {templateMetadata.title}
                {templateMetadata.username && <>&nbsp;by&nbsp;<span>{templateMetadata.username}</span></>}
              </p>

              <div className="ml-6">
                <Link
                  href={UrlService.template(templateQueryId as string)}
                  className="inline-flex cursor-pointer items-center"
                  onClick={() => {
                    analyticsService.track("click_view_template", {
                      category: "sdl_builder",
                      label: "Click on view SDL template"
                    });
                  }}
                >
                  View template <NavArrowRight className="ml-2 text-sm" />
                </Link>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-6">
            <div className="flex items-center space-x-6">
              <Button color="secondary" variant="default" type="submit" size="sm">
                Deploy
              </Button>

              <Button color="secondary" variant="text" onClick={onPreviewSdlClick} type="button" size="sm">
                Preview
              </Button>

              <Button color="secondary" variant="text" onClick={() => setIsImportingSdl(true)} type="button" size="sm">
                Import
              </Button>

              <Button
                variant="text"
                size="sm"
                type="button"
                onClick={() => {
                  analyticsService.track("reset_sdl", {
                    category: "sdl_builder",
                    label: "Reset SDL"
                  });

                  setValue("services", defaultServices.services);
                }}
              >
                Reset
              </Button>

              {isLoadingTemplate && (
                <div>
                  <Spinner size="small" />
                </div>
              )}
            </div>



          </div>

          {_services?.map((service, serviceIndex) => (
            <SimpleServiceFormControl
              key={service.id}
              serviceIndex={serviceIndex}
              _services={_services as ServiceType[]}
              setValue={setValue}
              control={control}
              trigger={trigger}
              onRemoveService={serviceManager.remove}
              serviceCollapsed={serviceCollapsed}
              setServiceCollapsed={setServiceCollapsed}
              gpuModels={gpuModels}
            />
          ))}

          {error && (
            <Alert variant="destructive" className="mt-6">
              {error}
            </Alert>
          )}

          <div className="flex items-center justify-end pt-6">
            <div>
              <Button color="secondary" variant="default" onClick={serviceManager.add} type="button" size="sm">
                Add Service
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
};

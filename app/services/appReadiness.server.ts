import type { SetupStatus } from "~/services/metafieldSetup";
import { createMetafieldSetupService } from "~/services/metafieldSetup";
import {
  getStorageConfigForDisplay,
  shouldHardBlockUpload,
  shouldSoftWarnUpload,
} from "~/services/storageConfig.server";

type AdminClient = {
  graphql: (query: string, options?: Record<string, any>) => Promise<Response>;
};

export type AppReadiness = {
  setupStatus: SetupStatus;
  storageConfig: Awaited<ReturnType<typeof getStorageConfigForDisplay>>;
  needsProfile: boolean;
  needsCoreSetup: boolean;
  needsStorage: boolean;
  hasStorageIssue: boolean;
  coreReady: boolean;
  isReady: boolean;
  nextStep: "profile" | "catalog" | "storage" | "ready";
  onboardingRoute: string;
  settingsRoute: string;
};

export async function getAppReadiness(
  session: any,
  admin: AdminClient,
): Promise<AppReadiness> {
  const setupService = createMetafieldSetupService(session, admin);
  const [setupStatus, storageConfig] = await Promise.all([
    setupService.checkSetupStatus(),
    getStorageConfigForDisplay(session.shop),
  ]);

  const needsProfile = setupStatus.producers.existing < setupStatus.producers.required;
  const needsCoreSetup = !setupStatus.isComplete;
  const needsStorage = shouldHardBlockUpload(storageConfig);
  const hasStorageIssue = shouldSoftWarnUpload(storageConfig);
  const coreReady = setupStatus.isComplete;
  const isReady = coreReady && !needsStorage;

  let nextStep: AppReadiness["nextStep"] = "ready";
  if (needsProfile) {
    nextStep = "profile";
  } else if (needsCoreSetup) {
    nextStep = "catalog";
  } else if (needsStorage) {
    nextStep = "storage";
  }

  return {
    setupStatus,
    storageConfig,
    needsProfile,
    needsCoreSetup,
    needsStorage,
    hasStorageIssue,
    coreReady,
    isReady,
    nextStep,
    onboardingRoute: "/app",
    settingsRoute: "/app/settings",
  };
}

import { ComfyApi } from "../src/client";
import { describe } from "bun:test";

export const TEST_TIMEOUT = 60_000;
export const WORKFLOW_TIMEOUT = 120_000;

export const getTestHost = (): string => process.env.COMFYUI_HOST || "";

export const skipIfNoHost = () => describe.skipIf(!getTestHost());

export const createTestClient = (clientId?: string) => new ComfyApi(getTestHost(), clientId);

export const waitForClient = async (client: ComfyApi) => {
  return client.init(5, 2000).waitForReady();
};

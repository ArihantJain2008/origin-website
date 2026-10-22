export function isUuid(value: unknown): boolean;

export function isValidOfficialRelease(version: string, value: string): boolean;

export function isValidOfficialAsset(version: string, asset: unknown): boolean;

export function isWholeInstallerTransfer(
  status: number,
  contentRange: string | null,
  bytes: number,
  contentLength: number,
): boolean;

export type InstallerFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function fetchOfficialInstaller(
  value: string | URL,
  init: RequestInit,
  fetcher?: InstallerFetcher,
): Promise<Response>;

export interface DrainResponse {
  destroyed?: boolean;
  writableFinished?: boolean;
  on(event: "drain" | "close", listener: (...args: unknown[]) => void): unknown;
}

export function waitForDrainOrClose(
  response: DrainResponse,
  isClosed?: () => boolean,
): Promise<boolean>;

import type {
  HealthConnectAccess,
  HealthConnectGateway,
} from '@/data/healthconnect/HealthConnectGateway';

/**
 * Asks Health Connect for access. A grant is followed by a full re-import, not a plain sync:
 * whether the history permission was newly granted cannot be read reliably, so every grant
 * imports everything. Resolves with the access the request produced.
 */
export async function requestAccessAndImport(
  gateway: Pick<HealthConnectGateway, 'requestAccess'>,
  sync: { resyncHealthConnect(): Promise<unknown> },
): Promise<HealthConnectAccess> {
  const access = await gateway.requestAccess();
  if (access.readAll) void sync.resyncHealthConnect();
  return access;
}

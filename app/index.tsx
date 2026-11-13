import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useContainer } from '@/bootstrap/ContainerContext';
import { SECRET_KEYS } from '@/data/secrets/SecretStore';
import type { SyncState } from '@/data/sync/SyncStateRepository';
import { LB_TO_KG } from '@/data/lyfta/parseWorkouts';
import type { Workout, WeightUnit } from '@/domain/workouts/types';

const RECENT_COUNT = 5;

interface Snapshot {
  hasKey: boolean;
  unit: WeightUnit | null;
  count: number;
  syncState: SyncState;
  recent: Workout[];
}

function countSets(workout: Workout): number {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

/** Formats a stored kilogram value as `<kg> kg (<lb> lb)` so it can be compared with Lyfta. */
function formatKgAndLb(kg: number | null): string {
  if (kg === null) return 'none';
  return `${kg.toFixed(1)} kg (${(kg / LB_TO_KG).toFixed(1)} lb)`;
}

/** Temporary developer screen that exercises the Lyfta pipeline; Plan 2 replaces it. */
export default function Index() {
  const { workouts, syncState, settings, secrets, sync } = useContainer();
  const { running, lastResult, dataVersion } = useSyncExternalStore(
    sync.subscribe,
    sync.getSnapshot,
  );
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Snapshot> => {
    const [key, unitSetting, count, state, recent] = await Promise.all([
      secrets.get(SECRET_KEYS.lyftaApiKey),
      settings.get('lyfta.weightUnit'),
      workouts.count(),
      syncState.get('lyfta'),
      workouts.list({ limit: RECENT_COUNT }),
    ]);
    return {
      hasKey: key !== null && key !== '',
      unit: unitSetting === 'lb' || unitSetting === 'kg' ? unitSetting : null,
      count,
      syncState: state,
      recent,
    };
  }, [secrets, settings, workouts, syncState]);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await load());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load data');
    }
  }, [load]);

  // `dataVersion` changes after every sync, re-sync and wipe, so the stored data is read again.
  useEffect(() => {
    let cancelled = false;
    load().then(
      (loaded) => {
        if (!cancelled) setSnapshot(loaded);
      },
      (error: unknown) => {
        if (!cancelled)
          setLoadError(error instanceof Error ? error.message : 'Could not load data');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load, dataVersion]);

  /** Runs a button handler, showing only the error message on screen if it fails. */
  const runAction = async (action: () => Promise<void>) => {
    try {
      await action();
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Action failed');
    }
  };

  const saveKey = () =>
    runAction(async () => {
      const trimmed = keyInput.trim();
      if (trimmed === '') return;
      // Clear first so the key never stays in the field, even if storing it fails.
      setKeyInput('');
      await secrets.set(SECRET_KEYS.lyftaApiKey, trimmed);
      await refresh();
    });

  const removeKey = () =>
    runAction(async () => {
      await secrets.delete(SECRET_KEYS.lyftaApiKey);
      await refresh();
    });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Health Hub (developer)</Text>

        <Text style={styles.section}>Lyfta key</Text>
        <Text testID="key-status">{snapshot?.hasKey === true ? 'Key saved' : 'No key'}</Text>
        <TextInput
          style={styles.input}
          value={keyInput}
          onChangeText={setKeyInput}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Paste Lyfta API key"
        />
        <View style={styles.row}>
          <Button title="Save" onPress={() => void saveKey()} />
          <Button title="Remove" onPress={() => void removeKey()} />
        </View>

        {/* Detected from Lyfta on the first sync; not user-editable. */}
        <Text style={styles.section}>Lyfta unit: {snapshot?.unit ?? 'not detected yet'}</Text>

        <Text style={styles.section}>Sync</Text>
        <View style={styles.row}>
          {/* `sync` never rejects, and a second tap while one is in flight shares that run. */}
          <Button title="Sync" disabled={running} onPress={() => void sync.run()} />
          {/* A full re-backfill: forgets sync progress and retries skipped workouts. */}
          <Button title="Re-sync" disabled={running} onPress={() => void sync.resync()} />
        </View>
        <Text testID="sync-status">
          {running
            ? 'Syncing...'
            : lastResult === null
              ? 'Not run yet'
              : `Workouts: ${lastResult.workouts.status} | Schedule: ${lastResult.schedule.status}`}
        </Text>
        <Text testID="sync-result">{lastResult === null ? '' : JSON.stringify(lastResult)}</Text>

        <Text style={styles.section}>Stored data</Text>
        <Text testID="workout-count">Workouts: {snapshot?.count ?? '-'}</Text>
        <Text>Last success: {snapshot?.syncState.lastSuccessAt ?? 'never'}</Text>
        <Text>Last error: {snapshot?.syncState.lastError ?? 'none'}</Text>
        {loadError !== null && <Text>Load error: {loadError}</Text>}
        {actionError !== null && <Text>Error: {actionError}</Text>}

        {/* TEMPORARY (Plan 2 replaces this screen): compare stored weights with the Lyfta app once. */}
        <Text style={styles.section}>Weight check (newest workout, first set)</Text>
        <Text testID="weight-check">
          First set: {formatKgAndLb(snapshot?.recent[0]?.exercises[0]?.sets[0]?.weightKg ?? null)}
        </Text>

        <Text style={styles.section}>Newest {RECENT_COUNT}</Text>
        {snapshot?.recent.map((workout) => (
          <Text key={workout.lyftaId}>
            {workout.performedAt.slice(0, 10)} | {workout.title} | {workout.exercises.length} ex |{' '}
            {countSets(workout)} sets
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  heading: { fontSize: 20, fontWeight: '600' },
  section: { marginTop: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#888', padding: 8 },
  row: { flexDirection: 'row', gap: 16 },
});

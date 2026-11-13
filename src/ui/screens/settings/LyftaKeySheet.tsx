import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useContainer } from '@/bootstrap/ContainerContext';
import { SECRET_KEYS } from '@/data/secrets/SecretStore';
import { AppText } from '@/ui/components/AppText';
import { BottomSheet } from '@/ui/components/BottomSheet';
import { Button } from '@/ui/components/Button';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { RADIUS, SPACE, TOUCH_MIN } from '@/ui/theme/tokens';

/** Saves or removes the Lyfta key. The key is never shown back, not even masked. */
export function LyftaKeySheet({
  hasKey,
  onClose,
}: {
  hasKey: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const { secrets, sync } = useContainer();
  const { colors } = useTheme();
  const [value, setValue] = useState('');
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    const key = value.trim();
    setValue('');
    try {
      await secrets.set(SECRET_KEYS.lyftaApiKey, key);
    } catch {
      setError("Couldn't save the key");
      return;
    }
    onClose();
    void sync.run();
  }

  async function remove(): Promise<void> {
    try {
      await secrets.delete(SECRET_KEYS.lyftaApiKey);
    } catch {
      setError("Couldn't remove the key");
      return;
    }
    onClose();
    void sync.run();
  }

  return (
    <BottomSheet open onClose={onClose} title="Lyfta key">
      <View style={{ gap: SPACE.stack }}>
        <AppText variant="body" color="muted">
          {hasKey
            ? 'A key is saved. Paste a new one to replace it.'
            : 'Paste your Lyfta API key. It stays in secure storage on this phone.'}
        </AppText>
        <TextInput
          value={value}
          onChangeText={setValue}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          importantForAutofill="no"
          placeholder="Lyfta API key"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Lyfta API key"
          style={{
            minHeight: TOUCH_MIN,
            paddingHorizontal: SPACE.card,
            borderRadius: RADIUS.chip,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.card,
            color: colors.ink,
            fontFamily: 'Geist',
            fontSize: 16,
          }}
        />
        {error === null ? null : (
          <AppText variant="caption" color="statusHigh">
            {error}
          </AppText>
        )}
        <Button
          label="Save key"
          variant="primary"
          disabled={value.trim() === ''}
          onPress={() => void save()}
        />
        {!hasKey ? null : confirmingRemove ? (
          <View style={{ gap: SPACE.gap }}>
            <AppText variant="body" color="muted">
              Remove the key? Syncing stops until you add one.
            </AppText>
            <Button label="Remove key" variant="destructive" onPress={() => void remove()} />
            <Button label="Keep key" variant="plain" onPress={() => setConfirmingRemove(false)} />
          </View>
        ) : (
          <Button
            label="Remove key"
            variant="destructive"
            onPress={() => setConfirmingRemove(true)}
          />
        )}
      </View>
    </BottomSheet>
  );
}

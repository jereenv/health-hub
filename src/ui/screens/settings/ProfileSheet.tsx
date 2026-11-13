import { useState } from 'react';
import { TextInput, View } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';

import { useContainer } from '@/bootstrap/ContainerContext';
import type { Profile, ProfileError } from '@/domain/profile/profile';
import { localDateKey } from '@/domain/time/localDate';
import type { WeightUnit } from '@/domain/workouts/types';
import { AppText } from '@/ui/components/AppText';
import { BottomSheet } from '@/ui/components/BottomSheet';
import { Button } from '@/ui/components/Button';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { RADIUS, SPACE, TOUCH_MIN } from '@/ui/theme/tokens';

import { formToProfileInput, profileToForm } from './profileForm';
import type { ProfileForm } from './profileForm';

const SEX_OPTIONS = [
  { value: 'unset', label: 'Not set' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
] as const;
const BMI_OPTIONS = [
  { value: 'who', label: 'WHO standard' },
  { value: 'who_asian', label: 'WHO Asian' },
] as const;

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType: KeyboardTypeOptions;
  error?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="label" color="muted">
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCorrect={false}
        accessibilityLabel={label}
        style={{
          minHeight: TOUCH_MIN,
          paddingHorizontal: SPACE.card,
          borderRadius: RADIUS.chip,
          borderWidth: 1,
          borderColor: error === undefined ? colors.line : colors.statusHigh,
          backgroundColor: colors.card,
          color: colors.ink,
          fontFamily: 'Geist',
          fontSize: 16,
          fontVariant: ['tabular-nums'],
        }}
      />
      {error === undefined ? null : (
        <AppText variant="caption" color="statusHigh">
          {error}
        </AppText>
      )}
    </View>
  );
}

export function ProfileSheet({
  profile,
  unit,
  onSaved,
  onClose,
}: {
  profile: Profile | null;
  unit: WeightUnit;
  onSaved: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const container = useContainer();
  const [form, setForm] = useState<ProfileForm>(() => profileToForm(profile, unit));
  const [errors, setErrors] = useState<ProfileError[]>([]);
  const [failed, setFailed] = useState(false);
  const patch = (change: Partial<ProfileForm>): void => setForm((old) => ({ ...old, ...change }));

  async function save(): Promise<void> {
    const now = new Date();
    const result = formToProfileInput(form, unit, localDateKey(now), profile);
    setErrors(result.errors);
    if (result.errors.length > 0) return;
    try {
      await container.profile.save(result.input, now.toISOString());
    } catch {
      setFailed(true);
      return;
    }
    onSaved();
    onClose();
  }

  const has = (error: ProfileError): boolean => errors.includes(error);
  return (
    <BottomSheet open onClose={onClose} title="Profile">
      <View style={{ gap: SPACE.stack }}>
        <Field
          label="Height (cm)"
          value={form.height}
          onChangeText={(height) => patch({ height })}
          keyboardType="numeric"
          error={has('height') ? 'Enter a height between 100 and 250 cm' : undefined}
        />
        <Field
          label="Birth date (YYYY-MM-DD)"
          value={form.birthDate}
          onChangeText={(birthDate) => patch({ birthDate })}
          keyboardType="numbers-and-punctuation"
          error={has('birthDate') ? 'Enter a date like 1995-03-12, aged 13 to 100' : undefined}
        />
        <Field
          label={`Goal weight (${unit})`}
          value={form.goalWeight}
          onChangeText={(goalWeight) => patch({ goalWeight })}
          keyboardType="numeric"
          error={has('goalWeight') ? 'Enter a goal between 30 and 300 kg' : undefined}
        />
        <SegmentedControl
          options={SEX_OPTIONS}
          value={form.sex ?? 'unset'}
          onChange={(sex) => patch({ sex: sex === 'unset' ? null : sex })}
          accessibilityLabel="Sex"
        />
        <SegmentedControl
          options={BMI_OPTIONS}
          value={form.bmiCutoffs}
          onChange={(bmiCutoffs) => patch({ bmiCutoffs })}
          accessibilityLabel="BMI ranges"
        />
        {failed ? (
          <AppText variant="caption" color="statusHigh">
            Couldn&apos;t save the profile
          </AppText>
        ) : null}
        <Button label="Save profile" variant="primary" onPress={() => void save()} />
      </View>
    </BottomSheet>
  );
}

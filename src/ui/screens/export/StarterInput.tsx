import { TextInput } from 'react-native';

import { useTheme } from '@/ui/theme/ThemeProvider';

export function StarterInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (text: string) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      accessibilityLabel="Start with a question"
      autoCorrect
      returnKeyType="done"
      style={{
        height: 52,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.line,
        color: colors.ink,
        fontFamily: 'Geist',
        fontSize: 15,
      }}
    />
  );
}

import { Stack } from 'expo-router';

import { ContainerProvider } from '@/bootstrap/ContainerContext';

export default function RootLayout() {
  return (
    <ContainerProvider>
      <Stack />
    </ContainerProvider>
  );
}

// Plain-Node check of the static Expo config; nothing here touches a device.
type PluginEntry = string | [string, Record<string, unknown>];

const appConfig = require('../../app.json') as {
  expo: { plugins: PluginEntry[]; android: { permissions: string[] } };
};

describe('app.json', () => {
  test('registers the BLE plugin with neverForLocation', () => {
    const entry = appConfig.expo.plugins.find(
      (plugin): plugin is [string, Record<string, unknown>] =>
        Array.isArray(plugin) && plugin[0] === 'react-native-ble-manager',
    );
    expect(entry).toBeDefined();
    expect(entry?.[1].neverForLocation).toBe(true);
    expect(entry?.[1].isBleRequired).toBe(false);
  });

  test('requests no location permission', () => {
    const permissions = appConfig.expo.android.permissions;
    expect(permissions).not.toContain('android.permission.ACCESS_FINE_LOCATION');
    expect(permissions).not.toContain('android.permission.ACCESS_COARSE_LOCATION');
    expect(permissions).not.toContain('android.permission.ACCESS_BACKGROUND_LOCATION');
  });

  test('keeps the Health Connect permissions', () => {
    expect(appConfig.expo.android.permissions).toContain('android.permission.health.READ_WEIGHT');
  });
});

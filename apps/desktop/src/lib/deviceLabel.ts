export function getDefaultDeviceLabel(): string {
  if (typeof navigator === 'undefined') {
    return 'My Desktop';
  }

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };
  const platform = `${navigatorWithUserAgentData.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent}`.toLowerCase();

  if (platform.includes('mac')) {
    return 'My Mac';
  }

  if (platform.includes('linux')) {
    return 'My Linux PC';
  }

  return 'My Windows PC';
}

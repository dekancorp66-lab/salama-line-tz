import { useCallback } from 'react';
import { useNavigationContainerRef } from 'expo-router';
import { buildNeutralResetAction } from '../navigation/quickExit';
import { useSafetyStore } from '../store/safetyStore';

export function useQuickExit() {
  const navigationRef = useNavigationContainerRef();
  const quickExitActive = useSafetyStore((state) => state.quickExitActive);

  const exit = useCallback(() => {
    // Set state first so the root navigator drops sensitive screens immediately.
    useSafetyStore.getState().triggerQuickExit();

    const action = buildNeutralResetAction();
    try {
      if (navigationRef.isReady()) {
        navigationRef.reset(action as never);
      }
    } catch {
      // The conditional root navigator is the authoritative fallback when a
      // reset cannot be applied (for example during the first render).
    }
  }, [navigationRef]);

  const returnToApp = useCallback(() => {
    useSafetyStore.getState().resetQuickExit();
  }, []);

  return { exit, returnToApp, quickExitActive };
}

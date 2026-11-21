import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { NEUTRAL_HREF, RETURN_HREF } from '../navigation/quickExit';
import { useSafetyStore } from '../store/safetyStore';

export function useQuickExit() {
  const router = useRouter();
  const quickExitActive = useSafetyStore((state) => state.quickExitActive);

  const exit = useCallback(() => {
    // Set state first so the conditional root navigator drops sensitive screens.
    useSafetyStore.getState().triggerQuickExit();

    // Replace the current root route instead of dispatching a partial RESET.
    // Expo Router/React Navigation now require a complete RESET state, and a
    // replace removes nested sensitive history with it.
    router.replace(NEUTRAL_HREF as never);
  }, [router]);

  const returnToApp = useCallback(() => {
    // Restore the normal navigator first, then leave the neutral screen without
    // pushing it back into history.
    useSafetyStore.getState().resetQuickExit();
    router.replace(RETURN_HREF as never);
  }, [router]);

  return { exit, returnToApp, quickExitActive };
}

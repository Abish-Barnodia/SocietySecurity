import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

// Lets code outside the component tree (socket handlers in DataContext,
// notification tap handlers in utils/notifications.ts) push the app straight
// to the incoming-visitor screen — the "feels like an incoming call"
// behavior the ringing feature is meant to have, without needing a native
// full-screen-intent module.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToWalkInApproval(requestId: string) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('WalkInApproval', { requestId });
  }
}

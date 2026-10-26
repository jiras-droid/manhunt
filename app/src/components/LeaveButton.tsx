import React from 'react';
import { Alert } from 'react-native';

import { IconButton } from './ui';

// Leave asks twice, because leaving is permanent for this game.
export function LeaveButton({ onLeave, style }: { onLeave: () => void; style?: object }) {
  const confirmAgain = () =>
    Alert.alert('Really leave?', "This can't be undone. You won't be able to rejoin this game.", [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, leave', style: 'destructive', onPress: onLeave },
    ]);
  const ask = () =>
    Alert.alert('Leave room?', "Are you sure? You can't rejoin after leaving.", [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: confirmAgain },
    ]);
  return <IconButton icon="🚪" label="Leave room" onPress={ask} style={style} />;
}

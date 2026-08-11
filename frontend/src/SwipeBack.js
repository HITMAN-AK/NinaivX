import React, { useRef } from 'react';
import { View, PanResponder } from 'react-native';

// Wraps a screen so a left-edge → right swipe triggers `onBack` (iOS-style back gesture).
// Works with the app's simple state router — no navigation library needed.
//
// It only captures the gesture when the touch STARTS near the left edge and is a
// clearly horizontal rightward swipe, so it won't interfere with vertical scrolling
// or taps in the middle of the screen.
export default function SwipeBack({ onBack, enabled = true, children }) {
  // Keep the latest onBack without recreating the PanResponder (avoids stale closures).
  const backRef = useRef(onBack);
  backRef.current = onBack;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const EDGE = 44;   // how close to the left edge the swipe must start (px)
  const TRIGGER = 80; // how far right the user must drag to go back (px)

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) => {
        if (!enabledRef.current || !backRef.current) return false;
        const startX = g.moveX - g.dx; // where the finger first touched
        return startX <= EDGE && g.dx > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6;
      },
      onPanResponderRelease: (_evt, g) => {
        const startX = g.moveX - g.dx;
        if (startX <= EDGE + 20 && g.dx > TRIGGER && Math.abs(g.dx) > Math.abs(g.dy) * 1.3) {
          backRef.current && backRef.current();
        }
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }} {...responder.panHandlers}>
      {children}
    </View>
  );
}

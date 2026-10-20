import { Accelerometer } from "expo-sensors";
import { useEffect, useRef, useState } from "react";

interface ShakeOptions {
  threshold?: number;
  cooldownMs?: number;
}

export function useShake(
  onShake: () => void,
  options?: ShakeOptions,
): { isAvailable: boolean | null } {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const threshold = options?.threshold ?? 1.78;
  const cooldownMs = options?.cooldownMs ?? 1000;

  // Guardar callback en ref para no reiniciar la suscripción en cada render
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  const lastShakeTimeRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    async function subscribe() {
      try {
        const available = await Accelerometer.isAvailableAsync();
        if (cancelled) return;
        setIsAvailable(available);

        if (!available) return;

        Accelerometer.setUpdateInterval(100);

        subscription = Accelerometer.addListener(({ x, y, z }) => {
          // Magnitud del vector: sqrt(x^2 + y^2 + z^2)
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();

          if (magnitude > threshold) {
            if (now - lastShakeTimeRef.current >= cooldownMs) {
              lastShakeTimeRef.current = now;
              onShakeRef.current();
            }
          }
        });
      } catch {
        if (!cancelled) {
          setIsAvailable(false);
        }
      }
    }

    subscribe();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [threshold, cooldownMs]);

  return { isAvailable };
}

import { useRef, useState, useCallback } from "react";
import { useCameraPermissions } from "expo-camera";
import type { CameraView } from "expo-camera";

export interface UseCameraResult {
  cameraRef: React.RefObject<CameraView>;
  hasPermission: boolean | null;
  requestPermission: () => Promise<void>;
  capturePhoto: () => Promise<string | null>;
  isCapturing: boolean;
}

export function useCamera(): UseCameraResult {
  const cameraRef = useRef(null) as React.MutableRefObject<CameraView | null>;
  const [isCapturing, setIsCapturing] = useState(false);
  const [permission, requestPermissionAsync] = useCameraPermissions();

  const requestPermission = useCallback(async () => {
    await requestPermissionAsync();
  }, [requestPermissionAsync]);

  const capturePhoto = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current) return null;
    setIsCapturing(true);
    try {
      const photo = await (cameraRef.current as any).takePictureAsync({ quality: 0.9, skipProcessing: false });
      return photo?.uri ?? null;
    } catch {
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  return {
    cameraRef: cameraRef as React.RefObject<CameraView>,
    hasPermission: permission?.granted ?? null,
    requestPermission,
    capturePhoto,
    isCapturing,
  };
}

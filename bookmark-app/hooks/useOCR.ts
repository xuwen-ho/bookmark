import { useState, useCallback } from "react";
import MlkitOcr from "react-native-mlkit-ocr";
import type { MlkitOcrResult } from "react-native-mlkit-ocr";

export interface OCRBlock {
  text: string;
  boundingBox: { left: number; top: number; right: number; bottom: number; width: number; height: number };
}

export function useOCR() {
  const [isProcessing, setIsProcessing] = useState(false);

  const recognizeText = useCallback(async (imageUri: string): Promise<OCRBlock[]> => {
    setIsProcessing(true);
    try {
      const result: MlkitOcrResult = await MlkitOcr.detectFromUri(imageUri);
      return result.flatMap((block) =>
        block.lines.map((line) => ({
          text: line.text,
          boundingBox: {
            left: line.bounding.left,
            top: line.bounding.top,
            right: line.bounding.left + line.bounding.width,
            bottom: line.bounding.top + line.bounding.height,
            width: line.bounding.width,
            height: line.bounding.height,
          },
        }))
      );
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { recognizeText, isProcessing };
}

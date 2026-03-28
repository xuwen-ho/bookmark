import BottomSheetLib from "@gorhom/bottom-sheet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useRef, useState, useCallback } from "react";
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import BookPicker from "../components/BookPicker";
import ParagraphSelector, { type ParagraphBlock } from "../components/ParagraphSelector";
import { insertPassage } from "../db/passages";
import { useCamera } from "../hooks/useCamera";
import { useOCR } from "../hooks/useOCR";
import { mergeLinesToParagraphs } from "../lib/paragraphs";

type Step = "capture" | "select" | "assign";

export default function ScanScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const bookPickerRef = useRef(null) as React.MutableRefObject<BottomSheetLib | null>;
  const { cameraRef, hasPermission, requestPermission, capturePhoto, isCapturing } = useCamera();
  const { recognizeText, isProcessing } = useOCR();
  const [step, setStep] = useState("capture" as Step);
  const [paragraphs, setParagraphs] = useState([] as ParagraphBlock[]);
  const [selected, setSelected] = useState(new Set() as Set<string>);

  const handleScan = useCallback(async () => {
    const uri = await capturePhoto();
    if (!uri) { Alert.alert("Error", "Failed to capture photo."); return; }
    const blocks = await recognizeText(uri);
    if (!blocks.length) { Alert.alert("No text found", "No text detected. Try again."); return; }
    const merged = mergeLinesToParagraphs(blocks);
    setParagraphs(merged.map((p, i) => ({ id: String(i + 1), text: p.text })));
    setSelected(new Set() as Set<string>);
    setStep("select");
  }, [capturePhoto, recognizeText]);

  const savePassage = useMutation({
    mutationFn: ({ bookId, text }: { bookId: number; text: string }) => insertPassage({ book_id: bookId, text }),
    onSuccess: (passageId) => { queryClient.invalidateQueries({ queryKey: ["passages"] }); router.replace("/passage/" + passageId); },
    onError: (err) => { Alert.alert("Error", String(err)); },
  });

  function toggleParagraph(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function buildPassageText() {
    return paragraphs.filter((p) => selected.has(p.id)).map((p) => p.text).join("

");
  }
  function handleNext() { if (selected.size === 0) return; setStep("assign"); bookPickerRef.current?.expand(); }
  function handleBookSelected(bookId: number) { bookPickerRef.current?.close(); savePassage.mutate({ bookId, text: buildPassageText() }); }

  if (step === "capture") {
    if (hasPermission === null) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.permCenter}>
            <Text style={styles.permText}>Camera access is required.</Text>
            <TouchableOpacity style={styles.nextBtn} onPress={requestPermission} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Grant Camera Permission</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    if (!hasPermission) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.permCenter}>
            <Text style={styles.permText}>Camera denied. Enable in settings.</Text>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={[styles.container, styles.dark]}>
        <CameraView ref={cameraRef as any} style={styles.camera} facing="back" />
        <View style={styles.captureFooter}>
          {isCapturing || isProcessing ? (
            <View style={styles.processingRow}>
              <ActivityIndicator color={"#fff"} />
              <Text style={styles.processingText}>{isCapturing ? "Capturing..." : "Reading text..."}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.scanBtn} onPress={handleScan} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Scan Page</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select paragraphs</Text>
        <Text style={styles.subtitle}>{selected.size === 0 ? "Tap to select what you want to save" : selected.size + " paragraph" + (selected.size > 1 ? "s" : "") + " selected"}</Text>
      </View>
      <ParagraphSelector paragraphs={paragraphs} selected={selected} onToggle={toggleParagraph} />
      {selected.size > 0 && step === "select" && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>Next — Choose Book</Text>
          </TouchableOpacity>
        </View>
      )}
      <BookPicker ref={bookPickerRef} onBookSelected={handleBookSelected} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  dark: { backgroundColor: "#000" },
  camera: { flex: 1 },
  captureFooter: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 32, alignItems: "center" },
  scanBtn: { backgroundColor: "#2563eb", borderRadius: 12, paddingVertical: 16, paddingHorizontal: 40, alignItems: "center" },
  processingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  processingText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  permCenter: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  permText: { fontSize: 16, color: "#374151", textAlign: "center", marginBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: "#f9fafb", borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  nextBtn: { backgroundColor: "#2563eb", borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  nextBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

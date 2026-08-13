import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  ImageBackground,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputSubmitEditingEventData,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CubeLabScene } from "@/components/scene";
import {
  sceneFallbackImage,
  spaceCubeMapFaces,
} from "@/components/scene/assets";
import { clearLocalCubeTextureCache } from "@/components/scene/useLocalCubeTexture";
import { sceneStrings } from "@/constants/strings";
import {
  applyCameraZoom,
  applyLabDrag,
  commitLabNumericDraft,
  createLabState,
  DEFAULT_CAMERA_DISTANCE,
  DEFAULT_LAB_INPUTS,
  DEFAULT_LAB_ORIENTATION,
  formatLabValue,
  LAB_AXES,
  LabAxis,
  LabNumericKind,
  LabOrientation,
  SceneFailure,
  updateLabAxis,
  updateLabControl,
} from "@/domain/scene";
import {
  MAX_ROTATION_SPEED,
  MAX_SCALE,
  MAX_VELOCITY,
  MIN_ROTATION_SPEED,
  MIN_SCALE,
  MIN_VELOCITY,
  RelativityInputs,
} from "@/domain/relativity";

interface NumericControlProps {
  readonly error: string | null;
  readonly kind: LabNumericKind;
  readonly label: string;
  readonly inputRef?: React.Ref<TextInput>;
  readonly maximum?: number;
  readonly minimum: number;
  readonly onCommit: (text: string) => void;
  readonly onDraftChange: (text: string) => void;
  readonly onSliderChange?: (value: number) => void;
  readonly rangeDescription: string;
  readonly sliderStep?: number;
  readonly text: string;
  readonly value: number;
}

type LabSceneStatus =
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | { readonly kind: "error"; readonly failure: SceneFailure };

const NumericControl = ({
  error,
  inputRef,
  label,
  maximum,
  minimum,
  onCommit,
  onDraftChange,
  onSliderChange,
  rangeDescription,
  sliderStep,
  text,
  value,
}: NumericControlProps) => {
  const commitFromEvent = (
    event: NativeSyntheticEvent<TextInputSubmitEditingEventData>,
  ) => onCommit(event.nativeEvent.text);

  return (
    <View style={styles.numericControl}>
      <View style={styles.controlLabelRow}>
        <Text style={styles.controlLabel}>{label}</Text>
        <Text style={styles.currentValue}>{formatLabValue(value)}</Text>
      </View>
      <TextInput
        accessibilityHint={rangeDescription}
        accessibilityLabel={`${label} numeric value`}
        accessibilityValue={{ text: formatLabValue(value) }}
        keyboardType="numbers-and-punctuation"
        onBlur={() => onCommit(text)}
        onChangeText={onDraftChange}
        onSubmitEditing={commitFromEvent}
        ref={inputRef}
        selectTextOnFocus
        style={[styles.numericInput, error !== null && styles.invalidInput]}
        value={text}
      />
      {maximum !== undefined && onSliderChange !== undefined ? (
        <Slider
          accessibilityLabel={`${label} slider`}
          accessibilityRole="adjustable"
          accessibilityValue={{
            max: maximum,
            min: minimum,
            now: value,
            text: formatLabValue(value),
          }}
          maximumTrackTintColor="#3f3f46"
          maximumValue={maximum}
          minimumTrackTintColor="#818cf8"
          minimumValue={minimum}
          onValueChange={onSliderChange}
          step={sliderStep}
          thumbTintColor="#c7d2fe"
          value={value}
        />
      ) : null}
      <Text style={styles.rangeText}>{rangeDescription}</Text>
      {error !== null ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const axisFieldKey = (
  axis: LabAxis,
  kind: "initialLength" | "velocity",
): string => `${axis}.${kind}`;

const Playground = () => {
  const router = useRouter();
  const [inputs, setInputs] = useState<RelativityInputs>(DEFAULT_LAB_INPUTS);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => ({
    "x.initialLength": "1",
    "x.velocity": "0",
    "y.initialLength": "1",
    "y.velocity": "0",
    "z.initialLength": "1",
    "z.velocity": "0",
    rotationSpeed: "0.1",
    scale: "0.4",
  }));
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [autoRotate, setAutoRotate] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [motionPreferenceLoaded, setMotionPreferenceLoaded] = useState(false);
  const [orientation, setOrientation] = useState(DEFAULT_LAB_ORIENTATION);
  const [cameraDistance, setCameraDistance] = useState(DEFAULT_CAMERA_DISTANCE);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [sceneStatus, setSceneStatus] = useState<LabSceneStatus>({
    kind: "loading",
  });
  const [retryKey, setRetryKey] = useState(0);
  const dragOriginRef = useRef<LabOrientation>(DEFAULT_LAB_ORIENTATION);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const variablesTriggerRef = useRef<View>(null);
  const variablesFirstInputRef = useRef<TextInput>(null);
  const controlsTriggerRef = useRef<View>(null);
  const controlsFirstActionRef = useRef<View>(null);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (mounted) {
          setReduceMotion(reduceMotion);
          setAutoRotate(!reduceMotion);
          setMotionPreferenceLoaded(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setReduceMotion(false);
          setAutoRotate(true);
          setMotionPreferenceLoaded(true);
        }
      });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        if (mounted) {
          setReduceMotion(enabled);
          if (enabled) {
            setAutoRotate(false);
          }
        }
      },
    );

    return () => {
      mounted = false;
      subscription.remove();
      if (focusTimerRef.current !== null) {
        clearTimeout(focusTimerRef.current);
      }
    };
  }, []);

  const lab = useMemo(() => createLabState(inputs, autoRotate), [autoRotate, inputs]);
  const interactionsEnabled =
    !variablesOpen && !controlsOpen && sceneStatus.kind === "ready";
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          interactionsEnabled && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5,
        onPanResponderGrant: () => {
          dragOriginRef.current = orientation;
          setAutoRotate(false);
        },
        onPanResponderMove: (_event, gesture) => {
          setOrientation(
            applyLabDrag(dragOriginRef.current, gesture.dx, gesture.dy),
          );
        },
      }),
    [interactionsEnabled, orientation],
  );

  const setIssue = useCallback((key: string, issue: "invalid" | "clamped" | null) => {
    setErrors((current) => ({
      ...current,
      [key]:
        issue === "invalid"
          ? sceneStrings.invalidNumber
          : issue === "clamped"
            ? sceneStrings.clamped
            : null,
    }));
    if (issue === "clamped") {
      AccessibilityInfo.announceForAccessibility(sceneStrings.clamped);
    }
  }, []);

  const updateAxisDraft = (
    axis: LabAxis,
    kind: "initialLength" | "velocity",
    text: string,
  ) => {
    const key = axisFieldKey(axis, kind);
    setDrafts((current) => ({ ...current, [key]: text }));
    setIssue(key, null);
  };

  const commitAxisDraft = (
    axis: LabAxis,
    kind: "initialLength" | "velocity",
    text: string,
  ) => {
    const key = axisFieldKey(axis, kind);
    const result = commitLabNumericDraft(text, kind);
    setIssue(key, result.issue);
    if (result.value !== null) {
      setDrafts((current) => ({ ...current, [key]: result.text }));
      setInputs((current) => updateLabAxis(current, axis, kind, result.value!));
    }
  };

  const setAxisSlider = (axis: LabAxis, value: number) => {
    const key = axisFieldKey(axis, "velocity");
    setInputs((current) => updateLabAxis(current, axis, "velocity", value));
    setDrafts((current) => ({ ...current, [key]: formatLabValue(value) }));
    setIssue(key, null);
  };

  const updateControlDraft = (
    kind: "rotationSpeed" | "scale",
    text: string,
  ) => {
    setDrafts((current) => ({ ...current, [kind]: text }));
    setIssue(kind, null);
  };

  const commitControlDraft = (
    kind: "rotationSpeed" | "scale",
    text: string,
  ) => {
    const result = commitLabNumericDraft(text, kind);
    setIssue(kind, result.issue);
    if (result.value !== null) {
      setDrafts((current) => ({ ...current, [kind]: result.text }));
      setInputs((current) => updateLabControl(current, kind, result.value!));
    }
  };

  const setControlSlider = (
    kind: "rotationSpeed" | "scale",
    value: number,
  ) => {
    setInputs((current) => updateLabControl(current, kind, value));
    setDrafts((current) => ({ ...current, [kind]: formatLabValue(value) }));
    setIssue(kind, null);
  };

  const resetExperiment = () => {
    setInputs(DEFAULT_LAB_INPUTS);
    setDrafts({
      "x.initialLength": "1",
      "x.velocity": "0",
      "y.initialLength": "1",
      "y.velocity": "0",
      "z.initialLength": "1",
      "z.velocity": "0",
      rotationSpeed: "0.1",
      scale: "0.4",
    });
    setErrors({});
    setOrientation(DEFAULT_LAB_ORIENTATION);
    setCameraDistance(DEFAULT_CAMERA_DISTANCE);
    setAutoRotate(!reduceMotion);
  };

  const retryScene = () => {
    clearLocalCubeTextureCache(spaceCubeMapFaces);
    setSceneStatus({ kind: "loading" });
    setRetryKey((current) => current + 1);
  };

  const focusAccessibilityTarget = useCallback(
    (target: React.RefObject<View | TextInput | null>) => {
      if (focusTimerRef.current !== null) {
        clearTimeout(focusTimerRef.current);
      }
      focusTimerRef.current = setTimeout(() => {
        if (target.current === null) {
          focusTimerRef.current = null;
          return;
        }
        const handle = findNodeHandle(target.current);
        if (handle !== null) {
          AccessibilityInfo.setAccessibilityFocus(handle);
        }
        focusTimerRef.current = null;
      }, 0);
    },
    [],
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ImageBackground
        resizeMode="cover"
        source={sceneFallbackImage}
        style={StyleSheet.absoluteFill}
      />
      <View
        accessibilityHint="Drag with one finger to rotate the cube. Use the zoom buttons for camera distance."
        accessibilityLabel="Relativity cube interaction area"
        accessibilityRole="image"
        style={styles.sceneRegion}
        {...panResponder.panHandlers}
      >
        <Pressable
          accessibilityHint="Returns to the previous screen, or Home when no history is available."
          accessibilityLabel={sceneStrings.back}
          accessibilityRole="button"
          onPress={handleBack}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>‹ {sceneStrings.back}</Text>
        </Pressable>
        {motionPreferenceLoaded ? (
          <CubeLabScene
            autoRotate={autoRotate}
            cameraDistance={cameraDistance}
            dimensions={lab.dimensions.normalizedDimensions}
            onError={(failure) => setSceneStatus({ kind: "error", failure })}
            onReady={() => setSceneStatus({ kind: "ready" })}
            orientation={orientation}
            retryKey={retryKey}
            rotationSpeed={lab.rotationSpeed}
          />
        ) : null}
        <View pointerEvents="none" style={styles.header}>
          <Text style={styles.title}>{sceneStrings.labTitle}</Text>
          <Text style={styles.subtitle}>{sceneStrings.labSubtitle}</Text>
          <Text style={styles.sceneValues}>
            {LAB_AXES.map(
              (axis) =>
                `${axis.toUpperCase()} ${formatLabValue(lab.axes[axis].finalLength)}`,
            ).join("  •  ")}
          </Text>
        </View>
        {sceneStatus.kind === "loading" ? (
          <View accessibilityLiveRegion="polite" style={styles.sceneStatus}>
            <ActivityIndicator color="#c7d2fe" />
            <Text style={styles.sceneStatusText}>{sceneStrings.loading}</Text>
          </View>
        ) : null}
        {sceneStatus.kind === "error" ? (
          <View accessibilityLiveRegion="assertive" style={styles.sceneFailure}>
            <Text style={styles.sceneFailureText}>{sceneStrings.unavailable}</Text>
            <View style={styles.failureActions}>
              <Pressable
                accessibilityLabel={sceneStrings.retry}
                accessibilityRole="button"
                onPress={retryScene}
                style={styles.compactButton}
              >
                <Text style={styles.buttonText}>{sceneStrings.retry}</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={sceneStrings.home}
                accessibilityRole="button"
                onPress={() => router.replace("/")}
                style={styles.compactButton}
              >
                <Text style={styles.buttonText}>{sceneStrings.home}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.zoomControls}>
          <Pressable
            accessibilityHint="Moves the virtual camera closer to the cube."
            accessibilityLabel={sceneStrings.zoomIn}
            accessibilityRole="button"
            onPress={() => setCameraDistance((distance) => applyCameraZoom(distance, -0.4))}
            style={styles.zoomButton}
          >
            <Text style={styles.zoomText}>+</Text>
          </Pressable>
          <Pressable
            accessibilityHint="Moves the virtual camera farther from the cube."
            accessibilityLabel={sceneStrings.zoomOut}
            accessibilityRole="button"
            onPress={() => setCameraDistance((distance) => applyCameraZoom(distance, 0.4))}
            style={styles.zoomButton}
          >
            <Text style={styles.zoomText}>−</Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.panelArea}
      >
        <ScrollView
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityLabel={sceneStrings.experimentVariables}
            accessibilityRole="button"
            accessibilityState={{ expanded: variablesOpen }}
            onPress={() => {
              const opening = !variablesOpen;
              setVariablesOpen(opening);
              setControlsOpen(false);
              focusAccessibilityTarget(
                opening ? variablesFirstInputRef : variablesTriggerRef,
              );
            }}
            ref={variablesTriggerRef}
            style={styles.sectionButton}
          >
            <Text style={styles.sectionButtonText}>
              {sceneStrings.experimentVariables}
            </Text>
            <Text style={styles.sectionButtonText}>{variablesOpen ? "−" : "+"}</Text>
          </Pressable>
          {variablesOpen ? (
            <View accessibilityViewIsModal style={styles.section}>
              {LAB_AXES.map((axis) => {
                const initialKey = axisFieldKey(axis, "initialLength");
                const velocityKey = axisFieldKey(axis, "velocity");
                return (
                  <View key={axis} style={styles.axisGroup}>
                    <Text style={styles.axisHeading}>Axis {axis.toUpperCase()}</Text>
                    <NumericControl
                      error={errors[initialKey] ?? null}
                      kind="initialLength"
                      inputRef={axis === "x" ? variablesFirstInputRef : undefined}
                      label={`${sceneStrings.initialLength} ${axis.toUpperCase()}`}
                      minimum={0.001}
                      onCommit={(text) => commitAxisDraft(axis, "initialLength", text)}
                      onDraftChange={(text) => updateAxisDraft(axis, "initialLength", text)}
                      rangeDescription={sceneStrings.initialLengthRange}
                      text={drafts[initialKey]}
                      value={lab.axes[axis].initialLength}
                    />
                    <NumericControl
                      error={errors[velocityKey] ?? null}
                      kind="velocity"
                      label={`${sceneStrings.velocity} ${axis.toUpperCase()}`}
                      maximum={MAX_VELOCITY}
                      minimum={MIN_VELOCITY}
                      onCommit={(text) => commitAxisDraft(axis, "velocity", text)}
                      onDraftChange={(text) => updateAxisDraft(axis, "velocity", text)}
                      onSliderChange={(value) => setAxisSlider(axis, value)}
                      rangeDescription={sceneStrings.velocityRange}
                      sliderStep={0.001}
                      text={drafts[velocityKey]}
                      value={lab.axes[axis].velocity}
                    />
                    <View style={styles.outputRow}>
                      <Text style={styles.outputLabel}>
                        {sceneStrings.finalLength} {axis.toUpperCase()}
                      </Text>
                      <Text
                        accessibilityLabel={`${sceneStrings.finalLength} axis ${axis.toUpperCase()}`}
                        accessibilityValue={{
                          text: formatLabValue(lab.axes[axis].finalLength),
                        }}
                        style={styles.outputValue}
                      >
                        {formatLabValue(lab.axes[axis].finalLength)}
                      </Text>
                    </View>
                    <View style={styles.outputRow}>
                      <Text style={styles.outputLabel}>
                        {sceneStrings.lorentzFactor} {axis.toUpperCase()}
                      </Text>
                      <Text style={styles.outputValue}>
                        {formatLabValue(lab.axes[axis].gamma)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Pressable
            accessibilityLabel={sceneStrings.labControls}
            accessibilityRole="button"
            accessibilityState={{ expanded: controlsOpen }}
            onPress={() => {
              const opening = !controlsOpen;
              setControlsOpen(opening);
              setVariablesOpen(false);
              focusAccessibilityTarget(
                opening ? controlsFirstActionRef : controlsTriggerRef,
              );
            }}
            ref={controlsTriggerRef}
            style={styles.sectionButton}
          >
            <Text style={styles.sectionButtonText}>{sceneStrings.labControls}</Text>
            <Text style={styles.sectionButtonText}>{controlsOpen ? "−" : "+"}</Text>
          </Pressable>
          {controlsOpen ? (
            <View accessibilityViewIsModal style={styles.section}>
              <Pressable
                accessibilityLabel={
                  autoRotate ? sceneStrings.pauseRotation : sceneStrings.resumeRotation
                }
                accessibilityRole="switch"
                accessibilityState={{
                  checked: autoRotate,
                  disabled: reduceMotion,
                }}
                disabled={reduceMotion}
                onPress={() => {
                  if (!reduceMotion) {
                    setAutoRotate((enabled) => !enabled);
                  }
                }}
                ref={controlsFirstActionRef}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {autoRotate ? sceneStrings.pauseRotation : sceneStrings.resumeRotation}
                </Text>
              </Pressable>
              {reduceMotion ? (
                <Text accessibilityLiveRegion="polite" style={styles.rangeText}>
                  {sceneStrings.rotationReduced}
                </Text>
              ) : null}
              <NumericControl
                error={errors.rotationSpeed ?? null}
                kind="rotationSpeed"
                label={sceneStrings.rotationSpeed}
                maximum={MAX_ROTATION_SPEED}
                minimum={MIN_ROTATION_SPEED}
                onCommit={(text) => commitControlDraft("rotationSpeed", text)}
                onDraftChange={(text) => updateControlDraft("rotationSpeed", text)}
                onSliderChange={(value) => setControlSlider("rotationSpeed", value)}
                rangeDescription={sceneStrings.rotationRange}
                sliderStep={0.01}
                text={drafts.rotationSpeed}
                value={lab.rotationSpeed}
              />
              <NumericControl
                error={errors.scale ?? null}
                kind="scale"
                label={sceneStrings.sceneScale}
                maximum={MAX_SCALE}
                minimum={MIN_SCALE}
                onCommit={(text) => commitControlDraft("scale", text)}
                onDraftChange={(text) => updateControlDraft("scale", text)}
                onSliderChange={(value) => setControlSlider("scale", value)}
                rangeDescription={sceneStrings.scaleRange}
                sliderStep={0.01}
                text={drafts.scale}
                value={lab.scale}
              />
              <View style={styles.actionGrid}>
                <Pressable
                  accessibilityLabel={sceneStrings.reset}
                  accessibilityRole="button"
                  onPress={resetExperiment}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.buttonText}>{sceneStrings.reset}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={sceneStrings.home}
                  accessibilityRole="button"
                  onPress={() => router.replace("/")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.buttonText}>{sceneStrings.home}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={sceneStrings.quiz}
                  accessibilityRole="button"
                  onPress={() => router.push("/quiz")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.buttonText}>{sceneStrings.quiz}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  axisGroup: { borderTopColor: "#3f3f46", borderTopWidth: 1, paddingTop: 14 },
  axisHeading: { color: "#c7d2fe", fontFamily: "Rubik-SemiBold", fontSize: 16 },
  backButton: { alignItems: "center", backgroundColor: "rgba(24, 24, 27, 0.9)", borderColor: "#52525b", borderRadius: 8, borderWidth: 1, justifyContent: "center", left: 12, minHeight: 48, paddingHorizontal: 14, position: "absolute", top: 12, zIndex: 4 },
  backButtonText: { color: "#fff", fontFamily: "Rubik-SemiBold", fontSize: 16 },
  buttonText: { color: "#fff", fontFamily: "Rubik-Medium", textAlign: "center" },
  compactButton: { backgroundColor: "#312e81", borderRadius: 8, minHeight: 48, padding: 12 },
  controlLabel: { color: "#f4f4f5", flex: 1, fontFamily: "Rubik-Medium" },
  controlLabelRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  currentValue: { color: "#c7d2fe", fontFamily: "Rubik-SemiBold" },
  errorText: { color: "#fca5a5", fontFamily: "Rubik-Regular", fontSize: 12, marginTop: 4 },
  failureActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  header: { left: 96, position: "absolute", right: 20, top: 16 },
  invalidInput: { borderColor: "#f87171" },
  numericControl: { marginTop: 12 },
  numericInput: { backgroundColor: "#18181b", borderColor: "#52525b", borderRadius: 8, borderWidth: 1, color: "#fff", fontFamily: "Rubik-Regular", marginTop: 8, minHeight: 48, paddingHorizontal: 12 },
  outputLabel: { color: "#d4d4d8", flex: 1, fontFamily: "Rubik-Regular" },
  outputRow: { alignItems: "center", flexDirection: "row", marginTop: 8 },
  outputValue: { color: "#fff", fontFamily: "Rubik-SemiBold" },
  panelArea: { backgroundColor: "rgba(9, 9, 11, 0.96)", maxHeight: "58%" },
  panelContent: { gap: 8, padding: 12, paddingBottom: 24 },
  primaryButton: { alignItems: "center", backgroundColor: "#4f46e5", borderRadius: 8, justifyContent: "center", minHeight: 48, padding: 12 },
  primaryButtonText: { color: "#fff", fontFamily: "Rubik-SemiBold" },
  rangeText: { color: "#a1a1aa", fontFamily: "Rubik-Regular", fontSize: 11 },
  sceneFailure: { alignItems: "center", backgroundColor: "rgba(9, 9, 11, 0.9)", borderRadius: 12, left: 24, padding: 18, position: "absolute", right: 24, top: "38%" },
  sceneFailureText: { color: "#fff", fontFamily: "Rubik-Medium", textAlign: "center" },
  sceneRegion: { flex: 1, minHeight: 280 },
  sceneStatus: { alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.5)", borderRadius: 10, flexDirection: "row", gap: 10, left: 24, padding: 12, position: "absolute", top: "48%" },
  sceneStatusText: { color: "#fff", fontFamily: "Rubik-Regular" },
  sceneValues: { color: "#e4e4e7", fontFamily: "Rubik-Medium", fontSize: 13, marginTop: 10 },
  screen: { backgroundColor: "#000", flex: 1 },
  secondaryButton: { alignItems: "center", borderColor: "#52525b", borderRadius: 8, borderWidth: 1, flexGrow: 1, justifyContent: "center", minHeight: 48, minWidth: "45%", padding: 12 },
  section: { backgroundColor: "#111113", borderRadius: 10, gap: 12, padding: 14 },
  sectionButton: { alignItems: "center", backgroundColor: "#27272a", borderRadius: 9, flexDirection: "row", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 16 },
  sectionButtonText: { color: "#fff", fontFamily: "Rubik-SemiBold", fontSize: 16 },
  subtitle: { color: "#d4d4d8", fontFamily: "Rubik-Regular", fontSize: 14, marginTop: 4 },
  title: { color: "#fff", fontFamily: "Rubik-Bold", fontSize: 24 },
  zoomButton: { alignItems: "center", backgroundColor: "rgba(24, 24, 27, 0.88)", borderColor: "#52525b", borderRadius: 8, borderWidth: 1, height: 48, justifyContent: "center", width: 48 },
  zoomControls: { bottom: 16, gap: 8, position: "absolute", right: 16 },
  zoomText: { color: "#fff", fontSize: 24, lineHeight: 28 },
});

export default Playground;

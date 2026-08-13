import { Link, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { ChipGroup } from "../../components/ChipGroup";
import { trpc } from "../../lib/trpc";
import { shared } from "../../lib/styles";
import { Button } from "../../components/Button";

function formatWakeTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}

// No native time picker without another dependency — preset chips instead,
// same pattern as every other enum field on this screen.
const WAKE_TIME_OPTIONS = [360, 390, 420, 450, 480, 510].map((minutes) => ({
  value: String(minutes),
  label: formatWakeTime(minutes),
}));

type GoalType = "INJURY_RECOVERY" | "STRENGTH" | "MOBILITY" | "GENERAL_FITNESS";
type InjurySeverity = "none" | "mild" | "moderate" | "severe";
type RedFlagKey =
  | "severeSuddenPain"
  | "numbnessOrTingling"
  | "recentTrauma"
  | "recentSurgery"
  | "pregnancyRelated"
  | "cardiacSymptomsWithExertion";

const GOAL_OPTIONS: { value: GoalType; label: string }[] = [
  { value: "GENERAL_FITNESS", label: "General fitness" },
  { value: "INJURY_RECOVERY", label: "Injury recovery" },
  { value: "STRENGTH", label: "Strength" },
  { value: "MOBILITY", label: "Mobility" },
];

const SEVERITY_OPTIONS: { value: InjurySeverity; label: string }[] = [
  { value: "none", label: "None" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

// Matches HEAVIER_CONDITION_FLAGS in packages/clinical-rules/src/risk-tiering.ts
// — "autoimmune" and "chronic" are the literal strings that route risk tiering.
const CONDITION_FLAG_OPTIONS: { value: string; label: string }[] = [
  { value: "autoimmune", label: "Autoimmune condition" },
  { value: "chronic", label: "Chronic condition" },
  { value: "post_surgical", label: "Post-surgical (cleared)" },
];

const RED_FLAG_OPTIONS: { value: RedFlagKey; label: string }[] = [
  { value: "severeSuddenPain", label: "Severe/sudden pain" },
  { value: "numbnessOrTingling", label: "Numbness or tingling" },
  { value: "recentTrauma", label: "Recent trauma" },
  { value: "recentSurgery", label: "Recent uncleared surgery" },
  { value: "pregnancyRelated", label: "Pregnancy-related" },
  { value: "cardiacSymptomsWithExertion", label: "Chest pain/dizziness on exertion" },
];

export default function OnboardingScreen() {
  const router = useRouter();

  const [age, setAge] = useState("");
  const [goalType, setGoalType] = useState<GoalType[]>(["GENERAL_FITNESS"]);
  const [injurySeverity, setInjurySeverity] = useState<InjurySeverity[]>(["none"]);
  const [conditionFlags, setConditionFlags] = useState<string[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlagKey[]>([]);
  const [targetMovement, setTargetMovement] = useState("");
  const [symptomsText, setSymptomsText] = useState("");
  const [lifestyleContextText, setLifestyleContextText] = useState("");

  // Daily Session Structure: morning "on wake", evening "at sunset" — both
  // optional. wakeTimeMinutes pre-fills to 7:00 AM; location has no default
  // since it needs an explicit OS permission grant.
  const [wakeTimeMinutes, setWakeTimeMinutes] = useState<string[]>(["420"]);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");

  const [jobId, setJobId] = useState<string | null>(null);
  const [redFlagReasons, setRedFlagReasons] = useState<string[] | null>(null);

  const submit = trpc.onboarding.submit.useMutation({
    onSuccess: (result) => {
      if (result.status === "red_flagged") {
        setRedFlagReasons(result.reasons);
      } else {
        setJobId(result.jobId);
      }
    },
  });

  const jobStatus = trpc.onboarding.getJobStatus.useQuery(
    { jobId: jobId ?? "" },
    {
      enabled: jobId !== null,
      refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 2000 : false),
    }
  );

  function toggleSingle<T extends string>(setter: (v: T[]) => void, value: T) {
    setter([value]);
  }

  function toggleMulti<T extends string>(list: T[], setter: (v: T[]) => void, value: T) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function requestLocation() {
    setLocationStatus("requesting");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationStatus("denied");
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    setLocationCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
    setLocationStatus("granted");
  }

  function handleSubmit() {
    submit.mutate({
      answers: {
        age: Number(age),
        goalType: goalType[0],
        conditionFlags,
        injurySeverity: injurySeverity[0],
        redFlags: {
          severeSuddenPain: redFlags.includes("severeSuddenPain"),
          numbnessOrTingling: redFlags.includes("numbnessOrTingling"),
          recentTrauma: redFlags.includes("recentTrauma"),
          recentSurgery: redFlags.includes("recentSurgery"),
          pregnancyRelated: redFlags.includes("pregnancyRelated"),
          cardiacSymptomsWithExertion: redFlags.includes("cardiacSymptomsWithExertion"),
        },
      },
      targetMovement,
      symptomsText,
      lifestyleContextText,
      wakeTimeMinutes: wakeTimeMinutes[0] ? Number(wakeTimeMinutes[0]) : undefined,
      latitude: locationCoords?.lat,
      longitude: locationCoords?.lng,
    });
  }

  if (redFlagReasons) {
    return (
      <ScrollView contentContainerStyle={shared.page}>
        <Text style={shared.title}>Let&apos;s get you to a professional first</Text>
        <Text>
          Based on your answers, Rebound.ai isn&apos;t the right starting point right now. Please see a doctor or
          physical therapist before starting an exercise program.
        </Text>
        {redFlagReasons.map((reason) => (
          <Text key={reason}>• {reason}</Text>
        ))}
      </ScrollView>
    );
  }

  if (jobId) {
    const status = jobStatus.data?.status;

    return (
      <View style={shared.centeredPage}>
        <Text style={shared.title}>Building your regime</Text>
        {status === "COMPLETE" && jobStatus.data?.resultRegimeId ? (
          <>
            <Text>Your regime is ready.</Text>
            <Link href={`/regime/${jobStatus.data.resultRegimeId}`} style={shared.link}>
              Review your regime →
            </Link>
          </>
        ) : status === "FAILED" && jobStatus.data?.resultRegimeId ? (
          <>
            <Text>We couldn&apos;t draft a personalized regime — here&apos;s a starter plan instead.</Text>
            <Link href={`/regime/${jobStatus.data.resultRegimeId}`} style={shared.link}>
              Review your starter regime →
            </Link>
          </>
        ) : status === "FAILED" ? (
          <Text>We couldn&apos;t generate a regime right now. This has been flagged for review.</Text>
        ) : (
          <Text>Drafting your two-session regime — this takes a few seconds…</Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Text style={shared.title}>Tell us about you</Text>

      <Text style={shared.label}>Age</Text>
      <TextInput style={shared.input} keyboardType="number-pad" value={age} onChangeText={setAge} />

      <Text style={shared.label}>Primary goal</Text>
      <ChipGroup options={GOAL_OPTIONS} selected={goalType} onToggle={(v) => toggleSingle(setGoalType, v)} />

      <Text style={shared.label}>Target movement</Text>
      <TextInput
        style={shared.input}
        placeholder='e.g. "squat without knee pain"'
        value={targetMovement}
        onChangeText={setTargetMovement}
        maxLength={200}
      />

      <Text style={shared.label}>Injury severity</Text>
      <ChipGroup
        options={SEVERITY_OPTIONS}
        selected={injurySeverity}
        onToggle={(v) => toggleSingle(setInjurySeverity, v)}
      />

      <Text style={shared.label}>Do any of these apply to you?</Text>
      <ChipGroup
        options={CONDITION_FLAG_OPTIONS}
        selected={conditionFlags}
        onToggle={(v) => toggleMulti(conditionFlags, setConditionFlags, v)}
      />

      <Text style={shared.label}>Flag anything below that applies right now</Text>
      <ChipGroup options={RED_FLAG_OPTIONS} selected={redFlags} onToggle={(v) => toggleMulti(redFlags, setRedFlags, v)} />

      <Text style={shared.label}>Symptoms</Text>
      <TextInput
        style={[shared.input, { minHeight: 80 }]}
        multiline
        maxLength={750}
        value={symptomsText}
        onChangeText={setSymptomsText}
      />

      <Text style={shared.label}>Lifestyle context</Text>
      <TextInput
        style={[shared.input, { minHeight: 80 }]}
        multiline
        maxLength={750}
        value={lifestyleContextText}
        onChangeText={setLifestyleContextText}
      />

      <Text style={shared.label}>Preferred wake time (morning session)</Text>
      <ChipGroup
        options={WAKE_TIME_OPTIONS}
        selected={wakeTimeMinutes}
        onToggle={(v) => toggleSingle(setWakeTimeMinutes, v)}
      />

      <Text style={shared.label}>
        Evening session timing (optional — anchors it to local sunset instead of a fixed time)
      </Text>
      {locationStatus === "granted" ? (
        <Text>Location shared — evening session will follow sunset.</Text>
      ) : (
        <Button
          label={locationStatus === "requesting" ? "Requesting…" : "Share my location"}
          variant="secondary"
          onPress={requestLocation}
          disabled={locationStatus === "requesting"}
        />
      )}
      {locationStatus === "denied" && <Text>Location unavailable — evening session will default to 6pm.</Text>}

      <Button label={submit.isPending ? "Submitting…" : "Continue"} onPress={handleSubmit} disabled={submit.isPending} />
      {submit.isError && <Text style={shared.error}>{submit.error.message}</Text>}
    </ScrollView>
  );
}

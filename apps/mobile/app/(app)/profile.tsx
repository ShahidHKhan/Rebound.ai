import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { trpc } from "../../lib/trpc";
import { useSharedStyles } from "../../lib/styles";

const goalTypeLabels: Record<string, string> = {
  INJURY_RECOVERY: "Injury recovery",
  STRENGTH: "Strength",
  MOBILITY: "Mobility",
  GENERAL_FITNESS: "General fitness",
};

export default function ProfileScreen() {
  const router = useRouter();
  const shared = useSharedStyles();
  const { user, isLoaded: userLoaded } = useUser();
  const me = trpc.user.getMe.useQuery();

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>Profile</Text>

      <View style={shared.card}>
        <Text style={shared.label}>Name</Text>
        {!userLoaded ? <ActivityIndicator /> : <Text>{user?.fullName || "Not set"}</Text>}

        <Text style={shared.label}>Email</Text>
        {!userLoaded ? <ActivityIndicator /> : <Text>{user?.primaryEmailAddress?.emailAddress}</Text>}
      </View>

      <View style={shared.card}>
        {me.isLoading && <ActivityIndicator />}
        {me.isError && (
          <View style={shared.errorBanner}>
            <Text style={shared.error}>Couldn&apos;t load your profile: {me.error.message}</Text>
          </View>
        )}
        {me.data && (
          <>
            <Text style={shared.label}>Goal</Text>
            <Text>{goalTypeLabels[me.data.goalType] ?? me.data.goalType}</Text>

            <Text style={shared.label}>Member since</Text>
            <Text>
              {new Date(me.data.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

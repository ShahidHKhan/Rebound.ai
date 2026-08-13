import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { getClerkErrorMessage } from "../../lib/clerk-error";
import { shared } from "../../lib/styles";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    if (!isLoaded) return;
    setError(null);
    setSubmitting(true);
    try {
      const attempt = await signIn.create({ identifier: email, password });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        setError("Additional verification required — not supported in this build.");
      }
    } catch (err) {
      setError(getClerkErrorMessage(err, "Sign in failed."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={shared.centeredPage}>
      <Text style={shared.title}>Sign in</Text>
      <TextInput
        style={shared.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput style={shared.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable
        style={[shared.button, submitting && shared.buttonDisabled]}
        onPress={handleSignIn}
        disabled={submitting}
      >
        <Text style={shared.buttonText}>{submitting ? "Signing in…" : "Sign in"}</Text>
      </Pressable>
      {error && <Text style={shared.error}>{error}</Text>}
      <Link href="/sign-up" style={shared.link}>
        Don&apos;t have an account? Sign up
      </Link>
    </View>
  );
}

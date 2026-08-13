import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { getClerkErrorMessage } from "../../lib/clerk-error";
import { shared } from "../../lib/styles";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!isLoaded) return;
    setError(null);
    setSubmitting(true);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      setError(getClerkErrorMessage(err, "Sign up failed."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    if (!isLoaded) return;
    setError(null);
    setSubmitting(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        setError("Verification incomplete — try again.");
      }
    } catch (err) {
      setError(getClerkErrorMessage(err, "Invalid code."));
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingVerification) {
    return (
      <View style={shared.centeredPage}>
        <Text style={shared.title}>Check your email</Text>
        <Text>Enter the verification code we sent to {email}.</Text>
        <TextInput style={shared.input} placeholder="Code" keyboardType="number-pad" value={code} onChangeText={setCode} />
        <Pressable
          style={[shared.button, submitting && shared.buttonDisabled]}
          onPress={handleVerify}
          disabled={submitting}
        >
          <Text style={shared.buttonText}>{submitting ? "Verifying…" : "Verify"}</Text>
        </Pressable>
        {error && <Text style={shared.error}>{error}</Text>}
      </View>
    );
  }

  return (
    <View style={shared.centeredPage}>
      <Text style={shared.title}>Create an account</Text>
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
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={shared.buttonText}>{submitting ? "Creating…" : "Sign up"}</Text>
      </Pressable>
      {error && <Text style={shared.error}>{error}</Text>}
      <Link href="/sign-in" style={shared.link}>
        Already have an account? Sign in
      </Link>
    </View>
  );
}

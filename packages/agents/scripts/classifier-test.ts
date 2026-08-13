import { classifyFreeTextRedFlags } from "../src/free-text-red-flag-classifier";

const SAMPLES = [
  "Just some general stiffness after sitting at my desk all day, nothing serious.",
  "36 weeks pregnant, sciatica's been brutal.",
  "Had surgery on my knee three weeks ago, still healing, doctor hasn't cleared me for exercise yet.",
  "Get a bit of chest tightness and shortness of breath when I push hard during cardio.",
];

async function main() {
  for (const text of SAMPLES) {
    const result = await classifyFreeTextRedFlags(text);
    console.log(`"${text}"`);
    console.log(" ->", result);
    console.log();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

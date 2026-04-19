import { useLocalSearchParams } from "expo-router";
import { PairingScreen } from "@/screens/pairing";

function firstParam(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return firstParam(value[0]);
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

export default function PairRoute(): React.JSX.Element {
  const params = useLocalSearchParams();
  return <PairingScreen offer={firstParam(params.offer)} />;
}

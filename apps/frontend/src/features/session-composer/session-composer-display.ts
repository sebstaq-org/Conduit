import type { ProviderId, SessionConfigOption } from "@conduit/session-client";

function capitalizeFirstLetter(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function capitalizeFirstModelWord(value: string): string {
  return value.replace(/^[A-Za-z]+/u, (word) => word.toUpperCase());
}

function stripRecommendedSuffix(value: string): string {
  return value.replace(/\s+\(recommended\)$/iu, "");
}

interface SelectedConfigValueName {
  fromOption: boolean;
  value: string;
}

function selectedConfigValueName(
  option: SessionConfigOption,
): SelectedConfigValueName {
  const selected = option.values.find(
    (value) => value.value === option.currentValue,
  );
  if (selected !== undefined) {
    return { fromOption: true, value: selected.name };
  }
  return { fromOption: false, value: option.currentValue };
}

function displaySessionConfigOptionValue(option: SessionConfigOption): string {
  const selected = selectedConfigValueName(option);
  if (option.id === "model") {
    const value = stripRecommendedSuffix(selected.value);
    if (!selected.fromOption || /^[a-z]+[-\d]/u.test(value)) {
      return capitalizeFirstModelWord(value);
    }
    return capitalizeFirstLetter(value);
  }
  return capitalizeFirstLetter(selected.value);
}

function displayProviderName(provider: ProviderId | null): string {
  if (provider === null) {
    return "Select provider";
  }
  return capitalizeFirstLetter(provider);
}

export { displayProviderName, displaySessionConfigOptionValue };

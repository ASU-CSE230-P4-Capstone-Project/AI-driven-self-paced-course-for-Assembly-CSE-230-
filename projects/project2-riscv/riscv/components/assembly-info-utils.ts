import type { SubmitResponse } from "./types";

type MachineMap = Record<string, string>;
type MachineState = Pick<SubmitResponse["states"][number], "registers" | "memory">;

const ZERO_HEX = "0x0";

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const normalizeKey = (key: string) => key.trim().toLowerCase();

const normalizeValue = (value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return ZERO_HEX;

  const hexMatch = trimmed.match(/^(-)?0x([0-9a-f]+)$/i);
  if (hexMatch) {
    const sign = hexMatch[1] ?? "";
    const digits = hexMatch[2].replace(/^0+/, "") || "0";
    return `${sign}0x${digits.toLowerCase()}`;
  }

  return trimmed.toLowerCase();
};

const normalizeMap = (map: MachineMap | null | undefined) => {
  const normalized: MachineMap = {};
  if (!map) return normalized;

  for (const [key, value] of Object.entries(map)) {
    normalized[normalizeKey(key)] = value;
  }

  return normalized;
};

type PickInterestingMapOptions = {
  current: MachineMap | null | undefined;
  states?: MachineState[];
  seed?: MachineMap;
};

function pickInterestingMap({
  current,
  states = [],
  seed = {},
}: PickInterestingMapOptions): MachineMap {
  const normalizedCurrent = normalizeMap(current);
  const normalizedSeed = normalizeMap(seed);
  const normalizedStates = states.map((state) => ({
    registers: normalizeMap(state.registers),
    memory: normalizeMap(state.memory),
  }));

  const candidateKeys = new Set<string>([
    ...Object.keys(normalizedSeed),
    ...Object.keys(normalizedCurrent),
  ]);

  for (const state of normalizedStates) {
    for (const key of Object.keys(state.registers)) candidateKeys.add(key);
    for (const key of Object.keys(state.memory)) candidateKeys.add(key);
  }

  const interestingKeys = new Set<string>();

  for (const key of candidateKeys) {
    let previousValue = normalizedSeed[key] ?? ZERO_HEX;

    if (hasOwn(normalizedSeed, key)) {
      interestingKeys.add(key);
    }

    for (const state of normalizedStates) {
      const nextValue =
        state.registers[key] ??
        state.memory[key] ??
        previousValue;

      if (normalizeValue(nextValue) !== normalizeValue(previousValue)) {
        interestingKeys.add(key);
      }

      previousValue = nextValue;
    }

    const currentValue = normalizedCurrent[key];
    if (
      typeof currentValue === "string" &&
      normalizeValue(currentValue) !== normalizeValue(previousValue)
    ) {
      interestingKeys.add(key);
    }
  }

  if (interestingKeys.size === 0) {
    return Object.fromEntries(
      Object.entries(normalizedCurrent).filter(
        ([, value]) => normalizeValue(value) !== ZERO_HEX
      )
    );
  }

  return Object.fromEntries(
    Array.from(interestingKeys)
      .map((key) => [key, normalizedCurrent[key] ?? normalizedSeed[key] ?? ZERO_HEX] as const)
      .filter(([, value]) => typeof value === "string")
  );
}

export function pickInterestingRegisters(options: PickInterestingMapOptions) {
  const registerStates = (options.states ?? []).map((state) => ({
    registers: state.registers,
    memory: {},
  }));

  return pickInterestingMap({
    current: options.current,
    states: registerStates,
    seed: options.seed,
  });
}

export function pickInterestingMemory(options: PickInterestingMapOptions) {
  const memoryStates = (options.states ?? []).map((state) => ({
    registers: {},
    memory: state.memory,
  }));

  return pickInterestingMap({
    current: options.current,
    states: memoryStates,
    seed: options.seed,
  });
}

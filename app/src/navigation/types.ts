import type { ScanResult } from "../engine";

export type ScanStackParamList = {
  Scan: undefined;
  Result: { result: ScanResult };
};

export type TabParamList = {
  ScanTab: undefined;
  ShelfTab: undefined;
  SettingsTab: undefined;
};

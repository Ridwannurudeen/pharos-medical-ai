import type { ScanResult } from "../engine";
import type { MeshStatus, ResultNotice } from "../mesh";

export type ScanStackParamList = {
  Scan: undefined;
  Result: {
    result: ScanResult;
    meshStatus?: MeshStatus;
    notice?: ResultNotice;
  };
};

export type TabParamList = {
  ScanTab: undefined;
  ShelfTab: undefined;
  SettingsTab: undefined;
};

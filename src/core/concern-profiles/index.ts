import type { ExtractionResult } from "../schema";
import { collectFormStateConcernProfile } from "./form-state";
import { collectReactNativeAccessibilityConcernProfile } from "./react-native-accessibility";
import type { FrontendConcernProfile } from "./types";
import { collectValidationSchemaConcernProfile } from "./validation-schema";

export function collectFrontendConcernProfiles(result: ExtractionResult): FrontendConcernProfile[] | undefined {
  const profiles = [
    collectFormStateConcernProfile(result),
    collectReactNativeAccessibilityConcernProfile(result),
    collectValidationSchemaConcernProfile(result),
  ].filter((value): value is FrontendConcernProfile => Boolean(value));

  return profiles.length > 0 ? profiles : undefined;
}

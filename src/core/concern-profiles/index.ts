import type { ExtractionResult } from "../schema";
import { collectClientStateConcernProfile } from "./client-state";
import { collectFormStateConcernProfile } from "./form-state";
import { collectReactNativeAccessibilityConcernProfile } from "./react-native-accessibility";
import { collectReactNativeListRenderingConcernProfile } from "./react-native-list-rendering";
import { collectReactNativeNavigationConcernProfile } from "./react-native-navigation";
import { collectReactNativeStateActionConcernProfile } from "./react-native-state-action";
import { collectRoutingConcernProfile } from "./routing";
import type { FrontendConcernProfile } from "./types";
import { collectValidationSchemaConcernProfile } from "./validation-schema";

export function collectFrontendConcernProfiles(result: ExtractionResult): FrontendConcernProfile[] | undefined {
  const profiles = [
    collectClientStateConcernProfile(result),
    collectFormStateConcernProfile(result),
    collectReactNativeAccessibilityConcernProfile(result),
    collectReactNativeListRenderingConcernProfile(result),
    collectReactNativeNavigationConcernProfile(result),
    collectReactNativeStateActionConcernProfile(result),
    collectValidationSchemaConcernProfile(result),
    collectRoutingConcernProfile(result),
  ].filter((value): value is FrontendConcernProfile => Boolean(value));

  return profiles.length > 0 ? profiles : undefined;
}

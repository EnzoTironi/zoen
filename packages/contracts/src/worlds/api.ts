import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import {
  WorldErasureRequest,
  WorldErasureSuccess,
} from "../erasure/operations.js";
import { SharingRequest, SharingSuccess } from "../sharing/operations.js";
import {
  SubjectIdentityRequest,
  SubjectIdentitySuccess,
} from "../subject-identity/operations.js";
import { SemanticError } from "./errors.js";
import {
  CorrectionRequest,
  CorrectionSuccess,
  WorldRequest,
  WorldSuccess,
} from "./operations.js";

export const WorldApiGroup = HttpApiGroup.make("worlds").add(
  HttpApiEndpoint.post("execute", "/api/worlds/execute", {
    error: SemanticError.members,
    payload: WorldRequest,
    success: WorldSuccess,
  })
);
export const CorrectionApiGroup = HttpApiGroup.make("corrections").add(
  HttpApiEndpoint.post("execute", "/api/corrections/execute", {
    error: SemanticError.members,
    payload: CorrectionRequest,
    success: CorrectionSuccess,
  })
);
export const WorldApi = HttpApi.make("zoen-worlds").add(WorldApiGroup);
export const SharingApiGroup = HttpApiGroup.make("sharing").add(
  HttpApiEndpoint.post("execute", "/api/sharing/execute", {
    error: SemanticError.members,
    payload: SharingRequest,
    success: SharingSuccess,
  })
);
export const SubjectIdentityApiGroup = HttpApiGroup.make("subjectIdentity").add(
  HttpApiEndpoint.post("execute", "/api/subject-identity/execute", {
    error: SemanticError.members,
    payload: SubjectIdentityRequest,
    success: SubjectIdentitySuccess,
  })
);
/** Domain path — prefer /api/erasure over a new /api/d03/ segment. */
export const ErasureApiGroup = HttpApiGroup.make("erasure").add(
  HttpApiEndpoint.post("execute", "/api/erasure/execute", {
    error: SemanticError.members,
    payload: WorldErasureRequest,
    success: WorldErasureSuccess,
  })
);
export const ApplicationApi = WorldApi.add(
  CorrectionApiGroup,
  SharingApiGroup,
  SubjectIdentityApiGroup,
  ErasureApiGroup
);

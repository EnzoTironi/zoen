import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import { SharingRequest, SharingSuccess } from "../sharing/operations.js";
import {
  SubjectIdentityRequest,
  SubjectIdentitySuccess,
} from "../subject-identity/operations.js";
import { D01Error } from "./errors.js";
import {
  CorrectionRequest,
  CorrectionSuccess,
  D01Request,
  D01Success,
} from "./operations.js";

export const D01ApiGroup = HttpApiGroup.make("d01").add(
  HttpApiEndpoint.post("execute", "/api/d01/execute", {
    error: D01Error.members,
    payload: D01Request,
    success: D01Success,
  })
);
export const CorrectionApiGroup = HttpApiGroup.make("corrections").add(
  HttpApiEndpoint.post("execute", "/api/d01/corrections", {
    error: D01Error.members,
    payload: CorrectionRequest,
    success: CorrectionSuccess,
  })
);
export const D01Api = HttpApi.make("zoen-d01").add(D01ApiGroup);
export const SharingApiGroup = HttpApiGroup.make("sharing").add(
  HttpApiEndpoint.post("execute", "/api/d03/sharing", {
    error: D01Error.members,
    payload: SharingRequest,
    success: SharingSuccess,
  })
);
export const SubjectIdentityApiGroup = HttpApiGroup.make("subjectIdentity").add(
  HttpApiEndpoint.post("execute", "/api/d02/subject-identity", {
    error: D01Error.members,
    payload: SubjectIdentityRequest,
    success: SubjectIdentitySuccess,
  })
);
export const ApplicationApi = D01Api.add(
  CorrectionApiGroup,
  SharingApiGroup,
  SubjectIdentityApiGroup
);

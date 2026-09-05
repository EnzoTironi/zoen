import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { EX03Fixture } from "./ex03-fixture.tsx";
import { views } from "./fixtures.ts";

const state = new URLSearchParams(window.location.search).get("state");
const view =
  Object.entries(views).find(([name]) => name === state)?.[1] ??
  views.inspection;
const container = document.querySelector("#root");

if (!container) {
  throw new Error("O elemento de montagem do teste de componente não existe.");
}

createRoot(container).render(
  <StrictMode>
    {state === "context-change" ? (
      <EX03Fixture
        view={view}
        nextView={{
          inspection: {
            ...views.inspection.inspection,
            interactionKey: "synthetic-inspection-b",
          },
          kind: "inspection",
        }}
      />
    ) : (
      <EX03Fixture view={view} />
    )}
  </StrictMode>
);

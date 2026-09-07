import { createRoot } from "react-dom/client";

import { WorldsFeature } from "./features/worlds/feature.tsx";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Application root is missing");
}
createRoot(root).render(<WorldsFeature />);

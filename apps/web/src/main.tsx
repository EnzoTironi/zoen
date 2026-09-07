import { createRoot } from "react-dom/client";

import { D01Feature } from "./features/worlds/feature.tsx";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Application root is missing");
}
createRoot(root).render(<D01Feature />);

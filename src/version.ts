import { version } from "../package.json";
export const APP_VERSION = version;
export const RELEASE_BUILD = import.meta.env.VITE_RELEASE_CANDIDATE === "true";

// Explicit opt-in for developer builds; persisted flags cannot expose tools.
export const DEVELOPER_TOOLS_ENABLED =
  !RELEASE_BUILD && import.meta.env.VITE_DEVELOPER_TOOLS === "true";

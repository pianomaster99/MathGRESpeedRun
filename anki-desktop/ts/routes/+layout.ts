// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

import { setupGlobalI18n } from "@tslib/i18n";
import { checkNightMode } from "@tslib/nightmode";

import type { LayoutLoad } from "./$types";

export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async () => {
    checkNightMode();
    try {
        await setupGlobalI18n();
    } catch (err) {
        // The i18n resources are served by the Rust backend. Some standalone
        // pages (e.g. the Teach-Back learning mode running under `vite dev`
        // without the backend) don't have it available; degrade gracefully
        // rather than breaking every route.
        console.warn("i18n setup skipped:", err);
    }
};

/// <reference types="vite/client" />

declare const __BUILD_TAG__: string;
declare const __PLUGIN_BUILD__: boolean;

// Published by the native side before the page loads (BridgedWebView's user
// script, enkerli-juce). Absent in the browser build, where there is no binary
// and staleness is not a question.
declare const __CPP_BUILD_TAG__: string | undefined;
declare const __CPP_COMPILED__: string | undefined;

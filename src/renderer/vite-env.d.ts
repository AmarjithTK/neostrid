/// <reference types="vite/client" />

import type * as React from "react";

type BrowserWebviewElement = HTMLElement & {
	canGoBack: () => boolean;
	canGoForward: () => boolean;
	goBack: () => void;
	goForward: () => void;
	reload: () => void;
};

declare namespace JSX {
	interface IntrinsicElements {
		webview: React.DetailedHTMLProps<React.HTMLAttributes<BrowserWebviewElement>, BrowserWebviewElement> & {
			src?: string;
			partition?: string;
			allowpopups?: string;
		};
	}
}

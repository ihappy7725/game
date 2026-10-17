import type { BrowserContext, CDPSession, Page } from "@playwright/test";
export function attachDesktopWindow(context: BrowserContext, page: Page): Promise<CDPSession>;

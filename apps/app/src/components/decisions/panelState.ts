import { parseAsStringLiteral } from 'nuqs';

export const PANEL_TABS = ['updates', 'resources'] as const;
export type PanelTab = (typeof PANEL_TABS)[number];

export const panelStateParser = parseAsStringLiteral(PANEL_TABS);

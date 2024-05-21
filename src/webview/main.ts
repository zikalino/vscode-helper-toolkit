// file: src/webview/main.ts

import { provideVSCodeDesignSystem, vsCodeBadge, vsCodeButton, vsCodeCheckbox, vsCodeDataGrid, vsCodeDataGridCell, vsCodeDataGridRow, vsCodeDivider, vsCodeDropdown, vsCodeLink, vsCodeOption, vsCodePanelTab, vsCodePanelView, vsCodePanels, vsCodeProgressRing, vsCodeRadio, vsCodeRadioGroup, vsCodeTag, vsCodeTextArea, vsCodeTextField } from "@vscode/webview-ui-toolkit";

provideVSCodeDesignSystem().register(vsCodeButton());
provideVSCodeDesignSystem().register(vsCodeCheckbox());
provideVSCodeDesignSystem().register(vsCodeDataGrid());
provideVSCodeDesignSystem().register(vsCodeDataGridCell());
provideVSCodeDesignSystem().register(vsCodeDataGridRow());
provideVSCodeDesignSystem().register(vsCodeDropdown());
provideVSCodeDesignSystem().register(vsCodeOption());
provideVSCodeDesignSystem().register(vsCodeBadge());
provideVSCodeDesignSystem().register(vsCodeDivider());
provideVSCodeDesignSystem().register(vsCodeLink());
provideVSCodeDesignSystem().register(vsCodePanelTab());
provideVSCodeDesignSystem().register(vsCodePanelView());
provideVSCodeDesignSystem().register(vsCodePanels());
provideVSCodeDesignSystem().register(vsCodeProgressRing());
provideVSCodeDesignSystem().register(vsCodeRadio());
provideVSCodeDesignSystem().register(vsCodeRadioGroup());
provideVSCodeDesignSystem().register(vsCodeTag());
provideVSCodeDesignSystem().register(vsCodeTextArea());
provideVSCodeDesignSystem().register(vsCodeTextField());

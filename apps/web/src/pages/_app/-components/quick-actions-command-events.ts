export const QUICK_ACTIONS_COMMAND_OPEN_EVENT = "finax:quick-actions:open";

export function openQuickActionsCommand() {
	if (typeof window === "undefined") {
		return;
	}

	window.dispatchEvent(new Event(QUICK_ACTIONS_COMMAND_OPEN_EVENT));
}

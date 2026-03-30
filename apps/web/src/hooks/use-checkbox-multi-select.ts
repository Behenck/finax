import {
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";

type CheckboxIdentifier = number | string;

type UseCheckboxMultiSelectParams<TId extends CheckboxIdentifier> = {
	visibleIds: TId[];
	isSelectable?: (id: TId) => boolean;
	toggleOne: (id: TId, checked: boolean) => void;
	toggleMany: (ids: TId[], checked: boolean) => void;
	onClearSelection?: () => void;
	enabled?: boolean;
};

type UseCheckboxMultiSelectResult<TId extends CheckboxIdentifier> = {
	onCheckboxClick: (
		id: TId,
		event: Pick<ReactMouseEvent<HTMLElement>, "shiftKey">,
	) => void;
	onCheckboxCheckedChange: (id: TId, checked: boolean) => void;
};

const DEFAULT_KEY_SEPARATOR = "\u0001";

function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof Element)) {
		return false;
	}

	if (target.closest("input, textarea, select")) {
		return true;
	}

	if (target instanceof HTMLElement && target.isContentEditable) {
		return true;
	}

	return (
		target.closest("[contenteditable]:not([contenteditable='false'])") !== null
	);
}

function resolveRangeIds<TId extends CheckboxIdentifier>(params: {
	visibleIds: TId[];
	anchorId: TId;
	currentId: TId;
	isSelectable: (id: TId) => boolean;
}) {
	const anchorIndex = params.visibleIds.findIndex((id) =>
		Object.is(id, params.anchorId),
	);
	const currentIndex = params.visibleIds.findIndex((id) =>
		Object.is(id, params.currentId),
	);

	if (anchorIndex < 0 || currentIndex < 0) {
		return [];
	}

	const [startIndex, endIndex] =
		anchorIndex <= currentIndex
			? [anchorIndex, currentIndex]
			: [currentIndex, anchorIndex];

	return params.visibleIds
		.slice(startIndex, endIndex + 1)
		.filter((id) => params.isSelectable(id));
}

export function useCheckboxMultiSelect<TId extends CheckboxIdentifier>({
	visibleIds,
	isSelectable = () => true,
	toggleOne,
	toggleMany,
	onClearSelection,
	enabled = true,
}: UseCheckboxMultiSelectParams<TId>): UseCheckboxMultiSelectResult<TId> {
	const anchorIdRef = useRef<TId | null>(null);
	const pendingShiftClickIdRef = useRef<TId | null>(null);

	const visibleIdsKey = useMemo(
		() => visibleIds.map((id) => String(id)).join(DEFAULT_KEY_SEPARATOR),
		[visibleIds],
	);

	useEffect(() => {
		anchorIdRef.current = null;
		pendingShiftClickIdRef.current = null;
	}, [visibleIdsKey]);

	const selectableVisibleIds = useMemo(
		() => visibleIds.filter((id) => isSelectable(id)),
		[isSelectable, visibleIds],
	);

	const onCheckboxClick = useCallback(
		(
			id: TId,
			event: Pick<ReactMouseEvent<HTMLElement>, "shiftKey">,
		) => {
			if (!enabled) {
				return;
			}

			pendingShiftClickIdRef.current = event.shiftKey ? id : null;
		},
		[enabled],
	);

	const onCheckboxCheckedChange = useCallback(
		(id: TId, checked: boolean) => {
			if (!enabled) {
				toggleOne(id, checked);
				return;
			}

			if (!isSelectable(id)) {
				toggleOne(id, checked);
				return;
			}

			const shouldApplyRange =
				pendingShiftClickIdRef.current !== null &&
				Object.is(pendingShiftClickIdRef.current, id) &&
				anchorIdRef.current !== null;

			pendingShiftClickIdRef.current = null;

			if (shouldApplyRange && anchorIdRef.current !== null) {
				const rangeIds = resolveRangeIds({
					visibleIds,
					anchorId: anchorIdRef.current,
					currentId: id,
					isSelectable,
				});

				if (rangeIds.length > 0) {
					toggleMany(rangeIds, checked);
					anchorIdRef.current = id;
					return;
				}
			}

			toggleOne(id, checked);
			anchorIdRef.current = id;
		},
		[enabled, isSelectable, toggleMany, toggleOne, visibleIds],
	);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented) {
				return;
			}

			if (event.key === "Escape") {
				if (isEditableTarget(event.target)) {
					return;
				}

				if (onClearSelection) {
					onClearSelection();
					return;
				}

				if (selectableVisibleIds.length > 0) {
					toggleMany(selectableVisibleIds, false);
				}
				return;
			}

			if (!(event.ctrlKey || event.metaKey)) {
				return;
			}

			if (event.key.toLowerCase() !== "a") {
				return;
			}

			if (isEditableTarget(event.target)) {
				return;
			}

			if (selectableVisibleIds.length === 0) {
				return;
			}

			event.preventDefault();
			toggleMany(selectableVisibleIds, true);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [enabled, onClearSelection, selectableVisibleIds, toggleMany]);

	return {
		onCheckboxClick,
		onCheckboxCheckedChange,
	};
}

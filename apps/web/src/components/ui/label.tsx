import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

function highlightAsterisks(
	node: React.ReactNode,
	keyPrefix = "label",
): React.ReactNode {
	if (typeof node === "string") {
		if (!node.includes("*")) {
			return node;
		}

		const parts = node.split("*");
		return parts.flatMap((part, index) => {
			if (index === parts.length - 1) {
				return part;
			}

			return [
				part,
				<span key={`${keyPrefix}-star-${index}`} className="text-destructive">
					*
				</span>,
			];
		});
	}

	if (Array.isArray(node)) {
		return node.map((child, index) =>
			highlightAsterisks(child, `${keyPrefix}-${index}`),
		);
	}

	if (React.isValidElement(node)) {
		const elementChildren = node.props.children as React.ReactNode;

		if (elementChildren == null) {
			return node;
		}

		return React.cloneElement(
			node,
			undefined,
			highlightAsterisks(elementChildren, `${keyPrefix}-child`),
		);
	}

	return node;
}

function Label({
	className,
	children,
	...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
	return (
		<LabelPrimitive.Root
			data-slot="label"
			className={cn(
				"flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
				className,
			)}
			{...props}
		>
			{highlightAsterisks(children)}
		</LabelPrimitive.Root>
	);
}

export { Label };

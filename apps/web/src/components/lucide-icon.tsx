import type { LucideProps } from "lucide-react";
import * as Icons from "lucide-react";
import type { ComponentType } from "react";

type LucideIcon = ComponentType<LucideProps>;

const FallbackIcon = Icons.HelpCircle;

export function getLucideIcon(iconName: string): LucideIcon {
	const Icon = Icons[iconName as keyof typeof Icons];

	if (!Icon) {
		console.warn("Ícone não encontrado:", iconName);
		return FallbackIcon;
	}

	return Icon as LucideIcon;
}

import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { AvatarDropDown } from "./avatar";

export function AppTopHeader() {
	return (
		<header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
			<div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-10">
				<div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
					<span className="hidden sm:inline">Ações rápidas</span>
					<KbdGroup>
						<Kbd>Ctrl</Kbd>
						<span>+</span>
						<Kbd>K</Kbd>
					</KbdGroup>
				</div>

				<AvatarDropDown />
			</div>
		</header>
	);
}

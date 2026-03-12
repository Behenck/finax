import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useSidebar } from "@/components/ui/sidebar";
import { PanelLeftIcon, Search } from "lucide-react";
import { AvatarDropDown } from "./avatar";
import { openQuickActionsCommand } from "./quick-actions-command";

export function AppTopHeader() {
	const { isMobile, openMobile, setOpenMobile, toggleSidebar } = useSidebar();

	function handleSidebarToggle() {
		if (isMobile) {
			setOpenMobile(!openMobile);
			return;
		}

		toggleSidebar();
	}

	return (
		<header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
			<div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-6 lg:px-10">
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-9 md:hidden"
						onClick={handleSidebarToggle}
						title={openMobile ? "Fechar menu" : "Abrir menu"}
						aria-label={openMobile ? "Fechar menu" : "Abrir menu"}
					>
						<PanelLeftIcon className="size-5" />
					</Button>

					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={openQuickActionsCommand}
						className="h-9 gap-2 px-2.5 md:hidden"
						aria-label="Abrir ações rápidas"
					>
						<Search className="size-4" />
						<span className="text-xs">Ações</span>
					</Button>

					<div className="hidden items-center gap-2 text-xs text-muted-foreground sm:text-sm md:flex">
						<span>Ações rápidas</span>
						<KbdGroup>
							<Kbd>Ctrl</Kbd>
							<span>+</span>
							<Kbd>K</Kbd>
						</KbdGroup>
					</div>
				</div>

				<AvatarDropDown />
			</div>
		</header>
	);
}

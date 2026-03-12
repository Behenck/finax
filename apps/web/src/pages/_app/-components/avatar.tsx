import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/context/app-context";
import { useSignOut } from "@/hooks/auth/use-sign-out";
import { getInitials } from "@/utils/get-initials";
import { Link } from "@tanstack/react-router";
import { LogOut, User, UserRound } from "lucide-react";

export function AvatarDropDown() {
	const { auth } = useApp();
	const { mutateAsync: signOut, isPending } = useSignOut();

	async function handleSignOut() {
		await signOut();
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-10 rounded-full p-0 focus-visible:ring-2 focus-visible:ring-ring/50"
					aria-label="Abrir menu do perfil"
				>
					<Avatar>
						<AvatarImage src={auth?.avatarUrl ?? undefined} alt="@behenck" />
						<AvatarFallback>
							{auth?.name ? getInitials(auth.name) : <User className="h-4 w-4" />}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="min-w-52" align="end">
				<DropdownMenuLabel className="flex flex-col">
					<span>{auth?.name}</span>
					<span className="text-xs text-muted-foreground">{auth?.email}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to="/profile">
						<UserRound className="size-4" />
						Meu perfil
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={(event) => {
						event.preventDefault();
						void handleSignOut();
					}}
					disabled={isPending}
				>
					<LogOut className="size-4" />
					{isPending ? "Saindo..." : "Sair"}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

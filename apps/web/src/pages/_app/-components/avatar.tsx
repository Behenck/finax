import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/context/app-context";
import { getInitials } from "@/utils/get-initials";
import { Link } from "@tanstack/react-router";
import { LogOut, User, UserRound } from "lucide-react";

export function AvatarDropDown() {
	const { auth } = useApp();
	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
				<Avatar>
					<AvatarImage src={auth?.avatarUrl ?? undefined} alt="@behenck" />
					<AvatarFallback>
						{auth?.name ? getInitials(auth.name) : <User className="h-4 w-4" />}
					</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="mr-6 min-w-52" align="end">
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
				<DropdownMenuItem asChild>
					<Link to="/sign-out">
						<LogOut className="size-4" />
						Sair
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

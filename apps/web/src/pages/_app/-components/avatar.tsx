import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useApp } from "@/context/app-context";
import { getInitials } from "@/utils/get-initials";
import { Link } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";

export function AvatarDropDown() {
  const { auth } = useApp()
  return (

    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar>
          <AvatarImage src={auth?.avatarUrl} alt="@behenck" />
          <AvatarFallback>
            {auth?.name
              ? getInitials(auth.name)
              : <User className="h-4 w-4" />
            }
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="mr-6">
        <DropdownMenuLabel className="flex flex-col">
          <span>{auth?.name}</span>
          <span className="text-xs text-muted-foreground">{auth?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Button variant="ghost" className="w-full" asChild>
            <Link to="/sign-out" className="flex w-full items-center justify-between!">
              <span>Sair</span>
              <LogOut />
            </Link>
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu >
  )
}
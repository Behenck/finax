import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { BookUser, Building2, ListChevronsUpDown, Mail, Percent, Phone, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { type GetOrganizationsSlugSellersSellerid200 } from "@/http/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/utils/get-initials";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatPhone } from "@/utils/format-phone";
import { formatDocument } from "@/utils/format-document";
import { Card } from "@/components/ui/card";

interface DetailsSellerProps {
  seller: GetOrganizationsSlugSellersSellerid200["seller"]
}

export function DetailsSeller({ seller }: DetailsSellerProps) {
  return (
    <Dialog>
      <DialogTrigger>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <div className='flex gap-4 items-center'>
            <ListChevronsUpDown className='size-3.5 text-foreground' />
            <span className='font-light text-sm'>Ver Detalhes</span>
          </div>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="space-y-2">
        <DialogHeader>
          <DialogTitle>Detalhes do Vendedor</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4">
          <Avatar className="rounded-md! w-full h-full max-w-24">
            <AvatarImage src="" />
            <AvatarFallback className="rounded-md!">{getInitials(seller.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1 flex-1">
            <h2 className="font-bold text-xl">{seller.name}</h2>
            <span>{seller.companyName}</span>
            <Badge>
              {seller.status === "ACTIVE" ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <h3 className="font-normal mb-2 uppercase">Contato</h3>
          {seller.email && (
            <div className="flex items-center gap-2">
              <Mail className="size-4" />
              <span className="text-sm font-light">{seller.email}</span>
            </div>
          )}
          {seller.phone && (
            <div className="flex items-center gap-2">
              <Phone className="size-4" />
              <span className="text-sm font-light">{formatPhone(seller.phone)}</span>
            </div>
          )}
          {seller.companyName && (
            <div className="flex items-center gap-2">
              <Building2 className="size-4" />
              <span className="text-sm font-light">{seller.companyName}</span>
            </div>
          )}
          {seller.document && (
            <div className="flex items-center gap-2">
              <BookUser className="size-4" />
              <span className="text-sm font-light">{formatDocument({ type: seller.documentType, value: seller.document })}</span>
            </div>
          )}
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <h3 className="font-normal mb-2 uppercase">Desempenho</h3>
          <div className="flex gap-4">
            <Card className="p-3 w-full gap-2">
              <header className="flex gap-2">
                <TrendingUp className="size-4" />
                <span className="font-light text-xs">Vendas</span>
              </header>
              <span className="font-bold text-2xl">0</span>
            </Card>
            <Card className="p-3 w-full gap-2">
              <header className="flex gap-2">
                <Percent className="size-4" />
                <span className="font-light text-xs">Comissão</span>
              </header>
              <span className="font-bold text-2xl text-green-600">R$ 0,00</span>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>

  )
}
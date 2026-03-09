import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { GetOrganizationsSlugPartners200 } from "@/http/generated"
import { Link } from "@tanstack/react-router"
import { Edit3, EllipsisVertical, Receipt, UserRoundCheck, UserRoundX } from "lucide-react"
import { AssignSupervisor } from "./assign-supervisor"
import { DetailsPartner } from "./details-partner"
import { DeletePartner } from "./delete-partner"

interface ListPartnersProps {
  partners: GetOrganizationsSlugPartners200["partners"]
}

export function ListPartners({ partners }: ListPartnersProps) {
  return (
    <Table>
      <TableCaption>Lista de parceiros</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Parceiro</TableHead>
          <TableHead>Empresa</TableHead>
          <TableHead>Supervisor</TableHead>
          <TableHead>Acesso</TableHead>
          <TableHead>Vendas</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {partners.map((partner) => {
          return (
            <TableRow key={partner.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-semibold">{partner.name}</span>
                  <span className="text-xs text-muted-foreground">{partner.email}</span>
                </div>
              </TableCell>
              <TableCell>{partner.companyName}</TableCell>
              <TableCell>
                {!!partner.supervisor ? (
                  <Badge variant="outline">
                    <span className="text-medium">{partner.supervisor.name}</span>
                  </Badge>
                ) : (
                  <span>-</span>
                )}
              </TableCell>
              <TableCell>
                {!!partner.user ? (
                  <Badge variant="outline" className="flex gap-2">
                    <UserRoundCheck className="size-3" />
                    <span className="text-medium">Vinculado</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="flex gap-2">
                    <UserRoundX className="size-3" />
                    <span className="text-medium">Sem acesso</span>
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <span className="text-medium text-green-600">R$ 0,00</span>
              </TableCell>
              <TableCell>
                <Badge>
                  Ativo
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost">
                        <EllipsisVertical className="size-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="mr-4">
                      <DropdownMenuGroup className="space-y-1">
                        <DetailsPartner partner={partner} />
                        <DropdownMenuItem asChild>
                          <Link to="/registers/partners/update" search={{ partnerId: partner.id }} className='cursor-pointer'>
                            <div className='flex gap-4 items-center'>
                              <Edit3 className='size-3.5 text-foreground' />
                              <span className='font-light text-sm'>Editar</span>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/" className='cursor-pointer'>
                            <div className='flex gap-4 items-center'>
                              <Receipt className='size-3.5 text-foreground' />
                              <span className='font-light text-sm'>Ver Vendas</span>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                        <AssignSupervisor partner={partner} />
                        <Separator />
                        <DeletePartner partner={partner} />
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

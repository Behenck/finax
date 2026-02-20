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
import type { GetOrganizationsSlugSellers200 } from "@/http/generated"
import { Link } from "@tanstack/react-router"
import { Edit3, EllipsisVertical, Receipt, UserRoundCheck, UserPlus, Trash2, UserRoundX } from "lucide-react"
import { DetailsSeller } from "./details-seller"

interface ListSellersProps {
  sellers: GetOrganizationsSlugSellers200["sellers"]
}

export function ListSellers({ sellers }: ListSellersProps) {
  return (
    <Table>
      <TableCaption>Lista de vendedores</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Vendedor</TableHead>
          <TableHead>Empresa</TableHead>
          <TableHead>Acesso</TableHead>
          <TableHead>Vendas</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sellers.map((seller) => {
          return (
            <TableRow key={seller.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-semibold">{seller.name}</span>
                  <span className="text-xs text-muted-foreground">{seller.email}</span>
                </div>
              </TableCell>
              <TableCell>{seller.companyName}</TableCell>
              <TableCell>
                {!!seller.user ? (
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
                        <DetailsSeller seller={seller} />
                        <DropdownMenuItem asChild>
                          <Link to="/registers/sellers/update" search={{ sellerId: seller.id }} className='cursor-pointer'>
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
                        <Separator />
                        <DropdownMenuItem asChild>
                          <Link to="/" className='cursor-pointer'>
                            <div className='flex gap-4 items-center '>
                              <Trash2 className='size-3.5 text-red-500' />
                              <span className='text-sm text-red-500'>Desativar</span>
                            </div>
                          </Link>
                        </DropdownMenuItem>
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
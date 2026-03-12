import { Card } from "@/components/ui/card"
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
import { ResponsiveDataView } from "@/components/responsive-data-view"
import type { GetOrganizationsSlugSellers200 } from "@/http/generated"
import { Link } from "@tanstack/react-router"
import { Edit3, EllipsisVertical, Receipt, UserRoundCheck, Trash2, UserRoundX } from "lucide-react"
import { formatPhone } from "@/utils/format-phone"
import { DetailsSeller } from "./details-seller"

interface ListSellersProps {
  sellers: GetOrganizationsSlugSellers200["sellers"]
}

export function ListSellers({ sellers }: ListSellersProps) {
  function renderAccessBadge(hasUser: boolean) {
    if (hasUser) {
      return (
        <Badge variant="outline" className="flex w-fit items-center gap-2">
          <UserRoundCheck className="size-3" />
          <span className="text-medium">Vinculado</span>
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="flex w-fit items-center gap-2">
        <UserRoundX className="size-3" />
        <span className="text-medium">Sem acesso</span>
      </Badge>
    )
  }

  return (
    <ResponsiveDataView
      mobile={
        <section className="space-y-3">
          {sellers.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhum vendedor encontrado.
            </Card>
          ) : (
            sellers.map((seller) => (
              <Card key={seller.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{seller.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {seller.email ?? "Sem e-mail"}
                    </p>
                  </div>
                  <Badge variant={seller.status === "ACTIVE" ? "default" : "outline"}>
                    {seller.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">Empresa</p>
                    <p>{seller.companyName}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">Contato</p>
                    <p>{seller.phone ? formatPhone(seller.phone) : "Sem telefone"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">Acesso</p>
                    {renderAccessBadge(Boolean(seller.user))}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">Vendas</p>
                    <p className="text-medium text-green-600">R$ 0,00</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/">Ver Vendas</Link>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="!min-h-8">
                        <EllipsisVertical className="size-4" />
                        Ações
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
              </Card>
            ))
          )}
        </section>
      }
      desktop={
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
            {sellers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhum vendedor encontrado.
                </TableCell>
              </TableRow>
            ) : (
              sellers.map((seller) => {
                return (
                  <TableRow key={seller.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{seller.name}</span>
                        <span className="text-xs text-muted-foreground">{seller.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>{seller.companyName}</TableCell>
                    <TableCell>{renderAccessBadge(Boolean(seller.user))}</TableCell>
                    <TableCell>
                      <span className="text-medium text-green-600">R$ 0,00</span>
                    </TableCell>
                    <TableCell>
                      <Badge>
                        {seller.status === "ACTIVE" ? "Ativo" : "Inativo"}
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
              })
            )}
          </TableBody>
        </Table>
      }
    />
  )
}

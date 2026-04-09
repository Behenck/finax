import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ResponsiveDataView } from '@/components/responsive-data-view'
import { Edit3, EllipsisVertical, Eye, Mail, MessageCircle } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Link } from '@tanstack/react-router'
import { getInitials } from '@/utils/get-initials'
import { formatPhone } from '@/utils/format-phone'
import { DeleteCustomer } from './-components/delete-customer'
import { type GetOrganizationsSlugCustomers200 } from "@/http/generated";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ListCustomersProps {
  customers: Array<
    GetOrganizationsSlugCustomers200["customers"][number] & {
      responsible?: {
        type: "SELLER" | "PARTNER"
        id: string
        name: string
      } | null
    }
  >
}

export function ListCustomers({ customers }: ListCustomersProps) {
  return (
    <ResponsiveDataView
      mobile={
        <div className="space-y-3">
          {customers.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </Card>
          ) : (
            customers.map((customer) => (
              <Card key={customer.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar>
                      <AvatarImage />
                      <AvatarFallback>{getInitials(customer.name ?? "")}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{customer.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{customer.email ?? "Sem e-mail"}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {customer.personType === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">Responsável</p>
                    {customer.responsible ? (
                      <p>
                        {customer.responsible.name}{" "}
                        <span className="text-muted-foreground">
                          ({customer.responsible.type === "SELLER" ? "Vendedor" : "Parceiro"})
                        </span>
                      </p>
                    ) : (
                      <p>Não vinculado</p>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">Contato</p>
                    <div className="space-y-1">
                      {customer.phone ? (
                        <div className="flex items-center gap-1.5">
                          <MessageCircle className="size-3.5" />
                          <span>{formatPhone(customer.phone)}</span>
                        </div>
                      ) : null}
                      {customer.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="size-3.5" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      ) : null}
                      {!customer.phone && !customer.email ? <span>Não informado</span> : null}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to="/registers/customers/$customerId"
                      params={{ customerId: customer.id }}
                    >
                      <Eye className="size-4" />
                      Ver cliente
                    </Link>
                  </Button>

                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to="/sales/create"
                      search={{
                        customerId: customer.id,
                      }}
                    >
                      Adicionar venda
                    </Link>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="!min-h-8">
                        <EllipsisVertical className="size-4" />
                        Ações
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem asChild>
                          <Link
                            to="/registers/customers/update"
                            search={{ customerId: customer.id }}
                            className='cursor-pointer'
                          >
                            <div className='flex items-center gap-4'>
                              <Edit3 className='size-3.5 text-foreground' />
                              <span className='text-sm font-light'>Editar</span>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                        <DeleteCustomer customer={customer} />
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            ))
          )}
        </div>
      }
      desktop={
        <Table>
          <TableCaption>Lista de clientes.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => {
              return (
                <TableRow key={customer.id} className='cursor-pointer'>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <Checkbox className='h-5 w-5' />
                      <Avatar>
                        <AvatarImage />
                        <AvatarFallback>{getInitials(customer.name ?? "")}</AvatarFallback>
                      </Avatar>
                      <span className='text-sm font-medium'>{customer.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {customer.personType === "PF" ? (
                        "Pessoa Física"
                      ) : (
                        "Pessoa Jurídica"
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {customer.responsible ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{customer.responsible.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {customer.responsible.type === "SELLER" ? "Vendedor" : "Parceiro"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Não vinculado</span>
                    )}
                  </TableCell>
                  <TableCell className='flex items-center gap-6'>
                    {(customer.phone || customer.email) && (
                      <div>
                        {customer.phone && (
                          <div className='flex items-center gap-2'>
                            <MessageCircle className='h-3 w-3' />
                            <span className='text-[10px] font-medium'>
                              {formatPhone(customer.phone)}
                            </span>
                          </div>
                        )}
                        {customer.email && (
                          <div className='flex items-center gap-2'>
                            <Mail className='h-3 w-3' />
                            <span className='text-[10px] font-medium'>
                              {customer.email}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center justify-end'>
                      <Button
                        variant="link"
                        className='text-xs text-muted-foreground hover:text-foreground hover:no-underline'
                        asChild
                      >
                        <Link
                          to="/registers/customers/$customerId"
                          params={{ customerId: customer.id }}
                        >
                          Ver Cliente
                        </Link>
                      </Button>
                      <Button
                        variant="link"
                        className='text-xs text-muted-foreground hover:text-foreground hover:no-underline'
                        asChild
                      >
                        <Link
                          to="/sales/create"
                          search={{
                            customerId: customer.id,
                          }}
                        >
                          Adicionar Venda
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="link" className='text-muted-foreground'>
                            <EllipsisVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                              <Link to="/registers/customers/update" search={{ customerId: customer.id }} className='cursor-pointer'>
                                <div className='flex items-center gap-4'>
                                  <Edit3 className='size-3.5 text-foreground' />
                                  <span className='text-sm font-light'>Editar</span>
                                </div>
                              </Link>
                            </DropdownMenuItem>
                            <DeleteCustomer customer={customer} />
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
      }
    />
  )
}

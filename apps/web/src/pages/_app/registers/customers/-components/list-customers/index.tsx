import { useApp } from "@/context/app-context";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Edit3, EllipsisVertical, Mail, MessageCircle } from 'lucide-react'
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
import { useGetOrganizationsSlugCustomers, type GetOrganizationsSlugCustomers200 } from "@/http/generated";
import { Table, TableBody, TableCaption, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ListCustomersProps {
  customers: GetOrganizationsSlugCustomers200["customers"]
}

export function ListCustomers({ customers }: ListCustomersProps) {
  return (
    <Table>
      <TableCaption>Lista de clientes.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Contato</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {
          customers.map((customer) => {
            return (
              <TableRow className='cursor-pointer'>
                <TableCell>
                  <div className='flex gap-2 items-center'>
                    <Checkbox className='w-5 h-5' />
                    <Avatar>
                      <AvatarImage />
                      <AvatarFallback>{getInitials(customer.name ?? "")}</AvatarFallback>
                    </Avatar>
                    <span className='font-medium text-sm'>{customer.name}</span>
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
                <TableCell className='flex items-center gap-6'>
                  {(customer.phone || customer.email) && (
                    <>
                      <div>
                        {customer.phone && (
                          <div className='flex items-center gap-2'>
                            <MessageCircle className='w-3 h-3' />
                            <span className='text-[10px] font-medium'>
                              {formatPhone(customer.phone)}
                            </span>
                          </div>
                        )}
                        {customer.email && (
                          <div className='flex items-center gap-2'>
                            <Mail className='w-3 h-3' />
                            <span className='text-[10px] font-medium'>
                              {customer.email}
                            </span>
                          </div>
                        )}
                      </div></>
                  )}
                </TableCell>
                <TableCell>
                  <div className='flex items-center justify-end'>
                    <Button variant="link" className='text-muted-foreground text-xs hover:no-underline hover:text-foreground'>
                      Adicionar Venda
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
                              <div className='flex gap-4 items-center'>
                                <Edit3 className='size-3.5 text-foreground' />
                                <span className='font-light text-sm'>Editar</span>
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
          })
        }
      </TableBody>
    </Table>
  )
}
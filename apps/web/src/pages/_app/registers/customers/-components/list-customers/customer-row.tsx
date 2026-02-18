import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Edit3, EllipsisVertical, Mail, MessageCircle, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Link } from '@tanstack/react-router'
import { getOrganizationsSlugCustomersQueryKey, useDeleteOrganizationsSlugCustomersCustomerid, type GetOrganizationsSlugCustomers200 } from '@/http/generated'
import { getInitials } from '@/utils/get-initials'
import { formatPhone } from '@/utils/format-phone'
import { DeleteCustomer } from './-components/delete-customer'

interface CustomerRowProps {
  customer: GetOrganizationsSlugCustomers200["customers"][number]
}

export function CustomerRow({ customer }: CustomerRowProps) {
  return (
    <Card className='p-4 flex flex-row items-center justify-between cursor-pointer'>
      <div className='flex gap-2 items-center'>
        <Checkbox className='w-5 h-5' />
        <Avatar>
          <AvatarImage />
          <AvatarFallback>{getInitials(customer.name ?? "")}</AvatarFallback>
        </Avatar>
        <span className='font-medium text-sm'>{customer.name}</span>
      </div>
      {(customer.phone || customer.email) && (
        <div className='flex items-center gap-6'>
          <Separator orientation='vertical' className='h-10!' />
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
          </div>
        </div>
      )}
      <div className='flex items-center'>
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
              <DropdownMenuItem>
                <DeleteCustomer customer={customer} />
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  )
}
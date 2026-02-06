import { Card } from "@/components/ui/card";
import { Clock, DollarSign, TrendingDown, TrendingUp } from "lucide-react";

export function Summary() {
  return (
    <div className="flex gap-4">
      <Card className="p-8 flex-1">
        <header className="flex justify-between items-center text-green-500 font-medium">
          <TrendingUp className="text-end" />
          <span className="text-start text-sm">+12.5%</span>
        </header>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Total de receitas</span>
          <span className="text-2xl font-medium">R$ 27.000,00</span>
        </div>
      </Card>
      <Card className="p-8 flex-1">
        <header className="flex justify-between items-center text-red-500 font-medium">
          <TrendingDown className="text-end" />
          <span className="text-start text-sm">+8.3%</span>
        </header>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Total de despesas</span>
          <span className="text-2xl font-medium">R$ 1.850,00</span>
        </div>
      </Card>
      <Card className="p-8 flex-1">
        <header className="flex justify-between items-center text-green-500 font-medium">
          <DollarSign className="text-end" />
          <span className="text-start text-sm">+4.2%</span>
        </header>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Saldo Líquido</span>
          <span className="text-2xl font-medium">R$ 25.150,00</span>
        </div>
      </Card>
      <Card className="p-8 flex-1">
        <header className="flex justify-between items-centerfont-medium">
          <Clock className="text-end text-yellow-500 " />
        </header>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Transações Pendentes</span>
          <span className="text-2xl font-medium">4</span>
          <span className="text-xs text-muted-foreground">R$ 13.670,50 em aberto</span>
        </div>
      </Card>
    </div>
  )
}
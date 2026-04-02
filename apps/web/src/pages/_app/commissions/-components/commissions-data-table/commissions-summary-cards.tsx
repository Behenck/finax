import { Card } from "@/components/ui/card";
import { formatCurrencyBRL } from "@/utils/format-amount";
import type {
	InstallmentDirectionSummary,
	InstallmentSummaryBucket,
} from "./types";

interface CommissionsSummaryCardsProps {
	canViewAllCommissions: boolean;
	paySummary: InstallmentDirectionSummary;
	receiveSummary: InstallmentDirectionSummary;
	pendingSummaryForCurrentUser: InstallmentSummaryBucket;
	paidSummaryForCurrentUser: InstallmentSummaryBucket;
}

export function CommissionsSummaryCards({
	canViewAllCommissions,
	paySummary,
	receiveSummary,
	pendingSummaryForCurrentUser,
	paidSummaryForCurrentUser,
}: CommissionsSummaryCardsProps) {
	return (
		<div className="grid gap-3 md:grid-cols-2">
			{canViewAllCommissions ? (
				<>
					<Card className="p-4">
						<p className="text-sm text-muted-foreground">A pagar</p>
						<p className="text-xl font-semibold">
							{formatCurrencyBRL(paySummary.total.amount / 100)}
						</p>
						<p className="text-xs text-muted-foreground">
							Pendente: {formatCurrencyBRL(paySummary.pending.amount / 100)} ·{" "}
							{paySummary.pending.count}/{paySummary.total.count} parcelas
						</p>
					</Card>

					<Card className="p-4">
						<p className="text-sm text-muted-foreground">A receber</p>
						<p className="text-xl font-semibold">
							{formatCurrencyBRL(receiveSummary.total.amount / 100)}
						</p>
						<p className="text-xs text-muted-foreground">
							Pendente: {formatCurrencyBRL(receiveSummary.pending.amount / 100)}{" "}
							· {receiveSummary.pending.count}/{receiveSummary.total.count}{" "}
							parcelas
						</p>
					</Card>
				</>
			) : (
				<>
					<Card className="p-4">
						<p className="text-sm text-muted-foreground">A receber</p>
						<p className="text-xl font-semibold">
							{formatCurrencyBRL(pendingSummaryForCurrentUser.amount / 100)}
						</p>
						<p className="text-xs text-muted-foreground">
							{pendingSummaryForCurrentUser.count} parcela(s) pendente(s)
						</p>
					</Card>

					<Card className="p-4">
						<p className="text-sm text-muted-foreground">Recebido</p>
						<p className="text-xl font-semibold">
							{formatCurrencyBRL(paidSummaryForCurrentUser.amount / 100)}
						</p>
						<p className="text-xs text-muted-foreground">
							{paidSummaryForCurrentUser.count} parcela(s) recebida(s)
						</p>
					</Card>
				</>
			)}
		</div>
	);
}

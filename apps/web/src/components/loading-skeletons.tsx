import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type PageHeaderSkeletonProps = {
	actionCount?: number;
};

type StatsGridSkeletonProps = {
	count?: number;
};

type CardSectionSkeletonProps = {
	rows?: number;
	cardClassName?: string;
};

type ListPageSkeletonProps = {
	actionCount?: number;
	showStats?: boolean;
	statsCount?: number;
	filterCount?: number;
	itemCount?: number;
	itemClassName?: string;
};

type FormPageSkeletonProps = {
	actionCount?: number;
	showTabs?: boolean;
	sectionCount?: number;
};

type DetailPageSkeletonProps = {
	actionCount?: number;
	summaryCount?: number;
	detailCount?: number;
};

type TimelineSectionSkeletonProps = {
	itemCount?: number;
};

export function PageHeaderSkeleton({
	actionCount = 1,
}: PageHeaderSkeletonProps) {
	return (
		<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
			<div className="space-y-2">
				<Skeleton className="h-8 w-52" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
				{Array.from({ length: actionCount }, (_, index) => (
					<Skeleton
						key={`page-header-skeleton-action-${index + 1}`}
						className="h-10 w-full sm:w-32"
					/>
				))}
			</div>
		</div>
	);
}

export function StatsGridSkeleton({ count = 4 }: StatsGridSkeletonProps) {
	return (
		<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
			{Array.from({ length: count }, (_, index) => (
				<Card
					key={`stats-grid-skeleton-${index + 1}`}
					className="space-y-3 p-5"
				>
					<div className="flex items-center justify-between gap-3">
						<Skeleton className="h-4 w-28" />
						<Skeleton className="size-5 rounded-full" />
					</div>
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-3 w-32" />
				</Card>
			))}
		</div>
	);
}

export function CardSectionSkeleton({
	rows = 3,
	cardClassName = "p-6",
}: CardSectionSkeletonProps) {
	return (
		<Card className={`space-y-4 ${cardClassName}`}>
			<Skeleton className="h-6 w-40" />
			<div className="space-y-3">
				{Array.from({ length: rows }, (_, index) => (
					<Skeleton
						key={`card-section-skeleton-row-${index + 1}`}
						className="h-4 w-full"
					/>
				))}
			</div>
		</Card>
	);
}

export function ListPageSkeleton({
	actionCount = 1,
	showStats = false,
	statsCount = 4,
	filterCount = 1,
	itemCount = 5,
	itemClassName = "h-24",
}: ListPageSkeletonProps) {
	return (
		<main className="w-full space-y-6">
			<PageHeaderSkeleton actionCount={actionCount} />

			{showStats ? <StatsGridSkeleton count={statsCount} /> : null}

			<div
				className={`grid gap-3 ${filterCount > 1 ? "md:grid-cols-2 xl:grid-cols-4" : ""}`}
			>
				{Array.from({ length: filterCount }, (_, index) => (
					<Skeleton
						key={`list-page-skeleton-filter-${index + 1}`}
						className="h-10 w-full"
					/>
				))}
			</div>

			<section className="space-y-3">
				{Array.from({ length: itemCount }, (_, index) => (
					<Card key={`list-page-skeleton-item-${index + 1}`} className="p-4">
						<Skeleton className={`w-full ${itemClassName}`} />
					</Card>
				))}
			</section>
		</main>
	);
}

export function FormPageSkeleton({
	actionCount = 1,
	showTabs = false,
	sectionCount = 3,
}: FormPageSkeletonProps) {
	return (
		<main className="w-full space-y-6">
			<PageHeaderSkeleton actionCount={actionCount} />

			{showTabs ? (
				<div className="flex gap-2">
					<Skeleton className="h-10 w-24" />
					<Skeleton className="h-10 w-24" />
				</div>
			) : null}

			<div className="space-y-4">
				{Array.from({ length: sectionCount }, (_, index) => (
					<CardSectionSkeleton
						key={`form-page-skeleton-section-${index + 1}`}
						rows={index === 0 ? 4 : 5}
					/>
				))}
			</div>
		</main>
	);
}

export function DetailPageSkeleton({
	actionCount = 2,
	summaryCount = 4,
	detailCount = 4,
}: DetailPageSkeletonProps) {
	return (
		<main className="w-full space-y-6">
			<PageHeaderSkeleton actionCount={actionCount} />
			<StatsGridSkeleton count={summaryCount} />
			<div className="grid gap-4 lg:grid-cols-2">
				{Array.from({ length: detailCount }, (_, index) => (
					<CardSectionSkeleton
						key={`detail-page-skeleton-card-${index + 1}`}
						rows={4}
					/>
				))}
			</div>
		</main>
	);
}

export function TimelineSectionSkeleton({
	itemCount = 3,
}: TimelineSectionSkeletonProps) {
	return (
		<div className="space-y-4">
			{Array.from({ length: itemCount }, (_, index) => (
				<div
					key={`timeline-section-skeleton-item-${index + 1}`}
					className="flex gap-3"
				>
					<Skeleton className="mt-1 size-10 rounded-full" />
					<div className="flex-1 rounded-lg border p-4 space-y-3">
						<div className="flex items-center justify-between gap-3">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-3 w-24" />
						</div>
						<Skeleton className="h-3 w-32" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-5/6" />
					</div>
				</div>
			))}
		</div>
	);
}

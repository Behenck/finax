import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { cn } from "@/lib/utils";

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = "system" } = useTheme();

	return (
		<Sonner
			theme={theme as ToasterProps["theme"]}
			position="top-center"
			offset={{ top: 20, left: 16, right: 16 }}
			mobileOffset={{ top: 12, left: 12, right: 12 }}
			className="toaster finax-toaster group"
			toastOptions={{
				classNames: {
					toast: cn(
						"finax-toast",
						"border border-border/70 bg-background text-foreground shadow-sm",
					),
					title: "finax-toast-title",
					description: "finax-toast-description",
					content: "finax-toast-content",
					icon: "finax-toast-icon",
					closeButton: "finax-toast-close",
					actionButton: "finax-toast-action",
					cancelButton: "finax-toast-cancel",
					success: "finax-toast-success",
					error: "finax-toast-error",
					info: "finax-toast-info",
					warning: "finax-toast-warning",
					loading: "finax-toast-loading",
					default: "finax-toast-default",
				},
			}}
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			style={
				{
					"--normal-bg": "hsl(var(--background))",
					"--normal-text": "hsl(var(--foreground))",
					"--normal-border": "hsl(var(--border) / 0.72)",
					"--border-radius": "var(--radius)",
					"--success-bg": "hsl(var(--background))",
					"--success-border": "hsl(var(--success) / 0.24)",
					"--success-text": "hsl(var(--foreground))",
					"--info-bg": "hsl(var(--background))",
					"--info-border": "hsl(204 82% 72%)",
					"--info-text": "hsl(var(--foreground))",
					"--warning-bg": "hsl(var(--background))",
					"--warning-border": "hsl(var(--warning) / 0.26)",
					"--warning-text": "hsl(var(--foreground))",
					"--error-bg": "hsl(var(--background))",
					"--error-border": "hsl(var(--destructive) / 0.24)",
					"--error-text": "hsl(var(--foreground))",
				} as React.CSSProperties
			}
			{...props}
		/>
	);
};

export { Toaster };

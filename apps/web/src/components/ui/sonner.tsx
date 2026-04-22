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
						"border border-border/70 bg-popover/95 text-popover-foreground shadow-xl backdrop-blur-md",
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
					"--normal-bg": "hsl(var(--popover) / 0.96)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "hsl(var(--border) / 0.8)",
					"--border-radius": "var(--radius)",
					"--success-bg": "hsl(var(--success) / 0.14)",
					"--success-border": "hsl(var(--success) / 0.32)",
					"--success-text": "hsl(var(--foreground))",
					"--info-bg": "hsl(204 100% 96%)",
					"--info-border": "hsl(204 88% 82%)",
					"--info-text": "hsl(var(--foreground))",
					"--warning-bg": "hsl(var(--warning) / 0.16)",
					"--warning-border": "hsl(var(--warning) / 0.34)",
					"--warning-text": "hsl(var(--foreground))",
					"--error-bg": "hsl(var(--destructive) / 0.12)",
					"--error-border": "hsl(var(--destructive) / 0.3)",
					"--error-text": "hsl(var(--foreground))",
				} as React.CSSProperties
			}
			{...props}
		/>
	);
};

export { Toaster };

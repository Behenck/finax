import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
	    return (
	      <input
	        type={type}
	        className={cn(
	          "flex h-10 w-full rounded-sm border border-input/80 bg-background/90 px-3 py-2 text-base ring-offset-background shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] transition-[background-color,border-color,box-shadow] hover:border-border dark:bg-input/35 dark:hover:bg-input/50 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
	          className,
	        )}
	        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

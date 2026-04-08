import * as React from "react";
import MuiButton from "@mui/material/Button";

/**
 * Button wrapper around MUI Button.
 * Keeps the same prop interface used across the project (className, variant, size, children).
 */
function Button({
  className,
  variant = "contained",
  size = "medium",
  disabled,
  type = "button",
  onClick,
  children,
  ...props
}) {
  return (
    <MuiButton
      className={className}
      variant={variant === "default" ? "contained" : variant}
      size={size === "default" ? "medium" : size}
      disabled={disabled}
      type={type}
      onClick={onClick}
      disableElevation
      {...props}
    >
      {children}
    </MuiButton>
  );
}

export { Button };

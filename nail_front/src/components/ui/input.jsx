import * as React from "react";
import MuiTextField from "@mui/material/TextField";

/**
 * Input wrapper around MUI TextField.
 * Provides a simplified input interface compatible with existing usage.
 */
function Input({
  className,
  type,
  placeholder,
  value,
  disabled,
  id,
  onChange,
  ...props
}) {
  return (
    <MuiTextField
      className={className}
      type={type}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      id={id}
      onChange={onChange}
      variant="outlined"
      size="small"
      fullWidth
      {...props}
    />
  );
}

export { Input };

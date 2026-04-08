import * as React from "react";
import InputLabel from "@mui/material/InputLabel";

function Label({ className, children, htmlFor, ...props }) {
  return (
    <InputLabel className={className} htmlFor={htmlFor} {...props}>
      {children}
    </InputLabel>
  );
}

export { Label };

import * as React from "react";
import MuiAlert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Typography from "@mui/material/Typography";

function Alert({ className, variant, children, ...props }) {
  const severity = variant === "destructive" ? "error" : "info";

  return (
    <MuiAlert className={className} severity={severity} {...props}>
      {children}
    </MuiAlert>
  );
}

function AlertDescription({ className, children, ...props }) {
  return (
    <Typography variant="body2" className={className} {...props}>
      {children}
    </Typography>
  );
}

function AlertAction({ className, children, ...props }) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };

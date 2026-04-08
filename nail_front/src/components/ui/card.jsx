import * as React from "react";
import MuiCard from "@mui/material/Card";
import MuiCardHeader from "@mui/material/CardHeader";
import MuiCardContent from "@mui/material/CardContent";
import MuiCardActions from "@mui/material/CardActions";
import Typography from "@mui/material/Typography";

function Card({ className, children, ...props }) {
  return (
    <MuiCard className={className} elevation={0} {...props}>
      {children}
    </MuiCard>
  );
}

function CardHeader({ className, children, ...props }) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

function CardTitle({ className, children, ...props }) {
  return (
    <Typography variant="h6" component="div" className={className} {...props}>
      {children}
    </Typography>
  );
}

function CardDescription({ className, children, ...props }) {
  return (
    <Typography variant="body2" color="text.secondary" className={className} {...props}>
      {children}
    </Typography>
  );
}

function CardAction({ className, children, ...props }) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

function CardContent({ className, children, ...props }) {
  return (
    <MuiCardContent className={className} {...props}>
      {children}
    </MuiCardContent>
  );
}

function CardFooter({ className, children, ...props }) {
  return (
    <MuiCardActions className={className} {...props}>
      {children}
    </MuiCardActions>
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};

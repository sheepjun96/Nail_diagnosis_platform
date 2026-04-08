"use client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#00c09d",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#303030",
      contrastText: "#f9fafb",
    },
    error: {
      main: "#e74a3b",
    },
    background: {
      default: "#2a2a2a",
      paper: "#454545",
    },
    text: {
      primary: "#f3f4f6",
      secondary: "#c9ced6",
    },
    divider: "rgba(255, 255, 255, 0.12)",
  },
  typography: {
    fontFamily: "var(--font-nunito), sans-serif",
  },
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "#454545",
            "& fieldset": {
              borderColor: "rgba(255, 255, 255, 0.1)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(255, 255, 255, 0.2)",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#00c09d",
            },
          },
          "& .MuiInputBase-input": {
            color: "#ffffff",
            fontSize: "0.875rem",
          },
          "& .MuiInputBase-input::placeholder": {
            color: "#9ca3af",
            opacity: 1,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: "#454545",
          color: "#f9fafb",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#f3f4f6",
          fontSize: "0.875rem",
          fontWeight: 500,
        },
      },
    },
  },
});

export function MuiThemeProvider({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

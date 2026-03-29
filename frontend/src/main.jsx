import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline } from "@mui/material";
import App from "./App";
import AdminPage from "./AdminPage";

const isAdminPath = window.location.pathname === "/admin";
const RootComponent = isAdminPath ? AdminPage : App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CssBaseline />
    <RootComponent />
  </React.StrictMode>
);

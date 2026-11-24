import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";
import Skener from "./pages/Skener";
import Organizator from "./pages/Organizator";
import NoviDogadjaj from "./pages/NoviDogadjaj";

// SPA drži samo organizatora i skener (S7). Stranice kupaca (popis, događaj,
// kupnja, narudžba, uvjeti, privatnost) servira Astro iz web/ kroz binding
// `WEB`; podjela putanja je u worker/index.ts (idePremaWebu).
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Skener i pregled traže prijavu; autorizacija je server-side pri
            svakom pozivu, ruta je samo ulaz. */}
        <Route path="/skener" element={<Skener />} />
        <Route path="/organizator" element={<Organizator />} />
        <Route path="/organizator/novi" element={<NoviDogadjaj />} />
        {/* Do SPA-a dolaze samo /organizator/* i /skener; sve ostalo pod
            /organizator/ vodi na pregled prodaje. */}
        <Route path="*" element={<Navigate to="/organizator" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

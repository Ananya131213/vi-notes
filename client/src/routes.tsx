import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import EditorPage from "./pages/EditorPage";

const isAuthenticated = () => {
  return localStorage.getItem("token");
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/editor"
        element={
          isAuthenticated() ? <EditorPage /> : <Navigate to="/login" />
        }
      />
    </Routes>
  );
};

export default AppRoutes;
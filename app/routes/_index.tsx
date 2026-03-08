import { useEffect } from "react";
import { useLocation, useNavigate } from "@remix-run/react";

export default function IndexRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    navigate(`/app${location.search || ""}`, { replace: true });
  }, [navigate, location.search]);

  return null;
}

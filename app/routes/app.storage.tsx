import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export const loader = async ({}: LoaderFunctionArgs) => {
  return redirect("/app/settings");
};

export const action = async ({}: ActionFunctionArgs) => {
  return redirect("/app/settings");
};

export default function StorageRouteRedirect() {
  return null;
}

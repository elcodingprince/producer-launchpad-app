import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export const loader = async ({}: LoaderFunctionArgs) => {
  return redirect("/app");
};

export const action = async ({}: ActionFunctionArgs) => {
  return redirect("/app");
};

export default function SetupRouteRedirect() {
  return null;
}

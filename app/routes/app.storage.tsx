import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export const loader = async (_args: LoaderFunctionArgs) => {
  return redirect("/app/settings");
};

export const action = async (_args: ActionFunctionArgs) => {
  return redirect("/app/settings");
};

export default function StorageRouteRedirect() {
  return null;
}

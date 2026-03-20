import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "~/db.server";
import { authenticate } from "~/shopify.server";

type ActionData =
  | {
      success: true;
      intent: "delete_drafts";
      deletedCount: number;
    }
  | {
      success: false;
      intent: "delete_drafts" | "unknown";
      error: string;
    };

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "delete_drafts") {
    return json<ActionData>(
      {
        success: false,
        intent: "unknown",
        error: "Unknown action",
      },
      { status: 400 },
    );
  }

  const draftIds = formData.getAll("draftIds").map(String).filter(Boolean);

  if (draftIds.length === 0) {
    return json<ActionData>(
      {
        success: false,
        intent: "delete_drafts",
        error: "Select at least one draft to delete.",
      },
      { status: 400 },
    );
  }

  const result = await prisma.beatDraft.deleteMany({
    where: {
      shop: session.shop,
      id: { in: draftIds },
    },
  });

  return json<ActionData>({
    success: true,
    intent: "delete_drafts",
    deletedCount: result.count,
  });
};

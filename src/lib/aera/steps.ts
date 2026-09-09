/**
 * Plain words for what AERA just did, so the person sees a trail instead of a
 * blank wait, and so the activity log reads like sentences instead of tool names.
 */
export function stepLabel(tool: string, args: Record<string, unknown> = {}): string {
  const s = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : "");
  switch (tool) {
    case "navigate":        return "Opening " + (s("tab") || "the app");
    case "highlight":       return "Pointing at " + (s("kind") || "an item");
    case "list_queue":      return "Reading the queue";
    case "list_content":    return "Reading recent uploads";
    case "brand_summary":   return "Reading the brand";
    case "look_at_content": return "Looking at the content";
    case "social_search":   return "Searching " + (s("platform") || "the web") + " for " + (s("query") || "trends");
    case "remember":        return "Remembering that";
    case "reschedule_post": return "Moving the post";
    case "retitle_post":    return "Renaming the post";
    case "approve_post":    return "Approving the post";
    case "cancel_post":     return "Pulling the post";
    case "set_autopilot":   return "Turning autopilot " + (args.on === false ? "off" : "on");
    case "update_voice":    return "Updating the brand voice";
    case "read_voice":      return "Re-reading the brand voice";
    case "publish_now":     return "Publishing now";
    default:                return tool.replace(/_/g, " ");
  }
}

export type Step = { tool: string; label: string; ok: boolean; ms?: number };

// Conference room is disabled for this launch.
// Redirect to dashboard silently.
import { redirect } from "next/navigation";
export default function ConferenceRedirect() {
  redirect("/dashboard");
}

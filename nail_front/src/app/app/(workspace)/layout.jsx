import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { getSessionOrRedirect } from "@utils/server-session";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }) {
  const member = await getSessionOrRedirect();
  return <WorkspaceShell member={member}>{children}</WorkspaceShell>;
}

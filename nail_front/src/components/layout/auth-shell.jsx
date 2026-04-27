import Image from "next/image";
import { withBasePath } from "@utils/routes";

export function AuthShell({ children }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[radial-gradient(circle_at_top,#3b3b3b_0%,#303030_36%,#2a2a2a_100%)] px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex justify-center">
          <Image src={withBasePath("/img/ic-logo.svg")} alt="logo image" width={240} height={69} priority />
        </div>

        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  );
}

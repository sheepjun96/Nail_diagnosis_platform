import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthConfig, getSessionOrNull } from "@utils/server-session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [member, auth] = await Promise.all([getSessionOrNull(), getAuthConfig()]);
  if (member) redirect("/app");
  const available = auth?.configured === true;

  return (
    <Card className="border-white/10 bg-card/95 text-card-foreground shadow-2xl shadow-black/20">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-semibold text-primary">Login</CardTitle>
        <CardDescription>Curaxel 로그인을 통해 Nail Platform으로 이동합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          <Alert>
            <AlertDescription>
              {available
                ? "Curaxel에서 로그인하면 이 화면으로 돌아옵니다."
                : "인증 서비스에 연결할 수 없습니다. 관리자에게 연결 설정을 확인해 주세요."}
            </AlertDescription>
          </Alert>
          <Button className="w-full" href={available ? "/api/auth/login" : undefined} disabled={!available}>
            Curaxel에서 로그인
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

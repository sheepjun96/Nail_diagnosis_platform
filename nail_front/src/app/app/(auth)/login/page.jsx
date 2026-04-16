import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionOrNull } from "@utils/server-session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const member = await getSessionOrNull();
  if (member) {
    redirect("/app");
  }

  return (
    <Card className="border-white/10 bg-card/95 text-card-foreground shadow-2xl shadow-black/20">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-semibold text-primary">
          Login
        </CardTitle>
        <CardDescription>Curaxel 로그인을 통해 Nail Platform으로 이동합니다.</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-5">
          <Alert>
            {/* <AlertTitle>Redis SSO</AlertTitle> */}
            <AlertDescription>
              로그인은 Curaxel에서 처리되고, 성공 시 이 화면으로 다시 돌아옵니다.
            </AlertDescription>
          </Alert>

          <Button className="w-full" href="/api/auth/login">
            Curaxel에서 로그인
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

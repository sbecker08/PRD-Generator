import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session) {
    redirect("/");
  }

  const { callbackUrl } = await searchParams;

  return (
    <div
      className="min-h-full flex items-center justify-center px-4"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-4 shadow-md">
            <FileText size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Product Intake</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sign in to manage product requirements
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", {
                redirectTo: callbackUrl ?? "/",
              });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium shadow-sm"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 21 21"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Sign in with Microsoft
            </button>
          </form>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          Use your organisational Microsoft account to sign in.
        </p>
      </div>
    </div>
  );
}

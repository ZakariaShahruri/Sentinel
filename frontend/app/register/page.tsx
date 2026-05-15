import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div
        className="flex-1 flex items-center justify-center"
        style={{
          backgroundImage: "radial-gradient(circle, #1f2937 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm flex flex-col gap-7 shadow-2xl shadow-black/50">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-green-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg tracking-tight">Create account</h1>
              <p className="text-gray-500 text-xs mt-1">
                Register with a username, email, and password
              </p>
            </div>
          </div>

          <div className="w-full h-px bg-gray-800" />

          <RegisterForm />

          <p className="text-gray-600 text-xs text-center">
            IoT Monitoring Platform · Sentinel v1.0
          </p>
        </div>
      </div>
    </div>
  );
}

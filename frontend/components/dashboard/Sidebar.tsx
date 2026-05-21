import Link from "next/link";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Marble Game", href: "/game" },
  { label: "Game Statistics", href: "/game_statistics" },
];

export default function Sidebar() {
  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="text-white font-semibold text-base tracking-tight">Vibration Monitor</h1>
        <p className="text-gray-500 text-xs mt-0.5">IoT Monitoring Platform</p>
      </div>
      <nav className="flex flex-col p-3 gap-0.5 mt-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-gray-400 hover:text-white hover:bg-gray-800 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

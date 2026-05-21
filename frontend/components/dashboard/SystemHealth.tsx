import { ServiceStatus } from "@/types";

type SystemHealthProps = {
  services: ServiceStatus[];
};

export default function SystemHealth({ services }: SystemHealthProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-3">
      <h2 className="text-white font-semibold text-sm uppercase tracking-wide">System Health</h2>

      <div className="grid grid-cols-2 gap-2">
        {services.map((service) => (
          <div key={service.name} className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${service.connected ? "bg-green-400" : "bg-red-400"}`}
            />
            <div>
              <p className="text-gray-300 text-xs">{service.name}</p>
              <p
                className={`text-xs font-semibold ${service.connected ? "text-green-400" : "text-red-400"}`}
              >
                {service.connected ? "Connected" : "Disconnected"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

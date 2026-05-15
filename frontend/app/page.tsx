import { getEvents, getNodes } from "@/service/api";
import { mapChartData, mapEvents, mapNodes } from "@/library/mappers";
import { services } from "@/library/placeholder-data";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import NodeCard from "@/components/dashboard/NodeCard";
import EventFeed from "@/components/dashboard/EventFeed";
import SensorChart from "@/components/dashboard/SensorChart";
import SystemHealth from "@/components/dashboard/SystemHealth";

export default async function DashboardPage() {
  const [apiNodes, apiEvents] = await Promise.all([
    getNodes().catch(() => []),
    getEvents({ limit: 100 }).catch(() => []),
  ]);

  const nodes = mapNodes(apiNodes, apiEvents);
  const events = mapEvents(apiEvents);
  const chartData = mapChartData(apiEvents);

  const nodesOnline = nodes.filter((n) => n.status !== "alert").length;

  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          systemOnline={apiNodes.length > 0}
          nodesOnline={nodesOnline}
          totalNodes={nodes.length}
          uptime="2d 14h 32m"
        />

        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
          <section>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-widest mb-4">
              Nodes Overview
            </p>
            {nodes.length === 0 ? (
              <p className="text-gray-600 text-sm">No nodes are currently registered.</p>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {nodes.map((node) => (
                  <NodeCard key={node.id} node={node} />
                ))}
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <EventFeed events={events} />
            <SensorChart />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SystemHealth services={services} />
          </section>
        </main>
      </div>
    </div>
  );
}

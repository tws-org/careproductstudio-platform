import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Client, Project } from "@/lib/types";

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/unauthorized");

  const supabase = createServerSupabaseClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: projects } = await supabase
    .from("projects")
    .select("*, client:clients(name)")
    .order("created_at", { ascending: false });

  const clientList = (clients || []) as Client[];
  const projectList = (projects || []) as (Project & { client: { name: string } })[];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-brand">Admin Dashboard</h1>
      <p className="mb-8 text-sm text-gray-500">
        All clients and projects across the platform.
      </p>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Total Clients</p>
          <p className="text-2xl font-bold text-brand">{clientList.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Total Projects</p>
          <p className="text-2xl font-bold text-brand">{projectList.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Active Projects</p>
          <p className="text-2xl font-bold text-brand">
            {projectList.filter((p) => p.status === "active").length}
          </p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-medium text-brand">Clients</h2>
        {clientList.length === 0 ? (
          <p className="rounded border bg-white p-6 text-center text-gray-500">
            No clients yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Waiver</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Projects</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Added</th>
                </tr>
              </thead>
              <tbody>
                {clientList.map((client) => (
                  <tr key={client.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-brand">{client.name}</td>
                    <td className="px-4 py-3 text-gray-500">{client.email}</td>
                    <td className="px-4 py-3">
                      {client.waiver_signed ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Signed
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Not Signed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {projectList.filter((p) => p.client_id === client.id).length}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(client.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium text-brand">All Projects</h2>
        {projectList.length === 0 ? (
          <p className="rounded border bg-white p-6 text-center text-gray-500">
            No projects yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">Project</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">Client</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">Duration</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">Scope Changes</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">Direction Changes</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">Deliverables</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">Outcome Metric</th>
                </tr>
              </thead>
              <tbody>
                {projectList.map((project) => {
                  const duration =
                    project.start_date && project.actual_end_date
                      ? Math.ceil(
                          (new Date(project.actual_end_date).getTime() -
                            new Date(project.start_date).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )
                      : project.start_date && project.target_end_date
                      ? Math.ceil(
                          (new Date(project.target_end_date).getTime() -
                            new Date(project.start_date).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )
                      : null;

                  return (
                    <tr key={project.id} className="border-b last:border-0">
                      <td className="px-3 py-3 font-medium text-brand">{project.name}</td>
                      <td className="px-3 py-3 text-gray-500">{project.client?.name || "—"}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            project.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : project.status === "completed"
                              ? "bg-blue-100 text-blue-700"
                              : project.status === "on_hold"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {project.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-500">
                        {duration !== null ? `${duration} days` : "—"}
                      </td>
                      <td className="px-3 py-3">{project.scope_change_count}</td>
                      <td className="px-3 py-3">{project.direction_change_count}</td>
                      <td className="px-3 py-3">
                        {project.deliverables_shipped}/{project.deliverables_planned}
                      </td>
                      <td className="px-3 py-3 text-gray-500">
                        {project.outcome_metric_name
                          ? `${project.outcome_metric_name}: ${project.outcome_metric_baseline} → ${project.outcome_metric_followup}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

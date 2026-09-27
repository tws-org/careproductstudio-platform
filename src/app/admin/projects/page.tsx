import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Project } from "@/lib/types";

export default async function AdminProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/unauthorized");

  const supabase = createServerSupabaseClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*, client:clients(name)")
    .order("created_at", { ascending: false });

  const projectList = (projects || []) as (Project & { client: { name: string } })[];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-brand">All Projects</h1>
      <p className="mb-6 text-sm text-gray-500">
        Every project with standard metrics.
      </p>

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
                <th className="px-3 py-3 text-left font-medium text-gray-600">Start</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Target End</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Actual End</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Scope Changes</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Direction Changes</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Deliverables</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Satisfaction</th>
              </tr>
            </thead>
            <tbody>
              {projectList.map((project) => (
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
                    {project.start_date
                      ? new Date(project.start_date).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-gray-500">
                    {project.target_end_date
                      ? new Date(project.target_end_date).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-gray-500">
                    {project.actual_end_date
                      ? new Date(project.actual_end_date).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-3 py-3">{project.scope_change_count}</td>
                  <td className="px-3 py-3">{project.direction_change_count}</td>
                  <td className="px-3 py-3">
                    {project.deliverables_shipped}/{project.deliverables_planned}
                  </td>
                  <td className="px-3 py-3 text-gray-500">
                    {project.satisfaction_checkin
                      ? project.satisfaction_checkin.slice(0, 30) + "..."
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

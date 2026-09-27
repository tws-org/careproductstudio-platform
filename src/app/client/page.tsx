import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Project } from "@/lib/types";
import Link from "next/link";

export default async function ClientDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isAdmin) redirect("/admin");

  const supabase = createServerSupabaseClient();

  const { data: clientRecord } = await supabase
    .from("clients")
    .select("*")
    .eq("email", user.email)
    .single();

  if (!clientRecord) {
    return (
      <div className="rounded border bg-white p-8 text-center">
        <p className="text-gray-500">
          No client record found. Please contact your administrator.
        </p>
      </div>
    );
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("client_id", clientRecord.id)
    .order("created_at", { ascending: false });

  const projectList = (projects || []) as Project[];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-brand">My Projects</h1>
      <p className="mb-6 text-sm text-gray-500">
        Welcome back. Here are your active engagements.
      </p>

      {projectList.length === 0 ? (
        <div className="rounded border bg-white p-8 text-center">
          <p className="text-gray-500">No projects yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {projectList.map((project) => (
            <Link
              key={project.id}
              href={`/client/projects/${project.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-light hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-medium text-brand">{project.name}</h2>
                  {project.description && (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2 font-serif">
                      {project.description}
                    </p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
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
              </div>
              {project.start_date && (
                <p className="mt-2 text-xs text-gray-400">
                  Started {new Date(project.start_date).toLocaleDateString()}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

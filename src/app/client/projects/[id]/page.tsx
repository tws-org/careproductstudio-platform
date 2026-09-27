import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Project, Task } from "@/lib/types";
import TaskCard from "@/components/TaskCard";
import Link from "next/link";

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isAdmin) redirect("/admin");

  const supabase = createServerSupabaseClient();

  const { data: clientRecord } = await supabase
    .from("clients")
    .select("*")
    .eq("email", user.email)
    .single();

  if (!clientRecord) redirect("/client");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .eq("client_id", clientRecord.id)
    .single();

  if (!project) notFound();

  const projectData = project as Project;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectData.id)
    .order("created_at", { ascending: true });

  const taskList = (tasks || []) as Task[];

  return (
    <div>
      <Link
        href="/client"
        className="mb-4 inline-block text-sm text-brand hover:underline"
      >
        &larr; Back to Projects
      </Link>

      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-brand">{projectData.name}</h1>
            {projectData.description && (
              <p className="mt-1 text-gray-500 font-serif">{projectData.description}</p>
            )}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              projectData.status === "active"
                ? "bg-emerald-100 text-emerald-700"
                : projectData.status === "completed"
                ? "bg-blue-100 text-blue-700"
                : projectData.status === "on_hold"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {projectData.status.replace("_", " ")}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
          {projectData.start_date && (
            <span>
              Start: {new Date(projectData.start_date).toLocaleDateString()}
            </span>
          )}
          {projectData.target_end_date && (
            <span>
              Target: {new Date(projectData.target_end_date).toLocaleDateString()}
            </span>
          )}
          {projectData.actual_end_date && (
            <span>
              Completed:{" "}
              {new Date(projectData.actual_end_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-medium text-brand">Tasks</h2>
        {taskList.length === 0 ? (
          <p className="rounded border bg-white p-6 text-center text-gray-500">
            No tasks yet.
          </p>
        ) : (
          <div className="space-y-4">
            {taskList.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

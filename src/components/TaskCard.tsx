"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Task, Comment } from "@/lib/types";
import WarningText from "./WarningText";

export default function TaskCard({ task }: { task: Task }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchComments();
  }, [task.id]);

  async function fetchComments() {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });
    if (data) setComments(data as Comment[]);
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    const { error } = await supabase.from("comments").insert({
      task_id: task.id,
      content: newComment.trim(),
    });
    setLoading(false);

    if (!error) {
      setNewComment("");
      fetchComments();
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-brand">{task.title}</h3>
          {task.description && (
            <p className="mt-1 text-sm text-gray-500 font-serif">{task.description}</p>
          )}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            task.status === "done"
              ? "bg-emerald-100 text-emerald-700"
              : task.status === "in_progress"
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {task.status.replace("_", " ")}
        </span>
      </div>

      {task.due_date && (
        <p className="mt-1 text-xs text-gray-400">
          Due: {new Date(task.due_date).toLocaleDateString()}
        </p>
      )}

      <div className="mt-4 border-t border-gray-100 pt-4">
        <h4 className="mb-2 text-sm font-medium text-gray-600">
          Discussion ({comments.length})
        </h4>

        {comments.length > 0 && (
          <div className="mb-3 space-y-2">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded bg-gray-50 p-2 text-sm">
                <p className="whitespace-pre-wrap font-serif">{comment.content}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(comment.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        <WarningText />

        <form onSubmit={handleAddComment} className="mt-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="mt-2 rounded bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {loading ? "Posting..." : "Post Comment"}
          </button>
        </form>
      </div>
    </div>
  );
}

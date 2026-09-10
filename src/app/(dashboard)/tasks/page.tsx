import Link from "next/link";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Select } from "@/components/ui/select";
import { getWorkspaceContext } from "@/lib/workspace/server";
import { TaskBoard } from "@/components/task-board";
import {
  assignTask,
  attachTaskFile,
  createChecklistItem,
  createTask,
  createTaskComment,
  createTaskLabel,
  deleteTaskPermanently,
  detachTaskFile,
  restoreTask,
  toggleChecklistItem,
  toggleTaskLabel,
  trashTask,
  updateTask,
  updateTaskStatus,
} from "./actions";

type TaskView = "active" | "trash";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; view?: TaskView }>;
}) {
  const { error, success, view = "active" } = await searchParams;
  const currentView: TaskView = view === "trash" ? "trash" : "active";
  const context = await getWorkspaceContext();
  if (!context) return null;

  let tasksQuery = context.supabase
    .from("tasks")
    .select(
      "id,title,description,status,priority,due_date,assignee_id,created_by,deleted_at",
    )
    .eq("workspace_id", context.workspaceId);
  tasksQuery =
    currentView === "trash"
      ? tasksQuery.not("deleted_at", "is", null)
      : tasksQuery.is("deleted_at", null);
  const { data: tasks, error: tasksError } = await tasksQuery.order(
    "created_at",
    { ascending: false },
  );
  const taskRows = tasks ?? [];

  const header = (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Plan and execute</p>
          <h1 className="page-title">Tasks</h1>
          <p className="page-description">
            Keep ownership, priority, and the next action visible without adding
            noise.
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600">
          {taskRows.length} {currentView === "trash" ? "trashed" : "active"}
        </span>
      </header>
      <nav aria-label="Task views" className="mt-6 flex gap-2">
        <Link
          href="/tasks"
          className={
            currentView === "active" ? "button-secondary" : "button-quiet"
          }
        >
          Active
        </Link>
        <Link
          href="/tasks?view=trash"
          className={
            currentView === "trash" ? "button-secondary" : "button-quiet"
          }
        >
          Trash
        </Link>
      </nav>
      {(error || tasksError) && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error ?? "Could not load tasks. Please try again."}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {success}
        </p>
      )}
    </>
  );

  if (currentView === "trash")
    return (
      <div className="page-container">
        {header}
        <section className="mt-8 space-y-3">
          {taskRows.length ? (
            taskRows.map((task) => (
              <article key={task.id} className="surface p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{task.title}</h2>
                    {task.description && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-500">
                        {task.description}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-zinc-400">
                      {task.priority} priority
                      {task.due_date
                        ? " ? Due " +
                          new Date(
                            task.due_date + "T00:00:00",
                          ).toLocaleDateString()
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <form action={restoreTask}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button
                        className="button-secondary"
                        aria-label={`Restore ${task.title}`}
                      >
                        Restore
                      </button>
                    </form>
                    {task.created_by === context.user.id && (
                      <details className="rounded-xl border border-red-200 px-3 py-2">
                        <summary className="cursor-pointer text-sm font-semibold text-red-600">
                          Delete permanently
                        </summary>
                        <p className="mt-2 max-w-56 text-xs text-zinc-500">
                          This removes the task and its details forever.
                        </p>
                        <form action={deleteTaskPermanently} className="mt-2">
                          <input type="hidden" name="taskId" value={task.id} />
                          <button
                            className="button-quiet min-h-0 px-2 py-1 text-xs text-red-600"
                            aria-label={`Permanently delete ${task.title}`}
                          >
                            Confirm delete
                          </button>
                        </form>
                      </details>
                    )}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state surface">
              <h2 className="font-semibold">Trash is empty</h2>
              <p>
                Deleted tasks will appear here until restored or permanently
                removed.
              </p>
            </div>
          )}
        </section>
      </div>
    );

  const taskIds = taskRows.map((task) => task.id);
  const { data: members } = await context.supabase
    .from("workspace_members")
    .select("user_id,role")
    .eq("workspace_id", context.workspaceId)
    .order("created_at");
  const { data: labels } = await context.supabase
    .from("task_labels")
    .select("id,name,color")
    .eq("workspace_id", context.workspaceId)
    .order("name");
  const { data: assignments } = taskIds.length
    ? await context.supabase
        .from("task_label_assignments")
        .select("task_id,label_id")
        .in("task_id", taskIds)
    : { data: [] as Array<{ task_id: string; label_id: string }> };
  const { data: checklist } = taskIds.length
    ? await context.supabase
        .from("task_checklist_items")
        .select("id,task_id,title,is_completed")
        .in("task_id", taskIds)
        .order("position")
    : {
        data: [] as Array<{
          id: string;
          task_id: string;
          title: string;
          is_completed: boolean;
        }>,
      };
  const { data: comments } = taskIds.length
    ? await context.supabase
        .from("task_comments")
        .select("id,task_id,author_id,body,created_at")
        .in("task_id", taskIds)
        .order("created_at", { ascending: true })
    : {
        data: [] as Array<{
          id: string;
          task_id: string;
          author_id: string;
          body: string;
          created_at: string;
        }>,
      };
  const { data: attachmentRows } = taskIds.length
    ? await context.supabase
        .from("task_attachments")
        .select("id,task_id,file_id")
        .in("task_id", taskIds)
    : { data: [] as Array<{ id: string; task_id: string; file_id: string }> };
  const attachmentFileIds = Array.from(
    new Set((attachmentRows ?? []).map((attachment) => attachment.file_id)),
  );
  const { data: attachmentFiles } = attachmentFileIds.length
    ? await context.supabase
        .from("files")
        .select("id,name,mime_type,size_bytes")
        .in("id", attachmentFileIds)
    : {
        data: [] as Array<{
          id: string;
          name: string;
          mime_type: string;
          size_bytes: number;
        }>,
      };
  const filesById = new Map(
    (attachmentFiles ?? []).map((file) => [file.id, file]),
  );
  const taskAttachments = (attachmentRows ?? []).flatMap((attachment) => {
    const file = filesById.get(attachment.file_id);
    return file ? [{ ...attachment, file }] : [];
  });
  const { data: timeline } = taskIds.length
    ? await context.supabase
        .from("activity_logs")
        .select("id,action,entity_id,created_at")
        .eq("workspace_id", context.workspaceId)
        .eq("entity_type", "task")
        .in("entity_id", taskIds)
        .order("created_at", { ascending: false })
    : {
        data: [] as Array<{
          id: string;
          action: string;
          entity_id: string;
          created_at: string;
        }>,
      };
  const { data: availableFiles } = await context.supabase
    .from("files")
    .select("id,name,mime_type,size_bytes")
    .eq("workspace_id", context.workspaceId)
    .is("trashed_at", null)
    .order("name");
  const openTasks = taskRows.filter(
    (task) => task.status !== "done" && task.status !== "cancelled",
  ).length;
  const dueTasks = taskRows.filter(
    (task) =>
      task.due_date && task.status !== "done" && task.status !== "cancelled",
  ).length;

  return (
    <div className="page-container">
      {header}
      <div className="mt-6 flex flex-wrap gap-2">
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
          {openTasks} open
        </span>
        <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600">
          {dueTasks} scheduled
        </span>
      </div>
      <section className="surface mt-8 p-5">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Quick add</p>
            <h2 className="mt-1 text-lg font-semibold">Create a task</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Start with the outcome, then set the urgency and date.
            </p>
          </div>
        </div>
        <form
          action={createTask}
          className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
        >
          <label className="sr-only" htmlFor="task-title">
            Task title
          </label>
          <input
            id="task-title"
            required
            name="title"
            placeholder="What needs to happen?"
            className="field-control"
          />
          <Select
            name="priority"
            defaultValue="medium"
            options={[
              { value: "low", label: "Low priority" },
              { value: "medium", label: "Medium priority" },
              { value: "high", label: "High priority" },
            ]}
          />
          <label className="sr-only" htmlFor="task-due-date">
            Due date
          </label>
          <DateTimePicker name="dueDate" dateOnly />
          <Select
            name="assigneeId"
            defaultValue=""
            options={[
              { value: "", label: "Unassigned" },
              ...(members ?? []).map((member) => ({
                value: member.user_id,
                label: "Member " + member.user_id.slice(0, 8),
              })),
            ]}
          />
          <button className="button-primary">Add task</button>
        </form>
      </section>
      <section className="surface mt-4 mb-4 p-5">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Labels</p>
            <h2 className="mt-1 text-base font-semibold">Manage task labels</h2>
          </div>
        </div>
        <form
          action={createTaskLabel}
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <input
            required
            name="name"
            placeholder="New label name"
            className="field-control min-h-0 py-2 text-xs"
            aria-label="Label name"
          />
          <Select
            name="color"
            defaultValue="indigo"
            options={[
              { value: "indigo", label: "Neutral" },
              { value: "blue", label: "Blue" },
              { value: "emerald", label: "Emerald" },
              { value: "rose", label: "Rose" },
              { value: "amber", label: "Amber" },
            ]}
          />
          <button className="button-secondary min-h-0 px-3 py-2 text-xs">
            Create label
          </button>
        </form>
        {(labels ?? []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(labels ?? []).map((label) => (
              <span
                key={label.id}
                className="rounded-full px-2 py-1 text-xs font-semibold bg-[var(--surface-muted)] text-[var(--foreground)]"
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
      </section>
      <TaskBoard
        tasks={taskRows}
        action={updateTaskStatus}
        advanced={{
          members: members ?? [],
          labels: labels ?? [],
          assignments: assignments ?? [],
          checklist: checklist ?? [],
          comments: comments ?? [],
          files: availableFiles ?? [],
          attachments: taskAttachments,
          timeline: timeline ?? [],
          actions: {
            assignTask,
            attachTaskFile,
            createChecklistItem,
            createTaskComment,
            detachTaskFile,
            toggleChecklistItem,
            toggleTaskLabel,
            trashTask,
            updateTask,
          },
        }}
      />
    </div>
  );
}

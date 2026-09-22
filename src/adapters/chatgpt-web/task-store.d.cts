export function poll(directory: string, owner: string, input?: { task_id?: string; response_text?: string }): {
  has_next: boolean;
  task_id?: string;
  next_task?: string;
  message: string;
};
